import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, TrendingUp } from "lucide-react";

export default function TeamPerformancePanel() {
  const [selectedTeamId, setSelectedTeamId] = React.useState("all");

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list(),
  });

  // Calculate team performance
  const calculateTeamStats = () => {
    const stats = {};

    events.forEach((event) => {
      if (!event.type?.includes("partido") || event.score_home === undefined || event.score_away === undefined) return;

      const teamId = event.team_id;
      if (!stats[teamId]) {
        stats[teamId] = { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, matches: 0 };
      }

      const team = teams.find((t) => t.id === teamId);
      if (!team) return;

      stats[teamId].matches++;
      stats[teamId].goalsFor += event.score_home || 0;
      stats[teamId].goalsAgainst += event.score_away || 0;

      if (event.score_home > event.score_away) {
        stats[teamId].wins++;
      } else if (event.score_home < event.score_away) {
        stats[teamId].losses++;
      } else {
        stats[teamId].draws++;
      }
    });

    return stats;
  };

  const stats = calculateTeamStats();
  const teamsWithStats = teams
    .filter((t) => stats[t.id])
    .map((t) => ({
      ...t,
      ...stats[t.id],
    }));

  // Filter by selected team
  const filteredTeams = selectedTeamId === "all" ? teamsWithStats : teamsWithStats.filter((t) => t.id === selectedTeamId);

  // Data for overall bar chart
  const overallData = filteredTeams.map((t) => ({
    name: t.name,
    Victorias: t.wins,
    Empates: t.draws,
    Derrotas: t.losses,
  }));

  // Data for pie chart (selected team or combined)
  const selectedTeam = filteredTeams[0];
  const pieData = selectedTeam
    ? [
        { name: "Victorias", value: selectedTeam.wins },
        { name: "Empates", value: selectedTeam.draws },
        { name: "Derrotas", value: selectedTeam.losses },
      ]
    : [];

  const colors = ["#10b981", "#f59e0b", "#ef4444"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6" style={{ color: "var(--granate)" }} />
          <h2 className="text-2xl font-black uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
            Rendimiento de Equipos
          </h2>
        </div>
        <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
          <SelectTrigger className="w-64 border-gray-200 bg-white">
            <SelectValue placeholder="Todos los equipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los equipos</SelectItem>
            {teamsWithStats.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredTeams.length === 0 ? (
        <Card className="p-8 text-center border-gray-200">
          <p className="text-gray-400 text-sm">No hay datos de partidos disponibles</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <Card className="p-6 border-gray-200">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
              Comparativa de Resultados
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={overallData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }} />
                <Legend />
                <Bar dataKey="Victorias" fill="#10b981" />
                <Bar dataKey="Empates" fill="#f59e0b" />
                <Bar dataKey="Derrotas" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Pie Chart */}
          {selectedTeam && (
            <Card className="p-6 border-gray-200">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
                Distribución: {selectedTeam.name}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* Stats Cards */}
      {filteredTeams.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredTeams.map((team) => (
            <Card key={team.id} className="p-4 border-gray-200" style={{ borderLeftWidth: "3px", borderLeftColor: "var(--granate)" }}>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2" style={{ fontFamily: "var(--font-display)" }}>
                {team.name}
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Partidos:</span>
                  <span className="font-bold">{team.matches}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Victorias:</span>
                  <span className="font-bold text-green-600">{team.wins}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Empates:</span>
                  <span className="font-bold text-amber-600">{team.draws}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Derrotas:</span>
                  <span className="font-bold text-red-600">{team.losses}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Promedio:</span>
                    <span className="font-bold text-sm">
                      {team.matches > 0 ? ((team.wins / team.matches) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}