import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { AREAS, computeAverages, scoreColor } from "@/lib/eval360";

// Círculo estilo FIFA; value en escala 1-10
function StatCircle({ label, value }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const pct = value == null ? 0 : value * 10;
  const color = scoreColor(value);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
          <circle cx="30" cy="30" r={r} fill="none" stroke="#f0f0f0" strokeWidth="5" />
          <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={circ - (circ * pct) / 100} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-black" style={{ color }}>
          {value ?? "—"}
        </span>
      </div>
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide text-center leading-tight">{label}</span>
    </div>
  );
}

export default function PlayerAttributesBar({ playerId }) {
  const { data: evals = [] } = useQuery({
    queryKey: ["eval360", playerId],
    queryFn: () => base44.entities.Evaluation360.filter({ player_id: playerId }, "-date"),
  });
  const latest = evals[0] ?? null;
  const avg = computeAverages(latest?.scores);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-gray-900">Atributos</span>
          <span className="inline-flex items-center justify-center min-w-8 h-8 px-1 rounded-xl text-sm font-black text-white shadow-sm" style={{ background: "linear-gradient(135deg, #6b1f28, #3d0d13)" }}>
            {avg.overall ?? "—"}
          </span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: latest ? "#f0fdf4" : "#f3f4f6", color: latest ? "#16a34a" : "#9ca3af" }}>
          {latest ? `Evaluación 360 · ${latest.period || (latest.date ? new Date(latest.date).toLocaleDateString("es-ES", { month: "short", year: "numeric" }) : "")}` : "Sin Evaluación 360"}
        </span>
      </div>
      <div className="px-5 py-5 grid grid-cols-4 gap-4 justify-items-center max-w-md mx-auto">
        {AREAS.map((a) => <StatCircle key={a.key} label={a.label} value={avg[a.key]} />)}
      </div>
      {!latest && (
        <p className="text-center text-[10px] text-gray-400 pb-3 -mt-2">Crea una Evaluación 360 en la pestaña PDI para ver los atributos</p>
      )}
    </div>
  );
}
