import React from "react";
import { REASON_ORDER, reasonShort, NO_REASON } from "@/lib/participation";

const REASON_STYLE = {
  lesion: "bg-red-50 text-red-700 border-red-200",
  enfermo: "bg-orange-50 text-orange-700 border-orange-200",
  sancion: "bg-gray-800 text-white border-gray-800",
  viaje: "bg-blue-50 text-blue-700 border-blue-200",
  estudios: "bg-purple-50 text-purple-700 border-purple-200",
  descanso: "bg-amber-50 text-amber-700 border-amber-200",
  decision_tecnica: "bg-amber-50 text-amber-700 border-amber-200",
  otro: "bg-gray-100 text-gray-600 border-gray-200",
  [NO_REASON]: "bg-white text-gray-400 border-dashed border-gray-300",
};

// Motivos de ausencia acumulados: «Lesión 3 · Viaje 1 · Sin motivo 2»
export function ReasonChips({ reasons = {} }) {
  const keys = [...REASON_ORDER, ...Object.keys(reasons).filter((k) => !REASON_ORDER.includes(k))].filter((k) => reasons[k] > 0);
  if (!keys.length) return <span className="text-gray-300">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {keys.map((k) => (
        <span key={k} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-[10px] font-semibold whitespace-nowrap ${REASON_STYLE[k] || REASON_STYLE.otro}`}>
          {reasonShort(k)} <b>{reasons[k]}</b>
        </span>
      ))}
    </span>
  );
}

// De más a menos cuartos jugados; el gris es «convocado y no jugó»
export const QUARTER_COLORS = { 4: "var(--granate)", 3: "#a8444d", 2: "#d58a90", 1: "#efc4c7", 0: "#d1d5db" };
const quarterWord = (q) => (q === 1 ? "1 cuarto" : `${q} cuartos`);

export function quartersTitle(b) {
  const parts = [4, 3, 2, 1].filter((q) => b.qHist[q] > 0).map((q) => `${quarterWord(q)}: ${b.qHist[q]}`);
  if (b.qHist[0] > 0) parts.push(`sin jugar: ${b.qHist[0]}`);
  return parts.join(" · ");
}

// Barra con la proporción de partidos según los cuartos que jugó (cuanto más oscura, más cuartos)
export function QuartersBar({ b, width = 88 }) {
  if (!b.qMatches) return <span className="text-gray-300">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5" title={quartersTitle(b)}>
      <span className="flex h-2.5 rounded-sm overflow-hidden bg-gray-100" style={{ width }}>
        {[4, 3, 2, 1, 0].map((q) => b.qHist[q] > 0 && (
          <span key={q} style={{ width: `${(b.qHist[q] / b.qMatches) * 100}%`, background: QUARTER_COLORS[q] }} />
        ))}
      </span>
      <span className="text-[11px] font-bold text-gray-700 tabular-nums">{b.qAvg != null ? b.qAvg.toFixed(1).replace(".", ",") : "—"}</span>
    </span>
  );
}

export function FormatPills({ value, onChange, options }) {
  return (
    <div className="flex items-center gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${active ? "text-white" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
            style={active ? { background: "var(--granate)", borderColor: "var(--granate)" } : undefined}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const FORMAT_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "f11", label: "Fútbol 11" },
  { value: "f7", label: "Fútbol 7" },
];
