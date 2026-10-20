// A quién puede escribir cada persona en los avisos, y buscador de destinatarios individuales.
// Funciones puras (se prueban con tests): reciben las listas ya cargadas de la base de datos ({ id, data }).

export const COORD = ['director', 'director_deportivo', 'coordinador_general', 'coordinador_f7', 'coordinador_f11'];
export const STAFF = [...COORD, 'entrenador', 'entrenador_porteros', 'preparador_fisico', 'psicologo', 'fisioterapeuta'];

export const isApprovedUser = (d) => d.role === 'admin' || d.access_status === 'approved' || (!d.access_status && !!d.app_role);
export const teamIdsOfUser = (d) => [...(d.team_ids || []), ...(d.team_id ? [d.team_id] : []), ...(d.secondary_team_ids || [])];

// Máximo de personas sueltas en un mismo aviso
export const MAX_INDIVIDUALS = 30;

const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const playerName = (p) => `${p.data.first_name || ''} ${p.data.last_name || ''}`.trim();

/**
 * Usuarios aprobados a los que `sender` puede escribir de forma individual.
 *  - Coordinación y administración: cualquier usuario aprobado.
 *  - Entrenador: solo gente de sus equipos (jugadores con cuenta, familiares vinculados y cuerpo técnico del equipo),
 *    el mismo alcance que ya tiene al avisar por equipos.
 * `sender` = { coord: boolean, teams: string[] (equipos que entrena), id }
 */
export function reachableUserIds(sender, { users, players, links }) {
  const approved = users.filter((u) => isApprovedUser(u.data) && u.id !== sender.id);
  if (sender.coord) return new Set(approved.map((u) => u.id));

  const mine = new Set(sender.teams || []);
  if (mine.size === 0) return new Set();
  const teamPlayers = new Set(players.filter((p) => mine.has(p.data.team_id)).map((p) => p.id));
  const approvedIds = new Set(approved.map((u) => u.id));
  const out = new Set();
  for (const u of approved) {
    const d = u.data;
    // Jugador con cuenta (o cuerpo técnico que además es jugador)
    if ((d.app_role === 'jugador' || STAFF.includes(d.app_role)) && d.player_id && teamPlayers.has(d.player_id)) out.add(u.id);
    // Cuerpo técnico que comparte equipo
    if ((STAFF.includes(d.app_role) || d.role === 'admin') && teamIdsOfUser(d).some((t) => mine.has(t))) out.add(u.id);
  }
  for (const l of links) {
    if (l.data.status === 'approved' && teamPlayers.has(l.data.player_id) && approvedIds.has(l.data.user_id)) out.add(l.data.user_id);
  }
  return out;
}

/**
 * Busca personas (con cuenta en la app) entre las que `reach` permite. Encuentra por su nombre, por el nombre del
 * jugador al que están vinculadas (un familiar se encuentra buscando a su hijo) o por el de sus equipos.
 * Devuelve datos mínimos: nada de correos ni teléfonos.
 * teams: Map teamId -> nombre · pushUsers: Set de usuarios con avisos activados en algún móvil.
 */
export function searchPeople(q, { users, players, links, teams, reach, pushUsers = new Set() }, limit = 12) {
  const needle = norm(q);
  if (needle.length < 2) return [];
  const playerBy = new Map(players.map((p) => [p.id, p]));
  const childrenOf = new Map();
  for (const l of links) {
    if (l.data.status !== 'approved') continue;
    if (!childrenOf.has(l.data.user_id)) childrenOf.set(l.data.user_id, []);
    const p = playerBy.get(l.data.player_id);
    if (p) childrenOf.get(l.data.user_id).push(p);
  }
  const teamName = (id) => teams.get(id) || '';

  const out = [];
  for (const u of users) {
    if (!reach.has(u.id)) continue;
    const d = u.data;
    const own = d.player_id ? playerBy.get(d.player_id) : null;           // jugador (o técnico que también juega)
    const kids = childrenOf.get(u.id) || [];                              // hijos vinculados (familiares)
    const staffTeams = STAFF.includes(d.app_role) || d.role === 'admin' ? [...new Set(teamIdsOfUser(d))].map(teamName).filter(Boolean) : [];
    const name = (d.full_name || '').trim() || (own ? playerName(own) : '') || String(d.email || '').split('@')[0] || 'Sin nombre';

    // Los nombres de personas coinciden en cualquier parte; los de equipo solo por el inicio de una palabra
    // (si no, «nil» encontraría a todo el «Juvenil»).
    const names = norm([name, own ? playerName(own) : '', ...kids.map(playerName)].join(' '));
    const teamText = ' ' + norm([...staffTeams, ...[own, ...kids].filter(Boolean).map((p) => teamName(p.data.team_id))].join(' · '));
    if (!names.includes(needle) && !teamText.includes(' ' + needle)) continue;

    out.push({
      id: u.id,
      name,
      role: d.role === 'admin' && !d.app_role ? 'admin' : d.app_role || 'usuario',
      teams: staffTeams,
      players: [...(own ? [own] : []), ...kids].map((p) => ({ name: playerName(p), team: teamName(p.data.team_id) })),
      has_push: pushUsers.has(u.id),
    });
  }
  // Primero los que empiezan por lo escrito, luego por orden alfabético
  out.sort((a, b) => (norm(b.name).startsWith(needle) - norm(a.name).startsWith(needle)) || a.name.localeCompare(b.name, 'es'));
  return out.slice(0, limit);
}
