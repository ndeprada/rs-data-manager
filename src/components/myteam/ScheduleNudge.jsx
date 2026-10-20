import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { isCancelled } from "@/lib/eventCancel";
import CreateEventDialog from "@/components/myteam/CreateEventDialog";

const TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico", "sesion_teorica", "sesion_video"];

// Junio y julio: fuera de temporada, no tiene sentido pedir el horario
const offSeason = (now = new Date()) => now.getMonth() === 5 || now.getMonth() === 6;

/**
 * Aviso para quien gestiona el equipo cuando no hay ningún entrenamiento programado a partir de hoy:
 * invita a crear el horario semanal y abre el alta de evento ya como «recurrente».
 */
export default function ScheduleNudge({ teamId }) {
  const { canManageTeam, coachTeamIds } = useTeamAccess();
  const [open, setOpen] = useState(false);
  const { data: events = [], isSuccess } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });

  const hasUpcoming = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return events.some((e) => e.team_id === teamId && TRAINING_TYPES.includes(e.type) && !isCancelled(e) && e.date && new Date(e.date) >= today);
  }, [events, teamId]);

  if (!isSuccess || !teamId || hasUpcoming || offSeason() || !canManageTeam(teamId)) return null;
  const mine = (coachTeamIds || []).includes(teamId);

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 bg-white border border-gray-200" style={{ borderRadius: "6px", borderLeft: "3px solid var(--naranja)" }}>
        <CalendarPlus className="w-5 h-5 shrink-0" style={{ color: "var(--naranja)" }} />
        <p className="flex-1 min-w-[200px] text-sm text-gray-700">
          <span className="font-bold text-gray-900">{mine ? "Crea tu horario semanal." : "Este equipo no tiene horario semanal."}</span>{" "}
          {mine ? "Aún no tienes entrenamientos programados: créalos una vez y se repiten cada semana." : "No hay entrenamientos programados a partir de hoy."}
        </p>
        <button type="button" onClick={() => setOpen(true)}
          className="h-8 px-3 text-xs font-bold rounded-md text-white shrink-0" style={{ background: "var(--granate)" }}>
          Crear horario semanal →
        </button>
      </div>
      <CreateEventDialog open={open} onOpenChange={setOpen} date={new Date()} teamId={teamId} startRecurring />
    </>
  );
}
