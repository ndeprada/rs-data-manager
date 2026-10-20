import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, ClipboardCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMatchStatus } from "@/lib/matchStatus";
import { useTrainingStatus } from "@/lib/trainingStatus";
import PendingStrip from "@/components/dashboard/PendingStrip";
import BirthdayAlert from "@/components/myteam/BirthdayAlert";
import ScheduleNudge from "@/components/myteam/ScheduleNudge";

// Avisos de arriba del panel "Mi equipo": lo que el entrenador tiene sin gestionar + cumpleaños de la plantilla.
// Es lo primero que se ve al entrar, porque sirve de recordatorio de tareas pendientes.
export default function TeamAlerts({ teamId, players }) {
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { pending } = useMatchStatus();
  const { pending: pendingTr } = useTrainingStatus();

  const items = useMemo(() => {
    const matches = events
      .filter((e) => e.team_id === teamId && pending.has(e.id))
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // el más antiguo primero
    const trainings = [...pendingTr.values()]
      .filter((e) => e.team_id === teamId)
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // el más reciente primero
    const firstMatch = matches[0];
    const matchTab = firstMatch && (pending.get(firstMatch.id) || []).some((r) => /minutos/i.test(r)) ? "acta" : "convocatoria";
    return [
      {
        key: "matches", icon: Trophy, count: matches.length, tone: "#d97706",
        label: matches.length === 1 ? "partido pendiente de gestionar" : "partidos pendientes de gestionar",
        cta: "Gestionar",
        to: matches.length === 1 ? `/MatchDetail?id=${firstMatch.id}&teamId=${firstMatch.team_id}&tab=${matchTab}` : "/MyTeam/Matches",
      },
      {
        key: "trainings", icon: ClipboardCheck, count: trainings.length, tone: "#d97706",
        label: trainings.length === 1 ? "entreno sin gestionar" : "entrenos sin gestionar",
        cta: "Pasar lista",
        to: trainings[0] ? `/MyTeam/Attendance?eventId=${trainings[0].id}` : "/MyTeam/Attendance",
      },
    ];
  }, [events, pending, pendingTr, teamId]);

  return (
    <div className="space-y-2">
      <PendingStrip items={items} />
      <ScheduleNudge teamId={teamId} />
      <BirthdayAlert players={players} />
    </div>
  );
}
