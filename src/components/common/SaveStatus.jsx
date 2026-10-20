import React from "react";
import { AlertTriangle } from "lucide-react";

// Estado del guardado automático (ver useAutosave)
export default function SaveStatus({ state, onRetry, className = "" }) {
  if (state === "error") {
    return (
      <span className={`text-[11px] text-red-600 flex items-center gap-1.5 ${className}`}>
        <AlertTriangle className="w-3 h-3" /> No se ha podido guardar
        {onRetry && <button type="button" onClick={onRetry} className="underline font-semibold">Reintentar</button>}
      </span>
    );
  }
  const text = state === "saving" || state === "pending" ? "Guardando…" : state === "saved" ? "✓ Guardado" : "Se guarda solo";
  return <span className={`text-[11px] ${state === "saved" ? "text-green-600 font-semibold" : "text-gray-400"} ${className}`} aria-live="polite">{text}</span>;
}
