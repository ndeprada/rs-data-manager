import test from "node:test";
import assert from "node:assert/strict";
import { cleanVariant, railOf, keyAllowed, topTextFor, topPatch, topModeOf, tacticPlayerPatch, posShort, edgeStepOf, cleanCardTab } from "../src/lib/boardVariant.js";

test("versiones: tareas por defecto y barra de cada una", () => {
  assert.equal(cleanVariant("xx"), "tareas");
  assert.equal(cleanVariant("abp"), "abp");
  assert.deepEqual(railOf("tareas"), { material: true, link: true, camera: true, newTeam: true });
  assert.equal(railOf("tactica").material, false);
  assert.equal(railOf("tactica").camera, true);
  assert.deepEqual(railOf("abp"), { material: false, link: false, camera: false, newTeam: false });
});

test("atajos de herramientas que la versión no tiene", () => {
  assert.equal(keyAllowed("tareas", "material"), true);
  assert.equal(keyAllowed("tactica", "material"), false);
  assert.equal(keyAllowed("tactica", "cycleMaterial"), false);
  assert.equal(keyAllowed("abp", "link"), false);
  assert.equal(keyAllowed("abp", "camera"), false);
  assert.equal(keyAllowed("abp", "arrow"), true);
  assert.equal(keyAllowed("abp", "undo"), true);
});

test("texto de encima de la ficha", () => {
  const el = { pos: "interior", labelTop: "OJO" };
  assert.equal(topTextFor("pos", el), "INT");
  assert.equal(topTextFor("rol", el, { rol: "Organizador" }), "ORGANIZADOR");
  assert.equal(topTextFor("fn", el, { fn: "Hombre" }), "HOMBRE");
  assert.equal(topTextFor("none", el), undefined);
  assert.equal(topTextFor("text", el), "OJO");
  assert.deepEqual(topPatch("pos", el), { topMode: "pos", labelTop: "INT" });
  assert.equal(topModeOf({ labelTop: "X" }), "text");
  assert.equal(topModeOf({}), "none");
  assert.equal(topModeOf({}, "fn"), "fn");
  assert.equal(topModeOf({ topMode: "rol", labelTop: "X" }), "rol");
  assert.equal(posShort("delantero_centro"), "DC");
});

test("táctica: elegir jugador de la plantilla", () => {
  const p = { id: "p1", label: "Leo S.", number: 10, position: "interior" };
  assert.deepEqual(tacticPlayerPatch({}, p), { player_id: "p1", label: "Leo S.", pos: "interior", inner: "10", topMode: "pos", labelTop: "INT" });
  // si ya tenía puesto y un texto propio encima, no se toca
  const kept = tacticPlayerPatch({ pos: "extremo", labelTop: "OJO", topMode: "text" }, p);
  assert.equal(kept.pos, "extremo");
  assert.equal(kept.labelTop, undefined);
  // sin dorsal no se borra el número que tenía
  assert.equal("inner" in tacticPlayerPatch({}, { id: "p2", label: "X", position: "rara" }), false);
  assert.equal(tacticPlayerPatch({}, { id: "p2", label: "X", position: "rara" }).pos, undefined);
  assert.deepEqual(tacticPlayerPatch({ player_id: "p1" }, null), { player_id: undefined });
});

test("borde en cuatro pasos y pestaña de la tarjeta", () => {
  assert.equal(edgeStepOf(undefined), "normal");
  assert.equal(edgeStepOf(0), "sin");
  assert.equal(edgeStepOf(0.5), "fino");
  assert.equal(edgeStepOf(2.5), "grueso");
  assert.equal(cleanCardTab("letra"), "letra");
  assert.equal(cleanCardTab("x"), "jugador");
});

test("la tarjeta se coloca en el hueco más libre", async () => {
  const { placeCard } = await import("../src/lib/boardVariant.js");
  const base = { x: 500, y: 400, rs: 20, W: 300, H: 380, boxW: 1200, boxH: 800 };
  // sin nada alrededor: a la derecha
  const a = placeCard(base);
  assert.equal(a.left, 534);
  // muchas fichas a la derecha: se va a la izquierda
  const right = Array.from({ length: 8 }, (_, i) => ({ x: 600 + i * 20, y: 380 + i * 10 }));
  const b = placeCard({ ...base, points: right });
  assert.ok(b.left + 300 <= 500);
  assert.equal(b.covered, 0);
  // pegada al borde derecho: nunca tapa la propia ficha y no se sale
  const c = placeCard({ ...base, x: 1180 });
  assert.ok(c.left + 300 <= 1200 - 4);
  assert.ok(!(1180 >= c.left && 1180 <= c.left + 300 && 400 >= c.top && 400 <= c.top + 380));
});
