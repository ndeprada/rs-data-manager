import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeBoard, hasBoard, addFrame, removeFrame, duplicateFrame, moveFrame, addElement, removeElement, patchElement,
  lerpFrames, ghostsOf, toView, fromView, fieldOf, hitTest, shiftElement, arrowPoints, emptyBoard, MAX_FRAMES, frameCount, changeField,
} from "../src/lib/board.js";

const token = (id, x, y, team = "a") => ({ id, k: "token", x, y, team, label: "" });
const arrow = (id) => ({ id, k: "arrow", style: "pass", x1: 0, y1: 0, x2: 10, y2: 0 });

test("un dibujo antiguo se convierte en un primer fotograma sin perder nada", () => {
  const old = { field: "full", elements: [token("t1", 10, 20), arrow("a1")] };
  const b = normalizeBoard(old);
  assert.equal(b.v, 2);
  assert.equal(b.field, "full");
  assert.equal(b.frames.length, 1);
  assert.deepEqual(b.frames[0].els.map((e) => e.id), ["t1", "a1"]);
  assert.equal(old.elements.length, 2, "el original no se toca");
});

test("sin datos o con datos raros se devuelve una pizarra vacía válida", () => {
  assert.equal(normalizeBoard(null).frames.length, 1);
  assert.equal(normalizeBoard({ v: 2, field: "nada", look: "x", orient: "z", frames: [] }).field, "half");
  assert.equal(normalizeBoard({ v: 2, frames: [] }).look, "blanco");
  assert.equal(normalizeBoard({ v: 2, frames: [] }).orient, "v");
});

test("hasBoard distingue vacío y con contenido en los dos formatos", () => {
  assert.equal(hasBoard(null), false);
  assert.equal(hasBoard({ elements: [] }), false);
  assert.equal(hasBoard({ elements: [token("t", 1, 1)] }), true);
  assert.equal(hasBoard(emptyBoard()), false);
  assert.equal(hasBoard(addElement(emptyBoard(), 0, token("t", 1, 1))), true);
});

test("un fotograma nuevo copia lo que se mueve y deja vacías las anotaciones", () => {
  let b = emptyBoard();
  b = addElement(b, 0, token("t1", 10, 10));
  b = addElement(b, 0, arrow("a1"));
  const r = addFrame(b, 0);
  assert.equal(r.index, 1);
  assert.deepEqual(r.board.frames[1].els.map((e) => e.id), ["t1"]);
  assert.equal(r.board.frames[0].els.length, 2);
});

test("lo que se mueve entra en todos los fotogramas; las anotaciones solo en el actual", () => {
  let b = addFrame(emptyBoard(), 0).board;
  b = addElement(b, 1, token("t1", 5, 5));
  b = addElement(b, 1, arrow("a1"));
  assert.deepEqual(b.frames[0].els.map((e) => e.id), ["t1"]);
  assert.deepEqual(b.frames[1].els.map((e) => e.id), ["t1", "a1"]);
});

test("quitar una ficha la quita de todos los fotogramas o solo del actual", () => {
  let b = addElement(emptyBoard(), 0, token("t1", 5, 5));
  b = addFrame(b, 0).board;
  const here = removeElement(b, 1, "t1", { onlyHere: true });
  assert.equal(here.frames[0].els.length, 1);
  assert.equal(here.frames[1].els.length, 0);
  const all = removeElement(b, 1, "t1");
  assert.equal(all.frames[0].els.length + all.frames[1].els.length, 0);
});

test("patchElement cambia un fotograma o todos", () => {
  let b = addFrame(addElement(emptyBoard(), 0, token("t1", 5, 5)), 0).board;
  const one = patchElement(b, 1, "t1", { x: 30 });
  assert.equal(one.frames[0].els[0].x, 5);
  assert.equal(one.frames[1].els[0].x, 30);
  const all = patchElement(b, 1, "t1", { label: "Pau" }, { allFrames: true });
  assert.equal(all.frames[0].els[0].label, "Pau");
});

test("no se pasa del máximo de fotogramas y siempre queda uno", () => {
  let b = emptyBoard();
  for (let i = 0; i < MAX_FRAMES + 3; i++) b = addFrame(b, b.frames.length - 1).board;
  assert.equal(b.frames.length, MAX_FRAMES);
  const one = removeFrame(emptyBoard(), 0);
  assert.equal(one.board.frames.length, 1);
  assert.equal(frameCount(one.board), 1);
  assert.equal(frameCount({ elements: [] }), 1);
});

test("borrar, duplicar y reordenar fotogramas", () => {
  let b = addElement(emptyBoard(), 0, token("t1", 1, 1));
  b = addFrame(b, 0).board;
  b = addFrame(b, 1).board;
  assert.equal(b.frames.length, 3);
  const ids = b.frames.map((f) => f.id);
  const m = moveFrame(b, 0, 1);
  assert.deepEqual(m.board.frames.map((f) => f.id), [ids[1], ids[0], ids[2]]);
  assert.equal(m.index, 1);
  assert.equal(moveFrame(b, 0, -1).index, 0);
  const d = duplicateFrame(addElement(b, 0, arrow("a1")), 0);
  assert.equal(d.board.frames.length, 4);
  assert.notEqual(d.board.frames[1].els.find((e) => e.k === "arrow").id, "a1");
  const r = removeFrame(b, 1);
  assert.equal(r.board.frames.length, 2);
});

test("la animación interpola lo que se mueve y funde lo que no", () => {
  const a = { els: [token("t1", 0, 0), token("t2", 5, 5), arrow("a1")] };
  const b = { els: [token("t1", 10, 20), token("t3", 1, 1)] };
  const mid = lerpFrames(a, b, 0.5);
  const t1 = mid.find((e) => e.id === "t1");
  assert.equal(t1.x, 5);
  assert.equal(t1.y, 10);
  assert.equal(t1.opacity, 1);
  assert.equal(mid.find((e) => e.id === "t2").opacity, 0.5);
  assert.equal(mid.find((e) => e.id === "t3").opacity, 0.5);
  assert.equal(mid.find((e) => e.id === "a1").opacity, 0.5);
  const start = lerpFrames(a, b, 0);
  assert.equal(start.find((e) => e.id === "t1").x, 0);
  const end = lerpFrames(a, b, 1);
  assert.equal(end.find((e) => e.id === "t1").x, 10);
  assert.equal(end.find((e) => e.id === "t2").opacity, 0);
});

test("el rastro solo marca lo que se ha movido de verdad", () => {
  const prev = { els: [token("t1", 0, 0), token("t2", 5, 5)] };
  const cur = { els: [token("t1", 10, 0), token("t2", 5.2, 5)] };
  const g = ghostsOf(prev, cur);
  assert.equal(g.length, 1);
  assert.equal(g[0].id, "t1");
  assert.deepEqual(ghostsOf(null, cur), []);
});

test("la vista horizontal gira el campo y vuelve al mismo punto", () => {
  const f = fieldOf("full");
  const p = { x: 20, y: 30 };
  assert.deepEqual(toView(f, "v", p), p);
  const h = toView(f, "h", p);
  assert.deepEqual(h, { x: 30, y: 48 });
  assert.deepEqual(fromView(f, "h", h), p);
  assert.deepEqual(toView(f, "h", { x: 0, y: 0 }), { x: 0, y: 68 });
});

test("hitTest encuentra fichas, flechas y el borde de las zonas", () => {
  const els = [{ id: "z", k: "zone", x: 10, y: 10, w: 20, h: 20 }, arrow("a1"), token("t1", 50, 50)];
  assert.equal(hitTest(els, { x: 50.5, y: 50 })?.id, "t1");
  assert.equal(hitTest(els, { x: 5, y: 1.5 })?.id, "a1");
  assert.equal(hitTest(els, { x: 10, y: 20 })?.id, "z");
  assert.equal(hitTest(els, { x: 20, y: 20 }), null, "el interior de la zona no se agarra");
  assert.equal(hitTest(els, { x: 60, y: 60 }), null);
});

test("las flechas curvas siguen la curva y mover desplaza todo", () => {
  const a = { k: "arrow", x1: 0, y1: 0, x2: 10, y2: 0, cx: 5, cy: 10 };
  const pts = arrowPoints(a, 2);
  assert.deepEqual(pts[1], { x: 5, y: 5 });
  const m = shiftElement(a, 1, 2);
  assert.deepEqual([m.x1, m.y1, m.x2, m.y2, m.cx, m.cy], [1, 2, 11, 2, 6, 12]);
  assert.deepEqual(shiftElement(token("t", 1, 1), 2, 3).x, 3);
});

test("al cambiar de campo, lo dibujado se reescala en proporción", () => {
  let b = { ...emptyBoard("full"), field: "full" };
  b = addElement(b, 0, token("t1", 34, 52.5));
  b = addElement(b, 0, { id: "z", k: "zone", x: 0, y: 0, w: 34, h: 52.5 });
  b = addElement(b, 0, { ...arrow("a1"), x2: 68, y2: 105, cx: 34, cy: 52.5 });
  const half = changeField(b, "half");
  assert.equal(half.field, "half");
  assert.deepEqual([half.frames[0].els[0].x, half.frames[0].els[0].y], [34, 26.3]);
  assert.equal(half.frames[0].els[1].h, 26.3);
  assert.deepEqual([half.frames[0].els[2].x2, half.frames[0].els[2].y2, half.frames[0].els[2].cy], [68, 52.5, 26.3]);
  assert.equal(changeField(b, "full"), b);
  assert.equal(b.frames[0].els[0].y, 52.5, "el original no se toca");
});
