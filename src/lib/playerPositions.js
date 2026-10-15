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
    if (!list.some((x) => x.position === e.position && (x.role || "") === (e.role || ""))) list.push({ position: e.position, role: e.role || "", level: e.level === "competente" ? "competente" : "secundaria" });
  });
  const rank = { natural: 0, secundaria: 1, competente: 2 };
  return list.map((x, i) => ({ x, i })).sort((a, b) => rank[a.x.level] - rank[b.x.level] || a.i - b.i).map((o) => o.x);
}

// ── Ubicación en el campo (0-100; x = izquierda→derecha, y = 0 portería rival … 100 portería propia) ──
// Regla: ningún lateral se dibuja por encima de un central (como mucho a la misma altura: el central más retrasado, el libre, está en 80).
// Cada rol tiene una altura (y) y un modo de reparto horizontal según la lateralidad:
//  center = siempre en el centro · shift = algo hacia su pie natural (dx desde el centro)
//  band = banda del pie natural (x desde el borde) · band_inv = banda contraria (pierna cambiada)
// Ambidiestro: las posiciones lateralizadas (shift/band/band_inv) salen en ambos lados.
const POS_DEFAULT = {
  portero: { y: 96, mode: "center" },
  central: { y: 69, mode: "shift", v: 4 },
  lateral: { y: 80, mode: "band", v: 16 },
  mediocentro: { y: 56, mode: "center" },
  interior: { y: 41, mode: "shift", v: 12 },
  extremo: { y: 25, mode: "band", v: 11 },
  delantero_centro: { y: 12, mode: "center" },
};
const ROLE_POS = {
  central_libre: { y: 80 }, central_marcador: { y: 69 }, central_con_salida: { y: 69 }, central_completo: { y: 69 },
  lateral_defensivo: { y: 82 }, lateral_interior: { y: 80 }, lateral_completo: { y: 80 },
  mediocentro_posicional: { y: 56 }, mediocentro_organizador: { y: 56 },
  interior_mixto: { y: 41 }, interior_avanzado: { y: 31 },
  extremo_apoyo: { y: 30, v: 13 }, extremo_profundo: { y: 19, v: 10 }, extremo_interior: { y: 19, v: 10, mode: "band_inv" },
  falso_9: { y: 22 }, mediapunta: { y: 22 }, delantero_profundo: { y: 12 },
  portero_defensivo: { y: 96 }, portero_completo: { y: 96 },
};

// Devuelve uno o dos puntos (dos si es ambidiestro y la posición es lateralizada)
export function getPitchXYs(position, role, laterality) {
  const key = position === "libre" ? "central" : position;
  const base = POS_DEFAULT[key];
  if (!base) return [];
  const r = { ...base, ...(ROLE_POS[role] || (position === "libre" ? ROLE_POS.central_libre : {})) };
  if (r.mode === "center") return [{ x: 50, y: r.y }];
  const ambi = laterality === "ambidiestro";
  if (ambi && key === "central") return [{ x: 50, y: r.y }];
  const sides = ambi ? ["left", "right"] : [laterality === "zurdo" ? "left" : "right"];
  return sides.map((side) => {
    const sd = r.mode === "band_inv" && !ambi ? (side === "left" ? "right" : "left") : side;
    const x = r.mode === "shift" ? (sd === "left" ? 50 - r.v : 50 + r.v) : (sd === "left" ? r.v : 100 - r.v);
    return { x, y: r.y };
  });
}

export function getPitchXY(position, role, laterality) {
  return getPitchXYs(position, role, laterality)[0] || null;
}

// Un solo grupo de botones por posición: el del nivel más alto (natural > secundaria > competente)
export function getPitchMarkers(player, laterality) {
  const seen = new Set();
  const out = [];
  getPositionList(player).forEach((x) => {
    if (seen.has(x.position)) return;
    seen.add(x.position);
    getPitchXYs(x.position, x.role, laterality).forEach((c) => out.push({ ...x, c }));
  });
  return out;
}
