import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { cleanDuplicates, findPlayerCopies, mergeData, meaningful } from '../api/_lib/dedupe.js';

const pg = new PGlite();
await pg.exec(`create table entities (id uuid primary key default gen_random_uuid(), entity_type text not null, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());`);
const db = { query: (t, p) => pg.query(t, p), tx: (fn) => pg.transaction((tx) => fn({ query: (t, p) => tx.query(t, p) })) };
let clock = 0;
const add = async (type, data) => (await pg.query(`insert into entities (entity_type, data, created_at, updated_at) values ($1, $2::jsonb, now() + ($3 || ' seconds')::interval, now() + ($3 || ' seconds')::interval) returning id`, [type, JSON.stringify(data), String(clock++)])).rows[0].id;
const get = async (id) => (await pg.query(`select data from entities where id=$1`, [id])).rows[0]?.data;
const count = async (type) => (await pg.query(`select count(*)::int n from entities where entity_type=$1`, [type])).rows[0].n;

// ── piezas sueltas ──
assert.equal(meaningful(0), false); assert.equal(meaningful(''), false); assert.equal(meaningful([]), false); assert.equal(meaningful({}), false);
assert.equal(meaningful(1), true); assert.equal(meaningful('x'), true); assert.equal(meaningful(true), true);
{
  const m = mergeData([
    { data: { minutes_played: 48, manual: true, goals: 1, notes: undefined, rating: undefined } },
    { data: { minutes_played: 0, goals: 1, notes: 'Muy buen partido', rating: 3 } },
  ]);
  assert.deepEqual([m.data.minutes_played, m.data.manual, m.data.goals, m.data.notes, m.data.rating], [48, true, 1, 'Muy buen partido', 3]);
  assert.deepEqual(m.conflicts, []);
  // Dos valores distintos con contenido: gana el más reciente y se avisa
  const c = mergeData([{ data: { goals: 1 } }, { data: { goals: 2 } }]);
  assert.equal(c.data.goals, 2); assert.equal(c.conflicts[0].field, 'goals');
}

// ── datos como los reales ──
const s9 = await add('Team', { name: 'Benjamí S9 A', season: '2026-2027' });
const s10 = await add('Team', { name: 'Benjamí S10 A', season: '2026-2027' });
const s10b = await add('Team', { name: 'Benjamí S10 B', season: '2026-2027' });
const viejo = await add('Team', { name: 'Antiguo', season: '2025-2026' });
const lucas = await add('Player', { first_name: 'Lucas', last_name: 'Gimeno Navarro', team_id: s9, status: 'activo', fcf_imported: true, birth_year: 2018, birth_date: '2018-06-13', jersey_number: 4 });
const lucasCopia = await add('Player', { first_name: 'Lucas', last_name: 'Gimeno Navarro', team_id: s10, status: 'activo', fcf_imported: true, jersey_number: 13 });
const marcel1 = await add('Player', { first_name: 'Marcel', last_name: 'De Haro Segarra', team_id: s10, status: 'activo', fcf_imported: true, birth_year: 2017 });
const marcel2 = await add('Player', { first_name: 'Marcel', last_name: 'De Haro Segarra', team_id: s10b, status: 'activo', fcf_imported: true, birth_year: 2017 });
const sab1 = await add('Player', { first_name: '', last_name: 'Sabir', team_id: s10, status: 'activo', fcf_imported: true });
const sab2 = await add('Player', { first_name: '', last_name: 'Sabir', team_id: s10, status: 'activo', fcf_imported: true });
const pepe = await add('Player', { first_name: 'Pepe', last_name: 'Trias De Bes', team_id: s9, status: 'activo', fcf_imported: true, birth_year: 2016 });
const pepeFicha = await add('Player', { first_name: 'Pepe', last_name: 'Trias De Bes', team_id: viejo, status: 'activo', fcf_imported: true }); // otra temporada: no se toca
const pau = await add('Player', { first_name: 'Pau', last_name: 'Mora', team_id: s9, status: 'activo', birth_year: 2018 });
const pauCopia = await add('Player', { first_name: 'Pau', last_name: 'Mora', team_id: s10, status: 'activo', fcf_imported: true, notes: 'ficha propia con datos' }); // tiene datos a mano: no se toca

const e9 = await add('Event', { title: 'J3 · Sant Andreu', type: 'partido_liga', team_id: s9, date: '2026-10-18T11:15' });
const e10 = await add('Event', { title: 'J3 · Can Buxeres', type: 'partido_liga', team_id: s10, date: '2026-10-17T10:00',
  match_events: [{ id: 'g1', type: 'goal', team: 'home', playerId: lucasCopia }], goal_events: [{ id: 'g1', player_id: lucasCopia }] });
const eSab = await add('Event', { title: 'Juvenil', type: 'partido_liga', team_id: s10, date: '2026-10-18T12:15' });

// Estadísticas: la fila con los minutos escritos a mano y la fila con la nota (el caso del domingo)
// (las filas editadas desde la pantalla traen copiados su id y sus fechas dentro de los datos)
const ms1 = await add('MatchStats', { event_id: e9, player_id: lucas, goals: 1, assists: 0, minutes_played: 48, manual: true, starter: true, id: 'viejo-1', created_date: '2026-10-18', updated_date: '2026-10-20' });
const ms2 = await add('MatchStats', { event_id: e9, player_id: lucas, goals: 1, assists: 0, minutes_played: 0, starter: true, notes: 'Muy buen partido', rating: 3 });
const msOtro = await add('MatchStats', { event_id: e9, player_id: pau, goals: 0 });          // sin duplicar
const msCopia = await add('MatchStats', { event_id: e10, player_id: lucasCopia, goals: 2, minutes_played: 30 });
const msS1 = await add('MatchStats', { event_id: eSab, player_id: sab1, goals: 0 });
const msS2 = await add('MatchStats', { event_id: eSab, player_id: sab2, goals: 0 });

// Convocatorias: idénticas, la editada a mano (más reciente) y con jugadores distintos
const cA1 = await add('Convocatoria', { event_id: e9, team_id: s9, player_ids: [lucas, pau], starters: [lucas], fcf_auto: true });
const cA2 = await add('Convocatoria', { event_id: e9, team_id: s9, player_ids: [pau, lucas], starters: [lucas], fcf_auto: true, notes: 'Quedamos a las 10', callup_time: '10:00', absence_reasons: { x: 'lesion' } });
const cB = await add('Convocatoria', { event_id: e10, team_id: s10, player_ids: [lucasCopia, marcel1], starters: [lucasCopia], fcf_auto: true });
const cS1 = await add('Convocatoria', { event_id: eSab, team_id: s10, player_ids: [sab1, marcel1], starters: [sab1], fcf_auto: true });
const cS2 = await add('Convocatoria', { event_id: eSab, team_id: s10, player_ids: [sab2, marcel1], starters: [sab2], fcf_auto: true });

// Quién es copia
const players = (await pg.query(`select id, data from entities where entity_type='Player'`)).rows;
const teams = (await pg.query(`select id, data from entities where entity_type='Team'`)).rows;
const pairs = findPlayerCopies(players, teams);
assert.deepEqual(pairs.map((p) => [p.keep.id, p.drop.id]), [[lucas, lucasCopia]], 'solo la copia pelada de la misma temporada');

// Vista previa: informa pero no cambia nada
const before = JSON.stringify((await pg.query(`select id, data from entities order by id`)).rows);
const prev = await cleanDuplicates(db, { dry: true });
assert.equal(prev.dry, true);
assert.equal(JSON.stringify((await pg.query(`select id, data from entities order by id`)).rows), before, 'la vista previa no toca nada');
assert.equal(prev.players.length, 1);
assert.equal(prev.players[0].name, 'Lucas Gimeno Navarro');
assert.deepEqual([prev.players[0].keep.team, prev.players[0].drop.team], ['Benjamí S9 A', 'Benjamí S10 A']);
assert.equal(prev.stats.groups, 1); assert.equal(prev.stats.deleted, 1);
assert.equal(prev.convocatorias.deleted, 1);
assert.equal(prev.convocatorias.skipped.length, 1);

// Aplicar
const done = await cleanDuplicates(db, { dry: false });
assert.equal(done.dry, false);

// La copia desaparece y todo apunta a la ficha original
assert.equal(await get(lucasCopia), undefined);
assert.ok(await get(lucas));
assert.deepEqual((await get(msCopia)).player_id, lucas);
assert.equal((await get(msCopia)).goals, 2, 'lo jugado con el Sub-10 A se conserva');
assert.equal((await get(msCopia)).event_id, e10, 'y sigue siendo del partido del Sub-10 A');
assert.equal((await get(e10)).match_events[0].playerId, lucas);
assert.equal((await get(e10)).goal_events[0].player_id, lucas);
assert.deepEqual((await get(cB)).player_ids, [lucas, marcel1]);
assert.deepEqual((await get(cB)).starters, [lucas]);
// Las dos filas de estadísticas del domingo quedan en una con todo lo escrito a mano
assert.equal(await get(ms1), undefined);
const merged = await get(ms2);
assert.deepEqual([merged.minutes_played, merged.manual, merged.notes, merged.rating, merged.goals, merged.starter], [48, true, 'Muy buen partido', 3, 1, true]);
assert.equal(merged.id, undefined, 'no se cuela el id de la fila borrada');
assert.equal(merged.created_date, undefined);
assert.deepEqual(prev.conflicts, [], 'el id y las fechas no cuentan como conflicto');
assert.ok(await get(msOtro));
// Convocatoria repetida: se queda la editada a mano, con sus notas
assert.equal(await get(cA1), undefined);
assert.equal((await get(cA2)).notes, 'Quedamos a las 10');
assert.deepEqual((await get(cA2)).absence_reasons, { x: 'lesion' });
// No se toca lo dudoso: jugadores con el mismo nombre en dos equipos, ficha con datos propios, otra temporada, y los Sabir
for (const id of [marcel1, marcel2, pepeFicha, pauCopia, sab1, sab2, msS1, msS2, cS1, cS2]) assert.ok(await get(id), 'sin tocar ' + id);
assert.equal(await count('Convocatoria'), 4);
assert.equal(await count('MatchStats'), 5);

// Segunda pasada: ya no queda nada que limpiar
const again = await cleanDuplicates(db, { dry: true });
assert.equal(again.players.length, 0); assert.equal(again.stats.deleted, 0); assert.equal(again.convocatorias.deleted, 0);
assert.equal(again.convocatorias.skipped.length, 1, 'lo de los Sabir sigue pendiente de decidir');

// Si falla algo a mitad, no queda a medias
await pg.query(`insert into entities (entity_type, data) values ('Player', '{"first_name":"Zoe","last_name":"Roca","team_id":"${s9}","status":"activo","fcf_imported":true,"birth_year":2018}')`);
const zoeCopia = await add('Player', { first_name: 'Zoe', last_name: 'Roca', team_id: s10, status: 'activo', fcf_imported: true });
const failing = { query: db.query, tx: (fn) => pg.transaction((tx) => fn({ query: (t, p) => { if (t.includes('delete from entities where id = any') && t.includes("entity_type = 'Player'")) throw new Error('fallo simulado'); return tx.query(t, p); } })) };
await assert.rejects(() => cleanDuplicates(failing, { dry: false }), /fallo simulado/);
assert.ok(await get(zoeCopia), 'la copia sigue ahí si la limpieza falla');
await pg.close();
