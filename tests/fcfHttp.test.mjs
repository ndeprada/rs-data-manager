process.env.DATABASE_URL ||= 'postgres://x:x@localhost:5432/x'; // los módulos abren un pool perezoso: nunca llega a conectar en este test
import assert from 'node:assert/strict';

// La FCF (CloudFront) contesta 403 si la petición no lleva cabeceras de navegador: toda consulta a su API debe llevarlas.
const calls = [];
let status = 200;
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url: String(url), headers: Object.fromEntries(Object.entries(opts.headers || {}).map(([k, v]) => [k.toLowerCase(), v])) });
  return new Response(JSON.stringify({ data: [{ value: 1 }] }), { status, headers: { 'content-type': 'application/json' } });
};

const { FCF_HEADERS } = await import('../api/_lib/fcfHttp.js');
const { getJson: compJson } = await import('../api/_lib/fcfStandings.js');
const { getFcfJson } = await import('../api/_lib/fcfSync.js');

const needed = (h) => {
  assert.match(h['user-agent'], /^Mozilla\/5\.0 .*Chrome/);
  assert.match(h.accept, /application\/json/);
  assert.ok(h['accept-language'], 'lleva Accept-Language');
  assert.equal(h.referer, 'https://www.fcf.cat/');
  assert.equal(h.origin, 'https://www.fcf.cat');
};

needed(FCF_HEADERS);

// Sincronización de plantillas, partidos y actas
assert.deepEqual(await getFcfJson('https://www.fcf.cat/api/clubs/40493342'), [{ value: 1 }]);
// Clasificaciones, grupos, partidos y goleadores (también usadas por el informe de rival)
assert.deepEqual(await compJson('temporadas'), [{ value: 1 }]);
assert.equal(calls.length, 2);
for (const c of calls) needed(c.headers);
assert.equal(calls[0].url, 'https://www.fcf.cat/api/clubs/40493342');
assert.equal(calls[1].url, 'https://www.fcf.cat/api/competition/temporadas');

// Los errores siguen diciendo el código y la dirección (así se ven en la pantalla de sincronización)
status = 403;
await assert.rejects(() => getFcfJson('https://www.fcf.cat/api/clubs/40493342'), /^Error: FCF 403 en https:\/\/www\.fcf\.cat\/api\/clubs\/40493342$/);
await assert.rejects(() => compJson('disciplines'), /^Error: FCF 403 disciplines$/);

console.log('fcfHttp OK');
