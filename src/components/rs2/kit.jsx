// Piezas del diseño «rs2» (las maquetas de Planificación aprobadas por Nacho el 27-28/10/2026). Estilos en src/styles/rs2.css.
// Textos de Planificación solo en español (bloque 5 de idiomas pendiente).
import React from "react";
import { Search } from "lucide-react";
import "@/styles/rs2.css";

export const RS = {
  granate: "#73000A", granateDark: "#36000D", naranja: "#FF6E00",
  bg: "#F5F2F1", line: "#E6DEDD", lineSoft: "#EEE7E6", head: "#FBF8F8", soft: "#F3ECEB",
  ink: "#1E1416", ink2: "#4A3D3F", muted: "#6B5E60", faint: "#9A8C8E", input: "#D9CFCE",
  orangeSoft: "#FFE7D6", orangeInk: "#8A3A00",
};

// Decisión de scouting con la escala de Nacho (A/B/C); las claves son las de siempre
export const DECISION = {
  fichar: { letter: "A", label: "Fichar", chip: { background: RS.granate, color: "#fff" } },
  seguir_viendo: { letter: "B", label: "Seguir viendo", chip: { background: RS.orangeSoft, color: RS.orangeInk } },
  descartar: { letter: "C", label: "Descartado", chip: { background: "#ECE8E8", color: "#5A5052" } },
};
export const DECISION_KEYS = ["fichar", "seguir_viendo", "descartar"];

// Origen del jugador en seguimiento
export const ORIGIN = {
  fcf: "Detectado FCF",
  visto: "Visto por nosotros",
  ofrecido: "Ofrecido",
  promocionado: "Promocionado del club",
};
export const ORIGIN_KEYS = ["fcf", "visto", "ofrecido", "promocionado"];
export const originOf = (p) => (p?.origin && ORIGIN[p.origin] ? p.origin : p?.source === "fcf" || p?.fcf_id ? "fcf" : "visto");

/** Fondo de la página a todo lo ancho (la app pone margen alrededor de cada pantalla) */
export function Page({ children, testId }) {
  return (
    <div className="rs2 -m-3 md:-m-4 min-h-[calc(100vh-4rem)] lg:min-h-screen" data-testid={testId}>{children}</div>
  );
}

/** Barra blanca superior: título grande + pestañas subrayadas (p. ej. PLANIFICACIÓN · Plantillas · Scouting) */
export function TopBar({ title, tabs = [], active, onTab, children }) {
  return (
    <div style={{ background: "#fff", borderBottom: `1px solid ${RS.line}` }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 24px" }} className="flex flex-col">
        <div className="flex flex-wrap items-center" style={{ gap: "4px 28px", borderBottom: children ? `1px solid ${RS.lineSoft}` : "none" }}>
          <span className="rs2-display" style={{ fontSize: 24, color: RS.granateDark, padding: "12px 0" }}>{title}</span>
          {tabs.length > 0 && (
            <nav aria-label={title} className="flex" style={{ gap: 20 }}>
              {tabs.map((t) => {
                const on = t.key === active;
                return (
                  <button key={t.key} type="button" onClick={() => onTab(t.key)} data-testid={t.testId}
                    style={{ color: on ? RS.granate : RS.ink2, fontSize: 16, fontWeight: on ? 700 : 400, padding: "14px 2px 11px", borderBottom: `3px solid ${on ? RS.granate : "transparent"}`, background: "none" }}>
                    {t.label}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Pestañas tipo pastilla (Resumen · Base de datos · …), con número opcional */
export function SubNav({ items, active, onChange, label = "Secciones" }) {
  return (
    <nav aria-label={label} className="flex flex-wrap" style={{ gap: 6, padding: "10px 0" }}>
      {items.map((it) => {
        const on = it.key === active;
        return (
          <button key={it.key} type="button" onClick={() => onChange(it.key)} data-testid={`sub-${it.key}`}
            className="inline-flex items-center"
            style={{ gap: 8, minHeight: 40, padding: "0 14px", borderRadius: 8, fontSize: 14, fontWeight: on ? 600 : 400,
              background: on ? RS.granate : RS.bg, color: on ? "#fff" : RS.ink2 }}>
            {it.label}
            {it.badge > 0 && <span style={{ background: RS.naranja, color: RS.ink, fontWeight: 700, fontSize: 12, padding: "1px 7px", borderRadius: 999 }}>{it.badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}

export function Card({ title, action, children, className = "", bodyClass = "", pad = true, id, testId }) {
  return (
    <section className={`rs2-card ${className}`} id={id} data-testid={testId} style={pad ? { padding: "14px 18px" } : { overflow: "hidden" }}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between" style={{ gap: 8, ...(pad ? { marginBottom: 6 } : { padding: "14px 18px" }) }}>
          {title && <h2 className="rs2-title">{title}</h2>}
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, sub, testId }) {
  return (
    <div className="rs2-card flex flex-col" style={{ padding: "14px 18px", gap: 2 }} data-testid={testId}>
      <span style={{ fontSize: 13, color: RS.muted }}>{label}</span>
      <span className="rs2-display tabular-nums" style={{ fontSize: 38, lineHeight: 1.05, color: RS.granateDark }}>{value}</span>
      {sub && <span style={{ fontSize: 13, color: RS.ink2 }}>{sub}</span>}
    </div>
  );
}

export function Chip({ children, style, title, testId }) {
  return (
    <span title={title} data-testid={testId} style={{ display: "inline-block", fontSize: 13, fontWeight: 600, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", ...style }}>
      {children}
    </span>
  );
}

export function DecisionChip({ decision, short = false, empty = "Sin valorar" }) {
  const d = DECISION[decision];
  if (!d) return <span style={{ fontSize: 13, color: RS.faint }}>{empty}</span>;
  return <Chip style={d.chip}>{d.letter} · {short ? d.label.split(" ")[0] : d.label}</Chip>;
}

export function Tag({ children, kind = "dark", title }) {
  const s = {
    dark: { background: RS.granateDark, color: "#fff" },
    orange: { background: RS.naranja, color: RS.ink },
  }[kind];
  return <span title={title} style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", padding: "3px 7px", borderRadius: 4, whiteSpace: "nowrap", ...s }}>{children}</span>;
}

/** Año de nacimiento: granate pálido; naranja si juega por arriba; «—» si no se sabe */
export function YearBadge({ year, up = false, estimated = false }) {
  if (!year) return <span style={{ color: RS.faint }} title="Año pendiente de deducir">—</span>;
  return (
    <span title={estimated ? "Estimado por las competiciones en las que juega" : undefined}
      style={{ display: "inline-block", fontWeight: 700, fontSize: 14, padding: "3px 9px", borderRadius: 6, background: up ? RS.naranja : RS.soft, color: up ? RS.ink : RS.granateDark }}>
      {year}
    </span>
  );
}

/** Botones de opción (Todos · F11 · F7 …) */
export function Pills({ options, value, onChange, size = 36 }) {
  return (
    <div className="flex flex-wrap" style={{ gap: 6 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} data-testid={o.testId}
            style={{ height: size, padding: "0 12px", borderRadius: 999, fontSize: 13, fontWeight: on ? 600 : 400,
              border: `1px solid ${on ? RS.granate : RS.input}`, background: on ? RS.granate : "#fff", color: on ? "#fff" : RS.ink2 }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, testId, big = false, autoFocus }) {
  return (
    <label className="flex items-center" style={{ gap: 10, background: "#fff", borderRadius: 10, padding: "0 14px", height: big ? 48 : 44, border: big ? "none" : `1px solid ${RS.input}`, flex: "999 1 260px" }}>
      <Search width={18} height={18} color={RS.muted} aria-hidden="true" />
      <span className="sr-only">{placeholder}</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={testId} autoFocus={autoFocus}
        style={{ flex: 1, border: "none", outline: "none", font: "inherit", fontSize: big ? 16 : 15, color: RS.ink, background: "transparent", height: "100%", minWidth: 0 }} />
    </label>
  );
}

export function Btn({ children, onClick, kind = "primary", disabled, testId, type = "button", title, style }) {
  const s = {
    primary: { background: RS.granate, color: "#fff", border: "none" },
    orange: { background: RS.naranja, color: RS.ink, border: "none", fontWeight: 700 },
    outline: { background: "#fff", color: RS.granate, border: `1px solid ${RS.granate}` },
    ghost: { background: "#fff", color: RS.ink2, border: `1px solid ${RS.input}`, fontWeight: 400 },
    onDark: { background: "transparent", color: "#fff", border: "1px solid #fff" },
  }[kind];
  return (
    <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} title={title}
      className="inline-flex items-center justify-center disabled:opacity-50"
      style={{ height: 44, gap: 8, padding: "0 16px", borderRadius: 8, fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", ...s, ...style }}>
      {children}
    </button>
  );
}

export function Empty({ children }) {
  return <p style={{ margin: 0, padding: "10px 0", fontSize: 14, color: RS.faint }}>{children}</p>;
}

export function BackLink({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center self-start" style={{ gap: 6, fontSize: 14, color: RS.granate, background: "none", fontWeight: 600 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={RS.granate} strokeWidth="2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
      {children}
    </button>
  );
}

export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("es-ES", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
export const seasonShort = (s) => String(s || "").replace("-20", "-");
