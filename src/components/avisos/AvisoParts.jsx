// Piezas de Avisos (diseño rs2). Estilos en línea para que sirvan también en la pantalla de las familias.
import React from "react";
import { format, isToday, isYesterday } from "date-fns";
import { RS } from "@/components/rs2/kit";
import { kindInfo, readLevel, READ_COLORS, KINDS } from "@/lib/noticeUi";
import { useT, useDateLocale } from "@/i18n";

export function KindChip({ kind, testId }) {
  const t = useT();
  const k = kindInfo(kind);
  return (
    <span data-testid={testId} style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 999, background: k.bg, color: k.fg, whiteSpace: "nowrap", lineHeight: "18px" }}>
      {t(k.label)}
    </span>
  );
}

// «Hoy 18:40» · «Ayer 20:15» · «11 nov 19:02»
export function useWhen() {
  const t = useT();
  const locale = useDateLocale();
  return (d) => {
    if (!d) return "";
    const date = new Date(d);
    const hm = format(date, "HH:mm");
    if (isToday(date)) return `${t("Hoy")} ${hm}`;
    if (isYesterday(date)) return `${t("Ayer")} ${hm}`;
    return format(date, "d MMM HH:mm", { locale });
  };
}

/** Barra de lectura «35/41 leído» */
export function ReadBar({ read, total, testId }) {
  const t = useT();
  const color = READ_COLORS[readLevel(read, total)];
  const pct = total ? Math.round((read / total) * 100) : 0;
  return (
    <span className="inline-flex items-center" style={{ gap: 6, whiteSpace: "nowrap" }} data-testid={testId} title={t("{pct} % lo ha leído", { pct })}>
      <span style={{ width: 60, height: 5, borderRadius: 3, background: RS.lineSoft, overflow: "hidden", display: "inline-block" }}>
        <span style={{ display: "block", width: `${pct}%`, height: "100%", background: color }} />
      </span>
      <b className="tabular-nums" style={{ color, fontSize: 13 }}>{read}/{total}</b>
      <span style={{ fontSize: 12, color: RS.muted }}>{t("leído")}</span>
    </span>
  );
}

/** Interruptor en pastillas (Todos · Míos) */
export function Seg({ options, value, onChange, testPrefix }) {
  const t = useT();
  return (
    <span className="inline-flex flex-wrap" style={{ background: RS.soft, borderRadius: 999, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} data-testid={testPrefix ? `${testPrefix}-${o.value}` : undefined}
            style={{ border: "none", borderRadius: 999, padding: "4px 11px", fontSize: 12, fontWeight: on ? 700 : 500, cursor: "pointer",
              background: on ? "#fff" : "transparent", color: on ? RS.granate : RS.ink2, boxShadow: on ? "0 1px 2px rgba(0,0,0,.08)" : "none" }}>
            {typeof o.label === "string" ? t(o.label) : o.label}
          </button>
        );
      })}
    </span>
  );
}

export const kindOptions = (present = null) => [
  { value: "all", label: "Todos los tipos" },
  ...KINDS.filter((k) => !present || present.has(k.key)).map((k) => ({ value: k.key, label: k.label })),
];

/** Pastilla de selección (equipos, grupos, plantillas) */
export function Pick({ on, onClick, children, testId, strong = false, dashed = false }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId}
      style={{ border: `1px ${dashed ? "dashed" : "solid"} ${on ? RS.granate : RS.input}`, background: on ? RS.granate : "#fff", color: on ? "#fff" : RS.ink2,
        borderRadius: 999, padding: "4px 11px", fontSize: 12.5, fontWeight: on || strong ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}

export const Lab = ({ children, right }) => (
  <div className="flex items-center" style={{ gap: 8, marginBottom: 6 }}>
    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: RS.muted }}>{children}</span>
    {right}
  </div>
);
