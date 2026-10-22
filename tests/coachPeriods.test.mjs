import assert from 'node:assert/strict';
import {
  FEEDBACK_PROGRESS, progressOf, progressInfo, countByProgress, rangeOfClose, periodsOf, openPeriodRange, validatePeriod,
  isPublished, unpublishedObs, carriedFeedback, progressVisibleToCoach,
} from '../src/lib/coachPeriods.js';

const S = '2026-2027';

// ── Estados del feedback ──
assert.deepEqual(FEEDBACK_PROGRESS.map((p) => p.key), ['pendiente', 'seguir', 'asimilado']);
assert.equal(progressOf({}), 'pendiente', 'sin estado = pendiente');
assert.equal(progressOf({ progress: 'raro' }), 'pendiente');
assert.equal(progressOf({ progress: 'seguir' }), 'seguir');
assert.equal(progressInfo('asimilado').key, 'asimilado');
assert.deepEqual(countByProgress([{}, { progress: 'seguir' }, { progress: 'seguir' }, { progress: 'asimilado' }]), { pendiente: 1, seguir: 2, asimilado: 1 });

// ── Periodos elegidos por quien evalúa ──
const closes = [
  { id: 'a', season: S, from: '2026-08-15', to: '2026-10-31', status: 'publicado' },
  { id: 'b', season: S, from: '2026-11-01', to: '2026-12-20', status: 'cerrado', label: 'Hasta Navidad' },
  { id: 'old', season: S, quarter: 'q2', status: 'cerrado' }, // registro anterior, por trimestre fijo
  { id: 'x', season: '2025-2026', from: '2025-09-01', to: '2026-06-30', status: 'publicado' },
];
assert.deepEqual(rangeOfClose(closes[0], S), { from: '2026-08-15', to: '2026-10-31' });
assert.deepEqual(rangeOfClose(closes[2], S), { from: '2027-01-01', to: '2027-03-31' }, 'trimestre antiguo → sus fechas');
assert.equal(rangeOfClose({}, S), null);
assert.deepEqual(periodsOf(closes, S).map((p) => p.id), ['old', 'b', 'a'], 'de más reciente a más antiguo y solo de la temporada');
assert.equal(isPublished(closes[0]), true);
assert.equal(isPublished(closes[1]), false);

// Periodo abierto: empieza al día siguiente del último cierre
assert.deepEqual(openPeriodRange([], S), { from: '2026-08-01', to: '2027-07-31' }, 'sin cierres, desde el inicio de la temporada');
assert.deepEqual(openPeriodRange(closes.slice(0, 2), S), { from: '2026-12-21', to: '2027-07-31' });
assert.deepEqual(openPeriodRange([{ season: S, from: '2026-08-01', to: '2026-12-31', status: 'cerrado' }], S).from, '2027-01-01', 'cambio de año');

// Validación al cerrar
const today = '2026-12-30';
const okArgs = { closes: closes.slice(0, 2), season: S, today };
assert.equal(validatePeriod({ from: '2026-12-21', to: '2026-12-30', ...okArgs }), null);
assert.equal(validatePeriod({ from: '', to: '2026-12-30', ...okArgs }), 'missing');
assert.equal(validatePeriod({ from: '2026-12-25', to: '2026-12-21', ...okArgs }), 'order');
assert.equal(validatePeriod({ from: '2026-12-21', to: '2027-01-05', ...okArgs }), 'future', 'no se cierra con fechas futuras');
assert.equal(validatePeriod({ from: '2026-07-01', to: '2026-07-20', ...okArgs }), 'season', 'antes de la temporada');
assert.equal(validatePeriod({ from: '2026-12-10', to: '2026-12-30', ...okArgs }), 'overlap', 'se pisa con un periodo ya cerrado');
assert.equal(validatePeriod({ from: '2026-12-21', to: '2026-12-21', ...okArgs }), null, 'un solo día vale');

// ── Observaciones sin publicar ──
const range = { from: '2026-08-15', to: '2026-10-31' };
const obs = [
  { id: 1, date: '2026-09-10', status: 'publicada' },
  { id: 2, date: '2026-10-19', status: 'borrador' },
  { id: 3, date: '2027-01-12', status: 'borrador' },
];
assert.deepEqual(unpublishedObs(obs, range).map((o) => o.id), [2], 'solo las del periodo y sin publicar');

// ── «Seguir trabajando» pasa a los periodos siguientes ──
const fb = [
  { id: 'a', date: '2026-09-20', progress: 'seguir' },
  { id: 'b', date: '2026-09-21', progress: 'asimilado' },
  { id: 'c', date: '2026-10-01' },
  { id: 'd', date: '2027-01-15', progress: 'seguir' },
  { id: 'e', date: '2026-05-01', progress: 'seguir' },
];
assert.deepEqual(carriedFeedback(fb, S, { from: '2026-11-01', to: '2026-12-20' }).map((f) => f.id), ['a'], 'solo lo de seguir, de la misma temporada y anterior');
assert.deepEqual(carriedFeedback(fb, S, { from: '2026-08-01', to: '2026-10-31' }).map((f) => f.id), [], 'en el primero no hay arrastre');
assert.deepEqual(carriedFeedback(fb, S, { from: '2027-02-01', to: '2027-03-31' }).map((f) => f.id).sort(), ['a', 'd']);
assert.deepEqual(carriedFeedback(fb, S, null), []);

// ── Lo que ve el entrenador ──
assert.equal(progressVisibleToCoach({ date: '2026-10-01' }, closes, S), true, 'periodo publicado');
assert.equal(progressVisibleToCoach({ date: '2026-11-15' }, closes, S), false, 'periodo cerrado sin publicar');
assert.equal(progressVisibleToCoach({ date: '2027-05-01' }, closes, S), false, 'periodo abierto');
console.log('ok');
