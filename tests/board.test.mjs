import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeBoard, hasBoard, addFrame, removeFrame, duplicateFrame, moveFrame, addElement, removeElement, patchElement,
  lerpFrames, ghostsOf, toView, fromView, fieldOf, hitTest, shiftElement, arrowPoints, emptyBoard, MAX_FRAMES, frameCount, changeField,
  FIELDS, teamsOf, teamOf, tokenColor, chipOf, tokenR, DEFAULT_CHIP, CHIP_RANGE, arrowFlight, arrowProps, dashArray, liftNormal, fontOf, setAllChips,
  isQuad, zoneBox, zoneCorners, zoneShapePatch, convexHull, linkShape, linkProps, orderForLine, pruneLinks, isCarried,
  LOOKS, lookOf, ORIENTS, orientOf, orientAngle, viewBox, fieldTurn, upVec, MAX_TEAMS, DEFAULT_TEAMS, addTeam, removeTeam, teamInUse, chipStyle, contrastColor, CHIP_PATTERNS,
  MATERIALS, materialOf, ladderRungs, faceOf, faceToward, setAllFeet, ballStyle, BALL_PATTERNS, isLinkable, byRank,
  boardMode, isAnimation, boardSpeed, animationDuration, elsAtTime, ANIM_HOLD,
  drawOrder, hasLayers, placeElement, moveLayer, elementBounds, elementsInBox, resizeElements, spreadElements, recolorElements, setTeamOf, setFeetOf, removeElements, viewDelta, alignElements, distributeElements, stepLayer, moveLayerTo, nudgeElements,
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

test("un fotograma nuevo sigue con todo lo que había (como en FmStadio): fichas y también flechas, zonas y textos", () => {
  let b = emptyBoard();
  b = addElement(b, 0, token("t1", 10, 10));
  b = addElement(b, 0, arrow("a1"));
  const r = addFrame(b, 0);
  assert.equal(r.index, 1);
  assert.deepEqual(r.board.frames[1].els.map((e) => e.id).sort(), ["a1", "t1"]);
  assert.equal(r.board.frames[0].els.length, 2);
});

test("desaparece desde este fotograma: sigue en los anteriores y se va de este y los siguientes", () => {
  let b = emptyBoard();
  b = addElement(b, 0, arrow("a1"));
  b = addFrame(b, 0).board;
  b = addFrame(b, 1).board;
  const r = removeElement(b, 1, "a1", { fromHere: true });
  assert.deepEqual(r.frames.map((f) => f.els.length), [1, 0, 0]);
  // «Quitar» lo quita de todos
  assert.deepEqual(removeElement(b, 1, "a1").frames.map((f) => f.els.length), [0, 0, 0]);
  // una flecha nueva en el fotograma 2 entra ahí y en los siguientes, no en los anteriores
  const n = addElement(b, 1, arrow("a2"));
  assert.deepEqual(n.frames.map((f) => f.els.some((e) => e.id === "a2")), [false, true, true]);
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
  // la copia conserva el id de flechas, zonas y textos: así, si se mueven en la copia, se deslizan al reproducir
  assert.equal(d.board.frames[1].els.find((e) => e.k === "arrow").id, "a1");
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

test("campos (también fútbol sala, fútbol 4 y rectángulo) y uno desconocido cae en medio campo", () => {
  assert.deepEqual(FIELDS.map((f) => f.id), ["full", "tq", "half", "f7", "futsal", "f4", "rect", "free"]);
  assert.deepEqual([fieldOf("futsal").w, fieldOf("futsal").h], [20, 40]);
  assert.deepEqual(["full", "tq", "half", "f7", "futsal", "f4", "rect", "free", "inventado"].map((id) => BS.fieldKind(id)), ["f11", "f11", "f11", "f7", "futsal", "f4", "rect", "free", "f11"]);
  assert.equal(fieldOf("tq").h, 78.75);
  assert.equal(fieldOf("f7").w, 45);
  assert.equal(fieldOf("f7").h, 65);
  assert.equal(fieldOf("inventado").id, "half");
});

test("cuatro equipos de partida con color propio; Neutro solo si un dibujo antiguo lo usa", () => {
  const base = teamsOf({});
  assert.deepEqual(base.map((t) => t.id), ["a", "b", "c", "gk"]);
  assert.deepEqual(base.map((t) => t.color), ["#73000A", "#2563eb", "#f59e0b", "#16a34a"], "granate, azul, amarillo comodín y verde portero");
  const b = { teams: [{ id: "b", name: "Rojos", color: "#ff0000" }] };
  const t = teamsOf(b);
  assert.equal(t.length, 4);
  assert.equal(t.find((x) => x.id === "b").name, "Rojos");
  assert.equal(t.find((x) => x.id === "a").name, "Equipo A", "lo no cambiado conserva el valor por defecto");
  assert.equal(teamOf(b, "b").color, "#ff0000");
  assert.equal(tokenColor(b, { team: "b" }), "#ff0000");
  assert.equal(tokenColor(b, { team: "b", color: "#00ff00" }), "#00ff00", "el color propio de la ficha manda");
  const old = { frames: [{ els: [token("x", 1, 1, "n")] }] };
  assert.deepEqual(teamsOf(old).map((x) => x.id), ["a", "b", "c", "gk", "n"], "el Neutro de los dibujos antiguos sigue existiendo");
});

test("equipos nuevos: se crean con color distinto, se limitan y solo se quitan los propios sin fichas", () => {
  let b = emptyBoard();
  const r = addTeam(b);
  assert.equal(r.id, "t1");
  b = r.board;
  const nuevo = teamsOf(b).find((t) => t.id === "t1");
  assert.equal(nuevo.name, "Equipo 5");
  assert.ok(!DEFAULT_TEAMS.some((d) => d.color.toLowerCase() === nuevo.color.toLowerCase()), "el color no repite el de otro equipo");
  assert.equal(addTeam(b).id, "t2");
  const withTok = addElement(b, 0, token("p", 5, 5, "t1"));
  assert.ok(teamInUse(withTok, "t1"));
  assert.equal(removeTeam(withTok, "t1"), withTok, "con fichas no se quita");
  assert.equal(removeTeam(b, "a"), b, "los de partida no se quitan");
  assert.deepEqual(teamsOf(removeTeam(b, "t1")).map((t) => t.id), ["a", "b", "c", "gk"]);
  let full = emptyBoard();
  for (let i = 0; i < MAX_TEAMS + 3; i++) full = addTeam(full).board;
  assert.equal(teamsOf(full).length, MAX_TEAMS);
  assert.equal(addTeam(full).id, null);
});

test("diseño de ficha: lo del equipo, y lo propio de la ficha manda; el texto contrasta con el relleno", () => {
  const b = { teams: [{ id: "a", name: "A", color: "#73000A", pattern: "sash", color2: "#ffffff", stroke: "#facc15" }] };
  assert.deepEqual(chipStyle(b, { team: "a" }), { pattern: "sash", color: "#73000A", color2: "#ffffff", stroke: "#facc15", kit: "boton", trim: "#ffffff", edge: 1 });
  const own = chipStyle(b, { team: "a", pattern: "v", color: "#2563eb", color2: "#000000", stroke: "#ffffff" });
  assert.deepEqual(own, { pattern: "v", color: "#2563eb", color2: "#000000", stroke: "#ffffff", kit: "boton", trim: "#000000", edge: 1 });
  const shirt = chipStyle({ teams: [{ id: "a", color: "#ffffff", kit: "camiseta", trim: "#73000A" }] }, { team: "a" });
  assert.equal(shirt.kit, "camiseta");
  assert.equal(shirt.trim, "#73000A");
  const plain = chipStyle({}, { team: "b" });
  assert.equal(plain.pattern, "solid");
  assert.equal(plain.stroke, null, "sin borde propio se usa el del modo visual");
  // grosor del borde (03/11/2026): de la ficha, o del equipo; 0 = sin borde; entre 0 y 3
  assert.equal(chipStyle({ teams: [{ id: "a", edge: 2 }] }, { team: "a" }).edge, 2);
  assert.equal(chipStyle({ teams: [{ id: "a", edge: 2 }] }, { team: "a", edge: 0 }).edge, 0);
  assert.equal(chipStyle({}, { team: "a", edge: 9 }).edge, 3);
  assert.equal(contrastColor("#73000A"), "#ffffff");
  assert.equal(contrastColor("#fde047"), "#111827");
  assert.equal(contrastColor("no-es-un-color"), "#111827");
  assert.ok(CHIP_PATTERNS.length >= 5 && CHIP_PATTERNS[0].id === "solid");
});

test("modos visuales (nueve de estadio) y uno desconocido cae en blanco", () => {
  assert.deepEqual(LOOKS.map((l) => l.id), ["blanco", "blanco-liso", "blanco-cuadros", "color", "color-cuadros", "bn", "estadio", "estadio-noche",
    "estadio-bosque", "estadio-electrico", "estadio-cielo", "estadio-morado", "estadio-neon", "estadio-negro", "estadio-invierno"]);
  assert.equal(LOOKS.filter((l) => BS.isStadium(l.id)).length, 9);
  assert.equal(BS.marginOf("estadio-neon", {}), BS.STADIUM_MARGIN);
  assert.equal(lookOf("color-cuadros"), "color-cuadros");
  assert.equal(lookOf("inventado"), "blanco");
  assert.equal(normalizeBoard({ v: 2, field: "tq", look: "blanco-liso", frames: [{ els: [] }] }).look, "blanco-liso");
});

test("cuatro orientaciones del campo: ida y vuelta de puntos, vista y arriba en pantalla", () => {
  const f = fieldOf("full");
  const p = { x: 20, y: 30 };
  assert.deepEqual(ORIENTS.map((o) => o.id), ["v", "vi", "h", "hi"]);
  for (const o of ["v", "vi", "h", "hi"]) assert.deepEqual(fromView(f, o, toView(f, o, p)), p, `ida y vuelta en ${o}`);
  assert.deepEqual(toView(f, "vi", p), { x: 48, y: 75 });
  assert.deepEqual(toView(f, "hi", p), { x: 75, y: 20 });
  assert.deepEqual(toView(f, "hi", { x: 0, y: 0 }), { x: 105, y: 0 }, "en horizontal derecha la portería a atacar queda a la derecha");
  assert.deepEqual(toView(f, "h", { x: 0, y: 0 }), { x: 0, y: 68 }, "en horizontal izquierda queda a la izquierda");
  assert.deepEqual(toView(f, "vi", { x: 34, y: 0 }), { x: 34, y: 105 }, "en vertical invertido queda abajo");
  assert.deepEqual(viewBox(f, "hi"), viewBox(f, "h"));
  assert.deepEqual(viewBox(f, "vi"), viewBox(f, "v"));
  assert.equal(viewBox(f, "h")[2], 111);
  assert.equal(orientOf("raro"), "v");
  assert.deepEqual([orientAngle("v"), orientAngle("vi"), orientAngle("h"), orientAngle("hi")], [0, 180, -90, 90]);
  assert.equal(fieldTurn(f, "v"), undefined);
  assert.equal(normalizeBoard({ v: 2, field: "full", orient: "hi", frames: [{ els: [] }] }).orient, "hi");
  assert.equal(normalizeBoard({ v: 2, field: "full", orient: "zz", frames: [{ els: [] }] }).orient, "v");
  // «arriba en pantalla» coincide con lo que dibuja toView: un paso hacia arriba en pantalla cae en el vector upVec del campo
  for (const o of ["v", "vi", "h", "hi"]) {
    const a = toView(f, o, { x: 30, y: 50 }), u = upVec(o);
    const b = toView(f, o, { x: 30 + u.x, y: 50 + u.y });
    assert.ok(b.y < a.y && Math.abs(b.x - a.x) < 1e-9, `arriba en ${o}`);
  }
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

test("los valores por defecto de las flechas (grosor 0,4 desde el 03/11/2026) y los nuevos se respetan", () => {
  assert.deepEqual(arrowProps({ style: "pass" }), { width: 0.4, dash: "solid", wavy: false, pointer: "arrow", border: false, alpha: 1 });
  assert.equal(arrowProps({ style: "dribble" }).wavy, true);
  assert.equal(arrowProps({ style: "move" }).dash, "dashed");
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

test("el conector une las fichas en el orden de sus ids, sea cual sea su posición", () => {
  const els = [token("a", 10, 10), token("b", 50, 10), token("c", 30, 10)];
  const l = { id: "l", k: "link", mode: "line", ids: ["b", "a", "c"] };
  const g = linkShape(l, els);
  assert.deepEqual(g.pts.map((p) => p.x), [50, 10, 30], "la línea va b → a → c, no la más cercana");
  assert.deepEqual(linkShape({ ...l, closed: true }, els).closed, true);
});

test("material nuevo (pica, valla, escalera, maniquí): se mueve, se agarra girado y por encima o debajo según su tipo", () => {
  assert.deepEqual(MATERIALS.map((m) => m.id), ["pole", "hurdle", "ladder", "dummy"]);
  assert.equal(materialOf("ladder").label, "Escalera");
  assert.equal(materialOf("goal"), null);
  for (const k of ["pole", "hurdle", "ladder", "dummy"]) assert.ok(isCarried({ k }), `${k} pasa de un fotograma a otro`);
  const ladder = { id: "l", k: "ladder", x: 30, y: 40, rot: 0 };
  assert.equal(hitTest([ladder], { x: 30, y: 42.5 }).id, "l", "extremo largo de la escalera");
  assert.equal(hitTest([ladder], { x: 35, y: 40 }), null, "fuera por el lado");
  const turned = { ...ladder, rot: 90 };
  assert.equal(hitTest([turned], { x: 33, y: 40 })?.id, "l", "girada 90° se extiende a lo ancho");
  assert.equal(hitTest([turned], { x: 30, y: 42.5 }), null);
  const big = { ...ladder, size: 2 };
  assert.equal(hitTest([big], { x: 30, y: 45 })?.id, "l", "el tamaño agranda la zona de agarre");
  assert.equal(ladderRungs({}), 8);
  assert.equal(ladderRungs({ rungs: 99 }), 12);
  assert.equal(ladderRungs({ rungs: 1 }), 4);
  assert.ok(byRank({ k: "ladder" }, { k: "token" }) < 0, "la escalera queda por debajo de las fichas");
  assert.ok(isLinkable({ k: "pole" }) && isLinkable({ k: "dummy" }) && !isLinkable({ k: "ladder" }));
  assert.deepEqual(shiftElement(ladder, 2, -3), { ...ladder, x: 32, y: 37 });
  const wide = changeField({ ...emptyBoard("full"), frames: [{ id: "f", els: [{ id: "h", k: "hurdle", x: 34, y: 52.5 }] }] }, "half");
  assert.equal(wide.frames[0].els[0].x, 34);
  assert.equal(wide.frames[0].els[0].y, 26.3, "al cambiar de campo se reescala como el resto");
});

test("pies y orientación de la ficha: ángulo hacia donde apunta el dedo, por fotograma, y la animación gira por el camino corto", () => {
  assert.equal(faceOf({}), 0);
  assert.equal(faceOf({ face: -90 }), 270);
  assert.equal(faceOf({ face: 450 }), 90);
  const from = { x: 20, y: 20 };
  assert.equal(faceToward(from, { x: 20, y: 5 }), 0, "hacia arriba = a la portería a atacar");
  assert.equal(faceToward(from, { x: 35, y: 20 }), 90);
  assert.equal(faceToward(from, { x: 20, y: 40 }), 180);
  assert.equal(faceToward(from, { x: 5, y: 20 }), 270);
  assert.equal(faceToward(from, { x: 21, y: 4 }) % 5, 0, "se ajusta de 5 en 5 grados");
  const a = { id: "f1", els: [{ ...token("p", 10, 10), feet: true, face: 350 }] };
  const b = { id: "f2", els: [{ ...token("p", 30, 10), feet: true, face: 10 }] };
  const mid = lerpFrames(a, b, 0.5).find((e) => e.id === "p");
  assert.ok(Math.abs(faceOf(mid) - 0) < 0.01 || Math.abs(faceOf(mid) - 360) < 0.01, "de 350° a 10° pasa por 0°, no por 180°: " + faceOf(mid));
  // el cambio de orientación vale solo para su fotograma; los pies valen para todos
  let board = addFrame({ ...emptyBoard(), frames: [{ id: "f1", els: [{ ...token("p", 10, 10), feet: true }] }] }, 0).board;
  board = patchElement(board, 1, "p", { face: 120 });
  assert.equal(board.frames[0].els[0].face, undefined);
  assert.equal(board.frames[1].els[0].face, 120);
  const sinPies = setAllFeet(board, false);
  assert.ok(sinPies.frames.every((f) => f.els[0].feet === undefined && f.els[0].face === undefined));
  assert.ok(setAllFeet(sinPies, true).frames.every((f) => f.els[0].feet === true));
});

test("diseño del balón: sin estilo guardado es el de siempre y los colores se respetan", () => {
  assert.deepEqual(ballStyle({}), { pattern: "classic", color: "#ffffff", color2: "#111827", stroke: null });
  assert.deepEqual(ballStyle({ pattern: "classic", color: "#fde047", color2: "#000", stroke: "#f00" }), { pattern: "classic", color: "#fde047", color2: "#000", stroke: "#f00" });
  assert.deepEqual(BALL_PATTERNS.map((p) => p.id), ["classic", "modern", "helix", "seams", "dot", "plain", "stripe"]);
});

test("tipo de dibujo: sin elegir se deduce de los fotogramas y los fotogramas se conservan al pasar a imagen", () => {
  assert.equal(boardMode(null), "image");
  assert.equal(boardMode(emptyBoard()), "image");
  const dos = addFrame(emptyBoard(), 0).board;
  assert.equal(boardMode(dos), "anim");
  assert.equal(isAnimation(dos), true);
  const imagen = normalizeBoard({ ...dos, mode: "image" });
  assert.equal(boardMode(imagen), "image");
  assert.equal(imagen.frames.length, 2, "no se pierde ningún fotograma");
  assert.equal(isAnimation(imagen), false);
  const animUno = normalizeBoard({ ...emptyBoard(), mode: "anim" });
  assert.equal(boardMode(animUno), "anim");
  assert.equal(isAnimation(animUno), false, "con un solo fotograma no hay animación que reproducir");
  assert.equal(normalizeBoard({ ...dos, mode: "otra" }).mode, undefined, "un valor raro se ignora");
});

test("velocidad de la animación: se guarda con el dibujo y un valor raro vuelve a normal", () => {
  assert.equal(boardSpeed({}), 1500);
  assert.equal(boardSpeed({ speed: 800 }), 800);
  assert.equal(boardSpeed({ speed: 123 }), 1500);
  assert.equal(normalizeBoard({ ...emptyBoard(), speed: 2600 }).speed, 2600);
  assert.equal(normalizeBoard({ ...emptyBoard(), speed: 9 }).speed, undefined);
});

test("línea de tiempo del vídeo: espera al principio, recorre cada paso y espera al final", () => {
  let b = { ...emptyBoard(), frames: [{ id: "f1", els: [token("p", 0, 0)] }] };
  assert.equal(animationDuration(b), 0, "con un fotograma no hay vídeo");
  b = addFrame(b, 0).board;
  b = patchElement(b, 1, "p", { x: 20, y: 10 });
  b = addFrame(b, 1).board;
  b = patchElement(b, 2, "p", { x: 40, y: 10 });
  assert.equal(animationDuration(b, { speed: 1000 }), ANIM_HOLD.start + 2000 + ANIM_HOLD.end);
  const at = (ms) => elsAtTime(b, ms, { speed: 1000 }).find((e) => e.id === "p");
  assert.equal(at(0).x, 0, "al empezar está en el primer fotograma");
  assert.equal(at(ANIM_HOLD.start).x, 0);
  assert.equal(at(ANIM_HOLD.start + 500).x, 10, "a mitad del primer paso");
  assert.equal(at(ANIM_HOLD.start + 1000).x, 20);
  assert.equal(at(ANIM_HOLD.start + 1500).x, 30);
  assert.equal(at(ANIM_HOLD.start + 2000).x, 40);
  assert.equal(at(ANIM_HOLD.start + 5000).x, 40, "después del final se queda en el último");
});

// ── Capas y selección múltiple ──────────────────────────────────────────────────────────────────────────────────────

const zone = (id, x = 0, y = 0, w = 20, h = 20) => ({ id, k: "zone", x, y, w, h });
const textEl = (id, x, y) => ({ id, k: "text", x, y, text: "Hola" });
const boardWith = (els) => ({ ...emptyBoard(), frames: [{ id: "f1", els }] });
const idsOf = (els) => drawOrder(els).map((e) => e.id);

test("sin orden elegido se dibuja por capas por defecto: zona, flecha, ficha, balón (encima de las fichas), texto", () => {
  const els = [textEl("tx", 5, 5), token("t1", 5, 5), arrow("ar"), { id: "bl", k: "ball", x: 5, y: 5 }, zone("z1")];
  assert.deepEqual(idsOf(els), ["z1", "ar", "t1", "bl", "tx"]);
  assert.equal(hasLayers(els), false);
});

test("subir al frente y enviar al fondo guardan el orden y mandan sobre las capas por defecto", () => {
  const b = boardWith([zone("z1"), token("t1", 5, 5), token("t2", 6, 6), textEl("tx", 5, 5)]);
  const front = moveLayer(b, 0, ["z1"], "front");
  assert.deepEqual(idsOf(front.frames[0].els), ["t1", "t2", "tx", "z1"], "la zona queda encima de todo");
  assert.equal(hasLayers(front.frames[0].els), true);
  const back = moveLayer(front, 0, ["tx"], "back");
  assert.deepEqual(idsOf(back.frames[0].els), ["tx", "t1", "t2", "z1"]);
  assert.deepEqual(b.frames[0].els.map((e) => e.z), [undefined, undefined, undefined, undefined], "el original no se toca");
});

test("subir y bajar un nivel pasan por encima o por debajo de lo que se solapa, no de lo que está lejos", () => {
  // t1 y t2 se solapan; t3 está lejos
  const b = boardWith([token("t1", 10, 10), token("t3", 60, 60), token("t2", 11, 10)]);
  const up = moveLayer(b, 0, ["t1"], "up");
  assert.deepEqual(idsOf(up.frames[0].els), ["t3", "t2", "t1"], "t1 pasa por encima de t2 (se solapan)");
  const down = moveLayer(up, 0, ["t1"], "down");
  assert.deepEqual(idsOf(down.frames[0].els), ["t3", "t1", "t2"]);
  // lo que no se solapa con nada por encima no cambia
  assert.equal(moveLayer(b, 0, ["t3"], "up"), b);
  assert.equal(moveLayer(b, 0, ["t1"], "down"), b, "ya está debajo");
});

test("subir varios a la vez conserva su orden relativo", () => {
  const b = boardWith([token("a", 10, 10), token("b", 10.5, 10), token("c", 11, 10)]);
  const up = moveLayer(b, 0, ["a", "b"], "up");
  assert.deepEqual(idsOf(up.frames[0].els), ["c", "a", "b"]);
  const front = moveLayer(b, 0, ["a", "b"], "front");
  assert.deepEqual(idsOf(front.frames[0].els), ["c", "a", "b"]);
  const back = moveLayer(b, 0, ["c", "b"], "back");
  assert.deepEqual(idsOf(back.frames[0].els), ["b", "c", "a"]);
});

test("el orden de capas es de cada fotograma", () => {
  let b = addFrame(boardWith([zone("z1"), token("t1", 5, 5)]), 0).board;
  b = addElement(b, 0, zone("z2", 1, 1, 5, 5));
  const r = moveLayer(b, 0, ["t1"], "back");
  assert.equal(hasLayers(r.frames[0].els), true);
  assert.equal(hasLayers(r.frames[1].els), false);
});

test("un elemento nuevo entra en su capa por defecto aunque el fotograma ya tenga orden propio", () => {
  let b = boardWith([zone("z1"), token("t1", 5, 5), textEl("tx", 5, 5)]);
  b = moveLayer(b, 0, ["z1"], "front"); // t1, tx, z1
  b = addElement(b, 0, token("t2", 20, 20));
  assert.deepEqual(idsOf(b.frames[0].els), ["t1", "tx", "z1", "t2"], "entra encima de lo que sea de su clase o inferior");
  const ts = b.frames[0].els.map((e) => e.z).sort((x, y) => x - y);
  assert.deepEqual(ts, [0, 1, 2, 3], "z queda numerado sin huecos");
  // sin orden propio no se guarda ningún z
  const plain = addElement(boardWith([token("t1", 5, 5)]), 0, zone("z9"));
  assert.equal(hasLayers(plain.frames[0].els), false);
  assert.equal(placeElement([token("a", 1, 1)], { ...token("b", 2, 2), z: 7 })[1].z, undefined);
});

test("los elementos que pasan de fotograma entran también en el orden de los demás fotogramas", () => {
  let b = addFrame(boardWith([token("t0", 5, 5), token("t1", 5.5, 5)]), 0).board;
  b = moveLayer(b, 1, ["t0"], "front");
  assert.equal(hasLayers(b.frames[1].els), true);
  b = addElement(b, 0, token("t2", 9, 9));
  assert.equal(b.frames[0].els.length, 3);
  assert.equal(b.frames[1].els.length, 3);
  assert.equal(hasLayers(b.frames[0].els), false, "el otro fotograma sigue sin orden propio");
  assert.deepEqual(b.frames[1].els.map((e) => e.z).sort((x, y) => x - y), [0, 1, 2], "y en este el elemento nuevo queda numerado");
});

test("elementBounds da la caja de cada elemento y null para un conector", () => {
  const t = elementBounds(token("t", 10, 20));
  assert.ok(t.x0 < 10 && t.x1 > 10 && t.y0 < 20 && t.y1 > 20);
  const g = elementBounds({ id: "g", k: "goal", x: 30, y: 5, w: 6, rot: 0 });
  assert.ok(g.x1 - g.x0 >= 6 && g.y1 - g.y0 < 6);
  const turned = elementBounds({ id: "g", k: "goal", x: 30, y: 5, w: 6, rot: 90 });
  assert.ok(turned.y1 - turned.y0 >= 6 - 1e-9, "girada 90° es más alta que ancha");
  const a = elementBounds({ id: "a", k: "arrow", x1: 0, y1: 0, x2: 10, y2: 4 });
  assert.ok(a.x0 < 0 && a.x1 > 10 && a.y1 > 4);
  assert.deepEqual(elementBounds(zone("z", 2, 3, 5, 6)), { x0: 2, y0: 3, x1: 7, y1: 9 });
  assert.equal(elementBounds({ id: "l", k: "link", ids: [] }), null);
});

test("el recuadro elige piezas por su posición, flechas y zonas solo si caben enteras y nunca los conectores", () => {
  const els = [
    token("in", 10, 10), token("out", 40, 40),
    { id: "ar-in", k: "arrow", style: "move", x1: 5, y1: 5, x2: 15, y2: 15 },
    { id: "ar-half", k: "arrow", style: "move", x1: 5, y1: 5, x2: 45, y2: 45 },
    zone("z-in", 2, 2, 10, 10), zone("z-big", 0, 0, 60, 60),
    { id: "lk", k: "link", ids: ["in", "out"] },
  ];
  assert.deepEqual(elementsInBox(els, { x: 0, y: 0, w: 20, h: 20 }).sort(), ["ar-in", "in", "z-in"].sort());
  assert.deepEqual(elementsInBox(els, { x: 20, y: 20, w: -20, h: -20 }).sort(), ["ar-in", "in", "z-in"].sort(), "vale arrastrar hacia arriba o hacia la izquierda");
});

test("más grande / más pequeño cambia el tamaño de cada cosa a su manera y respeta los límites", () => {
  const b = boardWith([token("t1", 5, 5), { id: "c1", k: "cone", x: 8, y: 8 }, { id: "g1", k: "goal", x: 30, y: 3, w: 6 }, textEl("tx", 9, 9), { ...arrow("ar"), width: 0.8 }, zone("z1")]);
  const big = resizeElements(b, 0, ["t1", "c1", "g1", "tx", "ar", "z1"], 1.5);
  const byId = Object.fromEntries(big.frames[0].els.map((e) => [e.id, e]));
  assert.equal(byId.t1.size, 1.5);
  assert.equal(byId.c1.size, 1.5);
  assert.equal(byId.g1.w, 9);
  assert.equal(byId.tx.size, 4.5);
  assert.equal(byId.ar.width, 1.2);
  assert.deepEqual(byId.z1, zone("z1"), "una zona no tiene tamaño propio");
  const huge = resizeElements(resizeElements(big, 0, ["t1", "c1", "g1", "tx", "ar"], 3), 0, ["t1", "c1", "g1", "tx", "ar"], 3);
  const h = Object.fromEntries(huge.frames[0].els.map((e) => [e.id, e]));
  assert.equal(h.t1.size, 3);
  assert.equal(h.c1.size, 2.2);
  assert.equal(h.g1.w, 12);
  assert.equal(h.tx.size, 10);
  assert.equal(h.ar.width, 2);
});

test("el tamaño (un cambio de estilo) vale en todos los fotogramas donde está cada cosa", () => {
  let b = addFrame(boardWith([token("t1", 5, 5)]), 0).board;
  b = addElement(b, 0, textEl("tx", 9, 9));
  const r = resizeElements(b, 0, ["t1", "tx"], 2);
  assert.equal(r.frames[0].els.find((e) => e.id === "t1").size, 2);
  assert.equal(r.frames[1].els.find((e) => e.id === "t1").size, 2);
  assert.equal(r.frames[0].els.find((e) => e.id === "tx").size, 6);
  assert.equal(r.frames[1].els.find((e) => e.id === "tx").size, 6);
});

test("separar y juntar mueven las posiciones respecto al centro y no cambian los tamaños", () => {
  const b = boardWith([token("a", 10, 10), token("b", 20, 10), token("c", 15, 20), token("fuera", 50, 50)]);
  const wide = spreadElements(b, 0, ["a", "b", "c"], 2);
  const at = (id) => wide.frames[0].els.find((e) => e.id === id);
  assert.ok(at("b").x - at("a").x > 19 && at("b").x - at("a").x < 21, "la distancia entre a y b se dobla");
  assert.equal(at("fuera").x, 50, "lo no elegido no se toca");
  assert.equal(at("a").size, undefined);
  const back = spreadElements(wide, 0, ["a", "b", "c"], 0.5);
  assert.ok(Math.abs(back.frames[0].els.find((e) => e.id === "a").x - 10) < 0.3);
  assert.equal(spreadElements(b, 0, ["a"], 2), b, "con uno solo no hay nada que separar");
  const z = spreadElements(boardWith([zone("z", 10, 10, 10, 10), token("t", 40, 40)]), 0, ["z", "t"], 1.5);
  assert.ok(z.frames[0].els[0].w > 10, "la zona crece");
});

test("el color elegido se aplica a todo; en las zonas es el relleno", () => {
  const b = boardWith([token("t1", 5, 5), { id: "c1", k: "cone", x: 8, y: 8 }, zone("z1"), { ...zone("z2"), fillOpacity: 0.6 }]);
  const r = recolorElements(b, 0, ["t1", "c1", "z1", "z2"], "#2563eb");
  const byId = Object.fromEntries(r.frames[0].els.map((e) => [e.id, e]));
  assert.equal(byId.t1.color, "#2563eb");
  assert.equal(byId.c1.color, "#2563eb");
  assert.equal(byId.z1.fill, "#2563eb");
  assert.equal(byId.z1.fillOpacity, 0.35, "una zona sin transparencia propia se ve al ponerle color");
  assert.equal(byId.z2.fillOpacity, 0.6);
});

test("equipo y pies de varias fichas a la vez, en todos los fotogramas", () => {
  let b = addFrame(boardWith([token("t1", 5, 5), token("t2", 9, 9), { id: "c1", k: "cone", x: 8, y: 8 }]), 0).board;
  const team = setTeamOf(b, 0, ["t1", "c1"], "b");
  assert.equal(team.frames[1].els.find((e) => e.id === "t1").team, "b");
  assert.equal(team.frames[0].els.find((e) => e.id === "t2").team, "a");
  assert.equal(team.frames[0].els.find((e) => e.id === "c1").team, undefined, "solo las fichas tienen equipo");
  const feet = setFeetOf(b, 0, ["t1", "t2"], true);
  assert.equal(feet.frames[1].els.find((e) => e.id === "t2").feet, true);
  const gone = setFeetOf(setFeetOf(b, 0, ["t1"], true), 0, ["t1"], false);
  assert.equal("feet" in gone.frames[0].els.find((e) => e.id === "t1"), false);
});

test("quitar varios a la vez, de todos los fotogramas o solo del actual", () => {
  const b = addFrame(boardWith([token("t1", 5, 5), token("t2", 9, 9), token("t3", 12, 12)]), 0).board;
  const all = removeElements(b, 0, ["t1", "t2"]);
  assert.deepEqual(all.frames.map((f) => f.els.map((e) => e.id)), [["t3"], ["t3"]]);
  const here = removeElements(b, 0, ["t1", "t2"], { onlyHere: true });
  assert.deepEqual(here.frames.map((f) => f.els.length), [1, 3]);
});

// ── Alinear, repartir y lista de capas ──────────────────────────────────────────────────────────────────────────
const xy = (b, id, i = 0) => { const e = b.frames[i].els.find((x) => x.id === id); return [e.x, e.y]; };

test("alinear respecto al conjunto: izquierda, derecha, centro, arriba y abajo", () => {
  const b = boardWith([token("a", 10, 10), token("b", 20, 30), token("c", 40, 20)]);
  const ids = ["a", "b", "c"];
  assert.deepEqual(["a", "b", "c"].map((id) => xy(alignElements(b, 0, ids, "left"), id)[0]), [10, 10, 10]);
  assert.deepEqual(["a", "b", "c"].map((id) => xy(alignElements(b, 0, ids, "right"), id)[0]), [40, 40, 40]);
  assert.deepEqual(["a", "b", "c"].map((id) => xy(alignElements(b, 0, ids, "hcenter"), id)[0]), [25, 25, 25]);
  assert.deepEqual(["a", "b", "c"].map((id) => xy(alignElements(b, 0, ids, "top"), id)[1]), [10, 10, 10]);
  assert.deepEqual(["a", "b", "c"].map((id) => xy(alignElements(b, 0, ids, "bottom"), id)[1]), [30, 30, 30]);
  assert.deepEqual(["a", "b", "c"].map((id) => xy(alignElements(b, 0, ids, "vcenter"), id)[1]), [20, 20, 20]);
  assert.equal(alignElements(b, 0, ["a"], "left"), b, "con uno solo no hay nada que alinear");
  assert.equal(alignElements(alignElements(b, 0, ids, "left"), 0, ids, "left").frames[0].els[1].x, 10, "alinear dos veces da lo mismo");
});

test("alinear usa los bordes de cada cosa, no su centro: una zona grande y una ficha", () => {
  const b = boardWith([zone("z", 10, 10, 20, 10), token("t", 40, 14)]);
  const r = alignElements(b, 0, ["z", "t"], "top");
  assert.equal(r.frames[0].els.find((e) => e.id === "z").y, 10, "la zona ya está arriba");
  const r2 = r.frames[0].els.find((e) => e.id === "t");
  assert.ok(Math.abs(r2.y - tokenR(DEFAULT_CHIP, r2) - 10) < 0.06, "el borde de arriba de la ficha queda a la altura del de la zona");
});

test("alinear y repartir son «como se ve»: con el campo girado, izquierda sigue siendo la izquierda de la pantalla", () => {
  for (const orient of ["v", "vi", "h", "hi"]) {
    const b = { ...boardWith([token("a", 10, 10), token("b", 30, 25), token("c", 20, 40)]), orient };
    const field = fieldOf(b.field);
    const viewX = (r, id) => { const [x, y] = xy(r, id); return toView(field, orient, { x, y }).x; };
    const left = alignElements(b, 0, ["a", "b", "c"], "left");
    const xs = ["a", "b", "c"].map((id) => viewX(left, id));
    assert.ok(Math.max(...xs) - Math.min(...xs) < 0.06, `${orient}: quedan en la misma vertical de pantalla`);
    const before = ["a", "b", "c"].map((id) => viewX(b, id));
    assert.ok(Math.abs(xs[0] - Math.min(...before)) < 0.06, `${orient}: el borde es el de más a la izquierda`);
    const top = alignElements(b, 0, ["a", "b", "c"], "top");
    const viewY = (id) => { const [x, y] = xy(top, id); return toView(field, orient, { x, y }).y; };
    const ys = ["a", "b", "c"].map(viewY);
    assert.ok(Math.max(...ys) - Math.min(...ys) < 0.06, `${orient}: quedan a la misma altura de pantalla`);
  }
  assert.deepEqual(viewDelta("v", 2, 3), { dx: 2, dy: 3 });
  assert.deepEqual(viewDelta("vi", 2, 3), { dx: -2, dy: -3 });
  const field = fieldOf("half");
  for (const o of ["h", "hi"]) {
    const p = { x: 12, y: 20 }, q = fromView(field, o, { x: toView(field, o, p).x + 2, y: toView(field, o, p).y + 3 });
    const d = viewDelta(o, 2, 3);
    assert.ok(Math.abs(q.x - (p.x + d.dx)) < 0.01 && Math.abs(q.y - (p.y + d.dy)) < 0.01, `${o}: el desplazamiento coincide con toView/fromView`);
  }
});

test("alinear solo toca el fotograma actual y deja los conectores donde están", () => {
  let b = addFrame(boardWith([token("a", 10, 10), token("b", 20, 30)]), 0).board;
  b = addElement(b, 0, { id: "l", k: "link", mode: "line", ids: ["a", "b"] });
  const r = alignElements(b, 0, ["a", "b", "l"], "left");
  assert.deepEqual(xy(r, "b", 0), [10, 30]);
  assert.deepEqual(xy(r, "b", 1), [20, 30], "el fotograma 2 no cambia");
});

test("repartir deja el mismo hueco entre cosas y no mueve las de los extremos", () => {
  const b = boardWith([token("a", 10, 10), token("b", 14, 22), token("c", 38, 30), token("d", 50, 5)]);
  const r = distributeElements(b, 0, ["a", "b", "c", "d"], "h");
  assert.deepEqual([xy(r, "a")[0], xy(r, "d")[0]], [10, 50], "los extremos no se mueven");
  const xs = ["a", "b", "c", "d"].map((id) => xy(r, id)[0]);
  assert.ok(Math.abs(xs[1] - xs[0] - (xs[2] - xs[1])) < 0.11 && Math.abs(xs[2] - xs[1] - (xs[3] - xs[2])) < 0.11, "igualmente separadas: " + xs.join(", "));
  assert.deepEqual(["a", "b", "c", "d"].map((id) => xy(r, id)[1]), [10, 22, 30, 5], "la otra dirección no cambia");
  const v = distributeElements(b, 0, ["a", "b", "c", "d"], "v");
  const ys = ["d", "a", "b", "c"].map((id) => xy(v, id)[1]);
  assert.ok(Math.abs(ys[1] - ys[0] - (ys[2] - ys[1])) < 0.11 && Math.abs(ys[2] - ys[1] - (ys[3] - ys[2])) < 0.11, "a lo alto también: " + ys.join(", "));
  assert.equal(distributeElements(b, 0, ["a", "b"], "h"), b, "hacen falta tres");
  assert.equal(distributeElements(distributeElements(b, 0, ["a", "b", "c", "d"], "h"), 0, ["a", "b", "c", "d"], "h").frames[0].els.length, 4);
});

test("repartir cuenta el tamaño de cada cosa: una zona ancha entre dos fichas", () => {
  const b = boardWith([token("a", 10, 10), zone("z", 14, 5, 20, 6), token("c", 60, 10)]);
  const r = distributeElements(b, 0, ["a", "z", "c"], "h");
  const rA = tokenR(DEFAULT_CHIP, token("a", 0, 0));
  const aRight = xy(r, "a")[0] + rA, zLeft = xy(r, "z")[0], zRight = zLeft + 20, cLeft = xy(r, "c")[0] - rA;
  assert.ok(Math.abs((zLeft - aRight) - (cLeft - zRight)) < 0.11, "los huecos entre bordes son iguales");
});

test("subir o bajar un puesto de la lista de capas, sin fijarse en si se solapan", () => {
  const b = boardWith([token("a", 5, 5), token("b", 40, 40), token("c", 20, 20)]); // sin capas: salen en este orden
  const up = stepLayer(b, 0, ["a"], 1);
  assert.deepEqual(drawOrder(up.frames[0].els).map((e) => e.id), ["b", "a", "c"], "a pasa un puesto por delante aunque b esté lejos");
  const down = stepLayer(up, 0, ["a"], -1);
  assert.deepEqual(drawOrder(down.frames[0].els).map((e) => e.id), ["a", "b", "c"]);
  assert.equal(stepLayer(b, 0, ["c"], 1), b, "el de arriba no puede subir más");
  assert.equal(stepLayer(b, 0, ["a"], -1), b, "el de abajo no puede bajar más");
  const group = stepLayer(b, 0, ["a", "b"], 1);
  assert.deepEqual(drawOrder(group.frames[0].els).map((e) => e.id), ["c", "a", "b"], "el grupo se mueve junto y conserva su orden");
  const bottom = stepLayer(stepLayer(b, 0, ["c"], -1), 0, ["a", "c"], -1);
  assert.deepEqual(drawOrder(bottom.frames[0].els).map((e) => e.id).slice(0, 2), ["a", "c"]);
});

// ── Teclado (flechas) y arrastrar filas de la lista de capas ────────────────────────────────────────────────────────
test("las flechas del teclado mueven según la pantalla, también con el campo girado", () => {
  for (const orient of ["v", "vi", "h", "hi"]) {
    const b = { ...boardWith([token("a", 20, 20), token("b", 30, 25)]), orient };
    const field = fieldOf(b.field);
    const view = (r, id) => { const [x, y] = xy(r, id); return toView(field, orient, { x, y }); };
    const right = nudgeElements(b, 0, ["a", "b"], 2, 0);
    const down = nudgeElements(b, 0, ["a", "b"], 0, 0.5);
    for (const id of ["a", "b"]) {
      assert.ok(Math.abs(view(right, id).x - view(b, id).x - 2) < 0.06 && Math.abs(view(right, id).y - view(b, id).y) < 0.06, `${orient}: derecha = 2 m a la derecha de la pantalla`);
      assert.ok(Math.abs(view(down, id).y - view(b, id).y - 0.5) < 0.06 && Math.abs(view(down, id).x - view(b, id).x) < 0.06, `${orient}: abajo = 0,5 m hacia abajo de la pantalla`);
    }
  }
});

test("las flechas no sacan lo elegido del campo y solo tocan el fotograma actual", () => {
  const b = addFrame(boardWith([token("a", 1, 30), token("b", 20, 30), token("c", 40, 30)]), 0).board;
  const f = fieldOf(b.field);
  let r = b;
  for (let i = 0; i < 40; i++) r = nudgeElements(r, 0, ["a", "b"], -2, 0);
  const u = elementBounds(r.frames[0].els.find((e) => e.id === "a"));
  assert.ok(u.x0 >= -2.06, "no pasa de 2 m fuera del borde: " + u.x0);
  assert.equal(xy(r, "b")[0] - xy(r, "a")[0], 19, "el grupo conserva la distancia entre sus cosas");
  assert.equal(xy(r, "c")[0], 40, "lo no elegido no se mueve");
  assert.deepEqual(xy(r, "a", 1), [1, 30], "el fotograma 2 no cambia");
  assert.equal(nudgeElements(r, 0, ["a", "b"], -2, 0), r, "contra el borde ya no cambia nada");
  let far = boardWith([token("z", f.w - 1, 5)]);
  for (let i = 0; i < 30; i++) far = nudgeElements(far, 0, ["z"], 2, 0);
  assert.ok(elementBounds(far.frames[0].els[0]).x1 <= f.w + 2.06);
  assert.equal(nudgeElements(b, 0, [], 1, 0), b);
  const withLink = addElement(boardWith([token("a", 20, 20), token("b", 30, 20)]), 0, { id: "l", k: "link", mode: "line", ids: ["a", "b"] });
  const moved = nudgeElements(withLink, 0, ["a", "b", "l"], 2, 0);
  assert.equal(moved.frames[0].els.find((e) => e.id === "l").ids.length, 2, "el conector sigue igual y va con sus fichas");
});

test("poner una cosa en un puesto concreto de la lista de capas", () => {
  const b = boardWith([token("a", 5, 5), token("b", 40, 40), token("c", 20, 20), token("d", 30, 30)]);
  const ids = (r) => drawOrder(r.frames[0].els).map((e) => e.id);
  assert.deepEqual(ids(moveLayerTo(b, 0, "a", 3)), ["b", "c", "d", "a"], "al frente del todo");
  assert.deepEqual(ids(moveLayerTo(b, 0, "d", 0)), ["d", "a", "b", "c"], "al fondo del todo");
  assert.deepEqual(ids(moveLayerTo(b, 0, "a", 2)), ["b", "c", "a", "d"], "en medio");
  assert.equal(moveLayerTo(b, 0, "b", 1), b, "si ya está en ese puesto no cambia nada");
  assert.deepEqual(ids(moveLayerTo(b, 0, "a", 99)), ["b", "c", "d", "a"], "un puesto de más se queda en el extremo");
  assert.equal(moveLayerTo(b, 0, "nada", 1), b);
  assert.ok(moveLayerTo(b, 0, "a", 3).frames[0].els.every((e) => Number.isFinite(e.z)), "el fotograma pasa a guardar el orden");
});

test("fondo del texto: recuadro centrado que crece con el texto", async () => {
  const { textBgBox, textWidth } = await import("../src/lib/board.js");
  const a = textBgBox(50, 40, "Pedro", 3), b = textBgBox(50, 40, "Pedro Martínez", 3);
  assert.ok(Math.abs(a.x + a.w / 2 - 50) < 1e-9, "centrado en x");
  assert.ok(b.w > a.w, "más texto, más ancho");
  assert.ok(a.y < 40 && a.y + a.h > 40, "cubre la línea base");
  assert.ok(textWidth("MMM", 3) > textWidth("iii", 3));
  assert.ok(textWidth("abc", 3, true) > textWidth("abc", 3, false), "la negrita ocupa más");
  assert.ok(textBgBox(0, 0, "", 3).w > 0, "nunca ancho cero");
});

test("perspectiva: proyección e inversa, lejos más estrecho y rectas rectas", async () => {
  const { perspectiveOf, fieldOf, viewBox, normalizeBoard, PERSP } = await import("../src/lib/board.js");
  for (const [fid, orient] of [["half", "v"], ["full", "h"], ["f7", "vi"], ["free", "hi"]]) {
    const field = fieldOf(fid);
    const pr = perspectiveOf(field, orient);
    const [x0, y0, W, H] = viewBox(field, orient);
    for (const p of [{ x: x0, y: y0 }, { x: x0 + W, y: y0 + H }, { x: x0 + W / 3, y: y0 + H / 2 }, { x: 10, y: 20 }]) {
      const q = pr.inv(pr.P(p));
      assert.ok(Math.abs(q.x - p.x) < 1e-6 && Math.abs(q.y - p.y) < 1e-6, `ida y vuelta ${fid}`);
    }
    // lejos (arriba) se ve más pequeño que cerca
    assert.ok(Math.abs(pr.scaleAt({ x: 0, y: y0 }) - PERSP.far) < 1e-9);
    assert.ok(Math.abs(pr.scaleAt({ x: 0, y: y0 + H }) - 1) < 1e-9);
    // todo cabe en su caja
    const [vx, vy, vw, vh] = pr.vb;
    for (const p of [{ x: x0, y: y0 }, { x: x0 + W, y: y0 + H }]) { const q = pr.P(p); assert.ok(q.x >= vx - 1e-9 && q.x <= vx + vw + 1e-9 && q.y >= vy && q.y <= vy + vh); }
    // tres puntos alineados en el suelo siguen alineados
    const a = pr.P({ x: x0, y: y0 }), b = pr.P({ x: x0 + W / 2, y: y0 + H / 2 }), c = pr.P({ x: x0 + W, y: y0 + H });
    assert.ok(Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 1e-6);
  }
  assert.equal(normalizeBoard({ v: 2, frames: [], view: "persp" }).view, "persp");
  assert.equal(normalizeBoard({ v: 2, frames: [], view: "loquesea" }).view, undefined);
});

test("petos y agarrar en perspectiva", async () => {
  const B = await import("../src/lib/board.js");
  const tok = (id, x, y) => ({ id, k: "token", team: "a", x, y });
  let b = B.normalizeBoard({ v: 2, field: "half", frames: [{ id: "f1", els: [tok("a", 10, 10), tok("b", 30, 30), { id: "z", k: "zone", x: 0, y: 0, w: 5, h: 5 }] }] });
  b = B.addFrame(b, 0).board;
  b = B.setBibOf(b, 0, ["a", "z"], "#fde047");
  assert.deepEqual(b.frames.map((f) => f.els.find((e) => e.id === "a").bib), ["#fde047", "#fde047"], "el peto vale en todos los fotogramas");
  assert.equal(b.frames[0].els.find((e) => e.id === "z").bib, undefined, "solo las fichas llevan peto");
  b = B.setBibOf(b, 0, ["a"], null);
  assert.ok(!("bib" in b.frames[1].els.find((e) => e.id === "a")));
  // en perspectiva una ficha se agarra por la parte de arriba de su dibujo (lo que se ve de pie)
  const field = B.fieldOf("half"), persp = B.perspectiveOf(field, "v");
  const els = b.frames[0].els;
  const c = persp.P(B.toView(field, "v", els[1])), k = persp.scaleAt(B.toView(field, "v", els[1]));
  const r = B.tokenR(B.DEFAULT_CHIP, els[1]) * k;
  const hit = B.hitTestPersp(B.paintOrder(els, field, "v", persp), { x: c.x, y: c.y - r * 0.9 }, { field, orient: "v", chip: B.DEFAULT_CHIP, persp });
  assert.equal(hit?.id, "b");
  assert.equal(B.hitTestPersp(els, { x: c.x + 30, y: c.y }, { field, orient: "v", chip: B.DEFAULT_CHIP, persp }), null);
});

test("zoom: encuadre dentro del campo, zoom sobre un punto y mover la vista", async () => {
  const B = await import("../src/lib/board.js");
  const vb = [-3, -3, 74, 58.5];
  assert.deepEqual(B.camBox(vb, null), vb);
  const box = B.camBox(vb, { z: 2, x: 0.5, y: 0.5 });
  assert.ok(Math.abs(box[2] - 37) < 1e-9 && Math.abs(box[3] - 29.25) < 1e-9);
  // nunca se sale del recuadro completo
  const edge = B.camBox(vb, { z: 2, x: 0, y: 1 });
  assert.ok(edge[0] >= vb[0] - 1e-9 && edge[1] + edge[3] <= vb[1] + vb[3] + 1e-9);
  // al ampliar sobre un punto, ese punto no se mueve en pantalla
  const at = { x: 10, y: 12 };
  const c1 = B.zoomCam(vb, null, 2, at);
  const b1 = B.camBox(vb, c1);
  const rel0 = [(at.x - vb[0]) / vb[2], (at.y - vb[1]) / vb[3]], rel1 = [(at.x - b1[0]) / b1[2], (at.y - b1[1]) / b1[3]];
  assert.ok(Math.abs(rel0[0] - rel1[0]) < 1e-3 && Math.abs(rel0[1] - rel1[1]) < 1e-3);
  assert.equal(B.zoomCam(vb, c1, 1), null, "volver a 1 quita el zoom");
  const moved = B.panCam(vb, { z: 2, x: 0.5, y: 0.5 }, 5, 0);
  assert.ok(moved.x > 0.5 && moved.y === 0.5);
  assert.equal(B.panCam(vb, null, 5, 0), null);
  assert.equal(B.camOf({ cam: { z: 9, x: 2, y: -1 } }).z, B.ZOOM_MAX);
  assert.deepEqual(B.normalizeBoard({ v: 2, frames: [], cam: { z: 2, x: 0.3, y: 0.6 } }).cam, { z: 2, x: 0.3, y: 0.6 });
  assert.equal(B.normalizeBoard({ v: 2, frames: [], cam: { z: 1 } }).cam, undefined);
});

test("girar varias fichas a la vez", async () => {
  const B = await import("../src/lib/board.js");
  const tok = (id, face) => ({ id, k: "token", team: "a", x: 10, y: 10, feet: true, ...(face != null ? { face } : {}) });
  let b = B.normalizeBoard({ v: 2, field: "half", orient: "h", frames: [{ id: "f", els: [tok("a", 10), tok("b"), { id: "g", k: "goal", x: 5, y: 5, rot: 0 }, { id: "z", k: "zone", x: 0, y: 0, w: 3, h: 3 }] }] });
  b = B.addFrame(b, 0).board;
  const t = B.turnElements(b, 0, ["a", "b", "g", "z"], { turn: 45 });
  assert.deepEqual(t.frames[0].els.map((e) => e.face ?? e.rot ?? null), [55, 45, 45, null]);
  assert.equal(t.frames[1].els[0].face, 10, "solo el fotograma actual");
  // «mirar a la derecha de la pantalla» con el campo girado (h = ataca a la izquierda, -90): face = 90 - (-90) = 180
  const w = B.turnElements(b, 0, ["a", "b"], { toward: 90 });
  assert.equal(B.faceOf(w.frames[0].els[0]) + B.orientAngle("h"), 90);
  assert.equal(B.turnElements(w, 0, ["a", "b"], { toward: 90 }), w, "sin cambios devuelve el mismo");
});

// ── Flechas con quiebros y formas que se mueven (31/10/2026) ──────────────────────────────────────────────────────
import { arrowCorners, arrowPath, firstBend, insertVia, removeVia, hasVia } from "../src/lib/board.js";

test("flecha con quiebros: puntos, esquinas exactas y edición", () => {
  const a = { id: "q", k: "arrow", x1: 0, y1: 0, x2: 20, y2: 0, via: [{ x: 10, y: 10 }] };
  assert.equal(arrowPath(a), "poly");
  const pts = arrowPoints(a, 24);
  assert.deepEqual(pts[0], { x: 0, y: 0 });
  assert.deepEqual(pts[pts.length - 1], { x: 20, y: 0 });
  assert.ok(pts.some((p) => Math.abs(p.x - 10) < 1e-9 && Math.abs(p.y - 10) < 1e-9), "la esquina sale exacta");
  const two = { ...a, ...insertVia(a, 1) };
  assert.equal(two.via.length, 2);
  assert.deepEqual(two.via[1], { x: 15, y: 5 });
  assert.equal(arrowCorners(two).length, 4);
  assert.equal(hasVia({ ...a, ...removeVia(a, 0) }), false);
  const moved = shiftElement(a, 2, 3);
  assert.deepEqual(moved.via, [{ x: 12, y: 13 }]);
  const scaled = changeField({ v: 2, field: "full", frames: [{ id: "f", els: [a] }] }, "half").frames[0].els[0];
  assert.equal(scaled.via[0].y, 5);
  const fb = firstBend({ x1: 0, y1: 0, x2: 10, y2: 0 });
  assert.deepEqual(fb, { x: 5, y: 2.2 });
});

test("animación: flechas, zonas y textos con el mismo id se deslizan; una flecha nueva se dibuja", () => {
  const z1 = { id: "z", k: "zone", shape: "rect", x: 0, y: 0, w: 10, h: 10 };
  const z2 = { ...z1, x: 20 };
  const t1 = { id: "t", k: "text", x: 0, y: 0, text: "A" };
  const ar = { id: "n", k: "arrow", x1: 0, y1: 0, x2: 10, y2: 0 };
  const mid = lerpFrames({ els: [z1, t1] }, { els: [z2, { ...t1, x: 10 }, ar] }, 0.5);
  const z = mid.find((e) => e.id === "z");
  assert.equal(z.x, 10);
  assert.equal(z.opacity, 1);
  assert.equal(mid.find((e) => e.id === "t").x, 5);
  const n = mid.find((e) => e.id === "n");
  assert.equal(n.reveal, 0.5);
  assert.equal(mid.filter((e) => e.id === "z").length, 1, "sin duplicados");
  // una flecha recta que pasa a tener quiebros se va doblando
  const p0 = { ...ar }, p1 = { ...ar, via: [{ x: 5, y: 6 }] };
  const half = lerpFrames({ els: [p0] }, { els: [p1] }, 0.5).find((e) => e.id === "n");
  assert.ok(hasVia(half));
  const peak = Math.max(...arrowPoints(half, 24).map((p) => p.y));
  assert.ok(peak > 2 && peak < 4, `a medio camino (${peak})`);
});

import * as BS from "../src/lib/board.js";

test("estadio: más margen alrededor del campo para las gradas, en plano y en perspectiva", () => {
  const f = fieldOf("full");
  assert.equal(BS.marginOf("estadio"), BS.STADIUM_MARGIN);
  assert.equal(BS.marginOf("estadio-noche"), BS.STADIUM_MARGIN);
  assert.equal(BS.marginOf("blanco"), 3);
  assert.equal(BS.marginOf("inventado"), 3);
  assert.deepEqual(viewBox(f, "v"), [-3, -3, 74, 111], "sin margen se queda como siempre");
  assert.deepEqual(viewBox(f, "h", 10), [-10, -10, 125, 88]);
  const p = BS.perspectiveOf(f, "v", 10);
  assert.ok(p.vb[2] === 88, "la perspectiva usa el ancho con el margen del estadio");
  const back = p.inv(p.P({ x: 30, y: 50 }));
  assert.ok(Math.abs(back.x - 30) < 1e-6 && Math.abs(back.y - 50) < 1e-6);
});

test("estadio: se pueden quitar las gradas y las vallas, y el margen se ajusta; el dibujo guarda la elección", () => {
  assert.equal(BS.marginOf("estadio", {}), BS.STADIUM_MARGIN);
  assert.equal(BS.marginOf("estadio", { stands: false }), 5.5, "sin gradas, solo las vallas");
  assert.equal(BS.marginOf("estadio", { stands: false, ads: false }), 3);
  assert.equal(BS.marginOf("blanco", { stands: true }), 3, "fuera del estadio no cambia nada");
  const n = BS.normalizeBoard({ v: 2, field: "full", look: "estadio", stands: false, ads: false, frames: [{ id: "f", els: [] }] });
  assert.equal(n.stands, false);
  assert.equal(n.ads, false);
  assert.equal("stands" in BS.normalizeBoard({ v: 2, field: "full", look: "estadio", frames: [{ id: "f", els: [] }] }), false, "por defecto, con gradas");
  assert.ok(BS.AD_PANELS.some((p) => p.text === "RS MANAGER"));
});

test("medio campo y 3/4 en estadio: el marco se corta en línea recta por el lado del corte", async () => {
  const B = await import("../src/lib/board.js");
  const m = B.marginOf("estadio", { field: "half" });
  assert.deepEqual(m, { t: 13, r: 13, b: 3, l: 13 });
  assert.equal(B.marginOf("estadio", { field: "full" }), 13);
  assert.equal(B.marginOf("blanco", { field: "half" }), 3);
  const f = B.fieldOf("half");
  assert.deepEqual(B.viewBox(f, "v", m), [-13, -13, 94, 68.5]);
  assert.deepEqual(B.viewBox(f, "vi", m), [-13, -3, 94, 68.5]);
  assert.deepEqual(B.viewBox(f, "h", m), [-13, -13, 68.5, 94]);
  assert.deepEqual(B.viewBox(f, "hi", m), [-3, -13, 68.5, 94]);
  assert.deepEqual(B.viewBox(f, "v", 3), [-3, -3, 74, 58.5]);
});

test("marcas del campo: 5 carriles por las áreas, 6 franjas sobre el campo entero y nada en el espacio libre", async () => {
  const B = await import("../src/lib/board.js");
  const full = B.fieldOf("full");
  const lanes = BS.markLines(full, "carriles5");
  assert.deepEqual(lanes.map((l) => l.x1), [13.84, 24.84, 43.16, 54.16]);
  const bands = BS.markLines(full, "franjas6");
  assert.deepEqual(bands.map((l) => l.y1), [17.5, 35, 70, 87.5], "la del medio coincide con la línea de medio campo y no se repite");
  assert.equal(BS.markLines(B.fieldOf("half"), "franjas6").length, 2, "en medio campo solo las franjas que caben");
  assert.equal(BS.markLines(B.fieldOf("f7"), "carriles5")[0].x1, 10.5);
  assert.equal(BS.markLines(B.fieldOf("free"), "carriles5").length, 0);
  assert.equal(BS.markLines(full, "zonas18").length, 2 + 4);
  assert.equal(B.normalizeBoard({ v: 2, field: "full", marks: "zonas18", grass: "cruzado", frames: [{ id: "f", els: [] }] }).marks, "zonas18");
  assert.equal(B.normalizeBoard({ v: 2, field: "full", marks: "rara", frames: [{ id: "f", els: [] }] }).marks, undefined);
});

test("césped cortado en dos direcciones: franjas a lo ancho y a lo largo con tonos distintos", async () => {
  const B = await import("../src/lib/board.js");
  const r = B.grassRects(B.fieldOf("full"), "cruzado");
  assert.ok(r.some((x) => x.tone === "h") && r.some((x) => x.tone === "v"));
  assert.ok(r.every((x) => x.y + x.h <= 105.0001 && x.x + x.w <= 68.0001));
  assert.equal(B.grassRects(B.fieldOf("full"), "liso").length, 0);
});

test("trayectoria del movimiento: recta, curva o con cambios de dirección, y no se copia a fotogramas nuevos", async () => {
  const B = await import("../src/lib/board.js");
  const a = { x: 0, y: 0 }, b = { x: 20, y: 0 };
  assert.deepEqual(B.moveAt(a, b, undefined, 0.5), { x: 10, y: 0 });
  const curve = B.pathFor("curve", a, b);
  assert.equal(B.pathMode({ path: curve }), "curve");
  const mid = B.moveAt(a, b, curve, 0.5);
  assert.ok(Math.abs(mid.y) > 1, "la curva se separa de la recta");
  const poly = { via: [{ x: 10, y: 10 }] };
  const half = B.moveAt(a, b, poly, 0.5);
  assert.ok(Math.abs(half.x - 10) < 0.01 && Math.abs(half.y - 10) < 0.01, "a mitad de recorrido está en el quiebro (dos tramos iguales)");
  assert.deepEqual(B.moveAt(a, b, poly, 1), { x: 20, y: 0 });
  const board = { v: 2, field: "full", frames: [
    { id: "f1", els: [{ id: "t", k: "token", team: "a", x: 0, y: 0 }] },
    { id: "f2", els: [{ id: "t", k: "token", team: "a", x: 20, y: 0, path: poly }] },
  ] };
  const at = B.lerpFrames(board.frames[0], board.frames[1], 0.5).find((e) => e.id === "t");
  assert.ok(Math.abs(at.y - 10) < 0.5, "la animación sigue la trayectoria");
  assert.equal(B.addFrame(board, 1).board.frames[2].els[0].path, undefined);
  assert.equal(B.duplicateFrame(board, 1).board.frames[2].els[0].path, undefined);
});

test("vídeo 16:9: el campo vertical se gira y el recuadro se ajusta sin cortar el campo", async () => {
  const B = await import("../src/lib/board.js");
  assert.equal(B.turnQuarter({ orient: "v" }).orient, "hi");
  assert.equal(B.turnQuarter(B.turnQuarter(B.turnQuarter(B.turnQuarter({ orient: "h" })))).orient, "h");
  // campo horizontal con gradas: 131 × 94 → 16:9 recorta arriba y abajo sin pasar del campo (68 + 2 × 2 m)
  const vb = B.fitViewBox([-13, -13, 131, 94], 16 / 9, [0, 0, 105, 68]);
  assert.ok(Math.abs(vb[2] / vb[3] - 16 / 9) < 0.01);
  assert.ok(vb[1] <= -2 && vb[1] + vb[3] >= 70, "el campo y 2 m alrededor siguen dentro");
  // sin campo de referencia: no recorta, solo amplía
  const wide = B.fitViewBox([0, 0, 10, 10], 2);
  assert.deepEqual(wide, [-5, 0, 20, 10]);
});

test("cámara: hereda del fotograma anterior, se mueve entre fotogramas y los encuadres rápidos caben en su formato", async () => {
  const B = await import("../src/lib/board.js");
  const base = { v: 2, field: "full", look: "blanco", orient: "v", frames: [
    { id: "f1", els: [], cam: { x: 0.5, y: 0.5, w: 1 } },
    { id: "f2", els: [] },
    { id: "f3", els: [], cam: { x: 0.5, y: 0.25, w: 0.5 } },
  ] };
  const b = B.normalizeBoard(base);
  assert.ok(B.hasCamera(b));
  assert.deepEqual(B.frameCam(b, 1), { x: 0.5, y: 0.5, w: 1 }, "el 2 usa la del 1");
  assert.deepEqual(B.frameCam(b, 2), { x: 0.5, y: 0.25, w: 0.5 });
  assert.equal(B.hasCamera(B.normalizeBoard({ v: 2, field: "full", frames: [{ id: "a", els: [], cam: { x: 1 } }] })), false, "una cámara incompleta no cuenta");
  const mid = B.camAtTime(b, 600 + 1500 * 1.5, { speed: 1500 });
  assert.ok(mid.w < 1 && mid.w > 0.5, "a mitad del paso 2→3 la cámara va de un encuadre al otro");
  const full = B.fullViewBox(b);
  const rect = B.camRect(full, B.cameraPreset(b, "full"), 16 / 9);
  assert.ok(Math.abs(rect[2] / rect[3] - 16 / 9) < 0.001);
  assert.ok(rect[1] <= 0 && rect[1] + rect[3] >= 105, "el encuadre completo contiene todo el largo del campo");
  const port = B.camRect(full, B.cameraPreset({ ...b, camRatio: "port" }, "attack"), 9 / 16);
  assert.ok(Math.abs(port[2] / port[3] - 9 / 16) < 0.001);
  assert.ok(port[1] + port[3] / 2 < 30, "la mitad de ataque queda centrada arriba");
  assert.equal(B.normalizeBoard({ ...base, camRatio: "port" }).camRatio, "port");
});

test("vista 3D: marca, encuadre común y suelo que se ve", async () => {
  const B = await import("../src/lib/board.js");
  assert.equal(B.is3D(B.normalizeBoard({ v: 2, field: "full", view3d: true, frames: [{ els: [] }] })), true);
  assert.equal(B.normalizeBoard({ v: 2, field: "full", view3d: "si", frames: [{ els: [] }] }).view3d, undefined);
  const b = { v: 2, field: "full", look: "estadio", orient: "v", frames: [{ id: "f", els: [] }] };
  const { fullVb, vb } = B.boardView(b);
  assert.deepEqual(vb, fullVb);
  assert.deepEqual(fullVb, B.viewBox(B.fieldOf("full"), "v", 13));
  // con proporción fija (vídeo) el recuadro tiene esa proporción
  const v169 = B.boardView(b, { aspect: 16 / 9 }).vb;
  assert.ok(Math.abs(v169[2] / v169[3] - 16 / 9) < 0.01);
  // con cámara, el recuadro de la cámara
  const cam = { x: 0.5, y: 0.5, w: 0.5 };
  assert.deepEqual(B.boardView({ ...b, frames: [{ id: "f", els: [], cam }] }).vb, B.camRect(fullVb, cam, 16 / 9));
  // suelo: campo + margen; en medio campo, solo 3 m por el corte
  assert.deepEqual(B.groundRegion(b), [-13, -13, 81, 118]);
  assert.deepEqual(B.groundRegion({ ...b, field: "half" }), [-13, -13, 81, 118]);
  assert.deepEqual(B.groundRegion({ ...b, look: "blanco" }), [-3, -3, 71, 108]);
});

test("cuadrícula y carriles en los campos pequeños", () => {
  const f = fieldOf("rect");
  const g = BS.markLines(f, "rejilla4");
  assert.equal(g.length, 6);
  assert.deepEqual(g.map((l) => l.x1 === l.x2 ? l.x1 : null).filter((v) => v != null), [7.5, 15, 22.5]);
  assert.deepEqual(g.map((l) => l.y1 === l.y2 ? l.y1 : null).filter((v) => v != null), [10, 20, 30]);
  const c = BS.markLines(fieldOf("futsal"), "carriles5").map((l) => l.x1);
  assert.deepEqual(c, [4, 7.3, 12.7, 16]);
});

test("cambiar de campo: fichas, conos y textos en proporción (no entre campos de 11)", () => {
  const b = { v: 2, field: "full", chipSize: 1, frames: [{ id: "f", els: [{ id: "c", k: "cone", x: 10, y: 10, size: 1 }, { id: "t", k: "text", x: 5, y: 5, size: 3, text: "a" }] }] };
  const fs = changeField(b, "futsal");
  assert.ok(fs.chipSize < 0.5 && fs.chipSize >= 0.3);
  assert.ok(fs.frames[0].els[0].size < 1);
  assert.ok(fs.frames[0].els[1].size < 3);
  const back = changeField(fs, "full");
  assert.ok(Math.abs(back.chipSize - 1) < 0.1);
  const half = changeField(b, "half");
  assert.equal(half.chipSize, 1);
  assert.equal(half.frames[0].els[0].size, 1);
});

test("vista en un solo selector y cámara libre del 3D", async () => {
  const L = await import("../src/lib/board.js");
  const b0 = L.emptyBoard("full");
  assert.equal(L.viewModeOf(b0), "flat");
  const b3 = L.setViewMode(b0, "3d");
  assert.equal(L.viewModeOf(b3), "3d");
  assert.equal(b3.view, "persp");
  assert.equal(L.viewModeOf(L.setViewMode(b3, "persp")), "persp");
  assert.equal(L.setViewMode(b3, "flat").view3d, undefined);
  // validar y limitar
  assert.equal(L.validOrbit({ az: 1 }), null);
  const o = L.validOrbit({ az: -90, tilt: 120, dist: 2, x: 10, y: 20 });
  assert.deepEqual(o, { az: 270, tilt: 89.5, dist: 8, x: 10, y: 20 });
  // dibujo entero
  let b = L.setOrbit({ ...b0, frames: [b0.frames[0], { id: "f2", els: [] }, { id: "f3", els: [] }] }, 1, { az: 0, tilt: 30, dist: 100, x: 34, y: 52 });
  assert.equal(b.orbit.dist, 100);
  assert.equal(L.orbitOf(b, 2).dist, 100);
  // por fotograma: el primero se queda con la de antes y el resto la hereda
  b = L.setOrbit(b, 2, { az: 90, tilt: 50, dist: 60, x: 34, y: 20 }, { perFrame: true });
  assert.equal(b.frames[0].orbit.dist, 100);
  assert.equal(L.orbitOf(b, 1).dist, 100);
  assert.equal(L.orbitOf(b, 2).az, 90);
  // a mitad de camino entre el 2 y el 3 (giro por el lado corto)
  const m = L.orbitBetween(b, 1, 0.5);
  assert.ok(m.az > 40 && m.az < 50 && m.dist > 79 && m.dist < 81);
  assert.equal(L.lerpOrbit({ az: 350, tilt: 0, dist: 1, x: 0, y: 0 }, { az: 10, tilt: 0, dist: 1, x: 0, y: 0 }, 0.5).az, 0);
  assert.equal(L.orbitAtTime(b, 0).dist, 100);
  // se conserva al normalizar, se quita de un fotograma y se vuelve a la automática
  assert.deepEqual(L.normalizeBoard(b).frames[2].orbit, b.frames[2].orbit);
  assert.equal(L.orbitOf(L.clearFrameOrbit(b, 2), 2).dist, 100);
  const auto = L.clearOrbits(b);
  assert.equal(L.orbitOf(auto, 2), null);
  assert.equal(L.hasFrameOrbits(auto), false);
  for (const p of L.ORBIT_PRESETS) assert.ok(L.orbitPreset(b0, p.id), p.id);
});

test("tiradores para la vista 3D (mismos que en 2D)", async () => {
  const L = await import("../src/lib/board.js");
  const hs = (el, o) => L.handleSpec(el, o).pts.map((p) => p.h);
  assert.deepEqual(hs({ k: "arrow", x1: 0, y1: 0, x2: 10, y2: 0 }), ["p1", "p2", "m0"]);
  assert.deepEqual(hs({ k: "arrow", x1: 0, y1: 0, x2: 10, y2: 0, cx: 5, cy: 5 }), ["p1", "p2", "c"]);
  assert.deepEqual(hs({ k: "arrow", x1: 0, y1: 0, x2: 10, y2: 0, via: [{ x: 5, y: 3 }] }), ["p1", "p2", "m0", "m1", "v0"]);
  assert.ok(hs({ k: "arrow", x1: 0, y1: 0, x2: 10, y2: 0, air: true, lift: 4 }).includes("l"));
  assert.deepEqual(hs({ k: "zone", shape: "rect", x: 0, y: 0, w: 4, h: 4 }), ["zc0", "zc1", "zc2", "zc3", "ze0", "ze1", "ze2", "ze3"]);
  assert.deepEqual(hs({ k: "token", x: 10, y: 10, feet: true }), ["f"]);
  assert.deepEqual(hs({ k: "token", x: 10, y: 10 }), []);
  const g = { id: "t", k: "token", x: 20, y: 20, from: { x: 10, y: 10 }, to: { x: 20, y: 20 } };
  assert.deepEqual(hs({ id: "t", k: "token", x: 20, y: 20 }, { ghost: g }), ["tm0"]);
  // la ficha con pies mira hacia arriba (face 0): el tirador va por delante (y menor)
  const f = L.handleSpec({ k: "token", x: 10, y: 10, feet: true }, { chip: 1.5 }).pts[0];
  assert.ok(f.y < 10 && Math.abs(f.x - 10) < 1e-9);
});

test("bloquear y resaltar en todos los fotogramas; lo bloqueado no se mueve", async () => {
  const L = await import("../src/lib/board.js");
  const t = { id: "t1", k: "token", x: 10, y: 10, team: "a" };
  let b = { v: 2, field: "full", frames: [{ id: "f1", els: [t] }, { id: "f2", els: [{ ...t, x: 20 }] }] };
  b = L.toggleFlag(b, 1, ["t1"], "locked");
  assert.equal(b.frames[0].els[0].locked, true);
  assert.equal(b.frames[1].els[0].locked, true);
  assert.deepEqual(L.movableIds(b, 1, ["t1"]), []);
  assert.equal(L.resetToPrevious(b, 1, ["t1"]), b, "lo bloqueado no vuelve atrás");
  b = L.toggleFlag(b, 1, ["t1"], "locked");
  assert.equal(b.frames[1].els[0].locked, undefined);
  assert.equal(L.resetToPrevious(b, 1, ["t1"]).frames[1].els[0].x, 10);
  b = L.toggleFlag(b, 0, ["t1"], "hl");
  assert.equal(L.isHighlighted(b.frames[1].els[0]), true);
  assert.equal(L.snapTo(10.4), 10);
});

// Igualar varias cosas del mismo tipo (03/11/2026)
{
  const { styleElements, matchElements, arrowProps, ARROW_W } = await import('../src/lib/board.js');
  const b = { v: 2, field: 'full', frames: [
    { id: 'f1', els: [
      { id: 'a1', k: 'arrow', x1: 0, y1: 0, x2: 5, y2: 5, width: 1.2, dash: 'dotted', pointer: 'bar' },
      { id: 'a2', k: 'arrow', x1: 1, y1: 0, x2: 6, y2: 5 },
      { id: 'c1', k: 'cone', x: 3, y: 3, size: 1.6, shape: 'flat' },
      { id: 'c2', k: 'cone', x: 4, y: 3 },
      { id: 'c3', k: 'cone', x: 5, y: 3, size: 0.7 },
    ] },
    { id: 'f2', els: [{ id: 'a2', k: 'arrow', x1: 1, y1: 0, x2: 6, y2: 9 }, { id: 'c2', k: 'cone', x: 9, y: 3 }] },
  ] };
  assert.equal(arrowProps({}).width, ARROW_W);
  const ids = ['a1', 'a2', 'c1', 'c2', 'c3'];
  // todas las flechas con el mismo grosor, en todos los fotogramas; los conos no cambian
  const w = styleElements(b, 0, ids, 'arrow', { width: 0.8, x2: 99 });
  assert.equal(w.frames[0].els[0].width, 0.8);
  assert.equal(w.frames[1].els[0].width, 0.8);
  assert.equal(w.frames[1].els[0].x2, 6, 'no toca la posición');
  assert.equal(w.frames[0].els[2].size, 1.6);
  // igualar los conos a la primera: tamaño y forma; la posición no cambia
  const m = matchElements(b, 0, ids, 'cone');
  assert.deepEqual(m.frames[0].els.slice(2).map((e) => [e.size, e.shape, e.x]), [[1.6, 'flat', 3], [1.6, 'flat', 4], [1.6, 'flat', 5]]);
  assert.equal(m.frames[1].els[1].size, 1.6);
  // igualar flechas a la primera: lo que la primera no tiene se quita (vuelve al valor por defecto)
  const b2 = { ...b, frames: [{ id: 'f1', els: [{ id: 'a2', k: 'arrow', x1: 0, y1: 0, x2: 1, y2: 1 }, { id: 'a1', k: 'arrow', x1: 0, y1: 0, x2: 5, y2: 5, width: 1.2, dash: 'dotted' }] }] };
  const m2 = matchElements(b2, 0, ['a2', 'a1'], 'arrow');
  assert.equal(m2.frames[0].els[1].width, undefined);
  assert.equal(m2.frames[0].els[1].dash, undefined);
  // con una sola de ese tipo no cambia nada
  assert.equal(matchElements(b, 0, ['a1', 'c1'], 'cone'), b);
}

test("seleccionar: lo que está debajo del puntero gana; si no, lo más cercano dentro de un margen pequeño", () => {
  const t = token("t1", 10, 10);
  const b = { id: "b1", k: "ball", x: 11.6, y: 10 };
  // el balón va encima de la ficha en el orden de dibujo: tocándolo se coge el balón aunque esté pegado al jugador
  const order = drawOrder([b, t]);
  assert.equal(hitTest(order, { x: 11.8, y: 10 })?.id, "b1");
  // tocando la ficha (lejos del balón) se coge la ficha
  assert.equal(hitTest(order, { x: 9.2, y: 10 })?.id, "t1");
  // fuera de los dos, a menos del margen, el más cercano
  assert.equal(hitTest(order, { x: 10, y: 12 }, { tol: 0.6 })?.id, "t1");
  // más lejos que el margen: nada (antes una ficha se cogía a más de 2 m)
  assert.equal(hitTest(order, { x: 10, y: 13 }, { tol: 0.6 }), null);
});

test("tamaño de letra de los textos de una ficha: 10 = normal, se limita entre 3 y 30 y se iguala con varias", async () => {
  const { chipTextScale, cleanTextSize, CHIP_TEXT_SIZES, styleElements: st, matchElements: me } = await import("../src/lib/board.js");
  assert.deepEqual(CHIP_TEXT_SIZES, [5, 6, 8, 10, 12, 14]);
  assert.equal(chipTextScale({}, "inner"), 1);
  assert.equal(chipTextScale({ innerFs: 5 }, "inner"), 0.5);
  assert.equal(chipTextScale({ labelFs: 14 }, "label"), 1.4);
  assert.equal(chipTextScale({ topFs: 8 }, "label"), 1);
  assert.equal(cleanTextSize(1), 3);
  assert.equal(cleanTextSize(99), 30);
  assert.equal(cleanTextSize("7.25"), 7.3);
  assert.equal(cleanTextSize(""), null);
  assert.equal(cleanTextSize("abc"), null);
  const b = { v: 2, frames: [
    { id: "f1", els: [{ id: "t1", k: "token", team: "a", x: 1, y: 1, labelFs: 12 }, { id: "t2", k: "token", team: "a", x: 2, y: 2 }] },
    { id: "f2", els: [{ id: "t1", k: "token", team: "a", x: 1, y: 3, labelFs: 12 }, { id: "t2", k: "token", team: "a", x: 2, y: 4 }] },
  ] };
  const s = st(b, 0, ["t1", "t2"], "token", { innerFs: 6 });
  assert.deepEqual(s.frames[1].els.map((e) => e.innerFs), [6, 6]);
  const m = me(b, 0, ["t1", "t2"], "token");
  assert.equal(m.frames[0].els[1].labelFs, 12);
  // volver al normal quita el dato
  assert.equal(st(s, 0, ["t1"], "token", { innerFs: undefined }).frames[0].els[0].innerFs, undefined);
});

test("letra de los textos de una ficha: tipografía, negrita, color y borde", async () => {
  const { chipTextLook, fontOf } = await import("../src/lib/board.js");
  assert.deepEqual(chipTextLook({}, "inner"), { font: fontOf("sans"), bold: true, color: null, halo: null });
  const el = { innerFont: "club", innerBold: false, innerColor: "#ff0000", innerHalo: "none", labelHalo: "#73000a", labelFont: "serif" };
  assert.deepEqual(chipTextLook(el, "inner"), { font: fontOf("club"), bold: false, color: "#ff0000", halo: "none" });
  assert.equal(chipTextLook(el, "label").halo, "#73000a");
  assert.equal(chipTextLook(el, "label").font, fontOf("serif"));
  assert.equal(chipTextLook({ labelHalo: "rojo" }, "label").halo, null);
});

test("tarjeta: aplicar la letra de una ficha a todo su equipo", async () => {
  const { applyToTeam } = await import("../src/lib/board.js");
  const src = { id: "a1", k: "token", team: "a", x: 1, y: 1, labelFs: 14, innerFont: "cond", labelBold: false };
  const b = { v: 2, frames: [
    { id: "f1", els: [src, { id: "a2", k: "token", team: "a", x: 2, y: 2, labelFs: 6, innerColor: "#ff0000" }, { id: "b1", k: "token", team: "b", x: 3, y: 3 }] },
    { id: "f2", els: [{ ...src, x: 5 }, { id: "a2", k: "token", team: "a", x: 9, y: 9, labelFs: 6 }, { id: "a3", k: "token", team: "a", x: 4, y: 4 }] },
  ] };
  const { board: out, count } = applyToTeam(b, src);
  assert.equal(count, 2);
  const a2 = out.frames[0].els.find((e) => e.id === "a2");
  assert.equal(a2.labelFs, 14); assert.equal(a2.innerFont, "cond"); assert.equal(a2.labelBold, false);
  assert.equal("innerColor" in a2, false);
  assert.equal(a2.x, 2);
  assert.equal(out.frames[1].els.find((e) => e.id === "a3").labelFs, 14);
  assert.equal(out.frames[0].els.find((e) => e.id === "b1").labelFs, undefined);
  assert.equal(applyToTeam(out, src).count, 0);
});
