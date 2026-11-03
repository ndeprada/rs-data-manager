// Asistencia de la hoja de sesión (02/11/2026): disponible / al margen / no con motivo, y área del PDI de cada jugador.
// Sin importaciones de la app: se prueba en Node.

export const ATT_REASONS = ["lesión", "enfermo", "estudios", "viaje", "sanción", "cargas", "otro"];

// Lo que se ve de un jugador: lo que se ha marcado o, si no hay nada, «No · lesión» cuando su ficha dice que está lesionado
export function attendanceOf(player, a = {}) {
  if (a?.st) return { st: a.st, obs: a.obs || "", auto: false };
  if (player?.status === "lesionado") return { st: "no", obs: a?.obs || "lesión", auto: true };
  return { st: "", obs: a?.obs || "", auto: false };
}

// Área del PDI que se trabaja con el jugador: su objetivo «trabajando» más reciente (o, si no hay, el primero «a mejorar»)
export function pdiAreaOf(playerId, goals = []) {
  const mine = goals.filter((g) => g.player_id === playerId && g.status !== "mejorado");
  const pick = mine.find((g) => g.status === "trabajando") || mine[0];
  return pick ? String(pick.competency_text || pick.objective || "").trim() : "";
}

// Texto del área para la ficha: lo escrito en la sesión o, si no hay nada, el del PDI
export const areaFor = (player, a, goals) => (a?.areas && String(a.areas).trim()) || pdiAreaOf(player.id, goals);

// Disponibilidad abreviada en la hoja impresa (03/11/2026, Nacho: «lesión una L, enfermo una E… para que no ocupe tanto
// ancho»). Sin motivo: «Sí» / «No» / «AM» (al margen); con motivo, su letra («AM·C» = al margen por cargas).
export const REASON_CODE = { "lesión": "L", enfermo: "E", estudios: "Es", viaje: "V", "sanción": "S", cargas: "C", otro: "O" };
export function attCode(a) {
  if (!a?.st) return "";
  if (a.st === "si") return "Sí";
  const r = REASON_CODE[String(a.obs || "").trim().toLowerCase()] || "";
  if (a.st === "ad") return r ? `AM·${r}` : "AM";
  return r || "No";
}
