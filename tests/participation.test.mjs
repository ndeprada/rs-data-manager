import assert from 'node:assert/strict';
import {
  participationOf, buildContext, formatOfEvent, reasonShort, NO_REASON,
  isAjeno, minutesLevel, worstLevel, minutesAlerts, playerLevel, MIN_PCT,
} from '../src/lib/participation.js';

const teams = [
  // equipo genérico (sin etapa conocida): aquí el formato lo da cada partido; los de fútbol 7 por etapa (S12 hacia abajo) se prueban más abajo
  { id: 'A', name: 'Equipo A', category: 'otra', default_match_duration: '4x15' },
  { id: 'B', name: 'Cadet S16 A', category: 'cadet_primera_divisio_s16' },
];
const mk = (id, team_id) => ({ id, team_id });
const p1 = mk('p1', 'A'), p2 = mk('p2', 'A'), p3 = mk('p3', 'A'), p4 = mk('p4', 'A');

// Cuatro partidos del equipo A (aleví: 4 cuartos de 15) y uno del equipo B (cadete: 2x40)
const events = [
  { id: 'e1', team_id: 'A', football_format: 'f7', match_duration: '4x15' },   // 60'
  { id: 'e2', team_id: 'A', football_format: 'f7' },                          // sin duración: la habitual del equipo (4x15) = 60'
  { id: 'e3', team_id: 'A', football_format: 'f11', match_duration: '2x35' },  // 70' (un partido de F11 del mismo equipo)
  { id: 'e4', team_id: 'B', football_format: 'f11' },                          // cadete: 2x40 por categoría = 80'
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

// ── p1: convocado y titular en los 4 (uno como invitado en otro equipo) ──
const a = participationOf(p1, ctx);
assert.equal(a.all.conv, 4);
assert.equal(a.all.played, 4);
assert.equal(a.all.titular, 4);
assert.equal(a.all.suplente, 0);
assert.equal(a.all.noConv, 0);
assert.equal(a.all.mins, 60 + 45 + 70 + 80);
// Convocado siempre: partidos totales = disponibles; minutos = lo que duran (cadete = 80 por su categoría)
assert.equal(a.all.totalMatches, 4);
assert.equal(a.all.availMatches, 4);
assert.equal(a.all.totalMin, 60 + 60 + 70 + 80);
assert.equal(a.all.availMin, 270);
assert.equal(a.all.pctAvail, Math.round((255 / 270) * 100));
assert.equal(a.all.pctTotal, a.all.pctAvail);
assert.equal(a.all.avgAvail, Math.round(255 / 4));
assert.equal(a.all.avgTotal, a.all.avgAvail);
// Fútbol 7: e1 (4x15) y e2 (habitual 4x15); fútbol 11: e3 y e4
assert.equal(a.f7.conv, 2);
assert.equal(a.f11.conv, 2);
assert.equal(a.f7.mins, 105);
assert.equal(a.f7.availMin, 120);
assert.equal(a.f7.pctAvail, Math.round((105 / 120) * 100));
assert.equal(a.f11.mins, 150);
assert.equal(a.f11.pctAvail, 100);
assert.equal(a.f7.avgAvail, Math.round(105 / 2));
assert.deepEqual(minutesAlerts(a), []);

// ── p2: suplente en e1, titular en e2, suplente en e3 ──
const b = participationOf(p2, ctx);
assert.equal(b.all.conv, 3);
assert.equal(b.all.titular, 1);
assert.equal(b.all.suplente, 2);
assert.equal(b.all.suplenteSin, 0);
assert.equal(b.f11.noConv, 0);
// El partido del cadete (equipo B) no cuenta para p2: no es de su equipo y no fue convocado
assert.equal(b.all.conv + b.all.noConv, 3);
assert.equal(b.all.totalMatches, 3);
assert.equal(b.all.mins, 65);
assert.equal(b.all.availMin, 190);
assert.equal(b.all.pctAvail, 34);          // 65 / 190
assert.equal(b.f7.pctAvail, 38);           // 45 / 120 = 37,5
assert.equal(b.f11.pctAvail, 29);          // 20 / 70
// Por debajo del mínimo en los dos formatos: salta una alerta por cada uno
assert.deepEqual(minutesAlerts(b), [
  { format: 'f7', pct: 38, min: 50 },
  { format: 'f11', pct: 29, min: 35 },
]);

// ── p3: no convocado en los 3 partidos de su equipo: lesión, enfermo (ajenos) y sin motivo ──
const c = participationOf(p3, ctx);
assert.equal(c.all.conv, 0);
assert.equal(c.all.noConv, 3);
assert.deepEqual(c.all.reasons, { lesion: 1, enfermo: 1, [NO_REASON]: 1 });
assert.equal(c.f7.noConv, 2);
assert.equal(c.f11.noConv, 1);
// Lesión y enfermo no cuentan como disponibles; «sin motivo» sí (0 minutos)
assert.equal(c.all.totalMatches, 3);
assert.equal(c.all.totalMin, 190);
assert.equal(c.all.availMatches, 1);
assert.equal(c.all.availMin, 70);
assert.equal(c.all.pctAvail, 0);
assert.equal(c.all.pctTotal, 0);
assert.equal(c.all.avgAvail, 0);
// En F7 ningún partido disponible: no hay porcentaje ni alerta
assert.equal(c.f7.availMatches, 0);
assert.equal(c.f7.availMin, 0);
assert.equal(c.f7.pctAvail, null);
assert.equal(c.f7.avgAvail, null);
assert.equal(c.f7.totalMatches, 2);
assert.deepEqual(minutesAlerts(c), [{ format: 'f11', pct: 0, min: 35 }]);

// ── p4: viaje (ajeno), convocado sin jugar (suplente que no entra) y sin motivo (disponible) ──
const d = participationOf(p4, ctx);
assert.deepEqual(d.all.reasons, { viaje: 1, [NO_REASON]: 1 });
assert.equal(d.all.suplente, 1);
assert.equal(d.all.suplenteSin, 1);
assert.equal(d.all.played, 0);
assert.equal(d.all.totalMatches, 3);
assert.equal(d.all.availMatches, 2);       // e2 (convocado) y e3 (sin motivo)
assert.equal(d.all.availMin, 60 + 70);
assert.equal(d.all.totalMin, 190);
assert.equal(d.all.pctAvail, 0);
assert.equal(d.f7.totalMatches, 2);        // e1 (viaje) y e2
assert.equal(d.f7.availMatches, 1);

// Un partido en el que el entrenador deja fuera al jugador sí cuenta como disponible con 0 minutos
const decision = buildContext({
  events: [{ id: 'x1', team_id: 'A', football_format: 'f11', match_duration: '2x45' }, { id: 'x2', team_id: 'A', football_format: 'f11', match_duration: '2x45' }],
  convocs: [
    { event_id: 'x1', team_id: 'A', player_ids: ['p1'], starters: ['p1'], absence_reasons: { p9: 'decision_tecnica' } },
    { event_id: 'x2', team_id: 'A', player_ids: ['p9'], starters: ['p9'] },
  ],
  stats: [st('x2', 'p9', 90)],
  teams,
});
const e = participationOf(mk('p9', 'A'), decision);
assert.equal(e.all.availMatches, 2);
assert.equal(e.all.availMin, 180);
assert.equal(e.all.mins, 90);
assert.equal(e.all.pctAvail, 50);
assert.equal(e.all.avgAvail, 45);

// Motivos ajenos al entrenador y los que no lo son
assert.equal(isAjeno('lesion'), true);
assert.equal(isAjeno('enfermo'), true);
assert.equal(isAjeno('sancion'), true);
assert.equal(isAjeno('viaje'), true);
assert.equal(isAjeno('estudios'), true);
assert.equal(isAjeno('otro'), true);
assert.equal(isAjeno('decision_tecnica'), false);
assert.equal(isAjeno('descanso'), false);
assert.equal(isAjeno(NO_REASON), false);

// Niveles: F7 alerta por debajo del 50 %; F11 alerta por debajo del 35 % y aviso por debajo del 40 % (objetivo)
assert.equal(MIN_PCT.f7.alert, 50);
assert.equal(MIN_PCT.f11.alert, 35);
assert.equal(MIN_PCT.f11.target, 40);
assert.equal(minutesLevel('f7', 49), 'alert');
assert.equal(minutesLevel('f7', 50), 'ok');
assert.equal(minutesLevel('f7', 0), 'alert');
assert.equal(minutesLevel('f11', 34), 'alert');
assert.equal(minutesLevel('f11', 35), 'warn');
assert.equal(minutesLevel('f11', 39), 'warn');
assert.equal(minutesLevel('f11', 40), 'ok');
assert.equal(minutesLevel('f11', null), null);
assert.equal(minutesLevel('otro', 10), null);
assert.equal(worstLevel(['ok', 'warn', null]), 'warn');
assert.equal(worstLevel(['ok', 'alert', 'warn']), 'alert');
assert.equal(worstLevel([null, null]), null);

// Nivel de un jugador en una vista: el peor de los formatos en que tuvo partidos disponibles
assert.equal(playerLevel(a), 'ok');                 // p1: 88 % en F7 y 100 % en F11
assert.equal(playerLevel(b), 'alert');              // p2: por debajo en los dos
assert.equal(playerLevel(b, 'f11'), 'alert');
assert.equal(playerLevel(c, 'f7'), null);           // p3: sin partidos disponibles en F7 no hay nivel
assert.equal(playerLevel(c), 'alert');              // y en F11 0 % sobre un partido disponible
assert.equal(playerLevel(e), 'ok');                 // p9: 50 % en F11, por encima del objetivo del 40 %

// Formato: el guardado o, si no, el que se deduce de la duración
assert.equal(formatOfEvent({ football_format: 'f7' }, '2x45'), 'f7');
assert.equal(formatOfEvent({}, '4x10'), 'f7');
assert.equal(formatOfEvent({}, '2x40'), 'f11');
// un equipo de S12 hacia abajo es de fútbol 7 aunque el partido venga marcado como F11 (o por duración)
assert.equal(formatOfEvent({ football_format: 'f11' }, '2x45', { name: 'Aleví S12 A' }), 'f7');
assert.equal(formatOfEvent({}, '2x40', { name: 'Aleví S12 A' }), 'f7');
assert.equal(formatOfEvent({ football_format: 'f11' }, '2x35', { name: 'Infantil S13 A' }), 'f11');

// Un equipo de S12 hacia abajo cuenta siempre como fútbol 7 en las estadísticas, aunque el partido venga marcado como F11
{
  const s12 = [{ id: 'S', name: 'Aleví S12 A', category: 'primera_divisio_alevin_s12' }];
  const ctx12 = buildContext({
    events: [{ id: 's1', team_id: 'S', football_format: 'f11' }, { id: 's2', team_id: 'S' }],
    convocs: [{ event_id: 's1', team_id: 'S', player_ids: ['q1'], starters: ['q1'] }, { event_id: 's2', team_id: 'S', player_ids: ['q1'], starters: ['q1'] }],
    stats: [{ event_id: 's1', player_id: 'q1', minutes_played: 30 }, { event_id: 's2', player_id: 'q1', minutes_played: 30 }],
    teams: s12,
  });
  const q = participationOf(mk('q1', 'S'), ctx12);
  assert.equal(q.f7.conv, 2);
  assert.equal(q.f11.conv, 0);
  assert.equal(q.f7.totalMin, 120); // 4 cuartos de 15' por ser Aleví, no 90'
}

assert.equal(reasonShort('lesion'), 'Lesión');
assert.equal(reasonShort(NO_REASON), 'Sin motivo');
