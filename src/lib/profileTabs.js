// Pestañas de la ficha del jugador (14/11/2026, maqueta «Maqueta Ficha del jugador · pestañas» aprobada por Nacho: «ok»).
// Cálculos puros, sin importaciones de la app: se prueban en Node (tests/profileTabs.test.mjs).

const DAY = 86400000;
const time = (d) => { const x = new Date(d || 0).getTime(); return Number.isNaN(x) ? 0 : x; };
const dayKey = (d) => String(d || "").slice(0, 10);
const TRAININGS = ["entrenamiento", "entrenamiento_fisico", "sesion_teorica", "sesion_video"];
// Motivos de no convocatoria que dependen del entrenador (el jugador estaba disponible)
const COACH_REASONS = ["decision_tecnica", "descanso", "sin_motivo"];

// ── Partidos ─────────────────────────────────────────────────────────────

/** Partidos apuntados a mano en la ficha (sin partido del calendario): filas como las de matchRows */
export function manualRows(stats = [], playerId, knownEventIds = new Set()) {
  return stats
    .filter((s) => s.player_id === playerId && (!s.event_id || !knownEventIds.has(s.event_id)) && s.date)
    .map((s) => ({
      ev: { id: null, date: s.date, opponent: s.opponent || "", type: "manual" }, manual: true, guest: false, called: true,
      starter: s.starter !== false, minutes: s.minutes_played || 0, goals: s.goals || 0, assists: s.assists || 0,
      yellow: s.yellow_cards || 0, red: s.red_cards || 0, rating: s.rating || null, result: null, reason: null,
      notes: (s.notes || "").trim() || null, stat: s, mvp: false,
    }))
    .sort((a, b) => time(b.ev.date) - time(a.ev.date));
}

/**
 * Cómo ha participado: titular, suplente (y cuántas veces sin jugar), fuera por decisión del entrenador
 * (decisión técnica, descanso o sin motivo) y no disponible (lesión, enfermo, sanción, viaje, estudios u otro).
 */
export function participationSplit(rows = []) {
  const out = { starter: 0, sub: 0, subUnused: 0, benched: 0, unavailable: 0, reasons: {}, total: rows.length };
  for (const r of rows) {
    if (r.called) {
      if (r.starter) out.starter++;
      else { out.sub++; if (!(r.minutes > 0)) out.subUnused++; }
    } else {
      const k = r.reason || "sin_motivo";
      out.reasons[k] = (out.reasons[k] || 0) + 1;
      if (COACH_REASONS.includes(k)) out.benched++; else out.unavailable++;
    }
  }
  return out;
}

/** Valoración del entrenador (1–3): media, media de las 3 últimas, tendencia, últimas 5 (de la más antigua a la más reciente) y jugador del partido */
export function ratingInfo(rows = []) {
  const rated = rows.filter((r) => r.rating).sort((a, b) => time(a.ev.date) - time(b.ev.date));
  const avg = (l) => (l.length ? Math.round((l.reduce((a, r) => a + r.rating, 0) / l.length) * 10) / 10 : null);
  const all = avg(rated);
  const recent = rated.length >= 4 ? avg(rated.slice(-3)) : null;
  const rest = rated.length >= 4 ? avg(rated.slice(0, -3)) : null;
  const diff = recent != null && rest != null ? Math.round((recent - rest) * 10) / 10 : null;
  return {
    avg: all, n: rated.length, recent, trend: diff == null ? null : diff >= 0.2 ? "up" : diff <= -0.2 ? "down" : "flat",
    last: rated.slice(-5).map((r) => r.rating), mvp: rows.filter((r) => r.mvp).length,
  };
}

// ── Entrenos ─────────────────────────────────────────────────────────────

/**
 * La temporada entreno a entreno: los entrenos de su equipo (y los de otros equipos en que tiene registro) desde `since`,
 * agrupados por mes. Código de cada uno: s asiste · a a parte · n no asiste · x sin marcar (con lista) · c cancelado ·
 * p ya pasó y sin lista · f por venir (solo lo que queda del mes en curso).
 */
export function trainingSeason(events = [], attendance = [], { teamId, playerId, now = new Date(), since } = {}) {
  const from = since ? since.getTime() : -Infinity;
  const t = now.getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const mine = attendance.filter((a) => a.player_id === playerId);
  const recByEv = new Map(mine.filter((a) => a.event_id).map((a) => [a.event_id, a]));
  const recByDay = new Map(mine.filter((a) => !a.event_id && a.date).map((a) => [dayKey(a.date), a]));
  const listed = new Set(attendance.filter((a) => a.event_id && a.status).map((a) => a.event_id));
  const items = [];
  for (const ev of events) {
    if (!TRAININGS.includes(ev.type) || !ev.date) continue;
    const when = time(ev.date);
    if (when < from || when >= monthEnd) continue;
    const rec = recByEv.get(ev.id) || (ev.team_id === teamId ? recByDay.get(dayKey(ev.date)) : null) || null;
    if (ev.team_id !== teamId && !rec) continue;
    let code;
    if (ev.cancelled === true) code = "c";
    else if (when > t) code = "f";
    else if (rec?.status === "present") code = "s";
    else if (rec?.status === "apart") code = "a";
    else if (rec?.status === "absent") code = "n";
    else code = listed.has(ev.id) ? "x" : "p";
    items.push({ id: ev.id, date: ev.date, code, reason: rec?.absence_reason || null, note: (rec?.notes || "").trim() || null, guest: ev.team_id !== teamId });
  }
  items.sort((a, b) => time(a.date) - time(b.date));
  const months = [];
  for (const it of items) {
    const d = new Date(it.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let m = months[months.length - 1];
    if (!m || m.key !== key) { m = { key, year: d.getFullYear(), month: d.getMonth(), items: [] }; months.push(m); }
    m.items.push(it);
  }
  const count = (c) => items.filter((i) => i.code === c).length;
  const counts = { present: count("s"), apart: count("a"), absent: count("n"), cancelled: count("c") };
  const marked = counts.present + counts.apart + counts.absent;
  const missed = items.filter((i) => i.code === "n" || i.code === "a").slice().reverse();
  return { months, items, counts, pct: marked ? Math.round(((counts.present + counts.apart) / marked) * 100) : null, missed };
}

/** Entrenos seguidos sin faltar hasta el último marcado (a parte cuenta como venir; los cancelados no cortan) */
export function attendanceStreak(items = []) {
  let n = 0, until = null;
  for (let i = items.length - 1; i >= 0; i--) {
    const c = items[i].code;
    if (c === "c" || c === "f" || c === "p" || c === "x") continue;
    if (c === "n") break;
    if (!until) until = items[i].date;
    n++;
  }
  return { n, until };
}

/** Motivos de las ausencias, de más a menos: [[motivo, n]] (sin motivo = «otro») */
export function absenceReasons(items = []) {
  const acc = {};
  for (const i of items) if (i.code === "n") { const k = i.reason || "otro"; acc[k] = (acc[k] || 0) + 1; }
  return Object.entries(acc).sort((a, b) => b[1] - a[1]);
}

// ── Médico ───────────────────────────────────────────────────────────────

const INJURY_REASONS = ["lesion", "enfermo"];

/** Lo que se ha perdido por una lesión: partidos (no convocado por lesión o enfermedad) y entrenos (no asiste) entre su fecha y el alta (u hoy) */
export function injuryImpact(inj, { events = [], convs = [], attendance = [], playerId, teamId, now = new Date() } = {}) {
  if (!inj?.injury_date) return { matches: 0, trainings: 0, days: null };
  const from = time(dayKey(inj.injury_date));
  const end = inj.status === "alta" && inj.actual_return ? time(dayKey(inj.actual_return)) + DAY - 1 : now.getTime();
  const inRange = (d) => { const x = time(d); return x >= from && x <= end; };
  const evById = new Map(events.map((e) => [e.id, e]));
  let matches = 0;
  for (const c of convs) {
    const ev = evById.get(c.event_id);
    if (!ev || ev.team_id !== teamId || ev.cancelled === true || !inRange(ev.date)) continue;
    if ((c.player_ids || []).includes(playerId)) continue;
    if (INJURY_REASONS.includes(c.absence_reasons?.[playerId])) matches++;
  }
  let trainings = 0;
  for (const a of attendance) {
    if (a.player_id !== playerId || a.status !== "absent") continue;
    const d = evById.get(a.event_id)?.date || a.date;
    if (d && inRange(d)) trainings++;
  }
  return { matches, trainings, days: Math.max(0, Math.round((Math.min(end, now.getTime()) - from) / DAY)) };
}

/** Días hasta la vuelta prevista (negativo = ya pasó) */
export const daysUntil = (date, now = new Date()) => (date ? Math.round((time(dayKey(date)) - time(localDay(now))) / DAY) : null);
function localDay(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

/** Fases de la recuperación con su estado: done · now · todo (sin fases, null) */
export function phaseSteps(phases = []) {
  if (!phases.length) return null;
  return phases.map((p) => ({ ...p, state: p.status === "completada" ? "done" : p.status === "en_curso" ? "now" : "todo" }));
}

/** Resumen de las lesiones desde `since`: cuántas, días de baja, partidos perdidos y la zona que se repite */
export function injurySummary(injuries = [], { since, impactOf = () => ({ matches: 0, days: 0 }) } = {}) {
  const from = since ? since.getTime() : -Infinity;
  const list = injuries.filter((i) => (i.injury_date ? time(i.injury_date) >= from : i.status !== "alta"));
  let days = 0, matches = 0;
  const zones = {};
  for (const i of list) {
    const im = impactOf(i);
    days += im.days || 0; matches += im.matches || 0;
    if (i.body_part) zones[i.body_part] = (zones[i.body_part] || 0) + 1;
  }
  const allZones = {};
  for (const i of injuries) if (i.body_part) allZones[i.body_part] = (allZones[i.body_part] || 0) + 1;
  const rep = Object.entries(allZones).sort((a, b) => b[1] - a[1])[0];
  return { n: list.length, days, matches, repeated: rep && rep[1] > 1 ? { zone: rep[0], n: rep[1] } : null };
}

// ── Documentos ───────────────────────────────────────────────────────────

/** Tipos de documento que el club puede pedir (los de la ficha) */
export const DOC_TYPES = ["autorizacion_legal", "seguro", "consentimiento_padres", "copia_identificacion", "examen_medico"];
/** El consentimiento de padres solo se pide a los menores */
export const MINOR_ONLY = ["consentimiento_padres"];
const SOON = 30;

/** Estado de un documento: ok (vigente) · soon (caduca en 30 días o menos) · expired (caducado) */
export function docState(doc, now = new Date()) {
  if (!doc?.expiry_date) return { state: "ok", days: null };
  const days = Math.round((time(dayKey(doc.expiry_date)) - time(localDay(now))) / DAY);
  return { state: days < 0 ? "expired" : days <= SOON ? "soon" : "ok", days };
}

/**
 * Documentos del jugador por tipo: primero los que pide el club (con «missing» si falta), luego los demás.
 * De cada tipo vale el más reciente (por fecha de subida o de caducidad).
 */
export function docRows(docs = [], required = [], { now = new Date(), minor = false } = {}) {
  const need = required.filter((k) => DOC_TYPES.includes(k) && (minor || !MINOR_ONLY.includes(k)));
  const latest = (list) => list.slice().sort((a, b) => String(b.upload_date || b.expiry_date || "").localeCompare(String(a.upload_date || a.expiry_date || "")))[0];
  const rows = need.map((type) => {
    const of = docs.filter((d) => d.document_type === type);
    const doc = latest(of) || null;
    return { type, required: true, doc, others: of.filter((d) => d !== doc), ...(doc ? docState(doc, now) : { state: "missing", days: null }) };
  });
  const rest = docs.filter((d) => !need.includes(d.document_type))
    .sort((a, b) => String(b.upload_date || "").localeCompare(String(a.upload_date || "")))
    .map((doc) => ({ type: doc.document_type || "otro", required: false, doc, others: [], ...docState(doc, now) }));
  const all = [...rows, ...rest];
  const counts = { missing: all.filter((r) => r.state === "missing").length, soon: all.filter((r) => r.state === "soon").length, expired: all.filter((r) => r.state === "expired").length };
  counts.ok = all.length - counts.missing - counts.soon - counts.expired;
  return { rows, rest, counts };
}

/** Lista limpia de documentos que pide el club (para la configuración) */
export const cleanRequiredDocs = (list) => (Array.isArray(list) ? [...new Set(list.filter((k) => DOC_TYPES.includes(k)))] : []);

// ── Historial ────────────────────────────────────────────────────────────

const short = (s) => String(s || "").replace(/^(\d{4})-(\d{2})?(\d{2})$/, "$1-$3");
const seasonKey = (s) => { const m = String(s || "").match(/(\d{4})\D*(\d{2,4})/); return m ? `${m[1]}-${m[2].slice(-2)}` : String(s || ""); };

/**
 * Trayectoria por temporadas: las del club (temporadas cerradas en la app, más la que está en curso) y las de las actas
 * de la FCF. Si una temporada está en las dos, manda la del club y se le añade la competición de la FCF.
 * club: PlayerSeasonHistory · fcf: seasons de la FCF ({season, team, competition, grp, pj, tit, goals, yellow, red, dorsals}) ·
 * current: { season, team, competition, pj, tit, minutes, pctMin, goals, yellow, red, attPct, rating }
 */
export function careerRows({ club = [], fcf = [], current = null, isClubTeam = () => false } = {}) {
  const out = new Map();
  const add = (k, row) => { if (!out.has(k)) out.set(k, []); out.get(k).push(row); };
  if (current) add(seasonKey(current.season), { ...current, source: "club", live: true });
  for (const h of club) {
    const k = seasonKey(h.season);
    if (current && k === seasonKey(current.season)) continue;
    add(k, {
      season: h.season, team: h.team_name || "", category: h.category || "", competition: "", pj: h.matches_played ?? null, tit: h.matches_starter ?? null,
      minutes: h.minutes_played ?? null, goals: h.goals ?? null, yellow: h.yellow_cards ?? null, red: h.red_cards ?? null,
      attPct: h.training_sessions ? Math.round(((h.training_present || 0) / h.training_sessions) * 100) : null,
      rating: h.avg_rating === "" || h.avg_rating == null ? null : Number(h.avg_rating), notes: h.notes || "", source: "club", id: h.id,
    });
  }
  for (const f of fcf) {
    const k = seasonKey(f.season);
    const list = out.get(k);
    const clubRow = list?.find((r) => r.source === "club");
    if (clubRow && isClubTeam(f.team)) {
      if (!clubRow.competition) clubRow.competition = f.competition || "";
      if (!clubRow.grp) clubRow.grp = f.grp || "";
      // Temporada del club sin cifras (apuntada a mano o cerrada sin estadísticas): se completan con las actas
      for (const [k2, v] of [["pj", f.pj], ["tit", f.tit], ["goals", f.goals], ["red", f.red]]) if (clubRow[k2] == null && v != null) clubRow[k2] = v;
      if (clubRow.yellow == null && (f.yellow != null || f.second_yellow != null)) clubRow.yellow = (f.yellow || 0) + (f.second_yellow || 0);
      clubRow.dorsals = [...(clubRow.dorsals || []), ...(f.dorsals || [])];
      continue;
    }
    add(k, { season: k, team: f.team || "", competition: f.competition || "", grp: f.grp || "", pj: f.pj ?? null, tit: f.tit ?? null, minutes: null,
      goals: f.goals ?? null, yellow: (f.yellow || 0) + (f.second_yellow || 0), red: f.red ?? null, attPct: null, rating: null, dorsals: f.dorsals || [], source: "fcf", club: isClubTeam(f.team) });
  }
  return [...out.entries()].sort((a, b) => b[0].localeCompare(a[0])).flatMap(([, list]) => list.sort((a, b) => (a.source === "club" ? -1 : 1) - (b.source === "club" ? -1 : 1) || (b.pj || 0) - (a.pj || 0)));
}

/** Datos del jugador en el club: primera temporada, temporadas, procedencia (el equipo de antes de llegar) y dorsal habitual */
export function clubFacts(rows = []) {
  const inClub = rows.filter((r) => r.source === "club" || r.club);
  const seasons = [...new Set(inClub.map((r) => seasonKey(r.season)))].sort();
  const first = seasons[0] || null;
  const before = first ? rows.filter((r) => r.source === "fcf" && !r.club && seasonKey(r.season) < first).sort((a, b) => seasonKey(b.season).localeCompare(seasonKey(a.season)) || (b.pj || 0) - (a.pj || 0))[0] || null : null;
  const dors = {};
  for (const r of inClub.some((r) => r.dorsals?.length) ? inClub : rows) for (const d of r.dorsals || []) dors[d.d] = (dors[d.d] || 0) + (d.n || 0);
  const dorsals = Object.entries(dors).sort((a, b) => b[1] - a[1]).map(([dorsal, n]) => ({ dorsal, n }));
  return { first, seasons: seasons.length, origin: before, dorsals };
}

export { seasonKey, short as seasonShortKey };
