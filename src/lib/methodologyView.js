// Metodología (rediseño del 13/11/2026, maqueta «Maqueta Metodología · RS Manager» aprobada por Nacho): cálculos puros.
// Sin importaciones de la app salvo sessionPlan: se prueba en Node (tests/methodologyView.test.mjs).
import {
  BLOCKS, aggregateSessions, compareWithStage, registerSession, stageContents, normalizeSessionType, SESSION_TYPES,
} from "./sessionPlan.js";

const DAY = 86400000;
export const SESSION_TRAINING_TYPES = ["entrenamiento"];
export const dayOf = (d) => String(d || "").slice(0, 10);
const toDate = (s) => new Date(`${dayOf(s)}T12:00:00`);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (s, n) => iso(new Date(toDate(s).getTime() + n * DAY));

// Lunes de la semana de una fecha (yyyy-MM-dd)
export function weekStart(s) {
  const d = toDate(s);
  const wd = (d.getDay() + 6) % 7;
  return iso(new Date(d.getTime() - wd * DAY));
}

// Inicio del periodo: "season" (desde el 1 de agosto), "30", "7" (días)
export function periodStart(period, today) {
  if (period === "season") {
    const d = toDate(today);
    const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    return `${y}-08-01`;
  }
  return addDays(today, -Number(period || 30));
}

// Sesiones agrupadas por semana (la más reciente primero) con su tiempo (reloj de la sesión)
export function groupByWeek(sessions = []) {
  const map = new Map();
  for (const s of sessions) {
    if (!s?.date) continue;
    const k = weekStart(s.date);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(s);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([start, list]) => ({
    start, end: addDays(start, 6),
    sessions: list.sort((a, b) => String(b.date).localeCompare(String(a.date))),
    minutes: list.reduce((n, s) => n + (registerSession(s).clock || 0), 0),
  }));
}

// Reparto por bloques de un registro (registerSession o aggregateSessions), en el orden de BLOCKS
export const blockMix = (reg) => BLOCKS.map((b) => ({ block: b.id, minutes: reg?.blocks?.[b.id] || 0 })).filter((x) => x.minutes > 0);

// Contenidos de una sesión ordenados por tiempo: { principal: [id…], secondary: [id…] }
export function sessionContents(reg, n = 3) {
  const all = Object.values(reg?.contents || {});
  const principal = all.filter((c) => c.principal > 0).sort((a, b) => b.principal - a.principal).map((c) => c.id);
  const secondary = all.filter((c) => !c.principal && c.secondary > 0).sort((a, b) => b.secondary - a.secondary).map((c) => c.id);
  return { principal: principal.slice(0, n), secondary: secondary.slice(0, 1), more: Math.max(0, principal.length - n) + Math.max(0, secondary.length - 1) };
}

// Sesiones de cada tipo
export function typeCounts(sessions = []) {
  const out = Object.fromEntries(SESSION_TYPES.map((t) => [t.id, 0]));
  let none = 0;
  for (const s of sessions) {
    const t = normalizeSessionType(s.session_type);
    if (t && t in out) out[t] += 1; else none += 1;
  }
  return { ...out, none };
}

// Contenidos con más tiempo como principal
export function topContents(agg, n = 5) {
  return Object.values(agg?.contents || {}).filter((c) => c.principal > 0).sort((a, b) => b.principal - a.principal).slice(0, n);
}

// Contenidos de prioridad alta de la etapa sin ningún minuto (ni principal ni secundario)
export function undoneHigh(agg, stage) {
  return stageContents(stage).filter((c) => c.priority === "A" && !(agg?.contents?.[c.id]?.principal > 0) && !(agg?.contents?.[c.id]?.secondary > 0));
}

// Bloques con más de ±10 puntos de desviación
export const blocksToReview = (rows = [], withBlock = 0) => (withBlock ? rows.filter((r) => Math.abs(r.diff) > 10) : []);

// Mayor desviación (en puntos, valor absoluto) de un equipo
export const maxDeviation = (rows = [], withBlock = 0) => (withBlock ? Math.max(0, ...rows.map((r) => Math.abs(r.diff))) : null);

// Reparto por bloques de cada tipo de sesión: [{ type, minutes, mix }]
export function mixByType(sessions = []) {
  return SESSION_TYPES.map((t) => {
    const list = sessions.filter((s) => normalizeSessionType(s.session_type) === t.id);
    const agg = aggregateSessions(list);
    return { type: t.id, sessions: list.length, minutes: agg.withBlock, mix: blockMix(agg) };
  }).filter((x) => x.minutes > 0);
}

// Las últimas n semanas (hasta la de hoy), con el tiempo de cada bloque: [{ start, total, mix }]
export function weeklyMix(sessions = [], today, n = 8) {
  const last = weekStart(today);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(last, -7 * i);
    const end = addDays(start, 6);
    const agg = aggregateSessions(sessions.filter((s) => s.date >= start && dayOf(s.date) <= end));
    out.push({ start, total: agg.withBlock, mix: blockMix(agg) });
  }
  return out;
}

// ¿Tiene hoja de sesión este entreno? (por event_id o, si no, mismo equipo y mismo día)
export const sessionOfTraining = (ev, sessions = []) =>
  sessions.find((s) => (s.training_event_id || s.event_id) && (s.training_event_id === ev.id || s.event_id === ev.id)) || sessions.find((s) => s.team_id === ev.team_id && dayOf(s.date) === dayOf(ev.date)) || null;

// Entrenos del calendario (de los equipos dados) sin hoja: de los últimos `back` días y de los próximos `ahead`
export function trainingsWithoutSession({ events = [], sessions = [], teamIds = [], today, back = 14, ahead = 7 }) {
  const from = addDays(today, -back);
  const to = addDays(today, ahead);
  const set = new Set(teamIds);
  const list = events.filter((e) => SESSION_TRAINING_TYPES.includes(e.type) && e.cancelled !== true && e.date && set.has(e.team_id)
    && dayOf(e.date) >= from && dayOf(e.date) <= to && !sessionOfTraining(e, sessions));
  const past = list.filter((e) => dayOf(e.date) <= today).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const next = list.filter((e) => dayOf(e.date) > today).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { past, next };
}

// Entrenos (de unos equipos) entre dos fechas sin hoja de sesión
export const missingInRange = ({ events = [], sessions = [], teamIds = [], from, to }) =>
  events.filter((e) => SESSION_TRAINING_TYPES.includes(e.type) && e.cancelled !== true && e.date && teamIds.includes(e.team_id)
    && dayOf(e.date) >= from && dayOf(e.date) <= to && !sessionOfTraining(e, sessions)).length;

// Minutos como horas: «45’», «4 h», «4 h 05’»
export function fmtHours(min) {
  const m = Math.round(Number(min) || 0);
  if (m < 60) return `${m}’`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}’` : `${h} h`;
}

// Entrenos celebrados (hasta hoy) de unos equipos en un periodo y cuántos tienen hoja
export function trainingCoverage({ events = [], sessions = [], teamIds = [], from, today }) {
  const set = new Set(teamIds);
  const held = events.filter((e) => SESSION_TRAINING_TYPES.includes(e.type) && e.cancelled !== true && e.date && set.has(e.team_id)
    && dayOf(e.date) <= today && (!from || dayOf(e.date) >= from));
  const withSession = held.filter((e) => sessionOfTraining(e, sessions)).length;
  return { trainings: held.length, withSession, pct: held.length ? Math.round((withSession / held.length) * 100) : null };
}

// Sesiones que cuentan: hechas (hasta hoy), realizadas y de la temporada
export const countedSessions = (sessions = [], { from, today, season } = {}) =>
  sessions.filter((s) => s.held !== false && s.date && dayOf(s.date) <= today && (!from || dayOf(s.date) >= from) && (!season || !s.season || s.season === season));

// Una fila por equipo para la vista de coordinación «Todos los equipos»
export function teamsOverview({ teams = [], sessions = [], events = [], from, today, season, stageOf }) {
  return teams.map((team) => {
    const stage = stageOf(team, sessions);
    const list = countedSessions(sessions.filter((s) => s.team_id === team.id), { from, today, season });
    const agg = aggregateSessions(list);
    const rows = compareWithStage(agg, stage);
    const cov = trainingCoverage({ events, sessions: list, teamIds: [team.id], from, today });
    const coaches = [...new Set(list.map((s) => s.owner_name).filter(Boolean))];
    return {
      team, stage, sessions: list.length, coaches, ...cov,
      contentPct: agg.total ? Math.round((agg.withBlock / agg.total) * 100) : null,
      maxDev: maxDeviation(rows, agg.withBlock),
      undone: stage && agg.withBlock ? undoneHigh(agg, stage).length : null,
      minutes: agg.total,
    };
  });
}

export function sortOverview(rows = [], by = "category") {
  if (by !== "low") return rows;
  const key = (r) => (r.pct == null ? 999 : r.pct);
  return [...rows].sort((a, b) => key(a) - key(b));
}

// ── Biblioteca de tareas ───────────────────────────────────────────────────────
// Usos de cada tarea de la biblioteca en las sesiones: Map(id → { count, last: { date, team_id } })
export function libraryUses(sessions = []) {
  const out = new Map();
  for (const s of sessions) {
    for (const t of [...(s.initial?.tasks || []), ...(s.main?.tasks || [])]) {
      const id = t?.from_library?.id;
      if (!id) continue;
      const u = out.get(id) || { count: 0, last: null };
      u.count += 1;
      if (!u.last || String(s.date) > String(u.last.date)) u.last = { date: s.date, team_id: s.team_id };
      out.set(id, u);
    }
  }
  return out;
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const PLAYER_RANGES = [{ id: "le8", max: 8 }, { id: "9to14", min: 9, max: 14 }, { id: "ge15", min: 15 }];
export const DURATION_RANGES = [{ id: "le10", max: 10 }, { id: "11to20", min: 11, max: 20 }, { id: "gt20", min: 21 }];
const inRange = (n, r) => Number.isFinite(n) && n > 0 && (r.min == null || n >= r.min) && (r.max == null || n <= r.max);

export const EMPTY_LIB_FILTERS = { q: "", owner: "all", phases: [], moments: [], formats: [], players: [], durations: [] };

// ¿Pasa la tarea los filtros? (dentro de cada filtro, cualquiera de los elegidos)
export function matchesLibrary(task, f = EMPTY_LIB_FILTERS, { me, contentNames = () => [] } = {}) {
  if (f.q) {
    const hay = norm([task.name, task.description, task.principles, ...(contentNames(task) || [])].join(" "));
    if (!norm(f.q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }
  if (f.owner === "mine" && (!me || task.author_id !== me)) return false;
  if (f.owner === "club" && me && task.author_id === me) return false;
  if (f.phases.length && !f.phases.includes(task.session_phase || "parte_principal")) return false;
  if (f.moments.length && !f.moments.includes(task.game_moment || "ninguno")) return false;
  if (f.formats.length && !f.formats.includes(task.football_format || "ambos")) return false;
  if (f.players.length && !f.players.some((id) => inRange(Number(task.players_count), PLAYER_RANGES.find((r) => r.id === id) || {}))) return false;
  if (f.durations.length && !f.durations.some((id) => inRange(Number(task.duration_minutes), DURATION_RANGES.find((r) => r.id === id) || {}))) return false;
  return true;
}

export const activeLibFilters = (f = EMPTY_LIB_FILTERS) =>
  (f.q ? 1 : 0) + (f.owner !== "all" ? 1 : 0) + f.phases.length + f.moments.length + f.formats.length + f.players.length + f.durations.length;

// Cuántas tareas hay de cada valor de un campo (para los contadores de los filtros)
export function countBy(tasks = [], field, fallback) {
  const out = {};
  for (const t of tasks) { const v = t[field] || fallback; out[v] = (out[v] || 0) + 1; }
  return out;
}

export function sortLibrary(tasks = [], by = "recent", uses = new Map()) {
  const list = [...tasks];
  if (by === "used") return list.sort((a, b) => (uses.get(b.id)?.count || 0) - (uses.get(a.id)?.count || 0) || String(a.name).localeCompare(String(b.name), "es"));
  if (by === "az") return list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es"));
  return list.sort((a, b) => String(b.created_date || "").localeCompare(String(a.created_date || "")));
}
