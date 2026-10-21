import assert from 'node:assert/strict';
import { clubEventCopies, clubSiblings, isClubEvent, teamSets, scopeLabel, CLUB_EVENT_TYPE } from '../src/lib/clubEvent.js';
import { bulkTargets, TRAINING_TYPES } from '../src/lib/eventCancel.js';
import { cancelNotice, bulkNotice } from '../src/lib/cancelNotice.js';

// Evento de todo el club: una copia por equipo, unidas por club_event_id
const teams = [{ id: 't1' }, { id: 't2' }, { id: 't2' }, { id: 't3' }, { id: '' }, null];
const copies = clubEventCopies({ title: 'Fiesta', type: CLUB_EVENT_TYPE, date: '2026-12-20T12:00' }, teams, 'g1');
assert.deepEqual(copies.map((c) => c.team_id), ['t1', 't2', 't3'], 'una por equipo, sin repetidos ni vacíos');
assert.ok(copies.every((c) => c.club_event_id === 'g1' && c.title === 'Fiesta' && c.date === '2026-12-20T12:00'));
const all = [...copies.map((c, i) => ({ ...c, id: `e${i}` })), { id: 'x', team_id: 't1', title: 'Entreno' }];
assert.equal(clubSiblings(all, all[1]).length, 3, 'las copias del mismo evento');
assert.deepEqual(clubSiblings(all, all[3]), [], 'un evento normal no tiene copias');
assert.equal(isClubEvent(all[0]), true);
assert.equal(isClubEvent(all[3]), false);

// Selecciones rápidas: todos / fútbol 11 / fútbol 7 (solo las que tienen equipos)
const tm = [{ id: 'a', name: 'Primer Equipo' }, { id: 'b', name: 'Juvenil A' }, { id: 'c', name: 'Aleví S12 A' }, { id: 'd', name: 'Prebenjamí S8 A' }, null, { name: 'sin id' }];
const f7 = (t) => ['c', 'd'].includes(t.id);
assert.deepEqual(teamSets(tm, f7).map((s) => [s.key, s.ids.join('')]), [['all', 'abcd'], ['f11', 'ab'], ['f7', 'cd']]);
assert.deepEqual(teamSets([{ id: 'a' }], () => false).map((s) => s.key), ['all', 'f11'], 'sin equipos de fútbol 7 no sale esa opción');
assert.deepEqual(teamSets([], f7), []);

// A quién llega el evento
assert.equal(scopeLabel(tm.slice(0, 4), tm.slice(0, 4)), 'Todo el club');
assert.equal(scopeLabel([tm[0], tm[1]], tm.slice(0, 4)), 'Primer Equipo, Juvenil A');
assert.equal(scopeLabel(tm.slice(0, 3), tm.slice(0, 4)), 'Primer Equipo, Juvenil A, Aleví S12 A');
assert.equal(scopeLabel(tm.slice(0, 3), tm.slice(0, 5).concat([{ id: 'e', name: 'E' }]), 2), '3 equipos');
assert.equal(scopeLabel([], tm), '');
assert.equal(scopeLabel([{ id: 'x', name: 'Único' }], [{ id: 'x', name: 'Único' }]), 'Único', 'con un solo equipo en el club no es «todo el club»');

// Qué se cancela en bloque: entrenos (y partidos si se pide) entre dos días, sin repetir los ya cancelados
const ev = (id, team, type, date, extra = {}) => ({ id, team_id: team, type, date, ...extra });
const evs = [
  ev('a', 't1', 'entrenamiento', '2026-10-30T19:00'),
  ev('b', 't1', 'entrenamiento', '2026-10-31T10:00'),
  ev('c', 't2', 'entrenamiento_fisico', '2026-10-31T19:00'),
  ev('d', 't2', 'entrenamiento', '2026-11-01T19:00'),
  ev('e', 't1', 'partido_liga', '2026-10-31T16:00'),
  ev('f', 't1', 'entrenamiento', '2026-10-31T20:00', { cancelled: true, cancel_reason: 'lluvia' }),
  ev('g', 't1', 'evento_club', '2026-10-31T12:00'),
  ev('h', 't1', 'reunion_equipo', '2026-10-31T21:00'),
];
const ids = (r) => r.map((e) => e.id);
assert.deepEqual(ids(bulkTargets(evs, { from: '2026-10-31', to: '2026-10-31' })), ['b', 'c'], 'solo entrenos de ese día; sin partidos, sin cancelados, sin eventos de club ni reuniones');
assert.deepEqual(ids(bulkTargets(evs, { from: '2026-10-31', to: '2026-11-01' })), ['b', 'c', 'd'], 'rango inclusivo, ordenado por fecha');
assert.deepEqual(ids(bulkTargets(evs, { from: '2026-10-31', to: '2026-10-31', includeMatches: true })), ['b', 'e', 'c'], 'con partidos');
assert.deepEqual(ids(bulkTargets(evs, { from: '2026-10-30', to: '2026-11-01', teamIds: ['t2'] })), ['c', 'd'], 'solo los equipos indicados');
assert.deepEqual(ids(bulkTargets(evs, { from: '2026-10-30', to: '2026-11-01', teamIds: [] })), [], 'lista vacía = ningún equipo');
assert.deepEqual(bulkTargets(evs, { from: '2026-11-02', to: '2026-10-31' }), [], 'fechas al revés');
assert.deepEqual(bulkTargets(evs, {}), []);
assert.ok(TRAINING_TYPES.includes('entrenamiento'));

// Textos de los avisos
assert.equal(cancelNotice({ type: 'entrenamiento', date: '2026-10-21T19:00' }, { teamName: 'Juvenil A', reason: 'lluvia' }).body,
  'Juvenil A: se cancela el entreno del miércoles 21 oct a las 19:00. Motivo: lluvia.');
const m = cancelNotice({ type: 'partido_liga', opponent: 'Pastrana', date: '2026-10-24T10:30' }, { teamName: 'Cadet S16 A', reason: 'campo' });
assert.equal(m.title, 'Partido suspendido');
assert.match(m.body, /se suspende el partido contra Pastrana del sábado 24 oct a las 10:30\. Motivo: campo no disponible\./);
assert.equal(cancelNotice({ type: 'cena_equipo', date: '2026-10-24T21:00' }, { reason: 'otro' }).body, 'Se cancela la cena del sábado 24 oct a las 21:00.', 'sin motivo si es «otro»');
assert.equal(cancelNotice({ type: 'evento_club', date: '2026-10-24T21:00' }, { teamName: 'Juvenil A', group: true }).body, 'Se cancela el evento del sábado 24 oct a las 21:00.', 'en grupo no sale el nombre de un equipo');
assert.equal(bulkNotice({ from: '2026-10-31', to: '2026-10-31', reason: 'festivo' }).body, 'No habrá entrenos el sábado 31 oct. Motivo: festivo.');
assert.equal(bulkNotice({ from: '2026-10-31', to: '2026-11-02', reason: 'lluvia', includeMatches: true }).body, 'Se cancelan los entrenos y partidos del sábado 31 oct al lunes 2 nov. Motivo: lluvia.');
assert.equal(bulkNotice({ from: '2026-10-31', to: '2026-11-02' }).title, 'Entrenos cancelados');

console.log('clubEvent ok');
