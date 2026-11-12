import test from "node:test";
import assert from "node:assert/strict";
import { kitInfo, kitText, kitSwatch, agendaMeta, sortAgenda, homeGroups, fitScale } from "../src/lib/weekendAgenda.js";

test("equipación: 1ª sin nada no se escribe; 2ª/3ª con color y talla", () => {
  assert.equal(kitInfo({}), null);
  assert.equal(kitText({ kit: "" }), null);
  assert.equal(kitText({ kit: "segunda", kit_color: "Verde", kit_size: "14" }), "2ª · verde · talla 14");
  assert.equal(kitText({ kit: "tercera", kit_size: "S" }), "3ª · S");
  assert.equal(kitText({ kit_color: "Blanca" }), "1ª · blanca");
  assert.deepEqual(agendaMeta({ agenda_meta: '{"kit":"segunda"}' }), { kit: "segunda" });
  assert.deepEqual(agendaMeta({ agenda_meta: "{roto" }), {});
});

test("muestra de color por nombre", () => {
  assert.equal(kitSwatch("Verde"), "#1F8A3B");
  assert.equal(kitSwatch("blanco"), "#FFFFFF");
  assert.equal(kitSwatch("Rojo"), "#D32F2F");
  assert.equal(kitSwatch("granate y blanco"), "#7A1020");
  assert.equal(kitSwatch("#123abc"), "#123abc");
  assert.equal(kitSwatch("fosforito"), null);
  assert.equal(kitSwatch(""), null);
});

const M = [
  { id: "1", team_id: "b", date: "2026-11-15T10:00" },
  { id: "2", team_id: "a", date: "2026-11-14T12:00" },
  { id: "3", team_id: "b", date: "2026-11-14T09:00" },
  { id: "4", team_id: "a", date: "2026-11-15T09:00", is_home: false },
];

test("orden: por hora (sábado y luego domingo) o por equipo", () => {
  assert.deepEqual(sortAgenda(M, "hora").map((e) => e.id), ["3", "2", "4", "1"]);
  assert.deepEqual(sortAgenda(M, "equipo", ["a", "b"]).map((e) => e.id), ["2", "4", "3", "1"]);
});

test("partidos en casa por campo y día, en orden", () => {
  const g = homeGroups([...M, { id: "5", team_id: "c", date: "2026-11-14T11:00", location: "Otro" }], (e) => e.location || "Teixonera");
  assert.equal(g[0].field, "Teixonera");
  assert.deepEqual(g[0].days.map((d) => [d.day, d.items.map((e) => e.id)]), [["2026-11-14", ["3", "2"]], ["2026-11-15", ["1"]]]);
  assert.equal(g[1].field, "Otro");
});

test("la hoja cabe en una página", () => {
  assert.equal(fitScale(800, 1000), 1);
  assert.equal(fitScale(2000, 1000), 0.5);
  assert.equal(fitScale(0, 1000), 1);
});
