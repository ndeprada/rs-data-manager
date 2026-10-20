import assert from 'node:assert/strict';
import * as client from '../src/lib/registration.js';
import * as server from '../api/_lib/registration.js';

const today = new Date(2026, 9, 20); // 20-oct-2026
const ok = { first_name: 'María José', last_name: 'López Pérez', birth_date: '1990-05-12', phone: '+34 600 111 222' };

// Las mismas reglas en cliente y servidor
for (const [name, fn] of [['cliente', client.invalidStaffFields], ['servidor', server.invalidStaffFields]]) {
  const bad = (patch) => fn({ ...ok, ...patch }, today);
  assert.deepEqual(bad({}), [], `${name}: datos correctos`);
  assert.deepEqual(fn({}, today), ['first_name', 'last_name', 'birth_date', 'phone'], `${name}: todo vacío`);
  assert.deepEqual(fn(null, today), ['first_name', 'last_name', 'birth_date', 'phone'], `${name}: sin datos`);
  // Nombre y apellidos: sin espacios sueltos y al menos 2 letras
  assert.deepEqual(bad({ first_name: '   ' }), ['first_name'], name);
  assert.deepEqual(bad({ first_name: 'A' }), ['first_name'], name);
  assert.deepEqual(bad({ last_name: '' }), ['last_name'], name);
  // Fecha: formato, calendario real y edad creíble
  assert.deepEqual(bad({ birth_date: '12/05/1990' }), ['birth_date'], name);
  assert.deepEqual(bad({ birth_date: '1990-02-31' }), ['birth_date'], name);
  assert.deepEqual(bad({ birth_date: '2030-01-01' }), ['birth_date'], name);
  assert.deepEqual(bad({ birth_date: '2020-01-01' }), ['birth_date'], name);   // 6 años
  assert.deepEqual(bad({ birth_date: '1900-01-01' }), ['birth_date'], name);   // 126 años
  assert.deepEqual(bad({ birth_date: '2012-10-20' }), [], `${name}: cumple 14 hoy`);
  assert.deepEqual(bad({ birth_date: '2012-10-21' }), ['birth_date'], `${name}: cumple 14 mañana`);
  // Teléfono: 9-15 cifras, formatos habituales y nada de letras
  for (const p of ['600111222', '+34 600 111 222', '600-11-12-22', '(93) 123 45 67', '0034600111222']) assert.deepEqual(bad({ phone: p }), [], `${name}: ${p}`);
  for (const p of ['', '12345', '600 abc 222', '60011122', '1234567890123456', '=600111222']) assert.deepEqual(bad({ phone: p }), ['phone'], `${name}: ${p}`);
}

// Utilidades del cliente
assert.deepEqual(client.splitFullName('  María José López  Pérez '), { first_name: 'María', last_name: 'José López Pérez' });
assert.deepEqual(client.splitFullName(''), { first_name: '', last_name: '' });
assert.equal(client.joinFullName(' María José ', ' López Pérez '), 'María José López Pérez');
assert.equal(client.joinFullName('Ana', ''), 'Ana');
