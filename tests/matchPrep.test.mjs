import test from "node:test";
import assert from "node:assert/strict";
import { lineupAlerts, previousLineup, plainSummary, rivalSummary, shirtName, firstSurname } from "../src/lib/matchPrep.js";

const P = (id, o = {}) => ({ id, first_name: "Nom" + id, last_name: "Ape" + id, ...o });

test("avisos: lesionado en el once, no convocado y pocos minutos en el banquillo", () => {
  const slots = [P("a"), null, P("b", { status: "lesionado" }), P("c"), P("d")];
  const injuryOf = new Map([["a", { expected_return: "2026-11-22" }]]);
  const out = lineupAlerts({
    slots, injuryOf, convocadoIds: ["a", "b", "d", "e", "f"],
    bench: [P("e"), P("f")],
    minutesOf: (id) => (id === "e" ? { pct: 28, level: "alert" } : { pct: 60, level: "ok" }),
  });
  assert.deepEqual(out.map((x) => [x.kind, x.player.id, x.slot ?? null]), [
    ["injured", "a", 0], ["injured", "b", 2], ["notCalled", "c", 3], ["lowMinutes", "e", null],
  ]);
  assert.equal(out[0].back, "2026-11-22");
  assert.equal(out[3].pct, 28);
});

test("avisos: sin convocatoria no se avisa de «no convocado»", () => {
  assert.deepEqual(lineupAlerts({ slots: [P("a")], convocadoIds: [] }), []);
});

test("como el último partido: el más reciente anterior con alguien en el once", () => {
  const events = [{ id: "e1", date: "2026-10-01T11:00" }, { id: "e2", date: "2026-10-20T11:00" }, { id: "e3", date: "2026-11-15T11:00" }, { id: "e4", date: "2026-11-30T11:00" }];
  const plans = [
    { event_id: "e1", lineup: ["a"] },
    { event_id: "e2", lineup: ["b", null] },
    { event_id: "e4", lineup: ["z"] },
    { event_id: "e3", lineup: ["x"] },
    { event_id: "e9", lineup: ["q"] },
  ];
  const r = previousLineup({ plans, events, eventId: "e3" });
  assert.equal(r.event.id, "e2");
  assert.deepEqual(r.plan.lineup, ["b", null]);
  assert.equal(previousLineup({ plans: [{ event_id: "e2", lineup: [null] }], events, eventId: "e3" }), null);
});

test("resumen de un texto con formato", () => {
  assert.equal(plainSummary("<p>Salida en 3</p><p>Buscar la <b>espalda</b></p>"), "Salida en 3 · Buscar la espalda");
  assert.equal(plainSummary("<p>&nbsp;</p>"), "");
  assert.equal(plainSummary("x".repeat(200), 10).length, 10);
});

test("resumen del rival", () => {
  assert.equal(rivalSummary({ available: false }), null);
  const r = rivalSummary({
    available: true, rival: { pos: 5, pts: 17, pj: 9, gf: 18, gc: 11 }, away: { pj: 4, g: 2, e: 1, p: 1 },
    form: [{ result: "G" }, { result: "P" }], scorers: [{ name: "A", goals: 7 }],
    insightItems: [{ id: "h2h", v: { result: "E", our: 2, rival: 2, away: false } }],
  });
  assert.equal(r.away, "2-1-1");
  assert.deepEqual(r.form, ["G", "P"]);
  assert.deepEqual(r.h2h, { result: "E", our: 2, rival: 2, away: false });
});

test("nombre de la camiseta: nombre y primer apellido", () => {
  assert.equal(shirtName({ first_name: "Arnau", last_name: "Vidal Puig" }), "Arnau Vidal");
  assert.equal(shirtName({ first_name: "Pol", last_name: "de la Torre Gil" }), "Pol de la Torre");
  assert.equal(shirtName({ first_name: "Francisco", nickname: "Kiku", last_name: "Carcasona Andreu" }), "Kiku Carcasona");
  assert.equal(firstSurname(""), "");
});
