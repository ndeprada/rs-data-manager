import assert from 'node:assert/strict';
import { reachableUserIds, searchPeople, isApprovedUser, MAX_INDIVIDUALS } from '../api/_lib/recipients.js';

const row = (id, data) => ({ id, data });
const teams = new Map([['A', 'Juvenil B'], ['B', 'Cadet S16 A']]);
const players = [
  row('pA1', { first_name: 'Sabir', last_name: 'Martín', team_id: 'A' }),
  row('pA2', { first_name: 'Leo', last_name: 'Pérez', team_id: 'A' }),
  row('pB1', { first_name: 'Nil', last_name: 'Gómez', team_id: 'B' }),
];
const users = [
  row('coord', { app_role: 'coordinador_general', access_status: 'approved', full_name: 'Nacho Coord' }),
  row('coachA', { app_role: 'entrenador', access_status: 'approved', team_ids: ['A'], full_name: 'Álex Entrenador' }),
  row('coachB', { app_role: 'entrenador', access_status: 'approved', team_ids: ['B'], full_name: 'Berta Entrenadora' }),
  row('playerA', { app_role: 'jugador', access_status: 'approved', player_id: 'pA1', full_name: 'Sabir Martín' }),
  row('playerB', { app_role: 'jugador', access_status: 'approved', player_id: 'pB1', full_name: 'Nil Gómez' }),
  row('famA', { app_role: 'familiar', access_status: 'approved', full_name: 'María López' }),
  row('famB', { app_role: 'familiar', access_status: 'approved', full_name: 'Joan Gómez' }),
  row('pending', { app_role: 'jugador', access_status: 'pending', player_id: 'pA2', full_name: 'Leo Pérez' }),
  row('fisioA', { app_role: 'fisioterapeuta', access_status: 'approved', team_ids: ['A'], full_name: 'Ona Fisio' }),
  row('porteros', { app_role: 'entrenador_porteros', access_status: 'approved', full_name: 'Pau Porteros' }),
];
const links = [
  row('l1', { user_id: 'famA', player_id: 'pA2', status: 'approved' }),
  row('l2', { user_id: 'famB', player_id: 'pB1', status: 'approved' }),
];
const data = { users, players, links };
const ids = (set) => [...set].sort();

// Aprobados
assert.equal(isApprovedUser({ access_status: 'approved' }), true);
assert.equal(isApprovedUser({ access_status: 'pending', app_role: 'jugador' }), false);
assert.equal(isApprovedUser({ app_role: 'entrenador' }), true);           // antiguos sin estado pero con función
assert.equal(isApprovedUser({}), false);

// Coordinación: cualquier usuario aprobado, menos ella misma y los pendientes
const coordReach = reachableUserIds({ id: 'coord', coord: true, teams: [] }, data);
assert.deepEqual(ids(coordReach), ['coachA', 'coachB', 'famA', 'famB', 'fisioA', 'playerA', 'playerB', 'porteros']);

// Entrenador del equipo A: jugadores con cuenta, familiares vinculados y cuerpo técnico de su equipo
const coachReach = reachableUserIds({ id: 'coachA', coord: false, teams: ['A'] }, data);
assert.deepEqual(ids(coachReach), ['famA', 'fisioA', 'playerA']);
// Nada del equipo B, ni de coordinación, ni pendientes, ni técnicos sin equipo
for (const x of ['playerB', 'famB', 'coachB', 'coord', 'pending', 'porteros']) assert.ok(!coachReach.has(x), x);
// Sin equipos no puede escribir a nadie en concreto
assert.equal(reachableUserIds({ id: 'x', coord: false, teams: [] }, data).size, 0);

// Un vínculo de familiar sin aprobar no cuenta
const pendingLink = [row('l3', { user_id: 'famB', player_id: 'pA1', status: 'pending' })];
assert.ok(!reachableUserIds({ id: 'coachA', coord: false, teams: ['A'] }, { users, players, links: pendingLink }).has('famB'));

// ── Buscador ──
const ctx = (reach, pushUsers) => ({ ...data, teams, reach, pushUsers });
const coordCtx = ctx(coordReach, new Set(['playerA']));

// Por nombre del jugador: datos mínimos y con su equipo
const [sabir, ...rest] = searchPeople('sabir', coordCtx);
assert.equal(rest.length, 0);
assert.equal(sabir.id, 'playerA');
assert.equal(sabir.role, 'jugador');
assert.deepEqual(sabir.players, [{ name: 'Sabir Martín', team: 'Juvenil B' }]);
assert.equal(sabir.has_push, true);
assert.deepEqual(Object.keys(sabir).sort(), ['has_push', 'id', 'name', 'players', 'role', 'teams']);   // sin correo ni teléfono

// Un familiar se encuentra buscando a su hijo; el jugador pendiente no sale
const byChild = searchPeople('leo', coordCtx);
assert.deepEqual(byChild.map((r) => r.id), ['famA']);
assert.deepEqual(byChild[0].players, [{ name: 'Leo Pérez', team: 'Juvenil B' }]);
assert.equal(byChild[0].has_push, false);

// Sin tildes ni mayúsculas, y por equipo del cuerpo técnico
assert.deepEqual(searchPeople('ALEX', coordCtx).map((r) => r.id), ['coachA']);
assert.deepEqual(searchPeople('alex', coordCtx)[0].teams, ['Juvenil B']);
assert.deepEqual(searchPeople('cadet', coordCtx).map((r) => r.id).sort(), ['coachB', 'famB', 'playerB']);

// Un trozo de nombre no encuentra a todo un equipo por coincidir dentro de «Juvenil»
assert.deepEqual(searchPeople('nil', coordCtx).map((r) => r.id).sort(), ['famB', 'playerB']);
assert.deepEqual(searchPeople('cadet s16', coordCtx).map((r) => r.id).sort(), ['coachB', 'famB', 'playerB']);

// Mínimo dos letras; el límite se respeta
assert.deepEqual(searchPeople('a', coordCtx), []);
assert.deepEqual(searchPeople('  ', coordCtx), []);
assert.equal(searchPeople('juvenil', coordCtx, 2).length, 2);

// Un entrenador solo encuentra a su gente
const coachCtx = ctx(coachReach, new Set());
assert.deepEqual(searchPeople('nil', coachCtx), []);
assert.deepEqual(searchPeople('gomez', coachCtx), []);
assert.deepEqual(searchPeople('sabir', coachCtx).map((r) => r.id), ['playerA']);

assert.ok(MAX_INDIVIDUALS >= 10);
