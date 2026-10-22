import assert from 'node:assert/strict';
import {
  permissionsOf, canManageTeamWith, checkRoleWrite, filterRoleRead, staffIdsOfUser, ownerCanSeeCoachDoc,
} from '../src/lib/permissions.js';

const u = (app_role, extra = {}) => ({ id: 'u1', app_role, ...extra });
const p = (app_role, extra) => permissionsOf(u(app_role, extra));

// ── Quién ve a todos los jugadores ──
for (const r of ['director', 'director_deportivo', 'coordinador_general', 'coordinador_f7', 'coordinador_f11', 'entrenador_porteros', 'psicologo', 'preparador_fisico', 'fisioterapeuta'])
  assert.equal(p(r).players, 'all', `${r} ve a todos los jugadores`);
assert.equal(p('entrenador').players, 'team', 'el entrenador, solo su equipo');
assert.equal(p(null).players, 'team');

// ── Convocatoria, acta y táctica: entrenadores de ese equipo, Dirección Deportiva y administración ──
const manage = (user, team, mine = []) => canManageTeamWith(permissionsOf(user), team, mine);
assert.equal(manage(u('entrenador'), 'A', ['A']), true);
assert.equal(manage(u('entrenador'), 'B', ['A']), false, 'no puede en un equipo que no entrena');
assert.equal(manage(u('director_deportivo'), 'B'), true);
assert.equal(manage({ id: 'x', role: 'admin', app_role: 'coordinador_general' }, 'B'), true);
for (const r of ['director', 'coordinador_general', 'coordinador_f7', 'coordinador_f11', 'entrenador_porteros', 'psicologo', 'preparador_fisico', 'fisioterapeuta'])
  assert.equal(manage(u(r), 'A', ['A']), false, `${r} no gestiona convocatorias`);
// Coordinación que además entrena: solo su equipo
assert.equal(manage(u('coordinador_general', { secondary_role: 'entrenador' }), 'A', ['A']), true);
assert.equal(manage(u('coordinador_general', { secondary_role: 'entrenador' }), 'B', ['A']), false);

// ── Médico, evaluaciones y entrenadores por función ──
const table = {
  entrenador:          { eval: 'edit', med: 'edit', coaches: 'own',   evalCoaches: false },
  entrenador_porteros: { eval: 'edit', med: 'none', coaches: 'own',   evalCoaches: false },
  psicologo:           { eval: 'edit', med: 'view', coaches: 'all',   evalCoaches: true },
  preparador_fisico:   { eval: 'edit', med: 'view', coaches: 'own',   evalCoaches: false },
  fisioterapeuta:      { eval: 'none', med: 'edit', coaches: 'own',   evalCoaches: false },
  coordinador_f7:      { eval: 'edit', med: 'edit', coaches: 'stage', evalCoaches: true },
  coordinador_general: { eval: 'edit', med: 'edit', coaches: 'all',   evalCoaches: true },
  director_deportivo:  { eval: 'edit', med: 'edit', coaches: 'all',   evalCoaches: true },
};
for (const [r, t] of Object.entries(table)) {
  const x = p(r);
  assert.deepEqual([x.playerEval, x.medical, x.coaches, x.evalCoaches], [t.eval, t.med, t.coaches, t.evalCoaches], r);
}

// Pestañas de la ficha de jugador
const tabs = (r) => ['resumen', 'stats', 'entrenos', 'pdi', 'injuries', 'documents', 'historial'].filter((t) => p(r).canSeePlayerTab(t));
assert.deepEqual(tabs('fisioterapeuta'), ['resumen', 'stats', 'entrenos', 'injuries', 'documents', 'historial'], 'el fisio no ve PDI');
assert.deepEqual(tabs('entrenador_porteros'), ['resumen', 'stats', 'entrenos', 'pdi', 'historial'], 'porteros no ve lo médico');
assert.equal(tabs('psicologo').length, 7);

// Menús: el fisio solo jugadores; psicología, estadísticas y personal
assert.deepEqual(p('fisioterapeuta').tools, []);
assert.deepEqual(p('psicologo').tools, ['stats']);
assert.equal(p('psicologo').myTeam, false);
assert.equal(p('entrenador').tools.length, 6);
assert.equal(p('fisioterapeuta').stats, 'none');
assert.equal(p('entrenador').stats, 'team');

// ── Escrituras en el servidor ──
const write = (r, entity, method = 'POST', extra = {}) => checkRoleWrite({ perms: p(r), entity, method, ...extra }).ok;
// Médico: edita entrenador, fisio y coordinación; psicología y preparación física solo leen; porteros ni eso
assert.equal(write('fisioterapeuta', 'Injury'), true);
assert.equal(write('entrenador', 'Injury'), true);
assert.equal(write('coordinador_f11', 'PlayerDocument'), true);
assert.equal(write('psicologo', 'Injury'), false);
assert.equal(write('preparador_fisico', 'PlayerDocument', 'DELETE'), false);
assert.equal(write('entrenador_porteros', 'Injury'), false);
// Evaluaciones de jugadores: todos menos el fisio
assert.equal(write('psicologo', 'Evaluation360'), true);
assert.equal(write('entrenador_porteros', 'PDIGoal'), true);
assert.equal(write('coordinador_general', 'PDI'), true);
assert.equal(write('fisioterapeuta', 'Evaluation360'), false);
assert.equal(write('fisioterapeuta', 'PDIGoal', 'PUT'), false);
// Administración puede todo
assert.equal(checkRoleWrite({ perms: permissionsOf({ id: 'a', role: 'admin' }), entity: 'CoachFeedback', method: 'DELETE' }).ok, true);
// Entidades no sensibles no se tocan
assert.equal(write('fisioterapeuta', 'Event'), true);

// Evaluaciones de entrenadores: escriben coordinación y psicología; la persona evaluada solo contesta y se autoevalúa
const own = new Set(['staff1', 'user_u1']);
const fb = { staff_id: 'staff1', status: 'enviado' };
const draft = { staff_id: 'staff1', status: 'borrador' };
const other = { staff_id: 'staff2', status: 'enviado' };
const cw = (r, entity, method, body, existing) => checkRoleWrite({ perms: p(r), entity, method, body, existing, ownIds: own }).ok;
assert.equal(cw('psicologo', 'CoachFeedback', 'POST', { staff_id: 'staff2' }), true);
assert.equal(cw('coordinador_f7', 'CoachPDI', 'DELETE', {}, other), true);
assert.equal(cw('entrenador', 'CoachFeedback', 'POST', { staff_id: 'staff1' }), false, 'no crea feedback sobre sí mismo');
assert.equal(cw('entrenador', 'CoachFeedback', 'PUT', { replies: [] }, fb), true, 'contesta a su feedback');
assert.equal(cw('entrenador', 'CoachFeedback', 'PUT', { replies: [] }, draft), false, 'un borrador no es suyo aún');
assert.equal(cw('entrenador', 'CoachFeedback', 'PUT', { replies: [] }, other), false, 'ni el de otra persona');
assert.equal(cw('entrenador', 'CoachFeedback', 'DELETE', {}, fb), false);
assert.equal(cw('entrenador', 'CoachFeedback', 'PUT', { status: 'borrador' }, fb), false, 'no despublica');
assert.equal(cw('entrenador', 'CoachFeedback', 'PUT', { staff_id: 'staff2' }, fb), false, 'no lo reasigna');
assert.equal(cw('entrenador', 'CoachPDI', 'PUT', { coach_feedback: 'ok' }, { staff_id: 'staff1', visibility: 'publicado' }), true);
assert.equal(cw('entrenador', 'CoachPDI', 'PUT', { visibility: 'publicado' }, { staff_id: 'staff1', visibility: 'borrador' }), false);
assert.equal(cw('entrenador', 'CoachMatchNote', 'PUT', {}, { staff_id: 'staff1' }), false, 'las notas de partido son de quien evalúa');
assert.equal(cw('entrenador', 'CoachEval360', 'POST', { staff_id: 'staff1', kind: 'autoevaluacion' }), true);
assert.equal(cw('entrenador', 'CoachEval360', 'POST', { staff_id: 'staff1', kind: 'evaluacion' }), false);
assert.equal(cw('entrenador', 'CoachEval360', 'PUT', { answers: {} }, { staff_id: 'staff1', kind: 'autoevaluacion' }), true);
assert.equal(cw('entrenador', 'CoachEval360', 'PUT', { answers: {} }, { staff_id: 'staff1', kind: 'evaluacion', status: 'publicada' }), false);
// Observación de sesión: la escribe y la publica quien evalúa; el entrenador evaluado no escribe nada
assert.equal(cw('coordinador_general', 'CoachSessionObs', 'POST', { staff_id: 'staff2', status: 'borrador' }), true);
assert.equal(cw('psicologo', 'CoachSessionObs', 'POST', { staff_id: 'staff2', status: 'borrador' }), true);
assert.equal(cw('entrenador', 'CoachSessionObs', 'POST', { staff_id: 'staff1', status: 'publicada' }), false, 'no se la escribe a sí mismo');
assert.equal(cw('entrenador', 'CoachSessionObs', 'PUT', { scores: {} }, { staff_id: 'staff1', status: 'publicada' }), false, 'no cambia una observación publicada');
assert.equal(cw('entrenador', 'CoachSessionObs', 'PUT', { status: 'borrador' }, { staff_id: 'staff1', status: 'publicada' }), false, 'no la despublica');
assert.equal(cw('entrenador', 'CoachSessionObs', 'DELETE', {}, { staff_id: 'staff1', status: 'publicada' }), false);

// Cierre trimestral y estado del feedback: solo lo fija quien evalúa
assert.equal(cw('coordinador_general', 'CoachQuarterClose', 'POST', { staff_id: 'staff2', season: '2026-2027', quarter: 'q1', status: 'cerrado' }), true);
assert.equal(cw('entrenador', 'CoachQuarterClose', 'POST', { staff_id: 'staff1', status: 'publicado' }), false, 'no cierra ni publica su propio trimestre');
assert.equal(cw('entrenador', 'CoachQuarterClose', 'PUT', { note: 'x' }, { staff_id: 'staff1', status: 'publicado' }), false);
assert.equal(cw('entrenador', 'CoachFeedback', 'PUT', { progress: 'asimilado' }, { staff_id: 'staff1', status: 'enviado' }), false, 'no se marca el estado a sí mismo');
assert.equal(cw('entrenador', 'CoachFeedback', 'PUT', { replies: [] }, { staff_id: 'staff1', status: 'enviado' }), true, 'sí puede contestar');
assert.equal(cw('coordinador_general', 'CoachFeedback', 'PUT', { progress: 'seguir' }, { staff_id: 'staff2', status: 'borrador' }), true);

// ── Lecturas ──
const docs = [{ id: 1, staff_id: 'staff1', status: 'enviado' }, { id: 2, staff_id: 'staff1', status: 'borrador' }, { id: 3, staff_id: 'staff2', status: 'enviado' }];
const read = (r, entity, d, ownIds) => filterRoleRead({ perms: p(r), entity, docs: d, ownIds }).map((x) => x.id);
assert.deepEqual(read('entrenador', 'CoachFeedback', docs, own), [1], 'solo lo enviado y suyo');
assert.deepEqual(read('psicologo', 'CoachFeedback', docs, own), [1, 2, 3], 'psicología lo ve todo');
assert.deepEqual(read('coordinador_general', 'CoachFeedback', docs, own), [1, 2, 3]);
assert.deepEqual(read('entrenador', 'CoachMatchNote', [{ id: 9, staff_id: 'staff1' }], own), [], 'las notas de partido no salen a la persona evaluada');
assert.deepEqual(read('entrenador', 'CoachEval360', [{ id: 1, staff_id: 'staff1', status: 'borrador', kind: 'evaluacion' }, { id: 2, staff_id: 'staff1', status: 'borrador', kind: 'autoevaluacion' }, { id: 3, staff_id: 'staff1', status: 'publicada', kind: 'evaluacion' }], own), [2, 3]);
assert.deepEqual(read('entrenador', 'CoachSessionObs', [{ id: 1, staff_id: 'staff1', status: 'borrador' }, { id: 2, staff_id: 'staff1', status: 'publicada' }, { id: 3, staff_id: 'staff2', status: 'publicada' }], own), [2], 'solo las publicadas y suyas');
assert.deepEqual(read('coordinador_general', 'CoachSessionObs', [{ id: 1, staff_id: 'staff1', status: 'borrador' }, { id: 2, staff_id: 'staff2', status: 'publicada' }], own), [1, 2]);
assert.deepEqual(read('entrenador', 'CoachQuarterClose', [{ id: 1, staff_id: 'staff1', status: 'cerrado' }, { id: 2, staff_id: 'staff1', status: 'publicado' }, { id: 3, staff_id: 'staff2', status: 'publicado' }], own), [2], 'solo los trimestres publicados y suyos');
assert.deepEqual(read('entrenador_porteros', 'Injury', [{ id: 1 }]), [], 'porteros no ve lesiones');
assert.deepEqual(read('psicologo', 'Injury', [{ id: 1 }]), [1]);
assert.deepEqual(read('fisioterapeuta', 'PDI', [{ id: 1 }]), [], 'el fisio no ve el PDI');
assert.deepEqual(read('fisioterapeuta', 'Evaluation360', [{ id: 1 }]), []);
assert.deepEqual(read('fisioterapeuta', 'Event', [{ id: 1 }]), [1]);
assert.equal(ownerCanSeeCoachDoc('CoachPDI', { visibility: 'borrador' }), false);

// ── Qué fichas de personal son de una persona (mismo criterio que la pantalla) ──
const users = [
  { id: 'u1', email: 'Ana@Club.es', full_name: 'Ana Pérez' },
  { id: 'u2', email: 'luis@club.es', full_name: 'Luis Gil', staff_member_id: 's9' },
];
const staff = [
  { id: 's1', email: 'ana@club.es', first_name: 'Ana', last_name: 'Pérez' },
  { id: 's9', email: '', first_name: 'Luis', last_name: 'Gil' },
  { id: 's3', email: '', first_name: 'Marta', last_name: 'Soler' },
];
assert.deepEqual([...staffIdsOfUser(users[0], users, staff)].sort(), ['s1', 'user_u1']);
assert.deepEqual([...staffIdsOfUser(users[1], users, staff)].sort(), ['s9', 'user_u2']);
assert.deepEqual([...staffIdsOfUser({ id: 'u7', email: 'x@x.es', full_name: 'Sin Ficha' }, users, staff)], ['user_u7']);

console.log('permissions ok');
