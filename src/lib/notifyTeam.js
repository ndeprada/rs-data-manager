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

// Texto para el toast tras enviar un aviso
export function pushResultText(r) {
  const n = r?.recipients ?? 0;
  const d = r?.sent ?? 0;
  return `Llegará a ${n} persona${n === 1 ? "" : "s"} (${d} dispositivo${d === 1 ? "" : "s"} con avisos activados).`;
}
