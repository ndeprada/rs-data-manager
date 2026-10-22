// Áreas de evaluación de entrenadores. Cada anotación de feedback pertenece a una de ellas y la Evaluación 360 se organiza igual.
// Sin importaciones de la app (salvo la marca de traducción): se usa también en los tests.
import { msg } from "../i18n/translate.js";

export const COACH_AREAS = [
  { key: "habitos", label: msg("Hábitos"), hint: msg("Puntualidad, vestuario, material y normas del club"), color: "#B33A00" },
  { key: "gestion", label: msg("Gestión"), hint: msg("Datos en la app y comunicación con las familias"), color: "#475569" },
  { key: "metodologia", label: msg("Metodología"), hint: msg("Entrenamientos y sesiones"), color: "#73000A" },
  { key: "partidos", label: msg("Partidos"), hint: msg("Preparación y dirección del partido"), color: "#FF6E00" },
  { key: "humana", label: msg("Gestión humana"), hint: msg("Comunicación y trato con jugadores y cuerpo técnico"), color: "#0f766e" },
];

// Todo el feedback anterior (por partido) cuenta como «Partidos»
export const DEFAULT_AREA = "partidos";

export const areaInfo = (key) => COACH_AREAS.find((a) => a.key === key) || COACH_AREAS.find((a) => a.key === DEFAULT_AREA);
export const feedbackArea = (fb) => (COACH_AREAS.some((a) => a.key === fb?.area) ? fb.area : DEFAULT_AREA);

// Marca de cada anotación: algo a mejorar (lo habitual) o algo bien hecho
export const FEEDBACK_TONES = [
  { key: "mejorar", label: msg("A mejorar") },
  { key: "positivo", label: msg("Positivo") },
];

// «enviado» = compartido con el entrenador; «borrador» = interno (solo coordinación). Se conservan esos nombres por los datos ya guardados.
export const isShared = (fb) => fb?.status === "enviado";

// Feedback antiguo por partido, con sus apartados (lectura, sistema, jugadores…) en lugar de un texto
export const LEGACY_SECTION_KEYS = ["lectura", "sistema", "jugadores", "direccion", "positivo", "otros"];
export const hasLegacySections = (fb) => !(fb?.text || "").trim() && LEGACY_SECTION_KEYS.some((k) => (fb?.[k] || "").trim());

// Número de anotaciones por área (y total)
export function countByArea(items = []) {
  const out = { all: items.length };
  for (const a of COACH_AREAS) out[a.key] = 0;
  for (const i of items) out[feedbackArea(i)] += 1;
  return out;
}
