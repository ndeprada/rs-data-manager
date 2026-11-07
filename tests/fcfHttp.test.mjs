process.env.DATABASE_URL ||= 'postgres://x:x@localhost:5432/x'; // los módulos abren un pool perezoso: nunca llega a conectar en este test
import assert from 'node:assert/strict';

// La FCF (CloudFront) contesta 403 si la petición no lleva cabeceras de navegador: toda consulta a su API debe llevarlas.
const calls = [];
let status = 200;
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url: String(url), headers: Object.fromEntries(Object.entries(opts.headers || {}).map(([k, v]) => [k.toLowerCase(), v])) });
  return new Response(JSON.stringify({ data: [{ value: 1 }] }), { status, headers: { 'content-type': 'application/json' } });
};

const H = await import('../api/_lib/fcfHttp.js');
const { FCF_HEADERS } = H;
// Almacén en memoria en lugar de la tabla fcf_web_cache
const mem = new Map();
H._setStore({
  async get(url, maxAge) { const h = mem.get(url); return h && Date.now() - h.t <= maxAge ? h.body : undefined; },
  async put(items) { for (const it of items) mem.set(it.url, { body: it.body, t: Date.now() }); return items.length; },
});
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

// La FCF bloquea al servidor (403): se avisa con un error propio y no se vuelve a probar en un rato
status = 403;
mem.clear();
await assert.rejects(() => getFcfJson('https://www.fcf.cat/api/clubs/40493342'), (e) => e.code === 'fcf_blocked');
const n = calls.length;
await assert.rejects(() => getFcfJson('https://www.fcf.cat/api/clubs/1'), (e) => e.code === 'fcf_blocked');
assert.equal(calls.length, n, 'tras un 403 no se insiste enseguida');
// Otros errores siguen diciendo el código y la dirección
H._resetBlocked();
status = 500;
await assert.rejects(() => getFcfJson('https://www.fcf.cat/api/clubs/40493342'), /^Error: FCF 500 en https:\/\/www\.fcf\.cat\/api\/clubs\/40493342$/);

// Relevo desde el navegador: lo que falta se apunta; lo traído vale
status = 403; H._resetBlocked();
const before = calls.length;
const r1 = await H.withRelay(() => getFcfJson('https://www.fcf.cat/api/clubs/40493342'));
assert.deepEqual(r1.missing, ['https://www.fcf.cat/api/clubs/40493342']);
assert.equal(r1.error.code, 'fcf_missing');
assert.equal(calls.length, before, 'dentro del relevo no se pregunta a la FCF');
// el navegador puede estar en fcf.cat sin www; direcciones de fuera de la API no se guardan
assert.equal(await H.saveRelayItems([
  { url: 'https://fcf.cat/api/clubs/40493342', body: { data: { teams: [1, 2] } } },
  { url: 'https://evil.example/api/x', body: { a: 1 } },
  { url: 'https://www.fcf.cat/api/competition/temporadas', body: null },
]), 1);
const r2 = await H.withRelay(() => getFcfJson('https://www.fcf.cat/api/clubs/40493342'));
assert.deepEqual(r2.out, { teams: [1, 2] });
assert.deepEqual(r2.missing, []);
// varias que faltan a la vez se apuntan todas (una sola vuelta)
const r3 = await H.withRelay(() => Promise.allSettled(['a', 'b', 'a'].map((x) => getFcfJson(`https://www.fcf.cat/api/acta/${x}`))));
assert.deepEqual(r3.missing.sort(), ['https://www.fcf.cat/api/acta/a', 'https://www.fcf.cat/api/acta/b']);
// fuera del relevo, la clasificación usa lo traído (la FCF no contesta)
await H.saveRelayItems([{ url: 'https://www.fcf.cat/api/competition/classificacio?grupId=9', body: { data: [{ position: 1 }] } }]);
assert.deepEqual(await compJson('classificacio?grupId=9'), [{ position: 1 }]);
assert.equal(H.canonicalFcfUrl('https://fcf.cat/api/acta/1?x=2'), 'https://www.fcf.cat/api/acta/1?x=2');
assert.equal(H.canonicalFcfUrl('https://www.fcf.cat/ca/clubs'), null);

console.log('fcfHttp OK');
