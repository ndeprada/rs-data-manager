import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { birthYearOf } from "@/lib/birthYear";
import { useMatchStatus } from "@/lib/matchStatus";
import { participationOf, playerLevel } from "@/lib/participation";
import { useParticipationContext } from "@/lib/useParticipation";
import { teamRank } from "@/lib/teamOrder";

/** Filas de todos los jugadores con sus datos de la temporada con su equipo (mismo cálculo que la plantilla de Mi equipo) */
export function usePlayerRows(players, teams, accounts) {
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: allStats = [] } = useQuery({ queryKey: ["matchstats_all"], queryFn: () => base44.entities.MatchStats.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance_all"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries_all"], queryFn: () => base44.entities.Injury.list(), retry: false });
  const { counted } = useMatchStatus();
  const partCtx = useParticipationContext("liga");
  return useMemo(() => {
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const evById = new Map(events.map((e) => [e.id, e]));
    // Participación: solo los partidos del equipo del jugador (un contexto por equipo)
    const ctxByTeam = new Map();
    const ctxOf = (tid) => {
      if (!ctxByTeam.has(tid)) ctxByTeam.set(tid, { ...partCtx, events: partCtx.events.filter((e) => e.team_id === tid) });
      return ctxByTeam.get(tid);
    };
    const statsBy = new Map();
    for (const s of allStats) {
      const ev = evById.get(s.event_id);
      if (!ev || !counted.has(ev.id)) continue;
      if (!statsBy.has(s.player_id)) statsBy.set(s.player_id, []);
      statsBy.get(s.player_id).push({ s, team: ev.team_id });
    }
    const attBy = new Map();
    for (const a of attendance) {
      if (!a.status) continue;
      const o = attBy.get(a.player_id) || { ok: 0, n: 0 };
      o.n++; if (a.status === "present" || a.status === "apart") o.ok++;
      attBy.set(a.player_id, o);
    }
    const injBy = new Map();
    for (const i of injuries) if (i.status !== "alta" && !injBy.has(i.player_id)) injBy.set(i.player_id, i);
    return players.map((p) => {
      const team = teamById.get(p.team_id) || null;
      const st = (statsBy.get(p.id) || []).filter((x) => x.team === p.team_id).map((x) => x.s);
      const part = p.team_id ? participationOf(p, ctxOf(p.team_id)) : null;
      const att = attBy.get(p.id);
      const injury = injBy.get(p.id) || null;
      return {
        p, team, teamRank: team ? teamRank(team) * 1000 : 99999, year: birthYearOf(p),
        injury, injured: !!injury || p.status === "lesionado",
        acc: accounts ? { own: accounts.own?.[p.id] || 0, family: accounts.family?.[p.id] || 0, pending: accounts.pending?.[p.id] || 0 } : null,
        pj: st.length, goals: st.reduce((a, s) => a + (s.goals || 0), 0),
        pctMin: part && part.all.availMin ? part.all.pctAvail : null, level: part ? playerLevel(part) : null,
        attPct: att?.n ? Math.round((att.ok / att.n) * 100) : null, attN: att?.n || 0,
      };
    });
  }, [players, teams, accounts, events, allStats, attendance, injuries, counted, partCtx]);
}

