import test from "node:test";
import assert from "node:assert/strict";
import { buildConvocationText, groupPlayers, dorsalOf, GROUP_ORDER } from "../src/lib/convocationMessage.js";

const p = (id, first, last, position, jersey_number, extra = {}) => ({ id, first_name: first, last_name: last, position, jersey_number, ...extra });
const event = { date: new Date(2026, 9, 25, 11, 30).toISOString(), opponent: "CE Europa", location: "Camp Municipal", location_url: "" };
const team = { name: "Juvenil B" };

const squad = [
  p("d1", "Marc", "Vila", "delantero_centro", 9),
  p("m1", "Pau", "Soler", "mediocentro", 6),
  p("l1", "Joan", "Ruiz", "lateral", 3),
  p("g1", "Hugo", "Pérez", "portero", 1),
  p("c1", "Nil", "Costa", "central", 4),
  p("e1", "Álex", "Mas", "extremo", 11),
  p("x1", "Biel", "Roca", "", ""),
  p("c2", "Eric", "Alba", "central", 5),
  p("i1", "Leo", "Ferrer", "interior", 8),
];

test("jugadores por posición: porteros, defensas, centrocampistas, delanteros y sin posición", () => {
  const g = groupPlayers(squad);
  assert.deepEqual(g.map((x) => x.group), ["Porteros", "Defensas", "Centrocampistas", "Delanteros", "Sin posición"]);
  assert.deepEqual(g.map((x) => x.group), GROUP_ORDER);
  assert.deepEqual(g[1].players.map((x) => x.id), ["c2", "c1", "l1"], "defensas: centrales (por apellido) y luego laterales");
  assert.deepEqual(g[2].players.map((x) => x.id), ["m1", "i1"], "mediocentro antes que interior");
  assert.deepEqual(g[3].players.map((x) => x.id), ["e1", "d1"], "extremo antes que delantero centro");
  assert.deepEqual(groupPlayers([]), []);
  assert.deepEqual(groupPlayers(undefined), []);
  assert.deepEqual(groupPlayers([p("a", "A", undefined, "portero", 1), p("b", "B", "Z", "portero", 2)]).map((x) => x.players.length), [2], "sin apellido no falla");
});

test("el dorsal sale como texto y vacío si no tiene", () => {
  assert.equal(dorsalOf(p("a", "A", "B", "portero", 13)), "13");
  assert.equal(dorsalOf(p("a", "A", "B", "portero", "7 ")), "7");
  assert.equal(dorsalOf(p("a", "A", "B", "portero", null)), "");
  assert.equal(dorsalOf(p("a", "A", "B", "portero", 0)), "");
  assert.equal(dorsalOf(undefined), "");
});

test("el mensaje lleva convocados y no convocados, cada lista por posición y con el dorsal al lado", () => {
  const conv = squad.filter((x) => ["g1", "c1", "c2", "m1", "d1"].includes(x.id));
  const not = squad.filter((x) => !["g1", "c1", "c2", "m1", "d1"].includes(x.id));
  const text = buildConvocationText({ event, team, convocados: conv, noConvocados: not, callupTime: "10:45" });
  const lines = text.split("\n");
  assert.equal(lines[0], "*CONVOCATORIA · Juvenil B*");
  assert.ok(lines.includes("🆚 CE Europa"));
  assert.ok(lines.includes("📅 domingo 25 de octubre"));
  assert.ok(lines.includes("⏰ Partido: 11:30 · Convocatoria: 10:45"));
  assert.ok(lines.includes("📍 Camp Municipal"));
  const iConv = lines.indexOf("*✅ Convocados (5):*"), iNot = lines.indexOf("*❌ No convocados (4):*");
  assert.ok(iConv > 0 && iNot > iConv, "primero los convocados y después los no convocados");
  assert.deepEqual(lines.slice(iConv + 1, iNot - 1), [
    "_Porteros_", "1 · Hugo Pérez",
    "_Defensas_", "5 · Eric Alba", "4 · Nil Costa",
    "_Centrocampistas_", "6 · Pau Soler",
    "_Delanteros_", "9 · Marc Vila",
  ]);
  assert.deepEqual(lines.slice(iNot + 1), [
    "_Defensas_", "3 · Joan Ruiz",
    "_Centrocampistas_", "8 · Leo Ferrer",
    "_Delanteros_", "11 · Álex Mas",
    "_Sin posición_", "• Biel Roca",
  ]);
});

test("sin no convocados no hay segunda lista; si nadie tiene posición no hay títulos de grupo", () => {
  const text = buildConvocationText({ event, team, convocados: [p("a", "Ana", "Ruiz", "", 2), p("b", "Berta", "Soler", "", 7)], noConvocados: [] });
  assert.ok(!text.includes("No convocados"));
  assert.ok(!text.includes("_Sin posición_"));
  assert.ok(text.includes("*✅ Convocados (2):*\n2 · Ana Ruiz\n7 · Berta Soler"));
});

test("observaciones: 👕 la equipación y ℹ️ la información extra, y solo lo que está escrito", () => {
  const base = { event, team, convocados: [squad[3]], noConvocados: [] };
  const both = buildConvocationText({ ...base, kit: " Camiseta granate, pantalón negro ", info: "Quedamos en el campo.\nTraed agua." });
  assert.ok(both.endsWith("*Observaciones:*\n👕 Camiseta granate, pantalón negro\nℹ️ Quedamos en el campo.\nTraed agua."));
  const onlyKit = buildConvocationText({ ...base, kit: "Chándal del club" });
  assert.ok(onlyKit.endsWith("*Observaciones:*\n👕 Chándal del club") && !onlyKit.includes("ℹ️"));
  const onlyInfo = buildConvocationText({ ...base, info: "Comida después" });
  assert.ok(onlyInfo.endsWith("*Observaciones:*\nℹ️ Comida después") && !onlyInfo.includes("👕"));
  const none = buildConvocationText({ ...base, kit: "  ", info: "" });
  assert.ok(!none.includes("Observaciones"));
});

test("sin rival se usa el título del evento y sin hora de convocatoria solo la del partido", () => {
  const text = buildConvocationText({ event: { date: event.date, title: "Torneo de Navidad" }, team, convocados: [squad[3]] });
  assert.ok(text.includes("🏆 Torneo de Navidad") && !text.includes("🆚"));
  assert.ok(text.includes("⏰ Partido: 11:30\n") || text.includes("⏰ Partido: 11:30"));
  assert.ok(!text.includes("Convocatoria: "));
  assert.ok(!text.includes("\n\n\n"), "nunca dos líneas en blanco seguidas");
});
