import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { cleanDorsals, seasonDorsals, ensureSchema, importActas, searchPlayers, playerDetail, meta, actaRows, birthYearFromCompetition, normName, compLevel, alerts, groupTeams, teamSquad, yearCounts } from '../api/_lib/fcfDb.js';

// ── Año de nacimiento por la competición ──
assert.equal(birthYearFromCompetition('CADET SEGONA DIVISIÓ S15', '2026-2027'), 2012);
assert.equal(birthYearFromCompetition('PRIMERA DIVISIÓ ALEVÍ S12', '2026-2027'), 2015);
assert.equal(birthYearFromCompetition('INFANTIL PRIMERA DIVISIÓ S14', '2025-2026'), 2012);
assert.equal(birthYearFromCompetition('JUVENIL PRIMERA DIVISIÓ', '2026-2027'), null, 'en juveniles no se puede');
assert.equal(normName('MARTÍ  ÀLVAREZ, JOSÉ'), 'marti alvarez, jose');
assert.equal(compLevel('CADET SEGONA DIVISIÓ S15'), 15);
assert.equal(compLevel('PREFERENT JUVENILS'), 17);
assert.equal(compLevel('LLIGA NACIONAL JUVENIL'), 17);
assert.equal(compLevel('TERCERA CATALANA'), null);

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

// ── Alertas, equipos de un grupo, plantilla y años ──
// Jan (11): juvenil de Primera en 2026-27 que venía de Cadet S16 → 1.º año (2010)
assert.equal((await alerts(db, '2026-2027')).filter((x) => x.kind === 'primer_ano').length, 0, 'por defecto hacen falta más de 5 titularidades');
let al = await alerts(db, '2026-2027', { minTit: 1 });
const first = al.filter((x) => x.kind === 'primer_ano');
assert.equal(first.length, 1);
assert.deepEqual([first[0].player_id, first[0].birth_year, first[0].prev_comp], ['11', 2010, 'DIVISIÓ HONOR CADET S16']);
// Un cadete S15 (31) que juega también con el S16 → «por arriba»; 32 solo juega en su categoría
const cad = (id, comp, grp, players) => acta(id, 1, 'CLUB X', 'CLUB Y', players, [], [], { competition: comp, group: grp });
await importActas(db, [
  cad('2001', 'CADET SEGONA DIVISIÓ S15', 'GRUP 6', [P('31', 'ROS PI, NIL', 'CLUB X "B"', true), P('32', 'MAS GIL, POL', 'CLUB X "B"', true)]),
  cad('2002', 'CADET SEGONA DIVISIÓ S15', 'GRUP 6', [P('31', 'ROS PI, NIL', 'CLUB X "B"', true)]),
  cad('2003', 'DIVISIÓ HONOR CADET S16', 'GRUP 1', [P('31', 'ROS PI, NIL', 'CLUB X "A"', false)]),
]);
al = await alerts(db, '2026-2027');
const upA = al.filter((x) => x.kind === 'arriba');
assert.equal(upA.length, 1);
assert.deepEqual([upA[0].player_id, upA[0].competition, upA[0].team, upA[0].own_comp, upA[0].pj, upA[0].birth_year],
  ['31', 'DIVISIÓ HONOR CADET S16', 'CLUB X "A"', 'CADET SEGONA DIVISIÓ S15', 1, 2012]);
// El año del buscador sale de su categoría propia (S15 → 2012), aunque juegue por arriba
const s31 = (await searchPlayers(db, { season: '2026-2027', q: 'ros pi' })).rows[0];
assert.equal(s31.birth_year, 2012);
assert.equal((await searchPlayers(db, { season: '2026-2027', year: 2012 })).total, 2);
assert.equal((await searchPlayers(db, { season: '2026-2027', year: 2010 })).total, 1, 'Jan: 2010 por la temporada anterior');
assert.equal((await searchPlayers(db, { season: '2026-2027', ids: '31,12' })).total, 2);
assert.equal((await searchPlayers(db, { season: '2026-2027', ids: '' })).total, 0, 'lista vacía = nadie');
const yc = await yearCounts(db, '2026-2027');
assert.deepEqual(yc.years, [{ year: 2010, n: 1 }, { year: 2012, n: 2 }]);
assert.equal(yc.unknown, 2, 'los juveniles sin temporada anterior no tienen año');
const gt = await groupTeams(db, { season: '2026-2027', competition: 'CADET SEGONA DIVISIÓ S15', grp: 'GRUP 6' });
assert.deepEqual(gt.map((t) => [t.team, t.players, t.pj]), [['CLUB X "B"', 2, 2]]);
const sq = await teamSquad(db, { season: '2026-2027', competition: 'CADET SEGONA DIVISIÓ S15', grp: 'GRUP 6', team: 'CLUB X "B"' });
assert.equal(sq.pj, 2);
assert.deepEqual(sq.players.map((p) => [p.player_id, p.pj]), [['31', 2], ['32', 1]]);
assert.equal(await teamSquad(db, { season: 'x', team: 'A' }), null);

// ── 1.º año: solo Juvenil Primera y Preferent, con más de 5 titularidades ──
{
  const juv = (id, comp, team, pid, tit = true) => acta(id, 1, team, 'RIVAL J', [P(pid, `JUGADOR ${pid}, X`, team, tit)], [], [], { competition: comp, group: 'GRUP 1' });
  const cadPrev = (id, pid) => acta(id, 1, 'CAD', 'RIVAL C', [P(pid, `JUGADOR ${pid}, X`, 'CAD', true)], [], [], { season: '2025-2026', competition: 'PREFERENT CADET S16', group: 'GRUP 1' });
  const list = [];
  for (let i = 0; i < 6; i += 1) {
    list.push(juv(`61${i}`, 'PREFERENT JUVENIL', 'PREF A', '601'));
    list.push(juv(`62${i}`, 'LLIGA NACIONAL JUVENIL', 'NAC A', '602'));
    list.push(juv(`63${i}`, 'JUVENIL SEGONA DIVISIÓ', 'SEG A', '603'));
    list.push(juv(`64${i}`, 'JUVENIL PRIMERA DIVISIÓ', 'PRI A', '604', i < 5));
  }
  list.push(cadPrev('6901', '601'), cadPrev('6902', '602'), cadPrev('6903', '603'), cadPrev('6904', '604'));
  await importActas(db, list);
  const fy = (await alerts(db, '2026-2027')).filter((x) => x.kind === 'primer_ano').map((x) => x.player_id);
  assert.deepEqual(fy, ['601'], 'Preferent con 6 titularidades sí; Nacional y Segona no; Primera con 5 aún no');
}

// ── Dorsales habituales de la temporada: el más usado primero ──
const dA = (id, j, dorsal, team = 'DORSAL FC') => acta(id, j, team, 'RIVAL', [P('77', 'DORSAL PI, NIL', team, true, dorsal)]);
await importActas(db, [dA('5001', 1, '7'), dA('5002', 2, '14'), dA('5003', 3, '7'), dA('5004', 4, ''), dA('5005', 5, '9', 'DORSAL FC "B"')]);
const s77 = (await searchPlayers(db, { season: '2026-2027', q: 'dorsal pi' })).rows[0];
assert.deepEqual(s77.dorsals, [{ d: '7', n: 2 }, { d: '9', n: 1 }, { d: '14', n: 1 }], 'más usado primero; empate: el número más corto');
const s77b = (await searchPlayers(db, { season: '2026-2027', team: 'DORSAL FC "B"' })).rows[0];
assert.deepEqual(s77b.dorsals, [{ d: '9', n: 1 }], 'con un equipo filtrado, solo sus dorsales en ese equipo');
const dm = await seasonDorsals(db, '2026-2027', ['77', '11']);
assert.equal(dm.get('77')[0].d, '7');
assert.equal(dm.get('11')[0].d, '1');
const d77 = await playerDetail(db, '77');
assert.deepEqual(d77.seasons.map((x) => [x.team, x.dorsals.map((y) => y.d)]), [['DORSAL FC', ['7', '14']], ['DORSAL FC "B"', ['9']]]);
assert.deepEqual(cleanDorsals(null), []);
assert.deepEqual(cleanDorsals('[{"d":"5","n":"3"}]'), [{ d: '5', n: 3 }]);

console.log('fcfDb ok');
