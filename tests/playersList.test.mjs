import { test } from "node:test";
import assert from "node:assert/strict";
import { yearKey, statusOf, accountOf, matchesFilters, EMPTY_FILTERS, hasAnyFilter, kpiCounts, yearOptions, sortRows, groupRows, exportTable } from "../src/lib/playersList.js";

const S = "2026-2027";
const row = (p, x = {}) => ({ p: { status: "activo", ...p }, year: p.birth_year, injured: false, acc: { own: 0, family: 0, pending: 0 }, pj: 0, goals: 0, ...x });
const A = row({ id: "a", first_name: "Arnau", last_name: "Vidal", team_id: "t1", birth_year: 2010, position: "portero", jersey_number: 1, laterality: "diestro", nationality: "ESP" }, { acc: { own: 1, family: 0, pending: 0 }, pj: 5, goals: 0, pctMin: 80, attPct: 93 });
const B = row({ id: "b", first_name: "Pol", last_name: "Martí", team_id: "t2", birth_year: 2009, position: "extremo", jersey_number: 7, laterality: "zurdo", nationality: "MAR" }, { injured: true, injury: { expected_return: "2026-11-22" }, pj: 8, goals: 4, pctMin: 55, attPct: 62 });
const C = row({ id: "c", first_name: "Joan", last_name: "Àlvarez", team_id: "t1", birth_year: 2005, position: "central", status: "baja" }, { acc: { own: 0, family: 2, pending: 0 } });
const D = row({ id: "d", first_name: "Ñoño", last_name: "Ruiz", team_id: null, position: null, jersey_number: "" }, { acc: null });
const all = [A, B, C, D];
const ctx = { season: S, isForeign: (p) => !!p.nationality && p.nationality !== "ESP", countryA3: (p) => p.nationality || null };

test("yearKey: año, sénior y sin año", () => {
  assert.equal(yearKey(2010, S), "2010");
  assert.equal(yearKey(2008, S), "2008");
  assert.equal(yearKey(2007, S), "senior");
  assert.equal(yearKey(null, S), "none");
});

test("estado y cuenta", () => {
  assert.deepEqual(all.map(statusOf), ["activo", "lesionado", "baja", "activo"]);
  assert.deepEqual(all.map(accountOf), ["own", "none", "family", null]);
});

test("filtros", () => {
  const f = (x) => all.filter((r) => matchesFilters(r, { ...EMPTY_FILTERS, ...x }, ctx)).map((r) => r.p.id);
  assert.deepEqual(f({}), ["a", "b", "c", "d"]);
  assert.deepEqual(f({ search: "alvarez" }), ["c"]);
  assert.deepEqual(f({ search: "7" }), ["b"]);
  assert.deepEqual(f({ teams: ["t1"] }), ["a", "c"]);
  assert.deepEqual(f({ years: ["2009", "senior"] }), ["b", "c"]);
  assert.deepEqual(f({ positions: ["portero", "extremo"] }), ["a", "b"]);
  assert.deepEqual(f({ foot: "zurdo" }), ["b"]);
  assert.deepEqual(f({ status: "lesionado" }), ["b"]);
  assert.deepEqual(f({ nat: "foreign" }), ["b"]);
  assert.deepEqual(f({ nat: "ESP" }), ["a"]);
  assert.deepEqual(f({ account: "none" }), ["b"]);
  assert.deepEqual(f({ noDorsal: true }), ["c", "d"]);
  assert.equal(hasAnyFilter(EMPTY_FILTERS), false);
  assert.equal(hasAnyFilter({ ...EMPTY_FILTERS, noDorsal: true }), true);
});

test("resumen", () => {
  assert.deepEqual(kpiCounts(all, ctx), { total: 4, activos: 2, lesionados: 1, bajas: 1, extranjeros: 1, sinCuenta: 1, sinDorsal: 1 });
});

test("años del filtro", () => {
  assert.deepEqual(yearOptions(all, S), [{ key: "2009", n: 1 }, { key: "2010", n: 1 }, { key: "senior", n: 1 }, { key: "none", n: 1 }]);
});

test("orden", () => {
  assert.deepEqual(sortRows(all, "goals", "desc").map((r) => r.p.id)[0], "b");
  assert.deepEqual(sortRows(all, "dorsal").map((r) => r.p.id), ["a", "b", "c", "d"]);
  assert.deepEqual(sortRows(all, "position").map((r) => r.p.id), ["a", "c", "b", "d"]);
  assert.deepEqual(sortRows(all, "name").map((r) => r.p.id), ["c", "b", "d", "a"]);
});

test("grupos", () => {
  const teams = [{ id: "t2", name: "Juvenil A" }, { id: "t1", name: "Cadete" }];
  assert.deepEqual(groupRows(all, "team", teams).map((g) => [g.key, g.rows.length]), [["t2", 1], ["t1", 2], ["none", 1]]);
  assert.deepEqual(groupRows(all, "position").map((g) => g.key), ["porteros", "defensas", "delanteros", "sin"]);
  assert.equal(groupRows(all, "none")[0].rows.length, 4);
});

test("exportar", () => {
  const { header, rows } = exportTable([A, B], { withAccount: true, posName: (p) => p.toUpperCase() });
  assert.equal(header.length, rows[0].length);
  assert.deepEqual(rows[1].slice(0, 3), [7, "Pol", "Martí"]);
  assert.equal(rows[1][12], "Lesionado (vuelta 2026-11-22)");
  assert.equal(rows[0][13], "Propia");
  assert.equal(exportTable([A]).header.includes("Cuenta"), false);
});

test("exportar: solicitud pendiente", () => {
  const P = row({ id: "e", first_name: "X", last_name: "Y" }, { acc: { own: 0, family: 0, pending: 1 } });
  assert.equal(exportTable([P], { withAccount: true }).rows[0][13], "Solicitud pendiente");
});
