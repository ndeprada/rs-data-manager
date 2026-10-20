// Eventos cancelados o suspendidos (lluvia, festivo…): el evento sigue en el calendario, marcado como que
// tocaba pero no se celebró. No cuenta como pendiente (ni de pasar lista, ni de convocatoria o resultado).
// Se guarda en el propio evento: cancelled (true/false) y cancel_reason.
export const CANCEL_REASONS = [
  { value: "lluvia", label: "Lluvia" },
  { value: "festivo", label: "Festivo" },
  { value: "campo", label: "Campo no disponible" },
  { value: "otro", label: "Otro motivo" },
];

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];

export const isCancelled = (ev) => ev?.cancelled === true;

export const cancelReasonLabel = (ev) => CANCEL_REASONS.find((r) => r.value === ev?.cancel_reason)?.label || "";

// "Suspendido" para partidos y "Cancelado" para el resto
export const cancelWord = (ev) => (MATCH_TYPES.includes(ev?.type) ? "Suspendido" : "Cancelado");

// "Cancelado · Lluvia" (o solo "Cancelado" si no hay motivo)
export function cancelText(ev) {
  if (!isCancelled(ev)) return "";
  const reason = cancelReasonLabel(ev);
  return reason ? `${cancelWord(ev)} · ${reason}` : cancelWord(ev);
}

export const cancelPatch = (reason) => ({ cancelled: true, cancel_reason: reason || "otro" });
export const restorePatch = () => ({ cancelled: false, cancel_reason: null });
