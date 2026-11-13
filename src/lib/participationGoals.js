// Objetivos de participación a final de temporada (13/11/2026, pedido por Nacho): en las categorías que no son de
// rendimiento, cada jugador debería llegar al final de la liga con un mínimo de partidos de titular, partidos completos
// y, en fútbol 7, partidos de 3 cuartos o más. Funciones puras (se prueban con tests).
// Se guardan en la misma fila MinutesRule: goals = { f7: {full, q3}, f11: {starts, full} } y
// team_goals = { <teamId>: {…} | { off: true } } (off = equipo de rendimiento, sin objetivos).
import { teamPlaysF7 } from './matchFormat.js';
import { msg } from "../i18n/translate.js";

// Los ejemplos que dio Nacho: F11 8 de titular y 5 completos; F7 3 completos y 5 de 3 cuartos o más
export const DEFAULT_GOALS = { f11: { starts: 8, full: 5 }, f7: { full: 3, q3: 5 } };
export const GOAL_KEYS = { f11: ['starts', 'full'], f7: ['full', 'q3'] };
export const GOAL_LABEL = { starts: msg("Titular"), full: msg("Completos"), q3: msg("3 cuartos o más") };
export const GOAL_SHORT = { starts: msg("Tit."), full: msg("Comp."), q3: msg("3C+") };

const num = (v) => { if (v === '' || v == null) return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 60 ? n : null; };

/** Objetivos limpios de un formato: solo los números válidos y mayores que 0; null si no queda ninguno */
export function cleanGoals(g, format) {
  if (!g) return null;
  const out = {};
  for (const k of GOAL_KEYS[format] || []) { const n = num(g[k]); if (n) out[k] = n; }
  return Object.keys(out).length ? out : null;
}

/** Objetivos del club y de cada equipo a partir de la fila guardada (sin nada guardado, los de por defecto) */
export function goalsOf(doc) {
  const g = doc?.goals;
  const base = (f) => (g && f in g ? cleanGoals(g[f], f) : DEFAULT_GOALS[f]);
  const teams = {};
  for (const [id, r] of Object.entries(doc?.team_goals || {})) {
    if (r?.off) teams[id] = { off: true };
    else { const c = cleanGoals(r, r?.format === 'f7' ? 'f7' : 'f11'); if (c) teams[id] = { ...c, format: r.format === 'f7' ? 'f7' : 'f11' }; }
  }
  return { f7: base('f7'), f11: base('f11'), teams };
}

/** Los objetivos que valen para un equipo (null = sin objetivos: equipo de rendimiento o nada fijado) */
export function goalsFor(team, goals) {
  if (!team) return null;
  const fmt = teamPlaysF7(team) ? 'f7' : 'f11';
  const own = goals?.teams?.[team.id];
  if (own?.off) return null;
  const g = own ? cleanGoals(own, fmt) : (goals && fmt in goals ? goals[fmt] : DEFAULT_GOALS[fmt]);
  return g ? { format: fmt, ...g } : null;
}

/**
 * Cómo va un objetivo: done (cumplido) · ok (va a ritmo) · behind (por detrás del ritmo) · impossible (ya no llega).
 * played = partidos de liga en que el jugador estaba disponible (un lesionado no va «por detrás» por los que se perdió);
 * remaining = los que le quedan al equipo en el calendario.
 * El ritmo es la parte del objetivo que toca a estas alturas: objetivo × jugados ÷ (jugados + quedan).
 */
export function goalState(value, target, { played = 0, remaining = 0 } = {}) {
  if (value >= target) return 'done';
  if (value + remaining < target) return 'impossible';
  const total = played + remaining;
  if (total > 0 && value < Math.floor((target * played) / total)) return 'behind';
  return 'ok';
}

/** Objetivos de un jugador con su valor (del bucket de participación) y su estado */
export function playerGoals(b, goals, season) {
  if (!goals || !b) return [];
  const val = { starts: b.titular || 0, full: b.full || 0, q3: b.q3plus || 0 };
  return GOAL_KEYS[goals.format].filter((k) => goals[k]).map((k) => ({ key: k, value: val[k], target: goals[k], state: goalState(val[k], goals[k], season) }));
}

/** ¿Algún objetivo por detrás del ritmo o que ya no se puede cumplir? */
export const goalsBehind = (list) => list.some((g) => g.state === 'behind' || g.state === 'impossible');

const ms = (d) => new Date(d).getTime();
/** Partidos de liga del equipo ya jugados y los que le quedan en el calendario (sin suspendidos ni aplazados) */
export function seasonPace(events = [], teamId, now = new Date()) {
  const t = ms(now);
  let played = 0, remaining = 0;
  for (const e of events) {
    if (e.team_id !== teamId || e.type !== 'partido_liga' || e.cancelled === true || e.postponed) continue;
    if (ms(e.date) <= t) played++; else remaining++;
  }
  return { played, remaining };
}
