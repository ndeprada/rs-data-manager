import test from "node:test";
import assert from "node:assert/strict";
import { absenceReasonFor, hasActiveInjury } from "../src/lib/attendanceDefaults.js";

test("asistencia: lesión activa → motivo «lesión» al marcar «No»", () => {
  const p = { id: "p1", status: "activo" };
  const inj = [{ player_id: "p1", status: "activa" }];
  assert.equal(hasActiveInjury(p, inj), true);
  assert.equal(absenceReasonFor(p, { injuries: inj }), "lesion");
  // con alta, no
  assert.equal(absenceReasonFor(p, { injuries: [{ player_id: "p1", status: "alta" }] }), null);
  // ficha en «lesionado» sin parte de lesión
  assert.equal(absenceReasonFor({ id: "p2", status: "lesionado" }), "lesion");
  // un motivo ya elegido no se cambia
  assert.equal(absenceReasonFor(p, { current: "enfermo", injuries: inj }), "enfermo");
  // jugador sano: sin motivo
  assert.equal(absenceReasonFor({ id: "p3" }, { injuries: inj }), null);
  assert.equal(absenceReasonFor(null), null);
});
