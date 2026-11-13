// Mi equipo → Entrenamientos (rediseño del 13/11/2026, maqueta «Maqueta Entrenamientos · RS Manager» aprobada por Nacho:
// «ok»). Cálculos puros de la asistencia a entrenos. Sin importaciones de la app: se prueba en Node
// (tests/trainingAttendance.test.mjs). «A parte» cuenta como asistencia (como en el Panel y en Mi equipo).

export const TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico", "sesion_teorica", "sesion_video"];
const DAY = 86400000;
const time = (d) => new Date(d || 0).getTime();
const dayOf = (ev) => String(ev?.date || "").split("T")[0];
const isOff = (ev) => ev?.cancelled === true;

/** Registros de un entreno: los que llevan su event_id y los antiguos sin event_id del mismo día */
export function recordsOf(attendance = [], ev) {
  if (!ev) return [];
  const d = dayOf(ev);
  return attendance.filter((a) => a.event_id === ev.id || (!a.event_id && a.date === d));
}

/** Inicio del periodo elegido: «temporada» (1 de agosto), «30» (últimos 30 días) o «mes» (día 1 de este mes) */
export function periodStart(period, now = new Date()) {
  if (period === "30") return new Date(now.getTime() - 30 * DAY);
  if (period === "mes") return new Date(now.getFullYear(), now.getMonth(), 1);
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(y, 7, 1);
}

/**
 * Entrenos del equipo ya celebrados, del más antiguo al más reciente, con su estado:
 * «done» (lista pasada), «pending» (ya pasó y sin lista), «off» (cancelado). Los futuros no salen.
 * `cancelled(ev)` dice si está cancelado (por defecto, el campo `cancelled`).
 */
export function pastTrainings(events = [], attendance = [], { teamId, now = new Date(), cancelled = isOff } = {}) {
  const t = now.getTime();
  return events
    .filter((e) => e.team_id === teamId && TRAINING_TYPES.includes(e.type) && e.date && time(e.date) <= t)
    .sort((a, b) => time(a.date) - time(b.date))
    .map((ev) => {
      const recs = recordsOf(attendance, ev);
      const state = cancelled(ev) ? "off" : recs.some((r) => r.status) ? "done" : "pending";
      return { ev, recs, state };
    });
}

/** Recuento de un entreno sobre la plantilla (los de fuera no cuentan como «sin marcar») */
export function sessionCounts(recs = [], rosterIds = []) {
  const c = { present: 0, apart: 0, absent: 0, pending: 0 };
  const byId = new Map(recs.map((r) => [r.player_id, r]));
  for (const id of rosterIds) {
    const st = byId.get(id)?.status;
    if (st && c[st] !== undefined) c[st]++; else c.pending++;
  }
  const marked = c.present + c.apart + c.absent;
  return { ...c, marked, pct: marked ? Math.round(((c.present + c.apart) / marked) * 100) : null };
}

/** Recuento de un entreno con todos sus registros (plantilla y de fuera), para la lista de entrenos recientes */
export function sessionTotals(recs = []) {
  const c = { present: 0, apart: 0, absent: 0 };
  for (const r of recs) if (c[r.status] !== undefined) c[r.status]++;
  const marked = c.present + c.apart + c.absent;
  return { ...c, marked, pct: marked ? Math.round(((c.present + c.apart) / marked) * 100) : null };
}

const CODE = { present: "s", apart: "a", absent: "n" };

/**
 * Resumen por jugador en el periodo (desde `since`): asiste, a parte, no, motivos y % sobre los entrenos en los que
 * tiene algo marcado. `last`: los últimos `lastN` entrenos (de toda la temporada) como códigos
 * s (asiste) · a (a parte) · n (no) · x (sin marcar) · c (cancelado). Los entrenos sin lista no salen en `last`.
 */
export function playerSummary(players = [], trainings = [], { since = null, lastN = 10 } = {}) {
  const from = since ? since.getTime() : -Infinity;
  const inPeriod = trainings.filter((t) => t.state === "done" && time(t.ev.date) >= from);
  const shown = trainings.filter((t) => t.state !== "pending").slice(-lastN);
  return players.map((p) => {
    const c = { present: 0, apart: 0, absent: 0, reasons: {} };
    for (const t of inPeriod) {
      const r = t.recs.find((x) => x.player_id === p.id);
      if (!r?.status) continue;
      c[r.status]++;
      if (r.status === "absent") { const k = r.absence_reason || "otro"; c.reasons[k] = (c.reasons[k] || 0) + 1; }
    }
    const marked = c.present + c.apart + c.absent;
    const last = shown.map((t) => {
      if (t.state === "off") return "c";
      const r = t.recs.find((x) => x.player_id === p.id);
      return CODE[r?.status] || "x";
    });
    return { p, ...c, marked, pct: marked ? Math.round(((c.present + c.apart) / marked) * 100) : null, last };
  });
}

/** Motivos de ausencia sumados, de más a menos: [[motivo, n]] */
export function reasonTotals(rows = []) {
  const acc = {};
  for (const r of rows) for (const [k, n] of Object.entries(r.reasons || {})) acc[k] = (acc[k] || 0) + n;
  return Object.entries(acc).sort((a, b) => b[1] - a[1]);
}

/** % de asistencia de un conjunto de registros (solo los marcados) */
export function rateOf(recs = []) {
  let n = 0, ok = 0;
  for (const r of recs) { if (!r.status) continue; n++; if (r.status !== "absent") ok++; }
  return n ? Math.round((ok / n) * 100) : null;
}

/** % del equipo en el periodo y de los últimos 30 días frente a los 30 anteriores */
export function teamRates(trainings = [], { since = null, now = new Date(), rosterIds = null } = {}) {
  const ids = rosterIds ? new Set(rosterIds) : null;
  const keep = (r) => !ids || ids.has(r.player_id);
  const done = trainings.filter((t) => t.state === "done");
  const between = (a, b) => done.filter((t) => time(t.ev.date) >= a && time(t.ev.date) <= b).flatMap((t) => t.recs.filter(keep));
  const t = now.getTime();
  const period = between(since ? since.getTime() : -Infinity, t);
  const cur = rateOf(between(t - 30 * DAY, t));
  const prev = rateOf(between(t - 60 * DAY, t - 30 * DAY - 1));
  return { period: rateOf(period), last30: cur, trend: cur != null && prev != null ? cur - prev : null };
}

/** Entreno anterior y siguiente del equipo (por fecha) alrededor del abierto */
export function neighbours(events = [], ev, { teamId } = {}) {
  if (!ev) return { prev: null, next: null };
  const list = events.filter((e) => e.team_id === (teamId || ev.team_id) && TRAINING_TYPES.includes(e.type) && e.date)
    .sort((a, b) => time(a.date) - time(b.date) || String(a.id).localeCompare(String(b.id)));
  const i = list.findIndex((e) => e.id === ev.id);
  return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
}

/** Faltas de un jugador en sus últimos `n` entrenos marcados (para «3.ª en 5 entrenos») */
export function recentAbsences(trainings = [], playerId, n = 5) {
  const marked = trainings.filter((t) => t.state === "done").map((t) => t.recs.find((r) => r.player_id === playerId)?.status).filter(Boolean);
  const tail = marked.slice(-n);
  return { absent: tail.filter((s) => s === "absent").length, of: tail.length };
}

/** Orden de la tabla: «posicion» (lo hace la página por grupos), «bajo» (% más bajo primero) o «dorsal» */
export function sortSummary(rows = [], mode) {
  const num = (v) => (v == null || v === "" ? 999 : Number(v));
  const list = [...rows];
  if (mode === "bajo") return list.sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || num(a.p?.jersey_number) - num(b.p?.jersey_number));
  return list.sort((a, b) => num(a.p?.jersey_number) - num(b.p?.jersey_number));
}
