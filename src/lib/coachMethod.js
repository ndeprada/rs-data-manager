// Informe metodológico de entrenadores (pestaña «Metodología» de la ficha del entrenador).
// Dos partes:
//  · Observación de una sesión, que rellena la coordinación en el campo: 18 criterios en 5 bloques con la escala
//    de valoración de la sesión del TFM (apartado 4.8.11: 1 No alcanzado · 2 Parcial · 3 Alcanzado · 4 Superado).
//  · Datos de las sesiones que el propio entrenador ha registrado (indicadores automáticos, solo lectura).
// Sin importaciones de la app (salvo traducción y sessionPlan): se usa también en los tests.
import { msg } from "../i18n/translate.js";
import {
  stageContents, contentInfo, contentBlock, aggregateSessions, compareWithStage, hierarchyIssues, taskMinutes, hasText,
} from "./sessionPlan.js";

// ── Escala (TFM 4.8.11) ──────────────────────────────────────────────────────
// En el TFM la escala valora si el objetivo de la sesión se alcanzó; aquí valora si el entrenador cumple cada criterio.
export const OBS_SCALE = [
  { value: 1, label: msg("No alcanzado"), hint: msg("No se aprecia o no se cumple."), color: "#dc2626" },
  { value: 2, label: msg("Parcial"), hint: msg("Se cumple a medias, de forma inestable o solo con ayuda."), color: "#ea580c" },
  { value: 3, label: msg("Alcanzado"), hint: msg("Se cumple con suficiente regularidad."), color: "#16a34a" },
  { value: 4, label: msg("Superado"), hint: msg("Se cumple con autonomía y sirve de referencia."), color: "#0369a1" },
];
// Escala de los indicadores del modelo de juego en el partido (TFM 4.8.12): mismas notas 1–4 y mismos colores, con las etiquetas del TFM.
// Valora al equipo: si reconoce la situación, elige la respuesta del modelo y la reproduce.
export const MODEL_SCALE = [
  { value: 1, label: msg("No aparece"), hint: msg("Se produjo, pero no se reconoció o reprodujo."), color: OBS_SCALE[0].color },
  { value: 2, label: msg("Puntual"), hint: msg("Apareció en algunas situaciones, de forma aislada."), color: OBS_SCALE[1].color },
  { value: 3, label: msg("Frecuente"), hint: msg("Se reprodujo habitualmente, con algunos errores o falta de continuidad."), color: OBS_SCALE[2].color },
  { value: 4, label: msg("Asimilado"), hint: msg("Correcta interpretación, continuidad y autonomía en contextos diferentes."), color: OBS_SCALE[3].color },
];
// Escala que corresponde a un bloque de criterios (los del modelo de juego llevan `scale: "model"`)
export const scaleOf = (block) => (block?.scale === "model" ? MODEL_SCALE : OBS_SCALE);
// Criterio que no se pudo ver en esa sesión (como el «0 No observable» del apartado 4.8.12): no cuenta en las medias
export const NOT_OBSERVABLE = 0;
export const NOT_OBSERVABLE_LABEL = msg("No observable");
export const scaleInfo = (v, scale = OBS_SCALE) => scale.find((s) => s.value === v) || null;
export const isScored = (v) => Number.isInteger(v) && v >= 1 && v <= 4;

// ── Criterios ────────────────────────────────────────────────────────────────
export const OBS_BLOCKS = [
  { key: "tipo", label: msg("Tipo de sesión"), color: "#36000D", criteria: [
    { key: "tipo_contenidos", label: msg("Los contenidos corresponden al tipo de sesión") },
    { key: "tipo_jugadores", label: msg("Nº de jugadores por tarea adecuado al tipo de sesión") },
    { key: "tipo_dimensiones", label: msg("Dimensiones de los espacios adecuadas al tipo de sesión") },
    { key: "tipo_partido", label: msg("El partido final sigue las premisas del tipo de sesión") },
  ] },
  { key: "inicial", label: msg("Parte inicial"), color: "#73000A", criteria: [
    { key: "ini_tecnica", label: msg("Trabaja técnica y hábitos de juego") },
    { key: "ini_correcciones", label: msg("Corrige durante los ejercicios") },
    { key: "ini_demostracion", label: msg("Hace demostraciones") },
  ] },
  { key: "principal", label: msg("Tareas principales"), color: "#B33A00", criteria: [
    { key: "pri_correcciones", label: msg("Correcciones adecuadas") },
    { key: "pri_pausas", label: msg("Sin pausas excesivas") },
    { key: "pri_espacios", label: msg("Espacios y distancias adecuados") },
  ] },
  { key: "final", label: msg("Partido final"), color: "#FF6E00", criteria: [
    { key: "fin_tiempo", label: msg("Tiene tiempo suficiente") },
    { key: "fin_formato", label: msg("Dimensiones, formato y nº de jugadores que tocan adecuados") },
    { key: "fin_correcciones", label: msg("Correcciones ligadas a lo trabajado y a los elementos principales del sistema de juego") },
  ] },
  { key: "planificacion", label: msg("Contenidos y planificación"), color: "#475569", criteria: [
    { key: "plan_etapa", label: msg("Contenidos y tareas adecuados a la categoría y la etapa") },
    { key: "plan_bloques", label: msg("Atiende todos los bloques con tiempo suficiente") },
    { key: "plan_sesion", label: msg("Planifica las sesiones") },
    { key: "plan_equipos", label: msg("Lleva los equipos preparados") },
    { key: "plan_correcciones", label: msg("Lleva las posibles correcciones preparadas") },
  ] },
];
export const ALL_CRITERIA = OBS_BLOCKS.flatMap((b) => b.criteria);

export const emptyScores = () => Object.fromEntries(ALL_CRITERIA.map((c) => [c.key, null]));
export const emptyNotes = () => Object.fromEntries(OBS_BLOCKS.map((b) => [b.key, ""]));

export const round1 = (n) => Math.round(n * 10) / 10;

// Medias de una observación: por bloque y global. «No observable» y los criterios sin valorar no cuentan.
// `areaBlocks` = bloques de criterios del área (por defecto los de Metodología, que son los de siempre).
export function obsSummary(scores = {}, areaBlocks = OBS_BLOCKS) {
  const blocks = {};
  let sum = 0;
  let n = 0;
  let notObservable = 0;
  const total = areaBlocks.reduce((a, b) => a + b.criteria.length, 0);
  for (const b of areaBlocks) {
    const vals = b.criteria.map((c) => scores?.[c.key]);
    const scored = vals.filter(isScored);
    notObservable += vals.filter((v) => v === NOT_OBSERVABLE).length;
    blocks[b.key] = { avg: scored.length ? round1(scored.reduce((a, v) => a + v, 0) / scored.length) : null, count: scored.length, total: b.criteria.length };
    sum += scored.reduce((a, v) => a + v, 0);
    n += scored.length;
  }
  return { overall: n ? round1(sum / n) : null, answered: n, notObservable, total, blocks };
}

// Color de una media (1–4) para pintarla
export function avgColor(avg) {
  if (avg == null) return "#9ca3af";
  if (avg < 1.5) return OBS_SCALE[0].color;
  if (avg < 2.5) return OBS_SCALE[1].color;
  if (avg < 3.5) return OBS_SCALE[2].color;
  return OBS_SCALE[3].color;
}

// ── Periodo ──────────────────────────────────────────────────────────────────
// «yyyy-MM-dd» de hace N días (vacío = toda la temporada)
export function sinceDate(period, today) {
  const days = Number(period);
  if (!Number.isFinite(days) || days <= 0) return "";
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - days);
  const p = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ── Indicadores automáticos ──────────────────────────────────────────────────
// Partido final = la última tarea de la parte principal si es de tipo partido, minipartido o partido reducido
export const FINAL_GAME_TYPES = ["partido", "minipartido", "partido_reducido"];
const TECH_HABITS = ["tecnica", "habitos"];
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
const dayOf = (v) => String(v || "").slice(0, 10);
const worked = (t) => taskMinutes(t) > 0;

export function finalGameOf(session) {
  const tasks = (session?.main?.tasks || []).filter(worked);
  const last = tasks[tasks.length - 1];
  return last && FINAL_GAME_TYPES.includes(last.type) ? last : null;
}

// sessions: sesiones del entrenador en ese equipo y periodo, ya filtradas (realizadas y hasta hoy)
// trainings: entrenamientos celebrados (no cancelados) de ese equipo en el mismo periodo
// stage: etapa del equipo (sessionPlan.STAGES) o null si no se reconoce
export function coachIndicators({ sessions = [], trainings = [], stage = null }) {
  const out = {
    trainings: trainings.length, withSession: 0, pctSessions: null, sessions: sessions.length, tasks: 0, minutes: 0,
    blocks: { ok: 0, revisar: 0, alerta: 0, outside: [] }, hierarchy: 0,
    finalGame: { sessions: 0, withFinal: 0, avgMin: null, avgPct: null, pct: null },
    corrections: { tasks: 0, withText: 0, pct: null },
    initial: { sessions: 0, withTechHabits: 0, pct: null },
    curriculum: { tasks: 0, outside: 0, pct: null },
    hasData: sessions.length > 0,
  };

  out.withSession = trainings.filter((ev) => sessions.some((s) => s.team_id === ev.team_id && (s.event_id === ev.id || s.date === dayOf(ev.date)))).length;
  out.pctSessions = pct(out.withSession, out.trainings);
  if (!sessions.length) return out;

  const agg = aggregateSessions(sessions);
  out.tasks = agg.tasks;
  out.minutes = agg.total;
  if (stage && agg.withBlock) {
    const rows = compareWithStage(agg, stage);
    for (const r of rows) {
      if (!r.state || (!r.target && !r.minutes)) continue; // bloque que la etapa no contempla y sin tiempo: no cuenta
      out.blocks[r.state.id] += 1;
      if (r.state.id !== "ok") out.blocks.outside.push({ block: r.block, diff: Math.round(r.diff), state: r.state.id });
    }
    out.blocks.outside.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    out.hierarchy = hierarchyIssues(agg, stage).length;
  }

  let finalMin = 0;
  let finalPct = 0;
  let initialSessions = 0;
  let initialOk = 0;
  for (const s of sessions) {
    const total = [...(s.initial?.tasks || []), ...(s.main?.tasks || [])].filter(worked).reduce((a, t) => a + taskMinutes(t), 0);
    const fin = finalGameOf(s);
    if (total) {
      out.finalGame.sessions += 1;
      if (fin) { out.finalGame.withFinal += 1; finalMin += taskMinutes(fin); finalPct += (taskMinutes(fin) / total) * 100; }
    }
    const ini = (s.initial?.tasks || []).filter(worked);
    if (ini.length) {
      initialSessions += 1;
      if (ini.some((t) => !t.no_curriculum && (t.principal || []).some((id) => TECH_HABITS.includes(contentBlock(id))))) initialOk += 1;
    }
    const ids = new Set(stageContents(s.stage || stage).map((c) => c.id));
    for (const t of [...(s.initial?.tasks || []), ...(s.main?.tasks || [])].filter(worked)) {
      if (t.no_curriculum) continue;
      out.corrections.tasks += 1;
      if (hasText(t.corrections)) out.corrections.withText += 1;
      const principals = (t.principal || []).filter(contentInfo);
      if (principals.length && ids.size) {
        out.curriculum.tasks += 1;
        if (principals.some((id) => !ids.has(id))) out.curriculum.outside += 1;
      }
    }
  }
  if (out.finalGame.withFinal) {
    out.finalGame.avgMin = round1(finalMin / out.finalGame.withFinal);
    out.finalGame.avgPct = Math.round(finalPct / out.finalGame.withFinal);
  }
  out.finalGame.pct = pct(out.finalGame.withFinal, out.finalGame.sessions);
  out.corrections.pct = pct(out.corrections.withText, out.corrections.tasks);
  out.initial = { sessions: initialSessions, withTechHabits: initialOk, pct: pct(initialOk, initialSessions) };
  out.curriculum.pct = pct(out.curriculum.tasks - out.curriculum.outside, out.curriculum.tasks);
  return out;
}
