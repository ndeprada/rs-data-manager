import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import {
  OK_INTERVAL_MS, FAIL_RETRY_MS, RUNNING_MS,
  shouldAutoSync, publicStatus, canUseAutoSync, readSyncStatus, runTrackedSync, runAutoSync,
} from '../api/_lib/syncStatus.js';
import { acquireSyncLock, releaseSyncLock } from '../api/_lib/syncLock.js';

const H = 60 * 60 * 1000;
const MIN = 60 * 1000;
const T0 = Date.parse('2026-10-24T10:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

// ── Cuándo toca sincronizar sola ──
assert.equal(shouldAutoSync(null, T0), true, 'sin ninguna sincronización anotada, toca');
assert.equal(shouldAutoSync({}, T0), true);
const ok = (agoMs) => ({ ok: true, in_progress: false, last_attempt_at: iso(T0 - agoMs - MIN), finished_at: iso(T0 - agoMs) });
assert.equal(shouldAutoSync(ok(2 * H + 59 * MIN), T0), false, 'una buena hace menos de 3 h: no toca');
assert.equal(shouldAutoSync(ok(3 * H), T0), false, 'justo 3 h: todavía no (tiene que pasar más)');
assert.equal(shouldAutoSync(ok(3 * H + MIN), T0), true, 'una buena hace más de 3 h: toca');
assert.equal(shouldAutoSync(ok(10 * MIN), T0), false);
const bad = (agoMs) => ({ ok: false, in_progress: false, last_attempt_at: iso(T0 - agoMs - MIN), finished_at: iso(T0 - agoMs), error: 'FCF 403' });
assert.equal(shouldAutoSync(bad(10 * MIN), T0), false, 'una fallida hace 10 min: no insistir');
assert.equal(shouldAutoSync(bad(FAIL_RETRY_MS + MIN), T0), true, 'una fallida hace más de 30 min: reintentar');
const running = (agoMs) => ({ in_progress: true, last_attempt_at: iso(T0 - agoMs) });
assert.equal(shouldAutoSync(running(MIN), T0), false, 'en marcha: no lanzar otra');
assert.equal(shouldAutoSync(running(10 * MIN), T0), false, 'cortada hace 10 min: esperar como tras un fallo');
assert.equal(shouldAutoSync(running(FAIL_RETRY_MS + MIN), T0), true, 'cortada hace más de 30 min: reintentar');
assert.ok(OK_INTERVAL_MS === 3 * H && FAIL_RETRY_MS === 30 * MIN && RUNNING_MS === 3 * MIN);

// ── Lo que ve la app ──
assert.equal(publicStatus(null, T0).state, 'never');
assert.equal(publicStatus({}, T0).state, 'never');
const pOk = publicStatus({ ...ok(H), source: 'auto', warnings: 2, stats: { matches_updated: 4 }, last_ok_at: iso(T0 - H), last_ok_source: 'auto' }, T0);
assert.deepEqual([pOk.state, pOk.source, pOk.at, pOk.warnings, pOk.error], ['ok', 'auto', iso(T0 - H), 2, null]);
const pBad = publicStatus({ ...bad(5 * MIN), source: 'manual', last_ok_at: iso(T0 - 5 * H), last_ok_source: 'noche' }, T0);
assert.deepEqual([pBad.state, pBad.error, pBad.last_ok_at, pBad.last_ok_source], ['failed', 'FCF 403', iso(T0 - 5 * H), 'noche']);
assert.equal(publicStatus(running(MIN), T0).state, 'running');
const cut = publicStatus(running(RUNNING_MS + MIN), T0);
assert.equal(cut.state, 'failed', 'una sincronización «en marcha» más vieja que el candado se cortó');
assert.ok(cut.error);

// ── Quién puede usarla ──
assert.equal(canUseAutoSync({ role: 'admin' }), true);
for (const app_role of ['director_deportivo', 'coordinador_f7', 'entrenador', 'psicologo', 'fisioterapeuta']) {
  assert.equal(canUseAutoSync({ role: 'user', app_role, access_status: 'approved' }), true, app_role);
}
assert.equal(canUseAutoSync({ role: 'user', app_role: 'jugador', access_status: 'approved' }), false);
assert.equal(canUseAutoSync({ role: 'user', app_role: 'familiar', access_status: 'approved' }), false);
assert.equal(canUseAutoSync({ role: 'user', app_role: 'entrenador', access_status: 'pending' }), false, 'sin aprobar');
assert.equal(canUseAutoSync({ role: 'user', app_role: 'entrenador', access_status: 'rejected' }), false);
assert.equal(canUseAutoSync({ role: 'user' }), false, 'sin función');
assert.equal(canUseAutoSync(null), false);

// ── Anotar las sincronizaciones en la base ──
const pg = new PGlite();
await pg.exec(`create table entities (id uuid primary key default gen_random_uuid(), entity_type text not null, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());`);
const db = { query: (t, p) => pg.query(t, p) };
const rows = async () => (await pg.query(`select count(*)::int n from entities where entity_type='FcfSyncStatus'`)).rows[0].n;
let tick = 0;
const clock = () => new Date(T0 + (tick++) * MIN);

assert.equal(await readSyncStatus(db), null);

// Una buena: se anota al empezar (en marcha) y al terminar (bien, con sus números y avisos)
let seenWhileRunning;
const good = await runTrackedSync(db, 'auto', async () => {
  seenWhileRunning = await readSyncStatus(db);
  return { teams_created: 1, teams_updated: 0, players_created: 3, matches_created: 2, matches_updated: 5, errors: ['x', 'y'] };
}, clock);
assert.equal(good.ok, true);
assert.equal(seenWhileRunning.in_progress, true);
assert.equal(seenWhileRunning.source, 'auto');
let s = await readSyncStatus(db);
assert.deepEqual([s.in_progress, s.ok, s.source, s.warnings], [false, true, 'auto', 2]);
assert.deepEqual(s.stats, { teams_created: 1, teams_updated: 0, players_created: 3, matches_created: 2, matches_updated: 5 });
assert.equal(s.last_ok_at, s.finished_at);
const firstOk = s.last_ok_at;

// Una fallida: queda anotada como fallida, la última buena se conserva y no se lanza el error al exterior
const log = console.error; console.error = () => {};
const failed = await runTrackedSync(db, 'manual', async () => { throw new Error('FCF 403 en https://www.fcf.cat/api/clubs/40493342'); }, clock);
console.error = log;
assert.equal(failed.ok, false);
assert.match(failed.error, /FCF 403/);
s = await readSyncStatus(db);
assert.deepEqual([s.in_progress, s.ok, s.source], [false, false, 'manual']);
assert.match(s.error, /FCF 403/);
assert.equal(s.last_ok_at, firstOk, 'la última buena no se pierde');
assert.equal(s.last_ok_source, 'auto');
assert.equal(publicStatus(s, T0 + H).state, 'failed');

// Una buena después de la fallida vuelve a dejarlo en bien
await runTrackedSync(db, 'noche', async () => ({ errors: [] }), clock);
s = await readSyncStatus(db);
assert.deepEqual([s.ok, s.source, s.warnings, s.last_ok_source], [true, 'noche', 0, 'noche']);
assert.equal(s.error, undefined);

// Siempre una única fila, aunque se anote muchas veces
assert.equal(await rows(), 1);

// Si la base falla al anotar, la sincronización sigue y devuelve su resultado
const broken = { query: async (t) => { if (/FcfSyncStatus/.test(t)) throw new Error('base caída'); return pg.query(t); } };
console.error = () => {};
const survived = await runTrackedSync(broken, 'manual', async () => ({ errors: [] }), clock);
console.error = log;
assert.equal(survived.ok, true, 'anotar el estado nunca rompe la sincronización');

// ── «Sincroniza solo si toca» (lo que se pide al abrir la app) ──
await pg.query(`delete from entities`);
let virtualNow = T0 + 10 * H;
const vclock = () => new Date(virtualNow);
let calls = 0;
const okSync = async () => { calls++; return { teams_created: 0, players_created: 0, matches_created: 1, matches_updated: 2, errors: [] }; };
const downSync = async () => { calls++; throw new Error('FCF 403 en https://www.fcf.cat/api/clubs/40493342'); };

// Primera apertura de la historia: sincroniza
let r = await runAutoSync(db, okSync, vclock);
assert.deepEqual([r.ran, r.ok, r.matches_updated, calls], [true, true, 2, 1]);
assert.equal(r.status.state, 'ok');
assert.equal(r.status.source, 'auto');
// Otra persona abre la app enseguida: no hace nada
virtualNow += 5 * MIN;
r = await runAutoSync(db, okSync, vclock);
assert.deepEqual([r.ran, calls, r.status.state], [false, 1, 'ok']);
// Dos horas y media después: todavía no
virtualNow += 2.5 * H;
assert.equal((await runAutoSync(db, okSync, vclock)).ran, false);
// Pasadas las 3 horas: sincroniza otra vez
virtualNow += 31 * MIN;
r = await runAutoSync(db, okSync, vclock);
assert.deepEqual([r.ran, r.ok, calls], [true, true, 2]);
// El candado queda libre al terminar
assert.equal(await acquireSyncLock(db), true);
await releaseSyncLock(db);

// Si la FCF falla: lo devuelve sin romper, no insiste enseguida y reintenta a los 30 minutos
virtualNow += 4 * H;
console.error = () => {};
r = await runAutoSync(db, downSync, vclock);
console.error = log;
assert.deepEqual([r.ran, r.ok, r.status.state, calls], [true, false, 'failed', 3]);
assert.match(r.error, /FCF 403/);
assert.ok(r.status.last_ok_at, 'se conserva cuándo fue la última correcta');
virtualNow += 10 * MIN;
assert.equal((await runAutoSync(db, okSync, vclock)).ran, false, 'a los 10 min de un fallo no se reintenta');
assert.equal(calls, 3);
virtualNow += 21 * MIN;
r = await runAutoSync(db, okSync, vclock);
assert.deepEqual([r.ran, r.ok, r.status.state, calls], [true, true, 'ok', 4], 'a los 30 min se reintenta y vuelve a estar bien');
assert.equal(await acquireSyncLock(db), true, 'tras un fallo el candado también se libera');
await releaseSyncLock(db);

// Hay otra sincronización en marcha (por ejemplo, el botón de otra persona): no se lanza una segunda
virtualNow += 5 * H;
assert.equal(await acquireSyncLock(db), true);
r = await runAutoSync(db, okSync, vclock);
assert.deepEqual([r.ran, r.reason, calls], [false, 'running', 4]);
await releaseSyncLock(db);

// Cinco personas abren la app a la vez cuando toca: se sincroniza una sola vez
virtualNow += 5 * H;
calls = 0;
const slowSync = async () => { calls++; await new Promise((ok) => setTimeout(ok, 50)); return { errors: [] }; };
const many = await Promise.all([1, 2, 3, 4, 5].map(() => runAutoSync(db, slowSync, vclock)));
assert.equal(calls, 1, 'una única sincronización aunque abran a la vez');
assert.equal(many.filter((x) => x.ran).length, 1);
assert.equal(await rows(), 1, 'una única fila de estado');
await releaseSyncLock(db);

await pg.close();
console.log('syncStatus OK');
