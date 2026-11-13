import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFields, selectData, parseGte, KEEP_KEYS } from '../api/_lib/entityQuery.js';

test('fields: solo claves seguras y siempre las de permisos', () => {
  assert.equal(parseFields(''), null);
  assert.equal(parseFields(undefined), null);
  const f = parseFields("date,team_id,x'; drop");
  assert.ok(f.includes('date') && f.includes('xdrop'));
  for (const k of KEEP_KEYS) assert.ok(f.includes(k));
  assert.equal(new Set(f).size, f.length);
  assert.match(selectData(['date']), /jsonb_build_object\('date', data -> 'date'\)/);
  assert.equal(selectData(null), 'data');
});

test('gte: objeto con texto', () => {
  assert.deepEqual(parseGte('{"date":"2026-10-14"}'), [['date', '2026-10-14']]);
  assert.deepEqual(parseGte('no'), []);
  assert.deepEqual(parseGte('[1]'), []);
  assert.deepEqual(parseGte('{"da-te":"","x":"1"}'), [['x', '1']]);
});
