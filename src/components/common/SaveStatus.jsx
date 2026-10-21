import React from "react";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/i18n";

// Estado del guardado automático (ver useAutosave)
export default function SaveStatus({ state, onRetry, className = "" }) {
  const t = useT();
  if (state === "error") {
    return (
      <span className={`text-[11px] text-red-600 flex items-center gap-1.5 ${className}`}>
        <AlertTriangle className="w-3 h-3" /> {t("No se ha podido guardar")}
        {onRetry && <button type="button" onClick={onRetry} className="underline font-semibold">{t("Reintentar")}</button>}
      </span>
    );
  }
  const text = state === "saving" || state === "pending" ? t("Guardando…") : state === "saved" ? t("✓ Guardado") : t("Se guarda solo");
  return <span className={`text-[11px] ${state === "saved" ? "text-green-600 font-semibold" : "text-gray-400"} ${className}`} aria-live="polite">{text}</span>;
}
