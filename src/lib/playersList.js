// Jugadores (rediseño del 13/11/2026, maqueta «Maqueta Jugadores · RS Manager» aprobada por Nacho): filtros,
// resumen, grupos, orden y exportación. Cálculos puros, sin importaciones de la app: se prueba en Node.
// Cada fila: { p, team, year, injured, injury, acc:{own,family,pending}|null, pj, pctMin, level, goals, attPct, attN }

export const POS_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "mediapunta", "extremo", "delantero_centro"];
const num = (v) => (v == null || v === "" ? 999 : Number(v));
const fold = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const EMPTY_FILTERS = { search: "", teams: [], years: [], positions: [], foot: "all", status: "all", nat: "all", account: "all", noDorsal: false };

/** Año para los botones del filtro: el año, «senior» (mayores que juvenil) o «none» (sin año) */
export function yearKey(year, season) {
  if (!year) return "none";
  const end = Number(String(season || "").slice(5, 9));
  return end && Number(year) <= end - 20 ? "senior" : String(year);
}

/** Estado para el filtro y el resumen: baja · lesionado (ficha o lesión sin alta) · activo */
export const statusOf = (r) => (r.p.status === "baja" ? "baja" : r.injured ? "lesionado" : "activo");

/** Cuenta en la app: own (propia) · family (familiar vinculado) · none */
export const accountOf = (r) => (!r.acc ? null : r.acc.own > 0 ? "own" : r.acc.family > 0 ? "family" : "none");

export const hasDorsal = (p) => p?.jersey_number != null && p.jersey_number !== "";

export function matchesFilters(r, f, { season, searchName, isForeign, countryA3 } = {}) {
  const p = r.p;
  if (f.search) {
    const q = fold(f.search).trim();
    const name = fold(searchName ? searchName(p) : `${p.first_name || ""} ${p.last_name || ""}`);
    if (q && !name.includes(q) && String(p.jersey_number ?? "") !== q) return false;
  }
  if (f.teams.length && !f.teams.includes(p.team_id)) return false;
  if (f.years.length && !f.years.includes(yearKey(r.year, season))) return false;
  if (f.positions.length && !f.positions.includes(p.position)) return false;
  if (f.foot !== "all" && p.laterality !== f.foot) return false;
  if (f.status !== "all" && statusOf(r) !== f.status) return false;
  if (f.nat === "foreign" && !(isForeign ? isForeign(p) : false)) return false;
  if (f.nat === "ESP" && (countryA3 ? countryA3(p) : null) !== "ESP") return false;
  if (f.account !== "all" && accountOf(r) !== f.account) return false;
  if (f.noDorsal && hasDorsal(p)) return false;
  return true;
}

export const hasAnyFilter = (f) => !!(f.search || f.teams.length || f.years.length || f.positions.length || f.foot !== "all" || f.status !== "all" || f.nat !== "all" || f.account !== "all" || f.noDorsal);

/** Números del resumen de arriba (sobre todos los jugadores, sin filtros) */
export function kpiCounts(rows, { isForeign } = {}) {
  const c = { total: rows.length, activos: 0, lesionados: 0, bajas: 0, extranjeros: 0, sinCuenta: 0, sinDorsal: 0 };
  for (const r of rows) {
    const s = statusOf(r);
    if (s === "activo") c.activos++;
    else if (s === "lesionado") c.lesionados++;
    else c.bajas++;
    if (isForeign && isForeign(r.p)) c.extranjeros++;
    if (accountOf(r) === "none") c.sinCuenta++;
    if (s !== "baja" && !hasDorsal(r.p)) c.sinDorsal++;
  }
  return c;
}

/** Cuántos jugadores hay de cada año (para los botones), ordenado de mayor a menor año; «senior» y «none» al final */
export function yearOptions(rows, season) {
  const m = new Map();
  for (const r of rows) { const k = yearKey(r.year, season); m.set(k, (m.get(k) || 0) + 1); }
  const years = [...m.keys()].filter((k) => k !== "senior" && k !== "none").sort((a, b) => Number(a) - Number(b));
  return [...years, ...(m.has("senior") ? ["senior"] : []), ...(m.has("none") ? ["none"] : [])].map((k) => ({ key: k, n: m.get(k) }));
}

const SORTERS = {
  dorsal: (r) => num(r.p.jersey_number),
  name: (r) => fold(`${r.p.last_name || ""} ${r.p.first_name || ""}`),
  year: (r) => r.year || 0,
  position: (r) => { const i = POS_ORDER.indexOf(r.p.position); return i < 0 ? 99 : i; },
  team: (r) => r.teamRank ?? 99,
  pj: (r) => r.pj || 0,
  pctMin: (r) => (r.pctMin == null ? -1 : r.pctMin),
  goals: (r) => r.goals || 0,
  att: (r) => (r.attPct == null ? -1 : r.attPct),
};
export const SORT_KEYS = Object.keys(SORTERS);

/** Orden de la tabla. Desempate: posición, dorsal y apellido. */
export function sortRows(rows, key = "position", dir = "asc") {
  const get = SORTERS[key] || SORTERS.position;
  const s = dir === "desc" ? -1 : 1;
  const tie = (a, b) => SORTERS.position(a) - SORTERS.position(b) || SORTERS.dorsal(a) - SORTERS.dorsal(b) || SORTERS.name(a).localeCompare(SORTERS.name(b));
  return [...rows].sort((a, b) => {
    const x = get(a), y = get(b);
    if (x < y) return -s;
    if (x > y) return s;
    return tie(a, b);
  });
}

export const LINES = [
  { key: "porteros", label: "Porteros", pos: ["portero"] },
  { key: "defensas", label: "Defensas", pos: ["central", "libre", "lateral"] },
  { key: "medios", label: "Medios", pos: ["mediocentro", "interior", "mediapunta"] },
  { key: "delanteros", label: "Delanteros", pos: ["extremo", "delantero_centro"] },
];

/** Grupos de la tabla: «team» (en el orden de `teams`; sin equipo al final), «position» (líneas) o «none» */
export function groupRows(rows, mode, teams = []) {
  if (mode === "team") {
    const out = teams.map((t) => ({ key: t.id, team: t, rows: [] }));
    const byId = new Map(out.map((g) => [g.key, g]));
    const none = { key: "none", team: null, rows: [] };
    for (const r of rows) (byId.get(r.p.team_id) || none).rows.push(r);
    return [...out, none].filter((g) => g.rows.length);
  }
  if (mode === "position") {
    const out = LINES.map((l) => ({ key: l.key, label: l.label, rows: [] }));
    const none = { key: "sin", label: "Sin posición", rows: [] };
    for (const r of rows) { const i = LINES.findIndex((l) => l.pos.includes(r.p.position)); (i < 0 ? none : out[i]).rows.push(r); }
    return [...out, none].filter((g) => g.rows.length);
  }
  return [{ key: "all", rows }];
}

const FOOT = { diestro: "Diestro", zurdo: "Zurdo", ambidiestro: "Ambidiestro" };
const STATUS = { activo: "Activo", lesionado: "Lesionado", baja: "Baja" };
const ACCOUNT = { own: "Propia", family: "Familia", none: "Sin cuenta" };

/** Tabla para Excel (siempre en español): cabecera y filas con los jugadores filtrados, en el orden de la pantalla */
export function exportTable(rows, { posName = (p) => p || "", countryName = () => "", withAccount = false } = {}) {
  const header = ["Dorsal", "Nombre", "Apellidos", "Año", "Equipo", "Posición", "Pie", "Nacionalidad", "PJ", "% minutos", "Goles", "% entrenos", "Estado", ...(withAccount ? ["Cuenta"] : [])];
  const body = rows.map((r) => {
    const s = statusOf(r);
    return [
      r.p.jersey_number ?? "", r.p.first_name || "", r.p.last_name || "", r.year || "", r.team?.name || "", posName(r.p.position),
      FOOT[r.p.laterality] || "", countryName(r.p), r.pj || 0, r.pctMin == null ? "" : r.pctMin, r.goals || 0, r.attPct == null ? "" : r.attPct,
      STATUS[s] + (s === "lesionado" && r.injury?.expected_return ? ` (vuelta ${r.injury.expected_return})` : ""),
      ...(withAccount ? [accountOf(r) === "none" && r.acc?.pending ? "Solicitud pendiente" : ACCOUNT[accountOf(r)] || ""] : []),
    ];
  });
  return { header, rows: body };
}
