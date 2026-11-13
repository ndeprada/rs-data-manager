// Personal (rediseño del 13/11/2026, maqueta «Maqueta Personal · RS Manager» aprobada por Nacho: «esto me parece perfecto»).
// Cálculos puros del seguimiento de cada persona del cuerpo técnico y de sus ausencias y multas (pedido por Nacho el mismo día:
// «los días que no asista poderlo anotar» y «llevar un registro de las sanciones que les ponemos»).
// Sin importaciones de la app (salvo la marca de traducción): se prueba en Node (tests/coachOverview.test.mjs).
import { msg } from "../i18n/translate.js";
import { COACH_AREAS } from "./coachAreas.js";
import { aggregateArea, obsAreaOf } from "./coachAreaCriteria.js";
import { openPeriodRange, progressOf } from "./coachPeriods.js";
import { inRange, quarterRange } from "./coachQuarters.js";
import { pastTrainings } from "./trainingAttendance.js";
import { playedLeague, record } from "./teamsOverview.js";

const DAY = 86400000;
const time = (d) => (d instanceof Date ? d.getTime() : new Date(d).getTime());
const dayOf = (v) => String(v || "").slice(0, 10);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);

// Colores de las columnas: sesiones registradas (verde desde el 80 %, ámbar desde el 60 %) y listas pasadas (95 % / 80 %).
// Umbrales míos, por confirmar con Nacho.
export const SESSION_LEVELS = { ok: 80, warn: 60 };
export const LIST_LEVELS = { ok: 95, warn: 80 };
export const FEEDBACK_DAYS = 30;
export const levelOf = (value, { ok, warn }) => (value == null ? null : value >= ok ? "ok" : value >= warn ? "warn" : "bad");

// Grupos del filtro «Todos · Entrenadores · Coordinación · Otros»
export const COACH_ROLES = ["entrenador", "ayudante", "entrenador_porteros", "portero_coach"];
export const COORD_ROLES = ["coordinador", "coordinador_general", "coordinador_f7", "coordinador_f11", "director", "director_deportivo", "admin"];
export const roleGroup = (role) => (COACH_ROLES.includes(role) ? "entrenadores" : COORD_ROLES.includes(role) ? "coordinacion" : "otros");

/** Registros (feedback, observaciones, ausencias…) de una persona: los que llevan alguno de sus ids */
export const ofPerson = (items = [], ids) => items.filter((x) => ids.has(x.staff_id));

/** Feedback de los últimos 30 días y el último (fecha y hace cuántos días) */
export function feedbackSummary(feedback = [], ids, now = new Date()) {
  const mine = ofPerson(feedback, ids).filter((f) => f.date);
  const from = time(now) - FEEDBACK_DAYS * DAY;
  const n30 = mine.filter((f) => time(`${dayOf(f.date)}T12:00:00`) >= from).length;
  const last = mine.reduce((m, f) => (dayOf(f.date) > m ? dayOf(f.date) : m), "");
  const daysAgo = last ? Math.max(0, Math.floor((time(now) - time(`${last}T12:00:00`)) / DAY)) : null;
  return { n30, total: mine.length, last: last || null, daysAgo };
}

/** Lo marcado «Seguir trabajando» de la temporada, del más reciente al más antiguo */
export function followingUp(feedback = [], ids, season) {
  const from = quarterRange(season, "all").from;
  return ofPerson(feedback, ids).filter((f) => progressOf(f) === "seguir" && dayOf(f.date) >= from).sort((a, b) => dayOf(b.date).localeCompare(dayOf(a.date)));
}

/** Media de cada área de la 360 en el periodo abierto (observaciones de quien evalúa; publicadas o no) */
export function areaAverages(observations = [], closes = [], ids, season) {
  const range = openPeriodRange(ofPerson(closes, ids), season);
  const obs = ofPerson(observations, ids).filter((o) => inRange(o.date, range));
  const areas = {};
  for (const a of COACH_AREAS) {
    const list = obs.filter((o) => obsAreaOf(o) === a.key);
    areas[a.key] = { avg: list.length ? aggregateArea(list, a.key).overall : null, n: list.length };
  }
  const vals = Object.values(areas).map((x) => x.avg).filter((v) => v != null);
  return { range, areas, overall: vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null, n: obs.length };
}

/**
 * Seguimiento de un equipo en los últimos `days` días: entrenos celebrados, con hoja de sesión registrada (de cualquiera
 * del cuerpo técnico de ese equipo, por partido o por día), con lista pasada, partidos por cerrar, asistencia y V-E-D de liga.
 * `pendingIds` = partidos jugados que aún no están cerrados (useMatchStatus().pending).
 */
export function teamFollow({ teamId, events = [], attendance = [], sessions = [], pendingIds = new Set(), now = new Date(), days = 30, cancelled }) {
  const from = time(now) - days * DAY;
  const list = pastTrainings(events, attendance, { teamId, now, ...(cancelled ? { cancelled } : {}) }).filter((x) => time(x.ev.date) >= from);
  const held = list.filter((x) => x.state !== "off");
  const mine = sessions.filter((s) => s.team_id === teamId);
  const withSession = held.filter(({ ev }) => mine.some((s) => s.event_id === ev.id || dayOf(s.date) === dayOf(ev.date))).length;
  const done = held.filter((x) => x.state === "done");
  let ok = 0, marked = 0;
  for (const { recs } of done) for (const r of recs) { if (!r.status) continue; marked++; if (r.status !== "absent") ok++; }
  const actas = events.filter((e) => e.team_id === teamId && pendingIds.has(e.id)).length;
  return {
    teamId, held: held.length, withSession, sessionsPct: pct(withSession, held.length),
    lists: done.length, listsPct: pct(done.length, held.length), pendingLists: held.length - done.length,
    actas, attendance: pct(ok, marked), rec: record(playedLeague(events, teamId, now)),
  };
}

/** Suma del seguimiento de los equipos de una persona (null si no lleva ningún equipo) */
export function personFollow(follows = []) {
  if (!follows.length) return null;
  const s = follows.reduce((a, f) => ({ held: a.held + f.held, withSession: a.withSession + f.withSession, lists: a.lists + f.lists, pendingLists: a.pendingLists + f.pendingLists, actas: a.actas + f.actas }), { held: 0, withSession: 0, lists: 0, pendingLists: 0, actas: 0 });
  return { ...s, sessionsPct: pct(s.withSession, s.held), listsPct: pct(s.lists, s.held) };
}

/** Cuánto «pesa» una persona en el orden «Por alerta» (más = antes) */
export function alertScore(row) {
  if (!row.follow) return row.feedback?.n30 === 0 && row.isCoach ? 1 : 0;
  let s = 0;
  if (row.isCoach && row.feedback?.n30 === 0) s += 2;
  const sl = levelOf(row.follow.sessionsPct, SESSION_LEVELS), ll = levelOf(row.follow.listsPct, LIST_LEVELS);
  s += sl === "bad" ? 2 : sl === "warn" ? 1 : 0;
  s += ll === "bad" ? 2 : ll === "warn" ? 1 : 0;
  s += Math.min(row.follow.actas, 3) + Math.min(row.behind || 0, 3);
  if (row.absences?.n30) s += 1;
  return s;
}

// ── Ausencias ─────────────────────────────────────────────────────────────────
// Solo se anotan los días que NO viene (no se pasa lista al personal): entreno, partido u otra cosa, con su motivo.
export const ABSENCE_KINDS = [
  { key: "entreno", label: msg("Entreno") },
  { key: "partido", label: msg("Partido") },
  { key: "otro", label: msg("Otro") },
];
export const ABSENCE_REASONS = [
  { key: "enfermo", label: msg("Enfermo") },
  { key: "lesion", label: msg("Lesión") },
  { key: "trabajo", label: msg("Trabajo") },
  { key: "estudios", label: msg("Estudios") },
  { key: "familiar", label: msg("Familiar") },
  { key: "viaje", label: msg("Viaje") },
  { key: "personal", label: msg("Personal") },
  { key: "sin_avisar", label: msg("Sin avisar") },
  { key: "otro", label: msg("Otro") },
];
export const reasonInfo = (key) => ABSENCE_REASONS.find((r) => r.key === key) || ABSENCE_REASONS[ABSENCE_REASONS.length - 1];
export const kindInfo = (key) => ABSENCE_KINDS.find((r) => r.key === key) || ABSENCE_KINDS[ABSENCE_KINDS.length - 1];

/** Ausencias de la temporada y de los últimos 30 días; `last` = la más reciente */
export function absenceSummary(absences = [], ids, season, now = new Date()) {
  const from = quarterRange(season, "all").from;
  const mine = ofPerson(absences, ids).filter((a) => dayOf(a.date) >= from).sort((a, b) => dayOf(b.date).localeCompare(dayOf(a.date)));
  const since = time(now) - 30 * DAY;
  return {
    season: mine.length, n30: mine.filter((a) => time(`${dayOf(a.date)}T12:00:00`) >= since).length,
    unnotified: mine.filter((a) => a.notified === false || a.reason === "sin_avisar").length,
    trainings: mine.filter((a) => a.kind === "entreno").length, matches: mine.filter((a) => a.kind === "partido").length,
    last: mine[0] || null, list: mine,
  };
}

/** Limpia el formulario de una ausencia antes de guardarla (null si falta algo) */
export function cleanAbsence(f = {}) {
  const date = dayOf(f.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !f.staff_id) return null;
  return {
    staff_id: f.staff_id, date, kind: ABSENCE_KINDS.some((k) => k.key === f.kind) ? f.kind : "otro",
    team_id: f.team_id || null, event_id: f.event_id || null,
    reason: ABSENCE_REASONS.some((r) => r.key === f.reason) ? f.reason : "otro",
    notified: f.reason === "sin_avisar" ? false : f.notified !== false,
    notes: String(f.notes || "").trim().slice(0, 500),
  };
}

// ── Multas ────────────────────────────────────────────────────────────────────
export const FINE_CONCEPTS = [
  { key: "material", label: msg("Material") },
  { key: "tarjeta", label: msg("Tarjeta") },
  { key: "retraso", label: msg("Retraso") },
  { key: "falta", label: msg("Falta sin avisar") },
  { key: "otro", label: msg("Otro") },
];
export const conceptInfo = (key) => FINE_CONCEPTS.find((r) => r.key === key) || FINE_CONCEPTS[FINE_CONCEPTS.length - 1];
export const FINE_STATUS = { pending: "pendiente", paid: "pagada" };

/** «12,5» o «12.50 €» → 12.5 (null si no es un importe válido) */
export function parseAmount(v) {
  const s = String(v ?? "").replace(/[€\s]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}

/** Multas de la temporada: cuántas, cuánto queda por pagar y cuánto se ha pagado */
export function fineSummary(fines = [], ids, season) {
  const from = quarterRange(season, "all").from;
  const mine = ofPerson(fines, ids).filter((f) => dayOf(f.date) >= from).sort((a, b) => dayOf(b.date).localeCompare(dayOf(a.date)));
  const sum = (l) => Math.round(l.reduce((s, f) => s + (Number(f.amount) || 0), 0) * 100) / 100;
  const pending = mine.filter((f) => f.status !== FINE_STATUS.paid);
  return { n: mine.length, pending: pending.length, pendingAmount: sum(pending), paidAmount: sum(mine.filter((f) => f.status === FINE_STATUS.paid)), total: sum(mine), list: mine };
}

/** Limpia el formulario de una multa (null si falta la fecha o el importe) */
export function cleanFine(f = {}) {
  const date = dayOf(f.date);
  const amount = parseAmount(f.amount);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || amount == null || !f.staff_id) return null;
  const status = f.status === FINE_STATUS.paid ? FINE_STATUS.paid : FINE_STATUS.pending;
  return {
    staff_id: f.staff_id, date, amount, status,
    concept: FINE_CONCEPTS.some((c) => c.key === f.concept) ? f.concept : "otro",
    description: String(f.description || "").trim().slice(0, 300),
    team_id: f.team_id || null, event_id: f.event_id || null,
    paid_at: status === FINE_STATUS.paid ? dayOf(f.paid_at) || null : null,
  };
}

/** Partidos y entrenos de los equipos de la persona para elegir a qué faltó: de 60 días atrás a 14 días adelante, sin suspendidos */
export function absenceEventOptions(events = [], teamIds = [], now = new Date()) {
  const from = time(now) - 60 * DAY, to = time(now) + 14 * DAY;
  const kindOf = (e) => (String(e.type || "").includes("partido") || e.type === "torneo" ? "partido" : String(e.type || "").startsWith("entrenamiento") ? "entreno" : null);
  return events
    .filter((e) => teamIds.includes(e.team_id) && e.date && kindOf(e) && e.cancelled !== true && time(e.date) >= from && time(e.date) <= to)
    .sort((a, b) => time(b.date) - time(a.date))
    .map((e) => ({ ev: e, kind: kindOf(e) }));
}
