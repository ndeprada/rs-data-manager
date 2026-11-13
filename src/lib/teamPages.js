// Mi equipo → Partidos y Desarrollo (rediseño del 13/11/2026, maqueta «Maqueta Mi equipo · Partidos, Desarrollo y Plantilla»
// aprobada por Nacho: «ok todo»). Cálculos puros, sin importaciones de la app: se prueba en Node (tests/teamPages.test.mjs).

const DAY = 86400000;
const time = (d) => (d instanceof Date ? d.getTime() : new Date(d).getTime());
export const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const hasScore = (e) => e.score_home != null && e.score_home !== "" && e.score_away != null && e.score_away !== "";

/** Resultado de un partido con marcador: V, E o D (score_home = nuestros goles) */
export function resultOf(e) {
  if (!hasScore(e)) return null;
  const a = Number(e.score_home), b = Number(e.score_away);
  return a > b ? "V" : a < b ? "D" : "E";
}

/** Partidos del equipo: jugados (del más reciente al más antiguo) y próximos (del más cercano), sin suspendidos en los próximos */
export function splitMatches(events = [], teamId, { now = new Date(), type = "all" } = {}) {
  const t = time(now);
  const list = events.filter((e) => e.team_id === teamId && MATCH_TYPES.includes(e.type) && (type === "all" || e.type === type));
  const past = list.filter((e) => time(e.date) <= t).sort((a, b) => time(b.date) - time(a.date));
  const next = list.filter((e) => time(e.date) > t && e.cancelled !== true && !e.postponed).sort((a, b) => time(a.date) - time(b.date));
  return { past, next };
}

/** Goleadores nuestros de un partido: «Rius 2, Gil» (de goal_events con team = home = nuestros) */
export function scorersText(ev, playersById = new Map(), ownGoal = "p.p.") {
  const counts = new Map();
  for (const g of ev?.goal_events || []) {
    if (g.team !== "home") continue;
    const p = playersById.get(g.player_id);
    const name = p ? (p.last_name || p.first_name || "?") : g.goal_type === "gol_propio" ? ownGoal : "?";
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()].map(([n, c]) => (c > 1 ? `${n} ${c}` : n)).join(", ");
}

/** Media de las notas del equipo en el postpartido (1–3), o null */
export function teamEvalAvg(ev) {
  const vals = Object.values(ev?.team_eval || {}).map(Number).filter((v) => v > 0);
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
}

/** Récord en casa y fuera (sin dato de is_home = casa, como en el resto de la app) */
export function homeAway(played = []) {
  const blank = () => ({ w: 0, d: 0, l: 0, gf: 0, ga: 0, n: 0 });
  const out = { home: blank(), away: blank() };
  for (const e of played) {
    if (!hasScore(e)) continue;
    const r = out[e.is_home === false ? "away" : "home"];
    const a = Number(e.score_home), b = Number(e.score_away);
    r.gf += a; r.ga += b; r.n += 1;
    if (a > b) r.w += 1; else if (a < b) r.l += 1; else r.d += 1;
  }
  return out;
}

/** Goles marcados y encajados de los últimos n partidos con marcador (del más reciente al más antiguo) */
export function goalsByMatch(played = [], n = 8) {
  return played.filter(hasScore).slice(0, n).map((e) => ({
    id: e.id, label: e.fcf_jornada ? `J${e.fcf_jornada}` : new Date(e.date).toISOString().slice(5, 10).split("-").reverse().join("/"),
    gf: Number(e.score_home), ga: Number(e.score_away),
  }));
}

// ── Desarrollo ─────────────────────────────────────────────────────────────────
const statusOf = (g) => (g.status === "mejorado" || g.status === "trabajando" ? g.status : "a_mejorar");

/** Objetivos del PDI de un jugador: cuántos de cada estado y el que se trabaja ahora (trabajando; si no, el primero a mejorar) */
export function pdiSummary(goals = []) {
  const c = { trabajando: 0, a_mejorar: 0, mejorado: 0 };
  for (const g of goals) c[statusOf(g)] += 1;
  const sorted = [...goals].sort((a, b) => String(b.created_date || "").localeCompare(String(a.created_date || "")));
  const current = sorted.find((g) => statusOf(g) === "trabajando") || sorted.find((g) => statusOf(g) === "a_mejorar") || null;
  return { ...c, total: goals.length, current };
}

/** Media de la última evaluación 360 y la de cada área (usa la función de medias de la app, que se pasa) */
export function last360(evals = [], averages) {
  const latest = [...evals].sort((a, b) => String(b.date || b.created_date || "").localeCompare(String(a.date || a.created_date || "")))[0] || null;
  if (!latest) return null;
  const avg = averages(latest);
  return { date: latest.date || latest.created_date || null, overall: avg?.overall ?? null, areas: avg || {} };
}

/** Media de las valoraciones del postpartido (1–3) y tendencia de las 3 últimas frente al resto */
export function ratingSummary(stats = []) {
  const rated = stats.filter((s) => Number(s.rating) > 0).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  if (!rated.length) return null;
  const avg = rated.reduce((a, s) => a + Number(s.rating), 0) / rated.length;
  const recent = rated.slice(0, 3), rest = rated.slice(3);
  let trend = "=";
  if (rest.length) {
    const r = recent.reduce((a, s) => a + Number(s.rating), 0) / recent.length;
    const o = rest.reduce((a, s) => a + Number(s.rating), 0) / rest.length;
    trend = r - o > 0.2 ? "up" : o - r > 0.2 ? "down" : "=";
  }
  return { avg: Math.round(avg * 10) / 10, n: rated.length, trend };
}

/** Última revisión: la fecha más reciente entre su 360 y los cambios de su plan (creación, mejora o actualización) */
export function lastReview({ evals = [], goals = [] }) {
  const dates = [
    ...evals.map((e) => e.date || e.created_date),
    ...goals.flatMap((g) => [g.created_date, g.updated_date, g.improved_date]),
  ].filter(Boolean).map(dayOf).filter(Boolean);
  return dates.length ? dates.sort().at(-1) : null;
}

/** «2026-11-03» (día local) de una fecha en texto o Date; null si no es válida */
export function dayOf(d) {
  if (d == null || d === "") return null;
  const x = new Date(typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00` : d);
  if (!Number.isFinite(x.getTime())) return null;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
export const daysSince = (date, now = new Date()) => {
  const d = dayOf(date);
  return d ? Math.floor((time(now) - time(`${d}T12:00:00`)) / DAY) : null;
};
export const REVIEW_DAYS = 60;

/** Objetivos «trabajando» de la plantilla agrupados por su competencia (o su texto): [{label, n}] */
export function workedOn(goals = [], labelOf = (g) => g.competency_text || g.objective || "") {
  const m = new Map();
  for (const g of goals) {
    if (statusOf(g) !== "trabajando") continue;
    const k = String(labelOf(g) || "").trim();
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "es"));
}

/** Objetivos mejorados, del más reciente al más antiguo */
export const recentImproved = (goals = [], n = 5) =>
  goals.filter((g) => statusOf(g) === "mejorado").sort((a, b) => String(b.improved_date || b.updated_date || "").localeCompare(String(a.improved_date || a.updated_date || ""))).slice(0, n);

/** Orden de la tabla de desarrollo: "pos" (lo hace la pantalla), "review" (sin revisar primero), "low360" (360 más bajo primero) */
export function sortDev(rows = [], mode) {
  const list = [...rows];
  if (mode === "review") return list.sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999));
  if (mode === "low360") return list.sort((a, b) => (a.e360?.overall ?? 99) - (b.e360?.overall ?? 99));
  return list;
}

// ── Plantilla ──────────────────────────────────────────────────────────────────
const hasNum = (v) => v != null && v !== "";

/** Dorsales repetidos en la plantilla: [{ n, ids }] (solo los que llevan dos o más jugadores) */
export function dorsalDupes(players = []) {
  const by = new Map();
  for (const p of players) {
    if (!hasNum(p.jersey_number)) continue;
    const k = String(p.jersey_number).trim();
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(p.id);
  }
  return [...by.entries()].filter(([, ids]) => ids.length > 1).map(([n, ids]) => ({ n, ids })).sort((a, b) => Number(a.n) - Number(b.n));
}

/**
 * Fichas por revisar: [{ key, ids, extra? }] en este orden: dorsales repetidos, sin dorsal, sin posición, sin teléfono del tutor
 * (solo menores de edad: año de nacimiento posterior a `adultYear`), sin cuenta en la app (si se pasan las cuentas) y sin
 * revisión médica esta temporada (si se pasa la lista de quién la tiene). Las listas vacías no salen.
 */
export function squadChecks(players = [], { adultYear = null, accountOf = null, medicalIds = null } = {}) {
  const dup = dorsalDupes(players);
  const out = [
    { key: "dup", ids: dup.flatMap((d) => d.ids), extra: dup.map((d) => d.n).join(", ") },
    { key: "nodorsal", ids: players.filter((p) => !hasNum(p.jersey_number)).map((p) => p.id) },
    { key: "nopos", ids: players.filter((p) => !p.position).map((p) => p.id) },
    { key: "notutor", ids: players.filter((p) => adultYear != null && Number(p.birth_year || String(p.birth_date || "").slice(0, 4)) > adultYear && !String(p.guardian_phone || "").trim()).map((p) => p.id) },
  ];
  if (accountOf) out.push({ key: "noaccount", ids: players.filter((p) => accountOf(p) === "none").map((p) => p.id) });
  if (medicalIds) out.push({ key: "nomedical", ids: players.filter((p) => !medicalIds.has(p.id)).map((p) => p.id) });
  return out.filter((c) => c.ids.length);
}

/** Quién tiene la revisión médica al día: documento «examen_medico» de esta temporada o que todavía no ha caducado */
export function medicalOk(docs = [], { since, today }) {
  const ok = new Set();
  for (const d of docs) {
    if (d.document_type !== "examen_medico") continue;
    const created = dayOf(d.created_date || d.date);
    const exp = dayOf(d.expiry_date);
    if ((exp && exp >= today) || (!exp && created && created >= since)) ok.add(d.player_id);
  }
  return ok;
}

/** Composición de la plantilla: por línea, por año y por pierna. `lineOf(p)` da la clave de la línea (o null) */
export function composition(players = [], lineOf) {
  const lines = {}, years = {}, foot = { diestro: 0, zurdo: 0, ambidiestro: 0, none: 0 };
  for (const p of players) {
    const l = lineOf(p) || "none";
    lines[l] = (lines[l] || 0) + 1;
    const y = Number(p.birth_year || String(p.birth_date || "").slice(0, 4)) || "none";
    years[y] = (years[y] || 0) + 1;
    foot[foot[p.laterality] != null ? p.laterality : "none"] += 1;
  }
  const yearList = Object.entries(years).filter(([y]) => y !== "none").map(([y, n]) => ({ year: Number(y), n })).sort((a, b) => a.year - b.year);
  return { lines, years: yearList, noYear: years.none || 0, foot };
}
