// Cómo se piden los datos a la API pública de la FCF (solo lectura). Un único sitio para la sincronización, las clasificaciones y el informe de rival.
//
// Historia:
// - Octubre de 2026: la protección de la web de la FCF (CloudFront) empezó a contestar 403 a las peticiones que solo llevaban User-Agent y
//   «Accept: application/json»; con cabeceras de navegador volvió a contestar 200 (FCF_HEADERS).
// - Noviembre de 2026 (web nueva de la FCF): contesta 403 «Request blocked» a TODA petición a /api/ que llegue desde servidores (Vercel/Amazon),
//   con cualquier cabecera. Desde un navegador normal, en la propia web de la FCF, sí contesta. Por eso ahora los datos los trae el navegador
//   de quien pulsa «Actualizar desde la FCF» (relevo: ver src/lib/fcfRelay.js) y el servidor los guarda en la tabla fcf_web_cache.
//
// fcfJson(url):
//   - Dentro de un relevo (withRelay): solo lee lo que el navegador ha traído en los últimos minutos; lo que falta se apunta en `missing`
//     y se lanza FcfMissing (el navegador lo trae y se vuelve a pedir).
//   - Fuera de un relevo: caché reciente → la FCF directamente → caché más antigua (si se permite) → FcfBlocked.
import { AsyncLocalStorage } from 'node:async_hooks';
import { query } from './db.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export const FCF_HEADERS = {
  'user-agent': UA,
  accept: 'application/json, text/plain, */*',
  'accept-language': 'ca-ES,ca;q=0.9,es;q=0.8,en;q=0.7',
  referer: 'https://www.fcf.cat/',
  origin: 'https://www.fcf.cat',
};

export const fcfFetch = (url) => fetch(url, { headers: FCF_HEADERS });

export const FCF_API = 'https://www.fcf.cat/api/';
/** Dirección guardada: siempre con www (el navegador puede estar en fcf.cat sin www) */
export const canonicalFcfUrl = (u) => {
  const s = String(u || '').trim();
  const m = s.match(/^https:\/\/(?:www\.)?fcf\.cat\/api\/([^\s#]{1,280})$/);
  return m ? FCF_API + m[1] : null;
};

export class FcfMissing extends Error {
  constructor(url) { super(`Falta traer de la FCF: ${url}`); this.code = 'fcf_missing'; this.url = url; }
}
export class FcfBlocked extends Error {
  constructor(url) { super('La FCF no deja que el servidor lea sus datos: hay que actualizar desde el navegador («Actualizar desde la FCF»)'); this.code = 'fcf_blocked'; this.url = url; }
}
export const isFcfBlocked = (e) => e?.code === 'fcf_blocked' || e?.code === 'fcf_missing';

// ── Relevo ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const relay = new AsyncLocalStorage();
export const relayContext = () => relay.getStore() || null;
export const RELAY_FRESH_MS = 30 * 60 * 1000;

/** Ejecuta fn dentro de un relevo: devuelve { out, error, missing } (lo que falta, sin repetir). */
export async function withRelay(fn, { maxAge = RELAY_FRESH_MS } = {}) {
  const ctx = { missing: new Set(), maxAge };
  return relay.run(ctx, async () => {
    try { return { out: await fn(), error: null, missing: [...ctx.missing] }; }
    catch (e) { return { out: null, error: e, missing: [...ctx.missing] }; }
  });
}

// ── Caché (tabla propia) ─────────────────────────────────────────────────────────────────────────────────────────────
let store = {
  ready: null,
  async ensure() {
    if (!this.ready) this.ready = query(`create table if not exists fcf_web_cache (url text primary key, body jsonb not null, fetched_at timestamptz not null default now())`).catch((e) => { this.ready = null; throw e; });
    return this.ready;
  },
  async get(url, maxAgeMs) {
    await this.ensure();
    const r = await query(`select body from fcf_web_cache where url = $1 and fetched_at > now() - ($2::bigint * interval '1 millisecond')`, [url, Math.round(maxAgeMs)]);
    return r.rows.length ? r.rows[0].body : undefined;
  },
  async put(items) {
    await this.ensure();
    if (!items.length) return 0;
    await query(
      `insert into fcf_web_cache (url, body, fetched_at)
       select x.url, x.body, now() from jsonb_to_recordset($1::jsonb) as x(url text, body jsonb)
       on conflict (url) do update set body = excluded.body, fetched_at = now()`,
      [JSON.stringify(items)]
    );
    return items.length;
  },
};
/** Para las pruebas: otro almacén (en memoria) */
export const _setStore = (s) => { store = s; };

/** Guarda lo que ha traído el navegador. Solo direcciones de la API de la FCF y respuestas válidas. */
export async function saveRelayItems(items) {
  const ok = [];
  for (const it of Array.isArray(items) ? items : []) {
    const url = canonicalFcfUrl(it?.url);
    if (!url || it.body === undefined || it.body === null || typeof it.body !== 'object') continue;
    ok.push({ url, body: it.body });
  }
  return store.put(ok);
}

// Si la FCF acaba de contestar 403, no se vuelve a probar en un rato (cada intento es una espera inútil)
let blockedUntil = 0;
const BLOCK_PAUSE_MS = 10 * 60 * 1000;
export const _resetBlocked = () => { blockedUntil = 0; };

/**
 * Lee una dirección de la API de la FCF (devuelve el JSON tal cual).
 * @param {string} url  dirección completa (https://www.fcf.cat/api/…)
 * @param {{ fresh?: number, stale?: number }} opts  fresh: caché que vale sin preguntar a la FCF; stale: caché que vale si la FCF no contesta
 */
export async function fcfJson(url, { fresh = 0, stale = 0 } = {}) {
  const key = canonicalFcfUrl(url) || url;
  const ctx = relayContext();
  if (ctx) {
    const hit = await store.get(key, ctx.maxAge).catch(() => undefined);
    if (hit !== undefined) return hit;
    ctx.missing.add(key);
    throw new FcfMissing(key);
  }
  if (fresh > 0) {
    const hit = await store.get(key, fresh).catch(() => undefined);
    if (hit !== undefined) return hit;
  }
  if (Date.now() >= blockedUntil) {
    let r = null;
    try { r = await fcfFetch(key); } catch { r = null; }
    if (r?.ok) {
      const j = await r.json();
      store.put([{ url: key, body: j }]).catch(() => {});
      return j;
    }
    if (r && r.status !== 403) throw new Error(`FCF ${r.status} en ${key}`);
    blockedUntil = Date.now() + BLOCK_PAUSE_MS;
  }
  if (stale > 0) {
    const hit = await store.get(key, stale).catch(() => undefined);
    if (hit !== undefined) return hit;
  }
  throw new FcfBlocked(key);
}
