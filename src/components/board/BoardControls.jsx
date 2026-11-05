import React, { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CHIP_TEXT_SIZES, cleanTextSize } from "@/lib/board";

// Controles pequeños para los paneles de la pizarra: color (paleta + cualquier color), deslizador, botones de opción e
// interruptor. Pensados para móvil: alto mínimo de 28 px y sin ventanas flotantes (la paleta se despliega en línea).

export const PALETTE = [
  "#73000A", "#dc2626", "#f97316", "#f59e0b", "#fde047", "#84cc16",
  "#16a34a", "#0d9488", "#06b6d4", "#2563eb", "#1e3a8a", "#7c3aed",
  "#ec4899", "#92400e", "#ffffff", "#9ca3af", "#374151", "#111827",
];

const norm = (c) => String(c || "").toLowerCase();

/**
 * Selector de color: botón con el color actual; al tocarlo se despliega la paleta y un selector libre (cualquier color).
 * `auto` (opcional) añade «Automático» para volver al color por defecto (value vacío).
 */
// Muestra de «sin color» (sin fondo, sin peto…): cuadritos, como en los programas de dibujo
export const NO_FILL = "repeating-conic-gradient(#d1d5db 0 25%, #ffffff 0 50%) 50% / 8px 8px";

export function ColorPick({ value, onChange, label = "Color", auto = null, autoSwatch = "#9ca3af", wide = false }) {
  const [open, setOpen] = useState(false);
  const shown = value || autoSwatch;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`h-7 pl-1 pr-1.5 rounded-md border bg-white flex items-center gap-1 text-[11px] text-gray-600 ${open ? "border-gray-900" : "border-gray-200 hover:bg-gray-50"}`}
      >
        <span className="w-[18px] h-[18px] rounded-full border border-black/20 shrink-0" style={{ background: shown }} />
        {wide && <span className="font-semibold">{label}</span>}
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="basis-full w-full flex flex-wrap items-center gap-1 rounded-md bg-white border border-gray-200 p-1.5" role="group" aria-label={label}>
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => onChange(c)}
              className="w-6 h-6 rounded-full border border-black/20 flex items-center justify-center"
              style={{ background: c }}
            >
              {norm(value) === c && <Check className="w-3.5 h-3.5" style={{ color: c === "#ffffff" || c === "#fde047" ? "#111827" : "#ffffff" }} />}
            </button>
          ))}
          <label
            className="relative w-6 h-6 rounded-full border border-black/20 cursor-pointer overflow-hidden"
            style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
            title="Cualquier otro color"
          >
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(value || "") ? value : "#336699"}
              onChange={(e) => onChange(e.target.value)}
              aria-label="Cualquier otro color"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
          {auto && (
            <button type="button" onClick={() => onChange("")} className={`h-6 px-2 rounded-full border text-[11px] font-semibold ${value ? "border-gray-200 text-gray-600 bg-white" : "border-gray-900 bg-gray-900 text-white"}`}>
              {auto}
            </button>
          )}
        </div>
      )}
    </>
  );
}

/** Deslizador con nombre y valor. `fmt` da formato al valor que se muestra. */
export function Slider({ label, value, min, max, step = 0.1, onChange, fmt = (v) => v, width = "w-24" }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-gray-600 min-h-7">
      <span className="font-semibold">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className={`${width} accent-[var(--granate)]`}
      />
      <span className="tabular-nums w-9 text-gray-500">{fmt(value)}</span>
    </label>
  );
}

/** Tamaño de letra de un texto de ficha: casilla para escribir cualquier tamaño (3–30; 10 = el normal) y ▾ con los tamaños
 * típicos (5, 6, 8, 10, 12, 14), que se despliegan en línea. `mixed` = varias fichas con tamaños distintos. */
export function TextSizePick({ label, value, mixed = false, onChange, testid }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const cur = cleanTextSize(value) ?? 10;
  const shown = draft ?? (mixed ? "" : String(cur).replace(".", ","));
  const set = (n) => onChange(n == null || n === 10 ? undefined : n);
  return (
    <div className="min-w-0" data-testid={testid}>
      <span className="block text-[10px] font-semibold text-gray-500 truncate">{label}</span>
      <div className="flex items-center gap-0.5">
        <input
          type="text"
          inputMode="decimal"
          value={shown}
          placeholder={mixed ? "varios" : "10"}
          aria-label={`Tamaño de letra: ${label}`}
          onFocus={(e) => e.target.select()}
          onChange={(e) => { const t = e.target.value; setDraft(t); const n = cleanTextSize(t.replace(",", ".")); if (n != null && Number(t.replace(",", ".")) >= 3) set(n); }}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          className="h-7 w-full min-w-0 rounded-md border border-gray-200 px-1.5 text-xs text-center tabular-nums"
        />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Tamaños de letra: ${label}`} title="Tamaños típicos" className="h-7 w-6 shrink-0 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="mt-1 grid grid-cols-3 gap-0.5" role="group" aria-label={`Tamaños típicos: ${label}`}>
          {CHIP_TEXT_SIZES.map((n) => (
            <button key={n} type="button" onClick={() => { set(n); setDraft(null); setOpen(false); }} aria-pressed={!mixed && cur === n} className={`h-6 rounded text-[11px] font-semibold tabular-nums border ${!mixed && cur === n ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}>{n}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Botones de opción excluyentes. options: [{ id, label }] */
export function Seg({ value, options, onChange, label }) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-white" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`h-7 px-2 text-[11px] font-semibold border-r last:border-r-0 border-gray-200 ${value === o.id ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Interruptor con nombre (sí/no). */
export function Toggle({ on, onChange, children, title }) {
  return (
    <button
      type="button"
      aria-pressed={!!on}
      title={title}
      onClick={() => onChange(!on)}
      className={`h-7 px-2 rounded-md border text-[11px] font-semibold ${on ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
    >
      {children}
    </button>
  );
}

/** Fila con título pequeño y controles en línea. */
export function Row({ title, children }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {title && <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold w-full sm:w-auto sm:min-w-[64px]">{title}</span>}
      {children}
    </div>
  );
}

/** Icono de portería (marco con red) para la barra de herramientas. */
// Balón de fútbol (blanco con pentágono central), para que se reconozca en la barra de herramientas
export function BallIcon({ className = "", style }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" fill="#fff" stroke="#111" strokeWidth="1.6" />
      <path d="M12 8.3l3.5 2.55-1.34 4.12H9.84L8.5 10.85z" fill="#111" />
      <path d="M12 8.3V3.2M15.5 10.85l4.6-1.7M14.16 14.97l2.9 4.1M9.84 14.97l-2.9 4.1M8.5 10.85l-4.6-1.7" stroke="#111" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

export function GoalIcon({ className = "", style }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d="M3 19V6h18v13" />
      <path d="M3 11h18M3 15.5h18M8 6v13M13 6v13M18 6v13" strokeWidth="1.1" />
    </svg>
  );
}

const icon = (children) => function Icon({ className = "", style }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      {children}
    </svg>
  );
};

/** Iconos del material de entrenamiento para la barra de herramientas. */
export const PoleIcon = icon(<><path d="M12 3v14" /><ellipse cx="12" cy="19.5" rx="5" ry="2" /></>);
export const HurdleIcon = icon(<><path d="M4 8h16" /><path d="M6.5 8v11M17.5 8v11" /><path d="M3.5 19h6M14.5 19h6" /></>);
export const LadderIcon = icon(<><path d="M8 3v18M16 3v18" /><path d="M8 7h8M8 11.5h8M8 16h8" strokeWidth="1.6" /></>);
export const DummyIcon = icon(<><circle cx="12" cy="6.5" r="3" /><path d="M6 21v-5a6 6 0 0 1 12 0v5z" /></>);
