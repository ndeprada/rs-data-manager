import test from "node:test";
import assert from "node:assert/strict";
import { matchSteps, recentTrainings, trainingDots, messageKit, kitKeyOf, startersWithoutMinutes, matchPlayed } from "../src/lib/matchSteps.js";

const now = new Date("2026-11-13T12:00:00");
const future = { id: "e1", date: "2026-11-15T11:00", type: "partido_liga" };
const past = { id: "e2", date: "2026-11-08T11:00", type: "partido_liga", match_events: [{ type: "sub", playerIn: "p12" }] };
const ids = (n) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const st = (s) => Object.fromEntries(s.map((x) => [x.key, x.state]));

test("antes del partido: la convocatoria es lo que toca y luego la preparación", () => {
  assert.equal(matchPlayed(future, now), false);
  let s = matchSteps({ event: future, conv: null, plan: null, now });
  assert.deepEqual(st(s), { convocatoria: "now", tactica: "todo", acta: "todo", postpartido: "todo" });
  assert.deepEqual(s[0].sub, { key: "Sin convocatoria" });
  assert.equal(s[2].sub.key, "Después del partido");
  s = matchSteps({ event: future, conv: { player_ids: ids(16) }, plan: { formation: "4-3-3", lineup: ids(11), set_pieces: [1, 2, 3] }, now });
  assert.equal(s[0].state, "now");
  assert.deepEqual(s[0].sub, { key: "{n} convocados · aviso sin enviar", vars: { n: 16 } });
  assert.equal(s[1].state, "done");
  assert.deepEqual(s[1].sub, { key: "{f} listo · {n} jugadas ABP", vars: { f: "4-3-3", n: 3 } });
  s = matchSteps({ event: future, conv: { player_ids: ids(16), notified: true }, plan: { formation: "4-3-3", lineup: ids(7) }, now });
  assert.deepEqual(st(s), { convocatoria: "done", tactica: "now", acta: "todo", postpartido: "todo" });
  assert.deepEqual(s[1].sub, { key: "Alineación {a}/{b}", vars: { a: 7, b: 11 } });
});

test("después del partido: acta pendiente por minutos de titulares, luego valoraciones", () => {
  const conv = { player_ids: ids(14), starters: ids(11), notified: true };
  const stats = ids(9).map((id) => ({ player_id: id, minutes_played: 90 }));
  let s = matchSteps({ event: past, conv, stats, pending: ["Faltan minutos/cambios"], now });
  assert.equal(s[2].state, "now");
  assert.deepEqual(s[2].sub, { key: "Falta: minutos de {n} titulares", vars: { n: 2 } });
  assert.deepEqual(startersWithoutMinutes(conv, stats), ["p10", "p11"]);
  assert.deepEqual(s[3].sub, { key: "{a} de {b} valorados", vars: { a: 0, b: 12 } });
  const full = ids(11).map((id) => ({ player_id: id, minutes_played: 90, rating: 7 }));
  s = matchSteps({ event: past, conv, stats: full, pending: [], now });
  assert.equal(s[2].state, "done");
  assert.equal(s[3].state, "now"); // p12 entró y no está valorado
  s = matchSteps({ event: past, conv: { player_ids: ids(3) }, stats: [], pending: ["Sin alineación"], now });
  assert.deepEqual(s[2].sub, { key: "Falta: {r}", vars: { r: "Sin alineación" }, reason: "Sin alineación" });
});

test("últimos entrenos del equipo y estado de cada jugador", () => {
  const evs = [
    { id: "t1", team_id: "A", type: "entrenamiento", date: "2026-11-09T19:00" },
    { id: "t2", team_id: "A", type: "entrenamiento", date: "2026-11-10T19:00" },
    { id: "t3", team_id: "A", type: "entrenamiento", date: "2026-11-11T19:00", cancelled: true },
    { id: "t4", team_id: "A", type: "entrenamiento", date: "2026-11-12T19:00" },
    { id: "t5", team_id: "A", type: "entrenamiento", date: "2026-11-14T19:00" }, // después de hoy
    { id: "t6", team_id: "B", type: "entrenamiento", date: "2026-11-12T19:00" },
  ];
  const tr = recentTrainings(evs, "A", { before: "2026-11-15T11:00", now });
  assert.deepEqual(tr.map((e) => e.id), ["t1", "t2", "t4"]);
  const dots = trainingDots(tr, [
    { event_id: "t1", player_id: "p1", status: "present" },
    { event_id: "t4", player_id: "p1", status: "absent", absence_reason: "lesion" },
  ], ["p1", "p2"]);
  assert.deepEqual(dots.p1, [{ status: "present", reason: null }, null, { status: "absent", reason: "lesion" }]);
  assert.deepEqual(dots.p2, [null, null, null]);
});

test("equipación del mensaje", () => {
  assert.equal(messageKit({}, ""), "");
  assert.equal(messageKit({ kit: "" }, "Chándal"), "Chándal");
  assert.equal(messageKit({ kit: "segunda", kit_color: "Verde", kit_size: "14" }, "Chándal del club"), "2.ª equipación · verde · talla 14 · Chándal del club");
  assert.equal(kitKeyOf({ kit: "" }), "primera");
  assert.equal(kitKeyOf({ kit: "tercera" }), "tercera");
});
