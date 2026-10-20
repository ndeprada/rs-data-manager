import assert from 'node:assert/strict';
import { groupPendingByTeam, totalsOf } from '../src/lib/pendingByTeam.js';

const teams = [{ id: 'J', name: 'Juvenil A' }, { id: 'C', name: 'Cadet S16 A' }, { id: 'B', name: 'Benjamí S9 B' }];
const tr = (id, team, date) => ({ id, team_id: team, date, type: 'entrenamiento' });
const mt = (id, team, date) => ({ id, team_id: team, date, type: 'partido_liga' });

const trainings = [tr('t1', 'J', '2026-10-05T18:00'), tr('t2', 'J', '2026-10-01T18:00'), tr('t3', 'C', '2026-10-02T18:00')];
const m1 = mt('m1', 'C', '2026-10-10T10:00');
const m2 = mt('m2', 'C', '2026-10-03T10:00');
const m3 = mt('m3', 'B', '2026-10-04T10:00');
const matches = { soon: [], played: [m1, m2], result: [m1, m3], goals: [m1] };

const rows = groupPendingByTeam({ trainings, matches, teams });

// Orden: más pendientes primero (Cadet 1 entreno + 2 partidos = 3; Juvenil 2; Benjamí 1)
assert.deepEqual(rows.map((r) => [r.teamId, r.total]), [['C', 3], ['J', 2], ['B', 1]]);

// Entrenos del equipo, del más antiguo al más reciente
assert.deepEqual(rows.find((r) => r.teamId === 'J').trainings.map((e) => e.id), ['t2', 't1']);

// Un partido que está en varias listas sale una vez, con todos sus motivos
const cadet = rows.find((r) => r.teamId === 'C');
assert.deepEqual(cadet.matches.map((m) => m.event.id), ['m2', 'm1'], 'por fecha');
const m1Row = cadet.matches.find((m) => m.event.id === 'm1');
assert.deepEqual(m1Row.reasons, ['Jugado sin convocatoria', 'Sin resultado', 'Goles sin clasificar']);
assert.equal(m1Row.tab, 'convocatoria', 'se arregla primero la convocatoria');

// Sin convocatoria pero sin resultado: la ficha sin pestaña concreta; con goles, el acta
const m3Row = rows.find((r) => r.teamId === 'B').matches[0];
assert.equal(m3Row.tab, null);
assert.equal(groupPendingByTeam({ matches: { result: [m3], goals: [m3] }, teams }).at(0).matches[0].tab, 'acta');

assert.deepEqual(totalsOf(rows), { trainings: 3, matches: 3 });

// Desempate por el orden del club si se pasa; si no, por nombre
const tie = groupPendingByTeam({ trainings: [tr('a', 'J', '2026-10-01T10:00'), tr('b', 'C', '2026-10-01T10:00')], teams });
assert.deepEqual(tie.map((r) => r.teamId), ['C', 'J'], 'por nombre (Cadet antes que Juvenil alfabéticamente)');
const tie2 = groupPendingByTeam({ trainings: [tr('a', 'J', '2026-10-01T10:00'), tr('b', 'C', '2026-10-01T10:00')], teams, compare: (a, b) => (a.id === 'J' ? -1 : 1) });
assert.deepEqual(tie2.map((r) => r.teamId), ['J', 'C'], 'el orden del club manda en los empates');

// Nada pendiente → lista vacía; evento sin equipo conocido no rompe
assert.deepEqual(groupPendingByTeam({}), []);
assert.equal(groupPendingByTeam({ trainings: [tr('x', 'zzz', '2026-10-01T10:00')], teams })[0].name, 'Sin equipo');

console.log('pendingByTeam ok');
