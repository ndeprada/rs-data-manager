import React from "react";
import { STAT_SCOPES } from "@/lib/matchStatus";

// Elige de qué partidos salen las estadísticas: liga (competición oficial), torneos o amistosos.
export default function StatsScopePills({ value, onChange, className = "" }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {STAT_SCOPES.map((s) => {
        const active = value === s.value;
        return (
          <button key={s.value} type="button" onClick={() => onChange(s.value)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${active ? "text-white" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
            style={active ? { background: "var(--granate)", borderColor: "var(--granate)" } : undefined}>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
