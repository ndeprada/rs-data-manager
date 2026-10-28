// Año de juvenil (pedido por Nacho el 28/10/2026: «los de primer año en rojo y los de segundo en naranja… para detectarlos sin alerta»).
// La categoría depende solo del año de nacimiento: en 2026-27 los nacidos en 2010 son juveniles de 1.º año, 2009 de 2.º y 2008 de 3.º.
export function juvenilYear(birthYear, season) {
  const end = Number(String(season || "").slice(5, 9));
  const by = Number(birthYear);
  if (!end || !by) return null;
  const n = end - by - 16;
  return n >= 1 && n <= 3 ? n : null;
}

export const JUV_STYLE = {
  1: { label: "1.º año", short: "1.º", bg: "#C62828", fg: "#fff", dot: "#C62828" },
  2: { label: "2.º año", short: "2.º", bg: "#E8590C", fg: "#fff", dot: "#E8590C" },
  3: { label: "3.º año", short: "3.º", bg: "#F3ECEB", fg: "#36000D", dot: "#9A8C8E" },
};
