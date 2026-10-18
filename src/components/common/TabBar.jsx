import React from "react";
import { cn } from "@/lib/utils";

/**
 * Pestañas estándar del club (mismo aspecto que las pestañas de Radix de ui/tabs.jsx):
 * fondo gris, pestaña activa en granate con texto blanco.
 *
 * items: [{ value, label, short?, icon?, badge?, badgeClass? }]
 * fill:  reparte las pestañas a todo el ancho (rejilla); en móvil usa `short` si existe.
 */
export default function TabBar({ items, value, onChange, fill = false, className }) {
  const visible = items.filter(Boolean);
  return (
    <div
      className={cn(
        "gap-1 rounded-lg bg-gray-200/70 p-1 max-w-full",
        fill ? "grid" : "inline-flex overflow-x-auto",
        className
      )}
      style={fill ? { gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` } : undefined}
      role="tablist"
    >
      {visible.map(({ value: v, label, short, icon: Icon, badge, badgeClass }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            className={cn(
              "min-w-0 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors",
              fill && "flex-col sm:flex-row px-0.5 py-2 sm:py-2 text-[10px] sm:text-xs leading-tight gap-0.5 sm:gap-1.5",
              active ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-800 hover:bg-white/60"
            )}
            style={active ? { background: "var(--granate)" } : undefined}
          >
            {Icon && <Icon className={cn("shrink-0", fill ? "w-4 h-4 sm:w-3.5 sm:h-3.5" : "w-3.5 h-3.5")} />}
            {fill && short ? (
              <>
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{label}</span>
              </>
            ) : (
              <span>{label}</span>
            )}
            {badge > 0 && (
              <span className={cn("text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none", badgeClass || "bg-white/90 text-[var(--granate)]")}>
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
