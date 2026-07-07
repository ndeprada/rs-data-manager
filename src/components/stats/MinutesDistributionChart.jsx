import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const POSITION_COLORS = {
  portero: "#3b82f6",           // azul
  delantero_centro: "#ef4444", // rojo
  lateral: "#14b8a6",           // teal
  central: "#22c55e",           // verde
  libre: "#dc2626",             // rojo oscuro
  mediocentro: "#e67e22",       // naranja
  interior: "#e67e22",          // naranja
  extremo: "#6b1f28",           // granate
};

export default function MinutesDistributionChart({ matchStats, players }) {
  const playerMinutes = players
    .filter((p) => p.status !== "baja")
    .map((player) => {
      const stats = matchStats.filter((ms) => ms.player_id === player.id);
      const totalMinutes = stats.reduce((sum, ms) => sum + (ms.minutes_played || 0), 0);
      const gamesPlayed = stats.filter((ms) => (ms.minutes_played || 0) > 0).length;
      return {
        name: `${player.first_name?.[0]}. ${player.last_name}`,
        fullName: `${player.first_name} ${player.last_name}`,
        minutes: totalMinutes,
        games: gamesPlayed,
        position: player.position,
      };
    })
    .filter((p) => p.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 15);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const positionLabels = {
      portero: "POR", delantero_centro: "DC", lateral: "LAT", central: "CTR", 
      libre: "LIB", mediocentro: "MCC", interior: "INT", extremo: "EXT"
    };
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-sm">
        <p className="font-semibold text-gray-900">{d.fullName}</p>
        <p className="text-xs text-gray-500 mb-1">{positionLabels[d.position] || d.position}</p>
        <p className="text-gray-600">{d.minutes} minutos</p>
        <p className="text-gray-400">{d.games} partido{d.games !== 1 ? "s" : ""}</p>
        {d.games > 0 && <p className="text-gray-500">Media: {Math.round(d.minutes / d.games)} min/partido</p>}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
      <div className="p-5 border-b border-gray-100">
        <h2 className="font-bold text-xl uppercase tracking-wide text-gray-900" style={{ fontFamily: "var(--font-display)" }}>Distribución de Minutos por Jugador</h2>
        <p className="text-sm text-gray-500 mt-0.5">Top 15 jugadores con más minutos</p>
      </div>
      <div className="p-5">
        {playerMinutes.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No hay estadísticas de partidos registradas</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={playerMinutes} layout="vertical" barSize={14} margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                  {playerMinutes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={POSITION_COLORS[entry.position] || "#9ca3af"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-4 justify-center text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#3b82f6" }}></span>Portero</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }}></span>Central</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#14b8a6" }}></span>Lateral</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#e67e22" }}></span>Mediocentro/Interior</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#6b1f28" }}></span>Extremo</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#ef4444" }}></span>Delantero</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}