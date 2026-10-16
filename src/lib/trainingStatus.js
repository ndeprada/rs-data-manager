import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePlayerMode } from "@/lib/playerMode";

export const TRAINING_TYPES = ["entrenamiento"];

// Entrenamientos ya terminados a los que nadie ha pasado lista (alerta de "sin gestionar").
export function useTrainingStatus() {
  const playerMode = usePlayerMode();
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  return useMemo(() => {
    const pending = new Map();
    if (playerMode) return { pending };
    const now = new Date();
    const withRecords = new Set(attendance.filter((a) => a.event_id).map((a) => a.event_id));
    const legacyDays = new Set(attendance.filter((a) => !a.event_id).map((a) => a.date));
    for (const ev of events) {
      if (!TRAINING_TYPES.includes(ev.type) || !ev.date) continue;
      const end = ev.end_date ? new Date(ev.end_date) : new Date(new Date(ev.date).getTime() + 2 * 3600 * 1000);
      if (end >= now) continue;
      if (withRecords.has(ev.id) || legacyDays.has(String(ev.date).split("T")[0])) continue;
      pending.set(ev.id, ev);
    }
    return { pending };
  }, [events, attendance, playerMode]);
}
