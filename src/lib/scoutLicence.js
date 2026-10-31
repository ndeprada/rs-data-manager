// Licencia de un jugador de scouting: federado (FCF u otra federación) o no federado (escuela, liga escolar, fútbol sala…).
// Lógica pura, sin importaciones de la app (tests en tests/scoutLicence.test.mjs).

export const LICENCE = { federado: "Federado", no_federado: "No federado" };
export const LICENCE_KEYS = ["federado", "no_federado"];

// Dónde juega un no federado
export const PLAYS_IN = {
  escuela: "Escuela / extraescolar",
  consell: "Liga escolar (Consell Esportiu)",
  sala: "Fútbol sala",
  extranjero: "Extranjero",
  sin_equipo: "Sin equipo",
  otro: "Otro",
};
export const PLAYS_IN_KEYS = Object.keys(PLAYS_IN);

// Un jugador vinculado a la FCF es siempre federado; si no, solo es no federado si se ha marcado así
export const licenceOf = (p) => (!p?.fcf_id && p?.licence === "no_federado" ? "no_federado" : "federado");
export const isNonFederated = (p) => licenceOf(p) === "no_federado";

// Texto corto de dónde juega: «Fútbol sala · CE Gràcia», «Escuela / extraescolar», «Sin equipo»…
export function playsInText(p) {
  if (!isNonFederated(p)) return "";
  const where = PLAYS_IN[p.plays_in] || "";
  const club = String(p.current_club || "").trim();
  return [where, club].filter(Boolean).join(" · ") || LICENCE.no_federado;
}

// Datos que se guardan: un federado no lleva «dónde juega»; un no federado no lleva liga ni grupo de federación
export function cleanLicence(data) {
  const out = { ...data };
  const year = String(out.birth_year ?? "").trim();
  out.birth_year = /^\d{4}$/.test(year) ? Number(year) : null;
  if (out.birth_date && out.birth_year && Number(String(out.birth_date).slice(0, 4)) !== out.birth_year) out.birth_year = Number(String(out.birth_date).slice(0, 4));
  if (out.licence !== "no_federado") { out.licence = "federado"; out.plays_in = null; }
  else { out.league_group = ""; if (!PLAYS_IN[out.plays_in]) out.plays_in = null; }
  return out;
}
