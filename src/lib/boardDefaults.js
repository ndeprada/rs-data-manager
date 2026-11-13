// Predeterminados de la pizarra de cada persona (03/11/2026, Nacho: «establecer un tamaño como el predefinido… cuando inicio una
// tarea empiezan los elementos demasiado grandes… y el color y la transparencia de una zona, que siempre me inicie así»).
// Solo usa board.js: se prueba en Node.
import { teamsOf } from "./board.js";
//   { chipSize?: número (radio de las fichas en m), teams?: { [id]: {aspecto del equipo} }, brush?: { [herramienta]: {aspecto} } }
// Se guarda en el perfil de la persona (User.board_defaults) y una copia en este navegador.

export const DEFAULT_KEYS = ["bends", "curved", "shape", "color", "color2", "pattern", "size", "w", "rungs", "width", "dash", "wavy", "border", "borderColor", "pointer", "fill", "fillOpacity", "stroke", "strokeWidth", "font", "bold", "lift", "bg", "bgOpacity", "alpha", "edge", "innerFs", "topFs", "labelFs", "fnFs", "fnPos", "fnColor", "innerFont", "innerBold", "innerColor", "innerHalo", "labelFont", "labelBold", "labelColor", "labelHalo"];
export const TEAM_KEYS = ["color", "pattern", "color2", "stroke", "kit", "trim", "edge"];
const TOOLS = new Set(["ball", "cone", "goal", "pole", "hurdle", "ladder", "dummy", "text", "zone", "quad", "move", "pass", "air", "dribble", "line", "link"]);

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const pick = (o, keys) => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => keys.includes(k) && v !== undefined && v !== null && (typeof v !== "object")));

// Limpia lo que venga (del perfil o del navegador): solo campos conocidos, sin objetos raros
export function cleanDefaults(d) {
  if (!d || typeof d !== "object") return {};
  const out = {};
  if (isNum(d.chipSize) && d.chipSize >= 0.3 && d.chipSize <= 3.2) out.chipSize = Math.round(d.chipSize * 100) / 100;
  if (d.brush && typeof d.brush === "object") {
    const b = {};
    for (const [t, v] of Object.entries(d.brush)) if (TOOLS.has(t)) { const c = pick(v, DEFAULT_KEYS); if (Object.keys(c).length) b[t] = c; }
    if (Object.keys(b).length) out.brush = b;
  }
  const sp = cleanSpBase(d.sp);
  if (sp) out.sp = sp;
  if (d.teams && typeof d.teams === "object") {
    const t = {};
    for (const [id, v] of Object.entries(d.teams)) if (/^[a-z0-9]{1,6}$/i.test(id)) { const c = pick(v, TEAM_KEYS); if (Object.keys(c).length) t[id] = c; }
    if (Object.keys(t).length) out.teams = t;
  }
  return out;
}

// Herramienta a la que corresponde un elemento (para guardar su aspecto)
export function toolOfElement(el) {
  if (!el) return null;
  if (el.k === "arrow") return el.air ? "air" : el.style || "move";
  if (el.k === "zone") return Array.isArray(el.pts) ? "quad" : "zone";
  return TOOLS.has(el.k) ? el.k : null;
}

// Guarda el aspecto de un elemento como predeterminado de su herramienta (o, si es ficha, el tamaño de las fichas y su equipo)
export function withElementDefault(defs, el, { chipSize, team } = {}) {
  const d = cleanDefaults(defs);
  if (el?.k === "token") {
    const out = { ...d };
    if (isNum(chipSize)) out.chipSize = chipSize;
    if (team?.id) out.teams = { ...(d.teams || {}), [team.id]: pick(team, TEAM_KEYS) };
    return cleanDefaults(out);
  }
  const tool = toolOfElement(el);
  if (!tool) return d;
  const style = pick(el, DEFAULT_KEYS);
  if (el.k !== "goal") delete style.w; // en las zonas «w» es el ancho dibujado, no un aspecto
  if (el.k === "arrow") { style.curved = el.cx != null; style.bends = Array.isArray(el.via) && el.via.length > 0; }
  return cleanDefaults({ ...d, brush: { ...(d.brush || {}), [tool]: style } });
}

// Pinceles de partida del editor: los de siempre + los predeterminados de la persona
export function brushWithDefaults(base, defs) {
  const d = cleanDefaults(defs);
  const out = { ...base };
  for (const [t, v] of Object.entries(d.brush || {})) out[t] = { ...(base[t] || {}), ...v };
  return out;
}

// Un dibujo vacío (sin nada en ningún fotograma) toma el tamaño de fichas y los colores de equipo predeterminados
export const isEmptyBoard = (board) => (board?.frames || []).every((f) => !(f.els || []).length);
export function applyBoardDefaults(board, defs) {
  const d = cleanDefaults(defs);
  if (!isEmptyBoard(board) || (!d.chipSize && !d.teams)) return board;
  const out = { ...board };
  if (d.chipSize) out.chipSize = d.chipSize;
  if (d.teams) out.teams = teamsOf(board).map((t) => (d.teams[t.id] ? { ...t, ...d.teams[t.id] } : t));
  return out;
}

// Resumen corto para «Campo y ajustes»
export function describeDefaults(defs) {
  const d = cleanDefaults(defs);
  const names = { ball: "balón", cone: "cono", goal: "portería", pole: "pica", hurdle: "valla", ladder: "escalera", dummy: "maniquí", text: "texto", zone: "zona", quad: "zona libre", move: "desplazamiento", pass: "pase", air: "pase aéreo", dribble: "conducción", link: "unir fichas" };
  const out = [];
  if (d.chipSize) out.push(`fichas al ${Math.round((d.chipSize / 1.5) * 100)} %`);
  if (d.teams) out.push(`colores de ${Object.keys(d.teams).length === 1 ? "1 equipo" : `${Object.keys(d.teams).length} equipos`}`);
  for (const t of Object.keys(d.brush || {})) out.push(names[t] || t);
  if (d.sp) out.push("vista base de balón parado");
  return out;
}

const LS = "rs_board_defaults";
export function readLocalDefaults() {
  try { return cleanDefaults(JSON.parse(localStorage.getItem(LS) || "{}")); } catch { return {}; }
}
export function writeLocalDefaults(d) {
  try { localStorage.setItem(LS, JSON.stringify(cleanDefaults(d))); } catch { /* sin almacenamiento */ }
}

// ── Vista base de las jugadas nuevas de balón parado (07/11/2026, Nacho: «quiero poder editar qué campo ver como predeterminado,
// el tamaño de las letras, colores de equipo etc, y que se me quede guardado para la próxima vez que cree una jugada»).
//   sp = { board: {campo, vista, orientación, modo visual, césped, líneas, gradas, nombre en dos líneas, tamaño de fichas},
//          teams: { a|b: {aspecto del equipo + nombre} }, chips: { a|b: {letra de las fichas: tamaños, tipografía, función…} } }
export const SP_BASE_BOARD_KEYS = ["field", "look", "view", "view3d", "orient", "grass", "marks", "lineColor", "nameStack", "stands", "ads", "chipSize", "labelChip"];
export const SP_BASE_CHIP_KEYS = ["innerFs", "topFs", "labelFs", "fnFs", "innerFont", "innerBold", "innerColor", "innerHalo", "labelFont", "labelBold", "labelColor", "labelHalo", "fnPos", "fnColor", "labelBg", "labelBgOpacity", "edge", "stroke"];
const prim = (v) => (typeof v === "string" ? v.length <= 40 : typeof v === "boolean" || isNum(v));
const pickPrim = (o, keys) => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => keys.includes(k) && prim(v)));
export function cleanSpBase(x) {
  if (!x || typeof x !== "object") return null;
  const out = {};
  const b = pickPrim(x.board, SP_BASE_BOARD_KEYS);
  if (b.field && !["half", "tq", "full"].includes(b.field)) delete b.field;
  if (b.chipSize != null && !(b.chipSize >= 0.3 && b.chipSize <= 3.2)) delete b.chipSize;
  if (Object.keys(b).length) out.board = b;
  for (const part of ["teams", "chips"]) {
    const keys = part === "teams" ? [...TEAM_KEYS, "name"] : SP_BASE_CHIP_KEYS;
    const t = {};
    for (const id of ["a", "b"]) { const c = pickPrim(x[part]?.[id], keys); if (Object.keys(c).length) t[id] = c; }
    if (Object.keys(t).length) out[part] = t;
  }
  return Object.keys(out).length ? out : null;
}

// Lo guardado en esta sesión manda (el perfil que se cargó al entrar ya no está al día después de guardar)
let session = null;
export function currentDefaults(user) {
  return session || cleanDefaults(user?.board_defaults || readLocalDefaults());
}
export function rememberDefaults(d) {
  session = cleanDefaults(d);
  writeLocalDefaults(session);
  return session;
}
