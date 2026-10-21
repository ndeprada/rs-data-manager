// Textos de los avisos al móvil cuando se cancela algo (un evento o varios días de golpe).
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cancelReasonLabel, isMatchType } from "./eventCancel.js";

// Nombre corto de cada tipo de evento y su género, para concordar «cancelado/cancelada»
const NOUN = {
  entrenamiento: ["entreno", "m"], entrenamiento_fisico: ["entreno físico", "m"], sesion_teorica: ["sesión teórica", "f"], sesion_video: ["sesión de vídeo", "f"],
  partido_liga: ["partido", "m"], partido_amistoso: ["partido amistoso", "m"], torneo: ["torneo", "m"],
  reunion_equipo: ["reunión", "f"], reunion_jugador: ["reunión", "f"], reunion_capitanes: ["reunión", "f"],
  stage: ["stage", "m"], concentracion: ["concentración", "f"], cena_equipo: ["cena", "f"], comida_equipo: ["comida", "f"], evento_club: ["evento", "m"],
};

const day = (d) => format(new Date(d), "EEEE d MMM", { locale: es });
const reasonText = (reason) => {
  const label = cancelReasonLabel({ cancel_reason: reason });
  return reason && reason !== "otro" && label ? ` Motivo: ${label.toLowerCase()}.` : "";
};

// Aviso por un evento concreto. group = true cuando se cancela el mismo evento en todos los equipos.
export function cancelNotice(ev, { teamName = "", reason = ev?.cancel_reason, group = false } = {}) {
  const [noun, gender] = NOUN[ev?.type] || ["evento", "m"];
  const match = isMatchType(ev?.type);
  const word = (match ? "suspendid" : "cancelad") + (gender === "f" ? "a" : "o");
  const what = match && ev?.opponent ? `${noun} contra ${ev.opponent}` : noun;
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const verb = match ? "se suspende" : "se cancela";
  const article = gender === "f" ? "la" : "el";
  const when = ev?.date ? ` del ${day(ev.date)} a las ${format(new Date(ev.date), "HH:mm")}` : "";
  const prefix = !group && teamName ? `${teamName}: ` : "";
  const sentence = `${verb} ${article} ${what}${when}.${reasonText(reason)}`;
  return { title: `${cap(noun)} ${word}`, body: prefix + (prefix ? sentence : cap(sentence)) };
}

// Aviso por una cancelación de varios días: «No habrá entrenos del viernes 31 oct al domingo 2 nov»
export function bulkNotice({ from, to, reason, includeMatches = false }) {
  const range = from === to ? `el ${day(from)}` : `del ${day(from)} al ${day(to)}`;
  return {
    title: includeMatches ? "Entrenos y partidos cancelados" : "Entrenos cancelados",
    body: includeMatches
      ? `Se cancelan los entrenos y partidos ${range}.${reasonText(reason)}`
      : `No habrá entrenos ${range}.${reasonText(reason)}`,
  };
}
