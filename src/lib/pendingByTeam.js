// Agrupa por equipo lo que está sin registrar: entrenos sin asistencia y partidos sin gestionar.
// Sin dependencias de la app para poder probarlo solo.
import { msg } from "../i18n/translate.js";

// Motivos por los que un partido sale como pendiente, en orden de prioridad.
// "tab" es la pestaña del partido donde se arregla (sin tab = ficha del partido).
export const MATCH_REASONS = [
  { key: "soon", label: msg("Sin convocatoria (24 h)"), tab: "convocatoria" },
  { key: "played", label: msg("Jugado sin convocatoria"), tab: "convocatoria" },
  { key: "result", label: msg("Sin resultado"), tab: null },
  { key: "goals", label: msg("Goles sin clasificar"), tab: "acta" },
];

const byDate = (a, b) => new Date(a.date) - new Date(b.date);

// matches: { soon: [evento], played: [evento], result: [evento], goals: [evento] } (un partido puede estar en varios)
// Devuelve [{ teamId, name, trainings: [evento], matches: [{ event, reasons: [texto], tab }], total }]
// con los equipos de más pendientes primero (a igual número, el orden de "compare" o por nombre).
export function groupPendingByTeam({ trainings = [], matches = {}, teams = [], compare } = {}) {
  const teamOf = new Map(teams.map((t) => [t.id, t]));
  const groups = new Map();
  const group = (teamId) => {
    const key = teamId || "_sin_equipo";
    if (!groups.has(key)) groups.set(key, { teamId: teamId || null, name: teamOf.get(teamId)?.name || "Sin equipo", trainings: [], matchMap: new Map() });
    return groups.get(key);
  };

  for (const ev of trainings) group(ev.team_id).trainings.push(ev);

  for (const { key, label, tab } of MATCH_REASONS) {
    for (const ev of matches[key] || []) {
      const g = group(ev.team_id);
      const m = g.matchMap.get(ev.id) || { event: ev, reasons: [], tab: null };
      m.reasons.push(label);
      if (m.tab == null && tab) m.tab = tab; // la primera pestaña útil por prioridad
      g.matchMap.set(ev.id, m);
    }
  }

  const rows = [...groups.values()].map((g) => {
    const ms = [...g.matchMap.values()].sort((a, b) => byDate(a.event, b.event));
    return {
      teamId: g.teamId,
      name: g.name,
      trainings: [...g.trainings].sort(byDate),
      matches: ms,
      total: g.trainings.length + ms.length,
    };
  });

  const tie = compare ? (a, b) => compare(teamOf.get(a.teamId) || { name: a.name }, teamOf.get(b.teamId) || { name: b.name }) : (a, b) => a.name.localeCompare(b.name, "es", { numeric: true });
  return rows.sort((a, b) => b.total - a.total || tie(a, b));
}

// Totales para la cabecera del listado
export function totalsOf(rows) {
  return rows.reduce((acc, r) => ({ trainings: acc.trainings + r.trainings.length, matches: acc.matches + r.matches.length }), { trainings: 0, matches: 0 });
}
