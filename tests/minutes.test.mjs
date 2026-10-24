import assert from 'node:assert/strict';
import { actaMinutes, calcMinutesPlayed, defaultDuration, totalMinutes, eventMinutes, categoryDuration, teamDefaultDuration, durationLabel, isDuration, DURATIONS } from '../src/lib/matchDuration.js';

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

// Valores antiguos guardados como minutos totales ("80") también se entienden
assert.equal(totalMinutes('80'), 80);
assert.equal(totalMinutes('70'), 70);
assert.equal(totalMinutes('basura'), 90);

// Duración habitual por categoría (los 23 equipos reales del club, por categoría FCF y por nombre)
const T = (name, category) => ({ name, category });
assert.equal(categoryDuration(T('Primer Equipo', 'tercera_catalana')), '2x45');
assert.equal(categoryDuration(T('Juvenil A', 'juvenil_primera_divisio')), '2x45');
assert.equal(categoryDuration(T('Juvenil D', 'juvenil_segona_divisio')), '2x45');
assert.equal(categoryDuration(T('Cadet S15 A', 'cadet_primera_divisio_s15')), '2x40');
assert.equal(categoryDuration(T('Cadet S16 B', 'cadet_primera_divisio_s16')), '2x40');
assert.equal(categoryDuration(T('Infantil S13 A', 'infantil_primera_divisio_s13')), '2x35');
assert.equal(categoryDuration(T('Infantil S14 B', 'infantil_segona_divisio_s14')), '2x35');
assert.equal(categoryDuration(T('Aleví S12 A', 'primera_divisio_alevin_s12')), '4x15');
assert.equal(categoryDuration(T('Aleví S11 B', 'segona_divisio_alevin_s11')), '4x15');
assert.equal(categoryDuration(T('Benjamí S10 A', 'primera_divisio_benjamin_s10')), '4x15');
assert.equal(categoryDuration(T('Benjamí S9 B', 'tercera_divisio_benjamin_s9')), '4x12');
assert.equal(categoryDuration(T('Prebenjamí S8 A', 'prebenjami_s8')), '4x10');
// Sin categoría reconocible: por el nombre (con tildes) y, si tampoco, nada
assert.equal(categoryDuration(T('Benjamí S9 A', '')), '4x12');
assert.equal(categoryDuration(T('Equipo raro', 'otra')), null);
assert.equal(categoryDuration(null), null);

// La duración guardada por el entrenador manda sobre la de la categoría; una inválida se ignora
assert.equal(teamDefaultDuration({ ...T('Cadet S16 A', 'cadet_primera_divisio_s16'), default_match_duration: '2x35' }), '2x35');
assert.equal(teamDefaultDuration({ ...T('Cadet S16 A', 'cadet_primera_divisio_s16'), default_match_duration: 'x' }), '2x40');
assert.equal(teamDefaultDuration(T('Equipo raro', 'otra')), null);

// Orden de prioridad de un partido: la suya > la del equipo > la de la categoría > la del formato
const cadet = T('Cadet S16 A', 'cadet_primera_divisio_s16');
assert.equal(eventMinutes({ football_format: 'f11' }, cadet), 80);
assert.equal(eventMinutes({ football_format: 'f11', match_duration: '2x35' }, cadet), 70);
assert.equal(eventMinutes({ football_format: 'f11' }, { ...cadet, default_match_duration: '2x35' }), 70);
assert.equal(eventMinutes({ football_format: 'f7' }, T('Equipo raro', 'otra')), 60);
assert.equal(eventMinutes({ football_format: 'f11' }, T('Prebenjamí S8 A', 'prebenjami_s8')), 40);
// un partido de S12 marcado como F11 sigue siendo de fútbol 7: 4 cuartos de 15' del equipo (nunca 90')
assert.equal(eventMinutes({ football_format: 'f11' }, T('Aleví S12 A', 'primera_divisio_alevin_s12')), 60);
assert.equal(eventMinutes({ football_format: 'f11' }, { name: 'Aleví S12 A' }), 60);
assert.equal(defaultDuration('f7', cadet), '2x40');

// Minutos del acta con la duración de cada categoría: titular sin cambios = partido completo
assert.equal(actaMinutes('t1', ['t1', 't2'], [], 80), 80);
assert.equal(actaMinutes('t2', ['t1', 't2'], [{ type: 'sub', team: 'home', minute: 25, playerOut: 't2', playerIn: 's1' }], 40), 25);
assert.equal(actaMinutes('s1', ['t1', 't2'], [{ type: 'sub', team: 'home', minute: 25, playerOut: 't2', playerIn: 's1' }], 40), 15);

// Lista que se ofrece en el acta
assert.deepEqual(DURATIONS.map((d) => d.value), ['2x45', '2x40', '2x35', '4x15', '4x12', '4x10']);
assert.ok(DURATIONS.every((d) => isDuration(d.value)));
assert.equal(durationLabel('2x40'), "2 partes de 40'");
assert.equal(durationLabel('4x15'), "4 cuartos de 15'");
assert.equal(durationLabel('80'), "80'");
