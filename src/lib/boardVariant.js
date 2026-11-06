// Las tres versiones de la pizarra común (05/11/2026, maqueta aprobada por Nacho: «el mismo sistema de funcionamiento, pero
// diferentes vistas»): Tareas, Táctica y Balón parado. Comparten el motor, el formato guardado y todo «Campo y ajustes» (vista
// plana, perspectiva y 3D, campos, estilos de estadio, cámara…); solo cambia la barra de herramientas de dibujo y la pestaña
// «Jugador» de la tarjeta de la ficha. Lógica pura (sin importaciones de la app) para poder probarla en Node.

export const BOARD_VARIANTS = ["tareas", "tactica", "abp"];
export const cleanVariant = (v) => (BOARD_VARIANTS.includes(v) ? v : "tareas");

// Qué herramientas de dibujo salen en la barra de cada versión (lo demás —mover, varios, capas, equipos, balón, flechas,
// zonas y texto— sale en las tres). Táctica sin material de entrenamiento; balón parado sin material, sin unir fichas, sin
// cámara y sin crear equipos nuevos (es Racing contra Rival).
const RAILS = {
  tareas: { material: true, link: true, camera: true, newTeam: true },
  tactica: { material: false, link: true, camera: true, newTeam: true },
  abp: { material: false, link: false, camera: false, newTeam: false },
};
export const railOf = (v) => RAILS[cleanVariant(v)];

// Atajos de teclado que abren herramientas que esa versión no tiene: no hacen nada
const KEY_NEEDS = { material: "material", cycleMaterial: "material", link: "link", camera: "camera" };
export function keyAllowed(variant, action) {
  const need = KEY_NEEDS[action];
  return need ? Boolean(railOf(variant)[need]) : true;
}

// Puestos de la pizarra de táctica, con sus siglas para el texto de encima de la ficha
export const TACTIC_POSITIONS = [
  { id: "portero", label: "Portero", short: "POR" },
  { id: "libre", label: "Libre", short: "LIB" },
  { id: "central", label: "Central", short: "CEN" },
  { id: "lateral", label: "Lateral", short: "LAT" },
  { id: "mediocentro", label: "Mediocentro", short: "MC" },
  { id: "interior", label: "Interior", short: "INT" },
  { id: "mediapunta", label: "Mediapunta", short: "MP" },
  { id: "extremo", label: "Extremo", short: "EXT" },
  { id: "delantero_centro", label: "Delantero centro", short: "DC" },
];
export const posShort = (id) => TACTIC_POSITIONS.find((p) => p.id === id)?.short || "";

// Qué se escribe encima de la ficha según lo elegido en la tarjeta: «fn» (función, balón parado), «pos» (puesto), «rol»,
// «text» (lo que se escriba a mano) o «none» (nada). `names` = { fn, rol } con el nombre de la función y del rol.
export function topTextFor(mode, el, names = {}) {
  if (mode === "none") return undefined;
  if (mode === "fn") return names.fn ? String(names.fn).toUpperCase() : undefined;
  if (mode === "pos") return posShort(el.pos) || undefined;
  if (mode === "rol") return names.rol ? String(names.rol).toUpperCase() : undefined;
  return el.labelTop || undefined;
}
// Lo que hay que cambiar en la ficha al elegir qué va encima (se recuerda la elección en `topMode`)
export function topPatch(mode, el, names = {}) {
  return { topMode: mode, labelTop: topTextFor(mode, el, names) };
}
// El modo actual: el guardado o, en fichas de antes, «text» si tienen algo escrito encima y «none» si no
export const topModeOf = (el, fallback = "none") => el.topMode || (el.labelTop ? "text" : fallback);

// Táctica: elegir un jugador de la plantilla pone su dorsal, su nombre y, si la ficha aún no tiene puesto, el de su ficha
// (y el texto de encima, si va el puesto). `player` = { id, label, number, position } o null para dejarla sin jugador.
export function tacticPlayerPatch(el, player) {
  if (!player) return { player_id: undefined };
  const pos = el.pos || (TACTIC_POSITIONS.some((p) => p.id === player.position) ? player.position : undefined);
  const patch = { player_id: player.id, label: player.label || "", pos };
  const num = String(player.number ?? "").trim();
  if (num) patch.inner = num.slice(0, 3);
  const mode = el.topMode || (pos && !el.labelTop ? "pos" : null);
  if (mode === "pos") Object.assign(patch, topPatch("pos", { ...el, pos }));
  return patch;
}

// Pestaña de la tarjeta que se abre (la última que se usó)
export const CARD_TABS = ["jugador", "aspecto", "letra"];
export const cleanCardTab = (t) => (CARD_TABS.includes(t) ? t : "jugador");

// Grosor del borde de la ficha en cuatro pasos (0 = sin borde, 1 = el normal)
export const EDGE_STEPS = [
  { id: "sin", label: "Sin", value: 0 },
  { id: "fino", label: "Fino", value: 0.6 },
  { id: "normal", label: "Normal", value: 1 },
  { id: "grueso", label: "Grueso", value: 1.8 },
];
export function edgeStepOf(edge) {
  const v = edge == null ? 1 : Number(edge);
  return EDGE_STEPS.reduce((best, s) => (Math.abs(s.value - v) < Math.abs(best.value - v) ? s : best), EDGE_STEPS[2]).id;
}

// Dónde poner la tarjeta de una ficha para tapar lo menos posible (06/11/2026, «sigue» de Nacho a mi propuesta: «que se
// coloque sola en el hueco más libre»). Se prueban varios sitios alrededor de la ficha (a la derecha y a la izquierda, a tres
// alturas, y encima y debajo), se meten dentro del recuadro y se elige el que tapa menos cosas (`points` = centros en pantalla de
// lo demás del fotograma); nunca uno que tape la propia ficha. A igualdad, el orden de la lista (derecha primero).
export function placeCard({ x, y, rs, W, H, boxW, boxH, points = [], pad = 4, gap = 14 }) {
  const clampL = (l) => Math.max(pad, Math.min(l, boxW - W - pad));
  const clampT = (t) => Math.max(pad, Math.min(t, boxH - H - pad));
  const cands = [
    [x + rs + gap, y - 110], [x + rs + gap, y - H + 60], [x + rs + gap, y - 40],
    [x - rs - gap - W, y - 110], [x - rs - gap - W, y - H + 60], [x - rs - gap - W, y - 40],
    [x - W / 2, y + rs + gap], [x - W / 2, y - rs - gap - H],
  ].map(([l, t]) => ({ left: clampL(l), top: clampT(t) }));
  const covers = (c, p, m = 0) => p.x >= c.left - m && p.x <= c.left + W + m && p.y >= c.top - m && p.y <= c.top + H + m;
  let best = null;
  for (const c of cands) {
    if (covers(c, { x, y }, rs * 0.6)) continue;
    const n = points.reduce((s, p) => s + (covers(c, p, 10) ? 1 : 0), 0);
    if (!best || n < best.n) best = { ...c, n };
  }
  return best ? { left: best.left, top: best.top, covered: best.n } : { ...cands[0], covered: 0 };
}
