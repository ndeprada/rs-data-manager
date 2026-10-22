// Trimestres de la Evaluación 360 de entrenadores: 3 por temporada.
// La temporada empieza en agosto (como en staffRoles.seasonFor): el primero llega hasta diciembre, el segundo es enero–marzo
// y el tercero abril–junio (se extiende hasta el final de la temporada, 31 de julio).
import { msg } from "../i18n/translate.js";

export const QUARTERS = [
  { id: "q1", label: msg("Hasta diciembre") },
  { id: "q2", label: msg("Enero–marzo") },
  { id: "q3", label: msg("Abril–junio") },
];
export const WHOLE_SEASON = { id: "all", label: msg("Toda la temporada") };

const dayOf = (v) => String(v || "").slice(0, 10);
const startYear = (season) => Number(String(season).slice(0, 4));

// Fechas «yyyy-MM-dd» (ambas incluidas) del trimestre de una temporada («2026-2027»); «all» = la temporada entera
export function quarterRange(season, id) {
  const y = startYear(season);
  if (id === "q1") return { from: `${y}-08-01`, to: `${y}-12-31` };
  if (id === "q2") return { from: `${y + 1}-01-01`, to: `${y + 1}-03-31` };
  if (id === "q3") return { from: `${y + 1}-04-01`, to: `${y + 1}-07-31` };
  return { from: `${y}-08-01`, to: `${y + 1}-07-31` };
}

// Trimestre al que pertenece una fecha
export function quarterOf(date) {
  const month = Number(dayOf(date).slice(5, 7));
  if (month >= 8) return "q1";
  if (month >= 4) return "q3";
  return "q2";
}

export const inRange = (date, range) => {
  const d = dayOf(date);
  return !!d && d >= range.from && d <= range.to;
};
