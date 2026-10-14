import React from "react";
import { Eye, Lock } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

// Selector obligatorio: ¿lo puede ver el jugador? value: true | false | null (sin decidir)
export function VisibilityField({ value, onChange, error }) {
  const opt = (v, label, Icon, on) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-md border transition-colors ${value === v ? on : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
  return (
    <div className={`rounded-lg border p-2.5 ${error && value == null ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">¿Lo puede ver el jugador? *</p>
      <div className="flex gap-2">
        {opt(true, "Visible para el jugador", Eye, "bg-green-50 text-green-700 border-green-300")}
        {opt(false, "Solo interno (borrador)", Lock, "bg-gray-100 text-gray-700 border-gray-400")}
      </div>
      {error && value == null && <p className="text-[11px] text-red-600 mt-1">Elige si el jugador podrá verlo.</p>}
    </div>
  );
}

// Botón/etiqueta rápida para cambiar la visibilidad en las listas
export function VisibilityBadge({ value, onToggle, readOnly }) {
  const visible = value === true;
  const cls = visible ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200";
  const content = <>{visible ? <Eye className="w-3 h-3" /> : <Lock className="w-3 h-3" />}{visible ? "Visible" : "Interno"}</>;
  if (readOnly || !onToggle) return <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>{content}</span>;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(!visible); }} title={visible ? "Visible para el jugador: pulsa para ocultar" : "Solo interno: pulsa para hacerlo visible al jugador"}
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border hover:opacity-80 ${cls}`}>
      {content}
    </button>
  );
}
