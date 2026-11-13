// Filas de la plantilla de un equipo (datos del jugador + estadísticas de sus partidos + entrenos + lesiones).
// Lo usan la tabla completa (TeamSquadTable) y la plantilla compacta de Mi equipo.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { birthYearOf } from "@/lib/birthYear";
import { useMatchStatus } from "@/lib/matchStatus";
import { participationOf, playerLevel } from "@/lib/participation";
import { useParticipationContext } from "@/lib/useParticipation";
import { eventMinutes } from "@/lib/matchDuration";

export function useSquadRows(teamId) {
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: allStats = [] } = useQuery({ queryKey: ["matchstats_all"], queryFn: () => base44.entities.MatchStats.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance_all"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries_all"], queryFn: () => base44.entities.Injury.list() });

  const { counted } = useMatchStatus();
  // Participación (minutos disponibles) solo en los partidos de este equipo, igual que el resto de columnas
  const partCtx = useParticipationContext("liga");
  const teamCtx = useMemo(() => ({ ...partCtx, events: partCtx.events.filter((e) => e.team_id === teamId) }), [partCtx, teamId]);
  const { rows, guests } = useMemo(() => {
    const now = new Date();
    const team = teams.find((t) => t.id === teamId);
    const matchMinutes = (ev) => eventMinutes(ev, team);   // la duración del partido, o la habitual del equipo
    // Solo partidos de liga/torneo cerrados completamente (no amistosos ni pendientes de gestionar)
    const played = events.filter((e) => e.team_id === teamId && counted.has(e.id));
    const playedIds = new Set(played.map((e) => e.id));
    const totalMin = played.reduce((a, e) => a + matchMinutes(e), 0);
    const statsOf = (pid) => allStats.filter((s) => s.player_id === pid && playedIds.has(s.event_id));
    const agg = (pl) => {
      const pid = pl.id;
      const st = statsOf(pid);
      const rated = st.filter((s) => s.rating);
      const mins = st.reduce((a, s) => a + (s.minutes_played || 0), 0);
      // Minutos disponibles: los partidos en que estaba a disposición del entrenador (convocado o dejado fuera por él;
      // no cuentan lesión, viaje, sanción…). Mismo cálculo que en Estadísticas.
      const part = participationOf(pl, teamCtx);
      const availMin = part.all.availMin;
      return {
        totalMin, availMin,
        level: playerLevel(part),
        pj: st.length,
        tit: part.all.titular,
        goals: st.reduce((a, s) => a + (s.goals || 0), 0),
        conceded: st.reduce((a, s) => a + (s.goals_conceded || 0), 0),
        assists: st.reduce((a, s) => a + (s.assists || 0), 0),
        mins,
        minPJ: st.length ? Math.round(mins / st.length) : null,
        pctMin: part.all.pctAvail,
        rating: rated.length ? rated.reduce((a, s) => a + s.rating, 0) / rated.length : null,
        ta: st.reduce((a, s) => a + (s.yellow_cards || 0), 0),
        tr: st.reduce((a, s) => a + (s.red_cards || 0), 0),
      };
    };
    const rows = players.filter((p) => p.team_id === teamId && p.status !== "baja").map((p) => {
      const att = attendance.filter((a) => a.player_id === p.id && a.status);
      const ok = att.filter((a) => a.status === "present" || a.status === "apart").length;
      const active = injuries.filter((i) => i.player_id === p.id && i.status !== "alta");
      return { p, ...agg(p), attPct: att.length ? Math.round((ok / att.length) * 100) : null, attN: att.length, injury: active[0] || null, year: birthYearOf(p) };
    });
    // Jugadores de otros equipos con minutos/estadísticas en partidos de este equipo
    const ids = new Set(rows.map((r) => r.p.id));
    const guestIds = [...new Set(allStats.filter((s) => playedIds.has(s.event_id) && !ids.has(s.player_id)).map((s) => s.player_id))];
    const guests = guestIds.map((id) => players.find((p) => p.id === id)).filter(Boolean).map((p) => ({ p, ...agg(p), year: birthYearOf(p), team: teams.find((t) => t.id === p.team_id) }));
    return { rows, guests };
  }, [players, teams, events, allStats, attendance, injuries, teamId, counted, teamCtx]);

  return { rows, guests };
}
