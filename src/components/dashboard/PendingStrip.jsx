import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

/**
 * Fila compacta de "Pendientes": cosas que requieren atención.
 * items: [{ key, icon, count, label, cta, to, tone }]  (los de count 0 no se muestran)
 */
export default function PendingStrip({ items }) {
  const shown = items.filter((i) => i && i.count > 0);
  if (shown.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
        <CheckCircle2 className="w-4 h-4" /> Todo al día: no hay pendientes
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {shown.map(({ key, icon: Icon, count, label, cta, to, tone = "var(--naranja)", onClick }) => {
        const cls = "flex items-center gap-2 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow px-3 py-1.5 min-w-0";
        const style = { borderRadius: "6px", borderLeft: `3px solid ${tone}` };
        const body = (
          <>
            {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color: tone }} />}
            <span className="text-lg font-black leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{count}</span>
            <span className="text-xs text-gray-700">{label}</span>
            {cta && <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: "var(--granate)" }}>{cta} →</span>}
          </>
        );
        // Con onClick (p. ej. el listado por equipos de coordinación) se abre algo en la misma pantalla en vez de navegar
        return onClick
          ? <button key={key} type="button" onClick={onClick} className={`${cls} text-left`} style={style}>{body}</button>
          : <Link key={key} to={to} className={cls} style={style}>{body}</Link>;
      })}
    </div>
  );
}
