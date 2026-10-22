// Criterios de observación de cada área de la Evaluación 360 de entrenadores.
// Misma escala que la observación de Metodología (1 No alcanzado · 2 Parcial · 3 Alcanzado · 4 Superado + No observable).
// Metodología conserva sus 18 criterios en 5 bloques (coachMethod.js); las demás áreas tienen un solo bloque.
// Sin importaciones de la app (salvo la marca de traducción): se usa también en los tests.
import { msg } from "../i18n/translate.js";
import { OBS_BLOCKS, isScored, obsSummary, round1 } from "./coachMethod.js";
import { COACH_AREAS } from "./coachAreas.js";

const single = (areaKey, criteria) => {
  const a = COACH_AREAS.find((x) => x.key === areaKey);
  return [{ key: areaKey, label: a.label, color: a.color, criteria }];
};

export const AREA_BLOCKS = {
  habitos: single("habitos", [
    { key: "hab_puntualidad", label: msg("Es puntual en entrenamientos y partidos") },
    { key: "hab_vestuario", label: msg("Controla el vestuario") },
    { key: "hab_material", label: msg("Usa y cuida bien el material") },
    { key: "hab_campo", label: msg("Tiene el campo y el material preparados") },
    { key: "hab_normas", label: msg("Cumple y hace cumplir las normas del club") },
  ]),
  gestion: single("gestion", [
    { key: "ges_datos", label: msg("Mantiene los datos al día en la app") },
    { key: "ges_sesiones", label: msg("Registra las sesiones") },
    { key: "ges_familias", label: msg("Se comunica bien con las familias") },
    { key: "ges_lesiones", label: msg("Avisa de lesiones e incidencias") },
    { key: "ges_plazos", label: msg("Cumple los plazos administrativos") },
  ]),
  metodologia: OBS_BLOCKS,
  partidos: single("partidos", [
    { key: "par_preparacion", label: msg("Prepara el partido") },
    { key: "par_direccion", label: msg("Dirige bien durante el partido") },
    { key: "par_minutos", label: msg("Gestiona los minutos de los jugadores") },
    { key: "par_sistema", label: msg("Aplica el sistema de juego") },
    { key: "par_banquillo", label: msg("Gestiona el banquillo") },
    { key: "par_charlas", label: msg("Charlas adecuadas antes y después del partido") },
  ]),
  humana: single("humana", [
    { key: "hum_comunicacion", label: msg("Se comunica bien con los jugadores") },
    { key: "hum_clima", label: msg("Cuida el trato y el clima de grupo") },
    { key: "hum_conflictos", label: msg("Gestiona los conflictos") },
    { key: "hum_refuerzo", label: msg("Refuerza y motiva a los jugadores") },
    { key: "hum_cuerpo", label: msg("Se relaciona bien con el cuerpo técnico") },
    { key: "hum_individual", label: msg("Atiende a cada jugador de forma individual") },
  ]),
};

// Las observaciones hechas antes de existir las áreas no llevan `area`: eran de Metodología
export const DEFAULT_OBS_AREA = "metodologia";
export const obsAreaOf = (obs) => (AREA_BLOCKS[obs?.area] ? obs.area : DEFAULT_OBS_AREA);
export const areaBlocks = (area) => AREA_BLOCKS[area] || AREA_BLOCKS[DEFAULT_OBS_AREA];
export const areaCriteria = (area) => areaBlocks(area).flatMap((b) => b.criteria);
export const emptyAreaScores = (area) => Object.fromEntries(areaCriteria(area).map((c) => [c.key, null]));
export const emptyAreaNotes = (area) => Object.fromEntries(areaBlocks(area).map((b) => [b.key, ""]));
export const areaSummary = (scores, area) => obsSummary(scores, areaBlocks(area));

// Resumen de varias observaciones de un área (las de un trimestre):
//  · overall = media de las medias de cada observación (todas pesan igual)
//  · criteria / blocks = media de los valores puestos en cada criterio / bloque; «no observable» y sin valorar no cuentan
export function aggregateArea(observations = [], area = DEFAULT_OBS_AREA) {
  const blocks = areaBlocks(area);
  const crit = areaCriteria(area);
  const overalls = observations.map((o) => {
    const vals = crit.map((c) => o.scores?.[c.key]).filter(isScored);
    return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null; // sin redondear: se redondea solo el resultado final
  }).filter((v) => v != null);
  const criteria = {};
  const blockAvgs = {};
  for (const b of blocks) {
    let sum = 0;
    let n = 0;
    for (const c of b.criteria) {
      const vals = observations.map((o) => o.scores?.[c.key]).filter(isScored);
      criteria[c.key] = { avg: vals.length ? round1(vals.reduce((a, v) => a + v, 0) / vals.length) : null, count: vals.length };
      sum += vals.reduce((a, v) => a + v, 0);
      n += vals.length;
    }
    blockAvgs[b.key] = { avg: n ? round1(sum / n) : null, count: n };
  }
  return {
    count: observations.length,
    scored: overalls.length,
    overall: overalls.length ? round1(overalls.reduce((a, v) => a + v, 0) / overalls.length) : null,
    criteria,
    blocks: blockAvgs,
  };
}
