// Calendario (rediseño del 13/11/2026, maqueta «Maqueta Calendario · RS Manager» aprobada por Nacho): cálculos puros.
// Sin importaciones de la app: se prueba en Node (tests/calendarView.test.mjs).

const DAY = 86400000;
export const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
export const TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico", "sesion_teorica", "sesion_video"];
export const KINDS = ["match", "training", "other"];

export const eventKind = (e) => (MATCH_TYPES.includes(e?.type) ? "match" : TRAINING_TYPES.includes(e?.type) ? "training" : "other");
const time = (d) => new Date(d).getTime();
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** Eventos de un día (los de varios días, como un torneo, salen en todos sus días), por hora */
export function eventsOnDay(events = [], day) {
  const from = dayStart(day).getTime(), to = from + DAY - 1;
  return events
    .filter((e) => {
      const s = time(e.date);
      const end = e.end_date && time(e.end_date) >= s ? time(e.end_date) : s;
      return s <= to && end >= from;
    })
    .sort((a, b) => time(a.date) - time(b.date));
}

export const EMPTY_CAL_FILTERS = { kinds: KINDS, stage: "all", place: "all", teams: [] };

/** Filtros: qué se ve (partidos, entrenos, otros), etapa (F11/F7), campo (un campo, «away» = fuera) y equipos (vacío = todos).
 * `isF7(teamId)` dice si el equipo juega a fútbol 7. Un evento sin equipo (del club) solo cae con «todos los equipos». */
export function matchesCalFilters(e, f = EMPTY_CAL_FILTERS, { isF7 = () => false } = {}) {
  if (!f.kinds.includes(eventKind(e))) return false;
  if (f.teams.length && !f.teams.includes(e.team_id)) return false;
  if (f.stage !== "all") {
    if (!e.team_id) return false;
    if ((f.stage === "f7") !== !!isF7(e.team_id)) return false;
  }
  if (f.place === "away") { if (e.is_home !== false) return false; }
  else if (f.place !== "all") { if (e.field_id !== f.place || e.is_home === false) return false; }
  return true;
}

/** Lo que cabe en la casilla de un día del mes: los partidos uno a uno, los entrenos juntos si hay varios
 * ({group:true, n, date} con la hora del primero) y lo demás uno a uno; todo por hora. */
export function dayItems(evs = []) {
  const trainings = evs.filter((e) => eventKind(e) === "training" && e.cancelled !== true);
  const out = evs.filter((e) => eventKind(e) !== "training" || e.cancelled === true).map((e) => ({ event: e, date: e.date }));
  if (trainings.length === 1) out.push({ event: trainings[0], date: trainings[0].date });
  else if (trainings.length > 1) out.push({ group: true, n: trainings.length, date: trainings[0].date, events: trainings });
  return out.sort((a, b) => time(a.date) - time(b.date));
}

/** Lunes a domingo de la semana de `now` */
export function weekRange(now = new Date()) {
  const d = dayStart(now);
  const dow = (d.getDay() + 6) % 7;
  const from = new Date(d.getTime() - dow * DAY);
  return { from, to: new Date(from.getTime() + 7 * DAY - 1) };
}

/** Resumen de la semana: partidos (en casa / fuera), entrenos (suspendidos), listas por pasar (entrenos ya hechos sin
 * asistencia), convocatorias por hacer (partidos que aún no se han jugado sin convocados) y partidos por cerrar
 * (`pending`: Map de partidos jugados a los que les falta algo; de toda la temporada). */
export function weekSummary(events = [], { now = new Date(), withAttendance = new Set(), convByEvent = new Map(), pending = new Map() } = {}) {
  const { from, to } = weekRange(now);
  const t = time(now);
  const k = { matches: 0, home: 0, away: 0, trainings: 0, cancelled: 0, listsDue: 0, convDue: 0, toClose: 0 };
  for (const e of events) {
    if (pending.has(e.id)) k.toClose++;
    const when = time(e.date);
    if (when < from.getTime() || when > to.getTime()) continue;
    const kind = eventKind(e);
    if (kind === "match") {
      if (e.cancelled === true) continue;
      k.matches++;
      if (e.is_home === false) k.away++; else k.home++;
      if (when >= t && !(convByEvent.get(e.id)?.player_ids?.length)) k.convDue++;
    } else if (kind === "training") {
      if (e.cancelled === true) { k.cancelled++; continue; }
      k.trainings++;
      if (when < t && !withAttendance.has(e.id)) k.listsDue++;
    }
  }
  return k;
}

/** Uso de los campos de casa en un día: [{name, n, times:["10:00",…]}] (sin los de fuera ni los suspendidos) */
export function fieldUse(evs = [], fieldName = () => "") {
  const m = new Map();
  for (const e of evs) {
    if (e.is_home === false || e.cancelled === true || !e.field_id) continue;
    const name = fieldName(e.field_id);
    if (!name) continue;
    const s = m.get(name) || { name, n: 0, times: [] };
    s.n++;
    const d = new Date(e.date);
    s.times.push(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    m.set(name, s);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

/** Opciones de campo para el filtro: los campos de casa que usan los eventos y cuántos, y los partidos fuera */
export function placeOptions(events = [], fieldName = () => "") {
  const m = new Map();
  let away = 0;
  for (const e of events) {
    if (e.is_home === false) { away++; continue; }
    if (!e.field_id) continue;
    const name = fieldName(e.field_id);
    if (!name) continue;
    m.set(e.field_id, { id: e.field_id, name, n: (m.get(e.field_id)?.n || 0) + 1 });
  }
  return { fields: [...m.values()].sort((a, b) => b.n - a.n), away };
}
