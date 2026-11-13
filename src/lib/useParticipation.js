import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useMatchStatus, STAT_SCOPES } from "@/lib/matchStatus";
import { buildContext, rulesOf } from "@/lib/participation";
import { goalsOf } from "@/lib/participationGoals";

// Datos para calcular la participación de los jugadores en los partidos cerrados del tipo elegido
// (liga, torneos o amistosos: los mismos que usan el resto de estadísticas).
// Mínimo de minutos del club y de cada equipo (una sola fila MinutesRule; la cambia coordinación)
export function useMinutesRules() {
  const { data: docs = [], isFetched } = useQuery({ queryKey: ["minutes-rules"], queryFn: () => base44.entities.MinutesRule.list(), staleTime: 5 * 60 * 1000 });
  const doc = docs[0] || null;
  const rules = useMemo(() => rulesOf(doc), [doc]);
  const goals = useMemo(() => goalsOf(doc), [doc]);
  return { doc, rules, goals, isFetched };
}

export function useParticipationContext(scope = "liga") {
  const { rules } = useMinutesRules();
  const { counted, countedOther, events } = useMatchStatus();
  const { data: convocs = [] } = useQuery({ queryKey: ["convocatorias_all"], queryFn: () => base44.entities.Convocatoria.list() });
  const { data: stats = [] } = useQuery({ queryKey: ["matchstats_all"], queryFn: () => base44.entities.MatchStats.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  return useMemo(() => {
    const types = (STAT_SCOPES.find((x) => x.value === scope) || STAT_SCOPES[0]).types;
    const closed = events.filter((e) => types.includes(e.type) && (scope === "liga" ? counted.has(e.id) : countedOther.has(e.id)));
    return buildContext({ events: closed, convocs, stats, teams, rules });
  }, [events, counted, countedOther, convocs, stats, teams, scope, rules]);
}
