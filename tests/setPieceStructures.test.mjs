import test from "node:test";
import assert from "node:assert/strict";
import { applyStructure, autoTitle, functionCounts, pieceSetup, typeOf, setFunction, SP_STRUCTURES, DEF_FUNCS, ownChips, emptyPieceBoard, structuresFor } from "../src/lib/setPieceBoard.js";

let n = 0;
const newId = () => `n${++n}`;

test("tipo de jugada: se deduce de lo antiguo y se guarda el `type` de siempre", () => {
  assert.deepEqual(pieceSetup({ type: "corner_contra" }), { kind: "corner", attack: false, side: "r" });
  assert.deepEqual(pieceSetup({ type: "falta_contra" }), { kind: "falta_lateral", attack: false, side: "r" });
  assert.deepEqual(pieceSetup({ type: "saque_banda" }), { kind: "banda", attack: true, side: "r" });
  assert.deepEqual(pieceSetup({ kind: "corner", attack: true, side: "l", type: "corner_contra" }), { kind: "corner", attack: true, side: "l" });
  assert.equal(typeOf("corner", false), "corner_contra");
  assert.equal(typeOf("falta_frontal", true), "falta_frontal");
  assert.equal(typeOf("falta_frontal", false), "falta_contra");
  assert.equal(structuresFor("corner", false).length, 6);
  assert.equal(structuresFor("banda", false).length, 0);
});

test("estructura 5-3-2: portero + 10, función escrita y título que se escribe solo", () => {
  const s = SP_STRUCTURES.find((x) => x.id === "d-532");
  const b = applyStructure(emptyPieceBoard(), s, { side: "r", newId });
  const own = ownChips(b);
  assert.equal(own.length, 11);
  assert.equal(own.filter((c) => c.fn === "zona").length, 5);
  assert.equal(own.find((c) => c.fn === "hombre").color, undefined); // la función ya no cambia el color (06/11/2026)
  assert.equal(own.find((c) => c.fn === "hombre").fnText, "HOMBRE");
  // añade rivales y balón si no había
  assert.equal(b.frames[0].els.filter((e) => e.k === "token" && e.team === "b").length, 8);
  assert.equal(b.frames[0].els.filter((e) => e.k === "ball").length, 1);
  const t = autoTitle(b, { kind: "corner", attack: false, side: "r" });
  assert.equal(t.title, "5 ZONA · 3 AL HOMBRE · 2 RECHACES");
  assert.equal(t.subtitle, "MARCAJE MIXTO · BASE ZONAL · CÓRNER EN CONTRA · LADO DERECHO");
  // lado izquierdo: reflejado
  const bl = applyStructure(emptyPieceBoard(), s, { side: "l", newId });
  const gk = ownChips(bl).find((c) => c.fn === "portero");
  assert.equal(gk.x, 34);
  assert.ok(ownChips(bl).find((c) => c.fn === "zona").x < 34);
});

test("cambiar de estructura conserva las fichas (y sus jugadores), quita las que sobran y no repite rivales", () => {
  const a = applyStructure(emptyPieceBoard(), SP_STRUCTURES.find((x) => x.id === "d-622"), { newId });
  const withPlayer = { ...a, frames: a.frames.map((f) => ({ ...f, els: f.els.map((e) => (e.fn === "hombre" ? { ...e, player_id: "p9" } : e)) })) };
  const b = applyStructure(withPlayer, SP_STRUCTURES.find((x) => x.id === "d-ind"), { newId });
  const own = ownChips(b);
  assert.equal(own.length, 11);
  assert.equal(own.filter((c) => c.fn === "hombre").length, 8);
  assert.ok(own.some((c) => c.player_id === "p9" && c.fn === "hombre"));
  assert.equal(b.frames[0].els.filter((e) => e.team === "b").length, 8);
  const t = autoTitle(b, { kind: "corner", attack: false, side: "r" });
  assert.equal(t.title, "8 AL HOMBRE · 2 RECHACES");
  assert.equal(t.subtitle.startsWith("MARCAJE INDIVIDUAL"), true);
});

test("dar y quitar una función a una ficha", () => {
  const b0 = applyStructure(emptyPieceBoard(), SP_STRUCTURES.find((x) => x.id === "a-41"), { newId });
  const chip = ownChips(b0).find((c) => c.fn === "cierra");
  const b1 = setFunction(b0, chip.id, DEF_FUNCS[0]);
  assert.equal(ownChips(b1).find((c) => c.id === chip.id).fn, "zona");
  const b2 = setFunction(b1, chip.id, null);
  const c2 = ownChips(b2).find((c) => c.id === chip.id);
  assert.equal(c2.fn, undefined);
  assert.equal(c2.color, undefined);
  const counts = functionCounts(b2, true);
  assert.equal(counts.find((c) => c.id === "cierra").n, 1);
  assert.equal(counts.find((c) => c.id === null).n, 1);
  assert.equal(autoTitle(b0, { kind: "corner", attack: true, side: "r" }).title, "1 LANZADOR · 4 REMATADORES · 1 BLOQUEO · 2 RECHACES · 2 CIERRAN");
});

test("imprimir: vista y orientación elegidas", async () => {
  const { printBoard } = await import("../src/lib/setPieceBoard.js");
  const b = { v: 2, field: "half", orient: "v", view: "persp", cam: { z: 2, x: 0.5, y: 0.5 }, frames: [{ id: "f1", els: [], cam: { x: 0.5, y: 0.5, w: 0.5 } }] };
  const same = printBoard(b);
  assert.equal(same.orient, "v"); assert.equal(same.view, "persp"); assert.ok(same.cam);
  const h = printBoard(b, { orient: "h" });
  assert.equal(h.orient, "hi"); assert.equal(h.view, "persp"); assert.equal(h.cam, undefined); assert.equal(h.frames[0].cam, undefined);
  assert.equal(printBoard({ ...b, orient: "vi" }, { orient: "h" }).orient, "h");
  assert.equal(printBoard({ ...b, orient: "hi" }, { orient: "v" }).orient, "v");
  assert.equal(printBoard(b, { orient: "v" }).orient, "v");
  const flat = printBoard(b, { view: "flat" });
  assert.equal(flat.view, undefined); assert.equal(flat.view3d, undefined);
  const d3 = printBoard(b, { view: "3d", orient: "h" });
  assert.equal(d3.view3d, true); assert.equal(d3.view, "persp"); assert.equal(d3.orient, "hi");
});

test("tarjeta de la ficha: poner o quitar jugador", async () => {
  const { playerPatch } = await import("../src/lib/setPieceBoard.js");
  const p = playerPatch({ id: "p1", first_name: "Leo", last_name: "Soler Puig", jersey_number: 10 });
  assert.equal(p.player_id, "p1"); assert.equal(p.inner, "10"); assert.ok(p.label.startsWith("Leo")); assert.equal(p.missing, undefined);
  assert.deepEqual(playerPatch(null), { player_id: undefined, label: undefined, inner: "", missing: undefined });
});

test("la función no cambia el color de la ficha y se escribe junto a ella (06/11/2026)", async () => {
  const { upgradeFunctions, fnPatch, GK_FN, GK_COLOR } = await import("../src/lib/setPieceBoard.js");
  const b0 = applyStructure(emptyPieceBoard(), SP_STRUCTURES.find((x) => x.id === "d-622"), { newId });
  const chips = ownChips(b0);
  const zona = chips.find((c) => c.fn === "zona");
  assert.equal(zona.color, undefined);
  assert.equal(zona.fnText, "ZONA");
  const gk = chips.find((c) => c.fn === "portero");
  assert.equal(gk.color, GK_COLOR);
  // el portero que pasa a otra función pierde el verde
  const b1 = setFunction(b0, gk.id, DEF_FUNCS[1]);
  const c1 = ownChips(b1).find((c) => c.id === gk.id);
  assert.equal(c1.color, undefined);
  assert.equal(c1.fnText, "HOMBRE");
  // un color elegido por el usuario no se toca
  assert.deepEqual(fnPatch(DEF_FUNCS[0], { color: "#123456" }), { fn: "zona", fnText: "ZONA" });
  assert.equal(fnPatch(GK_FN).color, GK_COLOR);
  // las fichas de ayer: color de su función fuera, función encima a su línea propia
  const old = { v: 2, frames: [{ id: "f", els: [{ id: "x", k: "token", team: "a", x: 1, y: 1, fn: "hombre", color: "#FFFFFF", stroke: "#73000A", topMode: "fn", labelTop: "HOMBRE" }, { id: "y", k: "token", team: "a", x: 2, y: 2, fn: "zona", color: "#00ff00" }] }] };
  const up = upgradeFunctions(old);
  const [x, y] = up.frames[0].els;
  assert.equal(x.color, undefined); assert.equal(x.stroke, undefined);
  assert.equal(x.labelTop, undefined); assert.equal(x.fnPos, "top"); assert.equal(x.fnText, "HOMBRE");
  assert.equal(y.color, "#00ff00");
  assert.equal(upgradeFunctions(up), up);
});
