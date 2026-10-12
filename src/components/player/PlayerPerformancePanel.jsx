import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Trophy, Clock, Target, Star, Square } from "lucide-react";

function StatBox({ label, value, sub, color = "gray" }) {
  const colors = {
    granate: "bg-red-50 border-red-100 text-red-800",
    green: "bg-green-50 border-green-100 text-green-800",
    blue: "bg-blue-50 border-blue-100 text-blue-800",
    yellow: "bg-yellow-50 border-yellow-100 text-yellow-800",
    orange: "bg-orange-50 border-orange-100 text-orange-800",
    gray: "bg-gray-50 border-gray-200 text-gray-800",
  };
  return (
    <div className={`rounded-2xl border p-4 text-center shadow-sm ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniRow({ title, children }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <p className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</p>
      <div className="flex-1 flex flex-wrap gap-x-5 gap-y-1.5">{children}</div>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-base font-bold text-gray-900 leading-none">{value}</span>
      <span className="text-[11px] text-gray-500">{label}</span>
    </div>
  );
}

function StarRating({ value }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </span>
  );
}

export default function PlayerPerformancePanel({ playerId }) {
  const { data: stats = [] } = useQuery({
    queryKey: ["matchstats", playerId],
    queryFn: () => base44.entities.MatchStats.filter({ player_id: playerId }, "date"),
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", playerId],
    queryFn: () => base44.entities.TrainingAttendance.filter({ player_id: playerId }, "date"),
  });

  const { data: convocatorias = [] } = useQuery({
    queryKey: ["convocatorias"],
    queryFn: () => base44.entities.Convocatoria.list(),
  });

  const totalConvocatorias = convocatorias.filter(
    (c) => Array.isArray(c.player_ids) && c.player_ids.includes(playerId)
  ).length;

  const partidos = stats.length;
  const titular = stats.filter((s) => s.starter !== false).length;
  const suplente = stats.filter((s) => s.starter === false).length;
  const totalMins = stats.reduce((s, r) => s + (r.minutes_played || 0), 0);
  const maxMins = totalConvocatorias * 90;
  const minsPct = maxMins > 0 ? Math.round((totalMins / maxMins) * 100) : 0;
  const totalGoals = stats.reduce((s, r) => s + (r.goals || 0), 0);
  const totalAssists = stats.reduce((s, r) => s + (r.assists || 0), 0);
  const totalYellow = stats.reduce((s, r) => s + (r.yellow_cards || 0), 0);
  const totalDoubleYellow = stats.reduce((s, r) => s + (r.double_yellow_card || 0), 0);
  const totalRed = stats.reduce((s, r) => s + (r.red_cards || 0), 0);
  const ratedStats = stats.filter((r) => r.rating);
  const avgRating = ratedStats.length > 0
    ? (ratedStats.reduce((s, r) => s + r.rating, 0) / ratedStats.length).toFixed(1)
    : null;

  // Build chart data per month
  const monthMap = {};
  stats.forEach((s) => {
    const d = new Date(s.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { month: key, ratings: [], partidos: 0 };
    monthMap[key].partidos += 1;
    if (s.rating) monthMap[key].ratings.push(s.rating);
  });

  attendance.forEach((a) => {
    const d = new Date(a.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { month: key, ratings: [], partidos: 0 };
    if (!monthMap[key].attendanceData) monthMap[key].attendanceData = { present: 0, total: 0 };
    monthMap[key].attendanceData.total += 1;
    if (a.status !== "absent") monthMap[key].attendanceData.present += 1;
  });

  const chartData = Object.keys(monthMap).sort().map((key) => {
    const m = monthMap[key];
    const label = new Date(key + "-01").toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
    const avgR = m.ratings.length > 0
      ? parseFloat((m.ratings.reduce((a, b) => a + b, 0) / m.ratings.length).toFixed(1))
      : null;
    const attPct = m.attendanceData
      ? Math.round((m.attendanceData.present / m.attendanceData.total) * 100)
      : null;
    return { label, rating: avgR, asistencia: attPct };
  }).filter((d) => d.rating !== null || d.asistencia !== null);

  return (
    <div className="space-y-6">
      {/* Resumen compacto de estadísticas */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm divide-y divide-gray-100">
        <MiniRow title="Participación">
          <Mini label="Convoc." value={totalConvocatorias} />
          <Mini label="Jugados" value={partidos} />
          <Mini label="Titular" value={titular} />
          <Mini label="Suplente" value={suplente} />
        </MiniRow>
        <MiniRow title="Minutos">
          <Mini label="Totales" value={`${totalMins}'`} />
          <Mini label={`de ${maxMins}'`} value={`${minsPct}%`} />
          <Mini label="Media/partido" value={partidos > 0 ? `${Math.round(totalMins / partidos)}'` : "—"} />
        </MiniRow>
        <MiniRow title="Ofensiva">
          <Mini label="Goles" value={totalGoals} />
          <Mini label="Asist." value={totalAssists} />
          <Mini label="G+A/partido" value={partidos > 0 ? ((totalGoals + totalAssists) / partidos).toFixed(2) : "—"} />
          <Mini label="Valoración" value={avgRating ? `${avgRating} ★` : "—"} />
        </MiniRow>
        <MiniRow title="Disciplina">
          <Mini label="🟨 Amarillas" value={totalYellow} />
          <Mini label="🟨🟨 Doble am." value={totalDoubleYellow} />
          <Mini label="🟥 Rojas" value={totalRed} />
        </MiniRow>
      </div>

      {/* Gráfica evolución */}
      {chartData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Evolución a lo largo de la temporada</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis yAxisId="rating" domain={[0, 5]} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis yAxisId="asistencia" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} unit="%" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(value, name) => name === "Valoración (★)" ? [`${value} ★`, name] : [`${value}%`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="rating" type="monotone" dataKey="rating" name="Valoración (★)" stroke="#E85D04" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
              <Line yAxisId="asistencia" type="monotone" dataKey="asistencia" name="Asistencia (%)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartData.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm text-gray-400">
          <Trophy className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>Registra partidos para ver la evolución del jugador</p>
        </div>
      )}
    </div>
  );
}