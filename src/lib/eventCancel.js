// Eventos cancelados o suspendidos (lluvia, festivo…): el evento sigue en el calendario, marcado como que
// tocaba pero no se celebró. No cuenta como pendiente (ni de pasar lista, ni de convocatoria o resultado).
// Se guarda en el propio evento: cancelled (true/false) y cancel_reason.
import { msg } from "../i18n/translate.js";

export const CANCEL_REASONS = [
  { value: "lluvia", label: msg("Lluvia") },
  { value: "festivo", label: msg("Festivo") },
  { value: "campo", label: msg("Campo no disponible") },
  { value: "otro", label: msg("Otro motivo") },
];

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];

export const isCancelled = (ev) => ev?.cancelled === true;

export const cancelReasonLabel = (ev) => CANCEL_REASONS.find((r) => r.value === ev?.cancel_reason)?.label || "";

// "Suspendido" para partidos y "Cancelado" para el resto
export const cancelWord = (ev) => (MATCH_TYPES.includes(ev?.type) ? msg("Suspendido") : msg("Cancelado"));

// "Cancelado · Lluvia" (o solo "Cancelado" si no hay motivo)
export function cancelText(ev, t = (s) => s) {
  if (!isCancelled(ev)) return "";
  const reason = cancelReasonLabel(ev);
  return reason ? `${t(cancelWord(ev))} · ${t(reason)}` : t(cancelWord(ev));
}

export const cancelPatch = (reason) => ({ cancelled: true, cancel_reason: reason || "otro" });
export const restorePatch = () => ({ cancelled: false, cancel_reason: null });

// ── Cancelar varios días de golpe (festivo, lluvia…) ──────────────────────────────────────────────
export const TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico", "sesion_teorica", "sesion_video"];
export const isMatchType = (type) => MATCH_TYPES.includes(type);

const dayOf = (ev) => String(ev?.date || "").slice(0, 10); // las fechas son texto local yyyy-MM-ddTHH:mm

/**
 * Eventos que se cancelarían en bloque: entrenamientos (y, si se pide, partidos) entre dos días (inclusive),
 * de los equipos indicados (null = todo el club). Se saltan los ya cancelados y los eventos de club (fiestas…).
 */
export function bulkTargets(events, { from, to, teamIds = null, includeMatches = false } = {}) {
  if (!from || !to || from > to) return [];
  const teams = Array.isArray(teamIds) ? new Set(teamIds) : null;
  return (events || [])
    .filter((e) => {
      const d = dayOf(e);
      if (!d || d < from || d > to || isCancelled(e)) return false;
      if (teams && !teams.has(e.team_id)) return false;
      return TRAINING_TYPES.includes(e.type) || (includeMatches && isMatchType(e.type));
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
