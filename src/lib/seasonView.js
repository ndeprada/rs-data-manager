// Temporada (rediseño rs2 del 13/11/2026, maqueta «Maqueta Temporada · RS Manager» aprobada por Nacho):
// propuesta de destino por año de nacimiento, plantilla prevista, movimientos del club, traer lo decidido en
// Planificación y la lista para empezar la temporada nueva. Funciones puras (se prueban en Node).
import { birthYearOf } from "./birthYear.js";

export const LINE_OF = {
  portero: "POR", lateral: "DEF", central: "DEF", libre: "DEF",
  mediocentro: "MED", interior: "MED", mediapunta: "MED", extremo: "DEL", delantero_centro: "DEL",
};
export const LINES = ["POR", "DEF", "MED", "DEL"];

export const nextSeasonOf = (s) => { const y = Number(String(s).slice(0, 4)) + 1; return `${y}-${y + 1}`; };
export const shortSeason = (s) => String(s || "").replace(/^(\d{4})-\d{2}(\d{2})$/, "$1-$2");

const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const isSeniorTeam = (t) => /primer|amateur|senior|absolut/.test(norm(t?.name));
// Letra del equipo («Cadete B» → «B»; «Aleví S12 A» → «A»)
export const teamLetter = (t) => { const m = /\s([A-H])$/.exec(String(t?.name || "").trim()); return m ? m[1] : null; };

/** Destino que vale: otro equipo que existe, «stay» o «baja» */
export const validMove = (mv, teamIds) => !!mv && (mv.to === "baja" || mv.to === "stay" || teamIds.has(mv.to));

/**
 * Años de nacimiento «propios» de cada equipo: los que tienen al menos 2 jugadores y el 15 % de la plantilla
 * (así no cuenta quien juega por arriba o por abajo). Map teamId → Set de años.
 */
export function teamCohorts(players, teams) {
  const out = new Map();
  for (const t of teams) {
    const list = players.filter((p) => p.team_id === t.id && p.status !== "baja");
    const counts = new Map();
    for (const p of list) { const y = birthYearOf(p); if (y) counts.set(y, (counts.get(y) || 0) + 1); }
    const min = Math.max(2, Math.ceil(list.length * 0.15));
    out.set(t.id, new Set([...counts.entries()].filter(([, n]) => n >= min).map(([y]) => y)));
  }
  return out;
}

/**
 * Propuesta de destino para la temporada siguiente: el año que viene un jugador nacido en Y juega donde este año
 * juegan los nacidos en Y−1. Si su equipo ya tiene ese año, se queda; si no, el equipo de esa categoría con su
 * misma letra (o el primero). Los del primer equipo se quedan; los mayores que cualquier equipo de base suben al
 * primer equipo. `teams` en el orden del club (sortTeams). Devuelve un id de equipo, «stay» o null (sin propuesta).
 */
export function proposeDestination(p, { teams, cohorts }) {
  const y = birthYearOf(p);
  const cur = teams.find((t) => t.id === p.team_id);
  if (!cur || !y) return null;
  if (isSeniorTeam(cur)) return "stay";
  const target = y - 1;
  if (cohorts.get(cur.id)?.has(target)) return "stay";
  const youth = teams.filter((t) => !isSeniorTeam(t));
  const cands = youth.filter((t) => cohorts.get(t.id)?.has(target));
  if (cands.length) {
    const letter = teamLetter(cur);
    return (cands.find((t) => letter && teamLetter(t) === letter) || cands[0]).id;
  }
  const youthYears = youth.flatMap((t) => [...(cohorts.get(t.id) || [])]);
  if (youthYears.length && target < Math.min(...youthYears)) {
    const senior = teams.find(isSeniorTeam);
    return senior && senior.id !== cur.id ? senior.id : null;
  }
  return null;
}

export function proposalsFor(players, teams) {
  const cohorts = teamCohorts(players, teams);
  const out = new Map();
  for (const p of players) {
    if (!p.team_id || p.status === "baja") continue;
    const to = proposeDestination(p, { teams, cohorts });
    if (to) out.set(p.id, to);
  }
  return out;
}

/** Plantilla prevista de un equipo: { stay, undecided, arrive, leave:[{p,to}] } (los sin decidir se quedan) */
export function projectTeam(teamId, squad, moves, teamIds) {
  const e = { stay: [], undecided: [], arrive: [], leave: [] };
  for (const p of squad) {
    const mv = validMove(moves[p.id], teamIds) ? moves[p.id] : null;
    if (p.team_id === teamId) {
      if (!mv) { e.stay.push(p); e.undecided.push(p); }
      else if (mv.to === "stay" || mv.to === teamId) e.stay.push(p);
      else e.leave.push({ p, to: mv.to });
    } else if (mv && mv.to === teamId) e.arrive.push(p);
  }
  return e;
}

export function lineCounts(list) {
  const out = { POR: 0, DEF: 0, MED: 0, DEL: 0, none: 0 };
  for (const p of list) out[LINE_OF[p.position] || "none"]++;
  return out;
}

export function yearCounts(list) {
  const m = new Map();
  for (const p of list) { const y = birthYearOf(p) || "s/a"; m.set(y, (m.get(y) || 0) + 1); }
  return [...m.entries()].sort((a, b) => (a[0] === "s/a") - (b[0] === "s/a") || String(a[0]).localeCompare(String(b[0])));
}

/** Avisos de una plantilla prevista: pocos porteros, una línea vacía, poca gente */
export function squadWarnings(list, { f7 = false } = {}) {
  const c = lineCounts(list);
  const out = [];
  if (list.length === 0) return out;
  if (c.POR < 2) out.push({ key: "gk", n: c.POR });
  for (const l of ["DEF", "MED", "DEL"]) if (c[l] === 0) out.push({ key: "line", line: l });
  const min = f7 ? 10 : 16;
  if (list.length < min) out.push({ key: "few", n: list.length, min });
  return out;
}

/** Movimientos entre equipos: [{from, to, n}] de más a menos (las bajas y los que se quedan no cuentan) */
export function moveFlows(squad, moves, teamIds) {
  const m = new Map();
  for (const p of squad) {
    const mv = moves[p.id];
    if (!validMove(mv, teamIds) || mv.to === "stay" || mv.to === "baja" || mv.to === p.team_id) continue;
    const k = `${p.team_id}>${mv.to}`;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([k, n]) => { const [from, to] = k.split(">"); return { from, to, n }; }).sort((a, b) => b.n - a.n);
}

/** Cifras de arriba: decididos, se quedan, cambian de equipo, bajas y sin decidir */
export function transferKpis(squad, moves, teamIds) {
  const k = { total: squad.length, decided: 0, stay: 0, change: 0, baja: 0, undecided: 0, seniorBajas: 0 };
  for (const p of squad) {
    const mv = moves[p.id];
    if (!validMove(mv, teamIds)) { k.undecided++; continue; }
    k.decided++;
    if (mv.to === "baja") k.baja++;
    else if (mv.to === "stay" || mv.to === p.team_id) k.stay++;
    else k.change++;
  }
  return k;
}

/**
 * Lo decidido en Planificación (campogramas de la temporada siguiente) convertido en destinos: un pase a otro
 * equipo = ese equipo; marcado como baja = baja. Solo los jugadores todavía sin decidir (lo decidido no se pisa).
 */
export function planToMoves(entries, players, moves, teamIds) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const out = {};
  let passes = 0, bajas = 0, already = 0;
  const seen = new Set();
  for (const e of entries) {
    if (e.kind !== "player" || !e.ref_id || seen.has(e.ref_id)) continue;
    const p = byId.get(e.ref_id);
    if (!p || p.status === "baja" || !p.team_id) continue;
    let to = null;
    if (e.status === "sale") to = "baja";
    else if (e.to_team_id && e.to_team_id !== p.team_id && teamIds.has(e.to_team_id)) to = e.to_team_id;
    if (!to) continue;
    seen.add(e.ref_id);
    if (validMove(moves[p.id], teamIds)) { already++; continue; }
    out[p.id] = { to };
    if (to === "baja") bajas++; else passes++;
  }
  return { moves: out, passes, bajas, already };
}

/**
 * Lista para empezar la temporada nueva: se marca sola con lo que ya hay en la app.
 * Devuelve [{key, done, n, total}].
 */
export function seasonChecklist({ teams = [], assignments = [], players = [], events = [], rules = [], now = new Date() }) {
  const active = players.filter((p) => p.team_id && p.status !== "baja");
  const withFcf = teams.filter((t) => t.fcf_team_code || t.fcf_group_url || t.fcf_group_id).length;
  const staffed = teams.filter((t) => t.coach || assignments.some((a) => a.team_id === t.id && a.active !== false)).length;
  const today = now.toISOString().slice(0, 10);
  const trainTeams = new Set(events.filter((e) => e.type === "entrenamiento" && String(e.date || "").slice(0, 10) >= today && !e.cancelled).map((e) => e.team_id));
  const scheduled = teams.filter((t) => trainTeams.has(t.id)).length;
  const noDorsal = active.filter((p) => p.jersey_number === null || p.jersey_number === undefined || p.jersey_number === "").length;
  return [
    { key: "fcf", done: teams.length > 0 && withFcf === teams.length, n: withFcf, total: teams.length },
    { key: "staff", done: teams.length > 0 && staffed === teams.length, n: staffed, total: teams.length },
    { key: "dorsal", done: noDorsal === 0, n: noDorsal, total: active.length },
    { key: "trainings", done: teams.length > 0 && scheduled === teams.length, n: scheduled, total: teams.length },
    { key: "rules", done: rules.length > 0, n: rules.length, total: 1 },
  ];
}

/** Resumen de una temporada cerrada (filas de TeamSeasonHistory) */
export function historySummary(rows) {
  let g = 0, e = 0, p = 0;
  const champions = [];
  for (const r of rows) {
    const st = r.standing || {}, rec = r.record || {};
    g += Number(st.g ?? rec.g ?? 0); e += Number(st.e ?? rec.e ?? 0); p += Number(st.p ?? rec.p ?? 0);
    if (Number(st.pos) === 1) champions.push(r.team_name);
  }
  const pj = g + e + p;
  return { teams: rows.length, g, e, p, winPct: pj ? Math.round((g / pj) * 100) : null, champions };
}
