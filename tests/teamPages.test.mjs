import test from "node:test";
import assert from "node:assert/strict";
import {
  resultOf, splitMatches, scorersText, teamEvalAvg, homeAway, goalsByMatch,
  pdiSummary, last360, ratingSummary, lastReview, daysSince, workedOn, recentImproved, sortDev,
} from "../src/lib/teamPages.js";

const ev = (o) => ({ team_id: "t1", type: "partido_liga", ...o });

test("resultOf: V/E/D y sin marcador", () => {
  assert.equal(resultOf({ score_home: 2, score_away: 1 }), "V");
  assert.equal(resultOf({ score_home: 0, score_away: 0 }), "E");
  assert.equal(resultOf({ score_home: 0, score_away: 3 }), "D");
  assert.equal(resultOf({ score_home: null, score_away: 1 }), null);
});

test("splitMatches: jugados y próximos del equipo y tipo", () => {
  const now = new Date("2026-11-13T12:00");
  const list = [
    ev({ id: "a", date: "2026-11-01T10:00" }),
    ev({ id: "b", date: "2026-11-08T10:00" }),
    ev({ id: "c", date: "2026-11-15T10:00" }),
    ev({ id: "d", date: "2026-11-22T10:00", cancelled: true }),
    ev({ id: "e", date: "2026-11-02T10:00", type: "partido_amistoso" }),
    ev({ id: "f", date: "2026-11-02T10:00", team_id: "t2" }),
    ev({ id: "g", date: "2026-11-02T10:00", type: "entrenamiento" }),
  ];
  const all = splitMatches(list, "t1", { now });
  assert.deepEqual(all.past.map((e) => e.id), ["b", "e", "a"]);
  assert.deepEqual(all.next.map((e) => e.id), ["c"]);
  const liga = splitMatches(list, "t1", { now, type: "partido_liga" });
  assert.deepEqual(liga.past.map((e) => e.id), ["b", "a"]);
});

test("scorersText: agrupa por jugador, ignora los del rival", () => {
  const players = new Map([["p1", { last_name: "Rius" }], ["p2", { first_name: "Gil" }]]);
  const e = { goal_events: [
    { team: "home", player_id: "p1" }, { team: "home", player_id: "p1" },
    { team: "away", player_id: "x" }, { team: "home", player_id: "p2" },
  ] };
  assert.equal(scorersText(e, players), "Rius 2, Gil");
  assert.equal(scorersText({}, players), "");
});

test("teamEvalAvg y homeAway", () => {
  assert.equal(teamEvalAvg({ team_eval: { a: 3, b: 2, c: 0 } }), 2.5);
  assert.equal(teamEvalAvg({}), null);
  const r = homeAway([
    { score_home: 2, score_away: 0 }, { score_home: 1, score_away: 1, is_home: false },
    { score_home: 0, score_away: 2, is_home: false }, { score_home: null, score_away: null },
  ]);
  assert.deepEqual(r.home, { w: 1, d: 0, l: 0, gf: 2, ga: 0, n: 1 });
  assert.deepEqual(r.away, { w: 0, d: 1, l: 1, gf: 1, ga: 3, n: 2 });
});

test("goalsByMatch: jornada o fecha, solo con marcador", () => {
  const rows = goalsByMatch([
    { id: "a", fcf_jornada: 7, date: "2026-11-08T10:00", score_home: 3, score_away: 1 },
    { id: "b", date: "2026-11-01T10:00", score_home: 1, score_away: 1 },
    { id: "c", date: "2026-10-25T10:00" },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].label, "J7");
  assert.equal(rows[1].label, "01/11");
  assert.equal(rows[0].gf, 3);
});

test("pdiSummary: cuenta estados y elige el objetivo actual", () => {
  const s = pdiSummary([
    { id: 1, status: "mejorado", created_date: "2026-09-01" },
    { id: 2, status: "a_mejorar", created_date: "2026-10-01" },
    { id: 3, status: "trabajando", created_date: "2026-09-15" },
    { id: 4, created_date: "2026-10-05" },
  ]);
  assert.equal(s.trabajando, 1); assert.equal(s.a_mejorar, 2); assert.equal(s.mejorado, 1);
  assert.equal(s.current.id, 3);
  assert.equal(pdiSummary([]).current, null);
});

test("last360: la más reciente", () => {
  const r = last360([{ date: "2026-09-01", v: 5 }, { date: "2026-10-01", v: 7 }], (e) => ({ overall: e.v, tecnica: e.v }));
  assert.equal(r.overall, 7);
  assert.equal(r.date, "2026-10-01");
  assert.equal(last360([], () => ({})), null);
});

test("ratingSummary: media y tendencia", () => {
  const st = [
    { date: "2026-11-08", rating: 3 }, { date: "2026-11-01", rating: 3 }, { date: "2026-10-25", rating: 3 },
    { date: "2026-10-18", rating: 1 }, { date: "2026-10-11", rating: 2 }, { date: "2026-10-04", rating: null },
  ];
  const r = ratingSummary(st);
  assert.equal(r.n, 5);
  assert.equal(r.avg, 2.4);
  assert.equal(r.trend, "up");
  assert.equal(ratingSummary([]), null);
});

test("lastReview, daysSince y workedOn", () => {
  assert.equal(lastReview({ evals: [{ date: "2026-09-01" }], goals: [{ created_date: "2026-08-01T10:00", improved_date: "2026-10-02T09:00" }] }), "2026-10-02");
  assert.equal(lastReview({}), null);
  assert.equal(daysSince("2026-11-03", new Date("2026-11-13T12:00")), 10);
  assert.equal(daysSince(null), null);
  const w = workedOn([
    { status: "trabajando", competency_text: "Pase" }, { status: "trabajando", competency_text: "Pase" },
    { status: "trabajando", competency_text: "Control" }, { status: "mejorado", competency_text: "Tiro" },
  ]);
  assert.deepEqual(w, [{ label: "Pase", n: 2 }, { label: "Control", n: 1 }]);
});

test("recentImproved y sortDev", () => {
  const g = recentImproved([
    { id: 1, status: "mejorado", improved_date: "2026-10-01" },
    { id: 2, status: "mejorado", improved_date: "2026-11-01" },
    { id: 3, status: "trabajando" },
  ]);
  assert.deepEqual(g.map((x) => x.id), [2, 1]);
  const rows = [{ id: "a", days: 5, e360: { overall: 7 } }, { id: "b", days: null, e360: null }, { id: "c", days: 90, e360: { overall: 4 } }];
  assert.deepEqual(sortDev(rows, "review").map((r) => r.id), ["b", "c", "a"]);
  assert.deepEqual(sortDev(rows, "low360").map((r) => r.id), ["c", "a", "b"]);
});

import { dorsalDupes, squadChecks, medicalOk, composition } from "../src/lib/teamPages.js";

test("dorsalDupes y squadChecks", () => {
  const ps = [
    { id: "a", jersey_number: 14, position: "central", birth_year: 2009, guardian_phone: "600" },
    { id: "b", jersey_number: "14", position: "", birth_year: 2009 },
    { id: "c", jersey_number: null, position: "portero", birth_year: 2000 },
    { id: "d", jersey_number: 3, position: "lateral", birth_year: 2010, guardian_phone: " " },
  ];
  assert.deepEqual(dorsalDupes(ps), [{ n: "14", ids: ["a", "b"] }]);
  const c = squadChecks(ps, { adultYear: 2008, accountOf: (p) => (p.id === "a" ? "own" : "none"), medicalIds: new Set(["a", "c"]) });
  const by = Object.fromEntries(c.map((x) => [x.key, x.ids]));
  assert.deepEqual(by.dup, ["a", "b"]);
  assert.deepEqual(by.nodorsal, ["c"]);
  assert.deepEqual(by.nopos, ["b"]);
  assert.deepEqual(by.notutor, ["b", "d"]);
  assert.deepEqual(by.noaccount, ["b", "c", "d"]);
  assert.deepEqual(by.nomedical, ["b", "d"]);
  assert.equal(c[0].extra, "14");
  assert.equal(squadChecks([{ id: "x", jersey_number: 1, position: "portero" }]).length, 0);
});

test("medicalOk: de esta temporada o sin caducar", () => {
  const ok = medicalOk([
    { player_id: "a", document_type: "examen_medico", created_date: "2026-09-10T10:00" },
    { player_id: "b", document_type: "examen_medico", created_date: "2025-09-10T10:00", expiry_date: "2027-01-01" },
    { player_id: "c", document_type: "examen_medico", created_date: "2025-09-10T10:00" },
    { player_id: "d", document_type: "dni", created_date: "2026-09-10T10:00" },
  ], { since: "2026-08-01", today: "2026-11-13" });
  assert.deepEqual([...ok].sort(), ["a", "b"]);
});

test("composition", () => {
  const c = composition([
    { position: "portero", birth_year: 2009, laterality: "diestro" },
    { position: "central", birth_year: 2010, laterality: "zurdo" },
    { position: "", laterality: "" },
  ], (p) => ({ portero: "POR", central: "DEF" })[p.position] || null);
  assert.deepEqual(c.lines, { POR: 1, DEF: 1, none: 1 });
  assert.deepEqual(c.years, [{ year: 2009, n: 1 }, { year: 2010, n: 1 }]);
  assert.equal(c.noYear, 1);
  assert.deepEqual(c.foot, { diestro: 1, zurdo: 1, ambidiestro: 0, none: 1 });
});

import { seasonList, seasonStrip } from "../src/lib/teamPages.js";

test("seasonList y seasonStrip: toda la temporada en orden", () => {
  const now = new Date("2026-11-13T12:00");
  const evs = [
    { id: "c", team_id: "t1", type: "partido_liga", date: "2026-11-22T10:00" },
    { id: "a", team_id: "t1", type: "partido_liga", date: "2026-10-01T10:00", score_home: 2, score_away: 1 },
    { id: "b", team_id: "t1", type: "partido_liga", date: "2026-11-08T10:00" },
    { id: "x", team_id: "t1", type: "partido_liga", date: "2026-11-15T10:00", cancelled: true },
    { id: "p", team_id: "t1", type: "partido_liga", date: "2026-11-29T10:00", postponed: true },
    { id: "z", team_id: "t1", type: "partido_liga", date: "2026-07-01T10:00" },
  ];
  const s = seasonList(evs, "t1", { now, since: "2026-08-01" });
  assert.deepEqual(s.rows.map((r) => r.ev.id), ["a", "b", "c", "p"]);
  assert.equal(s.nextIndex, 2);
  assert.deepEqual(seasonStrip(s.rows), ["V", "?", "·", "·"]);
  assert.equal(seasonList([], "t1").nextIndex, -1);
});
