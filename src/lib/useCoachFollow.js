// Datos del seguimiento del personal (pantalla Personal y pestaña «Resumen» de la ficha del entrenador, 13/11/2026).
// Las sesiones se piden ligeras (solo fecha, equipo y partido de los últimos 30 días): no hace falta bajar sus tareas ni dibujos.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useMatchStatus } from "@/lib/matchStatus";
import { useGoalsBehindByTeam } from "@/lib/useParticipation";
import { isCancelled } from "@/lib/eventCancel";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { quarterRange } from "@/lib/coachQuarters";
import { teamFollow } from "@/lib/coachOverview";

const seasonFrom = () => quarterRange(CURRENT_SEASON, "all").from;

/** `admin` = coordinación y dirección (ve sesiones, ausencias y multas); `staffId` = solo los datos de esa persona */
export function useCoachFollow({ admin = false, staffIds = null } = {}) {
  const one = staffIds && staffIds.length === 1 ? { staff_id: staffIds[0] } : {};
  const key = staffIds ? staffIds.join("|") : "all";
  const { data: feedback = [] } = useQuery({ queryKey: ["coachFollow", "feedback", key], queryFn: () => base44.entities.CoachFeedback.pick(["date", "area", "tone", "progress", "text", "team_id"], one, { gte: { date: seasonFrom() } }) });
  const { data: obs = [] } = useQuery({ queryKey: ["coachFollow", "obs", key], queryFn: () => base44.entities.CoachSessionObs.pick(["date", "area", "scores", "game_format"], one, { gte: { date: seasonFrom() } }) });
  const { data: closes = [] } = useQuery({ queryKey: ["coachFollow", "closes", key], queryFn: () => base44.entities.CoachQuarterClose.filter(one) });
  const since = format(new Date(Date.now() - 31 * 86400000), "yyyy-MM-dd");
  const { data: sessions = [], isFetched: sessionsReady } = useQuery({
    queryKey: ["coachFollow", "sessions", since], enabled: admin,
    queryFn: () => base44.entities.CoachSession.pick(["date", "team_id", "event_id"], {}, { gte: { date: since } }),
  });
  const { data: absences = [] } = useQuery({ queryKey: ["coachAbsences"], enabled: admin, queryFn: () => base44.entities.CoachAbsence.list("-date") });
  const { data: fines = [] } = useQuery({ queryKey: ["coachFines"], enabled: admin, queryFn: () => base44.entities.CoachFine.list("-date") });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { pending, events } = useMatchStatus();
  const behind = useGoalsBehindByTeam();

  // Varias personas pueden llevar el mismo equipo: el seguimiento de cada equipo se calcula una vez
  const follow = useMemo(() => {
    const now = new Date();
    const pendingIds = new Set(pending.keys());
    const cache = new Map();
    return (teamId) => {
      if (!cache.has(teamId)) cache.set(teamId, teamFollow({ teamId, events, attendance, sessions, pendingIds, now, cancelled: isCancelled }));
      return cache.get(teamId);
    };
  }, [events, attendance, sessions, pending]);

  // Si se usa en una ficha, solo lo de esa persona (las listas generales ya vienen filtradas por la consulta)
  const mine = (list) => (staffIds ? list.filter((x) => staffIds.includes(x.staff_id)) : list);
  return { feedback, obs, closes, sessions, sessionsReady, absences: mine(absences), fines: mine(fines), events, behind, follow };
}
