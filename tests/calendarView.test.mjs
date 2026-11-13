import test from "node:test";
import assert from "node:assert/strict";
import { eventKind, eventsOnDay, matchesCalFilters, EMPTY_CAL_FILTERS, dayItems, weekRange, weekSummary, fieldUse, placeOptions } from "../src/lib/calendarView.js";

const E = (id, date, type, x = {}) => ({ id, date, type, team_id: "t1", ...x });

test("tipo de evento", () => {
  assert.equal(eventKind({ type: "partido_liga" }), "match");
  assert.equal(eventKind({ type: "entrenamiento_fisico" }), "training");
  assert.equal(eventKind({ type: "reunion_equipo" }), "other");
});

test("eventos de un día, también los de varios días", () => {
  const evs = [E("a", "2026-11-14T12:00", "partido_liga"), E("b", "2026-11-14T10:00", "partido_liga"), E("c", "2026-11-13T09:00", "torneo", { end_date: "2026-11-15T18:00" }), E("d", "2026-11-15T10:00", "entrenamiento")];
  assert.deepEqual(eventsOnDay(evs, new Date("2026-11-14T08:00")).map((e) => e.id), ["c", "b", "a"]);
});

test("filtros", () => {
  const isF7 = (id) => id === "t7";
  const evs = [
    E("m", "2026-11-14T12:00", "partido_liga", { field_id: "f1" }),
    E("w", "2026-11-14T12:00", "partido_liga", { is_home: false }),
    E("t", "2026-11-14T19:00", "entrenamiento", { team_id: "t7", field_id: "f1" }),
    E("o", "2026-11-14T20:00", "evento_club", { team_id: null }),
  ];
  const f = (x) => evs.filter((e) => matchesCalFilters(e, { ...EMPTY_CAL_FILTERS, ...x }, { isF7 })).map((e) => e.id);
  assert.deepEqual(f({}), ["m", "w", "t", "o"]);
  assert.deepEqual(f({ kinds: ["match"] }), ["m", "w"]);
  assert.deepEqual(f({ stage: "f7" }), ["t"]);
  assert.deepEqual(f({ stage: "f11" }), ["m", "w"]);
  assert.deepEqual(f({ place: "away" }), ["w"]);
  assert.deepEqual(f({ place: "f1" }), ["m", "t"]);
  assert.deepEqual(f({ teams: ["t7"] }), ["t"]);
});

test("casilla del mes: entrenos juntos", () => {
  const evs = [E("t1", "2026-11-10T19:00", "entrenamiento"), E("t2", "2026-11-10T20:00", "entrenamiento"), E("m", "2026-11-10T21:00", "partido_liga"), E("x", "2026-11-10T18:00", "entrenamiento", { cancelled: true })];
  const it = dayItems(evs);
  assert.equal(it.length, 3);
  assert.equal(it[0].event.id, "x");
  assert.deepEqual([it[1].group, it[1].n], [true, 2]);
  assert.equal(it[2].event.id, "m");
  assert.equal(dayItems([evs[0]])[0].event.id, "t1");
});

test("semana", () => {
  const { from, to } = weekRange(new Date("2026-11-12T10:00"));
  assert.equal(from.getDate(), 9);
  assert.equal(to.getDate(), 15);
  const now = new Date("2026-11-12T10:00");
  const evs = [
    E("a", "2026-11-10T19:00", "entrenamiento"),
    E("b", "2026-11-11T19:00", "entrenamiento"),
    E("c", "2026-11-13T19:00", "entrenamiento", { cancelled: true }),
    E("d", "2026-11-14T12:00", "partido_liga"),
    E("e", "2026-11-15T12:00", "partido_liga", { is_home: false }),
    E("f", "2026-11-11T20:00", "partido_liga"),
    E("g", "2026-11-01T12:00", "partido_liga"),
  ];
  const k = weekSummary(evs, { now, withAttendance: new Set(["a"]), convByEvent: new Map([["d", { player_ids: ["p"] }]]), pending: new Map([["g", ["x"]]]) });
  assert.deepEqual(k, { matches: 3, home: 2, away: 1, trainings: 2, cancelled: 1, listsDue: 1, convDue: 1, toClose: 1 });
});

test("campos", () => {
  const name = (id) => ({ f1: "CEM Teixonera", f2: "Annex" }[id] || "");
  const evs = [E("a", "2026-11-14T10:00", "partido_liga", { field_id: "f1" }), E("b", "2026-11-14T12:00", "partido_liga", { field_id: "f1" }), E("c", "2026-11-14T12:00", "partido_liga", { field_id: "f2", is_home: false }), E("d", "2026-11-14T16:00", "entrenamiento", { field_id: "f2" })];
  assert.deepEqual(fieldUse(evs, name), [{ name: "CEM Teixonera", n: 2, times: ["10:00", "12:00"] }, { name: "Annex", n: 1, times: ["16:00"] }]);
  assert.deepEqual(placeOptions(evs, name), { fields: [{ id: "f1", name: "CEM Teixonera", n: 2 }, { id: "f2", name: "Annex", n: 1 }], away: 1 });
});
