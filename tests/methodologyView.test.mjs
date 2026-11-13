import test from "node:test";
import assert from "node:assert/strict";
import { BLOCKS, BLOCK_GROUPS, stageContents, contentId } from "../src/lib/sessionPlan.js";
import {
  weekStart, periodStart, groupByWeek, blockMix, typeCounts, undoneHigh, trainingsWithoutSession, trainingCoverage, missingInRange,
  teamsOverview, sortOverview, libraryUses, matchesLibrary, EMPTY_LIB_FILTERS, sortLibrary, fmtHours, weeklyMix, mixByType, sessionContents,
} from "../src/lib/methodologyView.js";
import { registerSession } from "../src/lib/sessionPlan.js";
import { libraryContents, libraryToSessionTask, sessionTaskToLibrary, authorOf } from "../src/lib/taskLibrary.js";

const ofi = stageContents("des2").find((c) => c.block === "oc_of");
const fio = stageContents("des2").find((c) => c.block === "fi_of");
const task = (min, principal = [], secondary = [], extra = {}) => ({ id: Math.random().toString(36), series: 1, serie_min: min, principal, secondary, ...extra });
const ses = (date, tasks, extra = {}) => ({ id: date + Math.random(), team_id: "T1", date, held: true, initial: { tasks: [] }, main: { tasks }, ...extra });

test("orden de los bloques (Nacho, 13/11/2026): ataque, defensa, técnica y hábitos, balón parado al final", () => {
  assert.deepEqual(BLOCKS.map((b) => b.id), ["fi_of", "oc_of", "cc_of", "fi_def", "oc_def", "cc_def", "tecnica", "habitos", "abp"]);
  assert.deepEqual(BLOCK_GROUPS.map((g) => g.id), ["ataque", "defensa", "base", "abp"]);
  for (const b of BLOCKS) { assert.ok(BLOCK_GROUPS.some((g) => g.id === b.group)); assert.match(b.ink, /^#[0-9A-F]{6}$/i); }
});

test("semanas y periodos", () => {
  assert.equal(weekStart("2026-11-13"), "2026-11-09");
  assert.equal(weekStart("2026-11-09T19:00"), "2026-11-09");
  assert.equal(weekStart("2026-11-15"), "2026-11-09");
  assert.equal(periodStart("season", "2026-11-13"), "2026-08-01");
  assert.equal(periodStart("season", "2027-03-01"), "2026-08-01");
  assert.equal(periodStart("30", "2026-11-13"), "2026-10-14");
  const g = groupByWeek([ses("2026-11-10", [task(20, [fio.id])]), ses("2026-11-12", [task(30, [fio.id])]), ses("2026-11-05", [task(10)])]);
  assert.deepEqual(g.map((x) => x.start), ["2026-11-09", "2026-11-02"]);
  assert.equal(g[0].sessions[0].date, "2026-11-12");
  assert.equal(g[0].minutes, 50);
  assert.equal(fmtHours(45), "45’"); assert.equal(fmtHours(120), "2 h"); assert.equal(fmtHours(245), "4 h 05’");
});

test("reparto por bloques en el orden de BLOCKS y contenidos de una sesión", () => {
  const reg = registerSession(ses("2026-11-10", [task(30, [ofi.id]), task(20, [fio.id], [ofi.id])]));
  assert.deepEqual(blockMix(reg).map((x) => x.block), ["fi_of", "oc_of"], "fundamentos antes que organización");
  const c = sessionContents(reg, 3);
  assert.deepEqual(c.principal, [ofi.id, fio.id]);
  assert.deepEqual(c.secondary, [], "un secundario que ya es principal en otra tarea no se repite");
});

test("tipos y prioridad alta sin trabajar", () => {
  const counts = typeCounts([{ session_type: "fundamentos" }, { session_type: "compensatoria" }, {}]);
  assert.equal(counts.fundamentos, 1); assert.equal(counts.recuperacion, 1, "los nombres antiguos se leen con el nuevo"); assert.equal(counts.none, 1);
  const highs = stageContents("des2").filter((c) => c.priority === "A");
  const agg = { contents: { [highs[0].id]: { principal: 10, secondary: 0 }, [highs[1].id]: { principal: 0, secondary: 5 } } };
  const undone = undoneHigh(agg, "des2").map((c) => c.id);
  assert.ok(!undone.includes(highs[0].id) && !undone.includes(highs[1].id));
  assert.equal(undone.length, highs.length - 2);
});

test("entrenos sin hoja, cobertura y faltan por semana", () => {
  const events = [
    { id: "e1", team_id: "T1", type: "entrenamiento", date: "2026-11-10T19:00" },
    { id: "e2", team_id: "T1", type: "entrenamiento", date: "2026-11-12T19:00" },
    { id: "e3", team_id: "T1", type: "entrenamiento", date: "2026-11-16T19:00" },
    { id: "e4", team_id: "T1", type: "entrenamiento", date: "2026-11-11T19:00", cancelled: true },
    { id: "e5", team_id: "T2", type: "entrenamiento", date: "2026-11-11T19:00" },
    { id: "e6", team_id: "T1", type: "partido_liga", date: "2026-11-14T10:00" },
    { id: "e7", team_id: "T1", type: "entrenamiento", date: "2026-11-09T19:00" },
  ];
  const sessions = [ses("2026-11-10", []), { ...ses("2026-11-08", []), training_event_id: "e7" }];
  const m = trainingsWithoutSession({ events, sessions, teamIds: ["T1"], today: "2026-11-13" });
  assert.deepEqual(m.past.map((e) => e.id), ["e2"], "e1 tiene hoja ese día, e7 por el enlace, e4 cancelado, e5 otro equipo");
  assert.deepEqual(m.next.map((e) => e.id), ["e3"]);
  const cov = trainingCoverage({ events, sessions, teamIds: ["T1"], from: "2026-11-01", today: "2026-11-13" });
  assert.deepEqual([cov.trainings, cov.withSession, cov.pct], [3, 2, 67]);
  assert.equal(missingInRange({ events, sessions, teamIds: ["T1"], from: "2026-11-09", to: "2026-11-13" }), 1);
});

test("vista de todos los equipos", () => {
  const teams = [{ id: "T1", name: "Cadet S15 A" }, { id: "T2", name: "Juvenil B" }];
  const sessions = [ses("2026-11-10", [task(40, [fio.id])], { owner_name: "Borja" })];
  const events = [{ id: "e1", team_id: "T1", type: "entrenamiento", date: "2026-11-10T19:00" }, { id: "e2", team_id: "T2", type: "entrenamiento", date: "2026-11-10T19:00" }];
  const rows = teamsOverview({ teams, sessions, events, from: "2026-08-01", today: "2026-11-13", season: null, stageOf: () => "des2" });
  assert.equal(rows[0].pct, 100); assert.deepEqual(rows[0].coaches, ["Borja"]); assert.equal(rows[0].contentPct, 100);
  assert.ok(rows[0].maxDev > 10); assert.ok(rows[0].undone > 0);
  assert.equal(rows[1].pct, 0); assert.equal(rows[1].maxDev, null);
  assert.deepEqual(sortOverview(rows, "low").map((r) => r.team.id), ["T2", "T1"]);
});

test("semana a semana y por tipo", () => {
  const list = [ses("2026-11-10", [task(30, [fio.id])], { session_type: "fundamentos" }), ses("2026-11-03", [task(20, [ofi.id])], { session_type: "juego_colectivo" })];
  const w = weeklyMix(list, "2026-11-13", 3);
  assert.deepEqual(w.map((x) => [x.start, x.total]), [["2026-10-26", 0], ["2026-11-02", 20], ["2026-11-09", 30]]);
  assert.deepEqual(mixByType(list).map((x) => x.type), ["fundamentos", "juego_colectivo"]);
});

test("biblioteca: usos, filtros y orden", () => {
  const sessions = [
    { date: "2026-11-01", team_id: "T1", main: { tasks: [{ from_library: { id: "L1" } }, { from_library: { id: "L2" } }] } },
    { date: "2026-11-10", team_id: "T2", main: { tasks: [{ from_library: { id: "L1" } }] } },
  ];
  const u = libraryUses(sessions);
  assert.equal(u.get("L1").count, 2); assert.deepEqual(u.get("L1").last, { date: "2026-11-10", team_id: "T2" });
  const tasks = [
    { id: "L1", name: "Rondo 4x4", session_phase: "calentamiento", game_moment: "juego_ataque", football_format: "f11", players_count: "12", duration_minutes: 12, author_id: "me", created_date: "2026-10-01" },
    { id: "L2", name: "Ataque a portería", session_phase: "parte_principal", game_moment: "juego_ataque", players_count: "16", duration_minutes: 25, created_date: "2026-11-01" },
    { id: "L3", name: "Defensa de centros", session_phase: "parte_principal", game_moment: "juego_defensa", duration_minutes: 15, created_date: "2026-09-01" },
  ];
  const ids = (f, o) => tasks.filter((x) => matchesLibrary(x, { ...EMPTY_LIB_FILTERS, ...f }, o)).map((x) => x.id);
  assert.deepEqual(ids({ owner: "mine" }, { me: "me" }), ["L1"]);
  assert.deepEqual(ids({ owner: "club" }, { me: "me" }), ["L2", "L3"]);
  assert.deepEqual(ids({ moments: ["juego_ataque"], phases: ["parte_principal"] }), ["L2"]);
  assert.deepEqual(ids({ players: ["9to14"] }), ["L1"]);
  assert.deepEqual(ids({ durations: ["gt20"] }), ["L2"]);
  assert.deepEqual(ids({ formats: ["ambos"] }), ["L2", "L3"], "sin formato = los dos");
  assert.deepEqual(ids({ q: "porteria" }), ["L2"], "sin acentos");
  assert.deepEqual(ids({ q: "salida" }, { contentNames: (x) => (x.id === "L3" ? ["Salida de balón"] : []) }), ["L3"], "busca también en los contenidos");
  assert.deepEqual(sortLibrary(tasks, "used", u).map((x) => x.id), ["L1", "L2", "L3"]);
  assert.deepEqual(sortLibrary(tasks, "recent").map((x) => x.id), ["L2", "L1", "L3"]);
  assert.deepEqual(sortLibrary(tasks, "az").map((x) => x.id), ["L2", "L3", "L1"]);
});

test("biblioteca: los contenidos del currículum se guardan con la tarea y vuelven al cargarla", () => {
  const st = { id: "t1", part: "principal", title: "Salida", series: 1, serie_min: 15, principal: [fio.id, ofi.id, "x"], secondary: [ofi.id, "pal.9"], custom_contents: { "pal.9": { name: "Paleta", block: "abp" }, "pal.8": { name: "No usado", block: "abp" } } };
  const lib = sessionTaskToLibrary(st);
  assert.deepEqual(lib.principal, [fio.id, ofi.id]);
  assert.deepEqual(lib.secondary, ["pal.9"], "un secundario que ya es principal no se repite");
  assert.deepEqual(Object.keys(lib.custom_contents), ["pal.9"]);
  const back = libraryToSessionTask({ ...lib, id: "L9" });
  assert.deepEqual(back.principal, lib.principal); assert.deepEqual(back.secondary, ["pal.9"]);
  assert.deepEqual(libraryContents({}), { principal: [], secondary: [], custom_contents: {}, no_curriculum: false });
  assert.deepEqual(authorOf({ id: "u1", full_name: "Nacho" }), { author_id: "u1", author_name: "Nacho" });
  assert.deepEqual(authorOf(null), {});
  assert.equal(contentId("fi_of", "X").startsWith("fi_of."), true);
});
