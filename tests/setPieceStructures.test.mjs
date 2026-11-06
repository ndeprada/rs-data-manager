import test from "node:test";
import assert from "node:assert/strict";
import { squeezeForPrint, squeezeY, PRINT_LEN, printCrop, applyStructure, autoTitle, functionCounts, pieceSetup, setupLabel, hasSide, typeOf, setFunction, SP_STRUCTURES, DEF_FUNCS, ownChips, emptyPieceBoard, structuresFor } from "../src/lib/setPieceBoard.js";

let n = 0;
const newId = () => `n${++n}`;

test("tipo de jugada: se deduce de lo antiguo y se guarda el `type` de siempre", () => {
  const base = (o) => ({ drawSide: o.side === "l" ? "l" : "r", other: "", ...o });
  assert.deepEqual(pieceSetup({ type: "corner_contra" }), base({ kind: "corner", attack: false, side: "r" }));
  assert.deepEqual(pieceSetup({ type: "falta_contra" }), base({ kind: "falta_lateral", attack: false, side: "r" }));
  assert.deepEqual(pieceSetup({ type: "saque_banda" }), base({ kind: "banda", attack: true, side: "r" }));
  assert.deepEqual(pieceSetup({ kind: "corner", attack: true, side: "l", type: "corner_contra" }), base({ kind: "corner", attack: true, side: "l" }));
  // tipos nuevos (06/11/2026): saque de centro, penalti, otro con texto, y «ambos lados» sin girar el dibujo
  assert.equal(pieceSetup({ type: "saque_puerta" }).kind, "otro");
  assert.equal(pieceSetup({ type: "saque_puerta" }).other, "Saque de puerta");
  assert.equal(pieceSetup({ kind: "penalti", attack: true }).kind, "penalti");
  const both = pieceSetup({ kind: "corner", side: "both", draw_side: "l", attack: false });
  assert.equal(both.side, "both");
  assert.equal(both.drawSide, "l");
  assert.equal(hasSide("penalti"), false);
  assert.equal(hasSide("saque_centro"), false);
  assert.equal(hasSide("corner"), true);
  assert.equal(setupLabel(both), "Córner en contra · Ambos lados");
  assert.equal(setupLabel({ kind: "penalti", attack: true, side: "r" }), "Penalti a favor");
  assert.equal(setupLabel({ kind: "otro", attack: true, side: "l", other: "Saque de puerta" }), "Saque de puerta a favor · Lado izquierdo");
  assert.equal(setupLabel({ kind: "otro", attack: false, side: "r", other: "" }), "Otra jugada en contra · Lado derecho");
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

test("imprimir: el campo se recorta a la jugada y llena el hueco de la hoja", async () => {
  const { printCrop } = await import("../src/lib/setPieceBoard.js");
  const b = applyStructure(emptyPieceBoard(), SP_STRUCTURES.find((x) => x.id === "d-622"), { newId });
  const b2 = { ...b, look: "blanco" };
  const vb = printCrop(b2, 1.9);
  assert.ok(Math.abs(vb[2] / vb[3] - 1.9) < 0.02 || vb[2] >= 73.99);   // llena la proporción pedida o todo el ancho
  assert.ok(vb[3] < 52.5);                           // más corto que el medio campo entero
  // con pocas fichas cerca del área, la proporción exacta
  const few = { ...b2, frames: [{ ...b2.frames[0], els: b2.frames[0].els.filter((e) => e.k === "token" && e.y < 14) }] };
  const vf = printCrop(few, 1.9);
  assert.ok(Math.abs(vf[2] / vf[3] - 1.9) < 0.02);
  assert.ok(vb[1] <= -2.5);                          // con la portería
  // vertical (una por hoja): no puede salir del dibujo, se queda con el ancho del campo
  const one = printCrop(b2, 0.8);
  assert.ok(one[2] <= 74.01 && one[3] <= 58.51);
  // nunca se corta a lo ancho: las dos bandas siempre se ven
  for (const v of [vb, vf, one]) { assert.ok(v[0] <= -2.99); assert.ok(v[0] + v[2] >= 70.99); }
  // en horizontal también
  const h = printCrop({ ...b2, orient: "hi" }, 1.9);
  assert.ok(h[2] > 0 && h[3] > 0);
  assert.equal(printCrop({ ...b2, field: "free" }, 1.9), null);
  // «lo justo» (06/11/2026): no se alarga aunque el hueco sea alto, y nunca más largo que el normal
  const tight = printCrop(b2, 0.8, { tight: true });
  assert.ok(tight[1] + tight[3] >= 52.5 + 1.4);   // llega a la línea de medio campo (cerrado)
  assert.ok(tight[0] <= -2.99 && tight[0] + tight[2] >= 70.99);
  const tf = printCrop(few, 0.8, { tight: true });
  assert.ok(tf[1] + tf[3] >= 53.9 && tf[1] <= -2.5); // de la portería a medio campo
});

test("imprimir: campo más corto (`squeezeForPrint`)", () => {
  // el área y el arco no cambian; el tramo hasta medio campo se acorta y lo de más allá se desplaza
  assert.equal(squeezeY(5), 5);
  assert.equal(squeezeY(21), 21);
  assert.equal(squeezeY(52.5), PRINT_LEN / 2);
  assert.ok(squeezeY(36) > 21 && squeezeY(36) < 36);
  assert.equal(squeezeY(70), 70 - (52.5 - PRINT_LEN / 2));
  const b = { v: 2, field: "half", look: "blanco", orient: "v", frames: [{ id: "f", els: [
    { id: "t", k: "token", team: "a", x: 30, y: 10 }, { id: "u", k: "token", team: "a", x: 30, y: 45 },
    { id: "a", k: "arrow", x1: 30, y1: 45, x2: 30, y2: 12, cy: 30, cx: 30 },
    { id: "z", k: "zone", shape: "rect", x: 10, y: 20, w: 10, h: 20 },
  ] }] };
  const s = squeezeForPrint(b);
  assert.equal(s.pitchLen, PRINT_LEN);
  const els = Object.fromEntries(s.frames[0].els.map((e) => [e.id, e]));
  assert.equal(els.t.y, 10); assert.equal(els.t.x, 30);
  assert.ok(els.u.y < 45);
  assert.equal(els.a.y2, 12); assert.ok(els.a.y1 < 45 && els.a.cy < 30);
  assert.equal(els.z.y, 20); assert.ok(els.z.h < 20);
  // el recorte «justo» llega al nuevo medio campo, más corto que antes
  const crop = printCrop(s, 0.8, { tight: true });
  assert.ok(crop[1] + crop[3] >= PRINT_LEN / 2 + 1.4 && crop[1] + crop[3] < 52.5);
  // fútbol 7 y espacio libre no cambian
  assert.equal(squeezeForPrint({ ...b, field: "f7" }).pitchLen, undefined);
});

test("balón parado: la hoja va siempre delante (`withSheet`)", async () => {
  const { withSheet, pieceBoard, isAnimatedBoard } = await import("../src/lib/setPieceBoard.js");
  const one = withSheet({ v: 2, field: "half", frames: [{ id: "f1", els: [{ id: "t", k: "token", team: "a", x: 1, y: 1 }] }] });
  assert.equal(one.sheet, true);
  assert.equal(one.frames.length, 1);
  assert.equal(isAnimatedBoard(one), false);
  // una jugada antigua con animación la conserva entera y su hoja es una copia del primer fotograma
  const old = { v: 2, field: "half", frames: [{ id: "f1", els: [{ id: "t", k: "token", team: "a", x: 1, y: 1 }] }, { id: "f2", els: [{ id: "t", k: "token", team: "a", x: 5, y: 5 }] }] };
  const w = withSheet(old);
  assert.equal(w.frames.length, 3);
  assert.equal(w.frames[0].id, "f1-hoja");
  assert.deepEqual(w.frames[0].els, old.frames[0].els);
  assert.equal(w.frames[1].id, "f1");
  assert.equal(isAnimatedBoard(old), true);
  // ya con hoja: no se toca
  assert.equal(withSheet(w).frames.length, 3);
  assert.equal(pieceBoard({ board: old }).frames.length, 3);
  assert.equal(pieceBoard({ id: "x", tokens: [], arrows: [] }).sheet, true);
});

test("balón parado: propuesta de jugadores por función (`proposeSquad`)", async () => {
  const { proposeSquad, applyStructure, emptyPieceBoard, ownChips, SP_STRUCTURES } = await import("../src/lib/setPieceBoard.js");
  const pl = (id, position, n) => ({ id, first_name: id, last_name: "X", position, jersey_number: n });
  const squad = [pl("gk", "portero", 1), pl("c1", "central", 4), pl("c2", "central", 5), pl("dc", "delantero_centro", 9), pl("ex", "extremo", 7), pl("mc", "mediocentro", 8), pl("la", "lateral", 2), pl("in", "interior", 6), pl("mp", "mediapunta", 10), pl("l2", "lateral", 3), pl("e2", "extremo", 11)];
  let n = 0;
  const att = applyStructure(emptyPieceBoard(), SP_STRUCTURES.find((s) => s.id === "a-41"), { newId: () => `x${++n}` });
  const a = ownChips(proposeSquad(att, squad, true));
  const by = (fn) => a.filter((c) => c.fn === fn).map((c) => c.player_id);
  assert.deepEqual(by("lanzador"), ["ex"]);
  assert.ok(!a.some((c) => c.player_id === "gk"));                 // a favor, el portero no
  assert.ok(["c1", "c2", "dc"].every((id) => by("rematador").includes(id) || by("bloqueo").includes(id)));
  const def = applyStructure(emptyPieceBoard(), SP_STRUCTURES.find((s) => s.id === "d-622"), { newId: () => `y${++n}` });
  const d = ownChips(proposeSquad(def, squad, false));
  assert.deepEqual(d.filter((c) => c.fn === "portero").map((c) => c.player_id), ["gk"]);
});
