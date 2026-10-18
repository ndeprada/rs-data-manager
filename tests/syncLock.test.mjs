import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { acquireSyncLock, releaseSyncLock } from '../api/_lib/syncLock.js';

const pg = new PGlite();
await pg.exec(`create table entities (id uuid primary key default gen_random_uuid(), entity_type text not null, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());`);
const db = { query: (t, p) => pg.query(t, p) };
const rows = async () => (await pg.query(`select count(*)::int n from entities where entity_type='FcfSyncLock'`)).rows[0].n;

// La primera sincronización entra; mientras dure, ninguna otra
assert.equal(await acquireSyncLock(db), true);
assert.equal(await acquireSyncLock(db), false);
assert.equal(await acquireSyncLock(db), false);
// Dos intentos a la vez con el candado libre: solo uno gana
await releaseSyncLock(db);
const [a, b] = await Promise.all([acquireSyncLock(db), acquireSyncLock(db)]);
assert.equal([a, b].filter(Boolean).length, 1);
// Al terminar se libera y se puede volver a sincronizar
await releaseSyncLock(db);
assert.equal(await acquireSyncLock(db), true);
// Si una ejecución se corta sin liberar, el candado caduca solo a los 3 minutos
await pg.query(`update entities set data = jsonb_build_object('since', (now() - interval '4 minutes')::text) where entity_type='FcfSyncLock'`);
assert.equal(await acquireSyncLock(db), true);
assert.equal(await rows(), 1, 'siempre una única fila-candado');
await pg.close();
