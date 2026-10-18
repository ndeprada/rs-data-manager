import { query } from './db.js';
import { getCurrentUser } from './auth.js';

const API = 'https://www.fcf.cat/api/competition';
const UA = 'Mozilla/5.0 (compatible; RSDataManager/1.0)';
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

export async function getJson(path) {
  const r = await fetch(`${API}/${path}`, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!r.ok) throw new Error(`FCF ${r.status} ${path}`);
  const j = await r.json();
  return j.data !== undefined ? j.data : j;
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
    console.error(e);
    res.status(500).json({ available: false, error: e.message });
  }
}
