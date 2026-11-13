// Estadísticas (rediseño del 13/11/2026, maqueta «Maqueta Estadísticas · RS Manager» aprobada por Nacho, gráficos estilo B
// «en espejo»). Cálculos puros, sin importaciones de la app: se prueban en Node (tests/statsOverview.test.mjs).
// Convención: score_home = nuestros goles, score_away = los del rival.

const time = (d) => (d instanceof Date ? d.getTime() : new Date(d).getTime());
const has = (v) => v != null && v !== "";

/** Amarillas que hacen ciclo en la competición del primer equipo (el único equipo del club con acumulación;
 * decidido por Nacho el 13/11/2026; el número es una suposición mía, por confirmar). */
export const CARD_CYCLE = 5;

/** Partidos ya jugados con resultado (no suspendidos) de los tipos elegidos; de un equipo o, sin teamId, de todos */
export function playedMatches(events = [], { types = ["partido_liga"], teamId = null, now = new Date() } = {}) {
  const t = time(now);
  return events
    .filter((e) => types.includes(e.type) && (!teamId || e.team_id === teamId) && e.cancelled !== true
      && has(e.score_home) && has(e.score_away) && time(e.date) <= t)
    .sort((a, b) => time(a.date) - time(b.date));
}

/** Balance de una lista de partidos: victorias, empates, derrotas, goles, porterías a cero y % de victorias */
export function recordOf(list = []) {
  let w = 0, d = 0, l = 0, gf = 0, ga = 0, clean = 0;
  for (const m of list) {
    const a = Number(m.score_home), b = Number(m.score_away);
    gf += a; ga += b; if (b === 0) clean++;
    if (a > b) w++; else if (a < b) l++; else d++;
  }
  const n = w + d + l;
  return { w, d, l, n, gf, ga, clean, winPct: n ? Math.round((w / n) * 100) : null };
}

/** G / E / P de los últimos n partidos (del más antiguo al más reciente) */
export function formOf(list = [], n = 5) {
  return list.slice(-n).map((m) => {
    const a = Number(m.score_home), b = Number(m.score_away);
    return a > b ? "G" : a < b ? "P" : "E";
  });
}

/** Una cifra por partido con un decimal («2,4»); sin partidos, null */
export const perMatch = (n, matches) => (matches ? Math.round((n / matches) * 10) / 10 : null);

/** Suma por jugador de sus estadísticas de partido: goles, asistencias, minutos, amarillas y rojas */
export function playerTotals(stats = []) {
  const map = new Map();
  for (const s of stats) {
    if (!s.player_id) continue;
    const r = map.get(s.player_id) || { player_id: s.player_id, goals: 0, assists: 0, minutes: 0, yellow: 0, red: 0, games: 0 };
    r.goals += Number(s.goals) || 0; r.assists += Number(s.assists) || 0; r.minutes += Number(s.minutes_played) || 0;
    r.yellow += Number(s.yellow_cards) || 0; r.red += Number(s.red_cards) || 0;
    if ((Number(s.minutes_played) || 0) > 0) r.games++;
    map.set(s.player_id, r);
  }
  return map;
}

/** Los n primeros por una clave (sin los que tienen 0) */
export function leaders(totals, key, n = 5) {
  return [...totals.values()].filter((r) => r[key] > 0).sort((a, b) => b[key] - a[key] || b.games - a.games).slice(0, n);
}

/** Aviso de ciclo de amarillas: «A 1 de sanción» cuando le falta una para cumplir ciclo */
export function cycleWarning(yellow, cycle = CARD_CYCLE) {
  if (!cycle || !yellow) return null;
  const left = cycle - (yellow % cycle);
  return left === 1 ? { left, yellow } : null;
}

/** % de asistencia a entrenos por equipo desde `since` (sin eventos suspendidos): Map teamId → {rate, n} */
export function attendanceByTeam(attendance = [], eventsById = new Map(), { since = null, now = new Date() } = {}) {
  const from = since ? time(since) : -Infinity, to = time(now);
  const acc = new Map();
  for (const a of attendance) {
    if (!a.status) continue;
    const ev = eventsById.get(a.event_id);
    if (!ev || ev.cancelled === true) continue;
    const t = time(ev.date);
    if (t < from || t > to) continue;
    const r = acc.get(ev.team_id) || { ok: 0, n: 0 };
    r.n++; if (a.status !== "absent") r.ok++;
    acc.set(ev.team_id, r);
  }
  return new Map([...acc].map(([k, r]) => [k, { rate: Math.round((r.ok / r.n) * 100), n: r.n }]));
}

/** Orden de la comparativa: «categoria» (el que trae la lista), «victorias» (% de victorias) o «entrenos» (el más bajo primero) */
export function sortCompare(rows = [], mode = "categoria") {
  const list = [...rows];
  if (mode === "victorias") return list.sort((a, b) => (b.rec.winPct ?? -1) - (a.rec.winPct ?? -1) || (b.rec.gf - b.rec.ga) - (a.rec.gf - a.rec.ga));
  if (mode === "entrenos") return list.sort((a, b) => (a.att ?? 101) - (b.att ?? 101));
  return list;
}

/** Filas en espejo de una lista [{label, f, a}] con el ancho de cada barra (0–100) sobre el máximo común */
export function mirrorRows(rows = []) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.f || 0, r.a || 0]));
  return rows.map((r) => ({ ...r, fw: ((r.f || 0) / max) * 100, aw: ((r.a || 0) / max) * 100 }));
}

/** Radio de un círculo del mapa de goles según su valor (de 0 a `max`): entre `min` y `max_r` */
export function circleRadius(v, max, { min = 10, max_r = 32 } = {}) {
  if (!v || !max) return 0;
  return Math.round(min + (max_r - min) * Math.sqrt(v / max));
}

/** Orden de la tabla de jugadores: «pos» (la página agrupa por posición), «min» (más minutos), «goles» o «bajo» (% más bajo) */
export function sortPlayers(rows = [], mode = "pos") {
  const list = [...rows];
  const num = (v) => (v == null || v === "" ? 999 : Number(v));
  if (mode === "min") return list.sort((a, b) => b.b.mins - a.b.mins);
  if (mode === "goles") return list.sort((a, b) => b.t.goals - a.t.goals || b.t.assists - a.t.assists);
  if (mode === "bajo") return list.sort((a, b) => (a.b.pctAvail ?? 101) - (b.b.pctAvail ?? 101));
  return list.sort((a, b) => num(a.p.jersey_number) - num(b.p.jersey_number));
}
