import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeBoard, hasBoard, addFrame, removeFrame, duplicateFrame, moveFrame, addElement, removeElement, patchElement,
  lerpFrames, ghostsOf, toView, fromView, fieldOf, hitTest, shiftElement, arrowPoints, emptyBoard, MAX_FRAMES, frameCount, changeField,
  FIELDS, teamsOf, teamOf, tokenColor, chipOf, tokenR, DEFAULT_CHIP, CHIP_RANGE, arrowFlight, arrowProps, dashArray, liftNormal, fontOf, setAllChips,
  isQuad, zoneBox, zoneCorners, zoneShapePatch, convexHull, linkShape, linkProps, orderForLine, pruneLinks, isCarried,
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

test("hitTest encuentra fichas, flechas y las zonas (por dentro si tienen relleno)", () => {
  const els = [{ id: "z", k: "zone", x: 10, y: 10, w: 20, h: 20 }, arrow("a1"), token("t1", 50, 50)];
  assert.equal(hitTest(els, { x: 50.5, y: 50 })?.id, "t1");
  assert.equal(hitTest(els, { x: 5, y: 1.5 })?.id, "a1");
  assert.equal(hitTest(els, { x: 10, y: 20 })?.id, "z");
  assert.equal(hitTest(els, { x: 20, y: 20 })?.id, "z", "una zona con relleno se agarra también por dentro");
  assert.equal(hitTest([{ ...els[0], fillOpacity: 0 }], { x: 20, y: 20 }), null, "sin relleno, el interior no se agarra");
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

test("hay cinco campos y uno desconocido cae en medio campo", () => {
  assert.deepEqual(FIELDS.map((f) => f.id), ["full", "tq", "half", "f7", "free"]);
  assert.equal(fieldOf("tq").h, 78.75);
  assert.equal(fieldOf("f7").w, 45);
  assert.equal(fieldOf("f7").h, 65);
  assert.equal(fieldOf("inventado").id, "half");
});

test("cinco equipos con color propio y los valores por defecto cuando faltan", () => {
  const base = teamsOf({});
  assert.equal(base.length, 5);
  assert.deepEqual(base.map((t) => t.id), ["a", "b", "c", "gk", "n"]);
  const b = { teams: [{ id: "b", name: "Rojos", color: "#ff0000" }, { id: "zz", name: "No existe", color: "#000" }] };
  const t = teamsOf(b);
  assert.equal(t.length, 5, "no se cuelan equipos que no existen");
  assert.equal(t.find((x) => x.id === "b").name, "Rojos");
  assert.equal(t.find((x) => x.id === "a").name, "Equipo A", "lo no cambiado conserva el valor por defecto");
  assert.equal(teamOf(b, "b").color, "#ff0000");
  assert.equal(tokenColor(b, { team: "b" }), "#ff0000");
  assert.equal(tokenColor(b, { team: "b", color: "#00ff00" }), "#00ff00", "el color propio de la ficha manda");
});

test("el tamaño de las fichas tiene un mínimo y un máximo y cada ficha puede ser mayor o menor", () => {
  assert.equal(chipOf({}), DEFAULT_CHIP);
  assert.equal(chipOf({ chipSize: 0.1 }), CHIP_RANGE[0]);
  assert.equal(chipOf({ chipSize: 99 }), CHIP_RANGE[1]);
  assert.equal(chipOf({ chipSize: 2 }), 2);
  assert.equal(tokenR(2, { size: 1.5 }), 3);
  assert.equal(tokenR(2, {}), 2);
});

test("normalizeBoard conserva los equipos y el tamaño de ficha elegidos", () => {
  const b = normalizeBoard({ v: 2, field: "f7", look: "color", orient: "h", chipSize: 2.2, teams: [{ id: "a", name: "Local", color: "#123456" }], frames: [{ id: "f", els: [] }] });
  assert.equal(b.chipSize, 2.2);
  assert.equal(teamOf(b, "a").name, "Local");
  assert.equal(b.field, "f7");
  assert.equal(normalizeBoard({ v: 2, frames: [] }).chipSize, undefined);
});

test("un pase aéreo se curva de lado, a mitad de camino lo máximo, y cae donde acaba la flecha", () => {
  const a = { k: "arrow", x1: 10, y1: 60, x2: 10, y2: 20, air: true, lift: 8 };
  const flat = arrowPoints(a, 24);
  const fly = arrowFlight(a, "v", 24);
  assert.equal(fly.length, flat.length);
  assert.deepEqual(fly[0], flat[0], "sale del suelo");
  assert.deepEqual(fly[24], flat[24], "cae en el mismo sitio");
  assert.equal(fly[12].y, flat[12].y, "un pase recto hacia arriba se curva hacia un lado, no a lo largo");
  assert.equal(fly[12].x, flat[12].x + 8, "del lado derecho de la pantalla");
  assert.deepEqual(arrowFlight({ ...a, lift: -8 }, "v", 24)[12], { x: flat[12].x - 8, y: flat[12].y }, "altura negativa = otro lado");
  assert.deepEqual(arrowFlight({ ...a, air: false }, "v", 24), flat, "sin aire, la trayectoria es la del suelo");
});

test("el vuelo se curva hacia arriba en pantalla cuando el pase va de lado, también con el campo girado", () => {
  const side = { x1: 10, y1: 40, x2: 50, y2: 40 };
  assert.deepEqual(liftNormal(side, "v"), { x: 0, y: -1 }, "campo vertical: arriba es y menor");
  const n = liftNormal({ x1: 40, y1: 10, x2: 40, y2: 50 }, "h");
  assert.deepEqual({ x: Math.abs(n.x), y: Math.abs(n.y) }, { x: 1, y: 0 }, "campo horizontal: un pase a lo largo del eje y va de lado en pantalla");
  assert.equal(n.x, 1, "y se curva hacia arriba en pantalla (x del campo mayor)");
  assert.deepEqual(liftNormal({ x1: 5, y1: 5, x2: 5, y2: 5 }, "v"), { x: 0, y: -1 }, "sin recorrido, hacia arriba");
});

test("los valores por defecto de las flechas antiguas se mantienen y los nuevos se respetan", () => {
  assert.deepEqual(arrowProps({ style: "pass" }), { width: 0.55, dash: "dashed", wavy: false, pointer: "arrow", border: false, alpha: 1 });
  assert.equal(arrowProps({ style: "dribble" }).wavy, true);
  assert.equal(arrowProps({ style: "move" }).dash, "solid");
  const custom = arrowProps({ style: "pass", dash: "dotted", width: 1.2, border: true, pointer: "bar", wavy: true });
  assert.deepEqual(custom, { width: 1.2, dash: "dotted", wavy: true, pointer: "bar", border: true, alpha: 1 });
  assert.equal(dashArray("solid", 1), undefined);
  assert.ok(dashArray("dashed", 1).includes(" "));
  assert.ok(dashArray("dotted", 1).startsWith("0.01"));
});

test("hitTest respeta el tamaño de la ficha, la rotación de la portería y la trayectoria aérea", () => {
  const small = { id: "s", k: "token", x: 20, y: 20, team: "a" };
  assert.equal(hitTest([small], { x: 22.4, y: 20 }, { chip: 0.8 }), null, "una ficha pequeña no se agarra desde lejos");
  assert.equal(hitTest([small], { x: 22.4, y: 20 }, { chip: 3 })?.id, "s");
  const goal = { id: "g", k: "goal", x: 30, y: 30, w: 6, rot: 90 };
  assert.equal(hitTest([goal], { x: 30, y: 32.5 })?.id, "g", "girada 90º, la portería se alarga en vertical");
  assert.equal(hitTest([goal], { x: 33, y: 30 }), null);
  const air = { id: "p", k: "arrow", style: "pass", x1: 10, y1: 40, x2: 50, y2: 40, air: true, lift: 10 };
  assert.equal(hitTest([air], { x: 30, y: 30 }, { orient: "v" })?.id, "p", "se agarra por la línea de vuelo (punto más alto)");
  assert.equal(hitTest([air], { x: 30, y: 40 }, { orient: "v" }), null, "pero no por el suelo, donde solo hay sombra");
});

test("tipografías conocidas y una de reserva", () => {
  assert.ok(fontOf("serif").includes("Georgia"));
  assert.ok(fontOf("no-existe").includes("Arial"));
});

test("«todas las fichas» las deja exactamente del mismo tamaño, también las que tenían uno propio", () => {
  let b = emptyBoard("full");
  b = addElement(b, 0, { ...token("t1", 10, 10), size: 0.6 });
  b = addElement(b, 0, { ...token("t2", 20, 10), size: 0.8 });
  b = addElement(b, 0, token("t3", 30, 10));
  b = addElement(b, 0, { id: "b1", k: "ball", x: 5, y: 5, size: 1.4 });
  b = addFrame(b, 0).board;
  const r = setAllChips(b, 1.2);
  assert.equal(r.chipSize, 1.2);
  for (const f of r.frames) {
    const sizes = f.els.filter((e) => e.k === "token").map((e) => tokenR(chipOf(r), e));
    assert.deepEqual(sizes, [1.2, 1.2, 1.2], "todas iguales en cada fotograma");
  }
  assert.equal(r.frames[0].els.find((e) => e.k === "ball").size, 1.4, "el balón no cambia");
  assert.equal(b.frames[0].els[0].size, 0.6, "el original no se toca");
  assert.equal(setAllChips(b, 99).chipSize, CHIP_RANGE[1]);
  assert.equal(setAllChips(b, 0.1).chipSize, CHIP_RANGE[0]);
});

// ── Zonas que se pueden mover, zona de cuatro esquinas y conectores ────────────────────────────────────────────────────

const rectZone = (o = {}) => ({ id: "z1", k: "zone", shape: "rect", x: 10, y: 10, w: 20, h: 12, ...o });

test("una zona con relleno se agarra por dentro; sin relleno, solo por el borde; una ficha encima manda", () => {
  const z = rectZone();
  assert.equal(hitTest([z], { x: 20, y: 16 })?.id, "z1", "por dentro");
  assert.equal(hitTest([z], { x: 10.5, y: 16 })?.id, "z1", "por el borde");
  assert.equal(hitTest([z], { x: 40, y: 16 }), null, "fuera");
  const hollow = rectZone({ fillOpacity: 0 });
  assert.equal(hitTest([hollow], { x: 20, y: 16 }), null, "sin relleno, el interior no se agarra");
  assert.equal(hitTest([hollow], { x: 10.5, y: 16 })?.id, "z1");
  const t = token("t1", 20, 16);
  assert.equal(hitTest([z, t], { x: 20, y: 16 })?.id, "t1", "la ficha va por encima de la zona");
});

test("una elipse no se agarra por las esquinas de su rectángulo", () => {
  const e = rectZone({ shape: "ellipse" });
  assert.equal(hitTest([e], { x: 20, y: 16 })?.id, "z1");
  assert.equal(hitTest([e], { x: 10.6, y: 10.6 }), null, "esquina vacía");
});

test("una zona también se agarra si se dibujó hacia arriba o a la izquierda (w y h negativos)", () => {
  const z = rectZone({ x: 30, y: 22, w: -20, h: -12 });
  assert.equal(hitTest([z], { x: 20, y: 16 })?.id, "z1");
  assert.deepEqual(zoneBox(z), { x0: 10, y0: 10, x1: 30, y1: 22 });
});

test("zona de cuatro esquinas: se agarra, se mueve entera y se pasa de rectángulo a libre y vuelta", () => {
  const z = rectZone();
  const toQuad = { ...z, ...zoneShapePatch(z, "quad") };
  assert.ok(isQuad(toQuad));
  assert.equal(toQuad.pts.length, 4);
  assert.deepEqual(zoneBox(toQuad), { x0: 10, y0: 10, x1: 30, y1: 22 });
  // se tuerce una esquina: trapecio
  const trap = { ...toQuad, pts: [{ x: 14, y: 10 }, { x: 26, y: 10 }, { x: 30, y: 22 }, { x: 10, y: 22 }] };
  assert.equal(hitTest([trap], { x: 20, y: 16 })?.id, "z1", "por dentro");
  assert.equal(hitTest([trap], { x: 11, y: 11 }), null, "el hueco que deja el trapecio en la esquina no se agarra");
  const moved = shiftElement(trap, 5, -3);
  assert.deepEqual(moved.pts[0], { x: 19, y: 7 });
  assert.deepEqual(trap.pts[0], { x: 14, y: 10 }, "el original no se toca");
  const back = { ...trap, ...zoneShapePatch(trap, "rect") };
  assert.equal(back.shape, "rect");
  assert.equal(back.pts, undefined);
  assert.deepEqual([back.x, back.y, back.w, back.h], [10, 10, 20, 12]);
  assert.deepEqual(zoneCorners(z).length, 4);
});

test("al cambiar de campo, las esquinas de una zona libre se reescalan", () => {
  const z = { id: "q", k: "zone", shape: "quad", pts: [{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 20 }, { x: 10, y: 20 }] };
  const b = changeField(addElement(emptyBoard("full"), 0, z), "half");
  const q = b.frames[0].els[0];
  assert.ok(isQuad(q));
  assert.equal(q.pts[2].y, 10, "20 m de 105 pasan a 10 m de 52,5");
  assert.equal(q.pts[2].x, 30);
});

test("la envolvente convexa deja fuera los puntos de dentro", () => {
  const hull = convexHull([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 5, y: 5 }, { x: 5, y: 0 }]);
  assert.equal(hull.length, 4);
  assert.ok(!hull.some((p) => p.x === 5));
});

test("una línea defensiva se une de un extremo al otro aunque se elijan las fichas desordenadas", () => {
  const field = fieldOf("full");
  const line = [token("d3", 40, 70), token("d1", 10, 72), token("d4", 58, 69), token("d2", 25, 71)];
  assert.deepEqual(orderForLine(line, field, "v"), ["d1", "d2", "d3", "d4"]);
  // en horizontal, de izquierda a derecha en pantalla = de y menor a mayor... la fila va a lo largo de x del campo, que sube en pantalla
  const h = orderForLine(line, field, "h");
  assert.equal(h.length, 4);
  assert.deepEqual([...h].sort(), ["d1", "d2", "d3", "d4"]);
  assert.deepEqual(orderForLine(line.slice(0, 2), field, "v"), ["d3", "d1"], "con dos fichas se respeta el orden elegido");
});

test("el conector sale de dónde están las fichas: línea, zona o red", () => {
  const els = [token("a", 10, 10), token("b", 30, 10), token("c", 30, 30), token("d", 10, 30), token("e", 20, 20)];
  const base = { id: "l1", k: "link", ids: ["a", "b", "c", "d", "e"] };
  const line = linkShape({ ...base, mode: "line" }, els);
  assert.equal(line.kind, "line");
  assert.equal(line.pts.length, 5);
  assert.equal(line.closed, false);
  assert.equal(linkShape({ ...base, mode: "line", closed: true }, els).closed, true);
  const zone = linkShape({ ...base, mode: "zone" }, els);
  assert.equal(zone.kind, "zone");
  assert.equal(zone.poly.length, 4, "la ficha del centro queda dentro del contorno");
  const mesh = linkShape({ ...base, mode: "mesh" }, els);
  assert.equal(mesh.segs.length, 10, "5 fichas → 10 uniones");
  // sigue a las fichas
  const moved = els.map((e) => (e.id === "e" ? { ...e, x: 45, y: 20 } : e));
  assert.equal(linkShape({ ...base, mode: "zone" }, moved).poly.length, 5, "al sacar una ficha del cuadrado, el contorno la incluye");
  // sin fichas suficientes no hay nada que pintar
  assert.equal(linkShape({ ...base, ids: ["a"] }, els), null);
  assert.equal(linkShape({ ...base, ids: ["a", "zz"] }, els), null);
  // tres fichas en fila no hacen una zona: queda como línea
  assert.equal(linkShape({ id: "l2", k: "link", mode: "zone", ids: ["a", "b", "x"] }, [...els, token("x", 50, 10)]).kind, "line");
  assert.equal(linkProps({}).mode, "line");
  assert.equal(linkProps({ mode: "zone" }).fillOpacity, 0.18);
});

test("el conector se agarra por su línea, o por dentro si es una zona rellena, y las fichas van por encima", () => {
  const els = [token("a", 10, 10), token("b", 30, 10), token("c", 20, 30)];
  const line = { id: "l", k: "link", mode: "line", ids: ["a", "b", "c"] };
  assert.equal(hitTest([...els, line], { x: 20, y: 10.5 })?.id, "l");
  assert.equal(hitTest([...els, line], { x: 20, y: 20 }), null, "una línea no se agarra por dentro");
  const zone = { ...line, mode: "zone" };
  assert.equal(hitTest([zone, ...els], { x: 20, y: 18 })?.id, "l");
  assert.equal(hitTest([zone, ...els], { x: 10, y: 10 })?.id, "a", "la ficha manda sobre el conector");
  assert.equal(shiftElement(line, 5, 5), line, "un conector no se desplaza solo");
});

test("un conector va en todos los fotogramas, no desaparece al animar y se limpia si se quitan sus fichas", () => {
  let b = emptyBoard("full");
  b = addElement(b, 0, token("a", 10, 10));
  b = addElement(b, 0, token("b", 30, 10));
  b = addElement(b, 0, token("c", 20, 30));
  b = addFrame(b, 0).board;
  const link = { id: "l", k: "link", mode: "zone", ids: ["a", "b", "c"] };
  assert.ok(isCarried(link));
  b = addElement(b, 0, link);
  assert.deepEqual(b.frames.map((f) => f.els.filter((e) => e.k === "link").length), [1, 1], "entra en los dos fotogramas");
  // un fotograma nuevo lo hereda
  assert.equal(addFrame(b, 1).board.frames[2].els.some((e) => e.id === "l"), true);
  // animación: las fichas se mueven y el conector se queda una sola vez, sin fundirse
  b = patchElement(b, 1, "c", { x: 40, y: 50 });
  const mid = lerpFrames(b.frames[0], b.frames[1], 0.5);
  assert.equal(mid.filter((e) => e.id === "l").length, 1);
  assert.equal(mid.find((e) => e.id === "l").opacity, 1);
  // quitar una ficha de todos los fotogramas: el conector se queda con dos
  const two = removeElement(b, 0, "c");
  assert.deepEqual(two.frames[0].els.find((e) => e.k === "link").ids, ["a", "b"]);
  // quitar otra: sin pareja, desaparece
  const none = removeElement(two, 0, "b");
  assert.equal(none.frames.some((f) => f.els.some((e) => e.k === "link")), false);
  // quitar una ficha solo de un fotograma afecta solo al conector de ese fotograma
  const here = removeElement(b, 1, "c", { onlyHere: true });
  assert.equal(here.frames[0].els.find((e) => e.k === "link").ids.length, 3);
  assert.equal(here.frames[1].els.find((e) => e.k === "link").ids.length, 2);
  assert.equal(pruneLinks(b), b, "sin cambios, no se rehace nada");
  // las fotos duplicadas conservan los conectores
  assert.ok(duplicateFrame(b, 0).board.frames[1].els.some((e) => e.id === "l"));
});

test("al cambiar de campo un conector queda tal cual (no tiene coordenadas propias)", () => {
  let b = emptyBoard("full");
  b = addElement(b, 0, token("a", 10, 10));
  b = addElement(b, 0, token("b", 30, 10));
  b = addElement(b, 0, { id: "l", k: "link", mode: "line", ids: ["a", "b"] });
  const r = changeField(b, "half");
  const l = r.frames[0].els.find((e) => e.k === "link");
  assert.deepEqual(l.ids, ["a", "b"]);
  assert.equal(Number.isNaN(l.x), false);
  assert.ok(!("x" in l));
});
