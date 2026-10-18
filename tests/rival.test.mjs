process.env.DATABASE_URL ||= 'postgres://x:x@localhost:5432/x'; // el módulo abre un pool perezoso: nunca llega a conectar en este test
import assert from 'node:assert/strict';
const m = await import('../api/_lib/fcfRival.js');
const row = (id, name, pos, pts, pj, w, d, l, gf, gc) => ({ position: String(pos), points: String(pts), played: pj, won: w, drawn: d, lost: l, goalsFor: String(gf), goalsAgainst: String(gc), team: { teamId: id, name, logo: 'x.png' } });
const table = [row('1', 'BASE ROSES, C.F. A', 1, 13, 5, 4, 1, 0, 11, 3), row('2', 'NOSOTROS, E.F. A', 2, 10, 5, 3, 1, 1, 9, 5), row('3', "L'ESCALA, F.C. A", 3, 9, 5, 3, 0, 2, 12, 6)];
const mt = (j, h, a, gh, ga, d) => ({ JORNADA: String(j), CODACTA: String(100 + j), CODEQUIPO_CASA: h, NOMBRE_CASA: h === '1' ? 'BASE ROSES, C.F. A' : h === '2' ? 'NOSOTROS, E.F. A' : "L'ESCALA, F.C. A", CODEQUIPO_FUERA: a, NOMBRE_FUERA: a === '1' ? 'BASE ROSES, C.F. A' : a === '2' ? 'NOSOTROS, E.F. A' : "L'ESCALA, F.C. A", GOLES_CASA: gh, GOLES_FUERA: ga, COMIENZO1: d });
const matches = { 1: [mt(1, '1', '3', '3', '0', '2026-09-19T17:00:00')], 2: [mt(2, '2', '1', '1', '2', '2026-09-26T17:00:00')], 3: [mt(3, '3', '1', '0', '1', '2026-10-03T17:00:00')], 4: [mt(4, '1', '2', '2', '0', '2026-10-10T17:00:00')], 5: [mt(5, '3', '1', null, null, '2026-10-27T21:00:00')] };
const scorers = [{ codequipo: '1', nombre_jugador: 'MBALLOW BALDEH, MAMADOU', goles: 6 }, { codequipo: '1', nombre_jugador: 'PEREZ, ANA', goles: 2 }, { codequipo: '3', nombre_jugador: 'OTRO, X', goles: 9 }];
const r = m.buildReport({ table, matches, scorers, ourCode: '2', rivalCode: '1', competition: 'TERCERA', group: 'GRUP 1' });

assert.equal(r.rival.name, 'Base Roses, C.F. A');
assert.equal(r.form.length, 4);
assert.equal(r.form[0].result, 'G');             // el más reciente primero (10 oct: 2-0 a nosotros)
assert.equal(r.home.pj, 2); assert.equal(r.away.pj, 2);
assert.equal(r.scorers[0].name, 'Mamadou Mballow Baldeh');
assert.ok(r.insights.some(x => /Racha de 4 victorias/.test(x)));
assert.ok(r.insights.some(x => /Depende de Mamadou/.test(x)));
assert.ok(r.insights.some(x => /Ya os enfrentasteis: perdisteis 0-2 jugando fuera/.test(x)));
assert.equal(r.next.length, 1);

