// Pizarra de dibujo y animación (motor común de tareas, tácticas y balón parado).
// Se guarda como datos, no como imagen: { v:2, field, look, orient, frames:[{ id, els:[…] }] }.
// Cada fotograma es una foto completa de lo que hay en el campo. Los elementos que se mueven (fichas, balón, conos,
// porterías) conservan su id entre fotogramas, así que al reproducir se interpola su posición; flechas, zonas y textos
// pertenecen a su fotograma y se funden de uno al siguiente.
// Unidades de campo: metros. Eje x a lo ancho, eje y a lo largo (portería a atacar arriba, y=0).

export const BOARD_VERSION = 2;
export const MAX_FRAMES = 12;

export const FIELDS = [
  { id: "full", label: "Campo completo", w: 68, h: 105 },
  { id: "half", label: "Medio campo", w: 68, h: 52.5 },
  { id: "f7", label: "Fútbol 7", w: 45, h: 65 },
  { id: "free", label: "Espacio libre", w: 68, h: 52.5 },
];
export const fieldOf = (id) => FIELDS.find((f) => f.id === id) || FIELDS[1];

// Modos visuales: pensados para pantalla y para imprimir sin gastar tinta.
export const LOOKS = [
  { id: "blanco", label: "Campo blanco, fichas de color" },
  { id: "color", label: "Campo verde" },
  { id: "bn", label: "Blanco y negro (impresión)" },
];
export const DEFAULT_LOOK = "blanco";
export const lookOf = (id) => LOOKS.find((l) => l.id === id)?.id || DEFAULT_LOOK;

export const TEAMS = [
  { id: "a", label: "Equipo A" },
  { id: "b", label: "Equipo B" },
  { id: "c", label: "Comodín" },
  { id: "gk", label: "Portero" },
  { id: "n", label: "Neutro" },
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
    if (p && Math.hypot(p.x - e.x, p.y - e.y) > 0.8) out.push({ id: e.id, k: e.k, team: e.team, from: { x: p.x, y: p.y }, to: { x: e.x, y: e.y } });
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

// Dirección de la punta de la flecha (al final de la trayectoria).
export function arrowHeading(a) {
  const curved = a.cx != null && a.cy != null;
  const fx = curved ? a.cx : a.x1, fy = curved ? a.cy : a.y1;
  const dx = a.x2 - fx, dy = a.y2 - fy;
  const len = Math.hypot(dx, dy) || 1;
  return { ux: dx / len, uy: dy / len };
}

// Elemento bajo el punto p (coordenadas de campo); de arriba abajo.
export function hitTest(els, p) {
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (el.k === "token" && Math.hypot(el.x - p.x, el.y - p.y) < 3.6) return el;
    if ((el.k === "ball" || el.k === "cone") && Math.hypot(el.x - p.x, el.y - p.y) < 2.8) return el;
    if (el.k === "goal" && Math.abs(el.x - p.x) < 4.2 && Math.abs(el.y - p.y) < 2.4) return el;
    if (el.k === "text" && Math.abs(el.x - p.x) < 6 && Math.abs(el.y - p.y) < 2.4) return el;
    if (el.k === "arrow") {
      const pts = arrowPoints(el, 16);
      for (let j = 1; j < pts.length; j++) {
        const q = pts[j - 1], r = pts[j];
        const dx = r.x - q.x, dy = r.y - q.y;
        const t = Math.min(1, Math.max(0, ((p.x - q.x) * dx + (p.y - q.y) * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(q.x + t * dx - p.x, q.y + t * dy - p.y) < 2.2) return el;
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
