// Duración del partido y minutos jugados según el acta. Funciones puras (se prueban con tests).

// Si el partido no tiene la duración guardada se usa la habitual de su formato (la misma que propone el acta al elegirlo)
export const defaultDuration = (format) => (format === "f7" ? "4x15" : "2x45");

// "2x45" -> 90, "4x15" -> 60
export function totalMinutes(duration) {
  const m = String(duration || "").match(/^(\d+)x(\d+)$/);
  return m ? Number(m[1]) * Number(m[2]) : 90;
}

export const eventMinutes = (ev) => totalMinutes(ev?.match_duration || defaultDuration(ev?.football_format));

// Minutos de un jugador del equipo según los eventos del acta:
// titular = desde el 0 hasta que sale (cambio, roja o 2ª amarilla) o hasta el final; suplente = desde que entra hasta que sale o el final.
export function calcMinutesPlayed(playerId, starterIds, events, matchMinutes) {
  const marks = (events || [])
    .filter((e) => e.team !== "away" && e.minute !== "" && e.minute != null && (
      (e.type === "sub" && (e.playerIn === playerId || e.playerOut === playerId)) ||
      (e.type === "card" && e.playerId === playerId && (e.cardColor === "red" || e.cardColor === "yellow2"))))
    .map((e) => ({ m: Math.min(Number(e.minute) || 0, matchMinutes), isIn: e.type === "sub" && e.playerIn === playerId }))
    .sort((a, b) => a.m - b.m);
  let cur = starterIds.includes(playerId) ? 0 : null;
  let sum = 0;
  for (const k of marks) {
    if (k.isIn) { if (cur === null) cur = k.m; }
    else if (cur !== null) { sum += Math.max(0, k.m - cur); cur = null; }
  }
  if (cur !== null) sum += Math.max(0, matchMinutes - cur);
  return sum;
}

// Regla del acta para cualquier equipo:
//  - titular sin cambios = juega el partido completo; con cambios, hasta que sale
//  - suplente que no participa en ningún cambio = 0 minutos
// Si todavía no hay titulares marcados no se puede saber quién jugó: se respeta lo que ya hubiera apuntado (`fallback`).
export function actaMinutes(playerId, starterIds, events, matchMinutes, fallback = 0) {
  const isStarter = starterIds.includes(playerId);
  const hasSubs = (events || []).some((e) => e.team !== "away" && e.type === "sub" && (e.playerIn === playerId || e.playerOut === playerId));
  if (isStarter || hasSubs) return calcMinutesPlayed(playerId, starterIds, events, matchMinutes);
  return starterIds.length > 0 ? 0 : fallback;
}
