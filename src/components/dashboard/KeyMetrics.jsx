import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, isAfter, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Trophy, Activity } from "lucide-react";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico"];

export default function KeyMetrics({ events = [], teams = [] }) {
  const { data: attendance = [] } = useQuery({
    queryKey: ["training-attendance-metrics"],
    queryFn: () => base44.entities.TrainingAttendance.list("-date", 500),
  });

  const today = startOfDay(new Date());
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  // Próximo partido
  const nextMatch = events
    .filter(e => MATCH_TYPES.includes(e.type) && isAfter(new Date(e.date), today))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  const nextMatchTeam = nextMatch ? teams.find(t => t.id === nextMatch.team_id) : null;

  // Partidos ganados este mes
  const matchesThisMonth = events.filter(e =>
    MATCH_TYPES.includes(e.type) &&
    new Date(e.date) >= monthStart &&
    new Date(e.date) <= monthEnd &&
    e.score_home != null && e.score_away != null
  );
  const winsThisMonth = matchesThisMonth.filter(e => e.score_home > e.score_away).length;

  // Asistencia media a entrenamientos (último mes)
  const trainingEventIds = events
    .filter(e => TRAINING_TYPES.includes(e.type))
    .map(e => e.id);

  const recentAttendance = attendance.filter(a => {
    const d = new Date(a.date);
    return d >= monthStart && d <= monthEnd;
  });

  const totalAttendance = recentAttendance.length;
  const presentAttendance = recentAttendance.filter(a => a.status === "present" || a.attended === true).length;
  const avgAttendance = totalAttendance > 0 ? Math.round((presentAttendance / totalAttendance) * 100) : null;

  const metrics = [
    {
      icon: CalendarDays,
      label: "Próximo partido",
      value: nextMatch ? nextMatch.opponent ? `vs ${nextMatch.opponent}` : nextMatch.title : "—",
      sub: nextMatch
        ? `${nextMatchTeam?.name || ""} · ${format(new Date(nextMatch.date), "EEE d MMM · HH:mm", { locale: es })}`
        : "Sin partidos programados",
      color: "var(--granate)",
      colorPale: "var(--granate-pale)",
    },
    {
      icon: Trophy,
      label: "Victorias este mes",
      value: `${winsThisMonth} / ${matchesThisMonth.length}`,
      sub: matchesThisMonth.length === 0 ? "Sin partidos este mes" : `${matchesThisMonth.length - winsThisMonth} empates/derrotas`,
      color: "#16a34a",
      colorPale: "#f0fdf4",
    },
    {
      icon: Activity,
      label: "Asistencia media",
      value: avgAttendance != null ? `${avgAttendance}%` : "—",
      sub: totalAttendance > 0 ? `${presentAttendance} de ${totalAttendance} registros este mes` : "Sin datos este mes",
      color: "var(--naranja)",
      colorPale: "var(--naranja-pale)",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {metrics.map(({ icon: Icon, label, value, sub, color, colorPale }) => (
        <div
          key={label}
          className="bg-white border border-gray-200 shadow-sm p-5 flex items-start gap-4"
          style={{ borderRadius: "4px", borderTop: `3px solid ${color}` }}
        >
          <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ background: colorPale, borderRadius: "4px" }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5" style={{ fontFamily: "var(--font-display)" }}>
              {label}
            </p>
            <p className="text-2xl font-black leading-tight truncate" style={{ fontFamily: "var(--font-display)", color }}>
              {value}
            </p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}