import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { closeSeason, reopenSeason, seasonStatus, isSeason, nextSeason, seasonBounds } from '../api/_lib/season.js';

const pg = new PGlite();
await pg.exec(`create table entities (id uuid primary key default gen_random_uuid(), entity_type text not null, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());`);
let failOn = null;
const db = {
  query: (t, p) => pg.query(t, p),
  tx: (fn) => pg.transaction((tx) => fn({ query: (t, p) => { if (failOn && t.includes(failOn)) throw new Error('fallo simulado'); return tx.query(t, p); } })),
};
const add = async (type, data) => (await pg.query(`insert into entities (entity_type, data) values ($1, $2::jsonb) returning id`, [type, JSON.stringify(data)])).rows[0].id;
const all = async () => (await pg.query(`select id, entity_type, data from entities order by entity_type, id`)).rows;
const one = async (id) => (await pg.query(`select data from entities where id=$1`, [id])).rows[0]?.data;

// ── Datos inventados ──
const tA = await add('Team', { name: 'Sub-15', category: 'cadete', season: '2026-2027' });
const tB = await add('Team', { name: 'Sub-16', category: 'cadete', season: '2026-2027' });
const tC = await add('Team', { name: 'Sub-16B', category: 'cadete', season: '2026-2027' });
const P = {};
for (const [k, n, team, st] of [['a1','Ana',tA],['a2','Beto',tA],['a3','Cris',tA],['a4','Dani',tA],['a5','Edu',tA],['a6','Fer',tA],['b1','Gus',tB]]) P[k] = await add('Player', { first_name: n, last_name: 'X', team_id: team, status: 'activo', birth_year: 2011 });
P.lesionado = await add('Player', { first_name: 'Lola', last_name: 'X', team_id: tA, status: 'lesionado' });
P.yaBaja = await add('Player', { first_name: 'Yaba', last_name: 'X', team_id: tA, status: 'baja' });
const ev = {};
ev.liga1 = await add('Event', { type: 'partido_liga', team_id: tA, date: '2026-09-20T12:00', score_home: 3, score_away: 1, title: 'L1' });
ev.liga2 = await add('Event', { type: 'partido_liga', team_id: tA, date: '2027-03-07T12:00', score_home: 0, score_away: 2, title: 'L2' });
ev.liga3 = await add('Event', { type: 'partido_liga', team_id: tA, date: '2027-07-30T12:00', score_home: 1, score_away: 1, title: 'L3 ultimo dia' });
ev.amis = await add('Event', { type: 'partido_amistoso', team_id: tA, date: '2026-08-15T12:00', score_home: 5, score_away: 0, title: 'amistoso' });
ev.train = await add('Event', { type: 'entrenamiento', team_id: tA, date: '2026-10-05T19:00', title: 'entreno' });
ev.next = await add('Event', { type: 'partido_liga', team_id: tA, date: '2027-08-02T12:00', title: 'SIGUIENTE temporada' });
ev.prev = await add('Event', { type: 'partido_liga', team_id: tA, date: '2026-07-15T12:00', score_home: 9, score_away: 9, title: 'temporada anterior' });
await add('MatchStats', { event_id: ev.liga1, player_id: P.a1, minutes_played: 60, goals: 2, assists: 0, starter: true, yellow_cards: 1, rating: 7 });
await add('MatchStats', { event_id: ev.liga1, player_id: P.a2, minutes_played: 30, goals: 1, assists: 2, starter: false });
await add('MatchStats', { event_id: ev.liga2, player_id: P.a1, minutes_played: 70, goals: 0, assists: 1, starter: true, red_cards: 1, rating: 8 });
await add('MatchStats', { event_id: ev.amis, player_id: P.a1, minutes_played: 40, goals: 4, starter: true }); // amistoso: no cuenta en el historial
await add('MatchStats', { event_id: ev.next, player_id: P.a1, minutes_played: 10 });                          // siguiente temporada: no se toca
await add('TrainingAttendance', { event_id: ev.train, player_id: P.a1, status: 'present' });
await add('TrainingAttendance', { event_id: ev.train, player_id: P.a2, status: 'absent' });
await add('TrainingAttendance', { player_id: P.a1, date: '2026-11-03', status: 'apart' });                    // antigua, sin evento, dentro de temporada
await add('TrainingAttendance', { player_id: P.a1, date: '2027-09-03', status: 'present' });                  // antigua, temporada siguiente
await add('Convocatoria', { event_id: ev.liga1, player_ids: [P.a1, P.a2], starters: [P.a1] });
await add('Convocatoria', { event_id: ev.next, player_ids: [P.a1] });
await add('MatchPlan', { event_id: ev.liga2, notes: 'plan' });
const sm = await add('StaffMember', { first_name: 'Mister', last_name: 'Uno' });
await add('TeamStaffAssignment', { staff_member_id: sm, team_id: tA, team_role: 'primer_entrenador', active: true });
await add('PlayerSeasonHistory', { player_id: P.a3, season: '2026-2027', team_name: 'manual', source: 'manual' }); // ya hay registro manual: no se duplica

const plan = { season: '2026-2027', moves: {
  [P.a1]: { to: tB }, [P.a2]: { to: tB }, [P.a3]: { to: tB },
  [P.a4]: { to: 'baja' }, [P.a5]: { to: tC }, [P.a6]: { to: 'stay' },
  // lesionado y yaBaja sin decidir
} };
await add('SeasonPlan', plan);

const standings = { [tA]: { competition: 'Primera Cadete', group: 'G3', pos: 4, pts: 40, pj: 26, g: 12, e: 4, p: 10, gf: 50, gc: 40 } };
const before = await all();

// ── 1. dry-run no cambia nada ──
const dry = await closeSeason(db, { season: '2026-2027', standings, dry: true });
assert.equal(dry.dry, true);
assert.deepEqual((await all()).map(r => r.data), before.map(r => r.data), 'dry-run no debe cambiar datos');
assert.equal(dry.summary.moved, 4); assert.equal(dry.summary.bajas, 1); assert.equal(dry.summary.stay, 1); assert.equal(dry.summary.undecided, 2);
assert.equal(dry.archive.Event, 5); // liga1, liga2, liga3, amis, train (no next ni prev)

// ── 2. cierre ──
const res = await closeSeason(db, { season: '2026-2027', standings, userName: 'Nacho', now: new Date('2027-08-01T10:00:00Z') });
const E = (id) => one(id);
for (const k of ['liga1', 'liga2', 'liga3', 'amis', 'train']) assert.equal((await E(ev[k])).archived_season, '2026-2027', k);
assert.equal((await E(ev.next)).archived_season, undefined, 'siguiente temporada intacta');
assert.equal((await E(ev.prev)).archived_season, undefined, 'temporada anterior intacta');
const ms = (await pg.query(`select data from entities where entity_type='MatchStats' order by (data->>'minutes_played')::int`)).rows.map(r => r.data);
assert.equal(ms.filter(m => m.archived_season).length, 4); assert.equal(ms.filter(m => !m.archived_season).length, 1);
const ta = (await pg.query(`select data from entities where entity_type='TrainingAttendance'`)).rows.map(r => r.data);
assert.equal(ta.filter(m => m.archived_season).length, 3); // 2 con evento + antigua de nov-2026; la de sept-2027 queda
assert.equal(res.archived.TrainingAttendance, 3);
const cv = (await pg.query(`select data from entities where entity_type='Convocatoria'`)).rows.map(r => r.data);
assert.equal(cv.filter(m => m.archived_season).length, 1);
// jugadores
assert.equal((await E(P.a1)).team_id, tB); assert.equal((await E(P.a1)).previous_team_id, tA);
assert.equal((await E(P.a5)).team_id, tC);
assert.equal((await E(P.a4)).status, 'baja'); assert.equal((await E(P.a4)).archived_season, '2026-2027'); assert.equal((await E(P.a4)).last_team_id, tA);
assert.equal((await E(P.a6)).team_id, tA); assert.equal((await E(P.a6)).archived_season, undefined);
assert.equal((await E(P.lesionado)).team_id, tA); assert.equal((await E(P.yaBaja)).archived_season, undefined);
// historial de jugadores
const ph = (await pg.query(`select data from entities where entity_type='PlayerSeasonHistory'`)).rows.map(r => r.data);
const h1 = ph.find(h => h.player_id === P.a1);
assert.equal(h1.team_id, tA); assert.equal(h1.matches_played, 2); assert.equal(h1.matches_starter, 2); assert.equal(h1.minutes_played, 130);
assert.equal(h1.avg_rating, 7.5); assert.equal(h1.goals, 2); assert.equal(h1.assists, 1); assert.equal(h1.yellow_cards, 1); assert.equal(h1.red_cards, 1);
assert.equal(h1.training_sessions, 2); assert.equal(h1.training_present, 2); // present + apart(no ausente)
const h2 = ph.find(h => h.player_id === P.a2); assert.equal(h2.matches_sub, 1); assert.equal(h2.training_sessions, 1); assert.equal(h2.training_present, 0);
assert.equal(ph.filter(h => h.player_id === P.a3).length, 1, 'no se duplica el registro manual'); assert.equal(ph.find(h => h.player_id === P.a3).source, 'manual');
// equipos
const th = (await pg.query(`select data from entities where entity_type='TeamSeasonHistory'`)).rows.map(r => r.data);
assert.equal(th.length, 3);
const hA = th.find(t => t.team_id === tA);
assert.deepEqual(hA.standing, { pos: 4, pts: 40, pj: 26, g: 12, e: 4, p: 10, gf: 50, gc: 40 });
assert.deepEqual(hA.record, { pj: 3, g: 1, e: 1, p: 1, gf: 4, gc: 4, pts: 4 }); // liga1 3-1, liga2 0-2, liga3 1-1 (amistoso no cuenta)
assert.equal(hA.roster.length, 8); assert.equal(hA.staff[0].name, 'Mister Uno');
// equipos: temporada nueva
for (const t of [tA, tB, tC]) assert.equal((await E(t)).season, '2027-2028');
// registro
const close = (await pg.query(`select data from entities where entity_type='SeasonClose'`)).rows[0].data;
assert.equal(close.status, 'closed'); assert.equal(close.closed_by, 'Nacho');
// listado por defecto: simula el filtro del servidor
const visible = async (type) => (await pg.query(`select count(*)::int n from entities where entity_type=$1 and coalesce(data->>'archived_season','')=''`, [type])).rows[0].n;
assert.equal(await visible('Event'), 2); assert.equal(await visible('Player'), 8); // 9 jugadores - 1 baja archivada

// ── 3. estado ──
const st = await seasonStatus(db, '2026-2027');
assert.equal(st.closes.length, 1); assert.equal(st.archive.Event, 0, 'tras cerrar ya no queda nada por archivar');

// ── 4. no se puede cerrar dos veces ──
await assert.rejects(() => closeSeason(db, { season: '2026-2027' }), (e) => e.status === 409);

// ── 5. reabrir devuelve TODO como estaba ──
await reopenSeason(db, { season: '2026-2027' });
const after = await all();
const strip = (rows) => rows.filter(r => !['SeasonClose', 'TeamSeasonHistory'].includes(r.entity_type)).filter(r => !(r.entity_type === 'PlayerSeasonHistory' && r.data.source === 'cierre_temporada'));
const norm = (rows) => strip(rows).map(r => `${r.id}|${JSON.stringify(Object.fromEntries(Object.entries(r.data).sort()))}`).sort();
assert.deepEqual(norm(after), norm(before), 'tras reabrir los datos deben ser idénticos a los de antes de cerrar');
const closeAfter = (await pg.query(`select data from entities where entity_type='SeasonClose'`)).rows[0].data;
assert.equal(closeAfter.status, 'reopened');
await assert.rejects(() => reopenSeason(db, { season: '2026-2027' }), (e) => e.status === 404);

// ── 6. volver a cerrar tras reabrir ──
const again = await closeSeason(db, { season: '2026-2027', standings });
assert.equal(again.summary.moved, 4);
assert.equal((await pg.query(`select count(*)::int n from entities where entity_type='PlayerSeasonHistory' and data->>'source'='cierre_temporada'`)).rows[0].n, 8);
await reopenSeason(db, { season: '2026-2027' });

// ── 7. si algo falla a mitad, no queda nada a medias ──
failOn = `insert into entities (entity_type, data) select $1, x from jsonb_array_elements($2::jsonb) x returning id`;
let n = 0;
db.tx = ((orig) => (fn) => orig((t) => fn({ query: (q, p) => { if (q.includes('jsonb_array_elements') && ++n === 3) throw new Error('fallo simulado'); return t.query(q, p); } })))(((fn) => pg.transaction((tx) => fn(tx))));
failOn = null;
const snap = norm(await all());
await assert.rejects(() => closeSeason(db, { season: '2026-2027', standings }), /fallo simulado/);
assert.deepEqual(norm(await all()), snap, 'un fallo a mitad no debe dejar cambios');

// ── 8. helpers ──
assert.ok(isSeason('2026-2027')); assert.ok(!isSeason('2026-2028')); assert.equal(nextSeason('2026-2027'), '2027-2028');
assert.deepEqual(seasonBounds('2026-2027'), { from: '2026-08-01', to: '2027-08-01' });
await pg.close();
