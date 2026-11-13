// Cálculos de la ficha del jugador (sin importaciones de la app: se prueban en Node).

const LEAGUE = "partido_liga";
const MATCHES = ["partido_amistoso", "partido_liga", "torneo"];
const TRAININGS = ["entrenamiento", "entrenamiento_fisico", "sesion_teorica", "sesion_video"];
const time = (d) => { const x = new Date(d || 0).getTime(); return Number.isNaN(x) ? 0 : x; };

/** Nuestro resultado: "W" | "D" | "L" o null sin marcador (score_home = nuestros goles). */
export function resultCode(ev) {
  if (ev?.score_home == null || ev?.score_away == null) return null;
  const a = Number(ev.score_home), b = Number(ev.score_away);
  return a > b ? "W" : a < b ? "L" : "D";
}

/**
 * Partidos de liga ya cerrados que cuentan para el jugador: los de su equipo y aquellos en que jugó de invitado.
 * Del más reciente al más antiguo: { ev, guest, called, starter, minutes, goals, assists, yellow, red, rating, result, reason }
 */
export function matchRows({ events = [], convs = [], stats = [], playerId, teamId, counted }) {
  const convBy = new Map(convs.map((c) => [c.event_id, c]));
  const statBy = new Map(stats.filter((s) => s.player_id === playerId).map((s) => [s.event_id, s]));
  const rows = [];
  for (const ev of events) {
    if (ev.type !== LEAGUE || (counted && !counted.has(ev.id))) continue;
    const stat = statBy.get(ev.id) || null;
    const conv = convBy.get(ev.id) || null;
    const own = ev.team_id === teamId;
    const called = !!stat || (conv?.player_ids || []).includes(playerId);
    if (!own && !called) continue;
    const minutes = stat?.minutes_played || 0;
    rows.push({
      ev, guest: !own, called, starter: called && (conv?.starters || []).includes(playerId), minutes,
      goals: stat?.goals || 0, assists: stat?.assists || 0, yellow: stat?.yellow_cards || 0, red: stat?.red_cards || 0,
      rating: stat?.rating || null, result: resultCode(ev), reason: !called ? conv?.absence_reasons?.[playerId] || null : null,
    });
  }
  return rows.sort((a, b) => time(b.ev.date) - time(a.ev.date));
}

/** Resumen de la temporada a partir de matchRows */
export function seasonTotals(rows = []) {
  const played = rows.filter((r) => r.minutes > 0);
  const rated = rows.filter((r) => r.rating);
  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  return {
    matches: rows.length, called: rows.filter((r) => r.called).length, played: played.length,
    starter: rows.filter((r) => r.starter).length, sub: played.filter((r) => !r.starter).length,
    minutes: sum("minutes"), goals: sum("goals"), assists: sum("assists"), yellow: sum("yellow"), red: sum("red"),
    rating: rated.length ? Math.round((rated.reduce((a, r) => a + r.rating, 0) / rated.length) * 10) / 10 : null,
    ratedN: rated.length,
  };
}

/** Asistencia de un jugador en los últimos `days` días (al margen cuenta como asiste) */
export function attendanceWindow(attendance = [], eventsById = new Map(), { now = new Date(), days = 30 } = {}) {
  const from = now.getTime() - days * 86400000;
  const out = { n: 0, present: 0, apart: 0, absent: 0, pct: null, topReason: null };
  const reasons = {};
  for (const a of attendance) {
    if (!a.status) continue;
    const when = time(eventsById.get(a.event_id)?.date || a.date);
    if (!(when >= from && when <= now.getTime())) continue;
    out.n += 1;
    if (a.status === "present") out.present += 1;
    else if (a.status === "apart") out.apart += 1;
    else { out.absent += 1; if (a.absence_reason) reasons[a.absence_reason] = (reasons[a.absence_reason] || 0) + 1; }
  }
  if (out.n) out.pct = Math.round(((out.present + out.apart) / out.n) * 100);
  const top = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
  out.topReason = top ? { reason: top[0], n: top[1] } : null;
  return out;
}

/** Las últimas `n` sesiones con asistencia, de la más antigua a la más reciente: [{ status, date, reason }] */
export function attendanceStrip(attendance = [], eventsById = new Map(), { now = new Date(), n = 20 } = {}) {
  return attendance
    .filter((a) => a.status)
    .map((a) => ({ status: a.status, reason: a.absence_reason || null, date: eventsById.get(a.event_id)?.date || a.date || null }))
    .filter((a) => a.date && time(a.date) <= now.getTime())
    .sort((a, b) => time(a.date) - time(b.date))
    .slice(-n);
}

/**
 * Próximo partido del equipo del jugador y si está convocado:
 * state = "called" (en la lista) | "out" (convocatoria hecha y no está; reason = motivo) | "none" (sin convocatoria aún)
 */
export function nextMatchFor({ events = [], convs = [], teamId, playerId, now = new Date() }) {
  if (!teamId) return null;
  const ev = events
    .filter((e) => e.team_id === teamId && MATCHES.includes(e.type) && e.cancelled !== true && !e.postponed && time(e.date) >= now.getTime() - 2 * 3600000)
    .sort((a, b) => time(a.date) - time(b.date))[0];
  if (!ev) return null;
  const conv = convs.find((c) => c.event_id === ev.id) || null;
  const ids = conv?.player_ids || [];
  const state = ids.includes(playerId) ? "called" : ids.length ? "out" : "none";
  return { ev, conv, state, reason: state === "out" ? conv?.absence_reasons?.[playerId] || null : null };
}

/** Jugador anterior y siguiente del mismo equipo (sin las bajas), por dorsal y luego por apellido */
export function neighbours(players = [], player) {
  if (!player?.team_id) return { prev: null, next: null, index: -1, total: 0 };
  const num = (p) => { const n = parseInt(p.jersey_number, 10); return Number.isNaN(n) ? 999 : n; };
  const list = players
    .filter((p) => p.team_id === player.team_id && (p.status !== "baja" || p.id === player.id))
    .sort((a, b) => num(a) - num(b) || String(a.last_name || "").localeCompare(String(b.last_name || "")) || String(a.first_name || "").localeCompare(String(b.first_name || "")));
  const i = list.findIndex((p) => p.id === player.id);
  return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null, index: i, total: list.length };
}

export const isTraining = (e) => TRAININGS.includes(e?.type);
