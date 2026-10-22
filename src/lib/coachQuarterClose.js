// Cierre trimestral de la Evaluación 360 y estado de cada anotación de feedback.
// Sin importaciones de la app (salvo la marca de traducción): se usa también en los tests.
import { msg } from "../i18n/translate.js";
import { quarterRange, quarterOf, inRange } from "./coachQuarters.js";

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

// Estado del trimestre: abierto (sin registro) · cerrado (solo para coordinación) · publicado (el entrenador ve lo publicado)
export const CLOSE_STATUS = { closed: "cerrado", published: "publicado" };
export const closeOf = (closes = [], season, quarter) => closes.find((c) => c.season === season && c.quarter === quarter) || null;
export const quarterState = (close) => (close?.status === CLOSE_STATUS.published ? "publicado" : close?.status === CLOSE_STATUS.closed ? "cerrado" : "abierto");

// Observaciones del trimestre que el entrenador aún no puede ver
export const unpublishedObs = (observations = [], range) => observations.filter((o) => o.status !== "publicada" && inRange(o.date, range));

// Lo que se ha dejado en «Seguir trabajando» antes del trimestre (de la misma temporada) sigue a la vista en el siguiente
export function carriedFeedback(feedback = [], season, quarter) {
  if (quarter === "all") return [];
  const range = quarterRange(season, quarter);
  const start = quarterRange(season, "all").from;
  return feedback.filter((f) => progressOf(f) === "seguir" && (f.date || "") >= start && (f.date || "") < range.from);
}

// El entrenador solo ve el estado de una anotación cuando se ha publicado el trimestre al que pertenece
export function progressVisibleToCoach(fb, closes = [], season) {
  const c = closeOf(closes, season, quarterOf(fb?.date));
  return quarterState(c) === "publicado";
}
