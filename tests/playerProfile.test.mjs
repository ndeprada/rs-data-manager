import test from "node:test";
import assert from "node:assert/strict";
import { resultCode, matchRows, seasonTotals, attendanceWindow, attendanceStrip, nextMatchFor, neighbours } from "../src/lib/playerProfile.js";

const now = new Date("2026-11-12T10:00:00");
const ev = (id, date, x = {}) => ({ id, team_id: "t1", date, type: "partido_liga", ...x });
const events = [
  ev("a", "2026-10-01T11:00", { score_home: 2, score_away: 0 }),
  ev("b", "2026-10-08T11:00", { score_home: 1, score_away: 1 }),
  ev("c", "2026-10-15T11:00", { score_home: 0, score_away: 3 }),
  ev("d", "2026-10-22T11:00", { team_id: "t2", score_home: 4, score_away: 1 }),
  ev("e", "2026-10-29T11:00", { team_id: "t2", score_home: 1, score_away: 0 }),
  ev("f", "2026-11-05T11:00", { type: "partido_amistoso", score_home: 3, score_away: 0 }),
  ev("g", "2026-11-14T12:00"),
  ev("h", "2026-11-13T12:00", { postponed: true }),
];
const counted = new Set(["a", "b", "c", "d", "e"]);
const convs = [
  { event_id: "a", player_ids: ["p1", "p2"], starters: ["p1"] },
  { event_id: "b", player_ids: ["p1"], starters: [] },
  { event_id: "c", player_ids: ["p2"], absence_reasons: { p1: "lesion" } },
  { event_id: "d", player_ids: ["p1"], starters: ["p1"] },
  { event_id: "g", player_ids: ["p2"], absence_reasons: { p1: "sancion" } },
];
const stats = [
  { event_id: "a", player_id: "p1", minutes_played: 90, goals: 2, assists: 1, rating: 4 },
  { event_id: "b", player_id: "p1", minutes_played: 20, yellow_cards: 1, rating: 3 },
  { event_id: "d", player_id: "p1", minutes_played: 60, goals: 1 },
];

test("resultado desde nuestro lado", () => {
  assert.equal(resultCode({ score_home: 2, score_away: 1 }), "W");
  assert.equal(resultCode({ score_home: 0, score_away: 0 }), "D");
  assert.equal(resultCode({ score_home: 1, score_away: 2 }), "L");
  assert.equal(resultCode({ score_home: null, score_away: 2 }), null);
});

test("partidos de liga cerrados: los de su equipo y los que jugó de invitado", () => {
  const rows = matchRows({ events, convs, stats, playerId: "p1", teamId: "t1", counted });
  assert.deepEqual(rows.map((r) => r.ev.id), ["d", "c", "b", "a"]);
  assert.equal(rows[0].guest, true);
  assert.equal(rows[1].called, false);
  assert.equal(rows[1].reason, "lesion");
  assert.equal(rows[3].starter, true);
  assert.equal(rows[2].starter, false);
  const tot = seasonTotals(rows);
  assert.equal(tot.matches, 4);
  assert.equal(tot.played, 3);
  assert.equal(tot.starter, 2);
  assert.equal(tot.sub, 1);
  assert.equal(tot.goals, 3);
  assert.equal(tot.minutes, 170);
  assert.equal(tot.yellow, 1);
  assert.equal(tot.rating, 3.5);
});

test("asistencia de 30 días y tira de sesiones", () => {
  const evs = new Map([["t1", { date: "2026-11-10T19:00" }], ["t2", { date: "2026-11-11T19:00" }], ["t3", { date: "2026-09-01T19:00" }], ["t4", { date: "2026-11-09T19:00" }]]);
  const att = [
    { event_id: "t1", status: "present" }, { event_id: "t2", status: "absent", absence_reason: "estudios" },
    { event_id: "t3", status: "present" }, { event_id: "t4", status: "apart" }, { event_id: "t5", status: "" },
  ];
  const w = attendanceWindow(att, evs, { now });
  assert.equal(w.n, 3);
  assert.equal(w.pct, 67);
  assert.deepEqual(w.topReason, { reason: "estudios", n: 1 });
  const s = attendanceStrip(att, evs, { now, n: 3 });
  assert.deepEqual(s.map((x) => x.status), ["apart", "present", "absent"]);
});

test("próximo partido: salta aplazados y dice si está convocado", () => {
  const n = nextMatchFor({ events, convs, teamId: "t1", playerId: "p1", now });
  assert.equal(n.ev.id, "g");
  assert.equal(n.state, "out");
  assert.equal(n.reason, "sancion");
  assert.equal(nextMatchFor({ events, convs, teamId: "t1", playerId: "p2", now }).state, "called");
  assert.equal(nextMatchFor({ events, convs: [], teamId: "t1", playerId: "p2", now }).state, "none");
  assert.equal(nextMatchFor({ events, convs, teamId: "t9", playerId: "p2", now }), null);
});

test("anterior y siguiente del mismo equipo, sin bajas", () => {
  const ps = [
    { id: "a", team_id: "t1", jersey_number: 7, last_name: "Z" },
    { id: "b", team_id: "t1", jersey_number: 1, last_name: "Y" },
    { id: "c", team_id: "t1", jersey_number: null, last_name: "A" },
    { id: "d", team_id: "t1", jersey_number: 3, last_name: "X", status: "baja" },
    { id: "e", team_id: "t2", jersey_number: 2, last_name: "W" },
  ];
  const n = neighbours(ps, ps[0]);
  assert.equal(n.prev.id, "b");
  assert.equal(n.next.id, "c");
  assert.equal(n.total, 3);
  assert.equal(neighbours(ps, ps[1]).prev, null);
  assert.equal(neighbours(ps, ps[2]).next, null);
});
