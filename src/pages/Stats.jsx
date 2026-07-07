import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart2, Users } from "lucide-react";
import AttendanceChart from "@/components/stats/AttendanceChart";
import MatchResultsChart from "@/components/stats/MatchResultsChart";
import MinutesDistributionChart from "@/components/stats/MinutesDistributionChart";

export default function Stats() {
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [activeTab, setActiveTab] = useState("attendance");

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance"],
    queryFn: () => base44.entities.TrainingAttendance.list("-date", 500),
  });

  const { data: matchStats = [] } = useQuery({
    queryKey: ["matchStats"],
    queryFn: () => base44.entities.MatchStats.list("-date", 500),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date", 200),
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

  const filteredMatchStats = selectedTeam === "all"
    ? matchStats
    : matchStats.filter((ms) => {
        const player = players.find((p) => p.id === ms.player_id);
        return player?.team_id === selectedTeam;
      });

  const filteredEvents = selectedTeam === "all"
    ? events
    : events.filter((e) => e.team_id === selectedTeam);

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
    .map(([playerId, stats]) => ({ playerId, ...stats, player: filteredPlayers.find(p => p.id === playerId) }))
    .filter(p => p.player)
    .sort((a, b) => b.goals - a.goals)[0];

  const topAssister = Array.from(playerStatsMap.entries())
    .map(([playerId, stats]) => ({ playerId, ...stats, player: filteredPlayers.find(p => p.id === playerId) }))
    .filter(p => p.player)
    .sort((a, b) => b.assists - a.assists)[0];

  const topMinutes = Array.from(playerStatsMap.entries())
    .map(([playerId, stats]) => ({ playerId, ...stats, player: filteredPlayers.find(p => p.id === playerId) }))
    .filter(p => p.player)
    .sort((a, b) => b.minutes - a.minutes)[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Herramientas</p>
          <h1>Estadísticas</h1>
          <p className="text-gray-400 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>Rendimiento y análisis del equipo</p>
        </div>
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger className="w-48 border-gray-200 bg-white">
            <SelectValue placeholder="Todos los equipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los equipos</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── TARJETAS DE ESTADÍSTICAS DESTACADAS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {topScorer && (
          <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Máximo goleador</p>
            <p className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{topScorer.goals}</p>
            <p className="text-xs text-gray-500 mt-1">{topScorer.player.first_name} {topScorer.player.last_name}</p>
          </div>
        )}
        {topAssister && (
          <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Máximo asistente</p>
            <p className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{topAssister.assists}</p>
            <p className="text-xs text-gray-500 mt-1">{topAssister.player.first_name} {topAssister.player.last_name}</p>
          </div>
        )}
        {topMinutes && (
          <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Más minutos</p>
            <p className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{topMinutes.minutes}'</p>
            <p className="text-xs text-gray-500 mt-1">{topMinutes.player.first_name} {topMinutes.player.last_name}</p>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="attendance">
        <TabsList className="bg-gray-100 p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="attendance" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">
            <Users className="w-4 h-4 mr-2" /> Asistencia
          </TabsTrigger>
          <TabsTrigger value="matches" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">
            <BarChart2 className="w-4 h-4 mr-2" /> Partidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-6">
          <div className="space-y-8">
            <AttendanceChart attendance={filteredAttendance} events={filteredEvents} />
            <MinutesDistributionChart matchStats={filteredMatchStats} players={filteredPlayers} />
          </div>
        </TabsContent>

        <TabsContent value="matches" className="mt-6">
          <MatchResultsChart events={filteredEvents} />
        </TabsContent>
      </Tabs>
    </div>
  );
}