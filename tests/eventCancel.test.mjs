import assert from 'node:assert/strict';
import { isCancelled, cancelText, cancelWord, cancelPatch, restorePatch, cancelReasonLabel } from '../src/lib/eventCancel.js';
import { buildIcs } from '../api/_lib/ics.js';

// Estado cancelado/suspendido de un evento
const training = { id: 't1', type: 'entrenamiento', title: 'Entreno', date: '2026-11-03T19:00' };
assert.equal(isCancelled(training), false);
assert.equal(isCancelled(undefined), false);
assert.equal(isCancelled({ ...training, cancelled: false }), false);
assert.equal(isCancelled({ ...training, cancelled: 'true' }), false, 'solo vale el booleano');
assert.equal(isCancelled({ ...training, cancelled: true }), true);

// Textos: partidos «Suspendido», el resto «Cancelado»
assert.equal(cancelWord(training), 'Cancelado');
assert.equal(cancelWord({ type: 'partido_liga' }), 'Suspendido');
assert.equal(cancelText({ ...training, cancelled: true, cancel_reason: 'lluvia' }), 'Cancelado · Lluvia');
assert.equal(cancelText({ ...training, cancelled: true, cancel_reason: 'festivo' }), 'Cancelado · Festivo');
assert.equal(cancelText({ type: 'torneo', cancelled: true, cancel_reason: 'campo' }), 'Suspendido · Campo no disponible');
assert.equal(cancelText({ ...training, cancelled: true }), 'Cancelado', 'sin motivo');
assert.equal(cancelText(training), '', 'no cancelado: sin texto');
assert.equal(cancelReasonLabel({ cancel_reason: 'inventado' }), '');

// Lo que se guarda al cancelar y al restaurar
assert.deepEqual(cancelPatch('lluvia'), { cancelled: true, cancel_reason: 'lluvia' });
assert.deepEqual(cancelPatch(), { cancelled: true, cancel_reason: 'otro' });
assert.deepEqual(restorePatch(), { cancelled: false, cancel_reason: null });
assert.equal(isCancelled({ ...training, ...cancelPatch('lluvia'), ...restorePatch() }), false);

// Calendario del móvil: el evento sigue, marcado como cancelado y con el motivo
const row = (id, data) => ({ id, data, updated_at: '2026-10-21T08:00:00Z' });
const { text, count } = buildIcs({
  team: { name: 'Juvenil A' },
  events: [
    row('a1', training),
    row('a2', { ...training, title: 'Entreno lluvia', date: '2026-11-05T19:00', cancelled: true, cancel_reason: 'lluvia' }),
    row('a3', { type: 'partido_liga', title: 'Rival vs Juvenil A', date: '2026-11-07T10:00', cancelled: true, cancel_reason: 'lluvia' }),
  ],
});
assert.equal(count, 3, 'los cancelados siguen en el calendario');
const events = text.split('BEGIN:VEVENT').slice(1);
assert.match(events[0], /STATUS:CONFIRMED/);
assert.doesNotMatch(events[0], /CANCELADO/);
assert.match(events[1], /STATUS:CANCELLED/);
assert.match(events[1], /SUMMARY:CANCELADO: Entreno lluvia/);
assert.match(events[1], /DESCRIPTION:Cancelado · Lluvia/);
assert.match(events[2], /STATUS:CANCELLED/);
assert.match(events[2], /SUMMARY:SUSPENDIDO: ⚽ Rival vs Juvenil A/);

console.log('eventCancel ok');
