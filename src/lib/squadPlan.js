// Scouting → Planificación (`src/components/scouting/SquadPlanning.jsx`): plantilla prevista de cada equipo para la temporada siguiente.
// Lógica pura y sin importaciones de la app (rutas relativas) para poder probarla en Node (tests/squadPlan.test.mjs).
//
// Cada jugador actual del equipo está «continúa» salvo que alguien marque «duda» o «se va» (solo entonces, o si se le cambia el puesto o se le
// pone una nota, se guarda un `SquadPlanEntry` `kind:"player"`). «Se va» se concreta en baja del club o baja propia (`leave`). Los jugadores de
// Scouting entran al plan como `kind:"scout"`, bien como objetivo (`role:"objetivo"`, cuenta en la plantilla prevista) o bien como jugador
// seguido (`role:"seguido"`, no cuenta). Un puesto a reforzar es una entrada `kind:"need"` (`ref_id` = clave del puesto). Un jugador o un objetivo
// puede estar colocado a mano en otro puesto (`position` y `side` del registro mandan sobre la ficha).
// Pases entre equipos del club (solo dentro del plan: el `team_id` real del jugador no se toca): el registro del jugador lleva `to_team_id` = equipo
// al que pasa. En su equipo sale como «Pasa a X» (estado `pasa`, no cuenta en la plantilla prevista) y en el equipo destino como «Viene de X»
// (cuenta como un jugador más si continúa; `position`/`side` del registro son su puesto en el equipo destino). Quien llega también puede quedar
// como «se va» (baja del club o propia: `status:"sale"` + `leave` en el mismo registro): en el destino sale en rojo, sin contar, y en su equipo
// sigue como «Pasa a X». Se puede pasar un equipo entero de golpe (`bulkPassCandidates` / `bulkPassOps`).
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
/** Estados que se ofrecen a un jugador que pasa a otro equipo desde su propio equipo: sigue en el club (quien llega al destino sí puede «irse»). */
export const PASS_STATUS_KEYS = ["continua", "duda"];
const STATUS_RANK = { continua: 0, duda: 1, pasa: 2, sale: 3 };

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
 *  - pases entre equipos: `teamId` = equipo de este plan y `teams` = [{id, name}] para poner nombre al otro equipo; `entries` trae los registros de este
 *    equipo y también los de otros equipos que pasan a este (`to_team_id === teamId`), y `arrivals` los jugadores que llegan. Un jugador del equipo
 *    con `to_team_id` de otro equipo es una persona `pass:"out"` (estado `pasa`, `passTeam`); uno que llega es `pass:"in"` (`passTeam` = su equipo
 *    de origen, estado continúa o duda, puesto del registro o el de su ficha).
 */
export function buildPlan({ players = [], scouted = [], entries = [], arrivals = [], teams = [], teamId = null } = {}) {
  const entryOfPlayer = new Map();
  const incomingEntries = new Map();
  const scoutEntries = [];
  const needEntries = new Map();
  for (const e of entries) {
    if (e.kind === "scout") scoutEntries.push(e);
    else if (e.kind === "need") { if (zoneByKey(e.ref_id)) needEntries.set(e.ref_id, e); }
    else if (!e.ref_id) continue;
    else if (teamId && e.to_team_id === teamId && e.team_id && e.team_id !== teamId) incomingEntries.set(e.ref_id, e);
    else if (!teamId || !e.team_id || e.team_id === teamId) entryOfPlayer.set(e.ref_id, e);
  }
  const scoutedById = new Map(scouted.map((s) => [s.id, s]));
  const teamRef = (id) => ({ id, name: teams.find((t) => t.id === id)?.name || "otro equipo" });

  const items = [];
  const ownIds = new Set();
  for (const p of players) {
    if (p.status === "baja") continue;
    ownIds.add(p.id);
    const e = entryOfPlayer.get(p.id) || null;
    const common = { key: `p:${p.id}`, kind: "player", id: p.id, entryId: e?.id || null, name: playerFullName(p) || tokenLabel(p), short: tokenLabel(p), year: birthYearOf(p),
      naturalPosition: p.position || null, note: e?.note || "", injured: p.status === "lesionado", source: p };
    if (e?.to_team_id && e.to_team_id !== teamId) { // pasa a otro equipo: en este campo se queda en su puesto de la ficha, sin contar
      items.push({
        ...common, position: p.position || null, side: sideOfLaterality(p.laterality), moved: false, status: "pasa", leave: null,
        pass: "out", passTeam: teamRef(e.to_team_id), passStatus: STATUS[e.status] ? e.status : "continua", passLeave: e.status === "sale" && LEAVE[e.leave] ? e.leave : null,
        passPosition: POSITION_LABEL[e.position] ? e.position : null, passSide: e.side === "l" || e.side === "r" ? e.side : null,
      });
      continue;
    }
    const status = STATUS[e?.status] ? e.status : "continua";
    const moved = !!(e && POSITION_LABEL[e.position]);
    const position = moved ? e.position : p.position || null;
    const side = moved && (e.side === "l" || e.side === "r") ? e.side : sideOfLaterality(p.laterality);
    items.push({ ...common, position, side, moved, status, leave: status === "sale" && LEAVE[e?.leave] ? e.leave : null });
  }
  for (const p of arrivals) { // jugadores de otros equipos que pasan a este (si ya están en el equipo de verdad, no se duplican)
    const e = incomingEntries.get(p.id);
    if (!e || p.status === "baja" || ownIds.has(p.id)) continue;
    const moved = POSITION_LABEL[e.position] ? true : false;
    const status = STATUS[e.status] ? e.status : "continua";
    items.push({
      key: `p:${p.id}`, kind: "player", id: p.id, entryId: e.id || null, name: playerFullName(p) || tokenLabel(p), short: tokenLabel(p), year: birthYearOf(p),
      naturalPosition: p.position || null, note: e.note || "", injured: p.status === "lesionado", source: p,
      position: moved ? e.position : p.position || null,
      side: moved && (e.side === "l" || e.side === "r") ? e.side : sideOfLaterality(p.laterality),
      moved, status, leave: status === "sale" && LEAVE[e.leave] ? e.leave : null, pass: "in", passTeam: teamRef(e.team_id),
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
 * Cuenta de la plantilla prevista: continúan + objetivos. Las dudas, los que se van (con baja del club / baja propia), los que pasan a otro
 * equipo (`pasa`) y los jugadores seguidos van aparte. Los que llegan de otro equipo cuentan como un jugador más (continúa o duda, o baja si
 * se les ha marcado) y los que vienen de verdad (no baja) se anotan además en `llega`. Por grupo de posición y total.
 */
export function summarize(items) {
  const blank = () => ({ continua: 0, duda: 0, sale: 0, club: 0, propia: 0, pasa: 0, llega: 0, objetivo: 0, seguido: 0, prevista: 0 });
  const total = blank();
  const groups = Object.fromEntries(GROUPS.map((g) => [g, blank()]));
  const sinPosicion = blank();
  for (const it of items) {
    const g = groupOf(it.position);
    for (const bucket of [total, g ? groups[g] : sinPosicion]) {
      bucket[it.status] += 1;
      if (it.status === "sale" && it.leave) bucket[it.leave] += 1;
      if (it.pass === "in" && it.status !== "sale") bucket.llega += 1;
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

/**
 * Datos limpios del registro de un jugador del club: «se va» es el único estado con tipo de baja; sin puesto elegido no hay lado. `toTeam` =
 * equipo al que pasa (id), que se guarda en `to_team_id`; `toTeam: null` quita el pase y sin `toTeam` (undefined) no se toca. Quien llega a
 * otro equipo también puede quedar «se va» (baja marcada en el plan del destino).
 */
export function playerPatch({ status, leave, position, side, note, toTeam } = {}) {
  const st = STATUS[status] ? status : "continua";
  const pos = POSITION_LABEL[position] ? position : null;
  const patch = {
    status: st,
    leave: st === "sale" && LEAVE[leave] ? leave : null,
    position: pos,
    side: pos && (side === "l" || side === "r") ? side : null,
    note: String(note || "").trim(),
  };
  if (toTeam !== undefined) patch.to_team_id = toTeam || null;
  return patch;
}

/** ¿El registro de un jugador no dice nada (continúa, sin puesto cambiado, sin nota ni pase)? Entonces no hace falta guardarlo (o se borra). */
export const isBlankPlayerPatch = (p) => p.status === "continua" && !p.position && !p.note && !p.to_team_id;

/**
 * Todo lo que hay que guardar al colocar a alguien en un puesto: {kind:"scout", patch} (cambia su registro) o {kind:"player", patch, blank}
 * (registro completo de un jugador; si `blank`, ya no dice nada y se borra o no se crea).
 */
export function moveChange(item, zone) {
  const mv = movePatch(item, zone);
  if (item.kind === "scout") return { kind: "scout", patch: mv };
  const patch = playerPatch({ status: item.pass === "out" ? item.passStatus || item.status : item.status, leave: item.leave ?? item.passLeave, note: item.note, ...mv });
  return { kind: "player", patch, blank: !item.pass && isBlankPlayerPatch(patch) }; // un jugador con pase nunca queda «en blanco»: el pase sigue en su registro
}

/** Los registros del plan tal y como quedarán al colocar a `item` en `zone`: sirve para pintar el cambio al instante, antes de que conteste el servidor. */
export function withMovedItem(entries, item, zone) {
  const ch = moveChange(item, zone);
  if (ch.kind === "scout") return entries.map((e) => (e.id === item.entryId ? { ...e, ...ch.patch } : e));
  const mine = (e) => e.kind !== "scout" && e.kind !== "need" && e.ref_id === item.id;
  if (ch.blank) return entries.filter((e) => !mine(e));
  if (entries.some(mine)) return entries.map((e) => (mine(e) ? { ...e, ...ch.patch } : e)); // conserva lo demás del registro (equipo, pase…)
  return [...entries, { id: item.entryId || `tmp-${item.id}`, kind: "player", ref_id: item.id, ...ch.patch }];
}

// ── PDF del campograma (`src/lib/squadPlanPdf.js`) ──────────────────────────────────────────────────────────────────────────
const POS_INDEX = Object.fromEntries(POSITIONS.map((p, i) => [p, i]));
const byPositionThenRank = (a, b) => (POS_INDEX[a.position] ?? 99) - (POS_INDEX[b.position] ?? 99) || rankOf(a) - rankOf(b)
  || (a.year || 9999) - (b.year || 9999) || a.name.localeCompare(b.name, "es");

/** Texto del pase de una persona: «Pasa a Juvenil B» o «Viene de Cadete A» (cadena vacía si no hay pase). */
export const passText = (it) => (it?.pass === "out" ? `Pasa a ${it.passTeam.name}` : it?.pass === "in" ? `Viene de ${it.passTeam.name}` : "");

/** «Continúa», «Duda», «Baja del club», «Baja propia», «Se va» (sin concretar), «Pasa a X», «Continúa · viene de X», «Objetivo» o «Seguido». */
export function statusLabel(it) {
  if (it.kind === "scout") return it.status === "seguido" ? "Seguido" : "Objetivo";
  if (it.pass === "out") return it.passStatus === "sale" ? `${passText(it)} · ${(LEAVE[it.passLeave]?.label || STATUS.sale.label).toLowerCase()}` : passText(it);
  if (it.status === "sale") {
    const label = LEAVE[it.leave]?.label || STATUS.sale.label;
    return it.pass === "in" ? `${label} · viene de ${it.passTeam.name}` : label;
  }
  const base = STATUS[it.status]?.label || STATUS.continua.label;
  return it.pass === "in" ? `${base} · viene de ${it.passTeam.name}` : base;
}

/** Listas aparte del PDF: objetivos, jugadores seguidos, dudas, los que se van, los pases entre equipos, los que no tienen posición y los puestos a reforzar. */
export function pdfLists(plan) {
  const players = plan.items.filter((i) => i.kind === "player");
  const scouts = plan.items.filter((i) => i.kind === "scout");
  return {
    objetivos: scouts.filter((i) => i.status === "objetivo").sort(byPositionThenRank),
    seguidos: scouts.filter((i) => i.status === "seguido").sort(byPositionThenRank),
    dudas: players.filter((i) => i.status === "duda").sort(byPositionThenRank),
    salen: players.filter((i) => i.status === "sale").sort((a, b) => (a.leave === b.leave ? 0 : a.leave === "club" ? -1 : b.leave === "club" ? 1 : 0) || byPositionThenRank(a, b)),
    pases: [...players.filter((i) => i.pass === "in"), ...players.filter((i) => i.pass === "out")].sort((a, b) => (a.pass === b.pass ? 0 : a.pass === "in" ? -1 : 1) || byPositionThenRank(a, b)),
    sinPosicion: plan.unplaced,
    refuerzos: plan.needs || [],
  };
}

/**
 * Resumen de los pases de todo el club (solo lectura): de qué equipo sale cada jugador y a cuál va.
 *  - entries: `SquadPlanEntry` de jugadores de la temporada; players: jugadores del club; teams: equipos (para los nombres y el orden).
 *  - rows: un pase por jugador {key, id, entryId, name, year, position, side, placeLabel, status:"continua"|"duda", note, from, to};
 *  - groups: un grupo por pareja origen → destino, ordenados por equipo y, dentro, por puesto: {from, to, rows};
 *  - teams: los equipos que intervienen (en el orden de `teams`), `matrix` = nº de pases por [origen][destino], `total`.
 * Se ignoran los jugadores que ya no existen o están de baja, los pases marcados como baja en el destino y los registros cuyo destino es el mismo equipo.
 */
export function buildPassSummary({ entries = [], players = [], teams = [] } = {}) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const teamRef = (id) => ({ id, name: teams.find((t) => t.id === id)?.name || "Otro equipo" });
  const seen = new Set();
  const rows = [];
  for (const e of entries) {
    if (e.kind !== "player" || !e.ref_id || !e.to_team_id || !e.team_id || e.to_team_id === e.team_id || seen.has(e.ref_id)) continue;
    if (e.status === "sale") continue; // marcado como baja en el plan del destino: ya no es un pase
    const p = byId.get(e.ref_id);
    if (!p || p.status === "baja") continue;
    seen.add(e.ref_id);
    const placed = !!POSITION_LABEL[e.position];
    const position = placed ? e.position : p.position || null;
    const side = placed && (e.side === "l" || e.side === "r") ? e.side : null;
    const zone = zoneByKey(zoneKeyOf(position, side));
    rows.push({
      key: `p:${p.id}`, id: p.id, entryId: e.id || null, name: playerFullName(p) || tokenLabel(p), year: birthYearOf(p), position, side,
      placeLabel: zone && side ? zoneTitle(zone) : POSITION_LABEL[position] || "Sin posición",
      status: e.status === "duda" ? "duda" : "continua", note: e.note || "", from: teamRef(e.team_id), to: teamRef(e.to_team_id),
    });
  }
  const teamIds = new Set(rows.flatMap((r) => [r.from.id, r.to.id]));
  const order = (id) => { const i = teams.findIndex((t) => t.id === id); return i < 0 ? 999 : i; };
  const involved = [...teamIds].map(teamRef).sort((a, b) => order(a.id) - order(b.id) || a.name.localeCompare(b.name, "es"));
  const matrix = {};
  const pairs = new Map();
  for (const r of rows) {
    matrix[r.from.id] = matrix[r.from.id] || {};
    matrix[r.from.id][r.to.id] = (matrix[r.from.id][r.to.id] || 0) + 1;
    const k = `${r.from.id}>${r.to.id}`;
    if (!pairs.has(k)) pairs.set(k, { from: r.from, to: r.to, rows: [] });
    pairs.get(k).rows.push(r);
  }
  const groups = [...pairs.values()]
    .sort((a, b) => order(a.from.id) - order(b.from.id) || order(a.to.id) - order(b.to.id) || a.from.name.localeCompare(b.from.name, "es") || a.to.name.localeCompare(b.to.name, "es"))
    .map((g) => ({ ...g, rows: [...g.rows].sort((a, b) => (POS_INDEX[a.position] ?? 99) - (POS_INDEX[b.position] ?? 99) || (a.year || 9999) - (b.year || 9999) || a.name.localeCompare(b.name, "es")) }));
  return { rows, groups, teams: involved, matrix, total: rows.length };
}

// ── Pasar un equipo entero a otro ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * Jugadores del plan de un equipo que se pueden pasar de golpe a otro (los que llegan de otros equipos no cuentan: no son de este equipo).
 * Una fila por jugador, por puestos: {id, entryId, name, year, position, status, leave, note, passTeam (equipo al que ya pasa o null), already
 * (ya pasa a `toTeamId`), checked (propuesta inicial)}. Vienen marcados los que continúan o dudan; sin marcar los que se van y los que ya pasan
 * a otro equipo, y `already` no se puede volver a pasar.
 */
export function bulkPassCandidates(plan, toTeamId = null) {
  return [...(plan?.items || [])]
    .filter((i) => i.kind === "player" && i.pass !== "in")
    .sort(byPositionThenRank)
    .map((i) => {
      const out = i.pass === "out";
      const already = out && !!toTeamId && i.passTeam.id === toTeamId;
      return {
        id: i.id, entryId: i.entryId || null, name: i.name, year: i.year, position: i.position, status: out ? i.passStatus : i.status,
        leave: out ? i.passLeave || null : i.leave || null, note: i.note || "", passTeam: out ? i.passTeam : null, already,
        checked: !out && (i.status === "continua" || i.status === "duda"),
      };
    });
}

/**
 * Lo que hay que guardar para pasar a `selectedIds` a `toTeamId`: una operación por jugador, {entryId, ref_id, patch}. Con `entryId` se actualiza
 * su registro y sin él se crea uno nuevo. Pasa como «continúa» (o «duda» si ya dudaba), sin baja y sin puesto propio en el destino (se coloca
 * por su ficha); la nota se conserva. Se saltan los que ya pasan a ese mismo equipo y los ids que no están entre los candidatos.
 */
export function bulkPassOps(candidates, selectedIds, toTeamId) {
  if (!toTeamId) return [];
  const chosen = new Set(selectedIds);
  return candidates.filter((c) => chosen.has(c.id) && !c.already).map((c) => ({
    entryId: c.entryId, ref_id: c.id,
    patch: { to_team_id: toTeamId, status: c.status === "duda" ? "duda" : "continua", leave: null, position: null, side: null },
  }));
}

/** Toda la plantilla prevista por líneas (Porteros, Defensas, Medios, Delanteros y «Sin posición»), sin las líneas vacías. */
export function squadByGroup(items) {
  const lines = [...GROUPS.map((g) => ({ group: g, items: items.filter((i) => groupOf(i.position) === g) })), { group: "Sin posición", items: items.filter((i) => !groupOf(i.position)) }];
  return lines.filter((l) => l.items.length).map((l) => ({ ...l, items: [...l.items].sort(byPositionThenRank) }));
}

