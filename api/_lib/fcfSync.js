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

async function findOne(type, key, value) {
  const { rows } = await query(
    `select id, data from entities where entity_type = $1 and data ->> '${key}' = $2 limit 1`,
    [type, String(value)]
  );
  return rows[0] || null;
}

async function insert(type, data) {
  const { rows } = await query(
    `insert into entities (entity_type, data) values ($1, $2::jsonb) returning id, data`,
    [type, JSON.stringify(data)]
  );
  return rows[0];
}

async function patch(id, data) {
  await query(
    `update entities set data = data || $2::jsonb, updated_at = now() where id = $1`,
    [id, JSON.stringify(data)]
  );
}

function addMinutes(naive, mins) {
  const d = new Date(naive + 'Z');
  d.setUTCMinutes(d.getUTCMinutes() + mins);
  return d.toISOString().slice(0, 16);
}

export async function syncFcf() {
  const stats = { teams_created: 0, teams_updated: 0, players_created: 0, players_existing: 0, matches_created: 0, matches_updated: 0, errors: [] };
  const club = await getJson(BASE);
  const season = currentSeason();

  for (const t of club.teams || []) {
    try {
      const code = String(t.codequipo);
      const detail = await getJson(`${BASE}/team/${code}`);
      const catName = clean(t.categoria_nombre);
      const letter = clean(t.letra_equipo);
      const slug = categorySlug(catName);
      const c = detail.campos || {};
      const days = [['L', 'ENTRENAR_LUNES'], ['M', 'ENTRENAR_MARTES'], ['X', 'ENTRENAR_MIERCOLES'], ['J', 'ENTRENAR_JUEVES'], ['V', 'ENTRENAR_VIERNES'], ['S', 'ENTRENAR_SABADO'], ['D', 'ENTRENAR_DOMINGO']]
        .filter(([, k]) => c[k] === '1').map(([d]) => d).join(' ');
      const fcfInfo = {
        fcf_team_code: code,
        fcf_category_name: catName,
        fcf_group_url: `https://www.fcf.cat/ca/clubs/${CLUB_CODE}/categories/${code}`,
        fcf_training: c.campo_entrenamiento ? `${days} ${c.ENTRENAR_HORARIO || ''} · ${titleCase(c.campo_entrenamiento)}`.trim() : '',
        fcf_home_field: titleCase(c.campo_juego || ''),
        fcf_match_time: c.JUGAR_HORARIO || '',
        fcf_synced_at: new Date().toISOString(),
      };

      let team = await findOne('Team', 'fcf_team_code', code);
      if (!team) {
        const name = `${titleCase(catName)}${letter ? ' ' + letter : ''}`;
        team = await insert('Team', { name, category: slug, season, ...fcfInfo });
        stats.teams_created++;
      } else {
        const extra = {};
        if (!team.data.category) extra.category = slug;
        if (!team.data.season) extra.season = season;
        await patch(team.id, { ...fcfInfo, ...extra });
        stats.teams_updated++;
      }
      const teamId = team.id;

      // Jugadores
      const { rows: existing } = await query(
        `select id, data from entities where entity_type = 'Player' and data ->> 'team_id' = $1`,
        [teamId]
      );
      const known = new Set(existing.map((p) => tokensKey(`${p.data.first_name || ''} ${p.data.last_name || ''}`)));
      for (const p of detail.players || []) {
        const key = tokensKey(p.NOMBRE);
        if (!key) continue;
        if (known.has(key)) { stats.players_existing++; continue; }
        const { first, last } = splitName(p.NOMBRE);
        await insert('Player', { first_name: first, last_name: last, team_id: teamId, status: 'activo', fcf_imported: true });
        known.add(key);
        stats.players_created++;
      }

      // Partidos
      for (const m of detail.matches || []) {
        if (!m.COMIENZO1) continue;
        const home = String(m.CODEQUIPO_CASA) === code;
        const opp = clean(home ? m.NOMBRE_FUERA : m.NOMBRE_CASA);
        const date = m.COMIENZO1.replace(' ', 'T').slice(0, 16);
        const hg = m.GOLES_CASA, ag = m.GOLES_FUERA;
        const played = hg !== null && hg !== undefined && ag !== null && ag !== undefined;
        const ours = played ? Number(home ? hg : ag) : undefined;
        const theirs = played ? Number(home ? ag : hg) : undefined;
        const j = Number(m.JORNADA);
        const data = {
          title: `${j > 0 ? 'J' + j + ' · ' : ''}${home ? 'vs ' : '@ '}${titleCase(opp)}`,
          type: 'partido_liga',
          team_id: teamId,
          date,
          end_date: addMinutes(date, 120),
          location: titleCase(m.CAMPO || ''),
          opponent: titleCase(opp),
          is_home: home,
          football_format: isF7(catName) ? 'f7' : 'f11',
          fcf_acta: String(m.CODACTA),
          fcf_jornada: j,
          fcf_competition: clean(m.NOMBRE_COMPETICION || ''),
          fcf_group: clean(m.GRUPO || ''),
        };
        if (played) { data.score_home = ours; data.score_away = theirs; }
        const ev = await findOne('Event', 'fcf_acta', m.CODACTA);
        if (!ev) { await insert('Event', data); stats.matches_created++; }
        else { await patch(ev.id, data); stats.matches_updated++; }
      }
    } catch (e) {
      stats.errors.push(`${t.codequipo}: ${e.message}`);
    }
  }
  return stats;
}
