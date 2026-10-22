import assert from 'node:assert/strict';
import {
  FEEDBACK_PROGRESS, progressOf, progressInfo, countByProgress, closeOf, quarterState, unpublishedObs, carriedFeedback, progressVisibleToCoach,
} from '../src/lib/coachQuarterClose.js';
import { quarterRange } from '../src/lib/coachQuarters.js';

const S = '2026-2027';

// ── Estados del feedback ──
assert.deepEqual(FEEDBACK_PROGRESS.map((p) => p.key), ['pendiente', 'seguir', 'asimilado']);
assert.equal(progressOf({}), 'pendiente', 'sin estado = pendiente');
assert.equal(progressOf({ progress: 'raro' }), 'pendiente');
assert.equal(progressOf({ progress: 'seguir' }), 'seguir');
assert.equal(progressInfo('asimilado').key, 'asimilado');
assert.deepEqual(countByProgress([{}, { progress: 'seguir' }, { progress: 'seguir' }, { progress: 'asimilado' }]), { pendiente: 1, seguir: 2, asimilado: 1 });

// ── Estado del trimestre ──
const closes = [
  { season: S, quarter: 'q1', status: 'publicado' },
  { season: S, quarter: 'q2', status: 'cerrado' },
  { season: '2025-2026', quarter: 'q3', status: 'publicado' },
];
assert.equal(quarterState(closeOf(closes, S, 'q1')), 'publicado');
assert.equal(quarterState(closeOf(closes, S, 'q2')), 'cerrado');
assert.equal(quarterState(closeOf(closes, S, 'q3')), 'abierto', 'sin registro = abierto');
assert.equal(closeOf(closes, S, 'q3'), null);

// ── Observaciones sin publicar ──
const range = quarterRange(S, 'q1');
const obs = [
  { id: 1, date: '2026-09-10', status: 'publicada' },
  { id: 2, date: '2026-10-19', status: 'borrador' },
  { id: 3, date: '2027-01-12', status: 'borrador' },
];
assert.deepEqual(unpublishedObs(obs, range).map((o) => o.id), [2], 'solo las del trimestre y sin publicar');

// ── «Seguir trabajando» pasa al trimestre siguiente ──
const fb = [
  { id: 'a', date: '2026-09-20', progress: 'seguir' },
  { id: 'b', date: '2026-09-21', progress: 'asimilado' },
  { id: 'c', date: '2026-10-01' },
  { id: 'd', date: '2027-01-15', progress: 'seguir' },
  { id: 'e', date: '2026-05-01', progress: 'seguir' },
];
assert.deepEqual(carriedFeedback(fb, S, 'q2').map((f) => f.id), ['a'], 'solo lo pendiente de seguir, de la misma temporada y de antes');
assert.deepEqual(carriedFeedback(fb, S, 'q1').map((f) => f.id), [], 'en el primer trimestre no hay arrastre');
assert.deepEqual(carriedFeedback(fb, S, 'q3').map((f) => f.id).sort(), ['a', 'd']);
assert.deepEqual(carriedFeedback(fb, S, 'all'), []);

// ── Lo que ve el entrenador ──
assert.equal(progressVisibleToCoach({ date: '2026-10-01' }, closes, S), true, 'trimestre publicado');
assert.equal(progressVisibleToCoach({ date: '2027-02-01' }, closes, S), false, 'cerrado pero sin publicar');
assert.equal(progressVisibleToCoach({ date: '2027-05-01' }, closes, S), false, 'abierto');
console.log('ok');
