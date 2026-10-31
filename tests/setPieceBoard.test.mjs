import test from "node:test";
import assert from "node:assert/strict";
import { assignPlayer, copyPiece, fillWithSquad, flipBoard, keepAvailable, legacyPoint, legacyToBoard, ownChips, pieceBoard, previousMatchPieces, setRole } from "../src/lib/setPieceBoard.js";

const players = [
  { id: "p1", first_name: "Pol", last_name: "Martí Soler", jersey_number: 4, position: "central" },
  { id: "p2", first_name: "Arnau", last_name: "Sala", jersey_number: 9, position: "delantero_centro" },
  { id: "p3", first_name: "Marc", last_name: "Vidal", jersey_number: 1, position: "portero" },
];
const legacy = {
  id: "pc1", name: "Córner", type: "corner_favor",
  tokens: [
    { id: "t1", kind: "own", x: 150, y: 62, label: "2", role: "Rematador", player_id: "p1", size: 1 },
    { id: "t2", kind: "rival", x: 150, y: 18, label: "P", size: 1 },
    { id: "t3", kind: "ball", x: 14, y: 14, size: 1 },
    { id: "t4", kind: "signal", x: 40, y: 40, variant: "bounce" },
    { id: "t5", kind: "own", x: 104, y: 44, label: "1", role: "1er palo", player_id: "gone" },
  ],
  arrows: [{ id: "a1", x1: 38, y1: 26, x2: 132, y2: 50, cx: 80, cy: 22, dashed: false, team: "own" }],
};

test("las coordenadas antiguas caen en su sitio del medio campo (área y portería)", () => {
  assert.deepEqual(legacyPoint(150, 11), { x: 34, y: 0 }, "centro de la línea de fondo");
  const corner = legacyPoint(66, 83);
  assert.ok(Math.abs(corner.x - (34 - 20.16)) < 0.2 && Math.abs(corner.y - 16.5) < 0.2, "esquina del área");
});

test("una jugada antigua se convierte con los mismos ids, jugador, dorsal, rol, balón, señal y flecha curva", () => {
  const b = legacyToBoard(legacy, players);
  assert.equal(b.field, "half");
  const els = b.frames[0].els;
  const t1 = els.find((e) => e.id === "t1");
  assert.equal(t1.team, "a");
  assert.equal(t1.player_id, "p1");
  assert.equal(t1.inner, "4");
  assert.equal(t1.label, "Pol Martí");
  assert.equal(t1.labelTop, "Rematador");
  assert.equal(els.find((e) => e.id === "t2").team, "b");
  assert.equal(els.find((e) => e.id === "t3").k, "ball");
  assert.match(els.find((e) => e.id === "t4").text, /bota el balón/);
  const a = els.find((e) => e.id === "a1");
  assert.equal(a.k, "arrow");
  assert.ok(a.cx != null && a.cy != null, "la curva se conserva");
  assert.deepEqual(legacyToBoard(legacy, players), b, "la conversión es estable (mismos ids en cada vista)");
  assert.equal(pieceBoard({ ...legacy, board: { v: 2, field: "half", frames: [{ id: "x", els: [] }] } }).frames[0].els.length, 0, "si ya hay pizarra guardada manda ella");
});

test("voltear refleja todo respecto al centro y dos veces vuelve a quedar igual", () => {
  const b = legacyToBoard(legacy, players);
  const f = flipBoard(b);
  const t1 = b.frames[0].els.find((e) => e.id === "t3"), t1f = f.frames[0].els.find((e) => e.id === "t3");
  assert.equal(t1f.x, Math.round((68 - t1.x) * 10) / 10);
  assert.equal(t1f.y, t1.y);
  assert.deepEqual(flipBoard(f).frames[0].els.map((e) => [e.x ?? e.x1, e.y ?? e.y1]), b.frames[0].els.map((e) => [e.x ?? e.x1, e.y ?? e.y1]));
});

test("jugadores: asignar, quitar, rol, rellenar con convocados y copiar a otro partido", () => {
  let b = legacyToBoard(legacy, players);
  assert.equal(ownChips(b).length, 2);
  b = assignPlayer(b, "t5", players[1]);
  let t5 = ownChips(b).find((e) => e.id === "t5");
  assert.equal(t5.inner, "9");
  assert.equal(t5.label, "Arnau Sala");
  b = assignPlayer(b, "t5", null);
  t5 = ownChips(b).find((e) => e.id === "t5");
  assert.equal(t5.player_id, undefined);
  b = setRole(b, "t5", "Bloqueador");
  assert.equal(ownChips(b).find((e) => e.id === "t5").labelTop, "Bloqueador");
  b = fillWithSquad(b, players);
  assert.equal(ownChips(b).find((e) => e.id === "t5").player_id, "p3", "el portero primero, sin repetir al que ya está");
  const kept = keepAvailable(b, ["p1"]);
  const lost = ownChips(kept).find((e) => e.id === "t5");
  assert.equal(lost.player_id, undefined);
  assert.equal(lost.inner, "?");
  assert.equal(lost.missing, true);
  assert.equal(ownChips(kept).find((e) => e.id === "t1").player_id, "p1");
  let n = 0;
  const copy = copyPiece({ ...legacy, lib_id: "L1" }, { newId: () => `n${++n}`, players, availableIds: ["p1"] });
  assert.equal(copy.id, "n1");
  assert.equal(copy.lib_id, "L1");
  assert.equal(ownChips(copy.board).find((e) => e.id === "t1").player_id, "p1");
  assert.equal(ownChips(copy.board).find((e) => e.id === "t5").missing, true);
});

test("jugadas del partido anterior: el plan más reciente anterior a este partido y con jugadas", () => {
  const events = [{ id: "e1", date: "2026-10-04T10:00" }, { id: "e2", date: "2026-10-11T10:00" }, { id: "e3", date: "2026-10-18T10:00" }, { id: "e4", date: "2026-10-25T10:00" }];
  const plans = [
    { event_id: "e1", set_pieces: [{ id: "a" }] },
    { event_id: "e2", set_pieces: [{ id: "b" }] },
    { event_id: "e3", set_pieces: [] },
    { event_id: "e4", set_pieces: [{ id: "d" }] },
  ];
  const r = previousMatchPieces({ plans, events, eventId: "e4" });
  assert.equal(r.event.id, "e2", "salta el partido sin jugadas y no mira el propio");
  assert.deepEqual(r.pieces, [{ id: "b" }]);
  assert.equal(previousMatchPieces({ plans, events, eventId: "e1" }), null);
});
