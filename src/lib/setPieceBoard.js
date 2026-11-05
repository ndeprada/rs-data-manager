// Balón parado sobre la pizarra común (formato v2 de board.js). Lógica pura, sin importaciones de React, para probarla en Node.
//  · Las jugadas antiguas (fichas y flechas en un dibujo de 300 × 240 de medio campo) se ven convertidas al vuelo, con los
//    mismos ids, hasta que alguien las toca; entonces se guarda `piece.board` (las fichas y flechas antiguas se quedan de copia).
//  · Cada ficha nuestra puede llevar `player_id`: dentro va el dorsal, debajo el nombre y encima el rol de la jugada.
import { NEW_BOARD_LOOK, fieldOf, isQuad, normalizeBoard, pruneLinks, setViewMode } from "./board.js";

export const SP_FIELD = "half";
export const SP_TEAMS = [
  { id: "a", name: "Racing", color: "#73000A" },
  { id: "b", name: "Rival", color: "#2563eb" },
];
const SP_CHIP = 1.9;
export const SP_CHIP_STRUCT = 1.3;
export const SP_LABEL_FS = 6; // nombres más pequeños (10 = el tamaño normal de la pizarra)
const W = 68;

const r1 = (n) => Math.round(n * 10) / 10;
// Dibujo antiguo: medio campo de 300 × 240 con la portería arriba; el área (168 × 72) mide 40,32 × 16,5 m
const SX = 168 / 40.32, SY = 72 / 16.5;
export const legacyPoint = (x, y) => ({ x: r1(Math.min(W + 1, Math.max(-1, 34 + (x - 150) / SX))), y: r1(Math.min(53.5, Math.max(-1, (y - 11) / SY))) });

const SIGNAL_TEXT = { head: "Señal: mano a la cabeza", arm: "Señal: brazo extendido", bounce: "Señal: bota el balón" };

export function shortName(p) {
  if (!p) return "";
  const first = String(p.nickname || p.first_name || "").trim().split(/\s+/)[0] || "";
  const last = String(p.last_name || "").trim().split(/\s+/)[0] || "";
  return `${first} ${last}`.trim();
}
const dorsalOf = (p) => String(p?.jersey_number ?? "").trim() || (shortName(p)[0] || "").toUpperCase();

// Jugada antigua → pizarra (un fotograma). `players` sirve para poner nombre y dorsal a las fichas con jugador.
export function legacyToBoard(piece, players = []) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const els = [];
  for (const a of piece?.arrows || []) {
    const p1 = legacyPoint(a.x1, a.y1), p2 = legacyPoint(a.x2, a.y2);
    const dashed = a.dashed ?? a.kind === "arrow_move";
    const el = {
      id: a.id, k: "arrow", style: dashed ? "move" : "pass", dash: dashed ? "dashed" : "solid",
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
      color: a.color || (a.team === "rival" ? "#2563eb" : "#73000A"),
      width: r1(Math.max(0.2, (a.width || 1.4) / 4.2)),
      ...(a.head === false ? { pointer: "none" } : {}),
      ...(a.border ? { border: true } : {}),
    };
    if (a.cx != null && a.cy != null) { const c = legacyPoint(a.cx, a.cy); el.cx = c.x; el.cy = c.y; }
    els.push(el);
  }
  for (const t of piece?.tokens || []) {
    const p = legacyPoint(t.x, t.y);
    const size = Number(t.size) || 1;
    if (t.kind === "ball") { els.push({ id: t.id, k: "ball", x: p.x, y: p.y, pattern: "classic", ...(size !== 1 ? { size } : {}) }); continue; }
    if (t.kind === "text" || t.kind === "signal") {
      const text = t.kind === "signal" ? SIGNAL_TEXT[t.variant] || SIGNAL_TEXT.head : String(t.label || "").replace(/\n/g, " ");
      els.push({ id: t.id, k: "text", x: p.x, y: p.y, text, size: r1(2.2 * size), color: t.color || "#FF6E00" });
      continue;
    }
    const own = t.kind !== "rival";
    const pl = own && t.player_id ? byId.get(t.player_id) : null;
    const el = { id: t.id, k: "token", team: own ? "a" : "b", x: p.x, y: p.y };
    if (pl) { el.player_id = pl.id; el.inner = dorsalOf(pl).slice(0, 3); el.label = shortName(pl); } else if (t.player_id) el.player_id = t.player_id;
    if (!el.inner && t.label) el.inner = String(t.label).slice(0, 3);
    if (t.role) el.labelTop = t.role;
    if (t.color) el.color = t.color;
    if (size !== 1) el.size = size;
    els.push(el);
  }
  return { v: 2, field: SP_FIELD, look: NEW_BOARD_LOOK, orient: "v", teams: SP_TEAMS.map((x) => ({ ...x })), chipSize: SP_CHIP, frames: [{ id: `${piece?.id || "p"}-f1`, els }] };
}

// Pizarra de una jugada: la guardada o la antigua convertida
export const pieceBoard = (piece, players = []) => (piece?.board ? normalizeBoard(piece.board) : legacyToBoard(piece, players));
export const emptyPieceBoard = () => legacyToBoard({ id: "nueva", tokens: [], arrows: [] });

// Voltear izquierda ↔ derecha (p. ej. un córner del otro lado): todo se refleja respecto al centro del campo, en todos los fotogramas
export function flipBoard(board) {
  const b = normalizeBoard(board);
  const w = fieldOf(b.field).w;
  const fx = (x) => r1(w - x);
  const flip = (e) => {
    if (e.k === "link") return e;
    if (isQuad(e)) return { ...e, pts: e.pts.map((q) => ({ x: fx(q.x), y: q.y })) };
    if (e.k === "zone") return { ...e, x: r1(w - e.x - e.w) };
    if (e.k === "arrow") {
      const o = { ...e, x1: fx(e.x1), x2: fx(e.x2) };
      if (e.cx != null) o.cx = fx(e.cx);
      if (Array.isArray(e.via)) o.via = e.via.map((q) => ({ x: fx(q.x), y: q.y }));
      if (e.lift) o.lift = -e.lift;
      return o;
    }
    const o = { ...e, x: fx(e.x) };
    if (e.face != null) o.face = (360 - (Number(e.face) || 0)) % 360;
    if (e.rot != null) o.rot = (360 - (Number(e.rot) || 0)) % 360;
    return o;
  };
  return { ...b, frames: b.frames.map((f) => ({ ...f, els: f.els.map(flip) })) };
}

const mapTokens = (board, fn) => ({ ...board, frames: board.frames.map((f) => ({ ...f, els: f.els.map((e) => (e.k === "token" ? fn(e) : e)) })) });

// Fichas nuestras de la jugada (las del primer fotograma), con su rol y su jugador
export function ownChips(board) {
  const b = normalizeBoard(board);
  return b.frames[0].els.filter((e) => e.k === "token" && e.team === "a");
}

// Poner (o quitar, con null) el jugador de una ficha en todos los fotogramas: dorsal dentro y nombre debajo
export function assignPlayer(board, id, player) {
  return mapTokens(normalizeBoard(board), (e) => {
    if (e.id !== id) return e;
    const { player_id: _p, label: _l, missing: _m, ...rest } = e;
    if (!player) return { ...rest, inner: "" };
    return { ...rest, player_id: player.id, inner: dorsalOf(player).slice(0, 3), label: shortName(player) };
  });
}

// Rol de la ficha (texto de arriba) en todos los fotogramas
export const setRole = (board, id, role) => mapTokens(normalizeBoard(board), (e) => (e.id === id ? { ...e, labelTop: role || undefined } : e));

// Al copiar una jugada a otro partido o cargarla de la biblioteca: los jugadores que no están disponibles se quitan y la ficha
// queda marcada (`missing`, con «?» dentro) para elegir otro; los demás conservan su ficha.
export function keepAvailable(board, availableIds) {
  const ok = new Set(availableIds || []);
  return mapTokens(normalizeBoard(board), (e) => {
    if (!e.player_id || ok.has(e.player_id)) return e;
    const { player_id: _p, label: _l, ...rest } = e;
    return { ...rest, inner: "?", missing: true };
  });
}

// Rellenar las fichas nuestras sin jugador con los disponibles que no están ya en la jugada (porteros, defensas, medios, delanteros; por dorsal)
const GROUP = { portero: 0, central: 1, libre: 1, lateral: 1, mediocentro: 2, interior: 2, mediapunta: 2, extremo: 3, delantero_centro: 3 };
export function fillWithSquad(board, candidates) {
  let b = normalizeBoard(board);
  const used = new Set(ownChips(b).map((e) => e.player_id).filter(Boolean));
  const pool = (candidates || []).filter((p) => !used.has(p.id))
    .sort((x, y) => ((GROUP[x.position] ?? 9) - (GROUP[y.position] ?? 9)) || ((Number(x.jersey_number) || 999) - (Number(y.jersey_number) || 999)));
  let i = 0;
  for (const chip of ownChips(b)) if (!chip.player_id && pool[i]) b = assignPlayer(b, chip.id, pool[i++]);
  return b;
}

// Jugadas del partido anterior del mismo equipo: el plan más reciente, anterior a este partido, que tenga jugadas
export function previousMatchPieces({ plans = [], events = [], eventId, eventDate }) {
  const dateOf = new Map(events.map((e) => [e.id, String(e.date || "")]));
  const cur = String(eventDate || dateOf.get(eventId) || "");
  const prev = plans
    .filter((p) => p.event_id && p.event_id !== eventId && Array.isArray(p.set_pieces) && p.set_pieces.length && dateOf.has(p.event_id))
    .filter((p) => !cur || dateOf.get(p.event_id) < cur)
    .sort((a, b) => dateOf.get(b.event_id).localeCompare(dateOf.get(a.event_id)));
  if (!prev.length) return null;
  const ev = events.find((e) => e.id === prev[0].event_id);
  return { event: ev, pieces: prev[0].set_pieces };
}

// Copia de una jugada para este partido: id nuevo, sin enlace a la biblioteca si se pide, pizarra con los jugadores disponibles
export function copyPiece(piece, { newId, players = [], availableIds = [], keepLibrary = true }) {
  const board = keepAvailable(pieceBoard(piece, players), availableIds);
  const { lib_id, ...rest } = piece;
  return { ...rest, id: newId(), board, ...(keepLibrary && lib_id ? { lib_id } : {}) };
}

// ── Editor de balón parado (05/11/2026, maqueta aprobada por Nacho) ─────────────────────────────────────────────────
// Tipo de jugada: `kind` (córner, falta lateral, falta frontal, banda), a favor (`attack`) o en contra y `side` (lado del
// saque: "r" derecha, "l" izquierda). `type` (el de siempre) se sigue guardando para la biblioteca, la impresión y lo antiguo.
export const SP_KINDS = [
  { id: "corner", label: "Córner" },
  { id: "falta_lateral", label: "F. lateral" },
  { id: "falta_frontal", label: "F. frontal" },
  { id: "banda", label: "Banda" },
];
const TYPE_OF = { corner: ["corner_favor", "corner_contra"], falta_lateral: ["falta_lateral", "falta_contra"], falta_frontal: ["falta_frontal", "falta_contra"], banda: ["saque_banda", "saque_banda"] };
export const typeOf = (kind, attack) => (TYPE_OF[kind] || TYPE_OF.corner)[attack ? 0 : 1];
// Lo que dice una jugada (las antiguas solo tienen `type`)
export function pieceSetup(piece) {
  const t = piece?.type || "corner_favor";
  const kind = piece?.kind || (t.startsWith("corner") ? "corner" : t === "falta_frontal" ? "falta_frontal" : t === "saque_banda" ? "banda" : t.startsWith("falta") ? "falta_lateral" : "corner");
  const attack = typeof piece?.attack === "boolean" ? piece.attack : !(t === "corner_contra" || t === "falta_contra");
  const side = piece?.side === "l" ? "l" : "r";
  return { kind, attack, side };
}

// Funciones (decididas por Nacho el 05/11/2026). Defensa: zona, hombre, rechace, corta, palo. Ataque: lanzador, rematador,
// bloqueo, rechace, cierra. Cada ficha guarda `fn` y toma el color de su función (`title` = singular y plural del título).
export const DEF_FUNCS = [
  { id: "zona", label: "Zona", color: "#73000A", title: ["ZONA", "ZONA"] },
  { id: "hombre", label: "Hombre", color: "#FFFFFF", stroke: "#73000A", title: ["AL HOMBRE", "AL HOMBRE"] },
  { id: "rechace", label: "Rechace", color: "#FF6E00", title: ["RECHACE", "RECHACES"] },
  { id: "corta", label: "Corta", color: "#0D9488", title: ["A LA CORTA", "A LA CORTA"] },
  { id: "palo", label: "Palo", color: "#EAB308", title: ["PALO", "PALOS"] },
];
export const ATT_FUNCS = [
  { id: "lanzador", label: "Lanzador", color: "#EAB308", title: ["LANZADOR", "LANZADORES"] },
  { id: "rematador", label: "Rematador", color: "#73000A", title: ["REMATADOR", "REMATADORES"] },
  { id: "bloqueo", label: "Bloqueo", color: "#374151", title: ["BLOQUEO", "BLOQUEOS"] },
  { id: "rechace", label: "Rechace", color: "#FF6E00", title: ["RECHACE", "RECHACES"] },
  { id: "cierra", label: "Cierra", color: "#FFFFFF", stroke: "#73000A", title: ["CIERRA", "CIERRAN"] },
];
export const GK_COLOR = "#16A34A";
export const funcsFor = (attack) => (attack ? ATT_FUNCS : DEF_FUNCS);
export const funcOf = (attack, id) => funcsFor(attack).find((f) => f.id === id) || null;
// Lo que se cambia en una ficha al darle una función (o quitársela con null)
export function fnPatch(f) {
  if (!f) return { fn: undefined, color: undefined, stroke: undefined, pattern: undefined, color2: undefined };
  return { fn: f.id, color: f.color, stroke: f.stroke, pattern: undefined, color2: undefined };
}
export function setFunction(board, id, f) {
  const patch = fnPatch(f);
  return mapTokens(normalizeBoard(board), (e) => {
    if (e.id !== id) return e;
    const o = { ...e };
    for (const [k, v] of Object.entries(patch)) { if (v === undefined) delete o[k]; else o[k] = v; }
    return o;
  });
}
// Cuántas fichas nuestras hay en cada función (las del primer fotograma)
export function functionCounts(board, attack) {
  const chips = ownChips(board);
  return funcsFor(attack).map((f) => ({ ...f, n: chips.filter((c) => c.fn === f.id).length }))
    .concat([{ id: null, label: "Sin función", n: chips.filter((c) => !c.fn || (!funcOf(attack, c.fn) && c.fn !== "portero")).length }]);
}
const KIND_TITLE = { corner: "CÓRNER", falta_lateral: "FALTA LATERAL", falta_frontal: "FALTA FRONTAL", banda: "SAQUE DE BANDA" };
// Título que se escribe solo («5 ZONA · 3 AL HOMBRE · 2 RECHACES») y su subtítulo
export function autoTitle(board, setup) {
  const { kind, attack, side } = setup;
  const counts = functionCounts(board, attack).filter((c) => c.id && c.n > 0);
  const title = counts.map((c) => `${c.n} ${c.title[c.n === 1 ? 0 : 1]}`).join(" · ");
  const z = counts.find((c) => c.id === "zona")?.n || 0, h = counts.find((c) => c.id === "hombre")?.n || 0;
  const mark = attack ? "" : z && h ? (z >= h ? "MARCAJE MIXTO · BASE ZONAL" : "MARCAJE MIXTO · BASE INDIVIDUAL") : z ? "MARCAJE ZONAL" : h ? "MARCAJE INDIVIDUAL" : "";
  const what = `${KIND_TITLE[kind] || "CÓRNER"} ${attack ? "A FAVOR" : "EN CONTRA"}${kind === "corner" ? ` · LADO ${side === "l" ? "IZQUIERDO" : "DERECHO"}` : ""}`;
  return { title, subtitle: mark ? `${mark} · ${what}` : what };
}

// Estructuras de partida del córner (posiciones con el saque por la derecha; con el lado izquierdo se reflejan).
// Defensa: «zona-hombre-rechace» + el portero. Ataque: lanzador, rematadores, bloqueos, rechaces y los que cierran.
const DEF_SLOTS = {
  zona: [[38.5, 2.6], [37.2, 5.9], [33.2, 5.9], [29.2, 5.9], [34, 10], [25.6, 6.6], [41, 9.6], [28.4, 10.4]],
  hombre: [[30, 11.6], [36.2, 12.6], [41.4, 11.2], [26.2, 13], [33, 15.2], [38.8, 15.6], [29, 16.6], [43.4, 14.6]],
  rechace: [[24, 22.5], [44, 23], [34, 26.5]],
};
const ATT_SLOTS = {
  lanzador: [[66.9, 1.1]],
  rematador: [[30.5, 13.5], [34.5, 14.5], [38.5, 13.5], [26.5, 12.5], [42.5, 12.5]],
  bloqueo: [[35.5, 6.2], [31.5, 6.6]],
  rechace: [[24, 22.5], [44, 22.5]],
  cierra: [[29, 40], [40, 41]],
};
export const SP_STRUCTURES = [
  { id: "d-622", attack: false, label: "6-2-2", n: { zona: 6, hombre: 2, rechace: 2 } },
  { id: "d-532", attack: false, label: "5-3-2", n: { zona: 5, hombre: 3, rechace: 2 } },
  { id: "d-631", attack: false, label: "6-3-1", n: { zona: 6, hombre: 3, rechace: 1 } },
  { id: "d-442", attack: false, label: "4-4-2", n: { zona: 4, hombre: 4, rechace: 2 } },
  { id: "d-ind", attack: false, label: "Individual", n: { hombre: 8, rechace: 2 } },
  { id: "d-z8", attack: false, label: "Zonal 8", n: { zona: 8, rechace: 2 } },
  { id: "a-41", attack: true, label: "4 rematadores", n: { lanzador: 1, rematador: 4, bloqueo: 1, rechace: 2, cierra: 2 } },
  { id: "a-5", attack: true, label: "5 rematadores", n: { lanzador: 1, rematador: 5, bloqueo: 1, rechace: 1, cierra: 2 } },
  { id: "a-32", attack: true, label: "3 + 2 bloqueos", n: { lanzador: 1, rematador: 3, bloqueo: 2, rechace: 2, cierra: 2 } },
];
export const structuresFor = (kind, attack) => (kind === "corner" ? SP_STRUCTURES.filter((s) => s.attack === attack) : []);
// Rivales por defecto (si la jugada todavía no tiene ninguno)
const RIVAL_DEF = [[66.9, 1.1], [27.2, 10.3], [35.6, 12.2], [41.9, 10.6], [31.4, 15.4], [46.5, 7.2], [38.5, 20.5], [34, 31]];
const RIVAL_ATT = [[34, 1.6], [37.2, 5.6], [31.5, 5.8], [29, 11.8], [35.5, 12.6], [41.5, 11.4], [26, 20], [43, 21]];

// Coloca nuestras fichas según la estructura: reutiliza las que hay (primero las que ya tienen esa función, con su jugador),
// crea las que faltan y quita las que sobran (en todos los fotogramas). Las posiciones nuevas van en todos los fotogramas.
export function applyStructure(board, structure, { side = "r", newId }) {
  let b = normalizeBoard(board);
  const mx = (x) => (side === "l" ? r1(W - x) : x);
  const attack = structure.attack;
  const slots = [];
  if (!attack) slots.push({ fn: "portero", at: [34, 1.7] });
  const table = attack ? ATT_SLOTS : DEF_SLOTS;
  for (const [fn, n] of Object.entries(structure.n)) for (let i = 0; i < n; i++) slots.push({ fn, at: table[fn][i % table[fn].length] });
  const chips = ownChips(b);
  const used = new Set();
  const plan = slots.map((s) => {
    let c = chips.find((x) => !used.has(x.id) && x.fn === s.fn);
    if (!c) c = chips.find((x) => !used.has(x.id) && !(x.fn && slots.some((o) => o.fn === x.fn)));
    if (!c) c = chips.find((x) => !used.has(x.id));
    if (c) used.add(c.id);
    return { ...s, id: c ? c.id : newId(), old: c || null };
  });
  const drop = new Set(chips.filter((c) => !used.has(c.id)).map((c) => c.id));
  const look = (s) => {
    const f = s.fn === "portero" ? { id: "portero", color: GK_COLOR } : funcOf(attack, s.fn);
    return { fn: f.id, color: f.color, ...(f.stroke ? { stroke: f.stroke } : {}) };
  };
  const strip = (e) => { const { fn: _f, color: _c, stroke: _s, pattern: _p, color2: _c2, ...rest } = e; return rest; };
  const hasRivals = b.frames[0].els.some((e) => e.k === "token" && e.team === "b");
  const rivals = hasRivals ? [] : (attack ? RIVAL_ATT : RIVAL_DEF).map(([x, y], i) => ({ id: newId(), k: "token", team: "b", x: mx(x), y, inner: attack && i === 0 ? "P" : "" }));
  const ball = b.frames[0].els.some((e) => e.k === "ball") ? [] : [{ id: newId(), k: "ball", x: mx(67.7), y: 0.5, pattern: "classic" }];
  const extra = [...rivals, ...ball];
  const frames = b.frames.map((f, fi) => {
    const els = f.els.filter((e) => !drop.has(e.id)).map((e) => {
      const s = plan.find((p) => p.id === e.id);
      if (!s) return e;
      return { ...strip(e), ...look(s), labelFs: e.labelFs ?? SP_LABEL_FS, ...(fi === 0 ? { x: mx(s.at[0]), y: s.at[1] } : {}) };
    });
    for (const s of plan) if (!s.old) els.push({ id: s.id, k: "token", team: "a", x: mx(s.at[0]), y: s.at[1], labelFs: SP_LABEL_FS, ...look(s) });
    return { ...f, els: [...els, ...extra.map((r) => ({ ...r }))] };
  });
  // fichas algo más pequeñas que en el resto de jugadas, para que quepan en el área sin pisarse
  b = pruneLinks({ ...b, chipSize: Math.min(Number(b.chipSize) || SP_CHIP, SP_CHIP_STRUCT), frames });
  return b;
}

// ── Impresión: vista y orientación elegidas al imprimir (05/11/2026, Nacho) ─────────────────────────────────────────────
// `view` = "board" (como está en la pizarra) | "flat" | "persp" | "3d"; `orient` = "board" | "v" | "h". Al cambiar algo se
// quitan la cámara, el zoom y la cámara libre guardados (estaban pensados para la vista de la pizarra). En horizontal se gira
// un cuarto de vuelta: lo que ataca arriba pasa a atacar a la derecha (y lo que ataca abajo, a la izquierda), y al revés.
export const PRINT_VIEWS = ["board", "flat", "persp", "3d"];
export const PRINT_ORIENTS = ["board", "v", "h"];
const TO_H = { v: "hi", vi: "h" }, TO_V = { hi: "v", h: "vi" };
export function printBoard(board, { view = "board", orient = "board" } = {}) {
  const b = normalizeBoard(board);
  const o = b.orient || "v";
  const nextOrient = orient === "h" ? (o[0] === "h" ? o : TO_H[o]) : orient === "v" ? (o[0] === "v" ? o : TO_V[o]) : o;
  const changeView = PRINT_VIEWS.includes(view) && view !== "board";
  if (!changeView && nextOrient === o) return b;
  let out = { ...b, orient: nextOrient };
  if (changeView) out = setViewMode(out, view);
  const { cam: _c, orbit: _o, ...rest } = out;
  return { ...rest, frames: rest.frames.map(({ cam: _fc, orbit: _fo, ...f }) => f) };
}
