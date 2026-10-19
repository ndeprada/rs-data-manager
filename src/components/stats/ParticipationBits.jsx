import React from "react";
import { REASON_ORDER, reasonShort, NO_REASON, FORMAT_LABEL } from "@/lib/participation";

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

// Colores del nivel de minutos: rojo = por debajo del mínimo, ámbar = por debajo del objetivo (solo F11), verde = bien
export const LEVEL_STYLE = {
  alert: "bg-red-50 text-red-700 border-red-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  ok: "bg-green-50 text-green-700 border-green-200",
};

// Porcentaje de minutos con el color de su nivel (sin nivel, solo el número)
export function PctPill({ value, level, title }) {
  if (value == null) return <span className="text-gray-300">—</span>;
  if (!level) return <b title={title}>{value}%</b>;
  return (
    <span title={title} className={`inline-block min-w-9 px-1.5 py-0.5 rounded-sm border text-[11px] font-black tabular-nums ${LEVEL_STYLE[level]}`}>{value}%</span>
  );
}

// Texto de una alerta: «Fútbol 11: 29 % de los minutos disponibles (mínimo 35 %)»
export const alertText = (a) => `${FORMAT_LABEL[a.format]}: ${a.pct} % de los minutos disponibles (mínimo ${a.min} %)`;

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
