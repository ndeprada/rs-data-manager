// Formato de juego (fútbol 7 / fútbol 11) de un equipo y de sus partidos. UNA sola regla para toda la app:
// en Racing Sarrià se juega a fútbol 7 de Aleví S12 hacia abajo (S12, S11, S10, S9, S8, S7 y Escuela) y a fútbol 11 desde Infantil S13.
// Sin importaciones de la app: la usan también el servidor (sincronización con la FCF, estadísticas de jugadores) y los tests.

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// Nombre del equipo: «Aleví S12 A», «Benjamí S10 B», «Prebenjamí S8», «Escuela»…
const F7_NAME = /^(alevi|benjami|prebenjami|escuela)\b/;
// Categoría de la FCF (si el nombre no lo dice): …_alevin_s12, benjamin_s10, prebenjami_s7, ludica_…, torneig_penyes_…, …_s11, …_f7
const F7_CATEGORY = /(alevin|benjamin|benjami|prebenjami|ludica)|(^|_)s(7|8|9|10|11|12)(_|$)|(^|_)f7(_|$)|torneig_penyes/;

/** ¿Este equipo juega a fútbol 7? (de S12 hacia abajo) */
export function teamPlaysF7(team) {
  if (!team) return false;
  if (F7_NAME.test(norm(team.name))) return true;
  return F7_CATEGORY.test(norm(team.category).replace(/\s+/g, "_"));
}

/**
 * Formato de un partido: "f7" si su equipo es de fútbol 7 (manda la etapa del equipo, no el campo guardado en el partido, que puede venir
 * mal: la sincronización con la FCF marcaba como F11 los partidos de S12) y, si no, el guardado en el partido ("f7" | "f5" | "f11").
 */
export function matchFormat(ev, team) {
  if (teamPlaysF7(team)) return "f7";
  const f = ev?.football_format;
  return f === "f7" || f === "f5" ? f : "f11";
}

/** Jugadores que hacen falta para dar por completa una convocatoria o una alineación. */
export function minPlayersOf(ev, team) {
  const f = matchFormat(ev, team);
  return f === "f7" ? 7 : f === "f5" ? 5 : 11;
}
