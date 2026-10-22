// Pizarra de dibujo y animación (motor común de tareas, tácticas y balón parado).
// Se guarda como datos, no como imagen: { v:2, field, look, orient, frames:[{ id, els:[…] }] }.
// Cada fotograma es una foto completa de lo que hay en el campo. Los elementos que se mueven (fichas, balón, conos,
// porterías) conservan su id entre fotogramas, así que al reproducir se interpola su posición; flechas, zonas y textos
// pertenecen a su fotograma y se funden de uno al siguiente.
// Unidades de campo: metros. Eje x a lo ancho, eje y a lo largo (portería a atacar arriba, y=0).

export const BOARD_VERSION = 2;
export const MAX_FRAMES = 12;

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

// Modos visuales: pensados para pantalla y para imprimir sin gastar tinta.
export const LOOKS = [
  { id: "blanco", label: "Campo blanco, fichas de color" },
  { id: "color", label: "Campo verde" },
  { id: "bn", label: "Blanco y negro (impresión)" },
];
export const DEFAULT_LOOK = "blanco";
export const lookOf = (id) => LOOKS.find((l) => l.id === id)?.id || DEFAULT_LOOK;

// Hasta cinco equipos, cada uno con su nombre y su color (cualquiera). Los ids se mantienen por compatibilidad.
export const DEFAULT_TEAMS = [
  { id: "a", name: "Equipo A", color: "#73000A" },
  { id: "b", name: "Equipo B", color: "#2563eb" },
  { id: "c", name: "Comodín", color: "#f59e0b" },
  { id: "gk", name: "Portero", color: "#16a34a" },
  { id: "n", name: "Neutro", color: "#374151" },
];
export const TEAMS = DEFAULT_TEAMS.map((t) => ({ id: t.id, label: t.name }));
export const teamsOf = (board) => DEFAULT_TEAMS.map((d) => ({ ...d, ...(board?.teams || []).find((t) => t?.id === d.id) }));
export const teamOf = (board, id) => teamsOf(board).find((t) => t.id === id) || DEFAULT_TEAMS[0];
export const tokenColor = (board, el) => el.color || teamOf(board, el.team).color;

// Radio base de las fichas (metros) y tamaño de cada una (múltiplo del base)
export const DEFAULT_CHIP = 1.5;
export const CHIP_RANGE = [0.8, 3.2];
export const chipOf = (board) => Math.min(CHIP_RANGE[1], Math.max(CHIP_RANGE[0], Number(board?.chipSize) || DEFAULT_CHIP));
export const tokenR = (base, el) => base * (Number(el?.size) || 1);

export const FONTS = [
  { id: "sans", label: "Normal", css: "Arial, Helvetica, sans-serif" },
  { id: "cond", label: "Condensada", css: "'IBM Plex Sans Condensed', 'Arial Narrow', Arial, sans-serif" },
  { id: "serif", label: "Con serifa", css: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Máquina", css: "'Courier New', monospace" },
  { id: "hand", label: "Manuscrita", css: "'Segoe Print', 'Comic Sans MS', cursive" },
  { id: "club", label: "Racing Sarrià", css: "'Racing Sarria', Impact, sans-serif" },
];
export const fontOf = (id) => FONTS.find((f) => f.id === id)?.css || FONTS[0].css;

// Medidas de portería (anchura entre postes, metros)
export const GOAL_SIZES = [
  { id: "mini", label: "Mini", w: 2 },
  { id: "f7", label: "Fútbol 7", w: 6 },
  { id: "f11", label: "Grande", w: 7.32 },
];

const MOVABLE = new Set(["token", "ball", "cone", "goal"]);
export const isMovable = (el) => MOVABLE.has(el?.k);

let counter = 0;
export const newId = () => `e${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const round = (n) => Math.round(n * 10) / 10;
const clone = (o) => JSON.parse(JSON.stringify(o));

export function emptyBoard(field = "half") {
  return { v: BOARD_VERSION, field, look: DEFAULT_LOOK, orient: "v", frames: [{ id: newId(), els: [] }] };
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
      orient: value.orient === "h" ? "h" : "v",
      ...(Array.isArray(value.teams) ? { teams: value.teams } : {}),
      ...(value.chipSize ? { chipSize: value.chipSize } : {}),
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

// ── Fotogramas ─────────────────────────────────────────────────────────────────────────────────────────────────────

// Nuevo fotograma detrás del indicado: copia lo que se mueve (con los mismos ids) y deja vacías las anotaciones.
export function addFrame(board, after = board.frames.length - 1) {
  if (board.frames.length >= MAX_FRAMES) return { board, index: after };
  const src = board.frames[Math.min(Math.max(after, 0), board.frames.length - 1)];
  const frame = { id: newId(), els: clone(src.els.filter(isMovable)) };
  const frames = [...board.frames];
  frames.splice(after + 1, 0, frame);
  return { board: { ...board, frames }, index: after + 1 };
}

// Copia exacta del fotograma (también las anotaciones, con ids nuevos).
export function duplicateFrame(board, index) {
  if (board.frames.length >= MAX_FRAMES) return { board, index };
  const src = board.frames[index];
  const els = clone(src.els).map((e) => (isMovable(e) ? e : { ...e, id: newId() }));
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
      return o;
    }
    if (e.k === "zone") return { ...e, x: round(e.x * kx), y: round(e.y * ky), w: round(e.w * kx), h: round(e.h * ky) };
    return { ...e, x: round(e.x * kx), y: round(e.y * ky) };
  };
  return { ...board, field: to.id, frames: board.frames.map((f) => ({ ...f, els: f.els.map(sc) })) };
}

export const setFrameEls = (board, index, els) => ({
  ...board,
  frames: board.frames.map((f, i) => (i === index ? { ...f, els } : f)),
});

// Añade un elemento. Lo que se mueve entra en todos los fotogramas en la misma posición (forma parte del ejercicio);
// flechas, zonas y textos solo en el fotograma actual.
export function addElement(board, index, el) {
  if (!isMovable(el)) return setFrameEls(board, index, [...board.frames[index].els, el]);
  return { ...board, frames: board.frames.map((f) => ({ ...f, els: [...f.els, clone(el)] })) };
}

// Quita un elemento: de todos los fotogramas (lo habitual) o solo del actual.
export function removeElement(board, index, id, { onlyHere = false } = {}) {
  const el = board.frames[index]?.els.find((e) => e.id === id);
  if (!el) return board;
  if (onlyHere || !isMovable(el)) return setFrameEls(board, index, board.frames[index].els.filter((e) => e.id !== id));
  return { ...board, frames: board.frames.map((f) => ({ ...f, els: f.els.filter((e) => e.id !== id) })) };
}

export const patchElement = (board, index, id, patch, { allFrames = false } = {}) => ({
  ...board,
  frames: board.frames.map((f, i) => (allFrames || i === index ? { ...f, els: f.els.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : f)),
});

// Mismo cambio en todos los fotogramas para lo que es de identidad (nombre, equipo) y no de posición.
export const IDENTITY_PATCH = ["label", "team"];

// ── Animación ──────────────────────────────────────────────────────────────────────────────────────────────────────

export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

// Estado intermedio entre dos fotogramas (t de 0 a 1). Devuelve elementos con `opacity`.
export function lerpFrames(a, b, t) {
  const k = ease(Math.min(1, Math.max(0, t)));
  const out = [];
  const bById = new Map(b.els.filter(isMovable).map((e) => [e.id, e]));
  for (const e of a.els) {
    if (isMovable(e)) {
      const n = bById.get(e.id);
      if (n) {
        const arrow = { ...e, x: e.x + (n.x - e.x) * k, y: e.y + (n.y - e.y) * k, opacity: 1 };
        out.push(arrow);
        bById.delete(e.id);
      } else out.push({ ...e, opacity: 1 - k });
    } else out.push({ ...e, opacity: 1 - k });
  }
  for (const e of b.els) {
    if (!isMovable(e)) out.push({ ...e, opacity: k });
    else if (bById.has(e.id)) out.push({ ...e, opacity: k });
  }
  return out;
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

// Vista horizontal: el campo se gira un cuarto de vuelta; las fichas y los textos se quedan derechos.
export const toView = (field, orient, p) => (orient === "h" ? { x: p.y, y: field.w - p.x } : { x: p.x, y: p.y });
export const fromView = (field, orient, p) => (orient === "h" ? { x: round(field.w - p.y), y: round(p.x) } : { x: round(p.x), y: round(p.y) });
export const viewBox = (field, orient) => (orient === "h" ? [-3, -3, field.h + 6, field.w + 6] : [-3, -3, field.w + 6, field.h + 6]);

// Punto de control de una flecha curva (por defecto, la mitad desplazada hacia un lado).
export const defaultControl = (a) => {
  const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
  return { cx: round(mx - (a.y2 - a.y1) * 0.25), cy: round(my + (a.x2 - a.x1) * 0.25) };
};

// Puntos de la línea de una flecha (recta o curva) para pintarla ondulada, discontinua, etc.
export function arrowPoints(a, steps = 24) {
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
export const upVec = (orient) => (orient === "h" ? { x: 1, y: 0 } : { x: 0, y: -1 });
export const AIR_MAX = 30;

// Lado hacia el que se curva el vuelo de un pase aéreo: perpendicular al recorrido, del lado «de arriba» de la pantalla
// (si el pase va recto hacia arriba o hacia abajo en pantalla, del lado derecho). Con altura negativa pasa al otro lado.
// Así el arco se distingue de la sombra en el suelo sea cual sea la dirección del pase.
export function liftNormal(a, orient = "v") {
  const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return upVec(orient);
  let n = { x: -dy / len, y: dx / len };
  const v = orient === "h" ? { x: n.y, y: -n.x } : n;
  if (v.y > 1e-6 || (Math.abs(v.y) <= 1e-6 && v.x < 0)) n = { x: -n.x, y: -n.y };
  return n;
}

// Trayectoria de vuelo de un pase aéreo: la del suelo más una elevación en arco (máxima a mitad de recorrido).
export function arrowFlight(a, orient = "v", steps = 24) {
  const g = arrowPoints(a, steps);
  if (!a.air || !a.lift) return g;
  const u = liftNormal(a, orient);
  return g.map((p, i) => {
    const t = i / steps;
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

// Elemento bajo el punto p (coordenadas de campo); de arriba abajo. opts: { orient, chip }
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
      const x0 = Math.min(el.x, el.x + el.w), x1 = Math.max(el.x, el.x + el.w), y0 = Math.min(el.y, el.y + el.h), y1 = Math.max(el.y, el.y + el.h);
      const inside = p.x >= x0 - 1.5 && p.x <= x1 + 1.5 && p.y >= y0 - 1.5 && p.y <= y1 + 1.5;
      const core = p.x > x0 + 1.5 && p.x < x1 - 1.5 && p.y > y0 + 1.5 && p.y < y1 - 1.5;
      if (inside && !core) return el;
    }
  }
  return null;
}

// Mueve un elemento (todo su conjunto de coordenadas) dx, dy.
export function shiftElement(el, dx, dy) {
  if (el.k === "arrow") {
    const o = { ...el, x1: round(el.x1 + dx), y1: round(el.y1 + dy), x2: round(el.x2 + dx), y2: round(el.y2 + dy) };
    if (el.cx != null) { o.cx = round(el.cx + dx); o.cy = round(el.cy + dy); }
    return o;
  }
  return { ...el, x: round(el.x + dx), y: round(el.y + dy) };
}

export const RANK = { zone: 0, goal: 1, cone: 1, ball: 2, arrow: 3, token: 4, text: 5 };
export const byRank = (a, b) => (RANK[a.k] ?? 2) - (RANK[b.k] ?? 2);
