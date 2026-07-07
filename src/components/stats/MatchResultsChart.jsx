import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];

export default function MatchResultsChart({ events }) {
  const matchEvents = events.filter((e) => MATCH_TYPES.includes(e.type));

  const won = matchEvents.filter((e) => {
    const notes = (e.notes || "").toLowerCase();
    return notes.includes("victoria") || notes.includes("ganado") || notes.includes("win") || notes.includes("3-") || notes.includes("resultado: w");
  }).length;

  const lost = matchEvents.filter((e) => {
    const notes = (e.notes || "").toLowerCase();
    return notes.includes("derrota") || notes.includes("perdido") || notes.includes("loss");
  }).length;

  const drawn = matchEvents.filter((e) => {
    const notes = (e.notes || "").toLowerCase();
    return notes.includes("empate") || notes.includes("draw");
  }).length;

  const unknown = matchEvents.length - won - lost - drawn;

  const chartData = [
    { name: "Victorias", value: won, color: "#22c55e" },
    { name: "Empates", value: drawn, color: "#f59e0b" },
    { name: "Derrotas", value: lost, color: "#ef4444" },
    { name: "Sin resultado", value: unknown > 0 ? unknown : 0, color: "#e5e7eb" },
  ].filter((d) => d.value > 0);

  const total = matchEvents.length;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-sm">
        <p className="font-semibold" style={{ color: item.payload.color }}>{item.name}</p>
        <p className="text-gray-700">{item.value} partido{item.value !== 1 ? "s" : ""}</p>
        <p className="text-gray-400">{total > 0 ? Math.round((item.value / total) * 100) : 0}%</p>
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl uppercase tracking-wide text-gray-900" style={{ fontFamily: "var(--font-display)" }}>Resultados de Partidos</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} partido{total !== 1 ? "s" : ""} en total</p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">{won}</p>
            <p className="text-xs text-gray-400">V</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-400">{drawn}</p>
            <p className="text-xs text-gray-400">E</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-500">{lost}</p>
            <p className="text-xs text-gray-400">D</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        {total === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No hay partidos registrados</div>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-6">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3 min-w-[140px]">
              {chartData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }}></div>
                  <span className="text-sm text-gray-700">{item.name}</span>
                  <span className="ml-auto font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">* Los resultados se detectan a partir de las notas del evento (victoria/derrota/empate).</p>
      </div>
    </div>
  );
}