import { query } from './db.js';
import { getCurrentUser } from './auth.js';
import { fcfJson, isFcfBlocked } from './fcfHttp.js';

const API = 'https://www.fcf.cat/api/competition';
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

// Desde noviembre de 2026 la FCF no deja leer al servidor: se usa lo que trae el navegador («Actualizar desde la FCF», fcfHttp.js).
// Lo traído en la última hora vale tal cual; si la FCF no contesta, vale lo traído en los últimos 7 días.
const FRESH = 60 * 60 * 1000;
const STALE = 7 * 24 * 60 * 60 * 1000;
async function fetchJson(path) {
  const j = await fcfJson(`${API}/${path}`, { fresh: FRESH, stale: STALE });
  return j && j.data !== undefined ? j.data : j;
}

// Las clasificaciones se guardan 5 minutos en memoria: el Panel pide la de cada equipo y no hace falta ir a la FCF cada vez.
// Los datos son públicos y solo se guardan las respuestas correctas; las peticiones iguales simultáneas comparten una sola consulta.
const TTL = 5 * 60 * 1000;
const cache = new Map();
export async function getJson(path) {
  if (!path.startsWith('classificacio?')) return fetchJson(path);
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now()) return hit.p;
  const p = fetchJson(path);
  cache.set(path, { p, exp: Date.now() + TTL });
  p.catch(() => { if (cache.get(path)?.p === p) cache.delete(path); });
  if (cache.size > 300) for (const [k, v] of cache) if (v.exp < Date.now()) cache.delete(k);
  return p;
}

const rowsOf = (g) => (Array.isArray(g) ? g : []);
const has = (table, code) => rowsOf(table).some((x) => String(x.team?.teamId) === String(code));

// Busca el grupo de la FCF en el que juega el equipo (solo la primera vez; luego se guarda en el equipo).
async function discoverGroup(team) {
  const code = String(team.fcf_team_code || '');
  const cat = norm(team.fcf_category_name);
  if (!code || !cat) return null;
  const temporadas = await getJson('temporadas');
  const temporada = temporadas?.[0]?.value;
  if (!temporada) return null;
  const disciplines = await getJson('disciplines');
  for (const d of disciplines.slice(0, 3)) { // Futbol 11, 7 y 5
    const comps = await getJson(`competicions?disciplinaId=${d.value}&temporada=${temporada}`);
    const matching = comps.filter((c) => { const l = norm(c.label); return l === cat || l.startsWith(cat + ' ') || cat.startsWith(l + ' '); });
    for (const c of matching) {
      const groups = await getJson(`grupos?competicioId=${c.value}`);
      for (const g of groups) {
        const table = await getJson(`classificacio?grupId=${g.value}`).catch(() => []);
        if (has(table, code)) return { grupId: String(g.value), competition: c.label, group: g.label, table };
      }
    }
  }
  return null;
}

// Encuentra (y guarda en el equipo la primera vez) el grupo de la FCF en el que juega y devuelve su clasificación.
export async function resolveGroup(teamId) {
  const { rows } = await query(`select id, data from entities where id = $1 and entity_type = 'Team'`, [teamId]);
  if (!rows[0]) return { notFound: true };
  const team = rows[0].data;
  let grupId = team.fcf_group_id, table = null, competition = team.fcf_competition_label || '', group = team.fcf_group_label || '';
  if (grupId) {
    table = await getJson(`classificacio?grupId=${grupId}`).catch(() => null);
    if (!has(table, team.fcf_team_code)) { grupId = null; table = null; }
  }
  if (!grupId) {
    const found = await discoverGroup(team);
    if (!found) return { team, available: false };
    ({ grupId, table, competition, group } = found);
    await query(`update entities set data = data || $1::jsonb, updated_at = now() where id = $2`,
      [JSON.stringify({ fcf_group_id: grupId, fcf_competition_label: competition, fcf_group_label: group }), teamId]);
  }
  return { team, available: true, grupId, table, competition, group };
}

export async function standingsHandler(req, res) {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'auth_required' });
  const teamId = String(req.query.team_id || '');
  if (!teamId) return res.status(400).json({ error: 'team_id' });
  try {
    const g = await resolveGroup(teamId);
    if (g.notFound) return res.status(404).json({ error: 'not_found' });
    if (!g.available) return res.status(200).json({ available: false });
    const { team, grupId, table, competition, group } = g;
    const out = rowsOf(table).map((r) => ({
      pos: Number(r.position), team: r.team?.name || '', logo: r.team?.logo || '', teamId: String(r.team?.teamId || ''),
      pts: Number(r.points), pj: r.played, g: r.won, e: r.drawn, p: r.lost, gf: Number(r.goalsFor), gc: Number(r.goalsAgainst),
      color: r.promotionColor || null,
      form: (r.form || []).map((f) => f.result).slice(0, 5),
    }));
    res.status(200).json({ available: true, competition, group, grupId, ourTeamId: String(team.fcf_team_code), rows: out });
  } catch (e) {
    if (isFcfBlocked(e)) return res.status(200).json({ available: false, blocked: true });
    console.error(e);
    res.status(500).json({ available: false, error: e.message });
  }
}

// Para «Actualizar desde la FCF» (relevo desde el navegador): pide la clasificación, los partidos y los goleadores del grupo de cada
// equipo, para que el Panel, Mi equipo y el informe del rival tengan datos aunque la FCF no deje leer al servidor.
// Dentro del relevo lo que falta se apunta solo (fcfHttp.js) y el navegador lo trae en la vuelta siguiente.
export async function prefetchStandings() {
  const { rows } = await query(`select id from entities where entity_type = 'Team' and coalesce(data ->> 'fcf_team_code', '') <> ''`);
  const out = { teams: rows.length, groups: 0, errors: [] };
  const seen = new Set();
  for (const r of rows) {
    try {
      const g = await resolveGroup(r.id);
      if (!g.available || seen.has(g.grupId)) continue;
      seen.add(g.grupId);
      await getJson(`partidos?grupId=${g.grupId}`);
      await getJson(`goleadores?grupId=${g.grupId}`).catch((e) => { if (e?.code === 'fcf_missing') throw e; });
      out.groups++;
    } catch (e) {
      if (e?.code !== 'fcf_missing') out.errors.push(`${r.id}: ${e.message}`);
    }
  }
  return out;
}
