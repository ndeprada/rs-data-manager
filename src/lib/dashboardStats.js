// Cálculos del Panel (rediseño del 12/11/2026, maqueta «Maqueta Panel · RS Manager» aprobada por Nacho).
// Sin importaciones de la app: se prueba en Node (tests/dashboardStats.test.mjs).

const DAY = 86400000;
const toDate = (d) => (d instanceof Date ? d : new Date(d));

/** Balance de la temporada de una lista de partidos con resultado: victorias, empates, derrotas, goles y % de victorias.
 * Convención: score_home = nuestros goles, score_away = los del rival. */
export function seasonRecord(played = []) {
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  for (const m of played) {
    const ours = Number(m.score_home ?? 0), theirs = Number(m.score_away ?? 0);
    gf += ours; ga += theirs;
    if (ours > theirs) w++; else if (ours < theirs) l++; else d++;
  }
  const n = w + d + l;
  return { w, d, l, n, gf, ga, winPct: n ? Math.round((w / n) * 100) : null };
}

/** Asistencia de los últimos `days` días frente a los `days` anteriores, y el equipo con la más baja (con al menos
 * `minRecords` registros). `eventsById`: Map id → evento (para la fecha y el equipo). Los registros de eventos suspendidos
 * no cuentan (se pasan en `skip`). */
export function attendanceSummary(attendance = [], eventsById = new Map(), { now = new Date(), days = 30, minRecords = 8, skip = new Set(), inScope = () => true } = {}) {
  const t = toDate(now).getTime();
  const from = t - days * DAY, prevFrom = t - 2 * days * DAY;
  const cur = { n: 0, p: 0 }, prev = { n: 0, p: 0 };
  const byTeam = new Map();
  for (const a of attendance) {
    if (skip.has(a.event_id)) continue;
    const ev = eventsById.get(a.event_id);
    const when = ev ? toDate(ev.date).getTime() : NaN;
    if (!Number.isFinite(when) || when > t) continue;
    const team = ev?.team_id || a.team_id;
    if (!inScope(team)) continue;
    const ok = a.status !== "absent" ? 1 : 0;
    if (when >= from) {
      cur.n++; cur.p += ok;
      if (team) { const s = byTeam.get(team) || { n: 0, p: 0 }; s.n++; s.p += ok; byTeam.set(team, s); }
    } else if (when >= prevFrom) {
      prev.n++; prev.p += ok;
    }
  }
  const rate = cur.n ? Math.round((cur.p / cur.n) * 100) : null;
  const prevRate = prev.n ? Math.round((prev.p / prev.n) * 100) : null;
  let lowest = null;
  for (const [teamId, s] of byTeam) {
    if (s.n < minRecords) continue;
    const r = Math.round((s.p / s.n) * 100);
    if (!lowest || r < lowest.rate) lowest = { teamId, rate: r };
  }
  // Solo tiene sentido nombrar al equipo más bajo si hay más de uno con datos
  const teamsWithData = [...byTeam.values()].filter((s) => s.n >= minRecords).length;
  return { rate, prevRate, trend: rate != null && prevRate != null ? rate - prevRate : null, lowest: teamsWithData > 1 ? lowest : null };
}

/** Los `n` primeros de una lista de filas por un campo (solo los que tienen algo). */
export function topBy(rows = [], key, n = 3) {
  return [...rows].filter((r) => (r[key] || 0) > 0).sort((a, b) => b[key] - a[key]).slice(0, n);
}

/** Lesiones activas (sin alta) cuya vuelta prevista cae entre hoy y dentro de `days` días. */
export function returningSoon(injuries = [], { now = new Date(), days = 7 } = {}) {
  const start = new Date(toDate(now)); start.setHours(0, 0, 0, 0);
  const end = start.getTime() + (days + 1) * DAY;
  return injuries.filter((i) => i && i.status !== "alta" && i.expected_return
    && toDate(i.expected_return).getTime() >= start.getTime() && toDate(i.expected_return).getTime() < end);
}

/** Recuento V/E/D de una lista de partidos con resultado (para el resumen del fin de semana). */
export function wdl(list = []) {
  const r = seasonRecord(list);
  return { w: r.w, d: r.d, l: r.l };
}
