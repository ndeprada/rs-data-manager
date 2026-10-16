// Nombre visible de un jugador: "Nombre Apellido1 Apellido2".
// Si tiene apodo, el apodo sustituye al nombre ("Kiku Carcasona Andreu").
// Los datos de la FCF (first_name / last_name) no se tocan: la sincronización sigue usándolos.
export const playerFirstName = (p) => ((p?.nickname || "").trim() || (p?.first_name || "").trim());
export const playerFullName = (p) => `${playerFirstName(p)} ${(p?.last_name || "").trim()}`.trim();
// Texto para buscadores: incluye nombre real, apodo y apellidos.
export const playerSearchName = (p) => `${p?.first_name || ""} ${p?.nickname || ""} ${p?.last_name || ""}`;
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Búsqueda por palabras: sin mayúsculas ni tildes, en cualquier orden y sin importar el apodo.
// "javi gar" encuentra a "Javier García"; "garcia javier" también.
export const matchesPlayerSearch = (p, q) => {
  const hay = `${norm(playerSearchName(p))} ${norm(playerFullName(p))}`;
  return norm(q).split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
};
