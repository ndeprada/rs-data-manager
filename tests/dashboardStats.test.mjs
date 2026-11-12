import test from "node:test";
import assert from "node:assert/strict";
import { seasonRecord, attendanceSummary, topBy, returningSoon, wdl } from "../src/lib/dashboardStats.js";

test("balance de la temporada: V/E/D, goles y % de victorias (score_home = nuestros goles)", () => {
  const r = seasonRecord([{ score_home: 2, score_away: 1 }, { score_home: 0, score_away: 0 }, { score_home: 1, score_away: 3, is_home: false }]);
  assert.deepEqual(r, { w: 1, d: 1, l: 1, n: 3, gf: 3, ga: 4, winPct: 33 });
  assert.equal(seasonRecord([]).winPct, null);
  assert.deepEqual(wdl([{ score_home: 1, score_away: 0 }]), { w: 1, d: 0, l: 0 });
});

test("asistencia: últimos 30 días, tendencia y equipo más bajo", () => {
  const now = new Date("2026-11-12T12:00:00");
  const ev = (id, daysAgo, team) => [id, { id, team_id: team, date: new Date(now.getTime() - daysAgo * 86400000).toISOString() }];
  const events = new Map([ev("a", 3, "t1"), ev("b", 5, "t2"), ev("c", 40, "t1"), ev("x", 2, "t1")]);
  const rec = (event_id, status) => ({ event_id, status });
  const att = [
    ...Array(8).fill(rec("a", "present")), ...Array(2).fill(rec("a", "absent")), // t1: 80 %
    ...Array(6).fill(rec("b", "present")), ...Array(4).fill(rec("b", "absent")), // t2: 60 %
    ...Array(9).fill(rec("c", "present")), rec("c", "absent"), // periodo anterior: 90 %
    rec("x", "absent"), // suspendido: no cuenta
  ];
  const s = attendanceSummary(att, events, { now, skip: new Set(["x"]) });
  assert.equal(s.rate, 70);
  assert.equal(s.prevRate, 90);
  assert.equal(s.trend, -20);
  assert.deepEqual(s.lowest, { teamId: "t2", rate: 60 });
  // Con un solo equipo no se nombra al más bajo
  assert.equal(attendanceSummary(att, events, { now, skip: new Set(["x"]), inScope: (t) => t === "t1" }).lowest, null);
  assert.deepEqual(attendanceSummary([], events, { now }), { rate: null, prevRate: null, trend: null, lowest: null });
});

test("líderes y lesiones que vuelven esta semana", () => {
  assert.deepEqual(topBy([{ g: 1 }, { g: 5 }, { g: 0 }, { g: 3 }], "g").map((r) => r.g), [5, 3, 1]);
  const now = new Date("2026-11-12T12:00:00");
  const inj = [
    { id: 1, status: "activa", expected_return: "2026-11-15" },
    { id: 2, status: "alta", expected_return: "2026-11-14" },
    { id: 3, status: "activa", expected_return: "2026-11-30" },
    { id: 4, status: "activa" },
  ];
  assert.deepEqual(returningSoon(inj, { now }).map((i) => i.id), [1]);
});
