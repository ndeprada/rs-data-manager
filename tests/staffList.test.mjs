import assert from 'node:assert/strict';
import { ageOf, sortStaffRows } from '../src/lib/staffList.js';

const today = new Date(2026, 9, 20); // 20-oct-2026

// Edad: antes y después del cumpleaños
assert.deepEqual(ageOf('1990-10-20', today), { age: 36, year: 1990 });   // cumple hoy
assert.deepEqual(ageOf('1990-10-21', today), { age: 35, year: 1990 });   // mañana
assert.deepEqual(ageOf('1990-01-05', today), { age: 36, year: 1990 });
assert.deepEqual(ageOf('1990-12-31T00:00:00.000Z', today), { age: 35, year: 1990 }); // formato ISO
// Sin fecha o inverosímil → null
for (const bad of [null, undefined, '', 'abc', '1850-01-01', '2030-01-01', '1990-13-01']) assert.equal(ageOf(bad, today), null, String(bad));

const rows = [
  { name: 'Marta Soler', age: 41, roleLabel: 'Entrenador', teamRank: 3, teamName: 'Cadet S16 A' },
  { name: 'Álex Puig', age: null, roleLabel: 'Prep. Físico', teamRank: 1, teamName: 'Juvenil A' },
  { name: 'Bruno Vila', age: 29, roleLabel: 'Entrenador', teamRank: null, teamName: '' },
  { name: 'Carla Roca', age: 29, roleLabel: 'Coord. F7', teamRank: 0, teamName: 'Primer Equipo' },
];
const names = (key, dir) => sortStaffRows(rows, key, dir).map((r) => r.name);

// Nombre sin distinguir tildes
assert.deepEqual(names('name', 'asc'), ['Álex Puig', 'Bruno Vila', 'Carla Roca', 'Marta Soler']);
assert.deepEqual(names('name', 'desc'), ['Marta Soler', 'Carla Roca', 'Bruno Vila', 'Álex Puig']);
// Edad: los vacíos siempre al final y el empate (29) se resuelve por nombre
assert.deepEqual(names('age', 'asc'), ['Bruno Vila', 'Carla Roca', 'Marta Soler', 'Álex Puig']);
assert.deepEqual(names('age', 'desc'), ['Marta Soler', 'Bruno Vila', 'Carla Roca', 'Álex Puig']);
// Equipo: por el orden del club (Primer Equipo antes que Juvenil…), sin equipo al final
assert.deepEqual(names('team', 'asc'), ['Carla Roca', 'Álex Puig', 'Marta Soler', 'Bruno Vila']);
assert.deepEqual(names('team', 'desc'), ['Marta Soler', 'Álex Puig', 'Carla Roca', 'Bruno Vila']);
// Rol: alfabético; entre dos «Entrenador», por nombre
assert.deepEqual(names('role', 'asc'), ['Carla Roca', 'Bruno Vila', 'Marta Soler', 'Álex Puig']);
// No modifica la lista original
assert.equal(rows[0].name, 'Marta Soler');
