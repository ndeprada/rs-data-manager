import assert from 'node:assert/strict';
import { actaMinutes, calcMinutesPlayed, defaultDuration, totalMinutes, eventMinutes } from '../src/lib/matchDuration.js';

const starters = ['t1', 't2', 't3'];
const evs = [
  { type: 'sub', team: 'home', minute: 30, playerOut: 't2', playerIn: 's1' },   // s1 entra al 30
  { type: 'sub', team: 'home', minute: 60, playerOut: 's1', playerIn: 's2' },   // s1 sale al 60, entra s2
  { type: 'card', team: 'home', minute: 70, playerId: 't3', cardColor: 'red' }, // roja a t3
  { type: 'card', team: 'home', minute: 50, playerId: 't1', cardColor: 'yellow' },
  { type: 'sub', team: 'away', minute: 10, playerOut: 'x', playerIn: 'y' },
];
const M = 90;

// Titular sin ningún cambio: el partido completo (la amarilla no lo saca del campo)
assert.equal(actaMinutes('t1', starters, evs, M), 90);
// Titular sustituido: hasta el cambio
assert.equal(actaMinutes('t2', starters, evs, M), 30);
// Suplente que entra y sale
assert.equal(actaMinutes('s1', starters, evs, M), 30);
// Suplente que entra y llega al final
assert.equal(actaMinutes('s2', starters, evs, M), 30);
// Expulsado: hasta la roja
assert.equal(actaMinutes('t3', starters, evs, M), 70);
// Suplente que no participa en ningún cambio: 0
assert.equal(actaMinutes('s9', starters, evs, M), 0);
// Sin ningún evento: titulares enteros, suplentes 0
assert.equal(actaMinutes('t1', starters, [], M), 90);
assert.equal(actaMinutes('s1', starters, [], M), 0);
// Los cambios del rival no cuentan
assert.equal(actaMinutes('y', starters, evs, M), 0);
// Sin titulares marcados no se sabe quién jugó: se respeta lo apuntado
assert.equal(actaMinutes('p1', [], [], M, 45), 45);
assert.equal(actaMinutes('p1', [], [], M), 0);
// Minuto fuera de rango (descuentos) no pasa del total; cambio sin minuto se ignora
assert.equal(calcMinutesPlayed('t1', ['t1'], [{ type: 'sub', team: 'home', minute: 95, playerOut: 't1' }], 60), 60);
assert.equal(calcMinutesPlayed('t1', ['t1'], [{ type: 'sub', team: 'home', minute: '', playerOut: 't1' }], 60), 60);
// Entra y vuelve a salir y entrar (rotación en fútbol 7): suma los tramos
const rot = [
  { type: 'sub', team: 'home', minute: 15, playerOut: 'r', playerIn: 'z' },
  { type: 'sub', team: 'home', minute: 30, playerOut: 'z', playerIn: 'r' },
];
assert.equal(calcMinutesPlayed('r', ['r'], rot, 60), 15 + 30);

// Duración: guardada; si no, la habitual del formato
assert.equal(totalMinutes('2x45'), 90);
assert.equal(totalMinutes('4x15'), 60);
assert.equal(totalMinutes('2x35'), 70);
assert.equal(defaultDuration('f7'), '4x15');
assert.equal(defaultDuration('f11'), '2x45');
assert.equal(eventMinutes({ football_format: 'f7' }), 60);
assert.equal(eventMinutes({ football_format: 'f11' }), 90);
assert.equal(eventMinutes({ football_format: 'f7', match_duration: '4x12' }), 48);
assert.equal(eventMinutes({}), 90);
