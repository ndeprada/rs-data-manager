import test from "node:test";
import assert from "node:assert/strict";
import { ATT_REASONS, REASON_CODE, attCode } from "../src/components/sessions/sessionAttendance.js";

test("hoja de sesión: disponibilidad abreviada", () => {
  assert.equal(attCode({}), "");
  assert.equal(attCode({ st: "si" }), "Sí");
  assert.equal(attCode({ st: "no", obs: "lesión" }), "L");
  assert.equal(attCode({ st: "no", obs: "enfermo" }), "E");
  assert.equal(attCode({ st: "no", obs: "estudios" }), "Es");
  assert.equal(attCode({ st: "no" }), "No");
  assert.equal(attCode({ st: "ad" }), "AM");
  assert.equal(attCode({ st: "ad", obs: "cargas" }), "AM·C");
  // cada motivo de la lista tiene su letra y no se repiten
  for (const r of ATT_REASONS) assert.ok(REASON_CODE[r], r);
  const codes = Object.values(REASON_CODE);
  assert.equal(new Set(codes).size, codes.length);
});
