// Posiciones de un jugador al estilo Football Manager:
// - posición principal (position + reference_role) = NATURAL (verde)
// - extra_positions: [{ position, role, level }] con level "secundaria" (verde claro) o "competente" (naranja)
// Compatibilidad: si solo existe el antiguo secondary_position, se trata como una secundaria sin rol.

export const LEVELS = {
  natural: { label: "Natural", color: "#22c55e" },
  secundaria: { label: "Secundaria", color: "#86efac" },
  competente: { label: "Competente", color: "#f59e0b" },
};
export const EXTRA_LEVELS = ["secundaria", "competente"];

export function getExtraPositions(player) {
  if (!player) return [];
  if (Array.isArray(player.extra_positions)) return player.extra_positions.filter((e) => e && e.position);
  return player.secondary_position ? [{ position: player.secondary_position, role: "", level: "secundaria" }] : [];
}

// Lista completa: principal (natural) + extras, sin repetir posición
export function getPositionList(player) {
  if (!player) return [];
  const list = [];
  if (player.position) list.push({ position: player.position, role: player.reference_role || "", level: "natural" });
  getExtraPositions(player).forEach((e) => {
    if (!list.some((x) => x.position === e.position)) list.push({ position: e.position, role: e.role || "", level: e.level === "competente" ? "competente" : "secundaria" });
  });
  return list;
}
