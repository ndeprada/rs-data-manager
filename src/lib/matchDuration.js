// Duración del partido y minutos jugados según el acta. Funciones puras (se prueban con tests).
import { isPrimerEquipo } from './primerEquipo.js';
import { matchFormat } from './matchFormat.js';
import { msg } from "../i18n/translate.js";

// Duraciones que se pueden elegir en el acta (da igual el formato: cada categoría juega la suya)
export const DURATIONS = [
  { value: '2x45', label: msg("2 partes de 45'") },
  { value: '2x40', label: msg("2 partes de 40'") },
  { value: '2x35', label: msg("2 partes de 35'") },
  { value: '4x15', label: msg("4 cuartos de 15'") },
  { value: '4x12', label: msg("4 cuartos de 12'") },
  { value: '4x10', label: msg("4 cuartos de 10'") },
];

export const isDuration = (d) => /^\d+x\d+$/.test(String(d || ''));

// "2x45" -> "2 partes de 45'" ; valores antiguos o raros se muestran tal cual
export function durationLabel(d) {
  const known = DURATIONS.find((x) => x.value === d);
  if (known) return known.label;
  const m = String(d || '').match(/^(\d+)x(\d+)$/);
  return m ? `${m[1]} partes de ${m[2]}'` : d ? `${d}'` : '';
}

const plain = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Duración habitual de cada categoría del club (la que indicó el director deportivo).
// Se usa mientras el equipo no tenga guardada una propia.
export function categoryDuration(team) {
  if (!team) return null;
  if (isPrimerEquipo(team)) return '2x45';
  const k = `${plain(team.category)} ${plain(team.name)}`;
  if (/juvenil/.test(k)) return '2x45';
  if (/cadet/.test(k)) return '2x40';
  if (/infantil/.test(k)) return '2x35';
  if (/alevi/.test(k)) return '4x15';
  if (/benjamin?[_ ]s10/.test(k)) return '4x15';
  if (/benjamin?[_ ]s9/.test(k)) return '4x12';
  if (/prebenjami/.test(k)) return '4x10';
  return null;
}

// La que el entrenador ha guardado para su equipo o, si no, la habitual de su categoría
export const teamDefaultDuration = (team) => (isDuration(team?.default_match_duration) ? team.default_match_duration : categoryDuration(team));

// Si el partido no tiene la duración guardada: la del equipo y, si no se sabe, la habitual de su formato
export const defaultDuration = (format, team) => teamDefaultDuration(team) || (format === 'f7' ? '4x15' : '2x45');

// "2x45" -> 90, "4x15" -> 60 ; un número suelto (valores antiguos como "80") son los minutos totales
export function totalMinutes(duration) {
  const d = String(duration || '');
  const m = d.match(/^(\d+)x(\d+)$/);
  if (m) return Number(m[1]) * Number(m[2]);
  return /^\d+$/.test(d) && Number(d) > 0 ? Number(d) : 90;
}

export const eventMinutes = (ev, team) => totalMinutes(ev?.match_duration || defaultDuration(matchFormat(ev, team), team));

// Minutos de un jugador del equipo según los eventos del acta:
// titular = desde el 0 hasta que sale (cambio, roja o 2ª amarilla) o hasta el final; suplente = desde que entra hasta que sale o el final.
export function playedIntervals(playerId, starterIds, events, matchMinutes) {
  const marks = (events || [])
    .filter((e) => e.team !== "away" && e.minute !== "" && e.minute != null && (
      (e.type === "sub" && (e.playerIn === playerId || e.playerOut === playerId)) ||
      (e.type === "card" && e.playerId === playerId && (e.cardColor === "red" || e.cardColor === "yellow2"))))
    .map((e) => ({ m: Math.min(Number(e.minute) || 0, matchMinutes), isIn: e.type === "sub" && e.playerIn === playerId }))
    .sort((a, b) => a.m - b.m);
  let cur = (starterIds || []).includes(playerId) ? 0 : null;
  const out = [];
  for (const k of marks) {
    if (k.isIn) { if (cur === null) cur = k.m; }
    else if (cur !== null) { if (k.m > cur) out.push([cur, k.m]); cur = null; }
  }
  if (cur !== null && matchMinutes > cur) out.push([cur, matchMinutes]);
  return out;
}

export function calcMinutesPlayed(playerId, starterIds, events, matchMinutes) {
  return playedIntervals(playerId, starterIds, events, matchMinutes).reduce((s, [a, b]) => s + (b - a), 0);
}

// Cuartos jugados en un partido de 4 cuartos ("4x15", "4x12"…). Cuenta un cuarto si estuvo en el campo al menos la mitad de él
// (13/11/2026, criterio mío por confirmar con Nacho). Si los minutos guardados no cuadran con los cambios del acta
// (minutos corregidos a mano), se calcula con los minutos: minutos ÷ duración del cuarto, redondeado.
// Devuelve null si el partido no es de cuartos.
export function quartersPlayed(playerId, starterIds, events, duration, minutes) {
  const m = String(duration || "").match(/^4x(\d+)$/);
  if (!m) return null;
  const q = Number(m[1]);
  const mins = Number(minutes) || 0;
  const iv = playedIntervals(playerId, starterIds, events, 4 * q);
  const sum = iv.reduce((s, [a, b]) => s + (b - a), 0);
  if (Math.abs(sum - mins) > 1) return Math.max(0, Math.min(4, Math.round(mins / q)));
  let n = 0;
  for (let k = 0; k < 4; k++) {
    const from = k * q, to = from + q;
    const on = iv.reduce((s, [a, b]) => s + Math.max(0, Math.min(b, to) - Math.max(a, from)), 0);
    if (on >= q / 2) n++;
  }
  return n;
}

// Regla del acta para cualquier equipo:
//  - titular sin cambios = juega el partido completo; con cambios, hasta que sale
//  - suplente que no participa en ningún cambio = 0 minutos
// Si todavía no hay titulares marcados no se puede saber quién jugó: se respeta lo que ya hubiera apuntado (`fallback`).
export function actaMinutes(playerId, starterIds, events, matchMinutes, fallback = 0) {
  const isStarter = starterIds.includes(playerId);
  const hasSubs = (events || []).some((e) => e.team !== "away" && e.type === "sub" && (e.playerIn === playerId || e.playerOut === playerId));
  if (isStarter || hasSubs) return calcMinutesPlayed(playerId, starterIds, events, matchMinutes);
  return starterIds.length > 0 ? 0 : fallback;
}
