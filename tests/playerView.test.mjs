import assert from 'node:assert/strict';
import { playerView } from '../api/_lib/access.js';

// Lo que recibe un jugador desde el servidor: las valoraciones y notas del entrenador son internas
const scope = { playerId: 'P1', teamId: 'T1' };
const view = (entity, doc) => playerView(entity, doc, scope, 'u1');

// Estadísticas de partido: sus minutos y goles sí; las estrellas y las notas, no
const ms = { id: 'm1', player_id: 'P1', event_id: 'E1', minutes_played: 90, goals: 1, assists: 0, rating: 3, notes: 'Mejorar la presión' };
assert.deepEqual(view('MatchStats', ms), { id: 'm1', player_id: 'P1', event_id: 'E1', minutes_played: 90, goals: 1, assists: 0 });
assert.equal(view('MatchStats', { ...ms, player_id: 'P2' }), null, 'las de un compañero no las ve');

// Historial de temporadas: PJ, minutos, goles… sí; la valoración media y las notas, no
const hist = { id: 'h1', player_id: 'P1', season: '2025-2026', team_name: 'Juvenil A', matches_played: 20, minutes_played: 1500, goals: 3, assists: 2, avg_rating: 2.4, notes: 'Nota interna' };
const h = view('PlayerSeasonHistory', hist);
assert.equal(h.avg_rating, undefined);
assert.equal(h.notes, undefined);
assert.deepEqual([h.season, h.matches_played, h.minutes_played, h.goals, h.assists], ['2025-2026', 20, 1500, 3, 2]);
assert.equal(view('PlayerSeasonHistory', { ...hist, player_id: 'P2' }), null);

// Asistencia a entrenos: sin notas del entrenador
const att = { id: 'a1', player_id: 'P1', status: 'present', notes: 'Llegó tarde', absence_reason: null };
assert.equal(view('TrainingAttendance', att).notes, undefined);
assert.equal(view('TrainingAttendance', att).status, 'present');

// Partidos de su equipo: sin notas internas
assert.equal(view('Event', { id: 'e1', team_id: 'T1', type: 'partido_liga', notes: 'interno' }).notes, undefined);

// Eventos cancelados: el jugador sí ve que se han cancelado y el motivo (lluvia, festivo…)
const off = view('Event', { id: 'e2', team_id: 'T1', type: 'entrenamiento', cancelled: true, cancel_reason: 'lluvia', notes: 'interno' });
assert.equal(off.cancelled, true);
assert.equal(off.cancel_reason, 'lluvia');
assert.equal(off.notes, undefined);

// Su ficha: completa, salvo la valoración de la pierna no hábil (interna del cuerpo técnico)
const me = { id: 'P1', first_name: 'Ulises', last_name: 'Martí', team_id: 'T1', laterality: 'diestro', weak_foot_rating: 2, phone: '600' };
const mine = view('Player', me);
assert.equal(mine.weak_foot_rating, undefined, 'el jugador no recibe la valoración de su pierna no hábil');
assert.equal(mine.laterality, 'diestro');
assert.equal(mine.phone, '600');
assert.equal(me.weak_foot_rating, 2, 'no se toca el original');
// Compañeros: solo los datos mínimos, nunca la valoración
const mate = view('Player', { id: 'P2', first_name: 'Leo', team_id: 'T1', laterality: 'zurdo', weak_foot_rating: 5 });
assert.equal(mate.weak_foot_rating, undefined);
assert.equal(mate.laterality, undefined);

console.log('playerView ok');
