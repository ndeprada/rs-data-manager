import assert from 'node:assert/strict';
import { COACH_AREAS } from '../src/lib/coachAreas.js';
import { OBS_BLOCKS, ALL_CRITERIA, obsSummary, NOT_OBSERVABLE } from '../src/lib/coachMethod.js';
import {
  AREA_BLOCKS, areaBlocks, areaCriteria, obsAreaOf, emptyAreaScores, emptyAreaNotes, areaSummary, aggregateArea,
} from '../src/lib/coachAreaCriteria.js';
import { QUARTERS, quarterRange, quarterOf, inRange } from '../src/lib/coachQuarters.js';

// ── Criterios por área ──
assert.deepEqual(Object.keys(AREA_BLOCKS).sort(), COACH_AREAS.map((a) => a.key).sort(), 'todas las áreas tienen criterios');
assert.equal(areaCriteria('habitos').length, 5);
assert.equal(areaCriteria('gestion').length, 5);
assert.equal(areaCriteria('metodologia').length, 18);
assert.equal(areaCriteria('partidos').length, 6);
assert.equal(areaCriteria('humana').length, 6);
assert.equal(areaBlocks('metodologia'), OBS_BLOCKS, 'Metodología conserva sus 18 criterios en 5 bloques');
assert.equal(areaBlocks('habitos').length, 1);
const keys = COACH_AREAS.flatMap((a) => areaCriteria(a.key).map((c) => c.key));
assert.equal(new Set(keys).size, keys.length, 'claves de criterio únicas entre áreas');
assert.equal(areaBlocks('inventada'), OBS_BLOCKS, 'un área desconocida cae en Metodología');

// ── Observaciones antiguas (sin área) = Metodología ──
assert.equal(obsAreaOf({ scores: {} }), 'metodologia');
assert.equal(obsAreaOf({ area: 'humana' }), 'humana');
assert.equal(obsAreaOf({ area: 'x' }), 'metodologia');
assert.equal(obsAreaOf(null), 'metodologia');
assert.deepEqual(Object.keys(emptyAreaScores('partidos')), areaCriteria('partidos').map((c) => c.key));
assert.deepEqual(Object.keys(emptyAreaNotes('metodologia')), OBS_BLOCKS.map((b) => b.key));
assert.deepEqual(Object.keys(emptyAreaNotes('habitos')), ['habitos'], 'un solo bloque = una nota');

// ── Medias de una observación: igual que antes para Metodología ──
const sc = { tipo_contenidos: 3, tipo_jugadores: 4, ini_tecnica: 1 };
assert.deepEqual(areaSummary(sc, 'metodologia'), obsSummary(sc));
assert.equal(obsSummary(sc).total, ALL_CRITERIA.length);
const h = areaSummary({ hab_puntualidad: 4, hab_vestuario: 2, hab_material: NOT_OBSERVABLE }, 'habitos');
assert.equal(h.overall, 3);
assert.equal(h.answered, 2);
assert.equal(h.notObservable, 1);
assert.equal(h.total, 5);
assert.equal(h.blocks.habitos.avg, 3);

// ── Resumen de varias observaciones ──
let agg = aggregateArea([], 'habitos');
assert.equal(agg.count, 0);
assert.equal(agg.overall, null);
assert.equal(agg.criteria.hab_puntualidad.avg, null);
agg = aggregateArea([
  { scores: { hab_puntualidad: 4, hab_vestuario: 2 } },                    // media 3
  { scores: { hab_puntualidad: 2, hab_vestuario: NOT_OBSERVABLE, hab_material: 4 } }, // media 3
  { scores: {} },                                                          // sin valorar: no cuenta
], 'habitos');
assert.equal(agg.count, 3);
assert.equal(agg.scored, 2);
assert.equal(agg.overall, 3);
assert.equal(agg.criteria.hab_puntualidad.avg, 3);
assert.equal(agg.criteria.hab_puntualidad.count, 2);
assert.equal(agg.criteria.hab_vestuario.avg, 2, 'el no observable no cuenta');
assert.equal(agg.criteria.hab_vestuario.count, 1);
assert.equal(agg.criteria.hab_material.avg, 4);
assert.equal(agg.criteria.hab_normas.avg, null);
assert.equal(agg.blocks.habitos.avg, 3);     // valores sueltos: 4, 2, 2, 4
assert.equal(agg.blocks.habitos.count, 4);

// Metodología agrupa por bloque con los 18 criterios
const m = aggregateArea([{ scores: { tipo_contenidos: 4, tipo_jugadores: 2, ini_tecnica: 1 } }, { scores: { tipo_contenidos: 2 } }], 'metodologia');
assert.equal(m.blocks.tipo.avg, 2.7);        // 4, 2, 2
assert.equal(m.blocks.inicial.avg, 1);
assert.equal(m.blocks.final.avg, null);
assert.equal(m.criteria.tipo_contenidos.avg, 3);
assert.equal(m.overall, 2.2);                 // (7/3 + 2) / 2 = 2,17 → las medias de cada observación se promedian sin redondear antes
assert.equal(areaSummary({ tipo_contenidos: 4 }, 'metodologia').total, 18);

// ── Trimestres: 3 por temporada, la temporada empieza en agosto ──
assert.deepEqual(QUARTERS.map((q) => q.id), ['q1', 'q2', 'q3']);
assert.deepEqual(quarterRange('2026-2027', 'q1'), { from: '2026-08-01', to: '2026-12-31' });
assert.deepEqual(quarterRange('2026-2027', 'q2'), { from: '2027-01-01', to: '2027-03-31' });
assert.deepEqual(quarterRange('2026-2027', 'q3'), { from: '2027-04-01', to: '2027-07-31' });
assert.deepEqual(quarterRange('2026-2027', 'all'), { from: '2026-08-01', to: '2027-07-31' });
assert.equal(quarterOf('2026-10-22'), 'q1');
assert.equal(quarterOf('2026-12-31'), 'q1');
assert.equal(quarterOf('2027-01-01'), 'q2');
assert.equal(quarterOf('2027-03-31T18:00'), 'q2');
assert.equal(quarterOf('2027-04-01'), 'q3');
assert.equal(quarterOf('2027-07-15'), 'q3');
assert.equal(quarterOf('2026-08-01'), 'q1');
// Cada día de la temporada cae en un único trimestre
for (const d of ['2026-08-01', '2026-11-15', '2026-12-31', '2027-01-01', '2027-03-31', '2027-04-01', '2027-07-31']) {
  const q = quarterOf(d);
  assert.equal(['q1', 'q2', 'q3'].filter((id) => inRange(d, quarterRange('2026-2027', id))).join(), q, d);
}
assert.equal(inRange('2027-01-01T10:00', quarterRange('2026-2027', 'q1')), false);
assert.equal(inRange('2026-12-31T23:00', quarterRange('2026-2027', 'q1')), true, 'con hora también');
assert.equal(inRange('', quarterRange('2026-2027', 'q1')), false);

console.log('coachAreaCriteria OK');
