// Periodos de la Evaluación 360 de entrenadores y estado de cada anotación de feedback.
// Un periodo lo abre implícitamente el primer día sin evaluar y lo cierra quien evalúa indicando a qué fechas corresponde
// (nombre opcional, «desde» y «hasta»). Sin importaciones de la app (salvo la marca de traducción): se usa también en los tests.
import { msg } from "../i18n/translate.js";
import { quarterRange, inRange } from "./coachQuarters.js";

// Estado de cada anotación de feedback, que fija quien evalúa (sin estado = pendiente)
export const FEEDBACK_PROGRESS = [
  { key: "pendiente", label: msg("Pendiente"), chip: "bg-gray-100 text-gray-500 border-gray-200" },
  { key: "seguir", label: msg("Seguir trabajando"), chip: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "asimilado", label: msg("Asimilado"), chip: "bg-green-100 text-green-700 border-green-200" },
];
export const DEFAULT_PROGRESS = "pendiente";
export const progressOf = (fb) => (FEEDBACK_PROGRESS.some((p) => p.key === fb?.progress) ? fb.progress : DEFAULT_PROGRESS);
export const progressInfo = (key) => FEEDBACK_PROGRESS.find((p) => p.key === key) || FEEDBACK_PROGRESS[0];

export function countByProgress(items = []) {
  const out = { pendiente: 0, seguir: 0, asimilado: 0 };
  for (const i of items) out[progressOf(i)] += 1;
  return out;
}

// Estado de un periodo cerrado: cerrado (solo coordinación) · publicado (el entrenador ve lo publicado)
export const CLOSE_STATUS = { closed: "cerrado", published: "publicado" };
export const isPublished = (close) => close?.status === CLOSE_STATUS.published;

const dayOf = (v) => String(v || "").slice(0, 10);
const nextDay = (d) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

// Fechas del periodo de un registro. Los registros anteriores (por trimestres fijos) llevan solo `quarter`.
export function rangeOfClose(close, season) {
  if (close?.from && close?.to) return { from: dayOf(close.from), to: dayOf(close.to) };
  if (close?.quarter) return quarterRange(season, close.quarter);
  return null;
}

// Periodos cerrados de la temporada, del más reciente al más antiguo
export function periodsOf(closes = [], season) {
  return closes
    .filter((c) => c.season === season && rangeOfClose(c, season))
    .map((c) => ({ ...c, range: rangeOfClose(c, season) }))
    .sort((a, b) => b.range.from.localeCompare(a.range.from) || b.range.to.localeCompare(a.range.to));
}

// El periodo abierto empieza el día siguiente al final del último periodo cerrado (o al empezar la temporada) y llega hasta el final de la temporada
export function openPeriodRange(closes = [], season) {
  const all = quarterRange(season, "all");
  const last = periodsOf(closes, season).reduce((max, p) => (p.range.to > max ? p.range.to : max), "");
  return { from: last && last >= all.from ? nextDay(last) : all.from, to: all.to };
}

// Valida las fechas con las que se cierra un periodo. Devuelve la clave del problema o null.
export function validatePeriod({ from, to, closes = [], season, today }) {
  if (!from || !to) return "missing";
  if (to < from) return "order";
  if (to > today) return "future";
  const all = quarterRange(season, "all");
  if (from < all.from) return "season";
  if (periodsOf(closes, season).some((p) => from <= p.range.to && to >= p.range.from)) return "overlap";
  return null;
}

// Observaciones del periodo que el entrenador aún no puede ver
export const unpublishedObs = (observations = [], range) => observations.filter((o) => o.status !== "publicada" && inRange(o.date, range));

// Lo que se ha dejado en «Seguir trabajando» antes del periodo (de la misma temporada) sigue a la vista en el siguiente
export function carriedFeedback(feedback = [], season, range) {
  if (!range) return [];
  const start = quarterRange(season, "all").from;
  return feedback.filter((f) => progressOf(f) === "seguir" && (f.date || "") >= start && (f.date || "") < range.from);
}

// El entrenador solo ve el estado de una anotación cuando se ha publicado el periodo al que pertenece
export function progressVisibleToCoach(fb, closes = [], season) {
  return periodsOf(closes, season).some((p) => isPublished(p) && inRange(fb?.date, p.range));
}
