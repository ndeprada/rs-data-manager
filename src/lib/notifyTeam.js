import { base44 } from "@/api/base44Client";

// Aviso al móvil (notificación de la app) a todo un equipo: jugadores, familiares y cuerpo técnico.
// Es el canal que funciona hoy; el envío por email no está conectado a ningún servicio.
export async function notifyTeamPush({ teamId, teamName, title, body, url = "/Calendar" }) {
  if (!teamId) throw new Error("Falta el equipo");
  return base44.club.send({
    title: String(title || "").slice(0, 100),
    body: String(body || "").slice(0, 600),
    url,
    audience: { team_ids: [teamId], groups: ["jugadores", "familiares", "tecnico"] },
    audience_label: `${teamName || "Equipo"} · aviso de evento`,
  });
}

// Texto para el toast tras enviar un aviso (t = traductor de la pantalla; sin él sale en español)
const plain = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (_, k) => v[k]) : s);
export function pushResultText(r, t = plain) {
  const n = r?.recipients ?? 0;
  const d = r?.sent ?? 0;
  const people = n === 1 ? t("{n} persona", { n }) : t("{n} personas", { n });
  const devices = d === 1 ? t("{n} dispositivo", { n: d }) : t("{n} dispositivos", { n: d });
  return t("Llegará a {people} ({devices} con avisos activados).", { people, devices });
}

// Aviso al móvil a varios equipos a la vez (o a todo el club si teamIds es null). Solo coordinación puede avisar a otros equipos.
export async function notifyTeamsPush({ teamIds = null, label, title, body, url = "/Calendar" }) {
  if (Array.isArray(teamIds) && teamIds.length === 0) throw new Error("Falta el equipo");
  return base44.club.send({
    title: String(title || "").slice(0, 100),
    body: String(body || "").slice(0, 600),
    url,
    audience: { all_club: !Array.isArray(teamIds), team_ids: Array.isArray(teamIds) ? teamIds : [], groups: ["jugadores", "familiares", "tecnico"] },
    audience_label: label || (Array.isArray(teamIds) ? `${teamIds.length} equipos · aviso de evento` : "Todo el club · aviso de evento"),
  });
}
