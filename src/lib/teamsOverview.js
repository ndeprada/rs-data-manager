// Equipos (rediseño del 13/11/2026, maqueta «Maqueta Equipos · RS Manager» aprobada por Nacho): cálculos puros.
// Sin importaciones de la app: se prueba en Node (tests/teamsOverview.test.mjs).

const DAY = 86400000;
const time = (d) => (d instanceof Date ? d.getTime() : new Date(d).getTime());
const LEAGUE = "partido_liga";
const COACHING = ["primer_entrenador", "segundo_entrenador", "asistente"];
const ROLE_ORDER = ["primer_entrenador", "segundo_entrenador", "asistente", "preparador_fisico", "entrenador_porteros", "delegado", "fisio", "analista", "coordinador"];
const roleRank = (r) => { const i = ROLE_ORDER.indexOf(r); return i < 0 ? 99 : i; };

/** Partidos de liga ya jugados con resultado (no suspendidos), del más antiguo al más reciente.
 * score_home = nuestros goles, score_away = los del rival. */
export function playedLeague(events = [], teamId, now = new Date()) {
  const t = time(now);
  return events
    .filter((e) => e.team_id === teamId && e.type === LEAGUE && e.cancelled !== true && e.score_home != null && e.score_away != null && e.score_home !== "" && e.score_away !== "" && time(e.date) <= t)
    .sort((a, b) => time(a.date) - time(b.date));
}

/** Racha: los últimos n partidos de liga, del más antiguo al más reciente, como G (ganado), E (empate) o P (perdido) */
export function leagueForm(played = [], n = 5) {
  return played.slice(-n).map((m) => {
    const a = Number(m.score_home), b = Number(m.score_away);
    return a > b ? "G" : a < b ? "P" : "E";
  });
}

/** Victorias, empates, derrotas y goles de una lista de partidos con resultado */
export function record(played = []) {
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  for (const m of played) {
    const a = Number(m.score_home), b = Number(m.score_away);
    gf += a; ga += b;
    if (a > b) w++; else if (a < b) l++; else d++;
  }
  return { w, d, l, n: w + d + l, gf, ga };
}

/** Próximo partido (liga, amistoso o torneo) que no esté suspendido ni aplazado */
export function nextMatch(events = [], teamId, now = new Date()) {
  const t = time(now);
  return events
    .filter((e) => e.team_id === teamId && String(e.type || "").includes("partido") && !e.postponed && e.cancelled !== true && time(e.date) >= t)
    .sort((a, b) => time(a.date) - time(b.date))[0] || null;
}

/** % de asistencia a entrenos de los últimos `days` días por equipo: Map teamId → {rate, n} (sin eventos suspendidos) */
export function teamAttendance(attendance = [], eventsById = new Map(), { now = new Date(), days = 30 } = {}) {
  const t = time(now), from = t - days * DAY;
  const by = new Map();
  for (const a of attendance) {
    if (!a.status) continue;
    const ev = eventsById.get(a.event_id);
    if (!ev || ev.cancelled === true) continue;
    const when = time(ev.date);
    if (!(when >= from && when <= t)) continue;
    const s = by.get(ev.team_id) || { n: 0, ok: 0 };
    s.n++; if (a.status !== "absent") s.ok++;
    by.set(ev.team_id, s);
  }
  const out = new Map();
  for (const [id, s] of by) out.set(id, { rate: Math.round((s.ok / s.n) * 100), n: s.n });
  return out;
}

/** Cuerpo técnico de un equipo: el principal (primer entrenador, si no el que más arriba esté) y cuántos más hay.
 * `assignments` = asignaciones activas del equipo; `nameOf(staffId)` da el nombre. Sin asignaciones, el texto `team.coach`. */
export function coachOf(assignments = [], nameOf = () => "", team = {}) {
  const list = assignments.filter((a) => a.active !== false && nameOf(a.staff_member_id)).sort((a, b) => roleRank(a.team_role) - roleRank(b.team_role));
  const coaches = list.filter((a) => COACHING.includes(a.team_role));
  if (coaches.length) return { name: nameOf(coaches[0].staff_member_id), extra: list.length - 1, none: false };
  if (team.coach) return { name: team.coach, extra: list.length, none: false };
  return { name: null, extra: list.length, none: true };
}

/** Puesto en la clasificación: {pos, pts, gap} (gap = puntos que le saca el líder) o null */
export function standingOf(st) {
  const rows = st?.rows || [];
  const me = rows.find((r) => r.teamId === st?.ourTeamId);
  if (!me) return null;
  const leader = rows.reduce((m, r) => (m == null || r.pos < m.pos ? r : m), null);
  return { pos: me.pos, pts: me.pts, gap: leader ? Math.max(0, (leader.pts || 0) - (me.pts || 0)) : 0 };
}

/** Orden de la lista: «categoria» (el que llega), «clasificacion» (mejor puesto primero) o «entrenos» (más bajo primero) */
export function sortOverview(rows = [], mode = "categoria") {
  const list = [...rows];
  if (mode === "clasificacion") return list.sort((a, b) => (a.standing?.pos ?? 999) - (b.standing?.pos ?? 999));
  if (mode === "entrenos") return list.sort((a, b) => (a.att?.rate ?? 999) - (b.att?.rate ?? 999));
  return list;
}

/** Números del resumen de arriba */
export function overviewKpis(rows = []) {
  const k = { teams: rows.length, f7: 0, f11: 0, players: 0, injured: 0, w: 0, d: 0, l: 0, pending: 0, noCoach: 0 };
  for (const r of rows) {
    if (r.f7) k.f7++; else k.f11++;
    k.players += r.players; k.injured += r.injured;
    k.w += r.rec.w; k.d += r.rec.d; k.l += r.rec.l;
    k.pending += r.pending;
    if (r.coach.none) k.noCoach++;
  }
  const n = k.w + k.d + k.l;
  k.winPct = n ? Math.round((k.w / n) * 100) : null;
  return k;
}

/** Busca por nombre del equipo o del entrenador, sin acentos ni mayúsculas */
export function matchesSearch(r, q) {
  const f = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const s = f(q).trim();
  return !s || f(r.team.name).includes(s) || f(r.coach.name).includes(s);
}
