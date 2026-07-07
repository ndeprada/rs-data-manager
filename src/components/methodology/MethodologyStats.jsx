import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { GAME_MOMENTS, TACTICAL_ASPECTS } from "./methodologyConfig";

export default function MethodologyStats({ teams = [], isCoordinator, selectedTeamId }) {
  const [filterTeam, setFilterTeam] = useState(selectedTeamId || "all");
  const [filterPeriod, setFilterPeriod] = useState("all");

  const { data: sessions = [] } = useQuery({
    queryKey: ["training_sessions"],
    queryFn: () => base44.entities.TrainingSession.list("-date", 200),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["training_tasks"],
    queryFn: () => base44.entities.TrainingTask.list("-created_date", 300),
  });

  const now = new Date();
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (s.status !== "realizada") return false;
      if (filterTeam !== "all" && s.team_id !== filterTeam) return false;
      if (filterPeriod !== "all" && s.date) {
        const d = new Date(s.date);
        const diff = (now - d) / (1000 * 60 * 60 * 24);
        if (filterPeriod === "30" && diff > 30) return false;
        if (filterPeriod === "90" && diff > 90) return false;
      }
      return true;
    });
  }, [sessions, filterTeam, filterPeriod]);

  // Aggregated minutes by game moment
  const minutesByMoment = useMemo(() => {
    const acc = {};
    filteredSessions.forEach(s => {
      if (s.minutes_by_game_moment) {
        Object.entries(s.minutes_by_game_moment).forEach(([k, v]) => {
          acc[k] = (acc[k] || 0) + (v || 0);
        });
      }
    });
    return GAME_MOMENTS.filter(m => m.value !== "ninguno").map(m => ({
      name: m.label,
      minutos: acc[m.value] || 0,
      color: m.color,
      value: m.value,
    })).filter(m => m.minutos > 0);
  }, [filteredSessions]);

  // Aggregated minutes by tactical aspect from tasks used
  const minutesByAspect = useMemo(() => {
    const acc = {};
    filteredSessions.forEach(s => {
      (s.tasks || []).forEach(st => {
        const task = tasks.find(t => t.id === st.task_id);
        if (!task || !task.tactical_aspect || task.tactical_aspect === "ninguno") return;
        const mins = st.duration_override || task.duration_minutes || 0;
        acc[task.tactical_aspect] = (acc[task.tactical_aspect] || 0) + mins;
      });
    });
    return TACTICAL_ASPECTS.filter(a => a.value !== "ninguno").map(a => ({
      name: a.label,
      minutos: acc[a.value] || 0,
      group: a.group,
    })).filter(a => a.minutos > 0);
  }, [filteredSessions, tasks]);

  // Sessions per week trend
  const sessionsByWeek = useMemo(() => {
    const weeks = {};
    filteredSessions.forEach(s => {
      if (!s.date) return;
      const d = new Date(s.date);
      const year = d.getFullYear();
      const week = Math.ceil((d - new Date(year, 0, 1)) / (7 * 24 * 3600000));
      const key = `S${week}`;
      weeks[key] = (weeks[key] || 0) + (s.total_duration_minutes || 0);
    });
    return Object.entries(weeks).slice(-12).map(([w, mins]) => ({ semana: w, minutos: mins }));
  }, [filteredSessions]);

  const totalSessions = filteredSessions.length;
  const totalMinutes = filteredSessions.reduce((s, x) => s + (x.total_duration_minutes || 0), 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
  const avgMinutes = totalSessions ? Math.round(totalMinutes / totalSessions) : 0;

  const COLORS = GAME_MOMENTS.filter(m => m.value !== "ninguno").map(m => m.color);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {isCoordinator && (
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Todos los equipos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los equipos</SelectItem>
              {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo el tiempo</SelectItem>
            <SelectItem value="30">Últimos 30 días</SelectItem>
            <SelectItem value="90">Últimos 90 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Sesiones realizadas", value: totalSessions },
          { label: "Horas totales", value: `${totalHours}h` },
          { label: "Min. por sesión (media)", value: `${avgMinutes}min` },
          { label: "Tareas en biblioteca", value: tasks.length },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>{kpi.label}</p>
            <p className="text-2xl font-black mt-1" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {totalSessions === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white border border-gray-200 rounded-lg">
          <p className="text-sm">No hay sesiones realizadas para analizar.</p>
          <p className="text-xs mt-1">Marca sesiones como "Realizadas" para ver estadísticas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie: minutos por momento del juego */}
          {minutesByMoment.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
                Minutos por Momento del Juego
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={minutesByMoment} dataKey="minutos" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {minutesByMoment.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v} min`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Bar: minutos por aspecto táctico */}
          {minutesByAspect.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
                Minutos por Aspecto Específico
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={minutesByAspect} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip formatter={(v) => `${v} min`} />
                  <Bar dataKey="minutos" fill="var(--granate)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Bar: carga semanal */}
          {sessionsByWeek.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 lg:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
                Carga de Entrenamiento (Minutos por Semana)
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sessionsByWeek}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => `${v} min`} />
                  <Bar dataKey="minutos" fill="#E85D04" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}