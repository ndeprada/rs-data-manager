import assert from 'node:assert/strict';
import { titleCase, fcfNameParts, fcfDisplayName } from '../src/lib/fcfNames.js';

assert.equal(titleCase('CADET SEGONA DIVISIÓ S15'), 'Cadet Segona Divisió S15');
assert.equal(titleCase('ESCOLA PIA SARRIÀ S.E. "A"'), 'Escola Pia Sarrià S.E. "A"');
assert.equal(titleCase('SARRIA, C.P. "A"'), 'Sarria, C.P. "A"');
assert.equal(titleCase('GRUP 3'), 'Grup 3');
assert.equal(titleCase('MOLLET U.E.,CF. B'), 'Mollet U.E.,CF. B');
assert.equal(titleCase('SANT JOAN I SANT PERE'), 'Sant Joan i Sant Pere');
assert.equal(titleCase('ESCOLA DE FUTBOL STOITCHKOV-RACING SARRIA "B"'), 'Escola de Futbol Stoitchkov-Racing Sarria "B"');
assert.deepEqual(fcfNameParts('PUIG MAS, JAN'), { first_name: 'Jan', last_name: 'Puig Mas' });
assert.equal(fcfDisplayName('DE LA TORRE ARELLANO, PATRICIO'), 'Patricio De la Torre Arellano');
assert.equal(fcfDisplayName('KOLTSOV , MIKHAIL'), 'Mikhail Koltsov');
assert.equal(fcfDisplayName(''), '');
console.log('fcfNames ok');

{
  const { clubOf, originKind, teamLetter } = await import('../src/lib/fcfNames.js');
  assert.equal(clubOf('CATALONIA "B"'), 'CATALONIA');
  assert.equal(clubOf('CAN BUXERES, F.C. A'), clubOf('CAN BUXERES, F.C. C'));
  assert.equal(clubOf('SANT ANDREU, U.E F'), 'SANT ANDREU U E');
  assert.equal(clubOf('CATALÒNIA, U.B. A'), clubOf('CATALONIA, U.B. B'));
  assert.equal(teamLetter('CAN BUXERES, F.C. C'), 'C');
  assert.equal(teamLetter('MARIANAO POBLET UD A'), 'A');
  assert.equal(originKind(null, 'X'), 'none');
  assert.equal(originKind({ team: 'CAN BUXERES, F.C. B' }, 'CAN BUXERES, F.C. B', 17), 'same');
  // del cadete al juvenil del mismo club = sube
  assert.equal(originKind({ team: 'CAN BUXERES, F.C. A', lvl: 16 }, 'CAN BUXERES, F.C. B', 17), 'up');
  // misma categoría: del C al B sube; del A al B no
  assert.equal(originKind({ team: 'CAN BUXERES, F.C. C', lvl: 17 }, 'CAN BUXERES, F.C. B', 17), 'up');
  assert.equal(originKind({ team: 'CAN BUXERES, F.C. A', lvl: 17 }, 'CAN BUXERES, F.C. B', 17), 'club');
  // de una categoría superior a una inferior del club: no es subida
  assert.equal(originKind({ team: 'CAN BUXERES, F.C. A', lvl: 16 }, 'CAN BUXERES, F.C. A', 17), 'up', 'el cadete A y el juvenil A se llaman igual');
  assert.equal(originKind({ team: 'CAN BUXERES, F.C. A', lvl: 17 }, 'CAN BUXERES, F.C. A', 17), 'same');
  assert.equal(originKind({ team: 'CAN BUXERES, F.C. A', lvl: 17 }, 'CAN BUXERES, F.C. A', 16), 'club');
  assert.equal(originKind({ team: 'CAN BUXERES, F.C. B', lvl: 17 }, 'CAN BUXERES, F.C. A', 16), 'club');
  assert.equal(originKind({ team: 'CATALÒNIA, U.B. A', lvl: 17 }, 'CAN BUXERES, F.C. B', 17), 'new');
}
