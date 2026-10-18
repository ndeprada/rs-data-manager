// Calendario suscribible (.ics) por equipo: entrenos y partidos en el calendario del móvil (iPhone, Google…).
// El enlace lleva un código secreto por equipo (no hace falta iniciar sesión, los calendarios no pueden).
// El secreto se genera una vez y se guarda en la base (entidad IcsConfig, privada); "revs" permite cambiar el enlace de un equipo.
import crypto from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MATCHES = ['partido_liga', 'partido_amistoso', 'torneo'];
const TYPE_LABEL = {
  entrenamiento: 'Entrenamiento', entrenamiento_fisico: 'Entrenamiento físico', sesion_teorica: 'Sesión teórica', sesion_video: 'Sesión de vídeo',
  concentracion: 'Concentración', partido_amistoso: 'Amistoso', partido_liga: 'Liga', torneo: 'Torneo', reunion: 'Reunión',
};

export const isUuid = (s) => UUID.test(String(s || ''));

// ── Secreto y código por equipo ──────────────────────────────────────────────
export async function readConfig(db) {
  const read = async () => (await db.query(`select data from entities where entity_type = 'IcsConfig' order by created_at asc limit 1`)).rows[0]?.data;
  let d = await read();
  if (!d) {
    await db.query(`insert into entities (entity_type, data) values ('IcsConfig', $1::jsonb)`, [JSON.stringify({ secret: crypto.randomBytes(32).toString('hex'), revs: {} })]);
    d = await read(); // si dos peticiones lo crearon a la vez, gana la más antigua
  }
  return { secret: d.secret, revs: d.revs || {} };
}

export const tokenFor = (cfg, teamId) =>
  crypto.createHmac('sha256', cfg.secret).update(`ics:${teamId}:${cfg.revs[teamId] || 0}`).digest('base64url').slice(0, 32);

export function tokenMatches(cfg, teamId, given) {
  const a = Buffer.from(tokenFor(cfg, teamId)), b = Buffer.from(String(given || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Cambia el enlace de un equipo: el anterior deja de funcionar
export async function rotateToken(db, teamId) {
  await readConfig(db);
  await db.query(
    `update entities set updated_at = now(),
       data = jsonb_set(data, '{revs}', coalesce(data->'revs', '{}'::jsonb) || jsonb_build_object($1::text, coalesce((data->'revs'->>$1::text)::int, 0) + 1))
     where id = (select id from entities where entity_type = 'IcsConfig' order by created_at asc limit 1)`,
    [teamId]
  );
  return readConfig(db);
}

// ── Formato iCalendar ────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Las líneas largas se parten a 75 bytes (UTF-8); las continuaciones empiezan con un espacio
function fold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    const max = out.length ? 74 : 75;
    if (bytes + b > max) { out.push(cur); cur = ch; bytes = b; } else { cur += ch; bytes += b; }
  }
  out.push(cur);
  return out.join('\r\n ');
}

// "2026-11-04T19:00(:00)" → fecha y hora locales (sin zona: son hora de Madrid)
function parseLocal(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}
const fmtLocal = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').slice(0, 15); // 20261104T190000
const fmtUtc = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''); // 20261104T190000Z

const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Madrid',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

// Construye el calendario. events: [{ id, data, updated_at }]. No incluye notas internas ni datos de jugadores.
export function buildIcs({ team, events, base, now = new Date() }) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Racing Sarria//RS Manager//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(`${team.name} · Racing Sarrià`)}`, 'X-WR-TIMEZONE:Europe/Madrid', 'X-PUBLISHED-TTL:PT1H', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    ...VTIMEZONE,
  ];
  let n = 0;
  for (const ev of events) {
    const d = ev.data || {};
    if (d.postponed === true) continue; // aplazado: el partido nuevo ya figura con su fecha
    const start = parseLocal(d.date);
    if (start === null) continue;
    const isMatch = MATCHES.includes(d.type);
    let end = parseLocal(d.end_date);
    if (end === null || end <= start) end = start + (isMatch ? 120 : 90) * 60000;

    const title = isMatch
      ? `⚽ ${d.title || `${TYPE_LABEL[d.type]} vs ${d.opponent || 'rival'}`}`
      : (d.title || TYPE_LABEL[d.type] || 'Evento');
    const desc = [];
    if (isMatch) {
      desc.push([d.fcf_competition, d.fcf_group, d.fcf_jornada ? `Jornada ${d.fcf_jornada}` : null].filter(Boolean).join(' · ') || TYPE_LABEL[d.type]);
      if (d.opponent) desc.push(`Rival: ${d.opponent}${d.is_home === true ? ' (en casa)' : d.is_home === false ? ' (fuera)' : ''}`);
    } else if (d.type && TYPE_LABEL[d.type] && TYPE_LABEL[d.type] !== title) desc.push(TYPE_LABEL[d.type]);
    if (base && isMatch) desc.push(`${base}/MatchDetail?id=${ev.id}`);

    const stamp = fmtUtc(ev.updated_at || d.updated_date || now);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id}@rsdm`,
      `DTSTAMP:${stamp}`,
      `LAST-MODIFIED:${stamp}`,
      `DTSTART;TZID=Europe/Madrid:${fmtLocal(start)}`,
      `DTEND;TZID=Europe/Madrid:${fmtLocal(end)}`,
      `SUMMARY:${esc(title)}`,
    );
    if (d.location) lines.push(`LOCATION:${esc(d.location)}`);
    if (desc.length) lines.push(`DESCRIPTION:${esc(desc.join('\n'))}`);
    lines.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'END:VEVENT');
    n++;
  }
  lines.push('END:VCALENDAR');
  return { text: lines.map(fold).join('\r\n') + '\r\n', count: n };
}

// Calendario de un equipo si el código es correcto; null si el equipo o el código no valen (no se distingue, para no dar pistas)
export async function feedFor(db, teamId, given, base) {
  if (!isUuid(teamId)) return null;
  const { rows: t } = await db.query(`select data from entities where id = $1 and entity_type = 'Team'`, [teamId]);
  if (!t[0]) return null;
  const cfg = await readConfig(db);
  if (!tokenMatches(cfg, teamId, given)) return null;
  const { rows } = await db.query(`select id, data, updated_at from entities where entity_type = 'Event' and data->>'team_id' = $1 order by data->>'date'`, [teamId]);
  return buildIcs({ team: t[0].data, events: rows, base });
}
