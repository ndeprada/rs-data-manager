import test from "node:test";
import assert from "node:assert/strict";
import { applyBoardDefaults, brushWithDefaults, cleanDefaults, describeDefaults, withElementDefault, toolOfElement } from "../src/lib/boardDefaults.js";
import { emptyBoard, teamsOf } from "../src/lib/board.js";

test("guardar el aspecto de una cosa como predeterminado de su herramienta", () => {
  let d = withElementDefault({}, { id: "z", k: "zone", x: 1, y: 1, w: 5, h: 5, fill: "#ffffff", fillOpacity: 0.2, border: false });
  assert.deepEqual(d.brush.zone, { fill: "#ffffff", fillOpacity: 0.2, border: false });
  d = withElementDefault(d, { id: "b", k: "ball", x: 3, y: 3, size: 0.4 });
  assert.equal(d.brush.ball.size, 0.4);
  assert.equal(d.brush.ball.x, undefined, "nunca la posición");
  d = withElementDefault(d, { id: "a", k: "arrow", style: "pass", x1: 0, y1: 0, x2: 4, y2: 4, width: 0.3, dash: "dotted" });
  assert.deepEqual(d.brush.pass, { width: 0.3, dash: "dotted", curved: false, bends: false });
  // ficha: el tamaño de todas las fichas y los colores de su equipo
  d = withElementDefault(d, { id: "t", k: "token", team: "b", x: 1, y: 1 }, { chipSize: 0.9, team: { id: "b", name: "Azul", color: "#123456", pattern: "stripes" } });
  assert.equal(d.chipSize, 0.9);
  assert.deepEqual(d.teams.b, { color: "#123456", pattern: "stripes" });
  assert.deepEqual(describeDefaults(d), ["fichas al 60 %", "colores de 1 equipo", "zona", "balón", "pase"]);
});

test("los pinceles del editor y los dibujos vacíos toman los predeterminados", () => {
  const base = { ball: { pattern: "classic" }, zone: {} };
  const b = brushWithDefaults(base, { brush: { ball: { size: 0.5 }, zone: { fill: "#fff", fillOpacity: 0.1 } } });
  assert.deepEqual(b.ball, { pattern: "classic", size: 0.5 });
  assert.deepEqual(b.zone, { fill: "#fff", fillOpacity: 0.1 });
  const empty = emptyBoard("full");
  const out = applyBoardDefaults(empty, { chipSize: 0.8, teams: { a: { color: "#000000" } } });
  assert.equal(out.chipSize, 0.8);
  assert.equal(teamsOf(out).find((t) => t.id === "a").color, "#000000");
  // un dibujo con cosas no se toca
  const full = { ...empty, frames: [{ id: "f", els: [{ id: "t", k: "token", x: 1, y: 1, team: "a" }] }] };
  assert.equal(applyBoardDefaults(full, { chipSize: 0.8 }), full);
});

test("se limpia lo que llega del perfil o del navegador", () => {
  assert.deepEqual(cleanDefaults({ chipSize: 99, brush: { nada: { size: 1 }, ball: { size: 0.5, x: { malo: 1 } } }, teams: { "<script>": { color: "red" } } }), { brush: { ball: { size: 0.5 } } });
  assert.deepEqual(cleanDefaults("hola"), {});
  assert.equal(toolOfElement({ k: "zone", pts: [] }), "quad");
  assert.equal(toolOfElement({ k: "arrow", air: true }), "air");
});
