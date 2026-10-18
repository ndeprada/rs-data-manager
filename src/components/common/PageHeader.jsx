import React from "react";
import { cn } from "@/lib/utils";

/**
 * Cabecera estándar de todas las secciones del club:
 *   etiqueta pequeña (kicker) + título en Racing Sarria + subtítulo + acciones a la derecha.
 * El título (h1) ya sale en granate y Racing Sarria por la hoja de estilos global.
 */
/** Solo el bloque de título (etiqueta + título + subtítulo), para usarlo dentro de una cabecera propia. */
export function PageTitle({ kicker, title, subtitle, before, className }) {
  return (
    <div className={cn("min-w-0", className)}>
      {before}
      {kicker && (
        <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
          {kicker}
        </p>
      )}
      <h1 className="text-3xl leading-none">{title}</h1>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function PageHeader({ actions, className, ...title }) {
  return (
    <div className={cn("flex flex-wrap items-start sm:items-center justify-between gap-x-4 gap-y-3", className)}>
      <PageTitle {...title} />
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
