// Pestaña «Preparación de partido» (13/11/2026, maqueta «Maqueta Preparación · RS Manager» aprobada por Nacho).
// Funciones puras (solo importan playerName.js): avisos de la alineación, «Como el último partido», resumen del plan y del rival.

import { playerFirstName } from "./playerName.js";

/** Nombre y primer apellido (respeta partículas: «De la Torre») */
const PARTICLES = ["de", "del", "la", "las", "los", "da", "di", "van", "von", "el", "i"];
export function firstSurname(last = "") {
  const t = String(last || "").trim().split(/\s+/).filter(Boolean);
  if (t.length <= 1) return t[0] || "";
  let i = 0;
  while (i < t.length - 1 && PARTICLES.includes(t[i].toLowerCase())) i++;
  return t.slice(0, i + 1).join(" ");
}
export const shirtName = (p) => [playerFirstName(p), firstSurname(p?.last_name)].filter(Boolean).join(" ");

/**
 * Avisos de la alineación, en orden: lesionados en el once, jugadores del once que no están convocados y jugadores del
 * banquillo con pocos minutos (nivel 'alert' de minutos del club).
 * - slots: jugadores del once por hueco (o null)
 * - injuryOf: Map player_id → lesión sin alta (o un objeto con .expected_return)
 * - convocadoIds: ids convocados (si está vacío no se avisa de «no convocado»)
 * - bench: jugadores del banquillo; minutesOf(id) → { pct, level }
 */
export function lineupAlerts({ slots = [], injuryOf = new Map(), convocadoIds = [], bench = [], minutesOf = () => null }) {
  const out = [];
  const conv = new Set(convocadoIds);
  slots.forEach((p, slot) => {
    if (!p) return;
    const inj = injuryOf.get(p.id) || (p.status === "lesionado" ? {} : null);
    if (inj) out.push({ kind: "injured", slot, player: p, back: inj.expected_return || null });
    else if (conv.size && !conv.has(p.id)) out.push({ kind: "notCalled", slot, player: p });
  });
  for (const p of bench) {
    const m = minutesOf(p.id);
    if (m && m.level === "alert" && m.pct != null) out.push({ kind: "lowMinutes", player: p, pct: m.pct });
  }
  return out;
}

/**
 * Alineación del último partido del equipo anterior a este que tenga alguien en el once.
 * plans: MatchPlan del equipo; events: partidos (para las fechas). Devuelve { event, plan } o null.
 */
export function previousLineup({ plans = [], events = [], eventId, eventDate }) {
  const dateOf = new Map(events.map((e) => [e.id, String(e.date || "")]));
  const cur = String(eventDate || dateOf.get(eventId) || "");
  const prev = plans
    .filter((p) => p.event_id && p.event_id !== eventId && dateOf.has(p.event_id) && Array.isArray(p.lineup) && p.lineup.some(Boolean))
    .filter((p) => !cur || dateOf.get(p.event_id) < cur)
    .sort((a, b) => dateOf.get(b.event_id).localeCompare(dateOf.get(a.event_id)));
  if (!prev.length) return null;
  return { event: events.find((e) => e.id === prev[0].event_id) || null, plan: prev[0] };
}

/** Texto plano corto de un texto con formato (para la línea de un bloque del plan cerrado) */
export function plainSummary(html = "", max = 140) {
  const txt = String(html || "")
    .replace(/<(br|\/p|\/div|\/li)\s*\/?>/gi, " · ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/(\s*·\s*)+/g, " · ")
    .replace(/\s+/g, " ")
    .replace(/^\s*·\s*|\s*·\s*$/g, "")
    .trim();
  return txt.length > max ? `${txt.slice(0, max - 1).trimEnd()}…` : txt;
}

/** Resumen corto del rival a partir del informe de la FCF (o null si no hay datos) */
export function rivalSummary(report) {
  if (!report?.available || !report.rival) return null;
  const { rival, away = {}, form = [], scorers = [], insightItems = [] } = report;
  const h2h = insightItems.find((x) => x.id === "h2h")?.v || null;
  return {
    pos: rival.pos, pts: rival.pts, pj: rival.pj, gf: rival.gf, gc: rival.gc,
    away: away.pj ? `${away.g}-${away.e}-${away.p}` : null,
    form: form.slice(0, 5).map((f) => f.result), // G / E / P (el más reciente primero)
    scorers: scorers.slice(0, 3),
    h2h, // { result, our, rival, away }
  };
}
