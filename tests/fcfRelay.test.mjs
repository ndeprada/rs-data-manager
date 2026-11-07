import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { bookmarkletCode } from '../src/lib/fcfRelay.js';
import { keyMatches, relayKeyFor } from '../api/_lib/fcfRelayKey.js';

// El programa que carga el marcador (public/fcf-relay.js), en modo prueba: solo expone sus piezas
const ctx = { window: { __rsRelayTest: true }, URL, Set, Array, JSON, Math, Promise, Error, String };
ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../public/fcf-relay.js', import.meta.url), 'utf8'), ctx);
const { runRelay, chunkItems } = ctx.__rsRelayLib;

// Servidor simulado: necesita el club; después, el detalle de dos equipos; luego termina. Las clasificaciones, en una vuelta.
const store = new Map();
const need = {
  sync: () => (!store.has('club') ? ['club'] : ['t1', 't2'].filter((u) => !store.has(u))),
  standings: () => ['c1'].filter((u) => !store.has(u)),
};
const post = async (mode, body) => {
  if (mode === 'put') { for (const it of body.items) store.set(it.url, it.body); return { saved: body.items.length }; }
  const miss = need[mode]().filter((u) => !(body.skip || []).includes(u));
  return miss.length ? { done: false, missing: miss } : { done: true, stats: { mode } };
};
// La web de la FCF da todo menos t2 (404)
const fetchUrls = async (urls) => urls.map((u) => (u === 't2' ? { url: u, status: 404 } : { url: u, body: { u } }));
const steps = [];
const r = await runRelay({ post, fetchUrls, onStep: (s) => steps.push(s) });
assert.equal(r.sync.mode, 'sync');
assert.equal(r.standings.mode, 'standings');
assert.deepEqual([...r.skipped], ['t2'], 'lo que la FCF no da no se espera');
assert.ok(store.has('club') && store.has('t1') && store.has('c1'));
assert.ok(steps.some((s) => s.phase === 'fcf'));

// Si el servidor pide siempre lo mismo sin poder avanzar, se para
await assert.rejects(() => runRelay({ post: async () => ({ done: false, missing: ['x'] }), fetchUrls: async () => [{ url: 'x', body: {} }] }), /no termina/);
// Si la web de la FCF no devuelve nada en la primera vuelta, se avisa
await assert.rejects(() => runRelay({ post: async () => ({ done: false, missing: ['x'] }), fetchUrls: async () => [] }), /no ha devuelto/);

// Trozos para no pasar del tamaño de una petición
const items = Array.from({ length: 10 }, (_, i) => ({ url: `u${i}`, body: { s: 'x'.repeat(100) } }));
const ch = chunkItems(items, 400);
assert.ok(ch.length > 1 && ch.flat().length === 10 && ch.every((c) => JSON.stringify(c).length < 800));

// El marcador: una dirección javascript: con la app y la llave dentro, que solo trabaja en fcf.cat
const code = decodeURIComponent(bookmarkletCode('https://rs-dm.vercel.app/', 'u1.abc').slice('javascript:'.length));
assert.ok(code.includes('"https://rs-dm.vercel.app"') && code.includes('"u1.abc"') && code.includes('/fcf-relay.js'));
assert.ok(code.includes('fcf\\.cat'));
assert.doesNotThrow(() => new Function(code), 'el marcador es JavaScript válido');

// La llave: de su dueño y de su versión
const u = { id: 'user-1' };
const k = relayKeyFor(u);
assert.ok(keyMatches(k, u));
assert.ok(!keyMatches(k, { id: 'user-2' }), 'no vale para otro usuario');
assert.ok(!keyMatches(k, { id: 'user-1', fcf_relay_v: 2 }), 'subir la versión anula las llaves anteriores');
assert.ok(!keyMatches(k.slice(0, -1) + (k.endsWith('A') ? 'B' : 'A'), u), 'una firma cambiada no vale');
assert.ok(!keyMatches('', u) && !keyMatches('sinpunto', u));
console.log('fcfRelay OK');
