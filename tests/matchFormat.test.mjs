import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { teamPlaysF7, matchFormat, minPlayersOf } from '../src/lib/matchFormat.js';

const T = (name, category = '') => ({ name, category });

// Racing Sarrià: fútbol 7 de Aleví S12 hacia abajo; fútbol 11 desde Infantil S13 (Nacho, 25/10/2026: «S12 es de etapa fútbol 7»)
for (const n of ['Aleví S12 A', 'Aleví S12 B', 'Aleví S11 A', 'Benjamí S10 A', 'Benjamí S9 B', 'Prebenjamí S8 A', 'Prebenjamí S7', 'Escuela'])
  assert.equal(teamPlaysF7(T(n)), true, n);
for (const n of ['Infantil S13 A', 'Infantil S14 B', 'Cadet S15 A', 'Cadet S16 A', 'Juvenil A', 'Juvenil B', 'Primer Equipo'])
  assert.equal(teamPlaysF7(T(n)), false, n);
assert.equal(teamPlaysF7(null), false);
assert.equal(teamPlaysF7(undefined), false);
assert.equal(teamPlaysF7({}), false);
// sin el nombre reconocible, vale la categoría de la FCF
assert.equal(teamPlaysF7(T('Equipo raro', 'primera_divisio_alevin_s12')), true);
assert.equal(teamPlaysF7(T('Equipo raro', 'preferent_infantil_s13')), false);
// con el nombre que da la FCF a la categoría (sincronización): «Aleví S12» -> alevin_s12
assert.equal(teamPlaysF7({ name: 'Aleví S12', category: 'alevin_s12' }), true);
assert.equal(teamPlaysF7({ name: 'Infantil S13', category: 'infantil_s13' }), false);

// Todas las categorías de la FCF que el club conoce: las de F7 salen F7 y las demás no (mismo reparto que `isF7Team` de la app)
{
  const src = readFileSync(new URL('../src/components/fcfCategories.jsx', import.meta.url), 'utf8');
  const rows = [...src.matchAll(/group:\s*"([^"]+)",\s*value:\s*"([^"]+)"/g)].map((m) => ({ group: m[1], value: m[2] }));
  assert.ok(rows.length > 40, 'no se han leído las categorías');
  const F7_GROUPS = ['Aleví S12', 'Aleví S11', 'Benjamí S10', 'Benjamí S9', 'Prebenjamí S8', 'Prebenjamí S7', 'Escuela'];
  for (const r of rows) assert.equal(teamPlaysF7({ category: r.value }), F7_GROUPS.includes(r.group), `${r.group} · ${r.value}`);
}

// Formato del partido: manda la etapa del equipo, aunque el partido venga marcado como F11 (pasaba con los de S12 sincronizados con la FCF)
const s12 = T('Aleví S12 A');
assert.equal(matchFormat({ football_format: 'f11' }, s12), 'f7');
assert.equal(matchFormat({}, s12), 'f7');
assert.equal(matchFormat({ football_format: 'f7' }, s12), 'f7');
// equipos de F11 o sin equipo: el del partido (por defecto, F11)
const inf = T('Infantil S13 A');
assert.equal(matchFormat({ football_format: 'f11' }, inf), 'f11');
assert.equal(matchFormat({}, inf), 'f11');
assert.equal(matchFormat({ football_format: 'f7' }, inf), 'f7');
assert.equal(matchFormat({ football_format: 'f5' }, inf), 'f5');
assert.equal(matchFormat({ football_format: 'f7' }, null), 'f7');
assert.equal(matchFormat(undefined, undefined), 'f11');

// Jugadores mínimos para dar por completa la convocatoria y la alineación
assert.equal(minPlayersOf({ football_format: 'f11' }, s12), 7);
assert.equal(minPlayersOf({}, s12), 7);
assert.equal(minPlayersOf({ football_format: 'f11' }, inf), 11);
assert.equal(minPlayersOf({ football_format: 'f7' }, null), 7);
assert.equal(minPlayersOf({ football_format: 'f5' }, null), 5);
assert.equal(minPlayersOf({}, null), 11);

console.log('matchFormat OK');
