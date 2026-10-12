import { query } from './db.js';

export const CLUB_CODE = '40493342';
const BASE = `https://www.fcf.cat/api/clubs/${CLUB_CODE}`;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function getJson(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!r.ok) throw new Error(`FCF ${r.status} en ${url}`);
  const j = await r.json();
  return j.data;
}

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const strip = (s) => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => strip(s).toLowerCase();
const tokensKey = (s) => norm(s).split(' ').filter(Boolean).sort().join(' ');

function titleCase(s) {
  return clean(s)
    .toLowerCase()
    .replace(/(^|[\s\-'’(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}


const SIGLAS = new Set(['CE','CF','UE','UD','FC','AE','CD','EF','FE','AD','CP','SD','UDC','APA','AEC','CFS','EFB','CEB','FS','AFE','ACE','UEC','EFS','EE','CB','AA','AEM']);
const LOWER = new Set(['de','del','dels','la','les','el','els','i','y','d','l','al','amb']);

function capSegment(seg) {
  return seg
    .toLowerCase()
    .replace(/(^|[\-'’(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

// "PÇ BARC. BARCINO, CE "a"" -> siglas en mayúsculas, letra de equipo en mayúsculas
export function prettyName(raw) {
  const words = clean(raw).replace(/\s+,/g, ',').split(' ').filter(Boolean);
  return words
    .map((w, i) => {
      if (/^"[^"]*"$/.test(w)) return w.toUpperCase();
      const base = w.replace(/,+$/, '');
      const comma = w.slice(base.length);
      if (/^(?:\p{L}\.){2,}$/u.test(base)) return base.toUpperCase() + comma;
      const core = base.replace(/\.+$/, '');
      const dots = base.slice(core.length);
      if (SIGLAS.has(core.toUpperCase())) return core.toUpperCase() + dots + comma;
      if (i > 0 && LOWER.has(core.toLowerCase())) return core.toLowerCase() + dots + comma;
      return core.split('.').map(capSegment).join('.') + dots + comma;
    })
    .join(' ');
}

export function categorySlug(name) {
  let s = norm(name).replace(/[^a-z0-9]+/g, ' ').trim();
  s = s.replace(/\balevi\b/g, 'alevin').replace(/\bbenjami\b/g, 'benjamin');
  return s.replace(/ /g, '_');
}

function currentSeason() {
  const d = new Date();
  const y = d.getFullYear();
  return d.getMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function isF7(catName) {
  const c = norm(catName);
  return /(alevi s11|benjami|prebenjami)/.test(c);
}

function splitName(full) {
  const parts = clean(full).split(' ');
  if (parts.length <= 2) return { first: titleCase(parts[0] || ''), last: titleCase(parts.slice(1).join(' ')) };
  const last = parts.slice(-2).join(' ');
  const first = parts.slice(0, -2).join(' ');
  return { first: titleCase(first), last: titleCase(last) };
}

function shortTeamName(catName, letter) {
  const c = norm(catName);
  const sMatch = c.match(/\bs(\d{1,2})\b/);
  const sTag = sMatch ? ` S${sMatch[1]}` : '';
  let base;
  if (c.startsWith('prebenjami') || c.includes(' prebenjami')) base = 'Prebenjamí';
  else if (c.includes('benjami')) base = 'Benjamí';
  else if (c.includes('alevi')) base = 'Aleví';
  else if (c.includes('infantil')) base = 'Infantil';
  else if (c.includes('cadet')) base = 'Cadet';
  else if (c.includes('juvenil')) base = 'Juvenil';
  else if (c.includes('tercera catalana')) return 'Primer Equipo';
  else base = titleCase(catName);
  return `${base}${sTag} ${clean(letter) || 'A'}`.trim();
}

function addMinutes(naive, mins) {
  const d = new Date(naive + 'Z');
  d.setUTCMinutes(d.getUTCMinutes() + mins);
  return d.toISOString().slice(0, 16);
}

async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

async function bulkInsert(type, rows) {
  if (!rows.length) return [];
  const { rows: res } = await query(
    `insert into entities (entity_type, data)
     select $1, x from jsonb_array_elements($2::jsonb) x returning id`,
    [type, JSON.stringify(rows)]
  );
  return res;
}

async function bulkPatch(items) {
  if (!items.length) return;
  await query(
    `update entities e set data = e.data || x.d, updated_at = now()
       from jsonb_to_recordset($1::jsonb) as x(id uuid, d jsonb)
      where e.id = x.id`,
    [JSON.stringify(items)]
  );
}

export async function syncFcf() {
  const stats = { teams_created: 0, teams_updated: 0, players_created: 0, players_existing: 0, matches_created: 0, matches_updated: 0, errors: [] };
  const club = await getJson(BASE);
  const season = currentSeason();
  const clubTeams = club.teams || [];

  // Descargas en paralelo
  const details = await pool(clubTeams, 6, async (t) => {
    try { return await getJson(`${BASE}/team/${t.codequipo}`); }
    catch (e) { stats.errors.push(`${t.codequipo}: ${e.message}`); return null; }
  });

  // Estado actual en pocas consultas
  const { rows: teamRows } = await query(`select id, data from entities where entity_type = 'Team'`);
  const teamByCode = new Map(teamRows.filter((r) => r.data.fcf_team_code).map((r) => [String(r.data.fcf_team_code), r]));
  const { rows: playerRows } = await query(`select id, data from entities where entity_type = 'Player'`);
  const playersByTeam = new Map();
  for (const r of playerRows) {
    const k = r.data.team_id;
    if (!playersByTeam.has(k)) playersByTeam.set(k, new Set());
    playersByTeam.get(k).add(tokensKey(`${r.data.first_name || ''} ${r.data.last_name || ''}`));
  }
  const { rows: eventRows } = await query(
    `select id, data ->> 'fcf_acta' as acta, data ->> 'opponent_logo_url' as logo from entities where entity_type = 'Event' and data ? 'fcf_acta'`
  );
  const eventByActa = new Map(eventRows.map((r) => [r.acta, { id: r.id, logo: r.logo }]));

  const eventInserts = [];
  const eventPatches = [];
  const playerInserts = [];
  const teamPatches = [];
  const usedNames = new Set();

  for (let n = 0; n < clubTeams.length; n++) {
    const t = clubTeams[n];
    const detail = details[n];
    if (!detail) continue;
    try {
      const code = String(t.codequipo);
      const catName = clean(t.categoria_nombre);
      const slug = categorySlug(catName);
      let name = shortTeamName(catName, t.letra_equipo);
      if (usedNames.has(name)) name = `${name} (${code.slice(-4)})`;
      usedNames.add(name);
      const c = detail.campos || {};
      const days = [['L', 'ENTRENAR_LUNES'], ['M', 'ENTRENAR_MARTES'], ['X', 'ENTRENAR_MIERCOLES'], ['J', 'ENTRENAR_JUEVES'], ['V', 'ENTRENAR_VIERNES'], ['S', 'ENTRENAR_SABADO'], ['D', 'ENTRENAR_DOMINGO']]
        .filter(([, k]) => c[k] === '1').map(([d]) => d).join(' ');
      const fcfInfo = {
        fcf_team_code: code,
        fcf_category_name: catName,
        fcf_group_url: `https://www.fcf.cat/ca/clubs/${CLUB_CODE}/categories/${code}`,
        fcf_training: c.campo_entrenamiento ? `${days} ${c.ENTRENAR_HORARIO || ''} · ${prettyName(c.campo_entrenamiento)}`.trim() : '',
        fcf_home_field: prettyName(c.campo_juego || ''),
        fcf_match_time: c.JUGAR_HORARIO || '',
        fcf_synced_at: new Date().toISOString(),
      };

      let team = teamByCode.get(code);
      if (!team) {
        const { rows } = await query(
          `insert into entities (entity_type, data) values ('Team', $1::jsonb) returning id, data`,
          [JSON.stringify({ name, fcf_auto_name: name, category: slug, season, ...fcfInfo })]
        );
        team = rows[0];
        stats.teams_created++;
      } else {
        const extra = {};
        const oldAuto = `${titleCase(catName)}${clean(t.letra_equipo) ? ' ' + clean(t.letra_equipo) : ''}`;
        const cur = team.data.name || '';
        // Solo se renombra si el nombre sigue siendo el automático; si lo has cambiado tú, se respeta
        const isAuto = !cur || cur === team.data.fcf_auto_name || cur === oldAuto || cur === name;
        if (isAuto) { extra.name = name; extra.fcf_auto_name = name; }
        if (!team.data.category) extra.category = slug;
        if (!team.data.season) extra.season = season;
        teamPatches.push({ id: team.id, d: { ...fcfInfo, ...extra } });
        stats.teams_updated++;
      }
      const teamId = team.id;
      const curName = team.data.name || '';
      const teamName = !curName || curName === team.data.fcf_auto_name || curName === `${titleCase(catName)}${clean(t.letra_equipo) ? ' ' + clean(t.letra_equipo) : ''}` || curName === name ? name : curName;

      // Jugadores
      const known = playersByTeam.get(teamId) || new Set();
      for (const p of detail.players || []) {
        const key = tokensKey(p.NOMBRE);
        if (!key) continue;
        if (known.has(key)) { stats.players_existing++; continue; }
        const { first, last } = splitName(p.NOMBRE);
        playerInserts.push({ first_name: first, last_name: last, team_id: teamId, status: 'activo', fcf_imported: true });
        known.add(key);
        stats.players_created++;
      }

      // Partidos
      for (const m of detail.matches || []) {
        if (!m.COMIENZO1) continue;
        const home = String(m.CODEQUIPO_CASA) === code;
        const opp = prettyName(home ? m.NOMBRE_FUERA : m.NOMBRE_CASA);
        const crest = home ? m.ESCUDO_FUERA : m.ESCUDO_CASA;
        const date = m.COMIENZO1.replace(' ', 'T').slice(0, 16);
        const hg = m.GOLES_CASA, ag = m.GOLES_FUERA;
        const played = hg !== null && hg !== undefined && ag !== null && ag !== undefined;
        const j = Number(m.JORNADA);
        const data = {
          title: `${j > 0 ? 'J' + j + ' · ' : ''}${home ? `${teamName} vs ${opp}` : `${opp} vs ${teamName}`}`,
          type: 'partido_liga',
          team_id: teamId,
          date,
          end_date: addMinutes(date, 120),
          location: prettyName(m.CAMPO || ''),
          opponent: opp,
          is_home: home,
          football_format: isF7(catName) ? 'f7' : 'f11',
          fcf_acta: String(m.CODACTA),
          fcf_jornada: j,
          fcf_competition: clean(m.NOMBRE_COMPETICION || ''),
          fcf_group: clean(m.GRUPO || ''),
        };
        if (crest) data.fcf_opponent_logo = `https://files.fcf.cat/escudos/clubes/escudos/${crest}`;
        if (played) { data.score_home = Number(home ? hg : ag); data.score_away = Number(home ? ag : hg); }
        const existing = eventByActa.get(String(m.CODACTA));
        if (existing) {
          // No pisar un escudo que hayas subido tú
          if (data.fcf_opponent_logo && (!existing.logo || existing.logo.startsWith('https://files.fcf.cat/'))) data.opponent_logo_url = data.fcf_opponent_logo;
          eventPatches.push({ id: existing.id, d: data });
          stats.matches_updated++;
        } else {
          if (data.fcf_opponent_logo) data.opponent_logo_url = data.fcf_opponent_logo;
          eventInserts.push(data);
          stats.matches_created++;
        }
      }
    } catch (e) {
      stats.errors.push(`${t.codequipo}: ${e.message}`);
    }
  }

  await bulkPatch(teamPatches);
  await bulkInsert('Player', playerInserts);
  await bulkInsert('Event', eventInserts);
  await bulkPatch(eventPatches);
  try { await syncActas(stats); } catch (e) { stats.errors.push(`actas: ${e.message}`); }
  return stats;
}

// ── Actas: alineaciones, goles, tarjetas y cambios desde la FCF ──────────────
const ACTA_BASE = 'https://www.fcf.cat/api/acta';

function fcfPlayerKey(nombre) {
  // "APELLIDOS, NOMBRE" -> mismos tokens que "NOMBRE APELLIDOS"
  return tokensKey(String(nombre || '').replace(',', ' '));
}

async function syncActas(stats) {
  stats.actas_synced = 0;
  stats.actas_pending = 0;
  const { rows: evRows } = await query(
    `select id, data from entities
      where entity_type = 'Event' and data ? 'fcf_acta' and data ? 'score_home'
        and coalesce(data ->> 'fcf_acta_synced', '') = ''`
  );
  if (!evRows.length) return;
  const { rows: teamRows } = await query(`select id, data from entities where entity_type = 'Team'`);
  const teamCode = new Map(teamRows.map((r) => [r.id, String(r.data.fcf_team_code || '')]));
  const { rows: playerRows } = await query(`select id, data from entities where entity_type = 'Player'`);
  const playersByTeam = new Map();
  for (const r of playerRows) {
    const k = r.data.team_id;
    if (!playersByTeam.has(k)) playersByTeam.set(k, new Map());
    playersByTeam.get(k).set(tokensKey(`${r.data.first_name || ''} ${r.data.last_name || ''}`), r.id);
  }
  const { rows: convRows } = await query(`select id, data ->> 'event_id' as ev, data -> 'fcf_auto' as auto from entities where entity_type = 'Convocatoria'`);
  const convByEvent = new Map(convRows.map((r) => [r.ev, r]));
  const { rows: msRows } = await query(`select id, data ->> 'event_id' as ev, data ->> 'player_id' as pl from entities where entity_type = 'MatchStats'`);
  const msByKey = new Map(msRows.map((r) => [`${r.ev}|${r.pl}`, r.id]));

  const actas = await pool(evRows, 6, async (ev) => {
    try { return await getJson(`${ACTA_BASE}/${ev.data.fcf_acta}`); } catch (e) { stats.errors.push(`acta ${ev.data.fcf_acta}: ${e.message}`); return null; }
  });

  const newPlayers = [];
  const evPatches = [], convInserts = [], convPatches = [], msInserts = [], msPatches = [];
  const pending = []; // jugadores nuevos a resolver tras insertar

  for (let i = 0; i < evRows.length; i++) {
    const ev = evRows[i], a = actas[i];
    if (!a) continue;
    if (String(a.CERRADA) !== '1') { stats.actas_pending++; continue; }
    const code = teamCode.get(ev.data.team_id);
    const ourSide = String(a.CODEQUIPO_CASA) === code ? 'local' : String(a.CODEQUIPO_FUERA) === code ? 'visitante' : null;
    if (!ourSide) continue;
    const theirSide = ourSide === 'local' ? 'visitante' : 'local';
    const roster = playersByTeam.get(ev.data.team_id) || new Map();
    const idToPlayer = new Map(); // id FCF -> id app
    const ourList = a[`jugadores_equipo_${ourSide}`] || [];
    for (const j of ourList) {
      const key = fcfPlayerKey(j.nombre);
      let pid = roster.get(key);
      if (!pid) {
        const parts = String(j.nombre).split(',');
        const first = titleCase((parts[1] || '').trim());
        const last = titleCase((parts[0] || '').trim());
        const fresh = { first_name: first, last_name: last, team_id: ev.data.team_id, status: 'activo', fcf_imported: true };
        newPlayers.push(fresh);
        pid = `@new${newPlayers.length - 1}`;
        roster.set(key, pid);
      }
      idToPlayer.set(String(j.id), pid);
    }
    const nameToPlayer = (n) => roster.get(fcfPlayerKey(n)) || '';
    const matchEvents = [];
    let k = 0;
    const mk = (o) => ({ id: `fcf_${ev.data.fcf_acta}_${k++}`, ...o });
    for (const side of ['local', 'visitante']) {
      for (const g of a[`goles_equipo_${side}`] || []) {
        const own = String(g.tipo_gol) === '102';
        const scoringOurs = own ? side === theirSide : side === ourSide;
        const ourPlayerInvolved = side === ourSide ? idToPlayer.get(String(g.id_jugador)) || nameToPlayer(g.nombre_jugador) : '';
        matchEvents.push(mk({
          type: 'goal', team: scoringOurs ? 'home' : 'away', minute: String(g.minuto ?? ''),
          playerId: scoringOurs && !own ? ourPlayerInvolved || '' : '',
          assistId: '', goalType: own ? 'gol_propio' : String(g.tipo_gol) === '101' ? 'penalti' : '',
          fcfName: String(g.nombre_jugador || '').trim(), fcfDorsal: g.dorsal || '',
        }));
      }
      for (const c of a[`tarjetas_equipo_${side}`] || []) {
        const color = c.segunda_amarilla ? 'yellow2' : String(c.tipo_tarjeta) === '100' ? 'yellow' : 'red';
        matchEvents.push(mk({
          type: 'card', team: side === ourSide ? 'home' : 'away', minute: String(c.minuto ?? ''),
          playerId: side === ourSide ? idToPlayer.get(String(c.id_jugador)) || '' : '', cardColor: color,
        }));
      }
      for (const sb of a[`sustituciones_equipo_${side}`] || []) {
        matchEvents.push(mk({
          type: 'sub', team: side === ourSide ? 'home' : 'away', minute: String(sb.minuto ?? ''),
          playerIn: side === ourSide ? idToPlayer.get(String(sb.id_jugador_entra)) || '' : '',
          playerOut: side === ourSide ? idToPlayer.get(String(sb.id_jugador_sale)) || '' : '',
        }));
      }
    }
    const refs = (a.arbitros || []).map((x) => `${x.rol || ''}: ${prettyName(String(x.nombre_arbitro || '').split(',').reverse().join(' ').trim())}`).join(' · ');
    const goalEvents = matchEvents.filter((e) => e.type === 'goal').map((e) => ({
      id: e.id, team: e.team, minute: e.minute, player_id: e.playerId, assist_player_id: '', goal_type: e.goalType,
    }));
    const manual = ev.data.goal_events_source === 'manual';
    const patch = { fcf_acta_synced: true, fcf_referee: refs };
    if (!manual) { patch.goal_events = goalEvents; patch.match_events = matchEvents; patch.goal_events_source = 'fcf'; }
    evPatches.push({ id: ev.id, d: patch });

    const starters = ourList.filter((j) => String(j.titular) === '1').map((j) => idToPlayer.get(String(j.id)));
    const called = ourList.map((j) => idToPlayer.get(String(j.id)));
    pending.push({ ev, matchEvents, called, starters, manual });
  }

  // Jugadores nuevos
  const inserted = await bulkInsert('Player', newPlayers);
  const real = (id) => (typeof id === 'string' && id.startsWith('@new') ? inserted[Number(id.slice(4))]?.id : id);
  stats.players_created += inserted.length;

  const fixIds = (arr) => arr.map(real).filter(Boolean);
  for (const p of pending) {
    const { ev, matchEvents, called, starters } = p;
    const calledIds = fixIds(called), starterIds = fixIds(starters);
    for (const e of matchEvents) {
      for (const f of ['playerId', 'playerIn', 'playerOut']) if (e[f]) e[f] = real(e[f]) || '';
    }
    const evPatch = evPatches.find((x) => x.id === ev.id);
    if (evPatch.d.match_events) { evPatch.d.match_events = matchEvents; evPatch.d.goal_events = matchEvents.filter((e) => e.type === 'goal').map((e) => ({ id: e.id, team: e.team, minute: e.minute, player_id: e.playerId, assist_player_id: '', goal_type: e.goalType })); }

    const conv = convByEvent.get(ev.id);
    const convData = { event_id: ev.id, team_id: ev.data.team_id, player_ids: calledIds, starters: starterIds, fcf_auto: true };
    if (!conv) convInserts.push(convData);
    else if (conv.auto) convPatches.push({ id: conv.id, d: { player_ids: calledIds, starters: starterIds, fcf_auto: true } });

    for (const pid of calledIds) {
      const mine = matchEvents.filter((e) => e.team === 'home' && e.playerId === pid);
      const data = {
        starter: starterIds.includes(pid),
        goals: mine.filter((e) => e.type === 'goal').length,
        yellow_cards: mine.filter((e) => e.type === 'card' && e.cardColor === 'yellow').length,
        double_yellow_card: mine.filter((e) => e.type === 'card' && e.cardColor === 'yellow2').length,
        red_cards: mine.filter((e) => e.type === 'card' && e.cardColor === 'red').length,
        fcf_auto: true,
      };
      const existing = msByKey.get(`${ev.id}|${pid}`);
      if (existing) msPatches.push({ id: existing, d: data });   // minutos, asistencias y valoración se respetan
      else msInserts.push({ player_id: pid, event_id: ev.id, date: String(ev.data.date || '').slice(0, 10), opponent: ev.data.opponent || '', minutes_played: 0, assists: 0, ...data });
    }
    stats.actas_synced++;
  }

  await bulkInsert('Convocatoria', convInserts);
  await bulkPatch(convPatches);
  await bulkInsert('MatchStats', msInserts);
  await bulkPatch(msPatches);
  await bulkPatch(evPatches);
}
