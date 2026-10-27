import assert from 'node:assert/strict';
import { titleCase, fcfNameParts, fcfDisplayName } from '../src/lib/fcfNames.js';

assert.equal(titleCase('CADET SEGONA DIVISIÓ S15'), 'Cadet Segona Divisió S15');
assert.equal(titleCase('ESCOLA PIA SARRIÀ S.E. "A"'), 'Escola Pia Sarrià S.E. "A"');
assert.equal(titleCase('SARRIA, C.P. "A"'), 'Sarria, C.P. "A"');
assert.equal(titleCase('GRUP 3'), 'Grup 3');
assert.equal(titleCase('SANT JOAN I SANT PERE'), 'Sant Joan i Sant Pere');
assert.equal(titleCase('ESCOLA DE FUTBOL STOITCHKOV-RACING SARRIA "B"'), 'Escola de Futbol Stoitchkov-Racing Sarria "B"');
assert.deepEqual(fcfNameParts('PUIG MAS, JAN'), { first_name: 'Jan', last_name: 'Puig Mas' });
assert.equal(fcfDisplayName('DE LA TORRE ARELLANO, PATRICIO'), 'Patricio De la Torre Arellano');
assert.equal(fcfDisplayName('KOLTSOV , MIKHAIL'), 'Mikhail Koltsov');
assert.equal(fcfDisplayName(''), '');
console.log('fcfNames ok');
