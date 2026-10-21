import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { playerFullName } from "@/lib/playerName";
import { useT } from "@/i18n";

const POSITION_COLORS = {
  portero: "#3b82f6",           // azul
  delantero_centro: "#ef4444", // rojo
  lateral: "#14b8a6",           // teal
  central: "#22c55e",           // verde
  libre: "#dc2626",             // rojo oscuro
  mediocentro: "#FF6E00",       // naranja
  interior: "#FF6E00",          // naranja
  mediapunta: "#FF6E00",        // naranja
  extremo: "#73000A",           // granate
};

export default function MinutesDistributionChart({ matchStats, players }) {
  const t = useT();
  const playerMinutes = players
    .filter((p) => p.status !== "baja")
    .map((player) => {
      const stats = matchStats.filter((ms) => ms.player_id === player.id);
      const totalMinutes = stats.reduce((sum, ms) => sum + (ms.minutes_played || 0), 0);
      const gamesPlayed = stats.filter((ms) => (ms.minutes_played || 0) > 0).length;
      return {
        name: playerFullName(player),
        fullName: `${playerFullName(player)}`,
        minutes: totalMinutes,
        games: gamesPlayed,
        position: player.position,
      };
    })
    .filter((p) => p.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 15);

  const CustomTooltip = ({ active, payload }) => {
    const t = useT();
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const positionLabels = {
      portero: "POR", delantero_centro: "DC", lateral: "LAT", central: "CTR", 
      libre: "LIB", mediocentro: "MCC", interior: "INT", mediapunta: "MP", extremo: "EXT"
    };
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-sm">
        <p className="font-semibold text-gray-900">{d.fullName}</p>
        <p className="text-xs text-gray-500 mb-1">{positionLabels[d.position] || d.position}</p>
        <p className="text-gray-600">{t("{minutes} minutos", { minutes: d.minutes })}</p>
        <p className="text-gray-400">{d.games === 1 ? t("{n} partido", { n: d.games }) : t("{n} partidos", { n: d.games })}</p>
        {d.games > 0 && <p className="text-gray-500">{t("Media: {round} min/partido", { round: Math.round(d.minutes / d.games) })}</p>}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
      <div className="p-5 border-b border-gray-100">
        <h2 className="font-bold text-xl uppercase tracking-wide text-gray-900" style={{ fontFamily: "var(--font-display)" }}>{t("Distribución de Minutos por Jugador")}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t("Top 15 jugadores con más minutos")}</p>
      </div>
      <div className="p-5">
        {playerMinutes.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">{t("No hay estadísticas de partidos registradas")}</div>
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
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#3b82f6" }}></span>{t("Portero")}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }}></span>{t("Central")}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#14b8a6" }}></span>{t("Lateral")}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#FF6E00" }}></span>{t("Mediocentro/Interior")}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#73000A" }}></span>{t("Extremo")}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#ef4444" }}></span>{t("Delantero")}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}