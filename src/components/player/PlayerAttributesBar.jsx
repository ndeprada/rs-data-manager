import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { AREAS, areasFor, computeAverages, scoreColor } from "@/lib/eval360";
import { useT, useFormat } from "@/i18n";

// Círculo estilo FIFA; value en escala 1-10
function StatCircle({ label, value }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const pct = value == null ? 0 : value * 10;
  const color = scoreColor(value);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-12 h-12">
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

export default function PlayerAttributesBar({ playerId, position }) {
  const t = useT();
  const { tag } = useFormat();
  const { data: evals = [] } = useQuery({
    queryKey: ["eval360", playerId],
    queryFn: () => base44.entities.Evaluation360.filter({ player_id: playerId }, "-date"),
  });
  const latest = evals[0] ?? null;
  const avg = computeAverages(latest?.scores, areasFor(position));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{t("Atributos")}</span>
          <span className="inline-flex items-center justify-center min-w-7 h-7 px-1 rounded-lg text-xs font-black text-white shadow-sm" style={{ background: "linear-gradient(135deg, #73000A, #36000D)" }}>
            {avg.overall ?? "—"}
          </span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: latest ? "#f0fdf4" : "#f3f4f6", color: latest ? "#16a34a" : "#9ca3af" }}>
          {latest ? `360 · ${latest.period || (latest.date ? new Date(latest.date).toLocaleDateString(tag, { month: "short", year: "numeric" }) : "")}` : t("Sin Evaluación 360")}
        </span>
      </div>
      <div className="px-3 py-3 grid grid-cols-4 gap-2 justify-items-center">
        {AREAS.map((a) => <StatCircle key={a.key} label={t(a.label)} value={avg[a.key]} />)}
      </div>
      {!latest && (
        <p className="text-center text-[10px] text-gray-400 pb-2 -mt-1">{t("Se rellena con la Evaluación 360 (pestaña PDI)")}</p>
      )}
    </div>
  );
}
