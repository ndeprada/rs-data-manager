// Balón parado sobre la pizarra común (formato v2 de board.js). Lógica pura, sin importaciones de React, para probarla en Node.
//  · Las jugadas antiguas (fichas y flechas en un dibujo de 300 × 240 de medio campo) se ven convertidas al vuelo, con los
//    mismos ids, hasta que alguien las toca; entonces se guarda `piece.board` (las fichas y flechas antiguas se quedan de copia).
//  · Cada ficha nuestra puede llevar `player_id`: dentro va el dorsal, debajo el nombre y encima el rol de la jugada.
import { NEW_BOARD_LOOK, fieldOf, isQuad, normalizeBoard } from "./board.js";

export const SP_FIELD = "half";
export const SP_TEAMS = [
  { id: "a", name: "Racing", color: "#73000A" },
  { id: "b", name: "Rival", color: "#2563eb" },
];
const SP_CHIP = 1.9;
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
