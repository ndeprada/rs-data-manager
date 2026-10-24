// Criterios de observación de cada área de la Evaluación 360 de entrenadores.
// Misma escala que la observación de Metodología (1 No alcanzado · 2 Parcial · 3 Alcanzado · 4 Superado + No observable).
// Metodología conserva sus 18 criterios en 5 bloques (coachMethod.js); las demás áreas tienen un solo bloque.
// «Partido y modelo de juego» tiene el bloque de gestión del partido y, según el formato de juego del equipo observado
// (fútbol 7 o fútbol 11), dos bloques más con los indicadores del modelo de juego en ataque y en defensa (coachModelGame.js).
// Sin importaciones de la app (salvo la marca de traducción): se usa también en los tests.
import { msg } from "../i18n/translate.js";
import { OBS_BLOCKS, isScored, obsSummary, round1 } from "./coachMethod.js";
import { COACH_AREAS } from "./coachAreas.js";
import { GAME_FORMATS, MODEL_BLOCKS, modelBlocks, obsFormats } from "./coachModelGame.js";

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
  // Gestión del partido: lo que hace el entrenador antes, durante y después. Las claves par_* ya guardadas se conservan;
  // «par_direccion» pasa a ser la dirección táctica (y la de personas se valora aparte en «par_personas»).
  partidos: [{ key: "partidos", label: msg("Gestión del partido"), color: COACH_AREAS.find((x) => x.key === "partidos").color, criteria: [
    { key: "par_preparacion", label: msg("Prepara el partido") },
    { key: "par_charlas", label: msg("Charlas adecuadas antes y después del partido") },
    { key: "par_sistema", label: msg("Aplica el sistema de juego") },
    { key: "par_instrucciones", label: msg("Sus instrucciones son claras, breves y oportunas") },
    { key: "par_correcciones", label: msg("Corrige con criterio: qué, cuándo y cómo, sin saturar al jugador") },
    { key: "par_direccion", label: msg("Dirección táctica: lee el partido y ajusta a tiempo (posiciones, cambios, ritmo)") },
    { key: "par_personas", label: msg("Gestiona a las personas durante el partido: tono, respeto y clima de grupo") },
    { key: "par_errores", label: msg("Gestiona los errores con calma y sentido formativo (los suyos y los de los jugadores)") },
    { key: "par_minutos", label: msg("Gestiona los minutos de los jugadores") },
    { key: "par_banquillo", label: msg("Gestiona el banquillo") },
  ] }],
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
// `formats` solo cuenta en «Partido y modelo de juego»: formatos de juego (f7 / f11) cuyos indicadores del modelo se añaden a la gestión del partido
export const areaBlocks = (area, formats = []) => {
  if (area === "partidos") return [...AREA_BLOCKS.partidos, ...modelBlocks(formats)];
  return AREA_BLOCKS[area] || AREA_BLOCKS[DEFAULT_OBS_AREA];
};
export const areaCriteria = (area, formats) => areaBlocks(area, formats).flatMap((b) => b.criteria);
export const emptyAreaScores = (area, formats) => Object.fromEntries(areaCriteria(area, formats).map((c) => [c.key, null]));
export const emptyAreaNotes = (area, formats) => Object.fromEntries(areaBlocks(area, formats).map((b) => [b.key, ""]));
export const areaSummary = (scores, area, formats) => obsSummary(scores, areaBlocks(area, formats));

// Al guardar una observación de partido se quita lo que sea de los indicadores del otro formato (por si se cambió de F7 a F11 a medias)
export function pruneForFormats(area, formats, scores = {}, notes = {}) {
  if (area !== "partidos") return { scores, notes };
  const others = GAME_FORMATS.filter((f) => !formats.includes(f)).flatMap((f) => MODEL_BLOCKS[f]);
  const dropScores = new Set(others.flatMap((b) => b.criteria.map((c) => c.key)));
  const dropNotes = new Set(others.map((b) => b.key));
  return {
    scores: Object.fromEntries(Object.entries(scores).filter(([k]) => !dropScores.has(k))),
    notes: Object.fromEntries(Object.entries(notes).filter(([k]) => !dropNotes.has(k))),
  };
}

// Resumen de varias observaciones de un área (las de un trimestre):
//  · overall = media de las medias de cada observación (todas pesan igual)
//  · criteria / blocks = media de los valores puestos en cada criterio / bloque; «no observable» y sin valorar no cuentan
export function aggregateArea(observations = [], area = DEFAULT_OBS_AREA) {
  const formats = area === "partidos" ? obsFormats(observations) : [];
  const blocks = areaBlocks(area, formats);
  const crit = areaCriteria(area, formats);
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
