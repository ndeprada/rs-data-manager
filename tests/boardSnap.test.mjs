import test from "node:test";
import assert from "node:assert/strict";
import { snapAnchors, snapPoint, freeMove } from "../src/lib/boardSnap.js";
import { coneEdgeWidth } from "../src/lib/board.js";

const zone = { id: "z", k: "zone", x: 10, y: 10, w: 20, h: 10 };
const arrow = { id: "a", k: "arrow", x1: 0, y1: 0, x2: 5, y2: 5, via: [{ x: 2, y: 4 }] };

test("imán: anclas de zonas, flechas y fichas", () => {
  const an = snapAnchors([zone, arrow, { id: "t", k: "token", x: 3, y: 3 }], "a");
  assert.ok(an.some((p) => p.x === 10 && p.y === 10 && p.kind === "corner"));
  assert.ok(an.some((p) => p.x === 20 && p.y === 10 && p.kind === "mid"));
  assert.ok(an.some((p) => p.x === 20 && p.y === 15 && p.kind === "center"));
  assert.ok(an.some((p) => p.x === 3 && p.y === 3));
  assert.ok(!an.some((p) => p.x === 5 && p.y === 5), "la propia flecha no cuenta");
  const ell = snapAnchors([{ ...zone, shape: "ellipse" }]);
  assert.ok(!ell.some((p) => p.kind === "corner"));
  const quad = snapAnchors([{ id: "q", k: "zone", shape: "quad", pts: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }] }]);
  assert.equal(quad.length, 8);
});

test("imán: se pega a la esquina o al punto medio más cercano", () => {
  const anchors = snapAnchors([zone]);
  const r = snapPoint({ x: 10.4, y: 9.7 }, { anchors, tol: 0.8 });
  assert.deepEqual([r.x, r.y, r.guide.kind], [10, 10, "point"]);
  const m = snapPoint({ x: 20.3, y: 10.5 }, { anchors, tol: 0.8 });
  assert.deepEqual([m.x, m.y], [20, 10]);
  const none = snapPoint({ x: 15, y: 30 }, { anchors, tol: 0.8 });
  assert.equal(none.guide, null);
});

test("imán: casi vertical u horizontal se pone recto", () => {
  const v = snapPoint({ x: 10.5, y: 30 }, { from: { x: 10, y: 10 } });
  assert.deepEqual([v.x, v.y, v.guide.kind], [10, 30, "axis"]);
  const h = snapPoint({ x: 30, y: 11 }, { from: { x: 10, y: 10 } });
  assert.deepEqual([h.x, h.y], [30, 10]);
  const diag = snapPoint({ x: 20, y: 20 }, { from: { x: 10, y: 10 } });
  assert.deepEqual([diag.x, diag.y, diag.guide], [20, 20, null]);
  const short = snapPoint({ x: 10.1, y: 10.5 }, { from: { x: 10, y: 10 } });
  assert.equal(short.guide, null, "muy corto: no se endereza");
});

test("imán: un quiebro forma ángulo recto con sus dos vecinos", () => {
  const r = snapPoint({ x: 10.4, y: 19.6 }, { from: [{ x: 10, y: 0 }, { x: 30, y: 20 }] });
  assert.deepEqual([r.x, r.y], [10, 20]);
  assert.equal(r.guide.lines.length, 2);
});

test("imán: recto y alineado con una esquina cercana", () => {
  const anchors = snapAnchors([zone]);
  const r = snapPoint({ x: 29.6, y: 0.3 }, { from: { x: 0, y: 0 }, anchors, tol: 0.8 });
  assert.deepEqual([r.x, r.y], [30, 0], "recto y además alineado con la esquina de x = 30");
  const al = snapPoint({ x: 30.5, y: 40.2 }, { from: { x: 0, y: 40 }, anchors, tol: 0.8 });
  assert.deepEqual([al.x, al.y], [30, 40]);
  assert.equal(al.guide.at.x, 30);
});

test("imán: Control, Alt o Cmd lo sueltan", () => {
  assert.equal(freeMove({ ctrlKey: true }), true);
  assert.equal(freeMove({ altKey: true }), true);
  assert.equal(freeMove({ metaKey: true }), true);
  assert.equal(freeMove({}), false);
});

test("cono: grosor del borde con el tamaño y elegible", () => {
  assert.ok(coneEdgeWidth({ shape: "flat" }) < 0.3, "el plano ya no lleva el borde ancho de antes");
  assert.equal(coneEdgeWidth({ shape: "flat", size: 0.5 }), coneEdgeWidth({ shape: "flat" }) / 2);
  assert.equal(coneEdgeWidth({ shape: "flat", edge: 0 }), 0);
  assert.equal(coneEdgeWidth({ edge: 2 }), coneEdgeWidth({}) * 2);
  assert.equal(coneEdgeWidth({ edge: 99 }), coneEdgeWidth({}) * 4);
});
