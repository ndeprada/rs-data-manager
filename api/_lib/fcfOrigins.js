// Equipo de procedencia de los jugadores del club a partir de las actas de la FCF ya cargadas (13/11/2026, Nacho:
// «todos los que aparezcan en temporadas anteriores en la federación, quiero que lo pongas en procedencia»).
//
// 1) Se busca a cada jugador del club en `fcf_players` por su nombre (las fichas que crea la sincronización llevan el nombre
//    tal cual sale en la FCF, «APELLIDOS, NOMBRE»; las escritas a mano pueden llevar un solo apellido).
// 2) Si hay varios con ese nombre, se queda el que ha jugado con un equipo del club y, si aún hay dudas, el de su año de
//    nacimiento y su dorsal. Si sigue habiendo más de uno, no se adivina («dudoso»).
// 3) Procedencia = el equipo con más actas en la temporada anterior; si esa temporada no jugó, la última temporada anterior
//    en la que aparece (se guarda la temporada).
// Solo se escribe en las fichas sin procedencia o con una procedencia puesta antes por este mismo proceso: lo escrito a mano
// no se toca. Los que no aparecen en ninguna temporada anterior seguramente vienen de liga escolar u otro ámbito.

import { normName, birthYears } from './fcfDb.js';

const SEASON_RE = /^\d{4}-\d{4}$/;
const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
export const currentSeason = (now = new Date()) => {
  const y = now.getFullYear();
  return now.getMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};
export const prevSeasonOf = (s) => { const a = Number(String(s).slice(0, 4)); return `${a - 1}-${a}`; };

// Claves de búsqueda de una ficha del club: el nombre completo en orden FCF y, para las fichas escritas a mano,
// el patrón «apellidos…, nombre…» (por si solo lleva un apellido o un nombre compuesto distinto)
export function appKeys(p) {
  const first = normName(p.first_name);
  const last = normName(p.last_name);
  if (!first || !last) return null;
  return { exact: `${last}, ${first}`, like: `${last.replace(/[%_]/g, '')}%, ${first.split(' ')[0].replace(/[%_]/g, '')}%` };
}
const tokens = (s) => normName(String(s).replace(',', ' ')).split(' ').filter(Boolean).sort().join(' ');
// ¿El nombre de la FCF puede ser esta ficha? (mismo nombre o la ficha con menos palabras, todas dentro y en su sitio)
export function nameFits(p, fcfName) {
  const k = appKeys(p);
  if (!k) return false;
  const n = normName(fcfName);
  if (n === k.exact || tokens(n) === tokens(`${p.first_name} ${p.last_name}`)) return true;
  const [sur = '', fst = ''] = n.split(',').map((x) => x.trim());
  const last = normName(p.last_name), first = normName(p.first_name);
  const f1 = first.split(' ')[0];
  return (sur === last || sur.startsWith(`${last} `)) && (fst === first || fst === f1 || fst.startsWith(`${f1} `));
}

// Elige entre los candidatos de la FCF: primero los que han jugado con el club, luego el año de nacimiento y el dorsal
export function pickCandidate(p, cands) {
  const by0 = Number(p.birth_year) || (p.birth_date ? Number(String(p.birth_date).slice(0, 4)) : 0);
  // Un único candidato que nunca ha jugado con el club solo vale si el nombre es el mismo y no choca con el año de nacimiento
  if (cands.length === 1 && !cands[0].club) {
    const c = cands[0];
    if (!c.exact || (by0 && c.birth_year && c.birth_year !== by0)) return { pick: null, reason: 'dudoso', options: 1 };
    return { pick: c, reason: 'nombre' };
  }
  if (cands.length <= 1) return { pick: cands[0] || null, reason: cands.length ? 'club' : 'sin_fcf' };
  let list = cands;
  const club = list.filter((c) => c.club);
  if (club.length) list = club;
  if (list.length === 1) return { pick: list[0], reason: 'club' };
  const by = Number(p.birth_year) || (p.birth_date ? Number(String(p.birth_date).slice(0, 4)) : 0);
  if (by) {
    const same = list.filter((c) => c.birth_year === by);
    if (same.length) list = same;
    if (list.length === 1) return { pick: list[0], reason: 'año' };
  }
  const dor = String(p.jersey_number ?? '').trim();
  if (dor) {
    const same = list.filter((c) => (c.dorsals || []).includes(dor));
    if (same.length === 1) return { pick: same[0], reason: 'dorsal' };
  }
  return { pick: null, reason: 'dudoso', options: list.length };
}

// Último equipo de cada jugador en temporadas ANTERIORES a `season` (la más reciente; dentro de ella, el de más actas)
export async function lastTeamsBefore(db, season, ids) {
  const list = [...new Set((ids || []).map(String))];
  if (!SEASON_RE.test(season || '') || !list.length) return new Map();
  const { rows } = await db.query(
    `select p.player_id, c.season, p.team, c.competition, count(*)::int as pj
     from fcf_apps p join fcf_actas c on c.acta = p.acta
     where c.season < $1 and p.player_id = any($2::text[])
     group by p.player_id, c.season, p.team, c.competition
     order by p.player_id, c.season desc, pj desc, p.team`, [season, list]
  );
  const out = new Map();
  for (const r of rows) {
    const cur = out.get(r.player_id);
    if (!cur) out.set(r.player_id, { season: r.season, team: r.team, competition: r.competition, pj: r.pj, more: 0 });
    else if (cur.season === r.season && r.team !== cur.team) cur.more += 1;
  }
  return out;
}

// Calcula la propuesta para todas las fichas del club. `players` = [{id, data}] de la tabla de entidades.
export async function originProposals(db, players, { season = currentSeason(), clubName = 'RACING SARRI' } = {}) {
  const club = strip(clubName).trim();
  const isClub = (team) => !!club && strip(team).includes(club);
  const live = players
    .map((r) => ({ id: r.id, ...(r.data || {}) }))
    .filter((p) => !p.archived_season && p.status !== 'baja' && appKeys(p));

  // Candidatos por nombre: exacto y, para los que no salen así, por patrón
  const exact = [...new Set(live.map((p) => appKeys(p).exact))];
  const { rows: found } = await db.query(`select id, name, name_norm from fcf_players where name_norm = any($1::text[])`, [exact]);
  const hit = new Set(found.map((f) => f.name_norm));
  const likes = [...new Set(live.filter((p) => !hit.has(appKeys(p).exact)).map((p) => appKeys(p).like))];
  if (likes.length) {
    const { rows } = await db.query(`select id, name, name_norm from fcf_players where name_norm like any($1::text[])`, [likes]);
    for (const r of rows) if (!found.some((f) => f.id === r.id)) found.push(r);
  }
  const ids = found.map((f) => f.id);
  const by = await birthYears(db, ids);
  const { rows: teamRows } = ids.length ? await db.query(
    `select p.player_id, array_agg(distinct p.team) as teams, array_agg(distinct p.dorsal) as dorsals
     from fcf_apps p where p.player_id = any($1::text[]) group by p.player_id`, [ids]
  ) : { rows: [] };
  const info = new Map(teamRows.map((r) => [r.player_id, r]));
  const cands = found.map((f) => {
    const t = info.get(f.id) || {};
    return { fcf_id: f.id, name: f.name, birth_year: by.get(f.id) ?? null, club: (t.teams || []).some(isClub), dorsals: (t.dorsals || []).filter(Boolean) };
  });

  const matched = [];
  const out = [];
  for (const p of live) {
    const ex = appKeys(p).exact;
    const list = cands.filter((c) => nameFits(p, c.name)).map((c) => ({ ...c, exact: normName(c.name) === ex }));
    const { pick, reason, options } = pickCandidate(p, list);
    out.push({ player: p, pick, reason, options });
    if (pick) matched.push(pick.fcf_id);
  }
  const prev = await lastTeamsBefore(db, season, matched);
  const prevSeason = prevSeasonOf(season);

  return out.map(({ player: p, pick, reason, options }) => {
    const manual = String(p.previous_club || '').trim() && p.previous_club_source !== 'fcf';
    const from = pick ? prev.get(pick.fcf_id) : null;
    let status;
    if (manual) status = 'manual';
    else if (!pick) status = reason === 'dudoso' ? 'dudoso' : 'sin_fcf';
    else if (!from) status = 'sin_anterior';
    else status = 'ok';
    return {
      id: p.id, team_id: p.team_id || null, name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      status, reason, options: options || 0, fcf_id: pick?.fcf_id || null, fcf_name: pick?.name || null, in_club: !!pick?.club, by_fcf: pick?.birth_year ?? null,
      current: p.previous_club || '',
      origin: from ? { team: from.team, competition: from.competition, season: from.season, pj: from.pj, more: from.more, club: isClub(from.team), last_season: from.season === prevSeason } : null,
    };
  });
}

// Cambio a guardar en la ficha para una propuesta «ok» (y el ID de la FCF para todas las encontradas)
export function originPatch(row) {
  if (row.status === 'manual' || !row.fcf_id) return null;
  const patch = { fcf_player_id: row.fcf_id };
  if (row.status === 'ok') {
    Object.assign(patch, {
      previous_club: row.origin.team, previous_club_source: 'fcf',
      previous_club_season: row.origin.season, previous_club_comp: row.origin.competition,
    });
  }
  return patch;
}
