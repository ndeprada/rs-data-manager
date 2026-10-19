// Participación de un jugador en los partidos: titular, suplente, no convocado (y por qué), minutos y porcentajes.
// Funciones puras (se prueban con tests). Los partidos que se pasan ya vienen filtrados (cerrados y del tipo elegido).
import { defaultDuration, totalMinutes } from './matchDuration.js';

// Motivos por los que un jugador no está convocado (los mismos que se eligen en la pestaña Convocatoria).
// `ajeno` = motivo ajeno al entrenador: ese partido el jugador NO estaba disponible y no cuenta para el % de minutos.
// Si lo deja fuera el entrenador (decisión técnica, descanso) o no hay motivo, el partido sí cuenta como disponible (0 minutos).
export const NO_CONV_REASONS = [
  { value: 'lesion', label: 'Lesión', short: 'Lesión', ajeno: true },
  { value: 'enfermo', label: 'Enfermo (cuenta como lesión)', short: 'Enfermo', ajeno: true },
  { value: 'sancion', label: 'Sanción', short: 'Sanción', ajeno: true },
  { value: 'descanso', label: 'Descanso', short: 'Descanso', ajeno: false },
  { value: 'decision_tecnica', label: 'Dec. técnica', short: 'Dec. técnica', ajeno: false },
  { value: 'viaje', label: 'Viaje', short: 'Viaje', ajeno: true },
  { value: 'estudios', label: 'Estudios', short: 'Estudios', ajeno: true },
  { value: 'otro', label: 'Otro', short: 'Otro', ajeno: true },
];
export const NO_REASON = 'sin_motivo';
export const reasonShort = (r) => (r === NO_REASON ? 'Sin motivo' : NO_CONV_REASONS.find((x) => x.value === r)?.short || r);
// Orden en el que se enseñan los motivos (los de sin motivo, al final)
export const REASON_ORDER = [...NO_CONV_REASONS.map((r) => r.value), NO_REASON];
// ¿El jugador no estaba a disposición del entrenador por ese motivo?
export const isAjeno = (reason) => !!NO_CONV_REASONS.find((x) => x.value === reason)?.ajeno;

// Minutos mínimos sobre los disponibles: por debajo salta la alerta. En fútbol 11 el objetivo del club es el 40 %.
export const MIN_PCT = {
  f7: { alert: 50, target: null },
  f11: { alert: 35, target: 40 },
};
// 'alert' (por debajo del mínimo), 'warn' (por debajo del objetivo) u 'ok'; null si no hay datos
export function minutesLevel(format, pct) {
  const t = MIN_PCT[format];
  if (!t || pct == null) return null;
  if (pct < t.alert) return 'alert';
  if (t.target && pct < t.target) return 'warn';
  return 'ok';
}
const SEVERITY = { ok: 0, warn: 1, alert: 2 };
export const worstLevel = (levels) => levels.filter(Boolean).sort((a, b) => SEVERITY[b] - SEVERITY[a])[0] || null;
export const FORMAT_LABEL = { f11: 'Fútbol 11', f7: 'Fútbol 7' };

// Nivel de minutos de un jugador en la vista elegida ('all' = el peor de sus formatos con partidos disponibles).
// Un formato en el que no tuvo ningún partido disponible no cuenta.
export function playerLevel(part, format = 'all') {
  const formats = format === 'all' ? ['f7', 'f11'] : [format];
  return worstLevel(formats.filter((f) => part[f].availMatches > 0).map((f) => minutesLevel(f, part[f].pctAvail)));
}

// Partes del partido: "2x45" -> 2, "4x15" -> 4
const partsOf = (duration) => { const m = String(duration || '').match(/^(\d+)x(\d+)$/); return m ? Number(m[1]) : null; };

// Formato del partido: el guardado o, si no lo hay, el que se deduce de la duración (4 cuartos = fútbol 7)
export function formatOfEvent(ev, duration) {
  if (ev?.football_format === 'f7' || ev?.football_format === 'f11') return ev.football_format;
  return partsOf(duration) === 4 ? 'f7' : 'f11';
}

const emptyBucket = () => ({
  conv: 0, played: 0, titular: 0, suplente: 0, suplenteSin: 0, noConv: 0, reasons: {},
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
  for (const ev of ctx.events) {
    const conv = ctx.convBy.get(ev.id);
    if (!conv) continue;
    const stat = ctx.statsBy.get(ev.id)?.get(pid);
    const called = (conv.player_ids || []).includes(pid) || !!stat;
    const own = ev.team_id === player.team_id;
    if (!called && !own) continue;

    // Duración del partido: la suya o, si no la tiene, la habitual de su equipo
    const evDuration = ev.match_duration || defaultDuration(ev.football_format, ctx.teamsById.get(ev.team_id));
    const total = totalMinutes(evDuration);
    const targets = [out.all, out[formatOfEvent(ev, evDuration)]];

    if (called) {
      const minutes = stat?.minutes_played || 0;
      const starter = (conv.starters || []).includes(pid);
      for (const b of targets) {
        b.conv++;
        if (minutes > 0) b.played++;
        if (starter) b.titular++; else { b.suplente++; if (!(minutes > 0)) b.suplenteSin++; }
        b.mins += minutes;
        b.totalMatches++; b.totalMin += total;
        b.availMatches++; b.availMin += total;
      }
    } else {
      const reason = conv.absence_reasons?.[pid] || NO_REASON;
      const disponible = !isAjeno(reason);
      for (const b of targets) {
        b.noConv++; b.reasons[reason] = (b.reasons[reason] || 0) + 1;
        b.totalMatches++; b.totalMin += total;
        if (disponible) { b.availMatches++; b.availMin += total; }
      }
    }
  }
  return { all: finish(out.all), f11: finish(out.f11), f7: finish(out.f7) };
}

// Alertas de minutos de un jugador: una por cada formato en que está por debajo del mínimo sobre los minutos disponibles
export function minutesAlerts(part) {
  return ['f7', 'f11']
    .filter((f) => part[f].availMatches > 0 && minutesLevel(f, part[f].pctAvail) === 'alert')
    .map((f) => ({ format: f, pct: part[f].pctAvail, min: MIN_PCT[f].alert }));
}

// Índices por partido para no recorrer listas enteras jugador a jugador
export function buildContext({ events, convocs, stats, teams }) {
  const convBy = new Map((convocs || []).map((c) => [c.event_id, c]));
  const statsBy = new Map();
  for (const s of stats || []) {
    if (!statsBy.has(s.event_id)) statsBy.set(s.event_id, new Map());
    statsBy.get(s.event_id).set(s.player_id, s);
  }
  return { events, convBy, statsBy, teamsById: new Map((teams || []).map((t) => [t.id, t])) };
}
