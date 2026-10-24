import assert from 'node:assert/strict';
import { COACH_AREAS } from '../src/lib/coachAreas.js';
import { OBS_BLOCKS, ALL_CRITERIA, obsSummary, NOT_OBSERVABLE } from '../src/lib/coachMethod.js';
import {
  AREA_BLOCKS, areaBlocks, areaCriteria, obsAreaOf, emptyAreaScores, emptyAreaNotes, areaSummary, aggregateArea, pruneForFormats,
} from '../src/lib/coachAreaCriteria.js';
import { QUARTERS, quarterRange, quarterOf, inRange } from '../src/lib/coachQuarters.js';
import { MODEL_BLOCKS, GAME_FORMATS, obsFormat, obsFormats, modelBlocks, criterionImages, modelImageIds } from '../src/lib/coachModelGame.js';
import { readdirSync, statSync } from 'node:fs';
import { MODEL_SCALE, OBS_SCALE, scaleOf, scaleInfo } from '../src/lib/coachMethod.js';

// ── Criterios por área ──
assert.deepEqual(Object.keys(AREA_BLOCKS).sort(), COACH_AREAS.map((a) => a.key).sort(), 'todas las áreas tienen criterios');
assert.equal(areaCriteria('habitos').length, 5);
assert.equal(areaCriteria('gestion').length, 5);
assert.equal(areaCriteria('metodologia').length, 18);
assert.equal(areaCriteria('partidos').length, 10, 'gestión del partido (sin modelo de juego: es lo que tienen las observaciones anteriores)');
assert.equal(areaCriteria('humana').length, 6);
assert.equal(areaBlocks('metodologia'), OBS_BLOCKS, 'Metodología conserva sus 18 criterios en 5 bloques');
assert.equal(areaBlocks('habitos').length, 1);
const keys = COACH_AREAS.flatMap((a) => areaCriteria(a.key, GAME_FORMATS).map((c) => c.key));
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

// ── Partido y modelo de juego: gestión del partido + indicadores del modelo según el formato (TFM 4.8.13 a 4.8.16) ──
assert.deepEqual(areaBlocks('partidos').map((b) => b.key), ['partidos'], 'sin formato: solo la gestión del partido (la clave «partidos» conserva las notas ya guardadas)');
assert.deepEqual(areaBlocks('partidos', ['f7']).map((b) => b.key), ['partidos', 'mj7_ataque', 'mj7_defensa']);
assert.deepEqual(areaBlocks('partidos', ['f11']).map((b) => b.key), ['partidos', 'mj11_ataque', 'mj11_defensa']);
assert.deepEqual(areaBlocks('partidos', ['f11', 'f7']).map((b) => b.key), ['partidos', 'mj7_ataque', 'mj7_defensa', 'mj11_ataque', 'mj11_defensa'], 'con los dos formatos, F7 primero');
assert.deepEqual(areaBlocks('partidos', ['f9']).map((b) => b.key), ['partidos'], 'un formato desconocido no añade nada');
assert.deepEqual(MODEL_BLOCKS.f7.map((b) => b.criteria.length), [5, 5], 'F7: 5 indicadores en ataque y 5 en defensa');
assert.deepEqual(MODEL_BLOCKS.f11.map((b) => b.criteria.length), [6, 6], 'F11: 6 indicadores en ataque y 6 en defensa');
assert.equal(areaCriteria('partidos', ['f7']).length, 20);
assert.equal(areaCriteria('partidos', ['f11']).length, 22);
// Las seis claves que ya existían siguen ahí (hay observaciones guardadas con ellas)
const par = areaCriteria('partidos').map((c) => c.key);
for (const k of ['par_preparacion', 'par_direccion', 'par_minutos', 'par_sistema', 'par_banquillo', 'par_charlas']) assert.ok(par.includes(k), k);
for (const k of ['par_instrucciones', 'par_correcciones', 'par_personas', 'par_errores']) assert.ok(par.includes(k), k);
// Los indicadores del TFM que Nacho citó están
const f7a = MODEL_BLOCKS.f7[0].criteria.map((c) => c.label);
const f11d = MODEL_BLOCKS.f11[1].criteria.map((c) => c.label);
for (const l of ['Posicionamiento básico', 'Juego en bloque', 'Ayudas al extremo']) assert.ok(f7a.includes(l), l);
for (const l of ['Posición y función del libre', 'Repliegue', 'Presión tras pérdida']) assert.ok(f11d.includes(l), l);
// Todos los indicadores del modelo llevan una explicación (lo que se mira) y la escala del TFM
for (const b of GAME_FORMATS.flatMap((f) => MODEL_BLOCKS[f])) {
  assert.equal(b.scale, 'model');
  for (const c of b.criteria) assert.ok(c.hint && c.hint.length > 40, `${c.key} lleva su explicación`);
}
assert.deepEqual(emptyAreaNotes('partidos', ['f7']), { partidos: '', mj7_ataque: '', mj7_defensa: '' });
assert.deepEqual(Object.keys(emptyAreaScores('partidos', ['f11'])), areaCriteria('partidos', ['f11']).map((c) => c.key));
assert.equal(areaSummary({}, 'partidos', ['f7']).total, 20);
assert.equal(areaSummary({}, 'partidos').total, 10, 'una observación anterior sigue teniendo 10 criterios');

// Escala del modelo: mismas notas 1–4 y mismos colores que la general, con las etiquetas del TFM
assert.deepEqual(MODEL_SCALE.map((s) => s.value), [1, 2, 3, 4]);
assert.deepEqual(MODEL_SCALE.map((s) => s.color), OBS_SCALE.map((s) => s.color));
assert.deepEqual(MODEL_SCALE.map((s) => s.label), ['No aparece', 'Puntual', 'Frecuente', 'Asimilado']);
assert.equal(scaleOf(MODEL_BLOCKS.f7[0]), MODEL_SCALE);
assert.equal(scaleOf(AREA_BLOCKS.partidos[0]), OBS_SCALE);
assert.equal(scaleInfo(3, MODEL_SCALE).label, 'Frecuente');
assert.equal(scaleInfo(3).label, 'Alcanzado');

// Formato de una observación
assert.equal(obsFormat({ game_format: 'f7' }), 'f7');
assert.equal(obsFormat({ game_format: 'f9' }), null);
assert.equal(obsFormat({}), null);
assert.equal(obsFormat(null), null);
assert.deepEqual(obsFormats([{ game_format: 'f11' }, {}, { game_format: 'f7' }, { game_format: 'f11' }]), ['f7', 'f11']);
assert.deepEqual(obsFormats([{}, null]), []);
assert.deepEqual(modelBlocks(['f7']).map((b) => b.key), ['mj7_ataque', 'mj7_defensa']);

// Medias: una observación de F7 puntúa gestión y modelo F7; las anteriores (sin formato) solo la gestión
const f7obs = { game_format: 'f7', scores: { par_preparacion: 4, par_banquillo: 2, mj7a_posicion: 3, mj7d_repliegue: 1, mj7d_coberturas: NOT_OBSERVABLE } };
const sf7 = areaSummary(f7obs.scores, 'partidos', ['f7']);
assert.equal(sf7.overall, 2.5);              // 4, 2, 3, 1
assert.equal(sf7.answered, 4);
assert.equal(sf7.notObservable, 1);
assert.equal(sf7.blocks.partidos.avg, 3);
assert.equal(sf7.blocks.mj7_ataque.avg, 3);
assert.equal(sf7.blocks.mj7_defensa.avg, 1);
const old = { scores: { par_preparacion: 2, par_sistema: 4 } };
const mixed = aggregateArea([f7obs, old], 'partidos');
assert.equal(mixed.count, 2);
assert.equal(mixed.blocks.partidos.avg, 3);   // 4, 2, 2, 4
assert.equal(mixed.blocks.mj7_ataque.avg, 3);
assert.equal(mixed.criteria.mj7a_posicion.avg, 3);
assert.equal(mixed.criteria.mj7d_repliegue.avg, 1);
assert.equal(mixed.criteria.par_sistema.avg, 4);
assert.equal(mixed.overall, 2.8, '(2,5 + 3) / 2 = 2,75: cada observación pesa igual');
assert.equal(mixed.blocks.mj11_ataque, undefined, 'sin observaciones de F11, no hay bloques de F11');
const both = aggregateArea([f7obs, { game_format: 'f11', scores: { mj11d_libre: 4, mj11a_extremo: 2 } }], 'partidos');
assert.equal(both.criteria.mj11d_libre.avg, 4);
assert.equal(both.blocks.mj11_defensa.avg, 4);
assert.equal(both.blocks.mj11_ataque.avg, 2);
assert.equal(both.blocks.mj7_ataque.avg, 3);
assert.equal(aggregateArea([old], 'partidos').blocks.partidos.count, 2);
assert.deepEqual(Object.keys(aggregateArea([old], 'partidos').blocks), ['partidos']);

// Cambiar de formato a medias: al guardar se quita lo del otro formato (y solo en esta área)
const pr = pruneForFormats('partidos', ['f11'], { par_preparacion: 3, mj7a_posicion: 4, mj11a_bloque: 2 }, { partidos: 'a', mj7_ataque: 'b', mj11_ataque: 'c' });
assert.deepEqual(pr.scores, { par_preparacion: 3, mj11a_bloque: 2 });
assert.deepEqual(pr.notes, { partidos: 'a', mj11_ataque: 'c' });
assert.deepEqual(pruneForFormats('partidos', [], { par_preparacion: 3, mj11a_bloque: 2 }, { mj11_defensa: 'x' }), { scores: { par_preparacion: 3 }, notes: {} }, 'sin formato se quitan los dos');
const other = { hab_puntualidad: 3 };
assert.equal(pruneForFormats('habitos', [], other, {}).scores, other, 'otras áreas no se tocan');

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

// ── Figuras del TFM de cada indicador (src/assets/modelo-juego) ──
const IMG_DIR = new URL('../src/assets/modelo-juego/', import.meta.url);
const files = readdirSync(IMG_DIR).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''));
const used = modelImageIds();
for (const id of used) assert.ok(files.includes(id), `falta el archivo de la figura ${id}`);
assert.deepEqual(files.filter((f) => !used.includes(f)), [], 'no sobra ninguna figura sin usar');
for (const id of files) assert.ok(statSync(new URL(`${id}.webp`, IMG_DIR)).size < 60 * 1024, `${id}: figura demasiado pesada (se descarga en el móvil)`);
for (const f of GAME_FORMATS) {
  for (const b of MODEL_BLOCKS[f]) {
    for (const c of b.criteria) {
      const imgs = criterionImages(c);
      assert.ok(imgs.length >= 1, `${c.key}: lleva al menos una figura`);
      assert.equal(new Set(imgs.map((i) => i.id)).size, imgs.length, `${c.key}: sin figuras repetidas`);
      // Con varias figuras, o todas tienen pie o ninguna (como en el TFM)
      const withCaption = imgs.filter((i) => i.caption).length;
      assert.ok(withCaption === 0 || withCaption === imgs.length, `${c.key}: pies a medias`);
    }
  }
}
assert.equal(criterionImages(areaBlocks('partidos')[0].criteria[0]).length, 0, 'los criterios de gestión no llevan figuras');
assert.equal(criterionImages(undefined).length, 0);
// «Juego en bloque» de F7 usa las mismas dos figuras en ataque y en defensa (así viene en el TFM)
const f7bloque = (bi) => MODEL_BLOCKS.f7[bi].criteria.find((c) => /_bloque$/.test(c.key));
assert.deepEqual(criterionImages(f7bloque(0)).map((i) => i.id), criterionImages(f7bloque(1)).map((i) => i.id));

console.log('coachAreaCriteria OK');
