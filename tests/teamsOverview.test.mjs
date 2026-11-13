import test from "node:test";
import assert from "node:assert/strict";
import { playedLeague, leagueForm, record, nextMatch, teamAttendance, coachOf, standingOf, sortOverview, overviewKpis, matchesSearch } from "../src/lib/teamsOverview.js";

const now = new Date("2026-11-12T10:00:00");
const ev = (id, date, type, sh, sa, x = {}) => ({ id, team_id: "t1", date, type, score_home: sh, score_away: sa, ...x });
const events = [
  ev("a", "2026-10-01T11:00", "partido_liga", 2, 0),
  ev("b", "2026-10-08T11:00", "partido_liga", 1, 1),
  ev("c", "2026-10-15T11:00", "partido_amistoso", 5, 0),
  ev("d", "2026-10-22T11:00", "partido_liga", 0, 3),
  ev("e", "2026-10-29T11:00", "partido_liga", 3, 2, { cancelled: true }),
  ev("f", "2026-11-14T12:00", "partido_liga", null, null),
  ev("g", "2026-11-13T12:00", "partido_liga", null, null, { postponed: true }),
  ev("h", "2026-11-05T19:00", "entrenamiento"),
  ev("i", "2026-09-20T19:00", "entrenamiento"),
];

test("liga jugada, racha y balance", () => {
  const p = playedLeague(events, "t1", now);
  assert.deepEqual(p.map((m) => m.id), ["a", "b", "d"]);
  assert.deepEqual(leagueForm(p), ["G", "E", "P"]);
  assert.deepEqual(leagueForm(p, 2), ["E", "P"]);
  assert.deepEqual(record(p), { w: 1, d: 1, l: 1, n: 3, gf: 3, ga: 4 });
});

test("próximo partido sin aplazados", () => {
  assert.equal(nextMatch(events, "t1", now).id, "f");
  assert.equal(nextMatch(events, "t2", now), null);
});

test("asistencia de 30 días por equipo", () => {
  const byId = new Map(events.map((e) => [e.id, e]));
  const att = [{ event_id: "h", status: "present" }, { event_id: "h", status: "apart" }, { event_id: "h", status: "absent" }, { event_id: "h", status: "present" }, { event_id: "i", status: "absent" }, { event_id: "h" }];
  assert.deepEqual(teamAttendance(att, byId, { now }).get("t1"), { rate: 75, n: 4 });
});

test("cuerpo técnico", () => {
  const names = { s1: "Ana", s2: "Biel", s3: "Carla" };
  const nameOf = (id) => names[id];
  assert.deepEqual(coachOf([{ staff_member_id: "s2", team_role: "delegado" }, { staff_member_id: "s1", team_role: "primer_entrenador" }, { staff_member_id: "s3", team_role: "segundo_entrenador" }], nameOf), { name: "Ana", extra: 2, none: false });
  assert.deepEqual(coachOf([{ staff_member_id: "s2", team_role: "delegado" }], nameOf), { name: null, extra: 1, none: true });
  assert.deepEqual(coachOf([], nameOf, { coach: "Pep" }), { name: "Pep", extra: 0, none: false });
  assert.equal(coachOf([{ staff_member_id: "zz", team_role: "primer_entrenador" }], nameOf).none, true);
});

test("clasificación", () => {
  const st = { ourTeamId: "X", rows: [{ teamId: "A", pos: 1, pts: 23 }, { teamId: "X", pos: 3, pts: 19 }] };
  assert.deepEqual(standingOf(st), { pos: 3, pts: 19, gap: 4 });
  assert.equal(standingOf({ rows: [] }), null);
  assert.equal(standingOf(undefined), null);
});

test("orden, resumen y búsqueda", () => {
  const R = (id, f7, pos, att, x = {}) => ({ team: { id, name: id }, f7, standing: pos ? { pos } : null, att: att == null ? null : { rate: att }, players: 10, injured: 1, rec: { w: 2, d: 1, l: 1 }, pending: 1, coach: { name: "Àlex", none: false }, ...x });
  const rows = [R("A", false, 3, 90), R("B", true, null, 70), R("C", false, 1, null, { coach: { name: null, none: true } })];
  assert.deepEqual(sortOverview(rows, "clasificacion").map((r) => r.team.id), ["C", "A", "B"]);
  assert.deepEqual(sortOverview(rows, "entrenos").map((r) => r.team.id), ["B", "A", "C"]);
  assert.deepEqual(sortOverview(rows).map((r) => r.team.id), ["A", "B", "C"]);
  const k = overviewKpis(rows);
  assert.deepEqual([k.teams, k.f7, k.f11, k.players, k.injured, k.w, k.d, k.l, k.winPct, k.pending, k.noCoach], [3, 1, 2, 30, 3, 6, 3, 3, 50, 3, 1]);
  assert.equal(matchesSearch(rows[0], "alex"), true);
  assert.equal(matchesSearch(rows[0], "zz"), false);
});
