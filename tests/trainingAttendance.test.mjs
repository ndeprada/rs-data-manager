import test from "node:test";
import assert from "node:assert/strict";
import { recordsOf, periodStart, pastTrainings, sessionCounts, sessionTotals, playerSummary, reasonTotals, teamRates, neighbours, recentAbsences, sortSummary } from "../src/lib/trainingAttendance.js";

const now = new Date("2026-11-13T20:00:00");
const ev = (id, date, extra = {}) => ({ id, team_id: "t1", type: "entrenamiento", date, ...extra });
const EV = [ev("e1", "2026-10-01T19:00"), ev("e2", "2026-11-03T19:00"), ev("e3", "2026-11-05T19:00", { cancelled: true }), ev("e4", "2026-11-10T19:00"),
  ev("e5", "2026-11-20T19:00"), { id: "m1", team_id: "t1", type: "partido_liga", date: "2026-11-08T11:00" }, ev("o1", "2026-11-10T19:00", { team_id: "t2" })];
const A = [
  { player_id: "p1", event_id: "e1", status: "present" }, { player_id: "p2", event_id: "e1", status: "absent", absence_reason: "clase" },
  { player_id: "p1", event_id: "e4", status: "apart" }, { player_id: "p2", event_id: "e4", status: "absent" },
  { player_id: "g1", event_id: "e4", status: "present" },
  { player_id: "p1", date: "2026-11-03", status: "present" }, // antiguo, sin event_id
];

test("registros de un entreno por event_id o por día si son antiguos", () => {
  assert.deepEqual(recordsOf(A, EV[1]).map((r) => r.player_id), ["p1"]);
  assert.equal(recordsOf(A, EV[3]).length, 3);
  assert.deepEqual(recordsOf(A, null), []);
});

test("inicio del periodo", () => {
  assert.equal(periodStart("temporada", now).toISOString().slice(0, 10), new Date(2026, 7, 1).toISOString().slice(0, 10));
  assert.equal(periodStart("mes", now).getDate(), 1);
  assert.equal(Math.round((now - periodStart("30", now)) / 86400000), 30);
  assert.equal(periodStart("temporada", new Date("2027-03-01")).getFullYear(), 2026);
});

test("entrenos pasados del equipo con su estado; sin futuros, partidos ni otros equipos", () => {
  const t = pastTrainings(EV, A, { teamId: "t1", now });
  assert.deepEqual(t.map((x) => [x.ev.id, x.state]), [["e1", "done"], ["e2", "done"], ["e3", "off"], ["e4", "done"]]);
  const t2 = pastTrainings([ev("z", "2026-11-11T19:00")], [], { teamId: "t1", now });
  assert.equal(t2[0].state, "pending");
});

test("recuento de un entreno: plantilla y totales", () => {
  const recs = recordsOf(A, EV[3]);
  assert.deepEqual(sessionCounts(recs, ["p1", "p2", "p3"]), { present: 0, apart: 1, absent: 1, pending: 1, marked: 2, pct: 50 });
  assert.deepEqual(sessionTotals(recs), { present: 1, apart: 1, absent: 1, marked: 3, pct: 67 });
  assert.equal(sessionCounts([], ["p1"]).pct, null);
});

test("resumen por jugador: periodo, motivos, % y últimos entrenos", () => {
  const t = pastTrainings(EV, A, { teamId: "t1", now });
  const [p1, p2] = playerSummary([{ id: "p1" }, { id: "p2" }], t, { since: new Date("2026-08-01") });
  assert.equal(p1.present, 2); assert.equal(p1.apart, 1); assert.equal(p1.pct, 100);
  assert.deepEqual(p1.last, ["s", "s", "c", "a"]);
  assert.equal(p2.absent, 2); assert.equal(p2.pct, 0);
  assert.deepEqual(p2.reasons, { clase: 1, otro: 1 });
  assert.deepEqual(p2.last, ["n", "x", "c", "n"]);
  const [q1] = playerSummary([{ id: "p1" }], t, { since: new Date("2026-11-01"), lastN: 2 });
  assert.equal(q1.marked, 2); assert.deepEqual(q1.last, ["c", "a"]);
  assert.deepEqual(reasonTotals([p1, p2]), [["clase", 1], ["otro", 1]]);
});

test("% del equipo en el periodo y tendencia de 30 días", () => {
  const t = pastTrainings(EV, A, { teamId: "t1", now });
  const r = teamRates(t, { since: new Date("2026-08-01"), now, rosterIds: ["p1", "p2"] });
  assert.equal(r.period, 60);
  assert.equal(r.last30, 67);
  assert.equal(r.trend, 17);
});

test("entreno anterior y siguiente", () => {
  const n = neighbours(EV, EV[3]);
  assert.equal(n.prev.id, "e3"); assert.equal(n.next.id, "e5");
  assert.equal(neighbours(EV, EV[0]).prev, null);
  assert.deepEqual(neighbours(EV, null), { prev: null, next: null });
});

test("faltas recientes y orden", () => {
  const t = pastTrainings(EV, A, { teamId: "t1", now });
  assert.deepEqual(recentAbsences(t, "p2", 5), { absent: 2, of: 2 });
  const rows = [{ p: { jersey_number: 9 }, pct: 80 }, { p: { jersey_number: 1 }, pct: 50 }, { p: { jersey_number: 3 }, pct: null }];
  assert.deepEqual(sortSummary(rows, "bajo").map((r) => r.p.jersey_number), [1, 9, 3]);
  assert.deepEqual(sortSummary(rows, "dorsal").map((r) => r.p.jersey_number), [1, 3, 9]);
});
