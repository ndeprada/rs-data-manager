import test from "node:test";
import assert from "node:assert/strict";
import { cleanLicence, isNonFederated, licenceOf, playsInText } from "../src/lib/scoutLicence.js";

test("licencia: por defecto federado; no federado solo si se marca y no está vinculado a la FCF", () => {
  assert.equal(licenceOf({}), "federado");
  assert.equal(licenceOf({ licence: "no_federado" }), "no_federado");
  assert.equal(licenceOf({ licence: "no_federado", fcf_id: "123" }), "federado");
  assert.equal(isNonFederated(null), false);
});

test("dónde juega: tipo y club, o «No federado» si no hay nada", () => {
  assert.equal(playsInText({ licence: "no_federado", plays_in: "sala", current_club: "CE Gràcia" }), "Fútbol sala · CE Gràcia");
  assert.equal(playsInText({ licence: "no_federado", plays_in: "sin_equipo" }), "Sin equipo");
  assert.equal(playsInText({ licence: "no_federado" }), "No federado");
  assert.equal(playsInText({ plays_in: "sala" }), "");
});

test("al guardar: año de 4 cifras, la fecha manda sobre el año, federado sin «dónde juega» y no federado sin liga", () => {
  assert.deepEqual(cleanLicence({ birth_year: "2013", licence: "no_federado", plays_in: "escuela", league_group: "Grup 3" }),
    { birth_year: 2013, licence: "no_federado", plays_in: "escuela", league_group: "" });
  assert.equal(cleanLicence({ birth_year: "13" }).birth_year, null);
  assert.equal(cleanLicence({ birth_year: "2012", birth_date: "2013-05-01" }).birth_year, 2013);
  const f = cleanLicence({ licence: "federado", plays_in: "sala", league_group: "Grup 3" });
  assert.equal(f.plays_in, null);
  assert.equal(f.league_group, "Grup 3");
  assert.equal(cleanLicence({ licence: "no_federado", plays_in: "inventado" }).plays_in, null);
});
