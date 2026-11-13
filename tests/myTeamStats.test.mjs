import test from "node:test";
import assert from "node:assert/strict";
import { squadGroups, sortSquad, standingWindow, leaderGap, findRival, playerAttendance, unavailable } from "../src/lib/myTeamStats.js";

const R = (id, position, jersey_number, extra = {}) => ({ p: { id, position, jersey_number }, ...extra });

test("plantilla por líneas, por puesto y dorsal; sin posición al final", () => {
  const g = squadGroups([R("a", "extremo", 7), R("b", "portero", 13), R("c", "central", 4), R("d", "lateral", 2), R("e", null, 30), R("f", "portero", 1)]);
  assert.deepEqual(g.map((x) => [x.key, x.rows.map((r) => r.p.id)]), [["porteros", ["f", "b"]], ["defensas", ["c", "d"]], ["delanteros", ["a"]], ["sin", ["e"]]]);
});

test("orden por dorsal, minutos y goles", () => {
  const rows = [R("a", "x", 9, { mins: 100, goals: 1 }), R("b", "x", 3, { mins: 300, goals: 0, assists: 2 }), R("c", "x", 5, { mins: 300, goals: 1, assists: 3 })];
  assert.deepEqual(sortSquad(rows, "dorsal").map((r) => r.p.id), ["b", "c", "a"]);
  assert.deepEqual(sortSquad(rows, "minutos").map((r) => r.p.id), ["b", "c", "a"]);
  assert.deepEqual(sortSquad(rows, "goles").map((r) => r.p.id), ["c", "a", "b"]);
});

const T = [1, 2, 3, 4, 5, 6, 7, 8].map((pos) => ({ pos, teamId: `t${pos}`, team: `Equipo ${pos}`, pts: 30 - pos * 2 }));

test("clasificación alrededor de nuestro equipo y distancia con el líder", () => {
  assert.deepEqual(standingWindow(T, "t5").map((r) => r.pos), [3, 4, 5, 6, 7]);
  assert.deepEqual(standingWindow(T, "t1").map((r) => r.pos), [1, 2, 3, 4, 5]);
  assert.deepEqual(standingWindow(T, "t8").map((r) => r.pos), [4, 5, 6, 7, 8]);
  assert.equal(leaderGap(T, "t3").gap, 4);
  assert.equal(leaderGap(T, "t1").lead, 2);
  assert.equal(leaderGap(T, "x"), null);
});

test("rival por nombre", () => {
  const rows = [{ team: "CONGRÉS, C.F. A" }, { team: "SANT ANDREU, U.E. B" }];
  assert.equal(findRival(rows, "Congrés").team, "CONGRÉS, C.F. A");
  assert.equal(findRival(rows, "UE Sant Andreu B").team, "SANT ANDREU, U.E. B");
  assert.equal(findRival(rows, "Martinenc"), null);
});

test("asistencia por jugador en 30 días", () => {
  const now = new Date("2026-11-13T12:00");
  const ev = new Map([["e1", { date: "2026-11-10T19:00" }], ["e2", { date: "2026-11-11T19:00" }], ["e3", { date: "2026-11-12T19:00" }], ["old", { date: "2026-09-01T19:00" }]]);
  const att = [
    ...["e1", "e2", "e3"].map((e) => ({ event_id: e, player_id: "a", status: "present" })),
    { event_id: "e1", player_id: "b", status: "absent" }, { event_id: "e2", player_id: "b", status: "apart" }, { event_id: "e3", player_id: "b", status: "absent" },
    { event_id: "old", player_id: "b", status: "absent" }, { event_id: "e1", player_id: "c", status: "present" },
  ];
  assert.deepEqual(playerAttendance(att, ev, { now }), [{ player_id: "b", n: 3, rate: 33 }, { player_id: "a", n: 3, rate: 100 }]);
});

test("no disponibles: lesiones sin alta y motivos de la convocatoria", () => {
  const players = [{ id: "a" }, { id: "b", status: "lesionado" }, { id: "c" }, { id: "d" }];
  const u = unavailable({ players, injuries: [{ player_id: "a", status: "activa", expected_return: "2026-11-22" }, { player_id: "c", status: "alta" }],
    conv: { player_ids: [], absence_reasons: { c: "sancion", d: "decision_tecnica" } } });
  assert.deepEqual(u.map((x) => [x.player.id, x.reason, x.until]), [["a", "lesion", "2026-11-22"], ["b", "lesion", null], ["c", "sancion", null]]);
});
