import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readConfig, tokenFor, tokenMatches, rotateToken, buildIcs, feedFor } from '../api/_lib/ics.js';

const pg = new PGlite();
await pg.exec(`create table entities (id uuid primary key default gen_random_uuid(), entity_type text not null, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());`);
const db = { query: (t, p) => pg.query(t, p) };
const add = async (type, data) => (await pg.query(`insert into entities (entity_type, data) values ($1, $2::jsonb) returning id`, [type, JSON.stringify(data)])).rows[0].id;

const t1 = await add('Team', { name: 'Aleví S11 A' });
const t2 = await add('Team', { name: 'Otro' });
await add('Event', { team_id: t1, type: 'entrenamiento', title: 'Entrenamiento', date: '2026-11-03T19:00', end_date: '2026-11-03T20:30', location: 'Teixonera, "campo; 2"' });
const m = await add('Event', { team_id: t1, type: 'partido_liga', title: 'J2 · Sant Andreu, U.E "B" vs Aleví S11 A', date: '2026-11-04T19:00', opponent: 'Sant Andreu, U.E "B"', is_home: false, fcf_competition: 'PRIMERA DIVISIÓ ALEVÍ S11', fcf_group: 'GRUP 6', fcf_jornada: 2, notes: 'NOTA PRIVADA', location: 'Camp de Futbol Mpal. Baró de Viver con un nombre bastante largo para obligar a partir la línea del calendario' });
await add('Event', { team_id: t1, type: 'partido_liga', title: 'Aplazado', date: '2026-10-04T09:00', postponed: true });
await add('Event', { team_id: t2, type: 'entrenamiento', title: 'De otro equipo', date: '2026-11-03T19:00' });
await add('Event', { team_id: t1, type: 'entrenamiento', title: 'Sin fecha' });

// 1) Secreto único y estable
const c1 = await readConfig(db), c2 = await readConfig(db);
assert.equal(c1.secret, c2.secret);
assert.equal((await pg.query(`select count(*)::int n from entities where entity_type='IcsConfig'`)).rows[0].n, 1);
const tok = tokenFor(c1, t1);
assert.equal(tok.length, 32);
assert.notEqual(tok, tokenFor(c1, t2));
assert.ok(tokenMatches(c1, t1, tok));
assert.ok(!tokenMatches(c1, t1, tok.slice(0, 31) + 'x'));
assert.ok(!tokenMatches(c1, t2, tok));

// 2) Calendario: solo ese equipo, sin aplazados ni sin fecha, sin notas
const feed = await feedFor(db, t1, tok, 'https://rs-dm.vercel.app');
assert.equal(feed.count, 2);
const txt = feed.text;
assert.ok(txt.startsWith('BEGIN:VCALENDAR\r\n') && txt.endsWith('END:VCALENDAR\r\n'));
assert.ok(!txt.includes('NOTA PRIVADA') && !txt.includes('De otro equipo') && !txt.includes('Aplazado') && !txt.includes('Sin fecha'));
assert.ok(txt.includes('DTSTART;TZID=Europe/Madrid:20261103T190000'));
assert.ok(txt.includes('DTEND;TZID=Europe/Madrid:20261103T203000'));
assert.ok(txt.includes('DTEND;TZID=Europe/Madrid:20261104T210000'), 'partido sin fin = 2 h');
assert.ok(txt.includes('LOCATION:Teixonera\\, "campo\\; 2"'));
assert.ok(txt.includes(`UID:${m}@rsdm`));
assert.ok(txt.replace(/\r\n /g, '').includes(`https://rs-dm.vercel.app/MatchDetail?id=${m}`));
for (const line of txt.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, 'línea larga: ' + line);
// desplegando las líneas partidas, el texto largo se recompone
assert.ok(txt.replace(/\r\n /g, '').includes('un nombre bastante largo para obligar a partir la línea del calendario'));
assert.ok(txt.includes('X-WR-CALNAME:Aleví S11 A · Racing Sarrià'));

// 3) Código malo o equipo inventado: nada
assert.equal(await feedFor(db, t1, 'mal', 'x'), null);
assert.equal(await feedFor(db, '00000000-0000-0000-0000-000000000000', tok, 'x'), null);
assert.equal(await feedFor(db, "'; drop table entities; --", tok, 'x'), null);

// 4) Cambiar el enlace: el viejo deja de valer, el de otro equipo no cambia
const tok2Before = tokenFor(c1, t2);
const c3 = await rotateToken(db, t1);
assert.equal(await feedFor(db, t1, tok, 'x'), null);
assert.ok(await feedFor(db, t1, tokenFor(c3, t1), 'x'));
assert.equal(tokenFor(c3, t2), tok2Before);
const c4 = await rotateToken(db, t1);
assert.equal(c4.revs[t1], 2);
assert.equal((await pg.query(`select count(*)::int n from entities where entity_type='IcsConfig'`)).rows[0].n, 1);



