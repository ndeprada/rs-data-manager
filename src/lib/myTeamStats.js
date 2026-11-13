// Mi equipo (rediseño del 13/11/2026, maqueta «Maqueta Mi equipo · RS Manager» aprobada por Nacho): cálculos puros.
// Sin importaciones de la app: se prueba en Node.

export const LINES = [
  { key: "porteros", label: "Porteros", pos: ["portero"] },
  { key: "defensas", label: "Defensas", pos: ["central", "libre", "lateral"] },
  { key: "medios", label: "Medios", pos: ["mediocentro", "interior", "mediapunta"] },
  { key: "delanteros", label: "Delanteros", pos: ["extremo", "delantero_centro"] },
];
const POS_ORDER = LINES.flatMap((l) => l.pos);
const num = (v) => (v == null || v === "" ? 999 : Number(v));

/** Filas de la plantilla agrupadas por línea (y «Sin posición» al final); dentro, por puesto y dorsal */
export function squadGroups(rows, posOf = (r) => r.p?.position) {
  const out = LINES.map((l) => ({ key: l.key, label: l.label, rows: [] }));
  const none = { key: "sin", label: "Sin posición", rows: [] };
  for (const r of rows) {
    const i = LINES.findIndex((l) => l.pos.includes(posOf(r)));
    (i < 0 ? none : out[i]).rows.push(r);
  }
  const rank = (r) => { const i = POS_ORDER.indexOf(posOf(r)); return (i < 0 ? 99 : i) * 1000 + num(r.p?.jersey_number); };
  for (const g of [...out, none]) g.rows.sort((a, b) => rank(a) - rank(b));
  return [...out, none].filter((g) => g.rows.length);
}

/** Orden de la lista: «dorsal», «minutos» (más primero) o «goles» (goles y luego asistencias) */
export function sortSquad(rows, mode) {
  const list = [...rows];
  if (mode === "minutos") return list.sort((a, b) => (b.mins || 0) - (a.mins || 0) || num(a.p?.jersey_number) - num(b.p?.jersey_number));
  if (mode === "goles") return list.sort((a, b) => (b.goals || 0) - (a.goals || 0) || (b.assists || 0) - (a.assists || 0) || num(a.p?.jersey_number) - num(b.p?.jersey_number));
  return list.sort((a, b) => num(a.p?.jersey_number) - num(b.p?.jersey_number));
}

/** Trozo de la clasificación alrededor de nuestro equipo (size filas; si no estamos, las primeras) */
export function standingWindow(rows = [], ourId, size = 5) {
  const list = [...rows].sort((a, b) => a.pos - b.pos);
  const i = list.findIndex((r) => r.teamId === ourId);
  if (i < 0 || list.length <= size) return list.slice(0, size);
  const start = Math.max(0, Math.min(i - Math.floor(size / 2), list.length - size));
  return list.slice(start, start + size);
}

/** Distancia con el líder: { leader, gap } si no vamos primeros; { lead, second } si lo somos */
export function leaderGap(rows = [], ourId) {
  const list = [...rows].sort((a, b) => a.pos - b.pos);
  const me = list.find((r) => r.teamId === ourId);
  if (!me || !list.length) return null;
  if (list[0].teamId === ourId) return list[1] ? { lead: me.pts - list[1].pts, second: list[1] } : { lead: 0 };
  return { leader: list[0], gap: list[0].pts - me.pts };
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/\./g, "").replace(/["',]/g, " ").replace(/\b(cf|fc|ue|ce|cd|ud|ad|sd|uec|club|futbol|de|del|la|el)\b/g, " ").replace(/\s+/g, " ").trim();

/** ¿Es el mismo rival? (mismo criterio que findRival: sin acentos, siglas ni puntos; vale si uno contiene al otro) */
export function sameTeamName(a, b) {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}

/** Fila del rival en la clasificación por su nombre (sin acentos, siglas ni puntos; vale si uno contiene al otro) */
export function findRival(rows = [], name) {
  const n = norm(name);
  if (!n) return null;
  return rows.find((r) => norm(r.team) === n) || rows.find((r) => { const m = norm(r.team); return m && (m.includes(n) || n.includes(m)); }) || null;
}

/** % de asistencia de cada jugador en los últimos `days` días (presente o al margen = asiste); los de menos primero */
export function playerAttendance(attendance = [], eventsById, { now = new Date(), days = 30, playerIds, minRecords = 3, skip } = {}) {
  const from = now.getTime() - days * 86400000;
  const ids = playerIds ? new Set(playerIds) : null;
  const acc = new Map();
  for (const a of attendance) {
    if (!a.status || (ids && !ids.has(a.player_id)) || (skip && skip.has(a.event_id))) continue;
    const ev = eventsById?.get(a.event_id);
    const when = new Date(ev?.date || a.date || 0).getTime();
    if (!(when >= from && when <= now.getTime())) continue;
    const x = acc.get(a.player_id) || { n: 0, ok: 0 };
    x.n += 1; if (a.status === "present" || a.status === "apart") x.ok += 1;
    acc.set(a.player_id, x);
  }
  return [...acc.entries()].filter(([, x]) => x.n >= minRecords)
    .map(([player_id, x]) => ({ player_id, n: x.n, rate: Math.round((x.ok / x.n) * 100) }))
    .sort((a, b) => a.rate - b.rate || b.n - a.n);
}

// Motivos de la convocatoria que dejan a un jugador fuera por algo ajeno al entrenador
const OUT_REASONS = ["lesion", "enfermo", "sancion", "viaje", "estudios"];

/**
 * Quién no está disponible: lesiones sin alta (o ficha en «lesionado») y, en el próximo partido, los no convocados
 * por lesión, enfermedad, sanción, viaje o estudios. [{ player, reason, until }]
 */
export function unavailable({ players = [], injuries = [], conv = null }) {
  const out = new Map();
  const ids = new Set(players.map((p) => p.id));
  for (const i of injuries) {
    if (!ids.has(i.player_id) || i.status === "alta" || out.has(i.player_id)) continue;
    out.set(i.player_id, { player: players.find((p) => p.id === i.player_id), reason: "lesion", until: i.expected_return || null });
  }
  for (const p of players) if (p.status === "lesionado" && !out.has(p.id)) out.set(p.id, { player: p, reason: "lesion", until: null });
  const why = conv?.absence_reasons || {};
  for (const [pid, r] of Object.entries(why)) {
    if (!ids.has(pid) || !OUT_REASONS.includes(r) || (conv.player_ids || []).includes(pid) || out.has(pid)) continue;
    out.set(pid, { player: players.find((p) => p.id === pid), reason: r, until: null });
  }
  return [...out.values()];
}
