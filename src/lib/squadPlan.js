// Scouting → Planificación (`src/components/scouting/SquadPlanning.jsx`): plantilla prevista de cada equipo para la temporada siguiente.
// Lógica pura y sin importaciones de la app (rutas relativas) para poder probarla en Node (tests/squadPlan.test.mjs).
//
// Cada jugador actual del equipo está «continúa» salvo que alguien marque «duda» o «se va» (solo entonces, o si se le cambia el puesto o se le
// pone una nota, se guarda un `SquadPlanEntry` `kind:"player"`). «Se va» se concreta en baja del club o baja propia (`leave`). Los jugadores de
// Scouting entran al plan como `kind:"scout"`, bien como objetivo (`role:"objetivo"`, cuenta en la plantilla prevista) o bien como jugador
// seguido (`role:"seguido"`, no cuenta). Un puesto a reforzar es una entrada `kind:"need"` (`ref_id` = clave del puesto). Un jugador o un objetivo
// puede estar colocado a mano en otro puesto (`position` y `side` del registro mandan sobre la ficha).
// El campograma tiene el ataque hacia la derecha (o hacia arriba en vertical), así que izquierda y derecha son las del equipo.
import { tokenLabel } from "./tacticsBoard.js";
import { playerFullName } from "./playerName.js";

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

/** Quién decide la baja: el club (no renueva) o el propio jugador/familia (se va por su cuenta). Las dos van en rojo. */
export const LEAVE = {
  club: { label: "Baja del club", short: "Club" },
  propia: { label: "Baja propia", short: "Propia" },
};
export const LEAVE_KEYS = ["club", "propia"];

/** Un jugador de Scouting en el plan: objetivo (se quiere fichar, cuenta) o jugador seguido (observado, no cuenta aún). */
export const ROLE = {
  objetivo: { label: "Objetivo de scouting" },
  seguido: { label: "Jugador seguido" },
};
export const ROLE_KEYS = ["objetivo", "seguido"];
const SCOUT_RANK = { objetivo: 10, seguido: 11 };

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

// Puestos del campograma. `line` = línea del campo (0 portero … 5 delanteros) y `lane` = carril del equipo (l izquierda, c centro, r derecha):
// en horizontal la línea es la columna (portería a la izquierda) y el carril la fila (izquierda del equipo arriba); en vertical, al revés.
// `x`, `y`, `w` = colocación en % para el PDF (ataque hacia arriba; esquina superior del puesto).
export const ZONES = [
  { key: "extremo_l", pos: "extremo", side: "l", label: "Ext. izq.", line: 5, lane: "l", x: 15, y: 4, w: 27 },
  { key: "delantero_centro", pos: "delantero_centro", label: "Del. centro", line: 5, lane: "c", x: 50, y: 4, w: 28 },
  { key: "extremo_r", pos: "extremo", side: "r", label: "Ext. dcho.", line: 5, lane: "r", x: 85, y: 4, w: 27 },
  { key: "mediapunta", pos: "mediapunta", label: "Mediapunta", line: 4, lane: "c", x: 50, y: 19, w: 28 },
  { key: "interior_l", pos: "interior", side: "l", label: "Int. izq.", line: 3, lane: "l", x: 15, y: 34, w: 27 },
  { key: "mediocentro", pos: "mediocentro", label: "Mediocentro", line: 3, lane: "c", x: 50, y: 34, w: 28 },
  { key: "interior_r", pos: "interior", side: "r", label: "Int. dcho.", line: 3, lane: "r", x: 85, y: 34, w: 27 },
  { key: "lateral_l", pos: "lateral", side: "l", label: "Lat. izq.", line: 2, lane: "l", x: 14, y: 49, w: 27 },
  { key: "central", pos: "central", label: "Central", line: 2, lane: "c", x: 50, y: 49, w: 28 },
  { key: "lateral_r", pos: "lateral", side: "r", label: "Lat. dcho.", line: 2, lane: "r", x: 86, y: 49, w: 27 },
  { key: "libre", pos: "libre", label: "Libre", line: 1, lane: "c", x: 50, y: 66, w: 28 },
  { key: "portero", pos: "portero", label: "Portero", line: 0, lane: "c", x: 50, y: 82, w: 28 },
];
export const zoneByKey = (key) => ZONES.find((z) => z.key === key) || null;
/** «Lateral izquierdo», «Central», «Delantero centro»… */
export const zoneTitle = (z) => (z ? `${POSITION_LABEL[z.pos]}${z.side ? (z.side === "l" ? " izquierdo" : " derecho") : ""}` : "");
/** Puesto (clave) de una posición y un lado; null si no existe. */
export function zoneKeyOf(position, side) {
  if (!POSITION_LABEL[position]) return null;
  if (hasSides(position)) return side === "l" || side === "r" ? `${position}_${side}` : null;
  return ZONES.find((z) => z.pos === position)?.key || null;
}

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

// Orden de las personas de un puesto: jugadores actuales (continúan → dudas → se van), luego los objetivos y luego los seguidos
const rankOf = (it) => (it.kind === "scout" ? SCOUT_RANK[it.status] ?? 10 : STATUS_RANK[it.status] ?? 0);

/**
 * Plantilla prevista de un equipo: {zones, items, unplaced, needs, summary, orphans}.
 *  - players: jugadores del equipo (los de baja no cuentan); scouted: jugadores de scouting; entries: `SquadPlanEntry` de ese equipo y temporada.
 *  - zones: cada puesto del campograma con sus personas (jugadores actuales primero, por estado, y luego objetivos y seguidos) y, si se ha
 *    marcado a reforzar, `need` = {entryId, note}.
 *  - unplaced: personas sin posición (no caben en el campo); needs: puestos a reforzar; orphans: objetivos cuyo jugador de scouting ya no existe.
 *  - cada persona lleva `zone` (clave de su puesto o null), `moved` (colocada a mano en otro puesto) y, si se va, `leave`.
 */
export function buildPlan({ players = [], scouted = [], entries = [] } = {}) {
  const entryOfPlayer = new Map();
  const scoutEntries = [];
  const needEntries = new Map();
  for (const e of entries) {
    if (e.kind === "scout") scoutEntries.push(e);
    else if (e.kind === "need") { if (zoneByKey(e.ref_id)) needEntries.set(e.ref_id, e); }
    else if (e.ref_id) entryOfPlayer.set(e.ref_id, e);
  }
  const scoutedById = new Map(scouted.map((s) => [s.id, s]));

  const items = [];
  for (const p of players) {
    if (p.status === "baja") continue;
    const e = entryOfPlayer.get(p.id) || null;
    const status = STATUS[e?.status] ? e.status : "continua";
    const moved = !!(e && POSITION_LABEL[e.position]);
    const position = moved ? e.position : p.position || null;
    const side = moved && (e.side === "l" || e.side === "r") ? e.side : sideOfLaterality(p.laterality);
    items.push({
      key: `p:${p.id}`, kind: "player", id: p.id, entryId: e?.id || null, name: playerFullName(p) || tokenLabel(p), short: tokenLabel(p), year: birthYearOf(p),
      position, naturalPosition: p.position || null, side, moved, status, leave: status === "sale" && LEAVE[e?.leave] ? e.leave : null,
      note: e?.note || "", injured: p.status === "lesionado", source: p,
    });
  }
  let orphans = 0;
  for (const e of scoutEntries) {
    const s = scoutedById.get(e.ref_id);
    if (!s) { orphans += 1; continue; }
    const role = e.role === "seguido" ? "seguido" : "objetivo";
    items.push({
      key: `s:${s.id}`, kind: "scout", id: s.id, entryId: e.id || null, name: playerFullName(s) || tokenLabel(s), short: tokenLabel(s), year: birthYearOf(s),
      position: e.position || s.position || null, naturalPosition: s.position || null, side: e.side === "l" || e.side === "r" ? e.side : sideOfLaterality(s.laterality),
      moved: !!(e.position && e.position !== s.position), status: role, role, leave: null,
      decision: s.decision || "", rating: s.rating || 0, club: s.current_club || "", note: e.note || "", source: s,
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
  const zoneKeyOfItem = new Map(sorted.map((it) => [it.key, place(it)]));
  for (const it of items) it.zone = zoneKeyOfItem.get(it.key) || null;

  const order = (a, b) => rankOf(a) - rankOf(b) || (a.year || 9999) - (b.year || 9999) || a.name.localeCompare(b.name, "es");
  const zones = ZONES.map((z) => {
    const n = needEntries.get(z.key);
    return { ...z, items: items.filter((it) => it.zone === z.key).sort(order), need: n ? { entryId: n.id || null, note: n.note || "" } : null };
  });
  const unplaced = items.filter((it) => !it.zone).sort(order);
  return { zones, items, unplaced, needs: zones.filter((z) => z.need), summary: summarize(items), orphans };
}

/**
 * Cuenta de la plantilla prevista: continúan + objetivos. Las dudas, los que se van (con baja del club / baja propia) y los jugadores seguidos
 * van aparte. Por grupo de posición y total.
 */
export function summarize(items) {
  const blank = () => ({ continua: 0, duda: 0, sale: 0, club: 0, propia: 0, objetivo: 0, seguido: 0, prevista: 0 });
  const total = blank();
  const groups = Object.fromEntries(GROUPS.map((g) => [g, blank()]));
  const sinPosicion = blank();
  for (const it of items) {
    const g = groupOf(it.position);
    for (const bucket of [total, g ? groups[g] : sinPosicion]) {
      bucket[it.status] += 1;
      if (it.status === "sale" && it.leave) bucket[it.leave] += 1;
      if (it.status === "continua" || it.status === "objetivo") bucket.prevista += 1;
    }
  }
  return { total, groups, sinPosicion };
}

// ── Guardar cambios en el plan ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Colocar a una persona en otro puesto: lo que se guarda en su registro (`position` y `side`). Un jugador del club que vuelve a su puesto de
 * la ficha no necesita ajuste (null); un objetivo siempre guarda su puesto.
 */
export function movePatch(item, zone) {
  if (item.kind === "scout") return { position: zone.pos, side: zone.side || null };
  const s = item.source || {};
  const natural = zone.pos === s.position && (!zone.side || zone.side === sideOfLaterality(s.laterality));
  return natural ? { position: null, side: null } : { position: zone.pos, side: zone.side || null };
}

/** Datos limpios del registro de un jugador del club: «se va» es el único estado con tipo de baja; sin puesto elegido no hay lado. */
export function playerPatch({ status, leave, position, side, note } = {}) {
  const st = STATUS[status] ? status : "continua";
  const pos = POSITION_LABEL[position] ? position : null;
  return {
    status: st,
    leave: st === "sale" && LEAVE[leave] ? leave : null,
    position: pos,
    side: pos && (side === "l" || side === "r") ? side : null,
    note: String(note || "").trim(),
  };
}

/** ¿El registro de un jugador no dice nada (continúa, sin puesto cambiado ni nota)? Entonces no hace falta guardarlo (o se borra). */
export const isBlankPlayerPatch = (p) => p.status === "continua" && !p.position && !p.note;

/**
 * Todo lo que hay que guardar al colocar a alguien en un puesto: {kind:"scout", patch} (cambia su registro) o {kind:"player", patch, blank}
 * (registro completo de un jugador; si `blank`, ya no dice nada y se borra o no se crea).
 */
export function moveChange(item, zone) {
  const mv = movePatch(item, zone);
  if (item.kind === "scout") return { kind: "scout", patch: mv };
  const patch = playerPatch({ status: item.status, leave: item.leave, note: item.note, ...mv });
  return { kind: "player", patch, blank: isBlankPlayerPatch(patch) };
}

/** Los registros del plan tal y como quedarán al colocar a `item` en `zone`: sirve para pintar el cambio al instante, antes de que conteste el servidor. */
export function withMovedItem(entries, item, zone) {
  const ch = moveChange(item, zone);
  if (ch.kind === "scout") return entries.map((e) => (e.id === item.entryId ? { ...e, ...ch.patch } : e));
  const rest = entries.filter((e) => !(e.kind !== "scout" && e.kind !== "need" && e.ref_id === item.id));
  if (ch.blank) return rest;
  return [...rest, { id: item.entryId || `tmp-${item.id}`, kind: "player", ref_id: item.id, ...ch.patch }];
}

// ── PDF del campograma (`src/lib/squadPlanPdf.js`) ──────────────────────────────────────────────────────────────────────────
const POS_INDEX = Object.fromEntries(POSITIONS.map((p, i) => [p, i]));
const byPositionThenRank = (a, b) => (POS_INDEX[a.position] ?? 99) - (POS_INDEX[b.position] ?? 99) || rankOf(a) - rankOf(b)
  || (a.year || 9999) - (b.year || 9999) || a.name.localeCompare(b.name, "es");

/** «Continúa», «Duda», «Baja del club», «Baja propia», «Se va» (sin concretar), «Objetivo» o «Seguido». */
export function statusLabel(it) {
  if (it.kind === "scout") return it.status === "seguido" ? "Seguido" : "Objetivo";
  if (it.status === "sale") return LEAVE[it.leave]?.label || STATUS.sale.label;
  return STATUS[it.status]?.label || STATUS.continua.label;
}

/** Listas aparte del PDF: objetivos, jugadores seguidos, dudas, los que se van, los que no tienen posición y los puestos a reforzar. */
export function pdfLists(plan) {
  const players = plan.items.filter((i) => i.kind === "player");
  const scouts = plan.items.filter((i) => i.kind === "scout");
  return {
    objetivos: scouts.filter((i) => i.status === "objetivo").sort(byPositionThenRank),
    seguidos: scouts.filter((i) => i.status === "seguido").sort(byPositionThenRank),
    dudas: players.filter((i) => i.status === "duda").sort(byPositionThenRank),
    salen: players.filter((i) => i.status === "sale").sort((a, b) => (a.leave === b.leave ? 0 : a.leave === "club" ? -1 : b.leave === "club" ? 1 : 0) || byPositionThenRank(a, b)),
    sinPosicion: plan.unplaced,
    refuerzos: plan.needs || [],
  };
}

/** Toda la plantilla prevista por líneas (Porteros, Defensas, Medios, Delanteros y «Sin posición»), sin las líneas vacías. */
export function squadByGroup(items) {
  const lines = [...GROUPS.map((g) => ({ group: g, items: items.filter((i) => groupOf(i.position) === g) })), { group: "Sin posición", items: items.filter((i) => !groupOf(i.position)) }];
  return lines.filter((l) => l.items.length).map((l) => ({ ...l, items: [...l.items].sort(byPositionThenRank) }));
}

