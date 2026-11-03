import assert from 'node:assert/strict';
import {
  STAGES, BLOCKS, targetPct, stageContents, contentId, stageOfTeamName, taskMinutes, seriesLabel, recText, fmtMin,
  registerSession, aggregateSessions, taskWarnings, marginState, compareWithStage, hierarchyIssues, phasesLabel, emptySession, emptyTask, isBlankTask,
  priorityOf, contentBlock, contentName,
} from '../src/lib/sessionPlan.js';

// ── Etapas por equipo ──
const st = stageOfTeamName;
assert.equal(st('Primer Equipo'), 'rend');
assert.equal(st('Juvenil A'), 'rend');
assert.equal(st('Juvenil B'), 'perf');
assert.equal(st('Juvenil D'), 'perf');
assert.equal(st('Cadet S16 A'), 'perf');
assert.equal(st('Cadet S15 B'), 'des2');
assert.equal(st('Infantil S14 A'), 'des2');
assert.equal(st('Infantil S13 B'), 'des1');
assert.equal(st('Aleví S12 C'), 'des1');
assert.equal(st('Aleví S11 A'), 'inic2');
assert.equal(st('Benjamí S10 B'), 'inic2');
assert.equal(st('Benjamí S9 A'), 'inic1');
assert.equal(st('Prebenjamí S8 A'), 'inic1');
assert.equal(st('Otro equipo'), null);

// ── Porcentajes de referencia: cada etapa suma 100 ──
for (const s of STAGES) assert.equal(BLOCKS.reduce((a, b) => a + targetPct(b.id, s.id), 0), 100, `${s.id} suma 100`);
assert.equal(targetPct('tecnica', 'inic1'), 25);
assert.equal(targetPct('abp', 'perf'), 5);
assert.equal(targetPct('abp', 'des2'), 0);

// ── Currículum ──
for (const s of STAGES) {
  const list = stageContents(s.id);
  assert.ok(list.length > 30, `${s.id} tiene contenidos`);
  assert.equal(new Set(list.map((c) => c.id)).size, list.length, `${s.id} sin ids repetidos`);
  // Cada bloque con porcentaje tiene contenidos de prioridad alta
  for (const b of BLOCKS) if (targetPct(b.id, s.id) > 0) assert.ok(list.some((c) => c.block === b.id && c.priority === 'A'), `${s.id}/${b.id} con prioridad alta`);
}
// El mismo nombre en bloques distintos son contenidos distintos
assert.notEqual(contentId('cc_of', 'Juego en bloque'), contentId('cc_def', 'Juego en bloque'));
assert.equal(priorityOf('des2', contentId('cc_of', 'Juego en bloque')), 'A');
assert.equal(priorityOf('rend', contentId('tecnica', 'Conducción')), 'M');
assert.equal(priorityOf('perf', contentId('tecnica', 'Conducción')), 'A');
assert.equal(priorityOf('inic1', contentId('abp', 'Córner ofensivo')), null, 'el balón parado específico empieza en Perfeccionamiento');
assert.equal(contentBlock(contentId('oc_of', 'Pared')), 'oc_of');
assert.equal(contentName(contentId('oc_of', 'Pared')), 'Pared');

// ── Tiempos ──
assert.equal(taskMinutes({ series: 4, serie_min: 4, rec_min: 1 }), 19);
assert.equal(taskMinutes({ series: 2, serie_min: 12, rec_min: 1 }), 25);
assert.equal(taskMinutes({ series: 1, serie_min: 20 }), 20);
assert.equal(taskMinutes({ series: 6, serie_min: 3, rec_min: 0.5 }), 20.5);
assert.equal(taskMinutes({ series: 4, serie_min: 4, rec_min: 1, total_override: 20 }), 20, 'el total puesto a mano manda');
assert.equal(taskMinutes({ series: '3', serie_min: '6', rec_min: '1,5' }), 21, 'acepta coma decimal');
assert.equal(taskMinutes({}), 0);
assert.equal(seriesLabel({ series: 4, serie_min: 4 }), '4×4’');
assert.equal(recText(0.5), '30’’'); assert.equal(recText(2), '2’'); assert.equal(recText(1.5), '1,5’'); assert.equal(recText(0), '');
assert.equal(seriesLabel({ series: 1, serie_min: 0 }), '');
assert.equal(fmtMin(20), '20’');
assert.equal(fmtMin(20.5), '20,5’');

// ── Registro de lo trabajado ──
const C = (b, n) => contentId(b, n);
const task = (over) => ({ ...emptyTask('principal'), ...over });
const session = {
  initial: { tasks: [task({ part: 'inicial', type: 'pf', series: 1, serie_min: 20, no_curriculum: true }), task({ part: 'inicial', serie_min: 10, principal: [C('habitos', 'Mirar antes y después de recibir')] })] },
  main: {
    tasks: [
      // dos principales del mismo bloque: los dos registran toda la duración, el bloque solo una vez
      task({ serie_min: 20, principal: [C('oc_of', 'Doblada'), C('oc_of', 'Pasillo')], secondary: [C('cc_of', 'Juego en bloque')], corrections: 'Abrir la banda' }),
      // secundarios sin correcciones: también computan (como secundario)
      task({ serie_min: 20, principal: [C('fi_def', 'Presión')], secondary: [C('fi_def', 'Marcaje')], corrections: '' }),
      // principales de bloques distintos: cuenta en el del primero
      task({ serie_min: 25, principal: [C('cc_of', 'Juego en bloque'), C('oc_def', 'Presión tras pérdida')], corrections: 'x' }),
    ],
  },
};
const r = registerSession(session);
assert.equal(r.total, 95);
assert.equal(r.noCurriculum, 20);
assert.equal(r.withBlock, 75);
assert.equal(r.unclassified, 0);
assert.deepEqual(r.blocks, { habitos: 10, oc_of: 20, fi_def: 20, cc_of: 25 });
assert.equal(r.contents[C('oc_of', 'Doblada')].principal, 20);
assert.equal(r.contents[C('oc_of', 'Pasillo')].principal, 20, 'dos principales registran a la vez');
assert.equal(r.contents[C('cc_of', 'Juego en bloque')].secondary, 20, 'secundario con correcciones');
assert.equal(r.contents[C('cc_of', 'Juego en bloque')].principal, 25, 'y también principal en otra tarea');
assert.equal(r.contents[C('fi_def', 'Marcaje')].secondary, 20, 'secundario sin correcciones también computa');
assert.equal(r.contents[C('fi_def', 'Marcaje')].principal, 0);
assert.equal(r.contents[C('oc_def', 'Presión tras pérdida')].principal, 25);
assert.equal(r.blocks.oc_def, undefined, 'el bloque del segundo principal no suma minutos');
// El volumen de los bloques nunca supera el tiempo con contenido
assert.ok(Object.values(r.blocks).reduce((a, b) => a + b, 0) <= r.withBlock);

// Tarea sin contenidos y sin marcar como PF: queda sin clasificar
const r2 = registerSession({ initial: { tasks: [] }, main: { tasks: [task({ serie_min: 15 })] } });
assert.equal(r2.unclassified, 15);
assert.equal(r2.withBlock, 0);

// Más de dos principales: solo cuentan los dos primeros
const r3 = registerSession({ main: { tasks: [task({ serie_min: 10, principal: [C('tecnica', 'Pases'), C('tecnica', 'Conducción'), C('tecnica', 'Tiro')] })] } });
assert.equal(Object.keys(r3.contents).length, 2);

// ── Suma de sesiones ──
const agg = aggregateSessions([session, session]);
assert.equal(agg.sessions, 2);
assert.equal(agg.total, 190);
assert.equal(agg.blocks.oc_of, 40);
assert.equal(agg.contents[C('oc_of', 'Doblada')].principal, 40);
assert.equal(agg.contents[C('cc_of', 'Juego en bloque')].secondary, 40);

// ── Avisos de tarea ──
assert.equal(taskWarnings(task({})).length, 1);
assert.equal(taskWarnings(task({ no_curriculum: true })).length, 0);
assert.equal(taskWarnings(task({ principal: [C('tecnica', 'Pases')], secondary: [C('habitos', 'Jugar de costado')] })).length, 0, 'un secundario no pide correcciones');
assert.equal(taskWarnings(task({ principal: [C('tecnica', 'Pases')], secondary: [C('habitos', 'Jugar de costado')], corrections: 'ok' })).length, 0);
assert.equal(taskWarnings(task({ principal: [C('tecnica', 'Pases'), C('habitos', 'Jugar de costado')] })).length, 1, 'bloques distintos');

// ── Márgenes (TFM 4.8.3) ──
assert.equal(marginState(5).id, 'ok');
assert.equal(marginState(-5).id, 'ok');
assert.equal(marginState(7).id, 'revisar');
assert.equal(marginState(-10).id, 'revisar');
assert.equal(marginState(10.5).id, 'alerta');
const cmp = compareWithStage(agg, 'rend');
assert.equal(cmp.length, BLOCKS.length);
const oc = cmp.find((c) => c.block === 'oc_of');
assert.equal(oc.minutes, 40);
assert.ok(Math.abs(oc.pct - (40 / 150) * 100) < 1e-9);
assert.equal(oc.target, 25);
assert.equal(compareWithStage(aggregateSessions([]), 'rend').every((c) => c.pct === 0 && c.state === null), true);

// ── Jerarquía alta > media > baja ──
const day = (items) => ({ main: { tasks: items.map(([name, min]) => task({ serie_min: min, principal: [C('tecnica', name)] })) } });
// Rendimiento, técnica: alta = Controles…, media = Recepción girada…, baja = Dejar correr…
assert.deepEqual(hierarchyIssues(aggregateSessions([]), 'rend'), []);
const bad = aggregateSessions([day([['Controles orientados', 10], ['Pases', 10], ['Regate con finta', 10], ['Entrada', 10], ['Tiro', 10], ['Juego de cabeza con oposición', 10], ['Recepción girada', 30]])]);
assert.equal(hierarchyIssues(bad, 'rend').some((i) => i.block === 'tecnica'), true, 'una media por encima de alguna alta');
const good = aggregateSessions([day([['Controles orientados', 20], ['Pases', 20], ['Regate con finta', 20], ['Entrada', 20], ['Tiro', 20], ['Juego de cabeza con oposición', 20], ['Recepción girada', 10], ['Conducción', 10], ['Cobertura de balón', 10], ['Dejar correr el balón', 5], ['Saque de banda', 5]])]);
assert.deepEqual(hierarchyIssues(good, 'rend'), []);
// Si las prioridades media y baja no se han trabajado nada, no hay nada que contradiga la jerarquía (aunque alguna alta esté a cero)
const onlyA = aggregateSessions([day([['Controles orientados', 20], ['Pases', 20]])]);
assert.deepEqual(hierarchyIssues(onlyA, 'rend'), []);

// ── Fases del juego ──
assert.equal(phasesLabel([]), '');
assert.equal(phasesLabel(['ataque_org']), 'Ataque organizado');
assert.equal(phasesLabel(['ataque_org', 'defensa_org']), 'Ataque organizado + Defensa organizada');
assert.equal(phasesLabel(['trans_def', 'ataque_org']), 'Ataque organizado + Transición defensiva');
assert.equal(phasesLabel(['ataque_org', 'trans_of']), 'Todas en ataque');
assert.equal(phasesLabel(['defensa_org', 'trans_def']), 'Todas en defensa');
assert.equal(phasesLabel(['ataque_org', 'defensa_org', 'trans_of', 'trans_def']), 'Todas las fases');

// ── Estructura inicial ──
const e = emptySession({ teamId: 't1', date: '2026-10-21', stage: 'rend', type: 'juego_colectivo' });
assert.equal(e.initial.tasks.length, 1);
assert.equal(e.main.tasks.length, 3);
assert.equal(e.duration, 90);
assert.ok(e.main.tasks.every(isBlankTask));
assert.equal(new Set([...e.initial.tasks, ...e.main.tasks].map((t) => t.id)).size, 4, 'ids de tarea únicos');
assert.equal(registerSession(e).total, 0);

// ── 02/11/2026: tipos de sesión nuevos, paleta, duplicar y mover tareas ──
{
  const sp = await import('../src/lib/sessionPlan.js');
  assert.equal(sp.sessionTypeInfo('compensatoria').id, 'recuperacion', 'la compensatoria antigua se lee como recuperación');
  assert.equal(sp.sessionTypeInfo('prepartido').id, 'activacion');
  assert.equal(sp.sessionTypeName(sp.sessionTypeInfo('fundamentos')), 'Fundamentos individuales · Tensión');
  assert.equal(sp.sessionTypeName(sp.sessionTypeInfo('activacion')), 'Activación');
  // Un contenido de la paleta del club cuenta con el nombre y el bloque guardados en la tarea
  const pal = sp.paletteContentId('abc');
  const t = task({ serie_min: 12, principal: [pal], secondary: [C('habitos', 'Jugar de costado')], custom_contents: { [pal]: { name: 'Fijar al par', block: 'oc_of' } } });
  const rp = sp.registerSession({ main: { tasks: [t] } });
  assert.equal(rp.blocks.oc_of, 12);
  assert.equal(rp.contents[pal].principal, 12);
  assert.equal(rp.custom[pal].name, 'Fijar al par');
  assert.equal(sp.contentName(pal, t), 'Fijar al par');
  // Secundarios cuentan aunque la tarea no tenga principal
  const rs = sp.registerSession({ main: { tasks: [task({ serie_min: 8, secondary: [C('habitos', 'Jugar de costado')] })] } });
  assert.equal(rs.unclassified, 8);
  assert.equal(rs.contents[C('habitos', 'Jugar de costado')].secondary, 8);
  // Duplicar: tareas con ids nuevos, sin asistencia
  const src = { session_type: 'compensatoria', obj_atk: 'a', attendance: { p1: { st: 'si' } }, initial: { tasks: [task({ title: 'Rondo', serie_min: 5 })] }, main: { tasks: [task({}), task({ title: 'Juego', serie_min: 10 })] } };
  const d = sp.duplicateSessionContent(src);
  assert.equal(d.session_type, 'recuperacion');
  assert.equal(d.attendance, undefined);
  assert.equal(d.main.tasks.length, 1, 'las tareas vacías no se copian');
  assert.notEqual(d.initial.tasks[0].id, src.initial.tasks[0].id);
  // Mover una tarea de la parte principal a la inicial
  const s2 = sp.moveTaskToPart({ initial: { tasks: [] }, main: { tasks: [src.main.tasks[1]] } }, src.main.tasks[1].id, 'initial');
  assert.equal(s2.initial.tasks.length, 1);
  assert.equal(s2.initial.tasks[0].part, 'inicial');
  assert.equal(s2.main.tasks.length, 0);
  // Texto del cuerpo técnico
  assert.equal(sp.staffRolesText([{ role: '1e', name: 'Nacho', aspect: 'perfil' }, { role: 'porteros', name: '', aspect: '' }, { role: 'pf', name: 'Joan', aspect: '' }]), '1E Nacho: perfil\nPF Joan');
  assert.equal(sp.fmtPct(0.4), '<1%');
}

// Tareas simultáneas (03/11/2026): el reloj cuenta cada grupo una vez (la más larga); los contenidos cuentan entera cada tarea
{
  const { taskGroups, partClock, sessionClock, simulWith, registerSession: reg } = await import('../src/lib/sessionPlan.js');
  const t = (min, extra = {}) => ({ id: Math.random().toString(36).slice(2), series: 1, serie_min: min, rec_min: 0, ...extra });
  const main = [t(20, { principal: ['oc_of.desmarque_apoyo'] }), t(15, { simul: true, principal: ['oc_of.desmarque_apoyo'] }), t(12, { simul: true }), t(25)];
  assert.deepEqual(taskGroups(main), [[0, 1, 2], [3]]);
  assert.equal(partClock(main), 45);
  assert.equal(simulWith(main, 1), 1);
  assert.equal(simulWith(main, 2), 1);
  assert.equal(simulWith(main, 3), null);
  // la primera de una parte nunca es simultánea
  assert.deepEqual(taskGroups([t(10, { simul: true }), t(5)]), [[0], [1]]);
  const ses = { initial: { tasks: [t(10)] }, main: { tasks: main } };
  assert.equal(sessionClock(ses), 55);
  const r = reg(ses);
  assert.equal(r.total, 82, 'trabajado: todas las tareas enteras');
  assert.equal(r.clock, 55, 'reloj: cada grupo una vez');
}
