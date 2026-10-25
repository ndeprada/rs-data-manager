// Scouting → Planificación (`src/components/scouting/SquadPlanning.jsx`): plantilla prevista de cada equipo para la temporada siguiente.
// Lógica pura y sin importaciones de la app (rutas relativas) para poder probarla en Node (tests/squadPlan.test.mjs).
//
// Cada jugador actual del equipo está «continúa» salvo que alguien marque «duda» o «sale» (solo entonces se guarda un `SquadPlanEntry`,
// `kind:"player"`); los objetivos de scouting son entradas `kind:"scout"` con su posición. El campograma tiene el ataque hacia ARRIBA y la portería
// abajo (como `FORMATION_POSITIONS`), así que izquierda y derecha son las del equipo.
import { tokenLabel } from "./tacticsBoard.js";

/** Temporada siguiente a «2026-2027» → «2027-2028». */
export function nextSeason(season) {
  const m = /^(\d{4})-(\d{4})$/.exec(String(season || ""));
  return m ? `${Number(m[1]) + 1}-${Number(m[2]) + 1}` : "";
}

export const STATUS = {
  continua: { label: "Continúa", tone: "green" },
  duda: { label: "Duda", tone: "amber" },
  sale: { label: "Se va", tone: "red" },
};
export const STATUS_KEYS = ["continua", "duda", "sale"];
const STATUS_RANK = { continua: 0, duda: 1, sale: 2 };

export const POSITION_LABEL = {
  portero: "Portero", libre: "Libre", central: "Central", lateral: "Lateral", mediocentro: "Mediocentro", interior: "Interior",
  mediapunta: "Mediapunta", extremo: "Extremo", delantero_centro: "Delantero centro",
};
export const POSITIONS = Object.keys(POSITION_LABEL);
const GROUP_OF = {
  portero: "Porteros", central: "Defensas", libre: "Defensas", lateral: "Defensas",
  mediocentro: "Medios", interior: "Medios", mediapunta: "Medios", extremo: "Delanteros", delantero_centro: "Delanteros",
};
export const GROUPS = ["Porteros", "Defensas", "Medios", "Delanteros"];
export const groupOf = (position) => GROUP_OF[position] || null;

// Puestos del campograma (x, y = esquina superior del puesto, en % del campo; delanteros arriba, portero abajo). `side` = lado del equipo.
export const ZONES = [
  { key: "extremo_l", pos: "extremo", side: "l", label: "Ext. izq.", x: 15, y: 4, w: 27 },
  { key: "delantero_centro", pos: "delantero_centro", label: "Del. centro", x: 50, y: 4, w: 28 },
  { key: "extremo_r", pos: "extremo", side: "r", label: "Ext. dcho.", x: 85, y: 4, w: 27 },
  { key: "mediapunta", pos: "mediapunta", label: "Mediapunta", x: 50, y: 19, w: 28 },
  { key: "interior_l", pos: "interior", side: "l", label: "Int. izq.", x: 15, y: 34, w: 27 },
  { key: "mediocentro", pos: "mediocentro", label: "Mediocentro", x: 50, y: 34, w: 28 },
  { key: "interior_r", pos: "interior", side: "r", label: "Int. dcho.", x: 85, y: 34, w: 27 },
  { key: "lateral_l", pos: "lateral", side: "l", label: "Lat. izq.", x: 14, y: 49, w: 27 },
  { key: "central", pos: "central", label: "Central", x: 50, y: 49, w: 28 },
  { key: "lateral_r", pos: "lateral", side: "r", label: "Lat. dcho.", x: 86, y: 49, w: 27 },
  { key: "libre", pos: "libre", label: "Libre", x: 50, y: 66, w: 28 },
  { key: "portero", pos: "portero", label: "Portero", x: 50, y: 82, w: 28 },
];
export const zoneByKey = (key) => ZONES.find((z) => z.key === key) || null;

// Puestos que siempre se enseñan (vacíos también, para poder añadir un objetivo); los demás salen solo si hay alguien o si se piden todos.
const CORE = {
  f11: ["extremo_l", "delantero_centro", "extremo_r", "mediocentro", "lateral_l", "central", "lateral_r", "portero"],
  f7: ["extremo_l", "extremo_r", "mediapunta", "lateral_l", "central", "lateral_r", "portero"],
};
export const isCoreZone = (format, key) => (CORE[format === "f7" ? "f7" : "f11"] || []).includes(key);

/** Lado del equipo («l» | «r») según la lateralidad del jugador: zurdo a la izquierda, diestro a la derecha; sin dato o ambidiestro, null. */
export function sideOfLaterality(laterality) {
  const l = String(laterality || "").toLowerCase();
  if (l.startsWith("zurd")) return "l";
  if (l.startsWith("diest")) return "r";
  return null;
}

const SIDED = new Set(["lateral", "extremo", "interior"]);
export const hasSides = (position) => SIDED.has(position);

/** Año de nacimiento de un jugador del club (`birth_year`) o de uno de scouting (`birth_year` o el año de `birth_date`). */
export function birthYearOf(p) {
  const y = Number(p?.birth_year) || Number(String(p?.birth_date || "").slice(0, 4)) || null;
  return y && y > 1900 ? y : null;
}

// Orden de las personas de un puesto: jugadores actuales (continúan → dudas → se van) y luego los objetivos de scouting
const rankOf = (it) => (it.kind === "scout" ? 10 : STATUS_RANK[it.status] ?? 0);

/**
 * Plantilla prevista de un equipo: {zones, items, unplaced, summary, orphans}.
 *  - players: jugadores del equipo (los de baja no cuentan); scouted: jugadores de scouting; entries: `SquadPlanEntry` de ese equipo y temporada.
 *  - zones: cada puesto del campograma con sus personas (jugadores actuales primero, por estado, y luego los objetivos).
 *  - unplaced: personas sin posición (no caben en el campo); orphans: objetivos cuyo jugador de scouting ya no existe (se ignoran).
 */
export function buildPlan({ players = [], scouted = [], entries = [] } = {}) {
  const entryOfPlayer = new Map();
  const scoutEntries = [];
  for (const e of entries) {
    if (e.kind === "scout") scoutEntries.push(e);
    else if (e.ref_id) entryOfPlayer.set(e.ref_id, e);
  }
  const scoutedById = new Map(scouted.map((s) => [s.id, s]));

  const items = [];
  for (const p of players) {
    if (p.status === "baja") continue;
    const e = entryOfPlayer.get(p.id) || null;
    items.push({
      key: `p:${p.id}`, kind: "player", id: p.id, entryId: e?.id || null, name: tokenLabel(p), year: birthYearOf(p),
      position: p.position || null, side: sideOfLaterality(p.laterality), status: STATUS[e?.status] ? e.status : "continua",
      note: e?.note || "", injured: p.status === "lesionado", source: p,
    });
  }
  let orphans = 0;
  for (const e of scoutEntries) {
    const s = scoutedById.get(e.ref_id);
    if (!s) { orphans += 1; continue; }
    items.push({
      key: `s:${s.id}`, kind: "scout", id: s.id, entryId: e.id || null, name: tokenLabel(s), year: birthYearOf(s),
      position: e.position || s.position || null, side: e.side === "l" || e.side === "r" ? e.side : sideOfLaterality(s.laterality),
      status: "objetivo", decision: s.decision || "", rating: s.rating || 0, club: s.current_club || "", note: e.note || "", source: s,
    });
  }

  // Reparto por puestos. Quien tiene lado conocido va a su lado; quien no, al lado con menos gente (así laterales sin dato se reparten).
  const load = new Map();
  const zoneOf = (it, side) => {
    if (!it.position || !POSITION_LABEL[it.position]) return null;
    if (!hasSides(it.position)) return ZONES.find((z) => z.pos === it.position)?.key || null;
    return `${it.position}_${side}`;
  };
  const place = (it) => {
    let side = it.side;
    if (hasSides(it.position) && !side) {
      const l = load.get(`${it.position}_l`) || 0, r = load.get(`${it.position}_r`) || 0;
      side = l < r ? "l" : "r";
    }
    const zone = zoneOf(it, side);
    if (zone) load.set(zone, (load.get(zone) || 0) + 1);
    return zone;
  };
  const sorted = [...items].sort((a, b) => Number(!a.side) - Number(!b.side) || a.name.localeCompare(b.name, "es"));
  const zoneKeyOf = new Map(sorted.map((it) => [it.key, place(it)]));

  const order = (a, b) => rankOf(a) - rankOf(b) || (a.year || 9999) - (b.year || 9999) || a.name.localeCompare(b.name, "es");
  const zones = ZONES.map((z) => ({ ...z, items: items.filter((it) => zoneKeyOf.get(it.key) === z.key).sort(order) }));
  const unplaced = items.filter((it) => !zoneKeyOf.get(it.key)).sort(order);
  return { zones, items, unplaced, summary: summarize(items), orphans };
}

/** Cuenta de la plantilla prevista: continúan + objetivos; las dudas y los que se van, aparte. Por grupo de posición y total. */
export function summarize(items) {
  const blank = () => ({ continua: 0, duda: 0, sale: 0, objetivo: 0, prevista: 0 });
  const total = blank();
  const groups = Object.fromEntries(GROUPS.map((g) => [g, blank()]));
  const sinPosicion = blank();
  for (const it of items) {
    const g = groupOf(it.position);
    for (const bucket of [total, g ? groups[g] : sinPosicion]) {
      bucket[it.status] += 1;
      if (it.status === "continua" || it.status === "objetivo") bucket.prevista += 1;
    }
  }
  return { total, groups, sinPosicion };
}

/** Puestos que se dibujan: los básicos del formato y los demás solo si tienen gente (o todos si `showAll`). */
export function visibleZones(plan, format, showAll = false) {
  return plan.zones.filter((z) => showAll || isCoreZone(format, z.key) || z.items.length > 0);
}

/** Fichas que se dibujan en un puesto con hasta `max` filas: si hay más gente, se ven `max-1` y la última fila es «+N más». */
export function zoneRows(items, max = 3) {
  if (items.length <= max) return { shown: items, more: 0 };
  return { shown: items.slice(0, max - 1), more: items.length - (max - 1) };
}

// ── PDF del campograma (`src/lib/squadPlanPdf.js`) ──────────────────────────────────────────────────────────────────────────
export const PDF_ZONE_ROWS = 4;
const POS_INDEX = Object.fromEntries(POSITIONS.map((p, i) => [p, i]));
const byPositionThenRank = (a, b) => (POS_INDEX[a.position] ?? 99) - (POS_INDEX[b.position] ?? 99) || rankOf(a) - rankOf(b)
  || (a.year || 9999) - (b.year || 9999) || a.name.localeCompare(b.name, "es");

/** «Continúa», «Duda», «Se va» u «Objetivo». */
export const statusLabel = (it) => (it.kind === "scout" ? "Objetivo" : STATUS[it.status]?.label || STATUS.continua.label);

/** Listas aparte del PDF: objetivos de scouting, dudas, los que se van y los que no tienen posición (no salen en el campo). */
export function pdfLists(plan) {
  const players = plan.items.filter((i) => i.kind === "player");
  return {
    objetivos: plan.items.filter((i) => i.kind === "scout").sort(byPositionThenRank),
    dudas: players.filter((i) => i.status === "duda").sort(byPositionThenRank),
    salen: players.filter((i) => i.status === "sale").sort(byPositionThenRank),
    sinPosicion: plan.unplaced,
  };
}

/** Toda la plantilla prevista por líneas (Porteros, Defensas, Medios, Delanteros y «Sin posición»), sin las líneas vacías. */
export function squadByGroup(items) {
  const lines = [...GROUPS.map((g) => ({ group: g, items: items.filter((i) => groupOf(i.position) === g) })), { group: "Sin posición", items: items.filter((i) => !groupOf(i.position)) }];
  return lines.filter((l) => l.items.length).map((l) => ({ ...l, items: [...l.items].sort(byPositionThenRank) }));
}

/** ¿Algún puesto de los dibujados tiene más gente de la que cabe en el PDF? (entonces se añade la plantilla completa) */
export const hasHiddenPeople = (zones, max = PDF_ZONE_ROWS) => zones.some((z) => zoneRows(z.items, max).more > 0);
