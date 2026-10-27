import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { ensureSchema, importActas, searchPlayers, playerDetail, meta, actaRows, birthYearFromCompetition, normName } from '../api/_lib/fcfDb.js';

// ── Año de nacimiento por la competición ──
assert.equal(birthYearFromCompetition('CADET SEGONA DIVISIÓ S15', '2026-2027'), 2012);
assert.equal(birthYearFromCompetition('PRIMERA DIVISIÓ ALEVÍ S12', '2026-2027'), 2015);
assert.equal(birthYearFromCompetition('INFANTIL PRIMERA DIVISIÓ S14', '2025-2026'), 2012);
assert.equal(birthYearFromCompetition('JUVENIL PRIMERA DIVISIÓ', '2026-2027'), null, 'en juveniles no se puede');
assert.equal(normName('MARTÍ  ÀLVAREZ, JOSÉ'), 'marti alvarez, jose');

// ── Un acta: goles, penaltis, propia puerta y tarjetas ──
const acta = (id, jornada, home, away, players, goals = [], cards = [], extra = {}) => ({
  acta: id, season: '2026-2027', competition: 'JUVENIL PRIMERA DIVISIÓ', group: 'GRUP 3', jornada, date: '04-10-2026',
  teams: [home, away], players, goals, cards, ...extra,
});
const P = (id, name, team, tit, dorsal = '1') => ({ id, name, team, tit, dorsal });
const a1 = acta('1001', 1, 'EQUIPO A', 'EQUIPO B', [
  P('11', 'PUIG MAS, JAN', 'EQUIPO A', true), P('12', 'FONT ROS, POL', 'EQUIPO A', false),
  P('21', 'GIL SOLA, ÈRIC', 'EQUIPO B', true), P('21', 'GIL SOLA, ÈRIC', 'EQUIPO B', true),
], [
  { id: '11', name: 'PUIG MAS, JAN', type: 'Gol' }, { id: '11', name: 'PUIG MAS, JAN', type: 'Gol de penal' },
  { id: '21', name: 'GIL SOLA, ÈRIC', type: 'Gol en pròpia porta' }, { id: null, name: '', type: 'Gol' },
], [
  { id: '12', name: 'FONT ROS, POL', type: 'A' }, { id: '12', name: 'FONT ROS, POL', type: '2A' }, { id: null, name: 'ENTRENADOR', type: 'A' },
]);
const r = actaRows(a1);
assert.equal(r.apps.length, 3, 'un jugador repetido cuenta una vez');
const jan = r.apps.find((p) => p.player_id === '11');
assert.deepEqual([jan.goals, jan.pens, jan.starter], [2, 1, true]);
assert.equal(r.apps.find((p) => p.player_id === '21').goals, 0, 'la propia puerta no se atribuye');
const pol = r.apps.find((p) => p.player_id === '12');
assert.deepEqual([pol.yellow, pol.second_yellow, pol.starter], [1, 1, false]);
assert.equal(actaRows({ ...a1, season: '26-27' }), null, 'temporada mal escrita');
assert.equal(actaRows({ ...a1, acta: 'x' }), null);

// ── Base de datos de verdad (PGlite) ──
const pg = new PGlite();
const db = {
  query: (t, p) => pg.query(t, p),
  tx: (fn) => pg.transaction((tx) => fn({ query: (t, p) => tx.query(t, p) })),
};
await ensureSchema(db);
await ensureSchema(db);
let out = await importActas(db, [a1, { acta: 'mal' }]);
assert.deepEqual(out, { saved: 1, skipped: 1 });
// Volver a mandar el mismo acta la sustituye (sin duplicar)
out = await importActas(db, [a1]);
assert.equal(out.saved, 1);
const a2 = acta('1002', 2, 'EQUIPO C', 'EQUIPO A', [
  P('11', 'PUIG MAS, JAN', 'EQUIPO A', false), P('12', 'FONT ROS, POL', 'EQUIPO A', true),
], [{ id: '12', name: 'FONT ROS, POL', type: 'Gol' }]);
// La temporada anterior en cadete S16: así se ve la trayectoria
const a0 = acta('900', 5, 'EQUIPO A S16', 'EQUIPO Z', [P('11', 'PUIG MAS, JAN', 'EQUIPO A S16', true)], [], [],
  { season: '2025-2026', competition: 'DIVISIÓ HONOR CADET S16', group: 'GRUP 1' });
await importActas(db, [a2, a0]);

const s = await searchPlayers(db, { season: '2026-2027' });
assert.equal(s.total, 3);
const sj = s.rows.find((x) => x.player_id === '11');
assert.deepEqual([sj.pj, sj.tit, sj.sup, sj.goals, sj.team], [2, 1, 1, 2, 'EQUIPO A']);
assert.equal(s.rows[0].tit >= s.rows[1].tit, true, 'por defecto, más titularidades primero');
const sp = s.rows.find((x) => x.player_id === '12');
assert.deepEqual([sp.yellow, sp.reds], [1, 1]);
assert.equal((await searchPlayers(db, { season: '2026-2027', q: 'eric' })).total, 1, 'busca sin acentos');
assert.equal((await searchPlayers(db, { season: '2026-2027', team: 'EQUIPO B' })).total, 1);
assert.equal((await searchPlayers(db, { season: '2026-2027', sort: 'goals' })).rows[0].player_id, '11');
assert.equal((await searchPlayers(db, { season: '2026-2027', limit: 1, offset: 1 })).rows.length, 1);

const d = await playerDetail(db, '11');
assert.equal(d.seasons.length, 2);
assert.equal(d.seasons[0].season, '2026-2027');
assert.equal(d.birth_year, 2010, 'S16 en 2025-26 = 2010');
assert.equal(d.matches.length, 3);
assert.equal(await playerDetail(db, 'x'), null);
assert.equal(await playerDetail(db, '999'), null);

const m = await meta(db);
assert.equal(m.players, 3);
assert.equal(m.actas, 3);
assert.deepEqual(m.seasons, ['2026-2027', '2025-2026']);

console.log('fcfDb ok');
