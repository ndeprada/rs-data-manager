// Evaluación 360 de un entrenador «por equipo / etapa»: qué ve cada selector y cómo se reparte lo que ya está guardado.
// Una observación o una anotación de feedback puede llevar `team_id`. Si el entrenador lleva más de un equipo, la 360 se puede ver
// en conjunto («Todos»), por cada equipo (cada etapa tiene su media, su resumen y su feedback) o lo que no lleva equipo («Sin equipo»).
// Sin importaciones de la app (salvo el recuento de observaciones): se usa también en los tests.
import { aggregateArea } from "./coachAreaCriteria.js";

export const ALL_TEAMS = "__all";
export const NO_TEAM = "__none";

// ¿Esta observación / anotación entra en la vista elegida?
export function matchesTeamView(item, view) {
  if (!view || view === ALL_TEAMS) return true;
  if (view === NO_TEAM) return !item?.team_id;
  return item?.team_id === view;
}

// Equipos que se ofrecen: los que lleva (en su orden) y, por si ya no los lleva, los que aparecen en lo guardado.
// `known` (opcional) = ids de equipos que existen, para no ofrecer uno borrado. `untagged` = cuántas anotaciones no llevan equipo.
export function teamViewOptions({ teamIds = [], items = [], known = null }) {
  const ids = [];
  for (const id of [...teamIds, ...items.map((i) => i?.team_id)]) {
    if (id && !ids.includes(id) && (!known || known.includes(id))) ids.push(id);
  }
  return { teamList: ids, untagged: items.filter((i) => !i?.team_id).length };
}

// La vista solo se divide por equipos cuando el entrenador lleva más de uno
export const isMultiTeam = (teamIds = []) => new Set(teamIds.filter(Boolean)).size > 1;

// La vista elegida si sigue valiendo; si no (el equipo ya no está, o no hay nada «sin equipo»), la vista de conjunto
export function resolveTeamView(pick, { multi, teamList = [], untagged = 0 }) {
  if (!multi || !pick || pick === ALL_TEAMS) return ALL_TEAMS;
  if (pick === NO_TEAM) return untagged > 0 ? NO_TEAM : ALL_TEAMS;
  return teamList.includes(pick) ? pick : ALL_TEAMS;
}

// Equipo con el que se abre una evaluación nueva: el de la vista si es un equipo concreto; si no, ninguno (hay que elegirlo)
export const defaultTeamFor = (view, teamIds = []) => (view && view !== ALL_TEAMS && view !== NO_TEAM && teamIds.includes(view) ? view : "");

// Media de un área en cada equipo (solo los equipos con observaciones): para ver las etapas lado a lado en la vista de conjunto
export function teamAverages(observations = [], area, teamList = []) {
  return teamList
    .map((id) => {
      const mine = observations.filter((o) => o.team_id === id);
      return { id, count: mine.length, avg: mine.length ? aggregateArea(mine, area).overall : null };
    })
    .filter((x) => x.count > 0);
}
