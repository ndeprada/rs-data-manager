// Utilidades de la vista de lista del personal (funciones puras, con tests).

/**
 * Edad y año de nacimiento a partir de una fecha «yyyy-MM-dd» (o ISO). Devuelve null si falta o no es creíble.
 */
export function ageOf(birth, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birth || ""));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age -= 1;
  if (age < 0 || age > 110) return null;
  return { age, year: y };
}

const empty = (v) => v === null || v === undefined || v === "";

/**
 * Ordena filas de la lista por «name» | «age» | «role» | «team» (asc/desc).
 * Los valores vacíos van siempre al final, sea cual sea el sentido. Estable: ante empate, por nombre.
 * Cada fila: { name, age (número|null), roleLabel, teamRank (número|null), teamName }
 */
export function sortStaffRows(rows, key = "name", dir = "asc") {
  const sign = dir === "desc" ? -1 : 1;
  const valueOf = (r) => (key === "age" ? r.age : key === "role" ? r.roleLabel : key === "team" ? r.teamRank : r.name);
  const cmp = (a, b) => {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" });
  };
  return [...rows].sort((x, y) => {
    const a = valueOf(x);
    const b = valueOf(y);
    if (empty(a) && empty(b)) return String(x.name).localeCompare(String(y.name), "es", { sensitivity: "base" });
    if (empty(a)) return 1;
    if (empty(b)) return -1;
    return cmp(a, b) * sign || String(x.name).localeCompare(String(y.name), "es", { sensitivity: "base" });
  });
}
