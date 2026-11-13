import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useMatchStatus, STAT_SCOPES } from "@/lib/matchStatus";
import { buildContext, rulesOf, participationOf } from "@/lib/participation";
import { goalsOf, goalsFor, playerGoals, goalsBehind, seasonPace } from "@/lib/participationGoals";

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

// Jugadores por detrás del ritmo de sus objetivos de participación (liga), por equipo: Map teamId → n.
// Mismo cálculo que Estadísticas → Jugadores (lo usa la pantalla Personal para la columna «Objetivos»).
export function useGoalsBehindByTeam() {
  const ctx = useParticipationContext("liga");
  const { goals } = useMinutesRules();
  const { events } = useMatchStatus();
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  return useMemo(() => {
    const now = new Date();
    const out = new Map();
    const goalsOfTeam = new Map(teams.map((tm) => [tm.id, goalsFor(tm, goals)]));
    const pace = new Map();
    for (const p of players) {
      if (p.status === "baja" || !p.team_id) continue;
      const g = goalsOfTeam.get(p.team_id);
      if (!g) continue;
      if (!pace.has(p.team_id)) pace.set(p.team_id, seasonPace(events, p.team_id, now));
      const part = participationOf(p, { ...ctx, events: ctx.events.filter((e) => e.team_id === p.team_id) });
      if (goalsBehind(playerGoals(part.all, g, { played: part.all.availMatches, remaining: pace.get(p.team_id).remaining }))) out.set(p.team_id, (out.get(p.team_id) || 0) + 1);
    }
    return out;
  }, [players, teams, ctx, goals, events]);
}
