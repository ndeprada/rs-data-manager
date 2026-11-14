// Piezas comunes de las pestañas de la ficha del jugador (diseño rs2, 14/11/2026)
import React from "react";
import { RS } from "@/components/rs2/kit";

export const AMBER = "#B45309";
export const SOFT_LINE = "1px solid #F3EEEE";

/** Tarjeta con título (raya naranja + letra del club) y algo a la derecha */
export function Box({ title, right, children, testId, style, newTag = false }) {
  return (
    <section className="rs2-card" style={{ padding: "10px 14px", minWidth: 0, ...style }} data-testid={testId}>
      {title && (
        <div className="flex flex-wrap items-center" style={{ gap: 6, marginBottom: 8 }}>
          <h2 style={{ margin: 0, borderLeft: `3px solid ${RS.naranja}`, paddingLeft: 7, lineHeight: 1 }}><span className="rs2-display" style={{ fontSize: 17, color: RS.granate }}>{title}</span></h2>
          {newTag}
          {right && <div className="flex flex-wrap items-center" style={{ marginLeft: "auto", gap: 6 }}>{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export const Chip = ({ children, bg = "#F1ECEC", fg = RS.ink2, testId, title, style }) => (
  <span data-testid={testId} title={title} style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap", ...style }}>{children}</span>
);
export const CHIP = {
  ok: ["#DCFCE7", "#15803D"], warn: ["#FEF3C7", "#92400E"], bad: ["#FEE2E2", "#B91C1C"], info: ["#DBEAFE", "#1D4ED8"], gray: ["#F1ECEC", RS.ink2],
};
export const Note = ({ children, style }) => <p style={{ fontSize: 11, color: RS.muted, margin: "6px 0 0", ...style }}>{children}</p>;
export const Empty = ({ children }) => <p style={{ fontSize: 12, color: RS.faint, margin: 0 }}>{children}</p>;

/** Botón pequeño (borde claro o granate lleno) */
export function SmallBtn({ children, onClick, primary = false, testId, disabled, title, style }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} data-testid={testId}
      style={{ font: "inherit", fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 8, whiteSpace: "nowrap", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
        border: `1px solid ${primary ? RS.granate : RS.line}`, background: primary ? RS.granate : "#fff", color: primary ? "#fff" : RS.granate, display: "inline-flex", alignItems: "center", gap: 5, ...style }}>
      {children}
    </button>
  );
}

/** Conmutador de pastillas: options = [[valor, texto]] */
export function Seg({ options, value, onChange, testPrefix }) {
  return (
    <span className="inline-flex flex-wrap" style={{ background: "#F1ECEC", borderRadius: 8, padding: 2, gap: 1 }}>
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <button key={v} type="button" onClick={() => onChange(v)} data-testid={testPrefix ? `${testPrefix}-${v}` : undefined} aria-pressed={on}
            style={{ font: "inherit", fontSize: 12, fontWeight: on ? 700 : 500, padding: "3px 10px", borderRadius: 6, border: 0, background: on ? "#fff" : "transparent", color: on ? RS.granate : RS.ink2, boxShadow: on ? "0 1px 2px rgba(0,0,0,.08)" : "none", whiteSpace: "nowrap" }}>
            {label}
          </button>
        );
      })}
    </span>
  );
}

export const Bar = ({ pct, color = RS.granate, h = 6, w }) => (
  <div style={{ height: h, background: "#F1ECEC", borderRadius: 9, flex: w ? "none" : 1, width: w, overflow: "hidden" }}>
    <div style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%`, height: "100%", background: color, borderRadius: 9 }} />
  </div>
);

export const Stars = ({ n = 0, of = 3, size = 12 }) => (
  <span style={{ letterSpacing: 1, fontSize: size, whiteSpace: "nowrap" }} aria-label={`${n}/${of}`}>
    <span style={{ color: "#D97706" }}>{"★".repeat(n)}</span><span style={{ color: "#D9CFCF" }}>{"★".repeat(Math.max(0, of - n))}</span>
  </span>
);

/** Tabla compacta: th y td con el estilo de la ficha */
export const th = (align = "left") => ({ textAlign: align, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: RS.muted, padding: "6px 6px", borderBottom: `1px solid ${RS.line}`, whiteSpace: "nowrap" });
export const td = (extra) => ({ padding: "6px 6px", borderTop: SOFT_LINE, fontSize: 12.5, verticalAlign: "middle", ...extra });

/** Dos columnas que se apilan en pantallas estrechas */
export function Cols({ left, right, ratio = "2.1fr 1fr", mobile }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: mobile ? "1fr" : `minmax(0, ${ratio.split(" ")[0]}) minmax(0, ${ratio.split(" ")[1]})`, gap: 12, alignItems: "start" }}>
      <div className="flex flex-col" style={{ gap: 12, minWidth: 0 }}>{left}</div>
      <div className="flex flex-col" style={{ gap: 12, minWidth: 0 }}>{right}</div>
    </div>
  );
}
