import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart2, Users, Target } from "lucide-react";
import GoalStatsPanel from "@/components/stats/GoalStatsPanel";
import AttendanceChart from "@/components/stats/AttendanceChart";
import MatchResultsChart from "@/components/stats/MatchResultsChart";
import MinutesDistributionChart from "@/components/stats/MinutesDistributionChart";
import PlayerParticipationTable from "@/components/stats/PlayerParticipationTable";
import { playerFullName } from "@/lib/playerName";
import { useCountedStats, STAT_SCOPES } from "@/lib/matchStatus";
import { statTeamResolver, statsOfTeam } from "@/lib/teamStats";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import StatsScopePills from "@/components/common/StatsScopePills";

import { PageTitle } from "@/components/common/PageHeader";
import { useT } from "@/i18n";
export default function Stats() {
  const t = useT();
  const [pickedTeam, setSelectedTeam] = useState("all");
  const [activeTab, setActiveTab] = useState("attendance");
  const { perms, teamIds } = useTeamAccess();

  const { data: allTeams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  // Un entrenador ve las estadísticas de sus equipos; quien trabaja con todo el club, las de todos
  const limited = perms.stats === "team";
  const teams = limited ? allTeams.filter((t) => (teamIds || []).includes(t.id)) : allTeams;
  const selectedTeam = limited ? (teams.some((t) => t.id === pickedTeam) ? pickedTeam : (teams[0]?.id || "none")) : pickedTeam;

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance"],
    queryFn: () => base44.entities.TrainingAttendance.list("-date", 500),
  });

  const { data: raw_matchStats = [] } = useQuery({
    queryKey: ["matchStats"],
    queryFn: () => base44.entities.MatchStats.list("-date", 500),
  });
  const [statScope, setStatScope] = useState("liga");
  const matchStats = useCountedStats(raw_matchStats, statScope);

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date"),
  });

  const filteredPlayers = selectedTeam === "all"
    ? players
    : players.filter((p) => p.team_id === selectedTeam);

  const filteredAttendance = selectedTeam === "all"
    ? attendance
    : attendance.filter((a) => {
        const player = players.find((p) => p.id === a.player_id);
        return player?.team_id === selectedTeam;
      });

  // Las estadísticas de un equipo son las de sus partidos: un invitado de otro equipo suma aquí, y lo que hacen
  // sus jugadores como invitados en otros equipos no suma aquí.
  const filteredMatchStats = selectedTeam === "all"
    ? matchStats
    : statsOfTeam(matchStats, selectedTeam, statTeamResolver(events, players));

  const scopeTypes = (STAT_SCOPES.find((x) => x.value === statScope) || STAT_SCOPES[0]).types;
  const filteredEvents = (selectedTeam === "all"
    ? events
    : events.filter((e) => e.team_id === selectedTeam)
  ).filter((e) => !["partido_liga", "partido_amistoso", "torneo"].includes(e.type) || scopeTypes.includes(e.type));

  // Calcular máximo goleador, asistente y más minutos
  const playerStatsMap = new Map();
  filteredMatchStats.forEach(ms => {
    if (!playerStatsMap.has(ms.player_id)) {
      playerStatsMap.set(ms.player_id, { goals: 0, assists: 0, minutes: 0 });
    }
    const stats = playerStatsMap.get(ms.player_id);
    stats.goals += ms.goals || 0;
    stats.assists += ms.assists || 0;
    stats.minutes += ms.minutes_played || 0;
  });

  const topScorer = Array.from(playerStatsMap.entries())
    .map(([playerId, stats]) => ({ playerId, ...stats, player: players.find(p => p.id === playerId) }))
    .filter(p => p.player)
    .sort((a, b) => b.goals - a.goals)[0];

  const topAssister = Array.from(playerStatsMap.entries())
    .map(([playerId, stats]) => ({ playerId, ...stats, player: players.find(p => p.id === playerId) }))
    .filter(p => p.player)
    .sort((a, b) => b.assists - a.assists)[0];

  const topMinutes = Array.from(playerStatsMap.entries())
    .map(([playerId, stats]) => ({ playerId, ...stats, player: players.find(p => p.id === playerId) }))
    .filter(p => p.player)
    .sort((a, b) => b.minutes - a.minutes)[0];

  if (perms.stats === "none") {
    return <div className="p-12 text-center"><p className="text-gray-400">{t("No tienes acceso a esta sección.")}</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageTitle kicker={t("Herramientas")} title={t("Estadísticas")} subtitle={t("Rendimiento y análisis del equipo")} />
        <div className="flex items-center gap-3 flex-wrap">
        <StatsScopePills value={statScope} onChange={setStatScope} />
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger className="w-48 border-gray-200 bg-white">
            <SelectValue placeholder={t("Todos los equipos")} />
          </SelectTrigger>
          <SelectContent>
            {!limited && <SelectItem value="all">{t("Todos los equipos")}</SelectItem>}
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
      </div>

      {/* ── TARJETAS DE ESTADÍSTICAS DESTACADAS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {topScorer && (
          <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">{t("Máximo goleador")}</p>
            <p className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{topScorer.goals}</p>
            <p className="text-xs text-gray-500 mt-1">{playerFullName(topScorer.player)}</p>
          </div>
        )}
        {topAssister && (
          <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">{t("Máximo asistente")}</p>
            <p className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{topAssister.assists}</p>
            <p className="text-xs text-gray-500 mt-1">{playerFullName(topAssister.player)}</p>
          </div>
        )}
        {topMinutes && (
          <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">{t("Más minutos")}</p>
            <p className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{topMinutes.minutes}'</p>
            <p className="text-xs text-gray-500 mt-1">{playerFullName(topMinutes.player)}</p>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">
            <Users className="w-4 h-4 mr-2" /> {t("Asistencia")}
          </TabsTrigger>
          <TabsTrigger value="matches">
            <BarChart2 className="w-4 h-4 mr-2" /> {t("Partidos")}
          </TabsTrigger>
          <TabsTrigger value="goals">
            <Target className="w-4 h-4 mr-2" /> {t("Goles")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-6">
          <div className="space-y-8">
            <AttendanceChart attendance={filteredAttendance} events={filteredEvents} />
            <MinutesDistributionChart matchStats={filteredMatchStats} players={filteredPlayers} />
          </div>
        </TabsContent>

        <TabsContent value="matches" className="mt-6 space-y-6">
          <PlayerParticipationTable teamId={selectedTeam === "all" ? null : selectedTeam} players={players} scope={statScope} />
          <MatchResultsChart events={filteredEvents} />
        </TabsContent>

        <TabsContent value="goals" className="mt-6">
          <GoalStatsPanel events={filteredEvents} players={players} teams={teams} />
        </TabsContent>
      </Tabs>
    </div>
  );
}