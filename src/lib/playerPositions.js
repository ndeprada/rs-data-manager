// Posiciones de un jugador al estilo Football Manager:
// - posición principal (position + reference_role) = NATURAL (verde)
// - extra_positions: [{ position, role, level }] con level "secundaria" (verde claro) o "competente" (naranja)
// Compatibilidad: si solo existe el antiguo secondary_position, se trata como una secundaria sin rol.

export const LEVELS = {
  natural: { label: "Natural", color: "#2ce65f", text: "#05341a", ink: "#15a03d" },
  secundaria: { label: "Secundaria", color: "#7fa24f", text: "#0f1f0a", ink: "#5d7d36" },
  competente: { label: "Competente", color: "#f5c60a", text: "#3b2f00", ink: "#a37c00" },
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


// ── Ubicación en el campo (0-100; x = izquierda→derecha, y = 0 portería rival … 100 portería propia) ──
// Orden de profundidad: portero → centrales → laterales (algo más adelantados) → mediocentro → interiores → extremos → delantero.
// El rol ajusta la altura: libre más atrás, delantero de referencia muy arriba, falso 9 / mediapunta más cerca de los medios.
const BASE = {
  portero: { x: 50, y: 93 },
  central: { x: 50, y: 78 },
  lateral: { x: 14, y: 66 },   // lado izquierdo (perfil del zurdo); se espeja para diestros
  mediocentro: { x: 50, y: 52 },
  interior: { x: 30, y: 42 },
  extremo: { x: 12, y: 27 },
  delantero_centro: { x: 50, y: 15 },
};
const ROLE_ADJUST = {
  central_libre: { y: 84 }, central_marcador: { y: 78 }, central_con_salida: { y: 75 }, central_completo: { y: 76 },
  lateral_defensivo: { y: 69 }, lateral_interior: { x: 26, y: 61 }, lateral_completo: { y: 62 },
  mediocentro_posicional: { y: 58 }, mediocentro_organizador: { y: 49 },
  interior_mixto: { y: 43 }, interior_avanzado: { y: 35 },
  extremo_apoyo: { x: 14, y: 32 }, extremo_profundo: { x: 10, y: 21 }, extremo_interior: { x: 22, y: 28 },
  falso_9: { y: 31 }, mediapunta: { y: 34 }, delantero_profundo: { y: 12 },
  portero_defensivo: { y: 94 }, portero_completo: { y: 90 },
};
const MIRROR = new Set(["lateral", "extremo", "interior"]);

export function getPitchXY(position, role, laterality) {
  const key = position === "libre" ? "central" : position;
  const base = BASE[key];
  if (!base) return null;
  const c = { ...base, ...(ROLE_ADJUST[role] || (position === "libre" ? ROLE_ADJUST.central_libre : {})) };
  return laterality !== "zurdo" && MIRROR.has(key) ? { x: 100 - c.x, y: c.y } : c;
}
