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
  // Orden: natural primero; a continuación las demás entradas de su misma posición (otros roles);
  // después el resto de posiciones agrupadas, de mejor a peor nivel (secundaria antes que competente).
  const rank = { natural: 0, secundaria: 1, competente: 2 };
  const best = {};
  list.forEach((x) => { best[x.position] = Math.min(best[x.position] ?? 9, rank[x.level]); });
  const first = {};
  list.forEach((x, i) => { if (first[x.position] === undefined) first[x.position] = i; });
  return list
    .map((x, i) => ({ x, i }))
    .sort((a, b) => best[a.x.position] - best[b.x.position] || first[a.x.position] - first[b.x.position] || rank[a.x.level] - rank[b.x.level] || a.i - b.i)
    .map((o) => o.x);
}

// Un botón por posición y por lado: si la misma posición cae del mismo lado con distintos roles, se deja solo el del nivel más alto
// (natural > secundaria > competente); si cae en lados distintos (p. ej. extremo interior y extremo de apoyo en un zurdo) salen los dos.
export function getPitchMarkers(player, laterality) {
  const seen = new Set();
  const out = [];
  getPositionList(player).forEach((x) => {
    getPitchXYs(x.position, x.role, laterality).forEach((c) => {
      const k = x.position + (c.x < 45 ? "L" : c.x > 55 ? "R" : "C");
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ ...x, c });
    });
  });
  return out;
}
