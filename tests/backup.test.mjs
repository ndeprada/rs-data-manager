import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { createBackup, listBackups, getBackupGz, parseGz, restoreSnapshot, snapshotNow, KEEP } from '../api/_lib/backup.js';

const pg = new PGlite();
await pg.exec(`create table entities (id uuid primary key default gen_random_uuid(), entity_type text not null, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());`);
const db = { query: (t, p) => pg.query(t, p), tx: (fn) => pg.transaction((tx) => fn({ query: (t, p) => tx.query(t, p) })) };
const add = async (type, data) => (await pg.query(`insert into entities (entity_type, data) values ($1, $2::jsonb) returning id`, [type, JSON.stringify(data)])).rows[0].id;
const count = async (type) => (await pg.query(`select count(*)::int n from entities where entity_type=$1`, [type])).rows[0].n;

const p1 = await add('Player', { first_name: 'Ana', note: 'tilde á ñ 🩹' });
const p2 = await add('Player', { first_name: 'Beto' });
const e1 = await add('Event', { title: 'L1', score_home: 3 });
await add('PushSubscription', { endpoint: 'secreto', keys: { p256dh: 'x' } });
await add('PushConfig', { privateKey: 'secreto' });

// 1) La copia no incluye claves de avisos y lo demás está completo
const b = await createBackup(db, { kind: 'manual', note: 'prueba' });
assert.equal(b.entity_count, 3);
const row = await getBackupGz(db, b.id);
const snap = await parseGz(row.data);
assert.equal(snap.entities.length, 3);
assert.ok(!JSON.stringify(snap).includes('secreto'), 'no debe incluir claves');
assert.equal(snap.counts.Player, 2);
assert.equal(snap.entities.find((r) => r.id === p1).data.note, 'tilde á ñ 🩹');

// 2) Desastre: se borra un jugador, se cambia otro y se borra un evento
await pg.query(`delete from entities where id=$1`, [p2]);
await pg.query(`update entities set data = '{"first_name":"CAMBIADO"}'::jsonb where id=$1`, [p1]);
await pg.query(`delete from entities where id=$1`, [e1]);
// y aparece un jugador nuevo que no estaba en la copia
const pNew = await add('Player', { first_name: 'Nuevo' });

// 3) Restaurar solo Player en modo merge: recupera Beto y deja a Ana como estaba; no borra al nuevo; el evento sigue borrado
let r = await restoreSnapshot(db, snap, { types: ['Player'] });
assert.equal(r.restored, 2);
assert.equal((await pg.query(`select data from entities where id=$1`, [p1])).rows[0].data.first_name, 'Ana');
assert.equal((await pg.query(`select data from entities where id=$1`, [p2])).rows[0].data.first_name, 'Beto');
assert.equal(await count('Player'), 3);
assert.equal(await count('Event'), 0);

// 4) Con replace elimina el que no existía
r = await restoreSnapshot(db, snap, { types: ['Player'], replace: true });
assert.equal(r.deleted, 1);
assert.equal(await count('Player'), 2);
assert.equal((await pg.query(`select 1 from entities where id=$1`, [pNew])).rows.length, 0);

// 5) Restauración completa devuelve el evento y no toca lo excluido
r = await restoreSnapshot(db, snap);
assert.equal(await count('Event'), 1);
assert.equal(await count('PushSubscription'), 1);

// 6) Retención: solo se guardan las KEEP.auto últimas automáticas
for (let i = 0; i < KEEP.auto + 4; i++) await createBackup(db, { kind: 'auto' });
const list = await listBackups(db);
assert.equal(list.filter((x) => x.kind === 'auto').length, KEEP.auto);
assert.equal(list.filter((x) => x.kind === 'manual').length, 1);

// 7) Una restauración que falla a mitad no deja nada a medias
const bad = { ...snap, entities: [...snap.entities, { id: 'no-es-uuid', entity_type: 'X', data: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] };
await pg.query(`update entities set data = '{"first_name":"CAMBIADO2"}'::jsonb where id=$1`, [p1]);
await assert.rejects(() => restoreSnapshot(db, bad, { types: ['Player', 'X'] }));
assert.equal((await pg.query(`select data from entities where id=$1`, [p1])).rows[0].data.first_name, 'CAMBIADO2', 'la transacción debe deshacerse entera');

