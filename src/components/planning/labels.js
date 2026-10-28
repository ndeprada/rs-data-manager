// Etiquetas de Planificación → Scouting (solo español, como el resto de Scouting)
import { birthYearOf } from "@/lib/birthYear";
import { playerFullName } from "@/lib/playerName";

export const SCOUT_POSITION = {
  portero: "Portero", central: "Central", lateral: "Lateral", extremo: "Extremo", mediapunta: "Mediapunta",
  libre: "Libre", mediocentro: "Mediocentro", interior: "Interior", delantero_centro: "Delantero centro",
};
export const LATERALITY = { diestro: "Diestro", zurdo: "Zurdo", ambidiestro: "Ambidiestro" };
export const CONTACT = { no_contactado: "Sin contacto", interesado: "Interesado", no_interesado: "No interesado", valorando: "Valorando" };
export const contacted = (p) => !!p?.contact_status && p.contact_status !== "no_contactado";

export const spName = (p) => playerFullName(p) || "Sin nombre";
export const spYear = (p) => birthYearOf(p);
export function spMeta(p) {
  return [spYear(p), p.current_club, SCOUT_POSITION[p.position] || p.position, LATERALITY[p.laterality] || p.laterality].filter(Boolean).join(" · ");
}

// Iniciales de un equipo para su cuadradito («ESCOLA PIA SARRIÀ S.E. "A"» → «EPS»)
export function teamInitials(name) {
  const words = String(name || "").replace(/"[^"]*"/g, "").replace(/[.,]/g, " ").split(/\s+/)
    .filter((w) => w && !/^(DE|DEL|LA|EL|LES|I|Y|C|F|E|S|CE|CF|UD|AT|AE|CD|SE|FC|ESC|CLUB|FUTBOL|ESPORTIU)$/i.test(w));
  return (words.slice(0, 3).map((w) => w[0]).join("") || "··").toUpperCase();
}
export const isRacingTeam = (name) => /RACING SARRI/i.test(String(name || ""));
