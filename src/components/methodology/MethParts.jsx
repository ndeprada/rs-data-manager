// Piezas comunes de Metodología con el diseño rs2 (13/11/2026).
import React from "react";
import { RS } from "@/components/rs2/kit";
import { Head } from "@/components/rs2/dashParts";
import { BLOCKS, BLOCK_GROUPS, blockInfo, contentBlock, contentName, sessionTypeInfo } from "@/lib/sessionPlan";
import { useT } from "@/i18n";

export const OK = "#15803D", WARN = "#B45309", NO = "#B91C1C";
export const card = { background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 12 };
export const TH = { fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: RS.muted, padding: "6px 8px", textAlign: "left" };
export const btnStyle = (primary, extra = {}) => ({
  font: "inherit", fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, display: "inline-flex", gap: 6, alignItems: "center", whiteSpace: "nowrap",
  ...(primary ? { border: 0, background: RS.granate, color: "#fff" } : { border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink2 }), ...extra,
});

export function Kpi({ n, label, sub, color, testId }) {
  return (
    <div data-testid={testId} style={{ flex: "1 1 150px", display: "flex", alignItems: "baseline", gap: 8, padding: "8px 12px", ...card, borderRadius: 10 }}>
      <span className="rs2-display tabular-nums" style={{ fontSize: 24, color: color || RS.granateDark, whiteSpace: "nowrap" }}>{n}</span>
      <span style={{ fontSize: 12, color: RS.ink2, lineHeight: 1.15 }}>{label}{sub && <span style={{ display: "block", fontSize: 11, color: RS.muted }}>{sub}</span>}</span>
    </div>
  );
}

export function Box({ title, right, children, testId, style }) {
  return (
    <section style={{ ...card, minWidth: 0, ...style }} data-testid={testId}>
      {title && <Head title={title} right={right} />}
      {children}
    </section>
  );
}

export function PillBtn({ on, onClick, children, testId, title }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} title={title} aria-pressed={on}
      style={{ border: `1px solid ${on ? RS.granate : RS.line}`, background: on ? RS.granate : "#fff", color: on ? "#fff" : RS.ink2, borderRadius: 999, padding: "4px 11px", fontSize: 12, fontWeight: on ? 700 : 500, whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}

export function Seg({ options, value, onChange, testPrefix }) {
  return (
    <div style={{ display: "flex", gap: 3, background: RS.soft, borderRadius: 999, padding: 3 }}>
      {options.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)} data-testid={testPrefix ? `${testPrefix}-${k}` : undefined} aria-pressed={value === k}
          style={{ font: "inherit", fontSize: 11, padding: "3px 10px", borderRadius: 999, border: 0, whiteSpace: "nowrap", ...(value === k ? { background: "#fff", color: RS.granate, fontWeight: 700, boxShadow: "0 1px 2px rgba(0,0,0,.08)" } : { background: "none", color: RS.ink2 }) }}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function TypeChip({ type }) {
  const t = useT();
  const info = sessionTypeInfo(type);
  if (!info) return null;
  return <span title={info.full} style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, background: info.color, color: info.ink || "#fff", whiteSpace: "nowrap" }}>{t(info.label)}</span>;
}

// Barra apilada con el reparto por bloques (orden de BLOCKS: ataque, defensa, técnica y hábitos, balón parado)
export function MixBar({ mix = [], width = 120, height = 7, title }) {
  const total = mix.reduce((n, x) => n + x.minutes, 0);
  return (
    <span title={title} style={{ display: "inline-flex", width, height, borderRadius: 9, overflow: "hidden", background: "#F1ECEC", verticalAlign: "middle", flex: "none" }}>
      {total > 0 && mix.map((x) => <span key={x.block} style={{ width: `${(x.minutes / total) * 100}%`, background: blockInfo(x.block)?.color }} />)}
    </span>
  );
}

// Leyenda de los colores por familias
export function BlockLegend() {
  const t = useT();
  return (
    <div className="flex flex-wrap" style={{ gap: "4px 14px", fontSize: 11, color: RS.muted }}>
      {BLOCK_GROUPS.map((g) => (
        <span key={g.id} className="inline-flex items-center" style={{ gap: 5 }}>
          <span className="inline-flex" style={{ gap: 1 }}>{BLOCKS.filter((b) => b.group === g.id).map((b) => <span key={b.id} style={{ width: 9, height: 9, borderRadius: 2, background: b.color }} />)}</span>
          {t(g.label)}
        </span>
      ))}
    </div>
  );
}

// Contenido como etiqueta (principal en granate claro; secundario en gris con «· sec.»)
export function ContentTag({ id, sec = false, custom }) {
  const t = useT();
  const b = blockInfo(contentBlock(id, { custom_contents: custom }));
  return (
    <span title={b?.label} style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 999, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%",
      ...(sec ? { background: RS.soft, color: RS.muted } : { background: "#FDF2F4", color: RS.granate, fontWeight: 600 }) }}>
      <span style={{ width: 6, height: 6, borderRadius: 9, background: b?.color || "#999", flex: "none" }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{contentName(id, { custom_contents: custom })}{sec ? ` · ${t("sec.")}` : ""}</span>
    </span>
  );
}

export const IconBtn = ({ children, onClick, title, danger, disabled, testId }) => (
  <button type="button" onClick={onClick} title={title} aria-label={title} disabled={disabled} data-testid={testId}
    style={{ width: 30, height: 30, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1px solid ${RS.line}`, background: "#fff", color: danger ? NO : RS.ink2, opacity: disabled ? 0.5 : 1 }}>
    {children}
  </button>
);
