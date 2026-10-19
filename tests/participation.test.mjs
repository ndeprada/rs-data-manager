import assert from 'node:assert/strict';
import { participationOf, buildContext, quartersPlayed, quarterLength, formatOfEvent, reasonShort, NO_REASON } from '../src/lib/participation.js';

const teams = [
  { id: 'A', name: 'Aleví S11 A', category: 'primera_divisio_alevin_s11' },
  { id: 'B', name: 'Cadet S16 A', category: 'cadet_primera_divisio_s16' },
];
const mk = (id, team_id) => ({ id, team_id });
const p1 = mk('p1', 'A'), p2 = mk('p2', 'A'), p3 = mk('p3', 'A'), p4 = mk('p4', 'A');

// Cuatro partidos del equipo A (aleví: 4 cuartos de 15) y uno del equipo B (cadete: 2x40)
const events = [
  { id: 'e1', team_id: 'A', football_format: 'f7', match_duration: '4x15' },
  { id: 'e2', team_id: 'A', football_format: 'f7' },                          // sin duración: la habitual del equipo (4x15)
  { id: 'e3', team_id: 'A', football_format: 'f11', match_duration: '2x35' },  // un partido de F11 del mismo equipo
  { id: 'e4', team_id: 'B', football_format: 'f11' },                          // cadete: 2x40 por categoría
];
const convocs = [
  { event_id: 'e1', team_id: 'A', player_ids: ['p1', 'p2'], starters: ['p1'], absence_reasons: { p3: 'lesion', p4: 'viaje' } },
  { event_id: 'e2', team_id: 'A', player_ids: ['p1', 'p2', 'p4'], starters: ['p1', 'p2'], absence_reasons: { p3: 'enfermo' } },
  { event_id: 'e3', team_id: 'A', player_ids: ['p1', 'p2'], starters: ['p1'] },                      // p3 y p4 sin motivo
  { event_id: 'e4', team_id: 'B', player_ids: ['p1'], starters: ['p1'] },                           // p1 de invitado en el cadete
];
const st = (event_id, player_id, minutes_played) => ({ event_id, player_id, minutes_played });
const stats = [
  st('e1', 'p1', 60), st('e1', 'p2', 30),
  st('e2', 'p1', 45), st('e2', 'p2', 15), st('e2', 'p4', 0),
  st('e3', 'p1', 70), st('e3', 'p2', 20),
  st('e4', 'p1', 80),
];
const ctx = buildContext({ events, convocs, stats, teams });

// p1: titular en los 4 (uno como invitado en otro equipo)
const a = participationOf(p1, ctx);
assert.equal(a.all.conv, 4);
assert.equal(a.all.played, 4);
assert.equal(a.all.titular, 4);
assert.equal(a.all.suplente, 0);
assert.equal(a.all.noConv, 0);
assert.equal(a.all.mins, 60 + 45 + 70 + 80);
// Fútbol 7: e1 (4x15) y e2 (habitual 4x15); fútbol 11: e3 y e4
assert.equal(a.f7.conv, 2);
assert.equal(a.f11.conv, 2);
assert.equal(a.f7.mins, 105);
assert.equal(a.f7.availMin, 120);
assert.equal(a.f7.pctMin, Math.round((105 / 120) * 100));
// Minutos disponibles: lo que duran los partidos en que fue convocado (cadete = 80 por su categoría)
assert.equal(a.all.availMin, 60 + 60 + 70 + 80);
// Cuartos en F7: e1 60/15 = 4 cuartos, e2 45/15 = 3 cuartos
assert.equal(a.f7.qMatches, 2);
assert.deepEqual(a.f7.qHist, [0, 0, 0, 1, 1]);
assert.equal(a.f7.qTotal, 7);
assert.equal(a.f7.qAvg, 3.5);
// En F11 no hay cuartos
assert.equal(a.f11.qMatches, 0);
assert.equal(a.f11.qAvg, null);

// p2: suplente en e1, titular en e2, suplente en e3
const b = participationOf(p2, ctx);
assert.equal(b.all.conv, 3);
assert.equal(b.all.titular, 1);
assert.equal(b.all.suplente, 2);
assert.equal(b.all.suplenteSin, 0);
assert.equal(b.f7.qHist[2], 1);   // 30' = 2 cuartos
assert.equal(b.f7.qHist[1], 1);   // 15' = 1 cuarto
assert.equal(b.f11.noConv, 0);
// El partido del cadete (equipo B) no cuenta para p2: no es de su equipo y no fue convocado
assert.equal(b.all.conv + b.all.noConv, 3);

// p3: no convocado en los 3 partidos de su equipo (lesión, enfermo, sin motivo)
const c = participationOf(p3, ctx);
assert.equal(c.all.conv, 0);
assert.equal(c.all.noConv, 3);
assert.deepEqual(c.all.reasons, { lesion: 1, enfermo: 1, [NO_REASON]: 1 });
assert.equal(c.f7.noConv, 2);
assert.equal(c.f11.noConv, 1);
assert.equal(c.all.pctMin, null);

// p4: viaje, convocado sin jugar (suplente que no entra) y sin motivo
const d = participationOf(p4, ctx);
assert.deepEqual(d.all.reasons, { viaje: 1, [NO_REASON]: 1 });
assert.equal(d.all.suplente, 1);
assert.equal(d.all.suplenteSin, 1);
assert.equal(d.all.played, 0);
assert.equal(d.f7.qHist[0], 1);   // convocado en F7 y no jugó ningún cuarto
assert.equal(d.f7.qAvg, null);

// Cuartos: minutos ÷ duración del cuarto, redondeado, mínimo 1 si ha jugado
assert.equal(quartersPlayed(60, 15), 4);
assert.equal(quartersPlayed(45, 15), 3);
assert.equal(quartersPlayed(22, 15), 1);
assert.equal(quartersPlayed(23, 15), 2);
assert.equal(quartersPlayed(4, 15), 1);
assert.equal(quartersPlayed(0, 15), 0);
assert.equal(quartersPlayed(70, 15), 4);
assert.equal(quartersPlayed(50, null), 0);
assert.equal(quarterLength('4x12'), 12);
assert.equal(quarterLength('2x40'), null);

// Formato: el guardado o, si no, el que se deduce de la duración
assert.equal(formatOfEvent({ football_format: 'f7' }, '2x45'), 'f7');
assert.equal(formatOfEvent({}, '4x10'), 'f7');
assert.equal(formatOfEvent({}, '2x40'), 'f11');

assert.equal(reasonShort('lesion'), 'Lesión');
assert.equal(reasonShort(NO_REASON), 'Sin motivo');
