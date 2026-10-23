import test from "node:test";
import assert from "node:assert/strict";
import { buildConvocationText, groupPlayers, dorsalOf, observationLines, sideLabel, reasonText, GROUP_ORDER } from "../src/lib/convocationMessage.js";

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
  assert.deepEqual(g.map((x) => x.group), ["Porteros", "Defensas", "Medios", "Delanteros", "Sin posición"]);
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
  assert.ok(lines.includes("🏠 Jugamos en casa · Camp Municipal"), "sin dato de local/visitante = en casa, con el nombre del campo al lado");
  assert.ok(!lines.some((l) => l.startsWith("📍")), "sin enlace de mapa no hay línea 📍");
  const iConv = lines.indexOf("*✅ Convocados (5):*"), iNot = lines.indexOf("*❌ No convocados (4):*");
  assert.ok(iConv > 0 && iNot > iConv, "primero los convocados y después los no convocados");
  assert.deepEqual(lines.slice(iConv + 1, iNot - 1), [
    "_Porteros_", "1 · Hugo Pérez", "",
    "_Defensas_", "5 · Eric Alba", "4 · Nil Costa", "",
    "_Medios_", "6 · Pau Soler", "",
    "_Delanteros_", "9 · Marc Vila",
  ], "una línea en blanco entre cada posición");
  // no convocados: una lista seguida, ordenada por posición pero sin escribir la posición (ni líneas en blanco)
  assert.deepEqual(lines.slice(iNot + 1), ["3 · Joan Ruiz", "8 · Leo Ferrer", "11 · Álex Mas", "• Biel Roca"]);
  assert.ok(!lines.slice(iNot).some((l) => l.startsWith("_")), "los no convocados no llevan títulos de posición");
});

test("no convocados: el motivo va entre paréntesis y «otro» o sin motivo no escriben nada (se edita a mano en el mensaje)", () => {
  const conv = squad.filter((x) => x.id === "g1");
  const not = squad.filter((x) => ["c1", "c2", "m1", "e1", "x1"].includes(x.id));
  const reasons = { c1: "lesion", c2: "decision_tecnica", m1: "sancion", e1: "otro", g1: "lesion" };
  const lines = buildConvocationText({ event, team, convocados: conv, noConvocados: not, reasons }).split("\n");
  const iNot = lines.indexOf("*❌ No convocados (5):*");
  assert.deepEqual(lines.slice(iNot + 1), ["5 · Eric Alba (decisión técnica)", "4 · Nil Costa (lesión)", "6 · Pau Soler (sanción)", "11 · Álex Mas", "• Biel Roca"]);
  assert.ok(!lines.slice(0, iNot).some((l) => l.includes("(lesión)")), "los convocados no llevan motivo aunque tengan uno guardado");
  assert.deepEqual(["lesion", "enfermo", "sancion", "descanso", "decision_tecnica", "viaje", "estudios", "otro", "sin_motivo", undefined].map(reasonText), ["lesión", "enfermo", "sanción", "descanso", "decisión técnica", "viaje", "estudios", "", "", ""]);
  const sinMotivos = buildConvocationText({ event, team, convocados: conv, noConvocados: not }).split("\n");
  assert.ok(sinMotivos.includes("4 · Nil Costa") && !sinMotivos.some((l) => !l.startsWith("*") && l.includes("(")), "sin motivos guardados, ninguna línea de jugador lleva paréntesis");
});

test("en casa o fuera: 🏠 / ✈️ con el campo al lado; el enlace del mapa va aparte; sin rival no se dice", () => {
  const base = { team, convocados: [squad[3]] };
  const home = buildConvocationText({ ...base, event: { ...event, is_home: true, location_url: "https://maps.example/campo" } }).split("\n");
  const iHome = home.indexOf("🏠 Jugamos en casa · Camp Municipal");
  assert.ok(iHome > 0 && home[iHome + 1] === "📍 https://maps.example/campo");
  const away = buildConvocationText({ ...base, event: { ...event, is_home: false, location: "Camp de l'Europa" } }).split("\n");
  assert.ok(away.includes("✈️ Jugamos fuera · Camp de l'Europa") && !away.some((l) => l.includes("🏠")));
  const noField = buildConvocationText({ ...base, event: { ...event, is_home: false, location: "" } }).split("\n");
  assert.ok(noField.includes("✈️ Jugamos fuera"));
  const torneo = buildConvocationText({ ...base, event: { date: event.date, title: "Torneo de Navidad", location: "Pabellón", is_home: true } }).split("\n");
  assert.ok(torneo.includes("📍 Pabellón") && !torneo.some((l) => l.includes("Jugamos")));
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

test("observationLines: 👕 y ℹ️ solo si están escritas (también las usa el aviso al móvil)", () => {
  assert.deepEqual(observationLines({ kit: " Chándal ", info: "Traed agua" }), ["👕 Chándal", "ℹ️ Traed agua"]);
  assert.deepEqual(observationLines({ kit: "", info: "Solo info" }), ["ℹ️ Solo info"]);
  assert.deepEqual(observationLines({ kit: "Solo equipación", info: "  " }), ["👕 Solo equipación"]);
  assert.deepEqual(observationLines({}), []);
  assert.deepEqual(observationLines(), []);
});

test("sideLabel: casa o fuera solo en partidos con rival (también lo usa el aviso al móvil)", () => {
  assert.equal(sideLabel({ opponent: "CE Europa", is_home: true }), "🏠 Jugamos en casa");
  assert.equal(sideLabel({ opponent: "CE Europa", is_home: false }), "✈️ Jugamos fuera");
  assert.equal(sideLabel({ opponent: "CE Europa" }), "🏠 Jugamos en casa");
  assert.equal(sideLabel({ title: "Torneo", is_home: false }), "");
  assert.equal(sideLabel(undefined), "");
});

test("texto para el aviso al móvil (plain): el mismo contenido que WhatsApp, sin título ni marcas *negrita* / _cursiva_", () => {
  const conv = squad.filter((x) => ["g1", "c1", "c2", "m1", "d1"].includes(x.id));
  const not = squad.filter((x) => ["l1", "e1"].includes(x.id));
  const args = { event: { ...event, is_home: false }, team, convocados: conv, noConvocados: not, reasons: { l1: "lesion" }, callupTime: "10:45", kit: "Chándal del club", info: "Traed agua" };
  const wa = buildConvocationText(args).split("\n");
  const plain = buildConvocationText({ ...args, plain: true }).split("\n");
  assert.equal(plain[0], "🆚 CE Europa", "sin la línea CONVOCATORIA: ya va en el título del aviso");
  assert.ok(!plain.join("\n").includes("*") && !plain.some((l) => /^_.*_$/.test(l)), "sin marcas de WhatsApp");
  assert.deepEqual(plain.slice(plain.indexOf("✅ Convocados (5):")), [
    "✅ Convocados (5):",
    "Porteros", "1 · Hugo Pérez", "",
    "Defensas", "5 · Eric Alba", "4 · Nil Costa", "",
    "Medios", "6 · Pau Soler", "",
    "Delanteros", "9 · Marc Vila",
    "",
    "❌ No convocados (2):",
    "3 · Joan Ruiz (lesión)", "11 · Álex Mas",
    "",
    "Observaciones:", "👕 Chándal del club", "ℹ️ Traed agua",
  ]);
  assert.ok(plain.includes("✈️ Jugamos fuera · Camp Municipal") && plain.includes("⏰ Partido: 11:30 · Convocatoria: 10:45"));
  // todo lo demás coincide con el de WhatsApp una vez quitadas las marcas
  const strip = (l) => l.replace(/^\*(.*)\*$/, "$1").replace(/^_(.*)_$/, "$1");
  assert.deepEqual(wa.slice(1).map(strip), plain);
});
