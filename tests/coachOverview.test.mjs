import test from 'node:test';
import assert from 'node:assert/strict';
import {
  feedbackSummary, areaAverages, teamFollow, personFollow, absenceSummary, fineSummary, cleanAbsence, cleanFine,
  parseAmount, roleGroup, levelOf, SESSION_LEVELS, alertScore, absenceEventOptions, followingUp,
} from '../src/lib/coachOverview.js';

const NOW = new Date('2026-11-13T12:00:00');
const ids = new Set(['s1', 'user_u1']);

test('feedback de 30 días y el último', () => {
  const fb = [
    { staff_id: 's1', date: '2026-11-10' }, { staff_id: 'user_u1', date: '2026-10-20' },
    { staff_id: 's1', date: '2026-09-01' }, { staff_id: 'otro', date: '2026-11-12' },
  ];
  const r = feedbackSummary(fb, ids, NOW);
  assert.equal(r.n30, 2);
  assert.equal(r.total, 3);
  assert.equal(r.last, '2026-11-10');
  assert.equal(r.daysAgo, 3);
  assert.deepEqual(feedbackSummary([], ids, NOW), { n30: 0, total: 0, last: null, daysAgo: null });
});

test('seguir trabajando de la temporada', () => {
  const fb = [{ staff_id: 's1', date: '2026-10-01', progress: 'seguir' }, { staff_id: 's1', date: '2026-10-02', progress: 'asimilado' }, { staff_id: 's1', date: '2026-07-01', progress: 'seguir' }];
  assert.equal(followingUp(fb, ids, '2026-2027').length, 1);
});

test('360 del periodo abierto por área', () => {
  const obs = [
    { staff_id: 's1', area: 'habitos', date: '2026-11-01', scores: { hab_puntualidad: 4, hab_material: 2 } },
    { staff_id: 's1', area: 'habitos', date: '2026-09-15', scores: { hab_puntualidad: 1 } }, // periodo cerrado
  ];
  const closes = [{ staff_id: 's1', season: '2026-2027', from: '2026-08-01', to: '2026-09-30', status: 'cerrado' }];
  const r = areaAverages(obs, closes, ids, '2026-2027');
  assert.equal(r.range.from, '2026-10-01');
  assert.equal(r.areas.habitos.n, 1);
  assert.equal(r.n, 1);
  assert.equal(r.areas.gestion.avg, null);
});

test('seguimiento de un equipo: sesiones, listas, actas y asistencia', () => {
  const events = [
    { id: 'e1', team_id: 't', type: 'entrenamiento', date: '2026-11-03T19:00' },
    { id: 'e2', team_id: 't', type: 'entrenamiento', date: '2026-11-05T19:00' },
    { id: 'e3', team_id: 't', type: 'entrenamiento', date: '2026-11-07T19:00', cancelled: true },
    { id: 'e4', team_id: 't', type: 'entrenamiento', date: '2026-09-01T19:00' }, // fuera de los 30 días
    { id: 'e5', team_id: 't', type: 'entrenamiento', date: '2026-11-20T19:00' }, // futuro
    { id: 'm1', team_id: 't', type: 'partido_liga', date: '2026-11-08T10:00', score_home: 2, score_away: 1 },
  ];
  const attendance = [{ event_id: 'e1', player_id: 'p1', status: 'present' }, { event_id: 'e1', player_id: 'p2', status: 'absent' }];
  const sessions = [{ team_id: 't', date: '2026-11-05' }, { team_id: 'otro', date: '2026-11-03' }];
  const f = teamFollow({ teamId: 't', events, attendance, sessions, pendingIds: new Set(['m1']), now: NOW });
  assert.equal(f.held, 2);
  assert.equal(f.withSession, 1);
  assert.equal(f.sessionsPct, 50);
  assert.equal(f.lists, 1);
  assert.equal(f.pendingLists, 1);
  assert.equal(f.actas, 1);
  assert.equal(f.attendance, 50);
  assert.deepEqual([f.rec.w, f.rec.d, f.rec.l], [1, 0, 0]);
  const p = personFollow([f, { ...f, held: 2, withSession: 2, lists: 2, pendingLists: 0, actas: 0 }]);
  assert.equal(p.sessionsPct, 75);
  assert.equal(p.listsPct, 75);
  assert.equal(personFollow([]), null);
});

test('niveles, grupos y orden por alerta', () => {
  assert.equal(levelOf(85, SESSION_LEVELS), 'ok');
  assert.equal(levelOf(65, SESSION_LEVELS), 'warn');
  assert.equal(levelOf(10, SESSION_LEVELS), 'bad');
  assert.equal(levelOf(null, SESSION_LEVELS), null);
  assert.equal(roleGroup('entrenador'), 'entrenadores');
  assert.equal(roleGroup('director_deportivo'), 'coordinacion');
  assert.equal(roleGroup('preparador_fisico'), 'otros');
  const bad = { isCoach: true, feedback: { n30: 0 }, follow: { sessionsPct: 20, listsPct: 60, actas: 2 }, behind: 4 };
  const good = { isCoach: true, feedback: { n30: 3 }, follow: { sessionsPct: 90, listsPct: 100, actas: 0 }, behind: 0 };
  assert.ok(alertScore(bad) > alertScore(good));
  assert.equal(alertScore(good), 0);
});

test('ausencias: resumen y formulario', () => {
  const abs = [
    { staff_id: 's1', date: '2026-11-04', kind: 'entreno', reason: 'enfermo', notified: true },
    { staff_id: 'user_u1', date: '2026-10-01', kind: 'partido', reason: 'sin_avisar', notified: false },
    { staff_id: 's1', date: '2026-07-01', kind: 'entreno', reason: 'viaje' }, // temporada anterior
  ];
  const r = absenceSummary(abs, ids, '2026-2027', NOW);
  assert.equal(r.season, 2);
  assert.equal(r.n30, 1);
  assert.equal(r.unnotified, 1);
  assert.equal(r.trainings, 1);
  assert.equal(r.matches, 1);
  assert.equal(r.last.date, '2026-11-04');
  assert.equal(cleanAbsence({ staff_id: 's1', date: 'mal' }), null);
  const c = cleanAbsence({ staff_id: 's1', date: '2026-11-04T19:00', kind: 'raro', reason: 'sin_avisar', notified: true, notes: '  x ' });
  assert.deepEqual(c, { staff_id: 's1', date: '2026-11-04', kind: 'otro', team_id: null, event_id: null, reason: 'sin_avisar', notified: false, notes: 'x' });
});

test('multas: importe, resumen y formulario', () => {
  assert.equal(parseAmount('12,5'), 12.5);
  assert.equal(parseAmount('20 €'), 20);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('1,234'), null);
  const fines = [
    { staff_id: 's1', date: '2026-11-01', amount: 20, status: 'pendiente' },
    { staff_id: 's1', date: '2026-10-01', amount: 10.5, status: 'pagada' },
    { staff_id: 'otro', date: '2026-10-01', amount: 99 },
  ];
  const r = fineSummary(fines, ids, '2026-2027');
  assert.equal(r.n, 2);
  assert.equal(r.pending, 1);
  assert.equal(r.pendingAmount, 20);
  assert.equal(r.paidAmount, 10.5);
  assert.equal(cleanFine({ staff_id: 's1', date: '2026-11-01', amount: '' }), null);
  const c = cleanFine({ staff_id: 's1', date: '2026-11-01', amount: '15', concept: 'tarjeta', status: 'pagada', paid_at: '2026-11-02' });
  assert.equal(c.amount, 15);
  assert.equal(c.concept, 'tarjeta');
  assert.equal(c.paid_at, '2026-11-02');
  assert.equal(cleanFine({ staff_id: 's1', date: '2026-11-01', amount: '15', paid_at: '2026-11-02' }).paid_at, null);
});

test('eventos a los que pudo faltar', () => {
  const events = [
    { id: 'a', team_id: 't', type: 'entrenamiento', date: '2026-11-10T19:00' },
    { id: 'b', team_id: 't', type: 'partido_liga', date: '2026-11-08T10:00' },
    { id: 'c', team_id: 't', type: 'reunion', date: '2026-11-09T10:00' },
    { id: 'd', team_id: 'x', type: 'entrenamiento', date: '2026-11-10T19:00' },
    { id: 'e', team_id: 't', type: 'entrenamiento', date: '2026-11-11T19:00', cancelled: true },
    { id: 'f', team_id: 't', type: 'entrenamiento', date: '2026-08-01T19:00' },
  ];
  assert.deepEqual(absenceEventOptions(events, ['t'], NOW).map((o) => [o.ev.id, o.kind]), [['a', 'entreno'], ['b', 'partido']]);
});
