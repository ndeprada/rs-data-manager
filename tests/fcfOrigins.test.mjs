import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { ensureSchema, importActas } from '../api/_lib/fcfDb.js';
import { originProposals, originPatch, nameFits, pickCandidate, currentSeason } from '../api/_lib/fcfOrigins.js';

assert.equal(currentSeason(new Date(2026, 10, 13)), '2026-2027');
assert.equal(currentSeason(new Date(2027, 2, 1)), '2026-2027');
assert.ok(nameFits({ first_name: 'Jan', last_name: 'Puig Mas' }, 'PUIG MAS, JAN'));
assert.ok(nameFits({ first_name: 'Jan', last_name: 'Puig' }, 'PUIG MAS, JAN'), 'ficha a mano con un apellido');
assert.ok(!nameFits({ first_name: 'Jan', last_name: 'Puig' }, 'PUIGDEMONT MAS, JAN'));
assert.ok(!nameFits({ first_name: 'Jan', last_name: 'Puig' }, 'PUIG MAS, JANET'));
assert.equal(pickCandidate({}, []).reason, 'sin_fcf');
assert.equal(pickCandidate({ birth_year: 2012 }, [{ fcf_id: '1', club: false, birth_year: 2011 }, { fcf_id: '2', club: false, birth_year: 2012 }]).pick.fcf_id, '2');
assert.equal(pickCandidate({}, [{ fcf_id: '1', club: true }, { fcf_id: '2', club: false }]).pick.fcf_id, '1');
assert.equal(pickCandidate({}, [{ fcf_id: '1' }, { fcf_id: '2' }]).reason, 'dudoso');

const pg = new PGlite();
const db = {
  query: (t, p) => pg.query(t, p),
  tx: (fn) => pg.transaction((tx) => fn({ query: (t, p) => tx.query(t, p) })),
};
await ensureSchema(db);
const A = (acta, season, comp, home, away, players) => ({ acta, season, competition: comp, group: 'GRUP 1', jornada: 1, date: '01-10-2026', teams: [home, away], players });
const P = (id, name, team, dorsal = '7') => ({ id, name, team, tit: true, dorsal });
await importActas(db, [
  // Esta temporada con el club
  A('1', '2026-2027', 'CADET PRIMERA DIVISIÓ S15', 'RACING SARRIÀ, C.F. A', 'CAN BUXERES, F.C. A', [
    P('11', 'PUIG MAS, JAN', 'RACING SARRIÀ, C.F. A'), P('12', 'FONT ROS, POL', 'RACING SARRIÀ, C.F. A'), P('13', 'NOU NOU, ARAN', 'RACING SARRIÀ, C.F. A'),
  ]),
  // Temporada anterior: Jan en otro club, Pol en el club
  A('2', '2025-2026', 'INFANTIL PRIMERA DIVISIÓ S14', 'CAN BUXERES, F.C. A', 'RACING SARRIÀ, C.F. B', [
    P('11', 'PUIG MAS, JAN', 'CAN BUXERES, F.C. A'), P('12', 'FONT ROS, POL', 'RACING SARRIÀ, C.F. B'),
  ]),
  // Hace dos temporadas: alguien con el mismo nombre que Pol en otro club (no es él)
  A('3', '2024-2025', 'INFANTIL PRIMERA DIVISIÓ', 'SANT ANDREU, U.E A', 'X', [P('99', 'FONT ROS, POL', 'SANT ANDREU, U.E A')]),
  // Marc solo jugó hace dos temporadas
  A('4', '2024-2025', 'ALEVÍ PRIMERA DIVISIÓ S12', 'PENYA BLAUGRANA, A', 'X', [P('20', 'GIL SOLA, MARC', 'PENYA BLAUGRANA, A')]),
]);
const players = [
  { id: 'a', data: { first_name: 'Jan', last_name: 'Puig Mas', team_id: 't1' } },
  { id: 'b', data: { first_name: 'Pol', last_name: 'Font Ros', team_id: 't1' } },
  { id: 'c', data: { first_name: 'Aran', last_name: 'Nou Nou', team_id: 't1' } },
  { id: 'd', data: { first_name: 'Marc', last_name: 'Gil', team_id: 't1' } },
  { id: 'e', data: { first_name: 'Leo', last_name: 'Ningú', team_id: 't1' } },
  { id: 'f', data: { first_name: 'Jan', last_name: 'Puig Mas', team_id: 't2', previous_club: 'Escola Pia' } },
  { id: 'g', data: { first_name: 'Old', last_name: 'Baja', status: 'baja' } },
];
const rows = await originProposals(db, players, { season: '2026-2027', clubName: 'RACING SARRI' });
const by = Object.fromEntries(rows.map((r) => [r.id, r]));
assert.equal(rows.length, 6, 'las bajas no cuentan');
assert.equal(by.a.status, 'ok');
assert.equal(by.a.origin.team, 'CAN BUXERES, F.C. A');
assert.equal(by.a.origin.club, false);
assert.equal(by.b.fcf_id, '12', 'entre dos con el mismo nombre, el que ha jugado con el club');
assert.equal(by.b.origin.team, 'RACING SARRIÀ, C.F. B');
assert.equal(by.b.origin.club, true);
assert.equal(by.c.status, 'sin_anterior');
assert.equal(by.d.status, 'ok', 'ficha a mano con un apellido');
assert.equal(by.d.origin.season, '2024-2025');
assert.equal(by.d.origin.last_season, false);
assert.equal(by.e.status, 'sin_fcf');
assert.equal(by.f.status, 'manual', 'lo escrito a mano no se toca');
assert.equal(originPatch(by.f), null);
assert.deepEqual(originPatch(by.a), { fcf_player_id: '11', previous_club: 'CAN BUXERES, F.C. A', previous_club_source: 'fcf', previous_club_season: '2025-2026', previous_club_comp: 'INFANTIL PRIMERA DIVISIÓ S14' });
assert.deepEqual(originPatch(by.c), { fcf_player_id: '13' });
assert.equal(originPatch(by.e), null);
console.log('fcfOrigins ok');
