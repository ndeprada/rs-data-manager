// Ayudas de presentación de las sesiones (fechas y posiciones)

const DAY = ["D", "L", "M", "X", "J", "V", "S"];
const DAY_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const parse = (d) => {
  const x = new Date(`${d}T12:00:00`);
  return Number.isNaN(x.getTime()) ? null : x;
};

// «X 21-10-26»
export function shortDate(d) {
  const x = parse(d);
  if (!x) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${DAY[x.getDay()]} ${p(x.getDate())}-${p(x.getMonth() + 1)}-${String(x.getFullYear()).slice(2)}`;
}

// «miércoles 21/10»
export function longDate(d) {
  const x = parse(d);
  if (!x) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${DAY_LONG[x.getDay()]} ${p(x.getDate())}/${p(x.getMonth() + 1)}`;
}

export const todayStr = () => {
  const n = new Date();
  const p = (v) => String(v).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
};

const POS = { portero: ["POR", 0], lateral: ["LAT", 1], central: ["CEN", 2], mediocentro: ["MC", 3], interior: ["INT", 4], mediapunta: ["MP", 5], extremo: ["EXT", 6], delantero_centro: ["DC", 7], libre: ["LIB", 8] };
export const posShort = (p) => POS[p]?.[0] || "";
export const posOrder = (p) => POS[p]?.[1] ?? 9;

export const playerShortName = (p) => (p?.nickname || p?.first_name || "").trim() || `${p?.last_name || ""}`.trim();
export const playerFullName = (p) => `${p?.first_name || ""} ${p?.last_name || ""}`.trim();

// Jugadores en el orden de la ficha: por posición y, dentro de ella, por nombre
export function sortRoster(players) {
  return [...players].sort((a, b) => posOrder(a.position) - posOrder(b.position) || playerShortName(a).localeCompare(playerShortName(b), "es"));
}

// «Congrès (Casa) | Sáb. 24 | 16:30h» a partir de un partido del calendario (fecha local «yyyy-MM-ddTHH:mm»)
export function matchRefOf(ev) {
  if (!ev) return "";
  const d = parse(String(ev.date || "").slice(0, 10));
  if (!d) return "";
  const time = String(ev.date).slice(11, 16);
  const day = ["Dom.", "Lun.", "Mar.", "Mié.", "Jue.", "Vie.", "Sáb."][d.getDay()];
  const rival = ev.opponent || ev.title || "Partido";
  const side = ev.is_home === false ? "Fuera" : ev.is_home === true ? "Casa" : "";
  return `${rival}${side ? ` (${side})` : ""} | ${day} ${d.getDate()}${time ? ` | ${time}h` : ""}`;
}
