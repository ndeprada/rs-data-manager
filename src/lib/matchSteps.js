// Ficha del partido rediseñada (13/11/2026): lógica pura de los «pasos del partido», los últimos entrenos de cada
// convocado y la equipación del mensaje. Sin importaciones de la app (se prueba en Node).
import { KIT_SHORT, kitInfo } from "./weekendAgenda.js";
import { isFinished } from "./matchTiming.js";

export const STEP_KEYS = ["convocatoria", "tactica", "acta", "postpartido"];
export const TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico"];

const time = (d) => (d ? new Date(d).getTime() : NaN);

/** ¿Ya se ha jugado? (terminado: su fin o, si no tiene, la hora + 2 h) */
export function matchPlayed(event, now = new Date()) {
  return Number.isFinite(time(event?.date)) && isFinished(event, now);
}

/** Titulares que todavía no tienen minutos en el acta */
export function startersWithoutMinutes(conv, stats = []) {
  const starters = conv?.starters || [];
  return starters.filter((id) => !stats.some((s) => s.player_id === id && (s.minutes_played || 0) > 0));
}

/** Jugadores que han jugado (titulares, los que entran en un cambio y los que tienen minutos) */
export function playedIds(conv, event, stats = []) {
  const ids = new Set(conv?.starters || []);
  for (const e of event?.match_events || []) if (e.type === "sub" && e.playerIn) ids.add(e.playerIn);
  for (const s of stats) if ((s.minutes_played || 0) > 0) ids.add(s.player_id);
  return ids;
}

/**
 * Los cuatro pasos del partido con su estado: done (hecho) · now (lo que toca ahora) · todo (más adelante).
 * Cada paso lleva `sub` = { key, vars } (texto en español con variables, se traduce en la pantalla).
 * `pending` = motivos por los que el partido sigue sin cerrar (pendingReasons), solo cuenta si ya se ha jugado.
 */
export function matchSteps({ event, conv, plan, stats = [], pending = [], minPlayers = 11, now = new Date() }) {
  const played = matchPlayed(event, now);
  const called = conv?.player_ids?.length || 0;

  // 1 · Convocatoria
  const convDone = called >= minPlayers && !!conv?.notified;
  const conv1 = {
    key: "convocatoria",
    done: convDone,
    sub: !called ? { key: "Sin convocatoria" }
      : conv?.notified ? { key: "{n} convocados · avisada", vars: { n: called } }
      : { key: "{n} convocados · aviso sin enviar", vars: { n: called } },
  };

  // 2 · Preparación
  const lineup = (plan?.lineup || []).filter(Boolean).length;
  const pieces = (plan?.set_pieces || []).length;
  const prepDone = lineup >= minPlayers;
  const prepSub = !plan || (!lineup && !pieces && !plan.formation) ? { key: "Sin preparar" }
    : prepDone && pieces ? { key: "{f} listo · {n} jugadas ABP", vars: { f: plan.formation || "", n: pieces } }
    : prepDone ? { key: "{f} listo", vars: { f: plan.formation || "" } }
    : pieces ? { key: "Alineación {a}/{b} · {n} jugadas ABP", vars: { a: lineup, b: minPlayers, n: pieces } }
    : { key: "Alineación {a}/{b}", vars: { a: lineup, b: minPlayers } };
  const prep = { key: "tactica", done: prepDone, sub: prepSub };

  // 3 · Acta
  const noMin = startersWithoutMinutes(conv, stats).length;
  const actaDone = played && pending.length === 0;
  const acta = {
    key: "acta",
    done: actaDone,
    sub: !played ? { key: "Después del partido" }
      : actaDone ? { key: "Partido cerrado" }
      : noMin && (conv?.starters || []).length >= minPlayers ? { key: "Falta: minutos de {n} titulares", vars: { n: noMin } }
      : { key: "Falta: {r}", vars: { r: pending[0] }, reason: pending[0] },
  };

  // 4 · Postpartido: valoraciones de los que han jugado
  const ids = playedIds(conv, event, stats);
  const rated = stats.filter((s) => ids.has(s.player_id) && s.rating != null && s.rating !== "").length;
  const postDone = played && ids.size > 0 && rated >= ids.size;
  const post = {
    key: "postpartido",
    done: postDone,
    sub: !played ? { key: "Después del partido" } : { key: "{a} de {b} valorados", vars: { a: rated, b: ids.size } },
  };

  const steps = [conv1, prep, acta, post];
  // Lo que toca ahora: antes del partido, la convocatoria y luego la preparación; después, el acta y luego el postpartido
  const order = played ? [acta, post, conv1] : [conv1, prep];
  const current = order.find((s) => !s.done);
  return steps.map((s) => ({ ...s, state: s.done ? "done" : s === current ? "now" : "todo" }));
}

/**
 * Los últimos `n` entrenos del equipo antes del partido (o de hoy, si el partido es más tarde), del más antiguo al más reciente.
 * No cuenta los suspendidos.
 */
export function recentTrainings(events = [], teamId, { before, now = new Date(), n = 3 } = {}) {
  const limit = Math.min(time(before) || Infinity, now.getTime());
  return events
    .filter((e) => e.team_id === teamId && TRAINING_TYPES.includes(e.type) && e.cancelled !== true && time(e.date) <= limit)
    .sort((a, b) => time(b.date) - time(a.date))
    .slice(0, n)
    .reverse();
}

/** Estado de cada jugador en esos entrenos: { [playerId]: ["present"|"apart"|"absent"|null, …] } */
export function trainingDots(trainings = [], attendance = [], playerIds = []) {
  const by = new Map();
  for (const a of attendance) if (a.status) by.set(`${a.event_id}|${a.player_id}`, a);
  const out = {};
  for (const pid of playerIds) {
    out[pid] = trainings.map((ev) => {
      const a = by.get(`${ev.id}|${pid}`);
      return a ? { status: a.status, reason: a.absence_reason || null } : null;
    });
  }
  return out;
}

/** Equipación para el mensaje: «2.ª equipación · verde · talla 14 · Chándal del club» (vacío si no hay nada) */
export function messageKit(meta, freeText = "") {
  const k = kitInfo(meta);
  const parts = [];
  if (k) {
    const ord = KIT_SHORT[k.kit].replace("ª", ".ª");
    parts.push([`${ord} equipación`, k.color.toLowerCase(), k.size && (/^\d+$/.test(k.size) ? `talla ${k.size}` : k.size)].filter(Boolean).join(" · "));
  }
  const f = String(freeText || "").trim();
  if (f) parts.push(f);
  return parts.join(" · ");
}

/** Clave de la equipación elegida en el partido ("primera" si no hay nada) */
export function kitKeyOf(meta) {
  return ["segunda", "tercera"].includes(meta?.kit) ? meta.kit : "primera";
}
