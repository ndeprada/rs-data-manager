// Participación de un jugador en los partidos: titular, suplente, no convocado (y por qué), minutos y porcentajes.
// Funciones puras (se prueban con tests). Los partidos que se pasan ya vienen filtrados (cerrados y del tipo elegido).
import { defaultDuration, totalMinutes, quartersPlayed } from './matchDuration.js';
import { matchFormat, teamPlaysF7 } from './matchFormat.js';
import { msg } from "../i18n/translate.js";
import { isPrimerEquipo } from './primerEquipo.js';

// Mínimo de minutos POR PARTIDO para un convocado (14/11/2026, Nacho): fútbol 11 = 25 minutos; fútbol 7 = la mitad de lo que
// dura el partido en esa categoría. Es otra cosa que el % de minutos de la temporada (MIN_PCT). En las etapas de rendimiento
// (Cadet S16 A, juveniles y primer equipo) el mínimo se mantiene pero es orientativo.
export const MATCH_MIN_F11 = 25;
export const matchMinimum = (format, duration) => (format === 'f7' ? Math.round((Number(duration) || 0) / 2) : MATCH_MIN_F11);
const normTeam = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_\s]+/g, ' ').trim();
export function isPerformanceTeam(team) {
  if (!team) return false;
  const n = normTeam(team.name), c = normTeam(team.category);
  return isPrimerEquipo(team) || n.startsWith('juvenil') || c.includes('juvenil') || /^cadet s16 a\b/.test(n);
}

// Motivos por los que un jugador no está convocado (los mismos que se eligen en la pestaña Convocatoria).
// `ajeno` = motivo ajeno al entrenador: ese partido el jugador NO estaba disponible y no cuenta para el % de minutos.
// Si lo deja fuera el entrenador (decisión técnica, descanso) o no hay motivo, el partido sí cuenta como disponible (0 minutos).
export const NO_CONV_REASONS = [
  { value: 'lesion', label: msg("Lesión"), short: msg("Lesión"), ajeno: true },
  { value: 'enfermo', label: msg("Enfermo (cuenta como lesión)"), short: msg("Enfermo"), ajeno: true },
  { value: 'sancion', label: msg("Sanción"), short: msg("Sanción"), ajeno: true },
  { value: 'descanso', label: msg("Descanso"), short: msg("Descanso"), ajeno: false },
  { value: 'decision_tecnica', label: msg("Dec. técnica"), short: msg("Dec. técnica"), ajeno: false },
  { value: 'viaje', label: msg("Viaje"), short: msg("Viaje"), ajeno: true },
  { value: 'estudios', label: msg("Estudios"), short: msg("Estudios"), ajeno: true },
  { value: 'otro', label: msg("Otro"), short: msg("Otro"), ajeno: true },
];
export const NO_REASON = 'sin_motivo';
export const reasonShort = (r) => (r === NO_REASON ? msg("Sin motivo") : NO_CONV_REASONS.find((x) => x.value === r)?.short || r);
// Orden en el que se enseñan los motivos (los de sin motivo, al final)
export const REASON_ORDER = [...NO_CONV_REASONS.map((r) => r.value), NO_REASON];
// ¿El jugador no estaba a disposición del entrenador por ese motivo?
export const isAjeno = (reason) => !!NO_CONV_REASONS.find((x) => x.value === reason)?.ajeno;

// Minutos mínimos sobre los disponibles: por debajo salta la alerta. En fútbol 11 el objetivo del club es el 40 %.
// Son los valores por defecto: coordinación los puede cambiar para todo el club y, si hace falta, para un equipo concreto
// (entidad MinutesRule, una fila: { f7: {alert, target}, f11: {alert, target}, teams: { <teamId>: {alert, target} } }; 13/11/2026).
export const MIN_PCT = {
  f7: { alert: 50, target: null },
  f11: { alert: 35, target: 40 },
};
const pctOrNull = (v) => { if (v === '' || v == null) return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null; };
// Una regla limpia: { alert, target } (objetivo opcional y nunca por debajo de la alerta); null si no vale
export function cleanRule(r) {
  const alert = pctOrNull(r?.alert);
  if (alert == null) return null;
  const target = pctOrNull(r?.target);
  return { alert, target: target != null && target > alert ? target : null };
}
// Reglas del club a partir de la fila guardada (lo que falte, los valores por defecto)
export function rulesOf(doc) {
  const teams = {};
  for (const [id, r] of Object.entries(doc?.teams || {})) { const c = cleanRule(r); if (c) teams[id] = c; }
  return { f7: cleanRule(doc?.f7) || MIN_PCT.f7, f11: cleanRule(doc?.f11) || MIN_PCT.f11, teams };
}
// La regla que vale para un formato y el equipo del jugador: la propia del equipo (en el formato en que juega el equipo) o la del club
export function ruleFor(format, team, rules) {
  const own = team && rules?.teams?.[team.id];
  if (own && format === (teamPlaysF7(team) ? 'f7' : 'f11')) return own;
  return rules?.[format] || MIN_PCT[format];
}
// 'alert' (por debajo del mínimo), 'warn' (por debajo del objetivo) u 'ok'; null si no hay datos
export function minutesLevel(format, pct, rule) {
  const t = rule || MIN_PCT[format];
  if (!t || pct == null) return null;
  if (pct < t.alert) return 'alert';
  if (t.target && pct < t.target) return 'warn';
  return 'ok';
}
const SEVERITY = { ok: 0, warn: 1, alert: 2 };
export const worstLevel = (levels) => levels.filter(Boolean).sort((a, b) => SEVERITY[b] - SEVERITY[a])[0] || null;
export const FORMAT_LABEL = { f11: msg("Fútbol 11"), f7: msg("Fútbol 7") };

// Nivel de minutos de un jugador en la vista elegida ('all' = el peor de sus formatos con partidos disponibles).
// Un formato en el que no tuvo ningún partido disponible no cuenta.
export function playerLevel(part, format = 'all') {
  const formats = format === 'all' ? ['f7', 'f11'] : [format];
  return worstLevel(formats.filter((f) => part[f].availMatches > 0).map((f) => minutesLevel(f, part[f].pctAvail, part.rules?.[f])));
}

// Partes del partido: "2x45" -> 2, "4x15" -> 4
const partsOf = (duration) => { const m = String(duration || '').match(/^(\d+)x(\d+)$/); return m ? Number(m[1]) : null; };

// Formato del partido: el guardado o, si no lo hay, el que se deduce de la duración (4 cuartos = fútbol 7)
export function formatOfEvent(ev, duration, team) {
  if (teamPlaysF7(team)) return 'f7'; // manda la etapa del equipo (S12 hacia abajo = fútbol 7)
  if (ev?.football_format === 'f7' || ev?.football_format === 'f11') return ev.football_format;
  return partsOf(duration) === 4 ? 'f7' : 'f11';
}

const emptyBucket = () => ({
  conv: 0, played: 0, titular: 0, suplente: 0, suplenteSin: 0, noConv: 0, reasons: {},
  benched: 0, unavailable: 0,        // no convocados: lo deja fuera el entrenador (decisión técnica, descanso, sin motivo) / no podía estar
  quarters: [0, 0, 0, 0, 0], qMatches: 0, // partidos de 4 cuartos en que fue convocado, por cuartos jugados (0 a 4)
  full: 0, q3plus: 0,                // partidos completos (los 4 cuartos o todos los minutos) y, en F7, de 3 cuartos o más
  mins: 0,
  totalMatches: 0, totalMin: 0,      // todos los partidos del jugador (los de su equipo + en los que fue de invitado)
  availMatches: 0, availMin: 0,      // los partidos en que estaba a disposición del entrenador
  avgTotal: null, pctTotal: null, avgAvail: null, pctAvail: null,
});

const pct = (mins, of) => (of ? Math.min(100, Math.round((mins / of) * 100)) : null);

function finish(b) {
  b.pctAvail = pct(b.mins, b.availMin);
  b.pctTotal = pct(b.mins, b.totalMin);
  b.avgAvail = b.availMatches ? Math.round(b.mins / b.availMatches) : null;
  b.avgTotal = b.totalMatches ? Math.round(b.mins / b.totalMatches) : null;
  return b;
}

/**
 * Participación de un jugador. `ctx`:
 *  - events: partidos a tener en cuenta (cerrados y del tipo elegido)
 *  - convBy: Map eventId -> convocatoria
 *  - statsBy: Map eventId -> Map playerId -> MatchStats
 *  - teamsById: Map teamId -> equipo (para la duración habitual de cada equipo)
 * Devuelve { all, f11, f7 }. Cuenta los partidos en que fue convocado (de su equipo o de otro) y los de su equipo
 * en que no lo fue; los partidos de otros equipos en que no participó no cuentan.
 *
 * Partidos totales = todos esos. Partidos disponibles = los totales menos aquellos en que no pudo estar por un motivo
 * ajeno al entrenador (lesión, viaje…). Un partido en que lo deja fuera el entrenador cuenta como disponible con 0 minutos.
 */
export function participationOf(player, ctx) {
  const out = { all: emptyBucket(), f11: emptyBucket(), f7: emptyBucket() };
  const pid = player.id;
  const ownTeam = ctx.teamsById?.get(player.team_id);
  for (const ev of ctx.events) {
    const conv = ctx.convBy.get(ev.id);
    if (!conv) continue;
    const stat = ctx.statsBy.get(ev.id)?.get(pid);
    const called = (conv.player_ids || []).includes(pid) || !!stat;
    const own = ev.team_id === player.team_id;
    if (!called && !own) continue;

    // Duración del partido: la suya o, si no la tiene, la habitual de su equipo
    const evTeam = ctx.teamsById.get(ev.team_id);
    const evDuration = ev.match_duration || defaultDuration(matchFormat(ev, evTeam), evTeam);
    const total = totalMinutes(evDuration);
    const targets = [out.all, out[formatOfEvent(ev, evDuration, evTeam)]];

    if (called) {
      const minutes = stat?.minutes_played || 0;
      const starter = (conv.starters || []).includes(pid);
      const q = quartersPlayed(pid, conv.starters || [], ev.match_events, evDuration, minutes);
      for (const b of targets) {
        b.conv++;
        if (minutes > 0) b.played++;
        if (starter) b.titular++; else { b.suplente++; if (!(minutes > 0)) b.suplenteSin++; }
        b.mins += minutes;
        if (q != null) { b.quarters[q]++; b.qMatches++; if (q >= 3) b.q3plus++; }
        if (q != null ? q === 4 : minutes >= total) b.full++;
        b.totalMatches++; b.totalMin += total;
        b.availMatches++; b.availMin += total;
      }
    } else {
      const reason = conv.absence_reasons?.[pid] || NO_REASON;
      const disponible = !isAjeno(reason);
      for (const b of targets) {
        b.noConv++; b.reasons[reason] = (b.reasons[reason] || 0) + 1;
        if (disponible) b.benched++; else b.unavailable++;
        b.totalMatches++; b.totalMin += total;
        if (disponible) { b.availMatches++; b.availMin += total; }
      }
    }
  }
  const rules = { f7: ruleFor('f7', ownTeam, ctx.rules), f11: ruleFor('f11', ownTeam, ctx.rules) };
  return { all: finish(out.all), f11: finish(out.f11), f7: finish(out.f7), rules };
}

// Alertas de minutos de un jugador: una por cada formato en que está por debajo del mínimo sobre los minutos disponibles
export function minutesAlerts(part) {
  return ['f7', 'f11']
    .filter((f) => part[f].availMatches > 0 && minutesLevel(f, part[f].pctAvail, part.rules?.[f]) === 'alert')
    .map((f) => ({ format: f, pct: part[f].pctAvail, min: (part.rules?.[f] || MIN_PCT[f]).alert }));
}

// Índices por partido para no recorrer listas enteras jugador a jugador
export function buildContext({ events, convocs, stats, teams, rules }) {
  const convBy = new Map((convocs || []).map((c) => [c.event_id, c]));
  const statsBy = new Map();
  for (const s of stats || []) {
    if (!statsBy.has(s.event_id)) statsBy.set(s.event_id, new Map());
    statsBy.get(s.event_id).set(s.player_id, s);
  }
  return { events, convBy, statsBy, teamsById: new Map((teams || []).map((t) => [t.id, t])), rules: rules || rulesOf(null) };
}
