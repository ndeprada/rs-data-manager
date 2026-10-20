import assert from 'node:assert/strict';
import { convocatoriaAlert, isFinished } from '../src/lib/matchTiming.js';

const H = 3600 * 1000;
const now = new Date('2026-10-21T12:00:00');
const at = (hours, extra = {}) => ({ date: new Date(now.getTime() + hours * H).toISOString(), ...extra });

// Sin convocatoria: solo avisa cuando faltan 24 h o menos
assert.equal(convocatoriaAlert(at(7 * 24), false, now), null, 'a 7 días no avisa');
assert.equal(convocatoriaAlert(at(48), false, now), null, 'a 2 días no avisa');
assert.equal(convocatoriaAlert(at(24.5), false, now), null, 'a 24,5 h todavía no');
assert.equal(convocatoriaAlert(at(24), false, now), 'soon', 'a 24 h justas sí');
assert.equal(convocatoriaAlert(at(5), false, now), 'soon');
assert.equal(convocatoriaAlert(at(0.1), false, now), 'soon');

// En juego (empezó hace menos de 2 h): sigue siendo urgente
assert.equal(convocatoriaAlert(at(-1), false, now), 'soon');

// Ya disputado sin convocatoria
assert.equal(convocatoriaAlert(at(-3), false, now), 'played');
assert.equal(convocatoriaAlert(at(-24 * 10), false, now), 'played');
assert.equal(convocatoriaAlert(at(-3, { end_date: new Date(now.getTime() - 2.5 * H).toISOString() }), false, now), 'played', 'respeta la hora de fin si existe');
assert.equal(convocatoriaAlert(at(-3, { end_date: new Date(now.getTime() + H).toISOString() }), false, now), 'soon', 'si la hora de fin no ha llegado, aún no ha terminado');

// Con convocatoria nunca avisa
assert.equal(convocatoriaAlert(at(5), true, now), null);
assert.equal(convocatoriaAlert(at(-3), true, now), null);

// Fecha rota: no avisa
assert.equal(convocatoriaAlert({ date: 'no-es-fecha' }, false, now), null);

assert.equal(isFinished(at(-3), now), true);
assert.equal(isFinished(at(-1), now), false);

console.log('matchTiming ok');
