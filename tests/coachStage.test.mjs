import assert from 'node:assert/strict';
import { isStageF7, isStageF11, stageSeesCoach } from '../src/lib/coachStage.js';

const T = (category) => ({ id: category, category });
const f11 = T('juvenil_primera_divisio');
const infantil = T('infantil_primera_divisio_s13');
const f7a = T('primera_divisio_alevin_s11');
const f7b = T('primera_divisio_benjami_s9');

// ── Qué es F7 y qué F11 ──
assert.equal(isStageF7(f7a), true);
assert.equal(isStageF7(f7b), true);
assert.equal(isStageF7(f11), false);
assert.equal(isStageF11(f11), true);
assert.equal(isStageF11(infantil), true);
assert.equal(isStageF11(f7a), false);

// ── Entrenador de un solo equipo ──
assert.equal(stageSeesCoach('coordinador_f11', [f11]), true);
assert.equal(stageSeesCoach('coordinador_f7', [f11]), false);
assert.equal(stageSeesCoach('coordinador_f7', [f7a]), true);
assert.equal(stageSeesCoach('coordinador_f11', [f7a]), false);

// ── Entrenador de F7 y de F11 (caso de Borja): lo ven los dos coordinadores, estén los equipos en el orden que estén ──
for (const teams of [[f7a, infantil], [infantil, f7a], [f7b, f11, f7a]]) {
  assert.equal(stageSeesCoach('coordinador_f11', teams), true, 'el coordinador de F11 ve a quien lleva también un equipo de F11');
  assert.equal(stageSeesCoach('coordinador_f7', teams), true, 'el coordinador de F7 ve a quien lleva también un equipo de F7');
}

// ── Sin equipos, otros roles o equipos que ya no existen ──
assert.equal(stageSeesCoach('coordinador_f11', []), false);
assert.equal(stageSeesCoach('coordinador_f7', undefined), false);
assert.equal(stageSeesCoach('entrenador', [f11]), false);
assert.equal(stageSeesCoach(null, [f11]), false);

console.log('coachStage OK');
