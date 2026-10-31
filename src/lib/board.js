// Pizarra de dibujo y animación (motor común de tareas, tácticas y balón parado).
// Se guarda como datos, no como imagen: { v:2, field, look, orient, frames:[{ id, els:[…] }] }.
// Cada fotograma es una foto completa de lo que hay en el campo. Los elementos que se mueven (fichas, balón, conos,
// porterías) conservan su id entre fotogramas, así que al reproducir se interpola su posición; flechas, zonas y textos
// pertenecen a su fotograma y se funden de uno al siguiente.
// Unidades de campo: metros. Eje x a lo ancho, eje y a lo largo (portería a atacar arriba, y=0).

export const BOARD_VERSION = 2;
export const MAX_FRAMES = 60;

// Medidas en metros. Fútbol 11: 105 × 68. Fútbol 7: 65 × 45 (máximo de las Normas Reguladoras de Fútbol 7 de la RFEF).
// «3/4 de campo» es el campo completo sin el último cuarto (se ve la línea de medio campo y el círculo, sin línea de fondo
// del lado contrario). «Espacio libre» es un espacio en blanco, sin líneas.
export const FIELDS = [
  { id: "full", label: "Campo completo", w: 68, h: 105 },
  { id: "tq", label: "3/4 de campo", w: 68, h: 78.75 },
  { id: "half", label: "Medio campo", w: 68, h: 52.5 },
  { id: "f7", label: "Fútbol 7", w: 45, h: 65 },
  { id: "free", label: "Espacio libre (en blanco)", w: 68, h: 52.5 },
];
export const fieldOf = (id) => FIELDS.find((f) => f.id === id) || FIELDS.find((f) => f.id === "half");

// Modos visuales: pensados para pantalla y para imprimir sin gastar tinta. «blanco» y «color» son los de siempre (con
// franjas); los demás ids son nuevos (liso y cuadrícula).
export const LOOKS = [
  { id: "blanco", label: "Blanco y gris (franjas)" },
  { id: "blanco-liso", label: "Blanco liso" },
  { id: "blanco-cuadros", label: "Blanco y gris (cuadrícula)" },
  { id: "color", label: "Verde (franjas)" },
  { id: "color-cuadros", label: "Verde (cuadrícula)" },
  { id: "bn", label: "Blanco y negro (impresión)" },
  { id: "estadio", label: "Estadio (césped verde)" },
  { id: "estadio-noche", label: "Estadio (noche)" },
];
export const DEFAULT_LOOK = "blanco";
export const lookOf = (id) => LOOKS.find((l) => l.id === id)?.id || DEFAULT_LOOK;
// Modos «estadio» (como FmStadio): césped a cuadros y gradas alrededor, por eso llevan más margen alrededor del campo (m)
export const isStadium = (look) => look === "estadio" || look === "estadio-noche";
// En los modos estadio se pueden quitar las gradas (`board.stands === false`) y las vallas publicitarias (`board.ads === false`)
export const STADIUM_MARGIN = 13;
export const hasStands = (b) => b?.stands !== false;
export const hasAds = (b) => b?.ads !== false;
export function marginOf(look, b = null) {
  if (!isStadium(lookOf(look))) return 3;
  if (hasStands(b)) return STADIUM_MARGIN;
  return hasAds(b) ? 5.5 : 3;
}
// Vallas publicitarias alrededor del campo (modos estadio): la app y los patrocinadores del club, en este orden y repetidos
export const AD_PANELS = [
  { text: "RS MANAGER", bg: "#73000A", ink: "#ffffff" },
  { text: "CHALITO", bg: "#ffffff", ink: "#73000A" },
  { text: "RACING SARRIÀ", bg: "#36000D", ink: "#FF6E00" },
  { text: "BPV", bg: "#FF6E00", ink: "#ffffff" },
];

// Equipos: cuatro de partida (granate, azul, amarillo y verde de portero), todos con nombre y color libres, y se pueden crear
// más (hasta MAX_TEAMS). `n` (Neutro) es de los dibujos antiguos: solo aparece si hay fichas que lo usan.
export const MAX_TEAMS = 8;
export const DEFAULT_TEAMS = [
  { id: "a", name: "Equipo A", color: "#73000A" },
  { id: "b", name: "Equipo B", color: "#2563eb" },
  { id: "c", name: "Comodín", color: "#f59e0b" },
  { id: "gk", name: "Portero", color: "#16a34a" },
];
const NEUTRAL_TEAM = { id: "n", name: "Neutro", color: "#374151" };
export const TEAMS = DEFAULT_TEAMS.map((t) => ({ id: t.id, label: t.name }));
const TEAM_COLORS = ["#7c3aed", "#ec4899", "#0d9488", "#f97316", "#06b6d4", "#84cc16", "#92400e", "#ffffff", "#111827"];

export function teamsOf(board) {
  const saved = Array.isArray(board?.teams) ? board.teams.filter((t) => t && t.id) : [];
  const out = DEFAULT_TEAMS.map((d) => ({ ...d, ...saved.find((t) => t.id === d.id) }));
  for (const t of saved) if (!DEFAULT_TEAMS.some((d) => d.id === t.id)) out.push({ name: "Equipo", color: "#6b7280", ...(t.id === "n" ? NEUTRAL_TEAM : {}), ...t });
  const usesNeutral = (board?.frames || []).some((f) => (f.els || []).some((e) => e.k === "token" && e.team === "n"));
  if (usesNeutral && !out.some((t) => t.id === "n")) out.push({ ...NEUTRAL_TEAM });
  return out;
}
export const teamOf = (board, id) => teamsOf(board).find((t) => t.id === id) || DEFAULT_TEAMS[0];
export const tokenColor = (board, el) => el.color || teamOf(board, el.team).color;

// Equipo nuevo: id propio, siguiente color que no esté en uso. Devuelve { board, id } (id null si ya hay el máximo).
export function addTeam(board) {
  const teams = teamsOf(board);
  if (teams.length >= MAX_TEAMS) return { board, id: null };
  const ids = new Set(teams.map((t) => t.id));
  let n = 1;
  while (ids.has(`t${n}`)) n++;
  const used = new Set(teams.map((t) => String(t.color).toLowerCase()));
  const color = TEAM_COLORS.find((c) => !used.has(c)) || TEAM_COLORS[0];
  const team = { id: `t${n}`, name: `Equipo ${teams.length + 1}`, color };
  return { board: { ...board, teams: [...teams, team] }, id: team.id };
}
// Quitar un equipo creado a mano (los de partida no se quitan) siempre que ninguna ficha lo use.
export const teamInUse = (board, id) => board.frames.some((f) => f.els.some((e) => e.k === "token" && e.team === id));
export function removeTeam(board, id) {
  if (DEFAULT_TEAMS.some((d) => d.id === id) || teamInUse(board, id)) return board;
  return { ...board, teams: teamsOf(board).filter((t) => t.id !== id) };
}

// Diseño de las fichas: color de relleno, segundo color del dibujo y borde, por equipo y, si se quiere, por ficha suelta.
export const CHIP_PATTERNS = [
  { id: "solid", label: "Lisa" },
  { id: "sash", label: "Banda cruzada" },
  { id: "v", label: "Líneas verticales" },
  { id: "h", label: "Líneas horizontales" },
  { id: "halves", label: "Mitades" },
  { id: "stripes", label: "Rayas" },
  { id: "hoops", label: "Aros" },
  { id: "quarters", label: "Cuartos" },
];
// Forma de la ficha: «botón» (disco con brillo) o «camiseta» (la camiseta vista de frente dentro del disco, con cuello y
// mangas del color de los ribetes `trim`), como las fichas de equipos de FmStadio pero sin escudos ni nombres de clubes.
export const CHIP_KINDS = [
  { id: "boton", label: "Botón" },
  { id: "camiseta", label: "Camiseta" },
];
// Diseño del balón: color, segundo color (los dibujos) y estilo. Sin estilo guardado es el de antes (punto central).
export const BALL_PATTERNS = [
  { id: "classic", label: "Clásico" },
  { id: "dot", label: "Punto" },
  { id: "plain", label: "Liso" },
  { id: "stripe", label: "Franja" },
];
export const ballStyle = (el) => ({ pattern: el?.pattern || "dot", color: el?.color || "#ffffff", color2: el?.color2 || "#111827", stroke: el?.stroke || null });

export function contrastColor(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return "#111827";
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.35 ? "#ffffff" : "#111827";
}
// Diseño de una ficha: lo suyo si lo tiene, si no lo del equipo. stroke null = el borde por defecto del modo visual.
export function chipStyle(board, el) {
  const t = teamOf(board, el.team);
  const color = el.color || t.color;
  const color2 = el.color2 || t.color2 || contrastColor(color);
  return {
    pattern: el.pattern || t.pattern || "solid", color, color2, stroke: el.stroke || t.stroke || null,
    kit: (el.kit || t.kit) === "camiseta" ? "camiseta" : "boton",
    trim: el.trim || t.trim || color2,
  };
}

// Radio base de las fichas (metros) y tamaño de cada una (múltiplo del base)
export const DEFAULT_CHIP = 1.5;
export const CHIP_RANGE = [0.8, 3.2];
export const chipOf = (board) => Math.min(CHIP_RANGE[1], Math.max(CHIP_RANGE[0], Number(board?.chipSize) || DEFAULT_CHIP));
export const tokenR = (base, el) => base * (Number(el?.size) || 1);

// Mismo tamaño para todas las fichas: fija el tamaño base y quita los tamaños sueltos de cada ficha (en todos los fotogramas).
export function setAllChips(board, radius) {
  const chipSize = Math.round(Math.min(CHIP_RANGE[1], Math.max(CHIP_RANGE[0], radius)) * 100) / 100;
  const plain = (e) => {
    if (e.k !== "token" || e.size == null) return e;
    const { size: _size, ...rest } = e;
    return rest;
  };
  return { ...board, chipSize, frames: board.frames.map((f) => ({ ...f, els: f.els.map(plain) })) };
}

export const FONTS = [
  { id: "sans", label: "Normal", css: "Arial, Helvetica, sans-serif" },
  { id: "cond", label: "Condensada", css: "'IBM Plex Sans Condensed', 'Arial Narrow', Arial, sans-serif" },
  { id: "serif", label: "Con serifa", css: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Máquina", css: "'Courier New', monospace" },
  { id: "hand", label: "Manuscrita", css: "'Segoe Print', 'Comic Sans MS', cursive" },
  { id: "club", label: "Racing Sarrià", css: "'Racing Sarria', Impact, sans-serif" },
];
export const fontOf = (id) => FONTS.find((f) => f.id === id)?.css || FONTS[0].css;

// Fondo opcional detrás de un texto o del nombre de una ficha (sin fondo = invisible, como siempre).
// Ancho estimado del texto (en las mismas unidades que el tamaño de letra): no hay DOM al exportar PNG/vídeo.
export function textWidth(text, fs, bold = true) {
  let w = 0;
  for (const ch of String(text || "")) w += /[MW@ÑÁÉÍÓÚÜ%]/.test(ch) ? 0.82 : /[A-Z0-9]/.test(ch) ? 0.66 : /[il.,'!|:;·\s]/.test(ch) ? 0.3 : /[mw]/.test(ch) ? 0.82 : 0.55;
  return w * fs * (bold ? 1.06 : 1);
}
/** Recuadro del fondo de un texto centrado en x con la línea base en y. */
export function textBgBox(x, y, text, fs, bold = true) {
  const w = Math.max(fs * 0.8, textWidth(text, fs, bold)) + fs * 0.6;
  const top = y - fs * 0.86, h = fs * 1.18;
  return { x: x - w / 2, y: top, w, h, rx: Math.min(h / 2, fs * 0.28) };
}

// Medidas de portería (anchura entre postes, metros)
export const GOAL_SIZES = [
  { id: "mini", label: "Mini", w: 2 },
  { id: "f7", label: "Fútbol 7", w: 6 },
  { id: "f11", label: "Grande", w: 7.32 },
];

// Material de entrenamiento que se dibuja con giro y tamaño: media anchura (hw) y media longitud (hh) en metros con tamaño 1.
// Con giro 0 la pica y el maniquí miran hacia arriba, la valla es una barra horizontal y la escalera se extiende a lo largo.
export const MATERIALS = [
  { id: "pole", label: "Pica", hw: 0.9, hh: 1.7, color: "#eab308" },
  { id: "hurdle", label: "Valla", hw: 1.6, hh: 1.0, color: "#2563eb" },
  { id: "ladder", label: "Escalera", hw: 0.85, hh: 3.1, color: "#f59e0b" },
  { id: "dummy", label: "Maniquí", hw: 1.25, hh: 0.95, color: "#6b7280" },
];
export const materialOf = (k) => MATERIALS.find((m) => m.id === k) || null;
export const LADDER_RUNGS = [4, 12];
export const ladderRungs = (el) => Math.min(LADDER_RUNGS[1], Math.max(LADDER_RUNGS[0], Math.round(Number(el?.rungs) || 8)));

// Ficha con pies: mira hacia `face` (grados, sentido horario desde «hacia la portería a atacar» en coordenadas de campo).
export const faceOf = (el) => (((Number(el?.face) || 0) % 360) + 360) % 360;
export const FACE_STEP = 5;
// Ángulo de orientación (grados) de una ficha para el punto del campo `target`, desde la ficha `from`.
export const faceToward = (from, target, step = FACE_STEP) => {
  const a = (Math.atan2(target.x - from.x, -(target.y - from.y)) * 180) / Math.PI;
  const snapped = Math.round(a / step) * step;
  return ((snapped % 360) + 360) % 360;
};
// Pies o no en todas las fichas (todos los fotogramas)
export function setAllFeet(board, on) {
  const tweak = (e) => {
    if (e.k !== "token") return e;
    if (on) return { ...e, feet: true };
    const { feet: _f, face: _a, ...rest } = e;
    return rest;
  };
  return { ...board, frames: board.frames.map((f) => ({ ...f, els: f.els.map(tweak) })) };
}

const MOVABLE = new Set(["token", "ball", "cone", "goal", "pole", "hurdle", "ladder", "dummy"]);
export const isMovable = (el) => MOVABLE.has(el?.k);
// Lo que pasa de un fotograma al siguiente con el mismo id: lo que se mueve y los conectores (que unen fichas por su id y
// siguen sus posiciones). Flechas, zonas y textos son de su fotograma.
export const isCarried = (el) => isMovable(el) || el?.k === "link";
// Lo que se puede unir con un conector: fichas, conos, balón, picas y maniquíes (puntos, no porterías ni escaleras)
export const isLinkable = (el) => ["token", "cone", "ball", "pole", "dummy"].includes(el?.k);

let counter = 0;
export const newId = () => `e${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const round = (n) => Math.round(n * 10) / 10;
const clone = (o) => JSON.parse(JSON.stringify(o));

// Las pizarras nuevas empiezan con el estadio (como FmStadio; decidido con Nacho el 31/10/2026). Las ya guardadas conservan su modo.
export const NEW_BOARD_LOOK = "estadio";
export function emptyBoard(field = "half") {
  return { v: BOARD_VERSION, field, look: NEW_BOARD_LOOK, orient: "v", frames: [{ id: newId(), els: [] }] };
}

// Acepta el formato antiguo ({ field, elements }) y el nuevo; siempre devuelve el nuevo, sin tocar el original.
export function normalizeBoard(value) {
  if (!value) return emptyBoard();
  if (value.v === BOARD_VERSION && Array.isArray(value.frames)) {
    const frames = value.frames.length ? value.frames : [{ id: newId(), els: [] }];
    return {
      v: BOARD_VERSION,
      field: fieldOf(value.field).id,
      look: lookOf(value.look),
      orient: orientOf(value.orient),
      ...(value.mode === "image" || value.mode === "anim" ? { mode: value.mode } : {}),
      ...(SPEED_IDS.includes(value.speed) ? { speed: value.speed } : {}),
      ...(Array.isArray(value.teams) ? { teams: value.teams } : {}),
      ...(value.chipSize ? { chipSize: value.chipSize } : {}),
      ...(value.view === "persp" ? { view: "persp" } : {}),
      ...(value.stands === false ? { stands: false } : {}),
      ...(value.ads === false ? { ads: false } : {}),
      ...(camOf(value).z > 1 ? { cam: camOf(value) } : {}),
      frames: frames.map((f) => ({ id: f.id || newId(), els: Array.isArray(f.els) ? f.els : [] })),
    };
  }
  return {
    v: BOARD_VERSION,
    field: fieldOf(value.field).id,
    look: DEFAULT_LOOK,
    orient: "v",
    frames: [{ id: newId(), els: Array.isArray(value.elements) ? value.elements : [] }],
  };
}

export const hasBoard = (b) => {
  if (!b) return false;
  if (b.v === BOARD_VERSION) return (b.frames || []).some((f) => (f.els || []).length > 0);
  return (b.elements || []).length > 0;
};

export const frameCount = (b) => (b?.v === BOARD_VERSION ? b.frames.length : 1);

// Tipo de dibujo de una tarea: una imagen (un solo fotograma, el primero) o una animación (varios fotogramas). Sin elegir,
// se deduce de los fotogramas que tenga. Los fotogramas de una animación se conservan al pasar a imagen, por si se vuelve.
export const boardMode = (b) => (b?.mode === "image" || b?.mode === "anim" ? b.mode : (b?.frames?.length || 1) > 1 ? "anim" : "image");
// Velocidad de la animación (ms por paso entre fotogramas), guardada con el dibujo para que reproductor y vídeo la respeten
export const SPEED_IDS = [800, 1500, 2600];
export const boardSpeed = (b) => (SPEED_IDS.includes(b?.speed) ? b.speed : 1500);
export const isAnimation = (b) => boardMode(b) === "anim" && (b?.frames?.length || 0) > 1;

// ── Fotogramas ─────────────────────────────────────────────────────────────────────────────────────────────────────

// Nuevo fotograma detrás del indicado: copia lo que se mueve (con los mismos ids) y deja vacías las anotaciones.
export function addFrame(board, after = board.frames.length - 1) {
  if (board.frames.length >= MAX_FRAMES) return { board, index: after };
  const src = board.frames[Math.min(Math.max(after, 0), board.frames.length - 1)];
  const frame = { id: newId(), els: clone(src.els.filter(isCarried)) };
  const frames = [...board.frames];
  frames.splice(after + 1, 0, frame);
  return { board: { ...board, frames }, index: after + 1 };
}

// Copia exacta del fotograma, también las flechas, zonas y textos con el MISMO id: así, si en la copia se mueven o se cambian,
// al reproducir se deslizan de una posición a otra (como las fichas).
export function duplicateFrame(board, index) {
  if (board.frames.length >= MAX_FRAMES) return { board, index };
  const src = board.frames[index];
  const els = clone(src.els);
  const frames = [...board.frames];
  frames.splice(index + 1, 0, { id: newId(), els });
  return { board: { ...board, frames }, index: index + 1 };
}

export function removeFrame(board, index) {
  if (board.frames.length <= 1) return { board: { ...board, frames: [{ id: board.frames[0].id, els: [] }] }, index: 0 };
  const frames = board.frames.filter((_, i) => i !== index);
  return { board: { ...board, frames }, index: Math.min(index, frames.length - 1) };
}

export function moveFrame(board, index, dir) {
  const to = index + dir;
  if (to < 0 || to >= board.frames.length) return { board, index };
  const frames = [...board.frames];
  [frames[index], frames[to]] = [frames[to], frames[index]];
  return { board: { ...board, frames }, index: to };
}

// Cambio de campo: lo dibujado se reescala para que siga en el mismo sitio relativo del campo nuevo.
export function changeField(board, id) {
  const from = fieldOf(board.field), to = fieldOf(id);
  if (from.id === to.id) return board;
  const kx = to.w / from.w, ky = to.h / from.h;
  const sc = (e) => {
    if (e.k === "arrow") {
      const o = { ...e, x1: round(e.x1 * kx), y1: round(e.y1 * ky), x2: round(e.x2 * kx), y2: round(e.y2 * ky) };
      if (e.cx != null) { o.cx = round(e.cx * kx); o.cy = round(e.cy * ky); }
      if (hasVia(e)) o.via = e.via.map((q) => ({ x: round(q.x * kx), y: round(q.y * ky) }));
      return o;
    }
    if (e.k === "link") return e;
    if (e.k === "zone" && isQuad(e)) return { ...e, pts: e.pts.map((q) => ({ x: round(q.x * kx), y: round(q.y * ky) })) };
    if (e.k === "zone") return { ...e, x: round(e.x * kx), y: round(e.y * ky), w: round(e.w * kx), h: round(e.h * ky) };
    return { ...e, x: round(e.x * kx), y: round(e.y * ky) };
  };
  return { ...board, field: to.id, frames: board.frames.map((f) => ({ ...f, els: f.els.map(sc) })) };
}

export const setFrameEls = (board, index, els) => ({
  ...board,
  frames: board.frames.map((f, i) => (i === index ? { ...f, els } : f)),
});

// Añade un elemento. Lo que se mueve (y los conectores) entra en todos los fotogramas (forma parte del ejercicio);
// flechas, zonas y textos solo en el fotograma actual.
export function addElement(board, index, el) {
  if (!isCarried(el)) return setFrameEls(board, index, placeElement(board.frames[index].els, el));
  const next = { ...board, frames: board.frames.map((f) => ({ ...f, els: placeElement(f.els, clone(el)) })) };
  return el.k === "link" ? pruneLinks(next) : next;
}

// Quita un elemento: de todos los fotogramas (lo habitual) o solo del actual.
export function removeElement(board, index, id, { onlyHere = false } = {}) {
  const el = board.frames[index]?.els.find((e) => e.id === id);
  if (!el) return board;
  if (onlyHere || !isCarried(el)) return pruneLinks(setFrameEls(board, index, board.frames[index].els.filter((e) => e.id !== id)));
  return pruneLinks({ ...board, frames: board.frames.map((f) => ({ ...f, els: f.els.filter((e) => e.id !== id) })) });
}

// Un conector solo vale si todavía tiene al menos dos fichas en su fotograma: se le quitan las que ya no están y, si
// se queda sin pareja, desaparece.
export function pruneLinks(board) {
  let changed = false;
  const frames = board.frames.map((f) => {
    if (!f.els.some((e) => e.k === "link")) return f;
    const here = new Set(f.els.filter(isMovable).map((e) => e.id));
    const els = [];
    for (const e of f.els) {
      if (e.k !== "link") { els.push(e); continue; }
      const ids = (e.ids || []).filter((id) => here.has(id));
      if (ids.length === (e.ids || []).length) els.push(e);
      else { changed = true; if (ids.length >= 2) els.push({ ...e, ids }); }
    }
    return { ...f, els };
  });
  return changed ? { ...board, frames } : board;
}

export const patchElement = (board, index, id, patch, { allFrames = false } = {}) => ({
  ...board,
  frames: board.frames.map((f, i) => (allFrames || i === index ? { ...f, els: f.els.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : f)),
});

// Mismo cambio en todos los fotogramas para lo que es de identidad (nombre, equipo) y no de posición.
export const IDENTITY_PATCH = ["label", "labelTop", "team"];

// ── Animación ──────────────────────────────────────────────────────────────────────────────────────────────────────

// Giro por el camino más corto
const lerpAngle = (a, b, k) => a + (((b - a + 540) % 360) - 180) * k;

export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

// Forma intermedia de una flecha, zona o texto que está en los dos fotogramas (mismo id): se desliza de una a otra.
const mix = (a, b, k) => a + (b - a) * k;
const mixPt = (p, q, k) => ({ x: mix(p.x, q.x, k), y: mix(p.y, q.y, k) });
function lerpShape(e, n, k) {
  if (e.k !== n.k) return k < 0.5 ? e : n;
  const base = k < 0.5 ? e : n; // estilo (color, trazo…) del más cercano
  if (e.k === "arrow") {
    const o = { ...base, x1: mix(e.x1, n.x1, k), y1: mix(e.y1, n.y1, k), x2: mix(e.x2, n.x2, k), y2: mix(e.y2, n.y2, k) };
    const ce = arrowPath(e), cn = arrowPath(n);
    if (ce === "poly" || cn === "poly") {
      // mismos quiebros: se mueven; si no, se reparte el recorrido de cada uno y se mezclan punto a punto
      if (ce === cn && e.via.length === n.via.length) o.via = e.via.map((q, i) => mixPt(q, n.via[i], k));
      else {
        const pe = arrowPoints(e, 12), pn = arrowPoints(n, 12);
        const at = (pts, i) => pts[Math.round((i / 12) * (pts.length - 1))];
        o.via = Array.from({ length: 11 }, (_, i) => mixPt(at(pe, i + 1), at(pn, i + 1), k));
      }
      delete o.cx; delete o.cy;
    } else if (ce === "curve" || cn === "curve") {
      const c1 = ce === "curve" ? { x: e.cx, y: e.cy } : { x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2 };
      const c2 = cn === "curve" ? { x: n.cx, y: n.cy } : { x: (n.x1 + n.x2) / 2, y: (n.y1 + n.y2) / 2 };
      const c = mixPt(c1, c2, k);
      o.cx = c.x; o.cy = c.y;
      delete o.via;
    }
    if (e.lift != null || n.lift != null) o.lift = mix(Number(e.lift) || 0, Number(n.lift) || 0, k);
    return o;
  }
  if (e.k === "zone") {
    if (isQuad(e) || isQuad(n)) {
      const pe = zoneCorners(e), pn = zoneCorners(n);
      const o = { ...base, shape: "quad", pts: pe.map((q, i) => mixPt(q, pn[i], k)) };
      delete o.x; delete o.y; delete o.w; delete o.h;
      return o;
    }
    return { ...base, x: mix(e.x, n.x, k), y: mix(e.y, n.y, k), w: mix(e.w, n.w, k), h: mix(e.h, n.h, k) };
  }
  if (e.k === "text") return { ...base, x: mix(e.x, n.x, k), y: mix(e.y, n.y, k), size: mix(Number(e.size) || 3, Number(n.size) || 3, k) };
  return base;
}

// Estado intermedio entre dos fotogramas (t de 0 a 1). Devuelve elementos con `opacity`.
// - Lo que se mueve (fichas, balón, material) va de su sitio en un fotograma a su sitio en el siguiente.
// - Flechas, zonas y textos que están en los dos fotogramas (mismo id: fotograma duplicado) se deslizan de una forma a otra.
// - Una flecha nueva se dibuja de su inicio a su punta (`reveal` de 0 a 1); lo demás que aparece o desaparece se funde.
// Los conectores que están en los dos fotogramas se quedan fijos (su forma sale de las fichas, que sí se mueven).
export function lerpFrames(a, b, t) {
  const k = ease(Math.min(1, Math.max(0, t)));
  const out = [];
  const bById = new Map(b.els.map((e) => [e.id, e]));
  for (const e of a.els) {
    const n = bById.get(e.id);
    if (isCarried(e)) {
      if (n && isCarried(n)) {
        if (isMovable(e)) {
          const o = { ...e, x: e.x + (n.x - e.x) * k, y: e.y + (n.y - e.y) * k, opacity: 1 };
          if (e.k === "token" && e.feet && (e.face != null || n.face != null)) o.face = lerpAngle(faceOf(e), faceOf(n), k);
          out.push(o);
        } else out.push({ ...e, opacity: 1 });
        bById.delete(e.id);
      } else out.push({ ...e, opacity: 1 - k });
    } else if (n && !isCarried(n)) {
      out.push({ ...lerpShape(e, n, k), opacity: 1 });
      bById.delete(e.id);
    } else out.push({ ...e, opacity: 1 - k });
  }
  for (const e of b.els) {
    if (!bById.has(e.id)) continue;
    if (e.k === "arrow") out.push({ ...e, reveal: k, opacity: Math.min(1, k * 4) });
    else out.push({ ...e, opacity: k });
  }
  return out;
}

// Línea de tiempo de la animación completa (para el vídeo): se queda un momento en el primer fotograma, recorre cada
// transición en `speed` ms y se queda un momento en el último.
export const ANIM_HOLD = { start: 600, end: 1200 };
export const animationDuration = (board, { speed = 1500, holdStart = ANIM_HOLD.start, holdEnd = ANIM_HOLD.end } = {}) =>
  board.frames.length < 2 ? 0 : holdStart + (board.frames.length - 1) * speed + holdEnd;
export function elsAtTime(board, ms, { speed = 1500, holdStart = ANIM_HOLD.start } = {}) {
  const frames = board.frames;
  const n = frames.length;
  if (n < 2) return frames[0].els;
  const seg = (ms - holdStart) / speed;
  if (seg <= 0) return frames[0].els;
  if (seg >= n - 1) return frames[n - 1].els;
  const i = Math.floor(seg);
  return lerpFrames(frames[i], frames[i + 1], seg - i);
}

// Posición de cada elemento que se mueve entre el fotograma anterior y el actual (rastro en el editor).
export function ghostsOf(prev, cur) {
  if (!prev || !cur) return [];
  const before = new Map(prev.els.filter(isMovable).map((e) => [e.id, e]));
  const out = [];
  for (const e of cur.els) {
    if (!isMovable(e)) continue;
    const p = before.get(e.id);
    if (p && Math.hypot(p.x - e.x, p.y - e.y) > 0.8) out.push({ ...e, from: { x: p.x, y: p.y }, to: { x: e.x, y: e.y } });
  }
  return out;
}

// ── Geometría ──────────────────────────────────────────────────────────────────────────────────────────────────────

// Orientación del campo en pantalla: vertical (ataca arriba o abajo) u horizontal (ataca a la izquierda o a la derecha). El
// campo se gira de cuarto en cuarto de vuelta; las fichas y los textos se quedan derechos.
export const ORIENTS = [
  { id: "v", label: "Vertical · ataca arriba", angle: 0 },
  { id: "vi", label: "Vertical · ataca abajo", angle: 180 },
  { id: "h", label: "Horizontal · ataca a la izquierda", angle: -90 },
  { id: "hi", label: "Horizontal · ataca a la derecha", angle: 90 },
];
export const orientOf = (id) => ORIENTS.find((o) => o.id === id)?.id || "v";
// Giro (grados, sentido de las agujas del reloj) que lleva el campo de «vertical, ataca arriba» a esa orientación
export const orientAngle = (o) => ORIENTS.find((x) => x.id === o)?.angle ?? 0;
export const isSideways = (o) => o === "h" || o === "hi";

export function toView(field, orient, p) {
  switch (orient) {
    case "h": return { x: p.y, y: field.w - p.x };
    case "vi": return { x: field.w - p.x, y: field.h - p.y };
    case "hi": return { x: field.h - p.y, y: p.x };
    default: return { x: p.x, y: p.y };
  }
}
export function fromView(field, orient, p) {
  switch (orient) {
    case "h": return { x: round(field.w - p.y), y: round(p.x) };
    case "vi": return { x: round(field.w - p.x), y: round(field.h - p.y) };
    case "hi": return { x: round(p.y), y: round(field.h - p.x) };
    default: return { x: round(p.x), y: round(p.y) };
  }
}
export const viewBox = (field, orient, m = 3) => (isSideways(orient) ? [-m, -m, field.h + 2 * m, field.w + 2 * m] : [-m, -m, field.w + 2 * m, field.h + 2 * m]);
// ── Zoom (cámara) ────────────────────────────────────────────────────────────────────────────────────────────────────
// `board.cam = { z, x, y }`: z = aumento (1 = todo el campo, hasta ZOOM_MAX) y x, y = centro de lo que se ve, en fracción (0–1)
// del recuadro completo. Se guarda en el dibujo: la imagen, el vídeo y las vistas de solo lectura salen con ese encuadre.
export const ZOOM_MAX = 4;
export const ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3, 4];
export function camOf(b) {
  const c = b?.cam;
  const z = Number(c?.z);
  if (!Number.isFinite(z) || z <= 1.001) return { z: 1, x: 0.5, y: 0.5 };
  const f = (v) => (Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : 0.5);
  return { z: Math.min(ZOOM_MAX, Math.round(z * 100) / 100), x: f(c.x), y: f(c.y) };
}
/** Recuadro visible [x, y, w, h] dentro del recuadro completo `vb`, sin salirse de él. */
export function camBox(vb, cam) {
  const { z, x, y } = camOf({ cam });
  if (z <= 1) return vb;
  const w = vb[2] / z, h = vb[3] / z;
  const cx = Math.min(vb[0] + vb[2] - w / 2, Math.max(vb[0] + w / 2, vb[0] + x * vb[2]));
  const cy = Math.min(vb[1] + vb[3] - h / 2, Math.max(vb[1] + h / 2, vb[1] + y * vb[3]));
  return [cx - w / 2, cy - h / 2, w, h];
}
/** Nuevo zoom manteniendo quieto el punto `at` (en unidades del dibujo; sin él, el centro de lo que se ve). */
export function zoomCam(vb, cam, z, at = null) {
  const cur = camOf({ cam });
  const nz = Math.min(ZOOM_MAX, Math.max(1, Math.round(z * 100) / 100));
  if (nz <= 1) return null;
  const box = camBox(vb, cur);
  const p = at || { x: box[0] + box[2] / 2, y: box[1] + box[3] / 2 };
  // el punto `p` queda en el mismo sitio de la pantalla: su posición relativa dentro del recuadro no cambia
  const rx = (p.x - box[0]) / box[2], ry = (p.y - box[1]) / box[3];
  const w = vb[2] / nz, h = vb[3] / nz;
  const nx = p.x - rx * w + w / 2, ny = p.y - ry * h + h / 2;
  return clampCam(vb, { z: nz, x: (nx - vb[0]) / vb[2], y: (ny - vb[1]) / vb[3] });
}
/** Mueve lo que se ve `dx, dy` unidades del dibujo. */
export function panCam(vb, cam, dx, dy) {
  const cur = camOf({ cam });
  if (cur.z <= 1) return null;
  return clampCam(vb, { ...cur, x: cur.x + dx / vb[2], y: cur.y + dy / vb[3] });
}
function clampCam(vb, cam) {
  const box = camBox(vb, cam);
  const r = (v) => Math.round(v * 10000) / 10000;
  return { z: cam.z, x: r((box[0] + box[2] / 2 - vb[0]) / vb[2]), y: r((box[1] + box[3] / 2 - vb[1]) / vb[3]) };
}

// ── Vista en perspectiva (estilo FM Studio) ─────────────────────────────────────────────────────────────────────────
// El campo se ve inclinado: el lado de arriba de la pantalla queda lejos (más estrecho) y el de abajo cerca. Es una homografía
// del plano del suelo (las rectas siguen siendo rectas): con s = escala en ese punto (de PERSP.far lejos a 1 cerca),
//   X = cx + (x − cx)·s     Y = Ybot − β·(1 − s)     y s = 1 / z, con z lineal en la profundidad.
// Las fichas, el balón y el material de pie se dibujan sin deformar, a escala s; el suelo (líneas, zonas, flechas) se proyecta.
// Inclinación fija por ahora (decidido con Nacho el 29/10/2026); para cambiarla, solo PERSP.
export const VIEWS = [{ id: "flat", label: "Vista plana" }, { id: "persp", label: "Perspectiva" }];
export const isPersp = (b) => b?.view === "persp";
export const PERSP = { far: 0.6, height: 0.58, top: 4.5, bottom: 2.5, chip: 1.35 };
// En perspectiva las fichas se ven algo más grandes (como en FM Studio): se agarran también por ese tamaño
export const perspBoost = (el) => (el?.k === "token" ? PERSP.chip : 1);
export function perspectiveOf(field, orient, m = 3) {
  const [x0, y0, W, H] = viewBox(field, orient, m);
  const cx = x0 + W / 2, zf = 1 / PERSP.far, Hp = H * PERSP.height;
  const top = y0, Ybot = top + PERSP.top + Hp, beta = Hp / (1 - PERSP.far);
  const scaleAt = (p) => 1 / (zf + (1 - zf) * ((p.y - y0) / H));
  const P = (p) => { const k = scaleAt(p); return { x: cx + (p.x - cx) * k, y: Ybot - beta * (1 - k) }; };
  const inv = (q) => {
    const k = Math.max(0.05, 1 - (Ybot - q.y) / beta);
    const z = 1 / k;
    return { x: cx + (q.x - cx) / k, y: y0 + ((z - zf) / (1 - zf)) * H };
  };
  // alto en pantalla de 1 m de suelo en profundidad (para aplastar lo que está tumbado en el suelo)
  const depthAt = (p) => Math.abs(P({ x: p.x, y: p.y + 0.5 }).y - P({ x: p.x, y: p.y - 0.5 }).y);
  return { P, inv, scaleAt, depthAt, vb: [x0, top, W, PERSP.top + Hp + PERSP.bottom] };
}

// Transformación SVG que lleva el campo (dibujado en vertical) a la orientación elegida
export function fieldTurn(field, orient) {
  switch (orient) {
    case "h": return `translate(0 ${field.w}) rotate(-90)`;
    case "vi": return `translate(${field.w} ${field.h}) rotate(180)`;
    case "hi": return `translate(${field.h} 0) rotate(90)`;
    default: return undefined;
  }
}
// Vector de campo → vector de pantalla (solo la parte lineal de toView)
export const viewVec = (orient, n) => (orient === "h" ? { x: n.y, y: -n.x } : orient === "vi" ? { x: -n.x, y: -n.y } : orient === "hi" ? { x: -n.y, y: n.x } : n);

// Punto de control de una flecha curva (por defecto, la mitad desplazada hacia un lado).
export const defaultControl = (a) => {
  const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
  return { cx: round(mx - (a.y2 - a.y1) * 0.25), cy: round(my + (a.x2 - a.x1) * 0.25) };
};

// Flecha con quiebros («poly»): puntos intermedios `via` entre el inicio y el final, unidos con tramos rectos.
export const hasVia = (a) => Array.isArray(a?.via) && a.via.length > 0;
export const arrowCorners = (a) => [{ x: a.x1, y: a.y1 }, ...(hasVia(a) ? a.via : []), { x: a.x2, y: a.y2 }];
// Un quiebro nuevo en mitad del tramo i (0 = del inicio al primer quiebro)
export function insertVia(a, i, at = null) {
  const c = arrowCorners(a);
  const k = Math.max(0, Math.min(i, c.length - 2));
  const p = at || { x: round((c[k].x + c[k + 1].x) / 2), y: round((c[k].y + c[k + 1].y) / 2) };
  const via = [...(a.via || [])];
  via.splice(k, 0, { x: round(p.x), y: round(p.y) });
  return { via, cx: undefined, cy: undefined };
}
// Quiebro con el que nace una flecha de la herramienta «con quiebros»: en mitad del recorrido, desplazado a un lado
export function firstBend(a) {
  const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
  return { x: round((a.x1 + a.x2) / 2 - dy * 0.22), y: round((a.y1 + a.y2) / 2 + dx * 0.22) };
}
export function removeVia(a, i) {
  const via = (a.via || []).filter((_, j) => j !== i);
  return { via: via.length ? via : undefined };
}
// Tipo de trazado: recta, curva (un punto de control) o con quiebros
export const arrowPath = (a) => (hasVia(a) ? "poly" : a.cx != null && a.cy != null ? "curve" : "straight");

// Puntos de la línea de una flecha (recta, curva o con quiebros) para pintarla ondulada, discontinua, etc.
export function arrowPoints(a, steps = 24) {
  if (hasVia(a)) {
    // cada tramo recto con pasos según su longitud; las esquinas quedan exactas
    const c = arrowCorners(a);
    const lens = c.slice(1).map((q, i) => Math.hypot(q.x - c[i].x, q.y - c[i].y));
    const total = lens.reduce((s, l) => s + l, 0) || 1;
    const out = [{ x: c[0].x, y: c[0].y }];
    lens.forEach((l, j) => {
      const n = Math.max(1, Math.round((steps * l) / total));
      for (let i = 1; i <= n; i++) out.push({ x: c[j].x + ((c[j + 1].x - c[j].x) * i) / n, y: c[j].y + ((c[j + 1].y - c[j].y) * i) / n });
    });
    return out;
  }
  const curved = a.cx != null && a.cy != null;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (curved) {
      const u = 1 - t;
      pts.push({ x: u * u * a.x1 + 2 * u * t * a.cx + t * t * a.x2, y: u * u * a.y1 + 2 * u * t * a.cy + t * t * a.y2 });
    } else pts.push({ x: a.x1 + (a.x2 - a.x1) * t, y: a.y1 + (a.y2 - a.y1) * t });
  }
  return pts;
}

// Línea ondulada (conducción de balón) siguiendo la trayectoria.
export function wavyPoints(pts, amp = 0.55, period = 2.6) {
  let acc = 0;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = pts[i - 1];
    const seg = Math.hypot(p.x - q.x, p.y - q.y);
    acc += seg;
    const nx = -(p.y - q.y) / (seg || 1), ny = (p.x - q.x) / (seg || 1);
    const off = Math.sin((acc / period) * Math.PI * 2) * amp * (i === pts.length - 1 ? 0 : 1);
    out.push({ x: p.x + nx * off, y: p.y + ny * off });
  }
  return out;
}

// Arriba en pantalla, expresado en coordenadas de campo.
export const upVec = (orient) => (orient === "h" ? { x: 1, y: 0 } : orient === "vi" ? { x: 0, y: 1 } : orient === "hi" ? { x: -1, y: 0 } : { x: 0, y: -1 });
export const AIR_MAX = 30;

// Lado hacia el que se curva el vuelo de un pase aéreo: perpendicular al recorrido, del lado «de arriba» de la pantalla
// (si el pase va recto hacia arriba o hacia abajo en pantalla, del lado derecho). Con altura negativa pasa al otro lado.
// Así el arco se distingue de la sombra en el suelo sea cual sea la dirección del pase.
export function liftNormal(a, orient = "v") {
  const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return upVec(orient);
  let n = { x: -dy / len, y: dx / len };
  const v = viewVec(orient, n);
  if (v.y > 1e-6 || (Math.abs(v.y) <= 1e-6 && v.x < 0)) n = { x: -n.x, y: -n.y };
  return n;
}

// Trayectoria de vuelo de un pase aéreo: la del suelo más una elevación en arco (máxima a mitad de recorrido).
export function arrowFlight(a, orient = "v", steps = 24) {
  const g = arrowPoints(a, steps);
  if (!a.air || !a.lift) return g;
  const u = liftNormal(a, orient);
  return g.map((p, i) => {
    const t = i / (g.length - 1);
    const h = a.lift * 4 * t * (1 - t);
    return { x: p.x + u.x * h, y: p.y + u.y * h };
  });
}

// Dirección de la punta de la flecha (al final de la trayectoria).
export function arrowHeading(a, orient = "v") {
  const pts = arrowFlight(a, orient, 24);
  const p = pts[pts.length - 1], q = pts[pts.length - 2];
  const dx = p.x - q.x, dy = p.y - q.y;
  const len = Math.hypot(dx, dy) || 1;
  return { ux: dx / len, uy: dy / len };
}

// Grosor, punta y trazo con sus valores por defecto (los dibujos antiguos no traen estos campos).
export const DASHES = [{ id: "solid", label: "Continua" }, { id: "dashed", label: "Discontinua" }, { id: "dotted", label: "Punteada" }];
export function arrowProps(a) {
  return {
    width: a.width ?? 0.55,
    dash: a.dash ?? (a.style === "pass" ? "dashed" : "solid"),
    wavy: a.wavy ?? a.style === "dribble",
    pointer: a.pointer || "arrow",
    border: !!a.border,
    alpha: a.alpha ?? 1,
  };
}
export const dashArray = (dash, w) => (dash === "dashed" ? `${(w * 3 + 1).toFixed(2)} ${(w * 2 + 0.5).toFixed(2)}` : dash === "dotted" ? `0.01 ${(w * 2.2 + 0.4).toFixed(2)}` : undefined);

// ── Zonas y conectores ─────────────────────────────────────────────────────────────────────────────────────────────────

// Zona de cuatro esquinas movibles: guarda sus esquinas en `pts` (en vez de x, y, w, h).
export const isQuad = (z) => z?.k === "zone" && z.shape === "quad" && Array.isArray(z.pts) && z.pts.length === 4;

// Rectángulo que ocupa una zona, sea del tipo que sea (w y h pueden ser negativos si se dibujó hacia arriba o a la izquierda)
export function zoneBox(z) {
  if (isQuad(z)) {
    const xs = z.pts.map((q) => q.x), ys = z.pts.map((q) => q.y);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }
  return { x0: Math.min(z.x, z.x + z.w), y0: Math.min(z.y, z.y + z.h), x1: Math.max(z.x, z.x + z.w), y1: Math.max(z.y, z.y + z.h) };
}

// Las cuatro esquinas de una zona (para pintarla o moverlas): las suyas si es libre, o las del rectángulo
export function zoneCorners(z) {
  if (isQuad(z)) return z.pts;
  const { x0, y0, x1, y1 } = zoneBox(z);
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

// Cambio de forma de una zona. Pasar a «libre» la deja como un rectángulo con las cuatro esquinas sueltas; volver a
// rectángulo o elipse usa el rectángulo que la envuelve.
export function zoneShapePatch(z, shape) {
  if (shape === "quad") {
    if (isQuad(z)) return {};
    return { shape: "quad", pts: zoneCorners(z).map((q) => ({ x: round(q.x), y: round(q.y) })), x: undefined, y: undefined, w: undefined, h: undefined };
  }
  if (isQuad(z)) {
    const { x0, y0, x1, y1 } = zoneBox(z);
    return { shape, x: round(x0), y: round(y0), w: round(x1 - x0), h: round(y1 - y0), pts: undefined };
  }
  return { shape };
}

const pointInPoly = (p, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};
const distToSeg = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y);
};
const distToPoly = (p, pts, closed) => {
  let m = Infinity;
  for (let i = 1; i < pts.length; i++) m = Math.min(m, distToSeg(p, pts[i - 1], pts[i]));
  if (closed && pts.length > 2) m = Math.min(m, distToSeg(p, pts[pts.length - 1], pts[0]));
  return m;
};

// Envolvente convexa (el contorno que abarca a todos los puntos)
export function convexHull(points) {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y).filter((p, i, arr) => !i || p.x !== arr[i - 1].x || p.y !== arr[i - 1].y);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list) => {
    const h = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

// Conector entre fichas: { k:'link', ids:[…], mode:'line'|'zone'|'mesh', color, width, dash, closed, fillOpacity, border }.
//  · línea  → cadena que une las fichas en el orden de `ids` (opcionalmente cerrada)
//  · zona   → contorno que envuelve a todas las fichas, relleno
//  · red    → todas las fichas unidas entre sí
// No guarda posiciones: la forma sale de dónde estén las fichas en cada momento, así que sigue sus movimientos.
export function linkProps(l) {
  const mode = l?.mode === "zone" || l?.mode === "mesh" ? l.mode : "line";
  return {
    mode,
    width: l?.width ?? (mode === "mesh" ? 0.22 : mode === "zone" ? 0.35 : 0.45),
    dash: l?.dash || "solid",
    closed: !!l?.closed,
    fillOpacity: l?.fillOpacity ?? 0.18,
    border: l?.border !== false,
  };
}

// Forma de un conector con las fichas tal como están en `els`; null si no quedan al menos dos.
//   { kind:'line', pts, closed } · { kind:'zone', poly } · { kind:'mesh', segs:[[a,b],…] }
export function linkShape(link, els) {
  const byId = new Map(els.filter(isLinkable).map((e) => [e.id, e]));
  const pts = (link.ids || []).map((id) => byId.get(id)).filter(Boolean).map((e) => ({ x: e.x, y: e.y }));
  if (pts.length < 2) return null;
  const { mode, closed } = linkProps(link);
  if (mode === "mesh") {
    const segs = [];
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) segs.push([pts[i], pts[j]]);
    return { kind: "mesh", segs };
  }
  if (mode === "zone") {
    const poly = convexHull(pts);
    if (poly.length >= 3) return { kind: "zone", poly };
    return { kind: "line", pts: poly, closed: false };
  }
  return { kind: "line", pts, closed: closed && pts.length > 2 };
}

// Orden natural para unir con una línea: de un extremo al otro de la fila (a lo largo de la dirección en la que más se
// reparten las fichas, tal como se ven en pantalla). items: [{ id, x, y }] → ids ordenados.
export function orderForLine(items, field, orient = "v") {
  if (items.length < 3) return items.map((e) => e.id);
  const v = items.map((e) => ({ id: e.id, ...toView(field, orient, e) }));
  const mx = v.reduce((a, p) => a + p.x, 0) / v.length, my = v.reduce((a, p) => a + p.y, 0) / v.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of v) { sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; sxy += (p.x - mx) * (p.y - my); }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let ux = Math.cos(ang), uy = Math.sin(ang);
  if (ux < -1e-6 || (Math.abs(ux) <= 1e-6 && uy < 0)) { ux = -ux; uy = -uy; }
  return v.map((p) => ({ id: p.id, t: (p.x - mx) * ux + (p.y - my) * uy })).sort((a, b) => a.t - b.t).map((p) => p.id);
}

// Elemento bajo el punto p (coordenadas de campo); de arriba abajo. opts: { orient, chip }
// ── Perspectiva: orden de pintado y «agarrar» con el puntero ─────────────────────────────────────────────────────────
export const isGroundEl = (el) => el.k === "link" || el.k === "arrow" || el.k === "zone";
const FLAT_ON_GROUND = new Set(["goal", "ladder", "hurdle"]);
export const lyingFlat = (el) => FLAT_ON_GROUND.has(el.k) || (el.k === "cone" && el.shape === "flat");
/** Orden en que se pinta (y se agarra, al revés): el de las capas y, en perspectiva sin capas a mano, lo de atrás antes. */
export function paintOrder(els, field, orient, persp) {
  const order = drawOrder(els);
  if (!persp || els.some((e) => Number.isFinite(e.z))) return order;
  const depth = (e) => (isGroundEl(e) ? 0 : toView(field, orient, e).y);
  return order.sort((a, b) => (RANK[a.k] ?? 2) - (RANK[b.k] ?? 2) || depth(a) - depth(b));
}
/** Qué hay bajo el puntero en perspectiva. `q` = punto en la pantalla (unidades del dibujo). Lo que se ve de pie se prueba en su
 *  propio dibujo (deshaciendo su escala) y lo del suelo, en el punto del suelo que hay debajo. `els` en orden de pintado. */
export function hitTestPersp(els, q, { field, orient, chip, persp }) {
  const ground = fromView(field, orient, persp.inv(q));
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    let p = ground;
    if (!isGroundEl(el)) {
      const c = toView(field, orient, el), P = persp.P(c), k = persp.scaleAt(c) * perspBoost(el);
      const ky = lyingFlat(el) ? persp.depthAt(c) : k;
      p = fromView(field, orient, { x: c.x + (q.x - P.x) / k, y: c.y + (q.y - P.y) / ky });
    }
    if (hitTest([el], p, { orient, chip })) return el;
  }
  return null;
}

export function hitTest(els, p, opts = {}) {
  const orient = opts.orient || "v";
  const chip = opts.chip || DEFAULT_CHIP;
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (el.k === "token" && Math.hypot(el.x - p.x, el.y - p.y) < Math.max(tokenR(chip, el) + 1.1, 2.2)) return el;
    if ((el.k === "ball" || el.k === "cone") && Math.hypot(el.x - p.x, el.y - p.y) < Math.max(2.8 * (Number(el.size) || 1) * 0.8, 2.2)) return el;
    if (el.k === "goal") {
      const a = ((el.rot || 0) * Math.PI) / 180;
      const dx = p.x - el.x, dy = p.y - el.y;
      const lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) < (el.w || 7.32) / 2 + 1.2 && Math.abs(ly) < 2.4) return el;
    }
    const mat = materialOf(el.k);
    if (mat) {
      const a = ((el.rot || 0) * Math.PI) / 180, k = Number(el.size) || 1;
      const dx = p.x - el.x, dy = p.y - el.y;
      const lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) < mat.hw * k + 0.9 && Math.abs(ly) < mat.hh * k + 0.9) return el;
    }
    if (el.k === "text") {
      const fs = Number(el.size) || 3;
      if (Math.abs(el.x - p.x) < Math.max(6, (el.text || "").length * fs * 0.3) && Math.abs(el.y - p.y) < Math.max(2.4, fs * 0.7)) return el;
    }
    if (el.k === "arrow") {
      const pts = arrowFlight(el, orient, 16);
      for (let j = 1; j < pts.length; j++) {
        const q = pts[j - 1], r = pts[j];
        const dx = r.x - q.x, dy = r.y - q.y;
        const t = Math.min(1, Math.max(0, ((p.x - q.x) * dx + (p.y - q.y) * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(q.x + t * dx - p.x, q.y + t * dy - p.y) < 2.2 + (arrowProps(el).width || 0) * 0.5) return el;
      }
    }
    if (el.k === "zone") {
      // Con relleno visible se agarra también por dentro (queda por debajo de lo demás); sin relleno, solo por el borde
      const filled = (el.fillOpacity ?? 1) > 0;
      if (isQuad(el)) {
        if ((filled && pointInPoly(p, el.pts)) || distToPoly(p, el.pts, true) < 1.5) return el;
      } else {
        const { x0, y0, x1, y1 } = zoneBox(el);
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        let outer, core;
        if (el.shape === "ellipse") {
          const ell = (m) => ((p.x - cx) / Math.max((x1 - x0) / 2 + m, 0.1)) ** 2 + ((p.y - cy) / Math.max((y1 - y0) / 2 + m, 0.1)) ** 2;
          outer = ell(1.5) <= 1;
          core = ell(-1.5) < 1;
        } else {
          outer = p.x >= x0 - 1.5 && p.x <= x1 + 1.5 && p.y >= y0 - 1.5 && p.y <= y1 + 1.5;
          core = p.x > x0 + 1.5 && p.x < x1 - 1.5 && p.y > y0 + 1.5 && p.y < y1 - 1.5;
        }
        if (outer && (filled || !core)) return el;
      }
    }
    if (el.k === "link") {
      const g = linkShape(el, els);
      if (!g) continue;
      const lp = linkProps(el);
      const tol = 2 + lp.width * 0.5;
      if (g.kind === "zone") {
        if ((lp.fillOpacity > 0 && pointInPoly(p, g.poly)) || distToPoly(p, g.poly, true) < tol) return el;
      } else if (g.kind === "line") {
        if (distToPoly(p, g.pts, g.closed) < tol) return el;
      } else if (g.segs.some(([a, b]) => distToSeg(p, a, b) < tol)) return el;
    }
  }
  return null;
}

// Mueve un elemento (todo su conjunto de coordenadas) dx, dy.
export function shiftElement(el, dx, dy) {
  if (el.k === "link") return el;
  if (isQuad(el)) return { ...el, pts: el.pts.map((q) => ({ x: round(q.x + dx), y: round(q.y + dy) })) };
  if (el.k === "arrow") {
    const o = { ...el, x1: round(el.x1 + dx), y1: round(el.y1 + dy), x2: round(el.x2 + dx), y2: round(el.y2 + dy) };
    if (el.cx != null) { o.cx = round(el.cx + dx); o.cy = round(el.cy + dy); }
    if (hasVia(el)) o.via = el.via.map((q) => ({ x: round(q.x + dx), y: round(q.y + dy) }));
    return o;
  }
  return { ...el, x: round(el.x + dx), y: round(el.y + dy) };
}

export const RANK = { zone: 0, link: 0.5, ladder: 0.9, goal: 1, cone: 1, hurdle: 1.1, pole: 1.2, dummy: 1.3, ball: 2, arrow: 3, token: 4, text: 5 };
export const byRank = (a, b) => (RANK[a.k] ?? 2) - (RANK[b.k] ?? 2);

// ── Capas (orden de dibujo) ────────────────────────────────────────────────────────────────────────────────────────
// Sin orden elegido, cada tipo de elemento tiene su capa por defecto (RANK: zonas al fondo, fichas arriba, textos encima de todo).
// Al subir o bajar un elemento, el fotograma pasa a guardar `z` en todos sus elementos (0 = el del fondo) y manda ese orden.
// El orden es de cada fotograma (como la posición): lo que se cambia en uno no toca los demás.
const layerOf = (el) => (Number.isFinite(el.z) ? el.z : RANK[el.k] ?? 2);
export const hasLayers = (els) => els.some((e) => Number.isFinite(e.z));
// Elementos de abajo arriba, tal como se dibujan (a igualdad de capa, en el orden en que están guardados)
export const drawOrder = (els) => els.map((e, i) => [e, i]).sort((a, b) => layerOf(a[0]) - layerOf(b[0]) || a[1] - b[1]).map(([e]) => e);
const withLayers = (list) => list.map((e, i) => (e.z === i ? e : { ...e, z: i }));

// Mete un elemento nuevo en su capa por defecto: encima de lo de su misma clase o inferior y debajo de lo que va por encima.
export function placeElement(els, el) {
  const { z: _z, ...bare } = el;
  if (!hasLayers(els)) return [...els, bare];
  const order = drawOrder(els);
  const rank = RANK[bare.k] ?? 2;
  let at = 0;
  for (let i = order.length - 1; i >= 0; i--) if ((RANK[order[i].k] ?? 2) <= rank) { at = i + 1; break; }
  return withLayers([...order.slice(0, at), bare, ...order.slice(at)]);
}

// Caja que ocupa un elemento en el campo (metros); null si no tiene sitio propio (los conectores salen de sus fichas).
export function elementBounds(el, chip = DEFAULT_CHIP) {
  const box = (cx, cy, hx, hy) => ({ x0: cx - hx, y0: cy - hy, x1: cx + hx, y1: cy + hy });
  const turned = (hw, hh, deg) => {
    const a = ((Number(deg) || 0) * Math.PI) / 180;
    return [Math.abs(hw * Math.cos(a)) + Math.abs(hh * Math.sin(a)), Math.abs(hw * Math.sin(a)) + Math.abs(hh * Math.cos(a))];
  };
  const k = Number(el?.size) || 1;
  if (!el) return null;
  if (el.k === "token") { const r = tokenR(chip, el); return box(el.x, el.y, r, r); }
  if (el.k === "ball") { const r = Math.max(0.7, chip * 0.55) * k; return box(el.x, el.y, r, r); }
  if (el.k === "cone") return box(el.x, el.y, 1.3 * k, 1.5 * k);
  if (el.k === "goal") {
    const gw = el.w || 7.32, gd = Math.max(1.1, Math.min(2.4, gw * 0.4));
    const [hx, hy] = turned(gw / 2, gd / 2, el.rot);
    return box(el.x, el.y, hx, hy);
  }
  const mat = materialOf(el.k);
  if (mat) { const [hx, hy] = turned(mat.hw * k, mat.hh * k, el.rot); return box(el.x, el.y, hx, hy); }
  if (el.k === "text") { const fs = Number(el.size) || 3; return box(el.x, el.y, Math.max(3, (el.text || "").length * fs * 0.3), fs * 0.7); }
  if (el.k === "arrow") {
    const xs = [el.x1, el.x2], ys = [el.y1, el.y2];
    if (el.cx != null) { xs.push(el.cx); ys.push(el.cy); }
    if (hasVia(el)) for (const q of el.via) { xs.push(q.x); ys.push(q.y); }
    return { x0: Math.min(...xs) - 0.8, y0: Math.min(...ys) - 0.8, x1: Math.max(...xs) + 0.8, y1: Math.max(...ys) + 0.8 };
  }
  if (el.k === "zone") return zoneBox(el);
  return null;
}
export const boundsOverlap = (a, b) => !!a && !!b && a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
export function unionBounds(list) {
  const l = list.filter(Boolean);
  if (!l.length) return null;
  return { x0: Math.min(...l.map((b) => b.x0)), y0: Math.min(...l.map((b) => b.y0)), x1: Math.max(...l.map((b) => b.x1)), y1: Math.max(...l.map((b) => b.y1)) };
}

// Sube o baja lo elegido en el orden de dibujo. where: «front» (encima de todo) · «back» (debajo de todo) · «up» / «down» (un
// nivel: pasa por encima / por debajo del siguiente elemento con el que se solapa, que es lo que se nota en pantalla).
export function moveLayer(board, index, ids, where, chip = DEFAULT_CHIP) {
  const frame = board.frames[index];
  const sel = new Set(ids);
  const order = drawOrder(frame.els);
  const chosen = order.filter((e) => sel.has(e.id));
  if (!chosen.length) return board;
  let list;
  if (where === "front") list = [...order.filter((e) => !sel.has(e.id)), ...chosen];
  else if (where === "back") list = [...chosen, ...order.filter((e) => !sel.has(e.id))];
  else {
    list = [...order];
    const dir = where === "up" ? 1 : -1;
    // empezando por lo que está más cerca del extremo hacia el que se mueve, para que el grupo conserve su orden
    for (const e of dir > 0 ? [...chosen].reverse() : chosen) {
      const i = list.findIndex((x) => x.id === e.id);
      const mine = elementBounds(e, chip);
      for (let j = i + dir; j >= 0 && j < list.length; j += dir) {
        if (sel.has(list[j].id) || !boundsOverlap(mine, elementBounds(list[j], chip))) continue;
        list.splice(i, 1);
        list.splice(j, 0, e);
        break;
      }
    }
  }
  if (list.every((e, i) => e.id === order[i].id)) return board; // nada que cambiar
  return setFrameEls(board, index, withLayers(list));
}

// ── Varios elementos a la vez ──────────────────────────────────────────────────────────────────────────────────────

// Lo que queda dentro de un recuadro (x, y, w, h; w y h pueden ser negativos): las piezas y textos por su posición, las flechas
// si empiezan y acaban dentro y las zonas si caben enteras. Los conectores no se eligen: van con sus fichas.
export function elementsInBox(els, box) {
  const x0 = Math.min(box.x, box.x + box.w), x1 = Math.max(box.x, box.x + box.w);
  const y0 = Math.min(box.y, box.y + box.h), y1 = Math.max(box.y, box.y + box.h);
  const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  return els.filter((e) => {
    if (e.k === "link") return false;
    if (e.k === "arrow") return inside(e.x1, e.y1) && inside(e.x2, e.y2);
    if (e.k === "zone") { const b = zoneBox(e); return inside(b.x0, b.y0) && inside(b.x1, b.y1); }
    return inside(e.x, e.y);
  }).map((e) => e.id);
}

// Aplica `fn` a los elementos de `ids`: lo que pasa de un fotograma a otro (fichas, material…) en todos los fotogramas y lo demás
// (flechas, zonas, textos) solo en el fotograma actual, igual que al cambiar un elemento suelto.
function mapElements(board, index, ids, fn) {
  const sel = new Set(ids);
  return { ...board, frames: board.frames.map((f, i) => ({ ...f, els: f.els.map((e) => (sel.has(e.id) && (i === index || isCarried(e)) ? fn(e) : e)) })) };
}
const clampTo = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Más grande o más pequeño (factor 1,15 / 0,87…): el tamaño de las fichas, balón, conos y material, el ancho de las porterías, el
// tamaño de los textos y el grosor de las flechas. Las zonas y los conectores no tienen tamaño propio.
export function resizeElements(board, index, ids, factor) {
  const r2 = (n) => Math.round(n * 100) / 100;
  return mapElements(board, index, ids, (e) => {
    const size = Number(e.size) || (e.k === "text" ? 3 : 1);
    if (e.k === "token") return { ...e, size: clampTo(r2(size * factor), 0.4, 3) };
    if (e.k === "ball" || e.k === "cone" || materialOf(e.k)) return { ...e, size: clampTo(r2(size * factor), 0.6, 2.2) };
    if (e.k === "text") return { ...e, size: clampTo(Math.round(size * factor * 10) / 10, 1.5, 10) };
    if (e.k === "goal") return { ...e, w: clampTo(Math.round((e.w || 7.32) * factor * 10) / 10, 1, 12) };
    if (e.k === "arrow") return { ...e, width: clampTo(Math.round(arrowProps(e).width * factor * 20) / 20, 0.2, 2) };
    return e;
  });
}

// Separa o junta lo elegido respecto a su centro (factor > 1 separa): cambia las posiciones, no el tamaño de cada cosa.
export function spreadElements(board, index, ids, factor) {
  const field = fieldOf(board.field);
  const sel = new Set(ids);
  const els = board.frames[index].els.filter((e) => sel.has(e.id) && e.k !== "link");
  const b = unionBounds(els.map((e) => elementBounds(e)));
  if (!b || els.length < 2) return board;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const sx = (x) => round(clampTo(cx + (x - cx) * factor, -2, field.w + 2));
  const sy = (y) => round(clampTo(cy + (y - cy) * factor, -2, field.h + 2));
  const move = (e) => {
    if (e.k === "arrow") {
      const o = { ...e, x1: sx(e.x1), y1: sy(e.y1), x2: sx(e.x2), y2: sy(e.y2) };
      if (e.cx != null) { o.cx = sx(e.cx); o.cy = sy(e.cy); }
      if (hasVia(e)) o.via = e.via.map((q) => ({ x: sx(q.x), y: sy(q.y) }));
      return o;
    }
    if (e.k === "zone" && isQuad(e)) return { ...e, pts: e.pts.map((q) => ({ x: sx(q.x), y: sy(q.y) })) };
    if (e.k === "zone") { const x = sx(e.x), y = sy(e.y); return { ...e, x, y, w: round(sx(e.x + e.w) - x), h: round(sy(e.y + e.h) - y) }; }
    return { ...e, x: sx(e.x), y: sy(e.y) };
  };
  return setFrameEls(board, index, board.frames[index].els.map((e) => (sel.has(e.id) && e.k !== "link" ? move(e) : e)));
}

// ── Alinear y repartir ─────────────────────────────────────────────────────────────────────────────────────────────
// Todo se hace «como se ve en pantalla»: «izquierda» es la izquierda del dibujo aunque el campo esté girado. Solo cambia las
// posiciones del fotograma actual (las de los demás fotogramas son suyas).

// Un desplazamiento en pantalla (dx a la derecha, dy hacia abajo) expresado en metros del campo según la orientación
export function viewDelta(orient, dx, dy) {
  switch (orient) {
    case "h": return { dx: -dy, dy: dx };
    case "vi": return { dx: -dx, dy: -dy };
    case "hi": return { dx: dy, dy: -dx };
    default: return { dx, dy };
  }
}
// Caja de un elemento tal como se ve en pantalla (x0,y0 = esquina de arriba a la izquierda); null si no tiene sitio propio
function viewBounds(board, el) {
  const b = elementBounds(el, chipOf(board));
  if (!b) return null;
  const field = fieldOf(board.field);
  const p = toView(field, board.orient, { x: b.x0, y: b.y0 }), q = toView(field, board.orient, { x: b.x1, y: b.y1 });
  return { x0: Math.min(p.x, q.x), y0: Math.min(p.y, q.y), x1: Math.max(p.x, q.x), y1: Math.max(p.y, q.y) };
}
// Elementos elegidos con su caja en pantalla (los conectores quedan fuera: salen de sus fichas)
function boxesOf(board, index, ids) {
  const sel = new Set(ids);
  return board.frames[index].els.filter((e) => sel.has(e.id)).map((e) => ({ el: e, b: viewBounds(board, e) })).filter((x) => x.b);
}
function shiftMany(board, index, moves) {
  const sel = new Map(moves.map((m) => [m.id, m]));
  let changed = false;
  const els = board.frames[index].els.map((e) => {
    const m = sel.get(e.id);
    if (!m || (!m.dx && !m.dy)) return e;
    const d = viewDelta(board.orient, m.dx, m.dy);
    changed = true;
    return shiftElement(e, d.dx, d.dy);
  });
  return changed ? setFrameEls(board, index, els) : board;
}

// Alinea lo elegido con un borde o con el centro del conjunto. where: left · hcenter · right · top · vcenter · bottom
export function alignElements(board, index, ids, where) {
  const items = boxesOf(board, index, ids);
  if (items.length < 2) return board;
  const u = unionBounds(items.map((x) => x.b));
  const r2 = (n) => Math.round(n * 100) / 100;
  const moves = items.map(({ el, b }) => {
    let dx = 0, dy = 0;
    if (where === "left") dx = u.x0 - b.x0;
    else if (where === "right") dx = u.x1 - b.x1;
    else if (where === "hcenter") dx = (u.x0 + u.x1) / 2 - (b.x0 + b.x1) / 2;
    else if (where === "top") dy = u.y0 - b.y0;
    else if (where === "bottom") dy = u.y1 - b.y1;
    else if (where === "vcenter") dy = (u.y0 + u.y1) / 2 - (b.y0 + b.y1) / 2;
    return { id: el.id, dx: r2(dx), dy: r2(dy) };
  });
  return shiftMany(board, index, moves);
}

// Reparte lo elegido con el mismo hueco entre cosas a lo ancho (axis «h») o a lo alto (axis «v»); lo de los extremos no se mueve.
// Hacen falta al menos tres.
export function distributeElements(board, index, ids, axis) {
  const items = boxesOf(board, index, ids);
  if (items.length < 3) return board;
  const lo = axis === "h" ? "x0" : "y0", hi = axis === "h" ? "x1" : "y1";
  const sorted = items.map((x, i) => ({ ...x, i })).sort((a, b) => (a.b[lo] + a.b[hi]) - (b.b[lo] + b.b[hi]) || a.i - b.i);
  const first = sorted[0], end = sorted[sorted.length - 1];
  const span = end.b[hi] - first.b[lo];
  const used = sorted.reduce((s, x) => s + (x.b[hi] - x.b[lo]), 0);
  const gap = (span - used) / (sorted.length - 1);
  const r2 = (n) => Math.round(n * 100) / 100;
  let at = first.b[lo];
  const moves = sorted.map((x) => {
    const d = r2(at - x.b[lo]);
    at += x.b[hi] - x.b[lo] + gap;
    return axis === "h" ? { id: x.el.id, dx: d, dy: 0 } : { id: x.el.id, dx: 0, dy: d };
  });
  return shiftMany(board, index, moves);
}

// Sube o baja lo elegido un puesto de la lista de capas (sin fijarse en si se solapan): dir +1 hacia delante, -1 hacia atrás
export function stepLayer(board, index, ids, dir) {
  const sel = new Set(ids);
  const order = drawOrder(board.frames[index].els);
  const list = [...order];
  const at = list.map((_, i) => i);
  for (const i of dir > 0 ? at.reverse() : at) {
    const j = i + dir;
    if (!sel.has(list[i].id) || j < 0 || j >= list.length || sel.has(list[j].id)) continue;
    [list[i], list[j]] = [list[j], list[i]];
  }
  if (list.every((e, i) => e.id === order[i].id)) return board;
  return setFrameEls(board, index, withLayers(list));
}

// Pone una cosa en un puesto concreto de la lista de capas (0 = la del fondo): lo que se hace al arrastrar una fila de la lista
export function moveLayerTo(board, index, id, pos) {
  const order = drawOrder(board.frames[index].els);
  const from = order.findIndex((e) => e.id === id);
  if (from < 0) return board;
  const to = clampTo(Math.round(pos), 0, order.length - 1);
  if (to === from) return board;
  const list = [...order];
  const [e] = list.splice(from, 1);
  list.splice(to, 0, e);
  return setFrameEls(board, index, withLayers(list));
}

// Mueve lo elegido con las flechas del teclado: dx a la derecha y dy hacia abajo, en metros y «como se ve» en pantalla. No lo saca
// del campo (se queda a 2 m del borde como mucho) y solo cambia el fotograma actual, igual que arrastrarlo.
export function nudgeElements(board, index, ids, dx, dy) {
  const field = fieldOf(board.field);
  const items = boxesOf(board, index, ids);
  if (!items.length) return board;
  const u = unionBounds(items.map((x) => elementBounds(x.el, chipOf(board))));
  const d = viewDelta(board.orient, dx, dy);
  const ddx = clampTo(d.dx, Math.min(0, -2 - u.x0), Math.max(0, field.w + 2 - u.x1));
  const ddy = clampTo(d.dy, Math.min(0, -2 - u.y0), Math.max(0, field.h + 2 - u.y1));
  if (!ddx && !ddy) return board;
  const sel = new Set(items.map((x) => x.el.id));
  return setFrameEls(board, index, board.frames[index].els.map((e) => (sel.has(e.id) ? shiftElement(e, ddx, ddy) : e)));
}

// Un mismo color para todo lo elegido (en las zonas es el relleno)
export function recolorElements(board, index, ids, color) {
  return mapElements(board, index, ids, (e) => {
    if (e.k === "zone") return { ...e, fill: color, ...(e.fillOpacity == null ? { fillOpacity: 0.35 } : {}) };
    return { ...e, color };
  });
}
// Equipo y pies de las fichas elegidas (en todos los fotogramas)
export const setTeamOf = (board, index, ids, team) => mapElements(board, index, ids, (e) => (e.k === "token" ? { ...e, team } : e));
export function setFeetOf(board, index, ids, on) {
  return mapElements(board, index, ids, (e) => {
    if (e.k !== "token") return e;
    if (on) return { ...e, feet: true };
    const { feet: _f, face: _a, ...rest } = e;
    return rest;
  });
}
// Peto (color) en las fichas elegidas; sin color, se lo quita. Como todo lo de las fichas, vale para todos los fotogramas.
export function setBibOf(board, index, ids, color) {
  return mapElements(board, index, ids, (e) => {
    if (e.k !== "token") return e;
    if (color) return { ...e, bib: color };
    const { bib: _b, ...rest } = e;
    return rest;
  });
}
export const removeElements = (board, index, ids, opts) => ids.reduce((b, id) => removeElement(b, index, id, opts), board);


// Orientación de varias fichas a la vez (solo el fotograma actual, como girar una con su punto naranja): `turn` = girar todas
// esos grados; `toward` = que todas miren hacia ese ángulo de la PANTALLA (0 = arriba, 90 = derecha…), sea cual sea la orientación del campo.
// El material con giro (porterías, picas, vallas, escaleras, maniquíes) gira con ellas. Las fichas sin pies no muestran hacia dónde miran.
export function turnElements(board, index, ids, { turn = null, toward = null } = {}) {
  const sel = new Set(ids);
  const base = orientAngle(board.orient);
  const norm = (a) => ((Math.round(a) % 360) + 360) % 360;
  let changed = false;
  const els = board.frames[index].els.map((e) => {
    if (!sel.has(e.id)) return e;
    const key = e.k === "token" ? "face" : materialOf(e.k) || e.k === "goal" ? "rot" : null;
    if (!key) return e;
    const cur = key === "face" ? faceOf(e) : Number(e.rot) || 0;
    const next = norm(toward != null ? toward - base : cur + (turn || 0));
    if (next === norm(cur) && e[key] != null) return e;
    changed = true;
    return { ...e, [key]: next };
  });
  return changed ? setFrameEls(board, index, els) : board;
}
