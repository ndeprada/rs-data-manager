import assert from 'node:assert/strict';
import { F7_POSITIONS, F7_POSITION_ORDER, F7_PRINCIPLE, f7Info, isF7Position, stageOf, positionChoices, f7ContentOptions, F11_POSITION_OPTIONS } from '../src/lib/f7Positions.js';
import { getPitchXYs, getPositionList } from '../src/lib/playerPositions.js';

// Las cinco posiciones de fútbol 7, en el orden que se ofrece, cada una con descripción y contenidos
assert.deepEqual(F7_POSITION_ORDER, ['portero', 'lateral', 'central', 'mediapunta', 'extremo']);
for (const k of F7_POSITION_ORDER) {
  const p = F7_POSITIONS[k];
  assert.ok(p.label && p.short && p.why.length > 60, `${k}: descripción`);
  assert.ok(p.contents.length >= 6, `${k}: contenidos`);
  assert.equal(new Set(p.contents).size, p.contents.length, `${k}: sin contenidos repetidos`);
}
assert.ok(F7_PRINCIPLE.includes('no define al jugador'));
assert.equal(f7Info('mediapunta').label, 'Mediapunta');
assert.equal(f7Info('mediocentro'), null, 'mediocentro no es de fútbol 7');
assert.equal(isF7Position('extremo'), true);
assert.equal(isF7Position('delantero_centro'), false);

// Etapa: lo fijado en la ficha manda; si no, la del equipo
assert.equal(stageOf({}, true), 'f7');
assert.equal(stageOf({}, false), 'f11');
assert.equal(stageOf({ pdi_stage: 'f11' }, true), 'f11');
assert.equal(stageOf({ pdi_stage: 'f7' }, false), 'f7');
assert.equal(stageOf(null, true), 'f7');

// Posiciones que se ofrecen: en fútbol 7 solo las de fútbol 7; en fútbol 11 las de siempre
assert.deepEqual(positionChoices('f7', '').map((p) => p.value), ['portero', 'lateral', 'central', 'mediapunta', 'extremo']);
assert.deepEqual(positionChoices('f11', '').map((p) => p.value), F11_POSITION_OPTIONS.map((p) => p.value));
assert.ok(!positionChoices('f11', '').some((p) => p.value === 'mediapunta'));
// Un dato guardado de la otra etapa no se pierde: sale como opción aparte, marcada
const legacy = positionChoices('f7', 'delantero_centro');
assert.equal(legacy.length, 6);
assert.deepEqual(legacy[5], { value: 'delantero_centro', label: 'Delantero Centro (fútbol 11)', legacy: true });
assert.equal(positionChoices('f11', 'mediapunta').at(-1).label, 'Mediapunta (fútbol 7)');
assert.equal(positionChoices('f7', 'libre').at(-1).label, 'Libre (antigua)');
assert.equal(positionChoices('f7', 'central').length, 5, 'si ya está entre las opciones no se duplica');

// Contenidos como aspectos del plan de desarrollo
const own = f7ContentOptions('extremo');
assert.equal(own.length, F7_POSITIONS.extremo.contents.length);
assert.ok(own.every((o) => o.source === 'f7' && o.group === 'extremo' && o.id.startsWith('f7.extremo.')));
const other = f7ContentOptions('extremo', { other: true });
assert.ok(other.every((o) => o.source === 'other' && o.group !== 'extremo'));
assert.equal(new Set(other.map((o) => o.id)).size, other.length, 'ids únicos');
assert.deepEqual(f7ContentOptions('mediocentro'), []);

// Mediapunta se dibuja en el campo y entra en la lista de posiciones del jugador
assert.deepEqual(getPitchXYs('mediapunta', '', 'diestro'), [{ x: 50, y: 28 }]);
assert.deepEqual(getPositionList({ position: 'mediapunta', extra_positions: [{ position: 'extremo', level: 'secundaria' }] }).map((x) => x.position), ['mediapunta', 'extremo']);

console.log('f7Positions OK');
