import { format } from "date-fns";
import { es } from "date-fns/locale";
import { playerFullName } from "./playerName.js";
import { msg } from "../i18n/translate.js";

// Mensaje de la convocatoria para pegar en el grupo de WhatsApp, y orden de los jugadores por posición (porteros, defensas,
// centrocampistas, delanteros) que usan tanto la pestaña Convocatoria como el aviso. El mensaje va siempre en español.

export const POSITION_GROUP = {
  portero: msg("Porteros"),
  central: msg("Defensas"), libre: msg("Defensas"), lateral: msg("Defensas"),
  mediocentro: msg("Centrocampistas"), interior: msg("Centrocampistas"), mediapunta: msg("Centrocampistas"),
  extremo: msg("Delanteros"), delantero_centro: msg("Delanteros"),
};
export const GROUP_ORDER = [msg("Porteros"), msg("Defensas"), msg("Centrocampistas"), msg("Delanteros"), msg("Sin posición")];
// Orden exacto dentro de cada grupo
export const POSITION_ORDER = {
  Porteros: ["portero"],
  Defensas: ["central", "libre", "lateral"],
  Centrocampistas: ["mediocentro", "interior", "mediapunta"],
  Delanteros: ["extremo", "delantero_centro"],
};
const NO_POSITION = "Sin posición";

/** Dorsal de un jugador como texto ("" si no tiene) */
export const dorsalOf = (p) => (p?.jersey_number ? String(p.jersey_number).trim() : "");

/** Jugadores agrupados por posición, en el orden del club: [{ group, players }]. Dentro de cada grupo, por posición y luego apellido. */
export function groupPlayers(players) {
  const by = new Map();
  for (const p of players || []) {
    const g = POSITION_GROUP[p?.position] || NO_POSITION;
    if (!by.has(g)) by.set(g, []);
    by.get(g).push(p);
  }
  return GROUP_ORDER.filter((g) => by.has(g)).map((group) => {
    const order = POSITION_ORDER[group] || [];
    const rank = (p) => { const i = order.indexOf(p.position); return i === -1 ? 99 : i; };
    const players = by.get(group).slice().sort((a, b) => rank(a) - rank(b) || String(a.last_name || "").localeCompare(String(b.last_name || "")));
    return { group, players };
  });
}

// «7 · Pablo García»; sin dorsal, «• Pablo García»
const playerLine = (p) => { const d = dorsalOf(p); return d ? `${d} · ${playerFullName(p)}` : `• ${playerFullName(p)}`; };

// Una lista (convocados o no convocados) por posición. Si nadie tiene posición no se pintan los títulos de grupo.
function section(title, list) {
  if (!list?.length) return [];
  const groups = groupPlayers(list);
  const titles = groups.length > 1 || groups[0].group !== NO_POSITION;
  // una línea en blanco entre una posición y la siguiente para que se distingan
  return ["", `*${title} (${list.length}):*`, ...groups.flatMap(({ group, players }, i) => [...(i > 0 ? [""] : []), ...(titles ? [`_${group}_`] : []), ...players.map(playerLine)])];
}

/** Líneas de «Observaciones»: 👕 equipación que deben traer y ℹ️ información extra; solo las que estén escritas. */
export function observationLines({ kit = "", info = "" } = {}) {
  const k = String(kit || "").trim(), i = String(info || "").trim();
  return [k && `👕 ${k}`, i && `ℹ️ ${i}`].filter(Boolean);
}

/**
 * event · team · convocados · noConvocados (listas de jugadores) · callupTime ("HH:mm")
 * kit   equipación que deben traer (👕)      info   cualquier otra información (ℹ️)
 */
export function buildConvocationText({ event, team, convocados = [], noConvocados = [], callupTime = "", kit = "", info = "" }) {
  const date = event?.date ? new Date(event.date) : null;
  const day = date ? format(date, "EEEE d 'de' MMMM", { locale: es }) : "";
  const time = date ? format(date, "HH:mm") : "";
  // Partido (con rival): «🏠 Jugamos en casa · Campo» o «✈️ Jugamos fuera · Campo» (como en el resto de la app, sin dato = casa);
  // sin rival (torneo, evento…) solo el campo. El enlace del mapa, si lo hay, va en su línea.
  const where = [event?.location, event?.location_url].filter(Boolean).join(" · ");
  const place = event?.opponent
    ? [[event.is_home === false ? "✈️ Jugamos fuera" : "🏠 Jugamos en casa", event.location].filter(Boolean).join(" · "), event.location_url ? `📍 ${event.location_url}` : ""]
    : [where && `📍 ${where}`];
  const obs = observationLines({ kit, info });
  const lines = [
    `*CONVOCATORIA · ${team?.name || ""}*`,
    event?.opponent ? `🆚 ${event.opponent}` : (event?.title ? `🏆 ${event.title}` : ""),
    `📅 ${day}`,
    `⏰ Partido: ${time}${callupTime ? ` · Convocatoria: ${callupTime}` : ""}`,
    ...place,
  ].filter(Boolean);
  lines.push(
    ...section("✅ Convocados", convocados),
    ...section("❌ No convocados", noConvocados),
    ...(obs.length ? ["", "*Observaciones:*", ...obs] : []),
  );
  return lines.filter((l, i) => l !== "" || lines[i - 1] !== "").join("\n").trim();
}
