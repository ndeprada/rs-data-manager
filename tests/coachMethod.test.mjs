import assert from 'node:assert/strict';
import {
  OBS_SCALE, OBS_BLOCKS, ALL_CRITERIA, NOT_OBSERVABLE, emptyScores, emptyNotes, obsSummary, avgColor, sinceDate,
  finalGameOf, coachIndicators, isScored,
} from '../src/lib/coachMethod.js';
import { emptySession, emptyTask, contentId } from '../src/lib/sessionPlan.js';

// ── Criterios y escala ──
assert.equal(OBS_BLOCKS.length, 5);
assert.equal(ALL_CRITERIA.length, 18);
assert.equal(new Set(ALL_CRITERIA.map((c) => c.key)).size, 18, 'claves únicas');
assert.deepEqual(OBS_SCALE.map((s) => s.value), [1, 2, 3, 4]);
assert.ok(isScored(1) && isScored(4) && !isScored(0) && !isScored(5) && !isScored(null) && !isScored('3') && !isScored(2.5));
assert.deepEqual(Object.keys(emptyScores()), ALL_CRITERIA.map((c) => c.key));
assert.deepEqual(Object.keys(emptyNotes()), OBS_BLOCKS.map((b) => b.key));

// ── Medias ──
let sc = emptyScores();
let r = obsSummary(sc);
assert.equal(r.overall, null);
assert.equal(r.answered, 0);
assert.equal(r.blocks.tipo.avg, null);
sc = { ...sc, tipo_contenidos: 3, tipo_jugadores: 4, tipo_dimensiones: 2, tipo_partido: NOT_OBSERVABLE, ini_tecnica: 1 };
r = obsSummary(sc);
assert.equal(r.blocks.tipo.avg, 3);            // (3+4+2)/3: el «no observable» no cuenta
assert.equal(r.blocks.tipo.count, 3);
assert.equal(r.blocks.inicial.avg, 1);
assert.equal(r.notObservable, 1);
assert.equal(r.answered, 4);
assert.equal(r.overall, 2.5);                  // (3+4+2+1)/4
assert.equal(avgColor(null), '#9ca3af');
assert.equal(avgColor(1.2), OBS_SCALE[0].color);
assert.equal(avgColor(2.4), OBS_SCALE[1].color);
assert.equal(avgColor(3), OBS_SCALE[2].color);
assert.equal(avgColor(3.8), OBS_SCALE[3].color);

// ── Periodo ──
assert.equal(sinceDate('season', '2026-10-22'), '');
assert.equal(sinceDate('30', '2026-10-22'), '2026-09-22');
assert.equal(sinceDate('7', '2026-10-05'), '2026-09-28');

// ── Indicadores ──
const task = (over = {}) => ({ ...emptyTask('principal'), serie_min: 10, ...over });
const sessionOf = (over = {}, initial = [], main = []) => ({
  ...emptySession({ teamId: 't1', date: '2026-10-01', stage: 'rend', type: 'juego_colectivo' }),
  initial: { tasks: initial }, main: { tasks: main }, ...over,
});

// Sin sesiones: solo cuenta los entrenamientos
let ind = coachIndicators({ sessions: [], trainings: [{ id: 'e1', team_id: 't1', date: '2026-10-01T18:00' }], stage: 'rend' });
assert.equal(ind.hasData, false);
assert.equal(ind.trainings, 1);
assert.equal(ind.withSession, 0);
assert.equal(ind.pctSessions, 0);
assert.equal(coachIndicators({ sessions: [], trainings: [], stage: 'rend' }).pctSessions, null);

const tecnica = contentId('tecnica', 'Pases');
const habito = contentId('habitos', 'Comunicación');
const ocOf = contentId('oc_of', 'Ocupación racional del terreno');
const fuera = contentId('abp', 'Córner ofensivo'); // en Iniciación I no hay balón parado

// Partido final: la última tarea principal, si es de tipo partido
const withFinal = sessionOf({}, [task({ id: 'i1', type: 'activacion', no_curriculum: true })], [
  task({ id: 'm1', type: 'juego_posicion', serie_min: 20, principal: [ocOf], corrections: 'Más amplitud' }),
  task({ id: 'm2', type: 'partido', serie_min: 20, principal: [ocOf], corrections: '' }),
]);
const noFinal = sessionOf({ date: '2026-10-03' }, [task({ id: 'i2', serie_min: 10, principal: [tecnica], corrections: 'Orientar el control' })], [
  task({ id: 'm3', type: 'rondo', serie_min: 30, principal: [ocOf] }),
]);
assert.equal(finalGameOf(withFinal).id, 'm2');
assert.equal(finalGameOf(noFinal), null);

ind = coachIndicators({
  sessions: [withFinal, noFinal],
  trainings: [
    { id: 'e1', team_id: 't1', date: '2026-10-01T18:00' },          // sesión de ese día
    { id: 'e2', team_id: 't1', date: '2026-10-02T18:00' },          // sin sesión
    { id: 'e3', team_id: 't1', date: '2026-10-03T18:00' },          // sesión de ese día
    { id: 'e4', team_id: 't1', date: '2026-10-04T18:00' },          // sin sesión
  ],
  stage: 'rend',
});
assert.equal(ind.hasData, true);
assert.equal(ind.sessions, 2);
assert.equal(ind.trainings, 4);
assert.equal(ind.withSession, 2);
assert.equal(ind.pctSessions, 50);
// Partido final: 1 de 2 sesiones; 20' de 50' (10' de activación + 40' principal) en la primera
assert.equal(ind.finalGame.sessions, 2);
assert.equal(ind.finalGame.withFinal, 1);
assert.equal(ind.finalGame.pct, 50);
assert.equal(ind.finalGame.avgMin, 20);
assert.equal(ind.finalGame.avgPct, 40);
// Correcciones: tareas con contenido y minutos = m1, m2, i2, m3 → con texto: m1 e i2
assert.equal(ind.corrections.tasks, 4);
assert.equal(ind.corrections.withText, 2);
assert.equal(ind.corrections.pct, 50);
// Parte inicial: solo la 2.ª sesión trabaja técnica; la 1.ª solo activación
assert.equal(ind.initial.sessions, 2);
assert.equal(ind.initial.withTechHabits, 1);
assert.equal(ind.initial.pct, 50);
// Currículum: todos los contenidos son de Rendimiento
assert.equal(ind.curriculum.tasks, 4);
assert.equal(ind.curriculum.outside, 0);
assert.equal(ind.curriculum.pct, 100);
assert.ok(ind.minutes > 0);
assert.equal(ind.blocks.ok + ind.blocks.revisar + ind.blocks.alerta, 9, 'Rendimiento contempla los nueve bloques');

// Contenido fuera del currículum de la etapa (córner en Iniciación I)
const outside = sessionOf({ stage: 'inic1' }, [], [task({ type: 'abp', serie_min: 10, principal: [fuera] }), task({ serie_min: 10, principal: [tecnica] })]);
ind = coachIndicators({ sessions: [outside], trainings: [], stage: 'inic1' });
assert.equal(ind.curriculum.tasks, 2);
assert.equal(ind.curriculum.outside, 1);
assert.equal(ind.curriculum.pct, 50);
assert.equal(ind.blocks.ok + ind.blocks.revisar + ind.blocks.alerta, 9, 'el balón parado tiene tiempo aunque la etapa no lo pida');

// Una tarea vacía o de preparación física no cuenta para correcciones
const pf = sessionOf({}, [], [task({ type: 'pf', no_curriculum: true, serie_min: 15 }), task({ serie_min: 0, principal: [tecnica] })]);
ind = coachIndicators({ sessions: [pf], trainings: [], stage: 'rend' });
assert.equal(ind.corrections.tasks, 0);
assert.equal(ind.corrections.pct, null);

// El enlace por evento también cuenta aunque cambie la fecha
const linked = sessionOf({ date: '2026-10-09', event_id: 'e9' }, [], [task({ principal: [habito] })]);
ind = coachIndicators({ sessions: [linked], trainings: [{ id: 'e9', team_id: 't1', date: '2026-10-08T18:00' }], stage: 'rend' });
assert.equal(ind.withSession, 1);

// En Iniciación I el balón parado no existe: sin tiempo ahí no cuenta como bloque
ind = coachIndicators({ sessions: [sessionOf({ stage: 'inic1' }, [], [task({ principal: [tecnica] })])], trainings: [], stage: 'inic1' });
assert.equal(ind.blocks.ok + ind.blocks.revisar + ind.blocks.alerta, 8);

// Sin etapa reconocida no se compara con la referencia, pero el resto sí se calcula
ind = coachIndicators({ sessions: [withFinal], trainings: [], stage: null });
assert.equal(ind.blocks.ok + ind.blocks.revisar + ind.blocks.alerta, 0);
assert.equal(ind.finalGame.withFinal, 1);

console.log('coachMethod OK');
