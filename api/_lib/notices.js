// Avisos: lectura, tipos, envíos programados, reenvío a quien no lo ha leído y plantillas (13/11/2026).
// Todo recibe `db` ({ query }) para poder probarlo con una base local. Nada de esto toca la API genérica:
// los avisos y las plantillas son privados del club (CLUB_PRIVATE) y solo se llegan a través de /api/club.

export const NOTICE_KINDS = ['general', 'urgente', 'partido', 'entreno', 'documentacion'];
export const kindOf = (k) => (NOTICE_KINDS.includes(k) ? k : 'general');

export const MAX_SCHEDULE_DAYS = 60;
export const RESEND_GAP_MIN = 30;     // no se puede volver a reenviar el mismo aviso antes de media hora
export const INBOX_LIMIT = 40;
const STUCK_MIN = 10;                 // un envío que lleva más de 10 min «enviando» se vuelve a intentar

/**
 * Hora de envío programado. Devuelve el ISO en UTC (texto: se compara como texto, así nunca hay que convertir en SQL),
 * null si no se pide programar, o lanza 'bad_send_at' si no vale (pasada, más de 60 días o no es una fecha).
 */
export function cleanSendAt(raw, now = new Date()) {
  if (raw === undefined || raw === null || raw === '') return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error('bad_send_at');
  if (d.getTime() < now.getTime() + 60_000) throw new Error('bad_send_at');
  if (d.getTime() > now.getTime() + MAX_SCHEDULE_DAYS * 86_400_000) throw new Error('bad_send_at');
  return d.toISOString();
}

// Al tocar el aviso en el móvil se abre su dirección con ?aviso=<id> para marcarlo como leído (antes del #)
export function withNoticeParam(url, id) {
  const base = typeof url === 'string' && url.startsWith('/') ? url : '/Avisos';
  const [path, hash] = base.split('#');
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}aviso=${encodeURIComponent(id)}${hash !== undefined ? `#${hash}` : ''}`;
}

// Los avisos de antes de que existiera la lectura no llevan `track_read`: cuentan como leídos y no tienen datos
const tracked = (d) => d.track_read === true;
const readSet = (d) => new Set(Array.isArray(d.read_ids) ? d.read_ids : []);
export const isReadBy = (d, uid) => !tracked(d) || readSet(d).has(uid);

export function inboxItem(row, uid) {
  const d = row.data || {};
  return {
    id: row.id, title: d.title, body: d.body, url: d.url, kind: kindOf(d.kind), sender_name: d.sender_name,
    created_date: d.sent_at || row.created_at, read: isReadBy(d, uid),
  };
}

export function readStats(d) {
  const recipients = Array.isArray(d.recipient_ids) ? d.recipient_ids : [];
  if (!tracked(d)) return { tracked: false, read: null, unread: null };
  const r = readSet(d);
  const read = recipients.filter((id) => r.has(id)).length;
  return { tracked: true, read, unread: recipients.length - read };
}

export function historyItem(row) {
  const d = row.data || {};
  const recipients = Array.isArray(d.recipient_ids) ? d.recipient_ids.length : 0;
  return {
    id: row.id, title: d.title, body: d.body, kind: kindOf(d.kind), sender_id: d.sender_id, sender_name: d.sender_name,
    audience_label: d.audience_label, team_ids: d.audience?.team_ids || [], all_club: !!d.audience?.all_club,
    status: d.status || 'enviado', send_at: d.send_at || null,
    recipients, expected: d.expected || 0, error: d.error || null, sent: d.sent || 0, devices: d.devices || 0,
    resent_at: d.resent_at || null, resent_count: d.resent_count || 0,
    created_date: d.sent_at || row.created_at,
    ...readStats(d),
  };
}

// Resumen de lo enviado: esta semana (lunes) y lectura media de los últimos 30 días
export function historyStats(items, now = new Date()) {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sent = items.filter((n) => n.status === 'enviado');
  const week = sent.filter((n) => new Date(n.created_date) >= monday);
  const since = now.getTime() - 30 * 86_400_000;
  const withData = sent.filter((n) => n.tracked && n.recipients > 0 && new Date(n.created_date).getTime() >= since);
  const reads = withData.reduce((s, n) => s + n.read, 0);
  const total = withData.reduce((s, n) => s + n.recipients, 0);
  return {
    week: week.length,
    week_urgent: week.filter((n) => n.kind === 'urgente').length,
    read_pct: total ? Math.round((reads / total) * 100) : null,
    read_n: withData.length,
    scheduled: items.filter((n) => n.status === 'programado').length,
  };
}

// ── Lectura ─────────────────────────────────────────────────────────────────
const APPEND_READ = `data = jsonb_set(data, '{read_ids}', coalesce(data -> 'read_ids', '[]'::jsonb) || to_jsonb($1::text)), updated_at = now()`;
const NOT_READ = `data -> 'recipient_ids' ? $1 and data ->> 'track_read' = 'true' and not (coalesce(data -> 'read_ids', '[]'::jsonb) ? $1)`;

export async function markRead(db, uid, ids) {
  const list = (Array.isArray(ids) ? ids : []).filter((x) => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 50);
  if (!list.length) return 0;
  const { rows } = await db.query(
    `update entities set ${APPEND_READ} where entity_type = 'Notice' and id = any($2::uuid[]) and ${NOT_READ} returning id`, [uid, list]
  );
  return rows.length;
}

export async function markAllRead(db, uid) {
  const { rows } = await db.query(`update entities set ${APPEND_READ} where entity_type = 'Notice' and ${NOT_READ} returning id`, [uid]);
  return rows.length;
}

// Sin leer entre los avisos que se ven en Recibidos (los 40 últimos)
export async function unreadCount(db, uid) {
  const { rows } = await db.query(
    `select count(*)::int as n from (
       select data from entities where entity_type = 'Notice' and data -> 'recipient_ids' ? $1 order by created_at desc limit ${INBOX_LIMIT}
     ) x where data ->> 'track_read' = 'true' and not (coalesce(data -> 'read_ids', '[]'::jsonb) ? $1)`, [uid]
  );
  return rows[0].n;
}

// ── Envío ───────────────────────────────────────────────────────────────────
/**
 * Datos de un aviso nuevo. `scheduled` = ISO de envío programado (sin destinatarios todavía: se calculan al enviarlo,
 * así entra quien se haya dado de alta entretanto) o null si sale ya.
 */
export function noticeData({ title, body, url, kind, audience, audience_label, sender, scheduled = null }) {
  return {
    title, body, url, kind: kindOf(kind), sender_id: sender.id, sender_name: sender.full_name || sender.email,
    audience: audience || {}, audience_label: String(audience_label || '').slice(0, 200),
    track_read: true, read_ids: [],
    ...(scheduled ? { status: 'programado', send_at: scheduled, recipient_ids: [] } : { status: 'enviado' }),
  };
}

/**
 * Envía los avisos programados que ya tocan. Se reclaman de uno en uno con una sola orden (dos llamadas a la vez nunca
 * envían el mismo). deps = { loadUser(id), canSend(user), resolve(user, audience) -> ids[], push(ids, payload) }.
 */
export async function dispatchDue(db, deps, now = new Date()) {
  const nowIso = now.toISOString();
  const stuck = new Date(now.getTime() - STUCK_MIN * 60_000).toISOString();
  const { rows } = await db.query(
    `update entities set data = data || jsonb_build_object('status', 'enviando', 'claimed_at', $1::text), updated_at = now()
      where entity_type = 'Notice' and (
        (data ->> 'status' = 'programado' and data ->> 'send_at' <= $1)
        or (data ->> 'status' = 'enviando' and data ->> 'claimed_at' < $2))
      returning id, data`, [nowIso, stuck]
  );
  let done = 0;
  for (const r of rows) {
    const d = r.data;
    let patch;
    try {
      const sender = await deps.loadUser(d.sender_id);
      if (!sender || !deps.canSend(sender)) throw new Error('sender_gone');
      const ids = await deps.resolve(sender, d.audience || {});
      if (!ids.length) throw new Error('no_recipients');
      const delivery = await deps.push(ids, { title: d.title, body: d.body, url: withNoticeParam(d.url, r.id), notice_id: r.id });
      patch = { status: 'enviado', sent_at: new Date().toISOString(), recipient_ids: ids, ...delivery };
      done++;
    } catch (e) {
      patch = { status: 'fallido', error: String(e.message || e).slice(0, 80) };
    }
    await db.query(
      `update entities set data = (data - 'claimed_at') || $2::jsonb, created_at = case when $3 then now() else created_at end, updated_at = now() where id = $1`,
      [r.id, JSON.stringify(patch), patch.status === 'enviado']
    );
  }
  return { claimed: rows.length, sent: done };
}

export const canManageNotice = (d, user, coord) => coord || d.sender_id === user.id;

/** Reenvía un aviso solo a quien todavía no lo ha leído. Lanza 'not_found' | 'forbidden' | 'untracked' | 'too_soon' | 'nobody'. */
export async function resendUnread(db, { id, user, coord, push, now = new Date() }) {
  const { rows } = await db.query(`select id, data from entities where entity_type = 'Notice' and id = $1`, [id]);
  const d = rows[0]?.data;
  if (!d) throw new Error('not_found');
  if (!canManageNotice(d, user, coord)) throw new Error('forbidden');
  if (!tracked(d) || (d.status && d.status !== 'enviado')) throw new Error('untracked');
  if (d.resent_at && now.getTime() - new Date(d.resent_at).getTime() < RESEND_GAP_MIN * 60_000) throw new Error('too_soon');
  const read = readSet(d);
  const unread = (d.recipient_ids || []).filter((u) => !read.has(u));
  if (!unread.length) throw new Error('nobody');
  const delivery = await push(unread, { title: `Recordatorio: ${d.title}`.slice(0, 110), body: d.body, url: withNoticeParam(d.url, id), notice_id: id });
  await db.query(
    `update entities set data = data || $2::jsonb, updated_at = now() where id = $1`,
    [id, JSON.stringify({ resent_at: now.toISOString(), resent_count: (d.resent_count || 0) + 1, resent_to: unread.length })]
  );
  return { to: unread.length, ...delivery };
}

// ── Lista de quién lo ha leído ──────────────────────────────────────────────
const playerName = (p) => `${p.data.first_name || ''} ${p.data.last_name || ''}`.trim();
const STAFF_ROLES = new Set(['director', 'director_deportivo', 'coordinador_general', 'coordinador_f7', 'coordinador_f11', 'entrenador', 'entrenador_porteros', 'preparador_fisico', 'psicologo', 'fisioterapeuta']);

/**
 * Quién es cada destinatario: nombre, si es jugador, familiar o cuerpo técnico, y su equipo (el del jugador; el del
 * hijo en un familiar; el primero que lleva en el cuerpo técnico). teams = Map id -> nombre.
 */
export function describeRecipients(ids, { users, players, links, teams }) {
  const userBy = new Map(users.map((u) => [u.id, u.data]));
  const playerBy = new Map(players.map((p) => [p.id, p]));
  const kidOf = new Map();
  for (const l of links) {
    if (l.data.status !== 'approved' || kidOf.has(l.data.user_id)) continue;
    const p = playerBy.get(l.data.player_id);
    if (p) kidOf.set(l.data.user_id, p);
  }
  return ids.map((id) => {
    const d = userBy.get(id) || {};
    const own = d.player_id ? playerBy.get(d.player_id) : null;
    const staff = STAFF_ROLES.has(d.app_role) || d.role === 'admin';
    const kid = kidOf.get(id);
    const kind = d.app_role === 'jugador' ? 'jugador' : d.app_role === 'familiar' ? 'familiar' : staff ? 'tecnico' : own ? 'jugador' : kid ? 'familiar' : 'otro';
    const teamId = kind === 'familiar' ? kid?.data.team_id : kind === 'jugador' ? own?.data.team_id
      : [...(d.team_ids || []), ...(d.team_id ? [d.team_id] : [])][0];
    const name = (d.full_name || '').trim() || (own ? playerName(own) : '') || String(d.email || '').split('@')[0] || '—';
    return { id, name, kind, team: teams.get(teamId) || '', child: kind === 'familiar' && kid ? playerName(kid) : '' };
  });
}

// Sin leer agrupado por equipo, de más a menos («Infantil A 31 · Cadete B 24 …»)
export function unreadByTeam(people) {
  const m = new Map();
  for (const p of people) m.set(p.team || '', (m.get(p.team || '') || 0) + 1);
  return [...m.entries()].map(([team, n]) => ({ team, n })).sort((a, b) => b.n - a.n || a.team.localeCompare(b.team, 'es'));
}

// ── Plantillas ──────────────────────────────────────────────────────────────
// Las de coordinación las ven todos los que envían avisos; las de un entrenador, solo él. Las cambia su autor o coordinación.
export function cleanTemplate(body = {}) {
  const name = String(body.name || '').trim().slice(0, 60);
  const title = String(body.title || '').trim().slice(0, 100);
  const text = String(body.body || '').slice(0, 1800);
  if (!name || (!title && !text.trim())) throw new Error('bad_template');
  return { name, title, body: text, kind: kindOf(body.kind) };
}

export const templateVisible = (d, user, coord) => coord || d.owner_id === user.id || d.shared === true;
export const templateEditable = (d, user, coord) => coord || d.owner_id === user.id;
