import assert from 'node:assert/strict';
import {
  FORMATIONS_F11, FORMATIONS_F7, LEGACY_F7, FORMATION_POSITIONS, FORMATION_LABELS, F7_SLOT_ROLES,
  formationLabel, formationsFor, isFormationOf, formationOptions, normalizeFormation,
} from '../src/lib/matchFormations.js';

// Fútbol 7: los cuatro sistemas del club, el base (3-1-2 con extremos abiertos) primero, que es el que sale por defecto
assert.deepEqual(FORMATIONS_F7, ['3-1-2', '3-1-2 puntas', '3-2-1', '2-3-1']);
assert.equal(formationsFor(true)[0], '3-1-2');
assert.deepEqual(formationsFor(false), FORMATIONS_F11);
for (const f of FORMATIONS_F7) assert.equal(FORMATION_POSITIONS[f].length, 7, `${f}: portero + 6`);
for (const f of FORMATIONS_F11) assert.equal(FORMATION_POSITIONS[f].length, 11, `${f}: portero + 10`);
for (const [f, pos] of Object.entries(FORMATION_POSITIONS)) {
  assert.deepEqual(pos[0], [50, 88], `${f}: el hueco 0 es el portero, en su sitio`);
  for (const [x, y] of pos) assert.ok(x >= 8 && x <= 92 && y >= 10 && y <= 92, `${f}: dentro del campo (${x},${y})`);
}

// Sistema base «3-1-2» (lo que describió Nacho): laterales más adelantados que el central, extremos abiertos y mediapunta algo por debajo de ellos.
// Es la forma que ya tenía la app con ese nombre: no se mueve para que los partidos ya preparados se vean igual.
assert.deepEqual(FORMATION_POSITIONS['3-1-2'], [[50, 88], [22, 61], [50, 70], [78, 61], [50, 40], [17, 26], [83, 26]]);
const [gk, latI, cen, latD, mp, extI, extD] = FORMATION_POSITIONS['3-1-2'];
assert.deepEqual(F7_SLOT_ROLES['3-1-2'], ['portero', 'lateral', 'central', 'lateral', 'mediapunta', 'extremo', 'extremo']);
assert.ok(latI[1] < cen[1] && latD[1] < cen[1], 'laterales más avanzados que el central (y menor = más cerca del ataque)');
assert.ok(latI[1] === latD[1] && latI[0] + latD[0] === 100, 'laterales simétricos');
assert.equal(cen[0], 50);
assert.ok(extI[0] <= 20 && extD[0] >= 80 && extI[0] + extD[0] === 100 && extI[1] === extD[1], 'extremos abiertos y simétricos');
assert.equal(mp[0], 50, 'mediapunta en el centro');
assert.ok(extI[1] < mp[1], 'mediapunta por debajo de los extremos (más atrás)');
assert.ok(mp[1] - extI[1] >= 8 && mp[1] - extI[1] <= 20, 'solo «algo» por debajo, no en el centro del campo');
assert.ok(mp[1] < latI[1], 'y por delante de los laterales');
assert.ok(gk[1] > cen[1], 'portero detrás del central');

// Las variantes de tres atrás comparten la misma defensa que el sistema base
const back = FORMATION_POSITIONS['3-1-2'].slice(0, 4);
for (const f of ['3-1-2 puntas', '3-2-1']) assert.deepEqual(FORMATION_POSITIONS[f].slice(0, 4), back, `${f}: misma defensa`);
// 3-1-2 con dos puntas: mismo mediapunta, y dos puntas por dentro en vez de los extremos abiertos
assert.deepEqual(F7_SLOT_ROLES['3-1-2 puntas'], ['portero', 'lateral', 'central', 'lateral', 'mediapunta', 'punta', 'punta']);
const [, , , , piv, p1, p2] = FORMATION_POSITIONS['3-1-2 puntas'];
assert.deepEqual(piv, mp, 'el mismo mediapunta que el base');
assert.ok(p1[1] === p2[1] && p1[0] + p2[0] === 100 && p1[0] < p2[0], 'dos puntas a la misma altura y simétricos');
assert.ok(p1[1] < piv[1], 'puntas por delante del mediapunta');
assert.ok(p2[0] - p1[0] <= 40, 'puntas juntos, por dentro');
assert.ok(p1[0] >= extI[0] + 15, 'y bastante más cerrados que los extremos del sistema base');
// 3-2-1 con dos medios y un solo punta
assert.deepEqual(F7_SLOT_ROLES['3-2-1'], ['portero', 'lateral', 'central', 'lateral', 'medio', 'medio', 'punta']);
const [, , , , m1, m2, punta] = FORMATION_POSITIONS['3-2-1'];
assert.ok(m1[1] === m2[1] && m1[0] + m2[0] === 100 && m1[0] < 50, 'dos medios a la misma altura y simétricos');
assert.ok(punta[0] === 50 && punta[1] < m1[1], 'un solo punta, por delante de los medios');
assert.ok(m1[1] < latI[1], 'medios por delante de la defensa');
// 2-3-1 sin cambios
assert.deepEqual(FORMATION_POSITIONS['2-3-1'], [[50, 88], [30, 72], [70, 72], [20, 50], [50, 46], [80, 50], [50, 20]]);

// Sistemas anteriores que ya no se ofrecen: se conservan tal cual y solo salen en los partidos que los usan
assert.deepEqual(LEGACY_F7, ['2-2-2', '1-3-2']);
assert.deepEqual(FORMATION_POSITIONS['2-2-2'], [[50, 88], [30, 70], [70, 70], [30, 46], [70, 46], [30, 22], [70, 22]]);
assert.deepEqual(FORMATION_POSITIONS['1-3-2'], [[50, 88], [50, 72], [22, 52], [50, 48], [78, 52], [30, 22], [70, 22]]);

// Qué formaciones vale cada formato y qué sale en el desplegable
assert.ok(isFormationOf(true, '3-1-2') && isFormationOf(true, '3-2-1') && isFormationOf(true, '2-2-2'), 'F7: las del club y las antiguas valen');
assert.ok(!isFormationOf(true, '4-3-3') && !isFormationOf(false, '3-1-2') && !isFormationOf(false, '3-2-1'), 'cada formato, las suyas');
assert.ok(isFormationOf(false, '4-3-3') && !isFormationOf(true, 'no-existe'));
assert.deepEqual(formationOptions(true, '3-1-2'), FORMATIONS_F7);
assert.deepEqual(formationOptions(true, '2-2-2'), [...FORMATIONS_F7, '2-2-2'], 'una antigua en uso se sigue viendo, aparte');
assert.deepEqual(formationOptions(false, '4-3-3'), FORMATIONS_F11);
assert.deepEqual(formationOptions(false, '2-2-2'), FORMATIONS_F11, 'en F11 no se cuela ninguna de F7');

// Claves publicadas unos minutos con otro nombre: se leen como las de ahora (y nada más cambia)
assert.equal(normalizeFormation('3-2-1 base'), '3-1-2');
assert.equal(normalizeFormation('3-2-1 medios'), '3-2-1');
for (const f of [...FORMATIONS_F11, ...FORMATIONS_F7, ...LEGACY_F7]) assert.equal(normalizeFormation(f), f, `${f}: sin cambios`);
assert.ok(isFormationOf(true, normalizeFormation('3-2-1 base')) && isFormationOf(true, normalizeFormation('3-2-1 medios')));

// Etiquetas: las de F11 son la propia clave; las de F7 dicen qué sistema es
assert.equal(formationLabel('4-3-3'), '4-3-3');
assert.equal(formationLabel('3-1-2'), '3-1-2 · Base');
assert.equal(formationLabel('3-1-2 puntas'), '3-1-2 · 2 puntas');
assert.equal(formationLabel('3-2-1'), '3-2-1 · 2 medios y 1 punta');
assert.equal(formationLabel('2-2-2'), '2-2-2 (antiguo)');
assert.equal(formationLabel('3-2-1 base'), '3-1-2 · Base');
assert.equal(formationLabel('2-3-1'), '2-3-1');
for (const k of Object.keys(FORMATION_LABELS)) assert.ok(k in FORMATION_POSITIONS, `${k}: etiqueta de una formación que existe`);
console.log('matchFormations OK');
