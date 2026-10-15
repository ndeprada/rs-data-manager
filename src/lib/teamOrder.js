// Orden único de equipos en toda la app: de mayores a menores
// (Primer Equipo, Juvenil A-D, Cadet S16, S15, Infantil S14, S13, … hasta Prebenjamí S7), y dentro de cada grupo A, B, C…
import { FCF_CATEGORIES } from "@/components/fcfCategories";

const GROUPS = ["Primer Equipo", "Juvenil", "Cadet S16", "Cadet S15", "Infantil S14", "Infantil S13", "Aleví S12", "Aleví S11", "Benjamí S10", "Benjamí S9", "Prebenjamí S8", "Prebenjamí S7", "Escuela"];
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const GROUPS_N = GROUPS.map(norm);

export function teamRank(team) {
  const n = norm(team?.name);
  let i = GROUPS_N.findIndex((g) => n.startsWith(g));
  if (i >= 0) return i;
  const cat = FCF_CATEGORIES.find((c) => c.value === team?.category);
  i = cat ? GROUPS.indexOf(cat.group) : -1;
  return i >= 0 ? i : 99;
}

export function compareTeams(a, b) {
  return teamRank(a) - teamRank(b) || String(a?.name || "").localeCompare(String(b?.name || ""), "es", { numeric: true });
}

export const sortTeams = (teams) => [...(teams || [])].sort(compareTeams);

// En Racing Sarrià, de Aleví S12 hacia abajo (S12…S7, Escuela) se juega Fútbol 7; el Fútbol 11 empieza en Infantil S13.
export const isF7Team = (team) => teamRank(team) >= GROUPS_N.indexOf(norm("Aleví S12")) && teamRank(team) < 99;
