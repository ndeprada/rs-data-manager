process.env.DATABASE_URL ||= 'postgres://x:x@localhost:5432/x';
import assert from 'node:assert/strict';
const { getJson } = await import('../api/_lib/fcfStandings.js');

let calls = 0, fail = false;
globalThis.fetch = async (url) => {
  calls++;
  await new Promise((r) => setTimeout(r, 10));
  if (fail) return { ok: false, status: 500, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => ({ data: [{ url: String(url) }] }) };
};

// Dos peticiones iguales a la vez comparten una sola consulta, y la siguiente sale de la memoria
const [a, b] = await Promise.all([getJson('classificacio?grupId=1'), getJson('classificacio?grupId=1')]);
assert.equal(calls, 1);
assert.deepEqual(a, b);
await getJson('classificacio?grupId=1');
assert.equal(calls, 1, 'la segunda vez sale de la memoria');

// Otro grupo es otra consulta
await getJson('classificacio?grupId=2');
assert.equal(calls, 2);

// Lo que no es clasificación (resultados, goleadores…) nunca se guarda
await getJson('partidos?grupId=1&jornada=1');
await getJson('partidos?grupId=1&jornada=1');
assert.equal(calls, 4);

// Un error no se queda guardado
fail = true;
await assert.rejects(() => getJson('classificacio?grupId=3'), /FCF 500/);
fail = false;
const ok = await getJson('classificacio?grupId=3');
assert.equal(ok[0].url.endsWith('classificacio?grupId=3'), true);
