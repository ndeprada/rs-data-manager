import test from "node:test";
import assert from "node:assert/strict";
import { playedMatches, recordOf, formOf, perMatch, playerTotals, leaders, cycleWarning, attendanceByTeam, sortCompare, mirrorRows, circleRadius, sortPlayers } from "../src/lib/statsOverview.js";

const now = new Date("2026-11-13T12:00");
const E = [
  { id: "a", team_id: "t1", type: "partido_liga", date: "2026-10-01T11:00", score_home: 2, score_away: 0 },
  { id: "b", team_id: "t1", type: "partido_liga", date: "2026-10-08T11:00", score_home: 1, score_away: 1 },
  { id: "c", team_id: "t2", type: "partido_liga", date: "2026-10-09T11:00", score_home: 0, score_away: 3 },
  { id: "d", team_id: "t1", type: "partido_amistoso", date: "2026-10-10T11:00", score_home: 5, score_away: 0 },
  { id: "e", team_id: "t1", type: "partido_liga", date: "2026-10-15T11:00", score_home: "", score_away: "" },
  { id: "f", team_id: "t1", type: "partido_liga", date: "2026-10-20T11:00", score_home: 3, score_away: 1, cancelled: true },
  { id: "g", team_id: "t1", type: "partido_liga", date: "2026-12-01T11:00", score_home: 1, score_away: 0 },
];

test("partidos jugados por tipo y equipo", () => {
  assert.deepEqual(playedMatches(E, { now }).map((e) => e.id), ["a", "b", "c"]);
  assert.deepEqual(playedMatches(E, { teamId: "t1", now }).map((e) => e.id), ["a", "b"]);
  assert.deepEqual(playedMatches(E, { types: ["partido_amistoso"], now }).map((e) => e.id), ["d"]);
});

test("balance, racha y por partido", () => {
  const r = recordOf(playedMatches(E, { now }));
  assert.deepEqual(r, { w: 1, d: 1, l: 1, n: 3, gf: 3, ga: 4, clean: 1, winPct: 33 });
  assert.deepEqual(formOf(playedMatches(E, { now })), ["G", "E", "P"]);
  assert.equal(perMatch(22, 9), 2.4);
  assert.equal(perMatch(3, 0), null);
});

test("totales por jugador, líderes y ciclo de amarillas", () => {
  const t = playerTotals([
    { player_id: "p1", goals: 2, assists: 1, minutes_played: 90, yellow_cards: 1 },
    { player_id: "p1", goals: 1, minutes_played: 60, yellow_cards: 3 },
    { player_id: "p2", assists: 3, minutes_played: 0 },
  ]);
  assert.deepEqual(t.get("p1"), { player_id: "p1", goals: 3, assists: 1, minutes: 150, yellow: 4, red: 0, games: 2 });
  assert.deepEqual(leaders(t, "goals").map((r) => r.player_id), ["p1"]);
  assert.deepEqual(leaders(t, "assists").map((r) => r.player_id), ["p2", "p1"]);
  assert.deepEqual(cycleWarning(4), { left: 1, yellow: 4 });
  assert.equal(cycleWarning(5), null);
  assert.deepEqual(cycleWarning(9), { left: 1, yellow: 9 });
  assert.equal(cycleWarning(0), null);
  assert.equal(cycleWarning(4, 0), null);
});

test("asistencia por equipo desde una fecha, sin suspendidos", () => {
  const ev = new Map([["x", { id: "x", team_id: "t1", date: "2026-11-01T19:00" }], ["y", { id: "y", team_id: "t1", date: "2026-11-02T19:00", cancelled: true }], ["z", { id: "z", team_id: "t2", date: "2026-07-01T19:00" }]]);
  const a = [{ event_id: "x", status: "present" }, { event_id: "x", status: "absent" }, { event_id: "x", status: "apart" }, { event_id: "y", status: "absent" }, { event_id: "z", status: "present" }];
  const m = attendanceByTeam(a, ev, { since: new Date("2026-08-01"), now });
  assert.deepEqual(m.get("t1"), { rate: 67, n: 3 });
  assert.equal(m.has("t2"), false);
});

test("orden de la comparativa y de la tabla de jugadores", () => {
  const rows = [{ id: 1, rec: { winPct: 50, gf: 3, ga: 2 }, att: 90 }, { id: 2, rec: { winPct: 80, gf: 5, ga: 1 }, att: 70 }, { id: 3, rec: { winPct: null, gf: 0, ga: 0 }, att: null }];
  assert.deepEqual(sortCompare(rows, "victorias").map((r) => r.id), [2, 1, 3]);
  assert.deepEqual(sortCompare(rows, "entrenos").map((r) => r.id), [2, 1, 3]);
  assert.deepEqual(sortCompare(rows).map((r) => r.id), [1, 2, 3]);
  const pr = [{ p: { jersey_number: 9 }, b: { mins: 100, pctAvail: 90 }, t: { goals: 5, assists: 0 } }, { p: { jersey_number: 1 }, b: { mins: 300, pctAvail: 40 }, t: { goals: 0, assists: 0 } }];
  assert.deepEqual(sortPlayers(pr, "min").map((r) => r.p.jersey_number), [1, 9]);
  assert.deepEqual(sortPlayers(pr, "goles").map((r) => r.p.jersey_number), [9, 1]);
  assert.deepEqual(sortPlayers(pr, "bajo").map((r) => r.p.jersey_number), [1, 9]);
  assert.deepEqual(sortPlayers(pr, "pos").map((r) => r.p.jersey_number), [1, 9]);
});

test("barras en espejo y círculos del mapa", () => {
  const m = mirrorRows([{ label: "A", f: 4, a: 2 }, { label: "B", f: 0, a: 1 }]);
  assert.equal(m[0].fw, 100); assert.equal(m[0].aw, 50); assert.equal(m[1].fw, 0); assert.equal(m[1].aw, 25);
  assert.equal(circleRadius(0, 8), 0);
  assert.equal(circleRadius(8, 8), 32);
  assert.ok(circleRadius(2, 8) > 10 && circleRadius(2, 8) < 32);
});
