// Participación de un jugador en los partidos: titular, suplente, no convocado (y por qué), minutos y cuartos.
// Funciones puras (se prueban con tests). Los partidos que se pasan ya vienen filtrados (cerrados y del tipo elegido).
import { defaultDuration, totalMinutes } from './matchDuration.js';

// Motivos por los que un jugador no está convocado (los mismos que se eligen en la pestaña Convocatoria)
export const NO_CONV_REASONS = [
  { value: 'lesion', label: 'Lesión', short: 'Lesión' },
  { value: 'enfermo', label: 'Enfermo (cuenta como lesión)', short: 'Enfermo' },
  { value: 'sancion', label: 'Sanción', short: 'Sanción' },
  { value: 'descanso', label: 'Descanso', short: 'Descanso' },
  { value: 'decision_tecnica', label: 'Dec. técnica', short: 'Dec. técnica' },
  { value: 'viaje', label: 'Viaje', short: 'Viaje' },
  { value: 'estudios', label: 'Estudios', short: 'Estudios' },
  { value: 'otro', label: 'Otro', short: 'Otro' },
];
export const NO_REASON = 'sin_motivo';
export const reasonShort = (r) => (r === NO_REASON ? 'Sin motivo' : NO_CONV_REASONS.find((x) => x.value === r)?.short || r);
// Orden en el que se enseñan los motivos (los de sin motivo, al final)
export const REASON_ORDER = [...NO_CONV_REASONS.map((r) => r.value), NO_REASON];

// Cuántas partes tiene el partido: "2x45" -> 2, "4x15" -> 4
const partsOf = (duration) => { const m = String(duration || '').match(/^(\d+)x(\d+)$/); return m ? Number(m[1]) : null; };
const partLength = (duration) => { const m = String(duration || '').match(/^(\d+)x(\d+)$/); return m ? Number(m[2]) : null; };

// Formato del partido: el guardado o, si no lo hay, el que se deduce de la duración (4 cuartos = fútbol 7)
export function formatOfEvent(ev, duration) {
  if (ev?.football_format === 'f7' || ev?.football_format === 'f11') return ev.football_format;
  return partsOf(duration) === 4 ? 'f7' : 'f11';
}

// Minutos que dura cada cuarto si el partido se juega a cuartos (4 partes); si no, null
export function quarterLength(duration) {
  return partsOf(duration) === 4 ? partLength(duration) : null;
}

// Cuartos que ha jugado con esos minutos: minutos ÷ duración del cuarto, redondeado; si ha pisado el campo, al menos 1
export function quartersPlayed(minutes, qLen) {
  if (!qLen || !(minutes > 0)) return 0;
  return Math.min(4, Math.max(1, Math.round(minutes / qLen)));
}

const emptyBucket = () => ({
  conv: 0, played: 0, titular: 0, suplente: 0, suplenteSin: 0, noConv: 0, reasons: {},
  mins: 0, availMin: 0, pctMin: null,
  qMatches: 0, qHist: [0, 0, 0, 0, 0], qTotal: 0, qAvg: null,
});

function finish(b) {
  b.pctMin = b.availMin ? Math.min(100, Math.round((b.mins / b.availMin) * 100)) : null;
  const played = b.qMatches - b.qHist[0];
  b.qAvg = played > 0 ? b.qTotal / played : null;
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
    const fmt = formatOfEvent(ev, evDuration);
    const qLen = quarterLength(evDuration);
    const targets = [out.all, out[fmt]];

    if (called) {
      const minutes = stat?.minutes_played || 0;
      const starter = (conv.starters || []).includes(pid);
      for (const b of targets) {
        b.conv++;
        if (minutes > 0) b.played++;
        if (starter) b.titular++; else { b.suplente++; if (!(minutes > 0)) b.suplenteSin++; }
        b.mins += minutes;
        b.availMin += total;
        if (qLen) {
          const q = starter || minutes > 0 ? quartersPlayed(minutes, qLen) : 0;
          b.qMatches++; b.qHist[q]++; b.qTotal += q;
        }
      }
    } else {
      const reason = conv.absence_reasons?.[pid] || NO_REASON;
      for (const b of targets) { b.noConv++; b.reasons[reason] = (b.reasons[reason] || 0) + 1; }
    }
  }
  return { all: finish(out.all), f11: finish(out.f11), f7: finish(out.f7) };
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
