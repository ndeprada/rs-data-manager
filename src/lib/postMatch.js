// Postpartido (rediseño del 13/11/2026, maqueta «Maqueta Postpartido · RS Manager» aprobada por Nacho: «ok pasa a postpartido»).
// Cálculos puros, sin importaciones de la app salvo sameTeamName (también puro): se prueban en Node.
import { sameTeamName } from "./myTeamStats.js";

// Observaciones del partido en tres apartados (Event.post_notes)
export const POST_SECTIONS = ["good", "improve", "training"];
const ms = (d) => new Date(d).getTime();

/** Observaciones limpias: tres listas de textos sin vacíos ni espacios sobrantes */
export function cleanPostNotes(n) {
  const out = {};
  for (const k of POST_SECTIONS) out[k] = (Array.isArray(n?.[k]) ? n[k] : []).map((x) => String(x || "").trim()).filter(Boolean);
  return out;
}
export const hasPostNotes = (n) => POST_SECTIONS.some((k) => (n?.[k] || []).length);

/** Media de valoración (1–3) de cada jugador en la temporada, sin contar este partido: Map playerId → {avg, n} */
export function ratingAverages(stats = [], excludeEventId) {
  const acc = new Map();
  for (const s of stats) {
    if (!s?.player_id || s.event_id === excludeEventId) continue;
    const r = Number(s.rating);
    if (!(r >= 1 && r <= 3)) continue;
    const a = acc.get(s.player_id) || { sum: 0, n: 0 };
    a.sum += r; a.n++; acc.set(s.player_id, a);
  }
  return new Map([...acc].map(([k, v]) => [k, { avg: Math.round((v.sum / v.n) * 10) / 10, n: v.n }]));
}

/** Hoy frente a su media: "up" (≥ 0,4 por encima), "down" (≥ 0,4 por debajo), "eq" o null si falta algo */
export function ratingTrend(value, avg) {
  if (!value || avg == null) return null;
  const d = value - avg;
  return d >= 0.4 ? "up" : d <= -0.4 ? "down" : "eq";
}

/** Valoración del equipo en los últimos n partidos anteriores a este (del más antiguo al más reciente): {criterio: [1..3]} */
export function evalHistory(events = [], ev, keys = [], n = 5) {
  if (!ev) return {};
  const prev = events
    .filter((e) => e.team_id === ev.team_id && e.id !== ev.id && e.team_eval && ms(e.date) < ms(ev.date))
    .sort((a, b) => ms(a.date) - ms(b.date))
    .slice(-n);
  const out = {};
  for (const k of keys) out[k] = prev.map((e) => Number(e.team_eval?.[k]) || 0);
  return out;
}

const isMatch = (e) => String(e?.type || "").includes("partido");

/** Notas sobre el rival de los partidos anteriores del mismo equipo contra el mismo rival (el más reciente primero) */
export function rivalNotesBefore(events = [], ev) {
  if (!ev?.opponent) return [];
  return events
    .filter((e) => e.id !== ev.id && e.team_id === ev.team_id && isMatch(e) && ms(e.date) < ms(ev.date)
      && sameTeamName(e.opponent, ev.opponent) && String(e.analysis_notes_rival || "").trim())
    .sort((a, b) => ms(b.date) - ms(a.date));
}

/** Próximo partido del mismo equipo contra el mismo rival (sin suspendidos) */
export function nextVsRival(events = [], ev) {
  if (!ev?.opponent) return null;
  return events
    .filter((e) => e.id !== ev.id && e.team_id === ev.team_id && isMatch(e) && e.cancelled !== true && ms(e.date) > ms(ev.date) && sameTeamName(e.opponent, ev.opponent))
    .sort((a, b) => ms(a.date) - ms(b.date))[0] || null;
}

/** «Para el próximo entreno» del último partido del equipo antes de esa fecha (con algo escrito): {event, items} o null */
export function trainingNotesFor(events = [], teamId, date) {
  if (!teamId || !date) return null;
  const t = ms(date);
  const e = events
    .filter((x) => x.team_id === teamId && isMatch(x) && ms(x.date) <= t && (x.post_notes?.training || []).some((s) => String(s).trim()))
    .sort((a, b) => ms(b.date) - ms(a.date))[0];
  return e ? { event: e, items: cleanPostNotes(e.post_notes).training } : null;
}
