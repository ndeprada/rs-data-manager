import assert from 'node:assert/strict';
import { COACH_AREAS, DEFAULT_AREA, areaInfo, feedbackArea, FEEDBACK_TONES, isShared, hasLegacySections, countByArea } from '../src/lib/coachAreas.js';
import { ownerCanSeeCoachDoc } from '../src/lib/permissions.js';

// ── Áreas ──
assert.deepEqual(COACH_AREAS.map((a) => a.key), ['habitos', 'gestion', 'metodologia', 'partidos', 'humana']);
assert.equal(new Set(COACH_AREAS.map((a) => a.color)).size, 5, 'cada área con su color');
assert.equal(DEFAULT_AREA, 'partidos');
assert.equal(areaInfo('humana').key, 'humana');
assert.equal(areaInfo('inventada').key, 'partidos', 'un área desconocida cae en Partidos');
assert.deepEqual(FEEDBACK_TONES.map((x) => x.key), ['mejorar', 'positivo']);

// ── Feedback antiguo (sin área) = Partidos ──
assert.equal(feedbackArea({ lectura: 'x', status: 'enviado' }), 'partidos');
assert.equal(feedbackArea({ area: 'habitos', text: 'Llega tarde' }), 'habitos');
assert.equal(feedbackArea({ area: 'otra' }), 'partidos');
assert.equal(feedbackArea(null), 'partidos');

// ── Compartido = «enviado»; lo demás es interno ──
assert.equal(isShared({ status: 'enviado' }), true);
assert.equal(isShared({ status: 'borrador' }), false);
assert.equal(isShared(null), false);

// ── Apartados antiguos ──
assert.equal(hasLegacySections({ lectura: 'Buena lectura' }), true);
assert.equal(hasLegacySections({ lectura: '   ' }), false);
assert.equal(hasLegacySections({ text: 'Nota nueva', lectura: 'x' }), false, 'una nota nueva con texto no es antigua');
assert.equal(hasLegacySections({}), false);

// ── Recuento por área ──
const items = [{ lectura: 'a' }, { area: 'habitos', text: 'b' }, { area: 'habitos', text: 'c' }, { area: 'humana', text: 'd' }];
assert.deepEqual(countByArea(items), { all: 4, habitos: 2, gestion: 0, metodologia: 0, partidos: 1, humana: 1 });
assert.equal(countByArea([]).all, 0);

// ── El entrenador solo ve lo compartido, tenga el formato que tenga ──
assert.equal(ownerCanSeeCoachDoc('CoachFeedback', { area: 'habitos', text: 'x', status: 'borrador' }), false, 'nota interna: no se ve');
assert.equal(ownerCanSeeCoachDoc('CoachFeedback', { area: 'habitos', text: 'x', status: 'enviado' }), true, 'nota compartida: se ve');
assert.equal(ownerCanSeeCoachDoc('CoachFeedback', { lectura: 'x', status: 'enviado' }), true, 'feedback antiguo enviado: se ve');

console.log('coachAreas OK');
