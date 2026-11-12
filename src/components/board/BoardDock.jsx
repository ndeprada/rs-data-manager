import React, { useState } from "react";
import { Star, SlidersHorizontal, Trash2, Check, Minus, Plus } from "lucide-react";
import { ARROW_W, BALL_PATTERNS, ballStyle } from "@/lib/board";
import { BallGlyph, styleOf } from "./BoardSvg";
import { PALETTE } from "./BoardControls";
import { C as clubColor } from "@/lib/brand";

// Segunda columna de la pizarra (05/11/2026, Nacho: «al clicar en el icono de flecha… que me salga otra columna con todos los
// tipos de flechas dibujadas… y una barra final donde pueda seleccionar el grosor, el color y el borde, y una estrellita para
// marcar como predeterminado… la tarjeta de ahora ocupa mucho y tapa el campo»). Va pegada a la barra izquierda: arriba los
// tipos dibujados y abajo lo básico; «Más opciones» abre el panel completo de siempre.
const D = { bg: clubColor.deep, tile: "#fbf7f6", tileOn: clubColor.accent, line: "#7a2a2f", text: "#F7E9E4", sub: "#E2C3BA", on: clubColor.accent, onInk: "#2a0009", btn: "rgba(42,0,9,0.94)" };

const ARROW_SAMPLES = {
  move: { label: "Desplazamiento", dash: "3 2.2", wavy: false, air: false },
  pass: { label: "Pase", dash: null, wavy: false, air: false },
  air: { label: "Pase aéreo", dash: null, wavy: false, air: true },
  dribble: { label: "Conducción", dash: null, wavy: true, air: false },
};

function ArrowSample({ v, color, width = 1 }) {
  const w = 1.6 + width * 2.2;
  const d = v.wavy ? "M6 18 q4 -6 8 0 t8 0 t8 0 t8 0 t8 0" : v.air ? "M6 20 Q30 0 52 14" : "M6 18 L50 10";
  const end = v.wavy ? { x: 54, y: 18, a: 0 } : v.air ? { x: 54, y: 15, a: 32 } : { x: 54, y: 9.3, a: -10 };
  return (
    <svg viewBox="0 0 64 26" width="64" height="26" aria-hidden="true">
      {v.air && <path d="M6 20 L52 15" stroke="#9ca3af" strokeWidth={1.4} strokeDasharray="2 2" fill="none" opacity={0.7} />}
      <path d={d} stroke={color} strokeWidth={w} strokeDasharray={v.dash || undefined} fill="none" strokeLinecap="round" />
      <path d="M0 0 L-7 -4 L-5.5 0 L-7 4 Z" fill={color} transform={`translate(${end.x} ${end.y}) rotate(${end.a})`} />
    </svg>
  );
}
function ZoneSample({ shape, fill, stroke }) {
  return (
    <svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true">
      {shape === "ellipse" ? <ellipse cx="32" cy="15" rx="24" ry="11" fill={fill} fillOpacity={0.35} stroke={stroke} strokeWidth={1.4} />
        : shape === "quad" ? <path d="M10 8 L52 4 L56 25 L14 22 Z" fill={fill} fillOpacity={0.35} stroke={stroke} strokeWidth={1.4} />
          : <rect x="8" y="5" width="48" height="20" rx="1.5" fill={fill} fillOpacity={0.35} stroke={stroke} strokeWidth={1.4} />}
    </svg>
  );
}
function MaterialSample({ id, color }) {
  const c = color;
  switch (id) {
    case "cone-tri": return <svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><path d="M32 4 L42 26 L22 26 Z" fill={c || "#f97316"} stroke="#fff" strokeWidth={1.4} /></svg>;
    case "cone-flat": return <svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><circle cx="32" cy="15" r="9" fill={c || "#f97316"} stroke="#fff" strokeWidth={1.4} /></svg>;
    case "pole": return <svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><rect x="30" y="2" width="4" height="26" rx="2" fill={c || "#eab308"} /><circle cx="32" cy="27" r="3" fill="#374151" /></svg>;
    case "hurdle": return <svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><rect x="12" y="12" width="40" height="5" rx="1.5" fill={c || "#2563eb"} /><rect x="12" y="8" width="3" height="14" fill="#374151" /><rect x="49" y="8" width="3" height="14" fill="#374151" /></svg>;
    case "ladder": return <svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><g stroke={c || "#f59e0b"} strokeWidth={2}><path d="M8 7 H56 M8 23 H56" />{[14, 22, 30, 38, 46].map((x) => <path key={x} d={`M${x} 7 V23`} />)}</g></svg>;
    case "dummy": return <svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true"><ellipse cx="32" cy="18" rx="13" ry="8" fill={c || "#6b7280"} /><circle cx="32" cy="11" r="5" fill={c || "#6b7280"} stroke="#fff" strokeWidth={1} /></svg>;
    default: {
      // porterías: el ancho dibujado según su tamaño real
      const w = { "goal-mini": 14, "goal-futsal": 20, "goal-f7": 32, "goal-f11": 42 }[id] || 32;
      const x0 = 32 - w / 2;
      return (
        <svg viewBox="0 0 64 30" width="64" height="30" aria-hidden="true">
          <path d={`M${x0} 22 V8 H${x0 + w} V22`} fill="none" stroke={c && c.toLowerCase() !== "#ffffff" ? c : "#374151"} strokeWidth={2.4} strokeLinejoin="round" />
          <path d={`M${x0} 8 V22 H${x0 + w} V8`} fill="none" stroke="#111827" strokeWidth={0.6} opacity={0.5} />
          <g stroke="#9ca3af" strokeWidth={0.5}>{Array.from({ length: Math.round(w / 4) }, (_, i) => <path key={i} d={`M${x0 + 2 + i * 4} 8 V20`} />)}</g>
        </svg>
      );
    }
  }
}
function LinkSample({ mode, color }) {
  const pts = [[10, 20], [26, 8], [40, 18], [54, 9]];
  const c = color;
  return (
    <svg viewBox="0 0 64 28" width="64" height="28" aria-hidden="true">
      {mode === "zone" && <path d="M10 20 L26 8 L54 9 L40 18 Z" fill={c} fillOpacity={0.25} stroke={c} strokeWidth={1.6} />}
      {mode === "line" && <path d={`M${pts.map((p) => p.join(" ")).join(" L")}`} fill="none" stroke={c} strokeWidth={2} />}
      {mode === "mesh" && pts.flatMap((a, i) => pts.slice(i + 1).map((b, j) => <path key={`${i}-${j}`} d={`M${a[0]} ${a[1]} L${b[0]} ${b[1]}`} stroke={c} strokeWidth={1.1} />))}
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3.6} fill={clubColor.primary} stroke="#fff" strokeWidth={1} />)}
    </svg>
  );
}
function TextSample({ v }) {
  return (
    <svg viewBox="0 0 64 26" width="64" height="26" aria-hidden="true">
      {v.bg && <rect x="8" y="5" width="48" height="16" rx="3" fill={v.bg} />}
      <text x="32" y="17.5" textAnchor="middle" fontSize={v.big ? 14 : 10.5} fontWeight={v.bold ? 800 : 500} fill={v.bg ? "#1e1416" : "#111827"} style={{ fontFamily: "Arial, sans-serif" }}>{v.bg ? "1er palo" : "Texto"}</text>
    </svg>
  );
}

// Variantes que se ofrecen en cada tipo (las de material dependen de si hay algo elegido: solo las de su clase)
export const MATERIAL_VARIANTS = [
  { id: "cone-tri", k: "cone", label: "Cono", patch: { shape: "tri" } },
  { id: "cone-flat", k: "cone", label: "Cono plano", patch: { shape: "flat" } },
  { id: "goal-mini", k: "goal", label: "Portería mini", patch: { w: 2 } },
  { id: "goal-futsal", k: "goal", label: "Portería sala", patch: { w: 3 } },
  { id: "goal-f7", k: "goal", label: "Portería F7", patch: { w: 6 } },
  { id: "goal-f11", k: "goal", label: "Portería grande", patch: { w: 7.32 } },
  { id: "pole", k: "pole", label: "Pica", patch: {} },
  { id: "hurdle", k: "hurdle", label: "Valla", patch: {} },
  { id: "ladder", k: "ladder", label: "Escalera", patch: {} },
  { id: "dummy", k: "dummy", label: "Maniquí", patch: {} },
];
export const TEXT_VARIANTS = [
  { id: "normal", label: "Normal", patch: { size: 3, bold: undefined, bg: undefined } },
  { id: "big", label: "Título", big: true, bold: true, patch: { size: 5, bold: true, bg: undefined } },
  { id: "tag", label: "Etiqueta", bold: true, bg: clubColor.accent, patch: { size: 2.2, bold: true, bg: clubColor.accent, color: "#1E1416" } },
];
export const materialVariantOf = (el) => {
  if (!el) return null;
  if (el.k === "cone") return el.shape === "flat" ? "cone-flat" : "cone-tri";
  if (el.k === "goal") { const w = Number(el.w) || 7.32; return w <= 2.5 ? "goal-mini" : w <= 4 ? "goal-futsal" : w <= 6.5 ? "goal-f7" : "goal-f11"; }
  return el.k;
};
export const textVariantOf = (el) => (el?.bg ? "tag" : (Number(el?.size) || 3) >= 4.5 ? "big" : "normal");

// Color: muestra + paleta que sale hacia la derecha (no empuja la columna)
function DockColor({ label, value, auto, onChange, testid }) {
  const [open, setOpen] = useState(null);
  const toggle = (e) => {
    if (open) return setOpen(null);
    const r = e.currentTarget.getBoundingClientRect();
    const W = typeof window !== "undefined" ? window.innerWidth : 1400;
    setOpen({ left: r.right + 184 > W ? Math.max(8, r.left - 176) : r.right + 8, top: Math.max(8, Math.min(r.top, (typeof window !== "undefined" ? window.innerHeight : 800) - 250)) });
  };
  return (
    <div className="relative" data-testid={testid}>
      <button type="button" onClick={toggle} aria-expanded={!!open} aria-label={label} title={label}
        className="w-full flex items-center gap-1.5 rounded-lg px-1.5 h-8 text-[11px] font-semibold" style={{ background: D.btn, color: D.text, border: `1px solid ${open ? D.on : D.line}` }}>
        <span className="w-5 h-5 rounded-full border border-white/40 shrink-0" style={{ background: value || auto }} />
        <span className="truncate">{label}</span>
      </button>
      {open && (
        <div className="fixed w-[168px] rounded-xl bg-white p-2 shadow-2xl border border-gray-200 grid grid-cols-6 gap-1" style={{ zIndex: 60, left: open.left, top: open.top }} role="group" aria-label={label}>
          {PALETTE.map((c) => (
            <button key={c} type="button" aria-label={c} onClick={() => { onChange(c); setOpen(null); }} className="w-6 h-6 rounded-full border border-black/20 flex items-center justify-center" style={{ background: c }}>
              {String(value || "").toLowerCase() === c.toLowerCase() && <Check className="w-3.5 h-3.5" style={{ color: c === "#ffffff" || c === "#fde047" ? "#111827" : "#ffffff" }} />}
            </button>
          ))}
          <label className="col-span-6 flex items-center gap-1.5 text-[11px] text-gray-600 mt-1">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || "") ? value : clubColor.primary} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 p-0 border-0 bg-transparent" aria-label="Otro color" />
            Otro color
          </label>
          <button type="button" onClick={() => { onChange(undefined); setOpen(null); }} className="col-span-6 h-7 rounded-md border border-gray-200 text-[11px] font-semibold text-gray-600 hover:bg-gray-50">El de siempre</button>
        </div>
      )}
    </div>
  );
}
// Elegir entre unos pocos valores (grosores, transparencias, trazos) con su dibujo
function Pick({ label, options, value, onChange, testid }) {
  return (
    <div data-testid={testid}>
      <span className="block text-[10px] font-semibold mb-0.5" style={{ color: D.sub }}>{label}</span>
      <div className="grid grid-cols-2 gap-1">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button key={String(o.value)} type="button" aria-pressed={on} aria-label={`${label}: ${o.label}`} title={o.label} onClick={() => onChange(o.value)}
              className="h-7 rounded-md flex items-center justify-center" style={{ background: on ? D.on : D.tile, border: `1px solid ${on ? D.on : "transparent"}` }}>
              {o.draw}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function Step({ label, onMinus, onPlus, text, testid }) {
  return (
    <div data-testid={testid}>
      <span className="block text-[10px] font-semibold mb-0.5" style={{ color: D.sub }}>{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onMinus} aria-label={`${label}: menos`} className="h-7 w-7 rounded-md flex items-center justify-center" style={{ background: D.btn, color: D.text, border: `1px solid ${D.line}` }}><Minus className="w-3.5 h-3.5" /></button>
        <span className="flex-1 text-center text-[11px] tabular-nums" style={{ color: D.text }}>{text}</span>
        <button type="button" onClick={onPlus} aria-label={`${label}: más`} className="h-7 w-7 rounded-md flex items-center justify-center" style={{ background: D.btn, color: D.text, border: `1px solid ${D.line}` }}><Plus className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
function Toggle({ label, on, onChange, testid }) {
  return (
    <button type="button" aria-pressed={on} onClick={() => onChange(!on)} data-testid={testid}
      className="w-full h-7 rounded-md text-[11px] font-semibold" style={{ background: on ? D.on : D.btn, color: on ? D.onInk : D.text, border: `1px solid ${on ? D.on : D.line}` }}>{label}</button>
  );
}
const line = (w, dash) => <svg viewBox="0 0 40 10" width="40" height="10" aria-hidden="true"><path d="M3 5 H37" stroke="#1e1416" strokeWidth={w} strokeDasharray={dash || undefined} strokeLinecap="round" /></svg>;
const swatchAlpha = (a) => <span className="w-8 h-4 rounded-sm border border-black/20" style={{ background: `rgba(115,0,10,${a})` }} />;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * kind: arrow | zone | ball | material | text. el = lo elegido o la herramienta (lo que se dibujará). variants = [{id, label, …}],
 * active = id de la variante actual, onVariant(id), patch(cambio, clave), onDefault (★), onMore (panel completo),
 * onDelete (solo con algo elegido).
 */
// inPage: fuera del campo, en la columna de la página (pizarra dentro de la página, 07/11/2026)
export default function BoardDock({ kind, el, look, selected, variants, active, onVariant, patch, onDefault, onMore, onDelete, saved = false, linkPick = null, inPage = false }) {
  const s = styleOf(look);
  const title = { arrow: "Flechas", zone: "Zonas", ball: "Balón", material: "Material", text: "Texto", link: "Unir fichas" }[kind];
  const sample = (v) => {
    if (kind === "arrow") return <ArrowSample v={ARROW_SAMPLES[v.id]} color={el.color || s.arrows?.[ARROW_SAMPLES[v.id]?.air ? "pass" : v.id] || "#111827"} width={el.width ?? ARROW_W} />;
    if (kind === "zone") return <ZoneSample shape={v.id} fill={el.fill || clubColor.primary} stroke={el.stroke || clubColor.primary} />;
    if (kind === "ball") { const bs = ballStyle(el); return <BallGlyph pattern={v.id} color={bs.color} color2={el.color2 || "#111827"} size={26} />; }
    if (kind === "material") return <MaterialSample id={v.id} color={el.color} />;
    if (kind === "text") return <TextSample v={v} />;
    if (kind === "link") return <LinkSample mode={v.id} color={el.color || (s.link === "#ffffff" ? "#374151" : s.link) || "#374151"} />;
    return null;
  };
  const sizeOf = Number(el.size) || 1;
  return (
    <aside aria-label={`${title}: tipos y opciones`} data-testid="board-dock" data-kind={kind}
      className={inPage ? "relative w-full rounded-xl flex flex-col pb-1" : "absolute top-2.5 bottom-2.5 left-[54px] w-[112px] rounded-xl flex flex-col overflow-y-auto overflow-x-visible no-scrollbar"}
      style={{ background: "rgba(36,0,10,0.96)", border: `1px solid ${D.line}`, zIndex: inPage ? undefined : 6, color: D.text }}>
      <p className="px-2 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: D.sub }}>{title}</p>
      {linkPick && (
        <div className="px-2 pb-1.5 text-[10.5px] leading-snug" style={{ color: D.sub }} data-testid="dock-link-hint">
          {linkPick.count ? `${linkPick.count} ${linkPick.count === 1 ? "elegida" : "elegidas"}: elige cómo unirlas` : "Toca las fichas que quieras unir o arrastra un recuadro sobre ellas"}
          {linkPick.count > 0 && <button type="button" onClick={linkPick.onClear} className="block mt-1 underline" style={{ color: D.text }}>Borrar elección</button>}
        </div>
      )}
      <div className={inPage ? "px-1.5 grid grid-cols-2 gap-1" : "px-1.5 flex flex-col gap-1"} role="group" aria-label={`Tipos de ${title.toLowerCase()}`}>
        {variants.map((v) => {
          const on = v.id === active;
          return (
            <button key={v.id} type="button" aria-pressed={on} onClick={() => onVariant(v.id)} title={v.label} data-testid={`dock-v-${v.id}`} disabled={v.disabled}
              className="rounded-lg flex flex-col items-center pt-1 pb-0.5 disabled:opacity-40" style={{ background: D.tile, border: `2px solid ${on ? D.tileOn : "transparent"}` }}>
              {sample(v)}
              <span className="text-[10px] font-semibold leading-tight text-center px-0.5" style={{ color: "#4A3D3F" }}>{v.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-auto px-1.5 pt-2 pb-2 flex flex-col gap-1.5 border-t" style={{ borderColor: D.line, marginTop: 8 }}>
        {kind === "arrow" && (
          <>
            <DockColor label="Color" value={el.color} auto={s.arrows?.[el.style] || "#111827"} onChange={(c) => patch({ color: c }, "color")} testid="dock-color" />
            <Pick label="Grosor" testid="dock-width" value={[0.25, 0.4, 0.6, 0.9].reduce((a, b) => (Math.abs(b - (el.width ?? ARROW_W)) < Math.abs(a - (el.width ?? ARROW_W)) ? b : a))}
              options={[0.25, 0.4, 0.6, 0.9].map((w) => ({ value: w, label: `${w}`, draw: line(w * 4, null) }))} onChange={(w) => patch({ width: w }, "width")} />
            <Pick label="Trazo" testid="dock-dash" value={el.dash || (el.style === "move" ? "dashed" : "solid")}
              options={[{ value: "solid", label: "Continua", draw: line(1.8) }, { value: "dashed", label: "Discontinua", draw: line(1.8, "5 3") }, { value: "dotted", label: "Punteada", draw: line(2, "0.1 3.5") }]} onChange={(d) => patch({ dash: d }, "dash")} />
            <Toggle label={el.border ? "Con borde" : "Sin borde"} on={!!el.border} onChange={(v) => patch({ border: v || undefined }, "border")} testid="dock-border" />
            {el.border && <DockColor label="Borde" value={el.borderColor} auto="#ffffff" onChange={(c) => patch({ borderColor: c }, "borderColor")} testid="dock-border-color" />}
          </>
        )}
        {kind === "zone" && (
          <>
            <DockColor label="Relleno" value={el.fill} auto={s.zoneFill?.startsWith?.("url") ? "#2563eb" : s.zoneFill} onChange={(c) => patch(c ? { fill: c, ...(el.fillOpacity == null ? { fillOpacity: 0.35 } : {}) } : { fill: undefined }, "fill")} testid="dock-fill" />
            <Pick label="Transparencia" testid="dock-alpha" value={[0.15, 0.35, 0.6, 1].reduce((a, b) => (Math.abs(b - (el.fillOpacity ?? s.zoneAlpha ?? 0.35)) < Math.abs(a - (el.fillOpacity ?? s.zoneAlpha ?? 0.35)) ? b : a))}
              options={[0.15, 0.35, 0.6, 1].map((a) => ({ value: a, label: `${Math.round(a * 100)} %`, draw: swatchAlpha(a) }))} onChange={(a) => patch({ fillOpacity: a }, "fillOpacity")} />
            <DockColor label="Borde" value={el.stroke} auto={s.zoneLine || "#111827"} onChange={(c) => patch({ stroke: c, border: true }, "stroke")} testid="dock-stroke" />
            <Pick label="Trazo del borde" testid="dock-zone-dash" value={el.border === false ? "none" : el.dash || "solid"}
              options={[{ value: "solid", label: "Continuo", draw: line(1.8) }, { value: "dashed", label: "Discontinuo", draw: line(1.8, "5 3") }, { value: "dotted", label: "Punteado", draw: line(2, "0.1 3.5") }, { value: "none", label: "Sin borde", draw: <span className="text-[10px] font-semibold text-gray-600">Sin</span> }]}
              onChange={(d) => patch(d === "none" ? { border: false } : { border: true, dash: d }, "dash")} />
          </>
        )}
        {kind === "ball" && (
          <>
            <DockColor label="Color" value={el.color} auto="#ffffff" onChange={(c) => patch({ color: c }, "color")} testid="dock-color" />
            <DockColor label="Dibujo" value={el.color2} auto="#111827" onChange={(c) => patch({ color2: c }, "color2")} testid="dock-color2" />
            <Step label="Tamaño" testid="dock-size" text={`${Math.round(sizeOf * 100)}%`} onMinus={() => patch({ size: r2(clamp(sizeOf - 0.15, 0.25, 2.2)) }, "size")} onPlus={() => patch({ size: r2(clamp(sizeOf + 0.15, 0.25, 2.2)) }, "size")} />
          </>
        )}
        {kind === "material" && (
          <>
            <DockColor label="Color" value={el.color} auto={el.k === "goal" ? "#ffffff" : "#f97316"} onChange={(c) => patch({ color: c }, "color")} testid="dock-color" />
            {el.k !== "goal" && <Step label="Tamaño" testid="dock-size" text={`${Math.round(sizeOf * 100)}%`} onMinus={() => patch({ size: r2(clamp(sizeOf - 0.15, 0.25, 2.2)) }, "size")} onPlus={() => patch({ size: r2(clamp(sizeOf + 0.15, 0.25, 2.2)) }, "size")} />}
            {el.k === "cone" && (
              <>
                <DockColor label="Borde" value={el.stroke} auto="#ffffff" onChange={(c) => patch({ stroke: c }, "stroke")} testid="dock-stroke" />
                <Pick label="Grosor del borde" testid="dock-edge" value={el.edge ?? 1} options={[0, 0.5, 1, 2].map((e) => ({ value: e, label: e === 0 ? "Sin borde" : `${e * 100} %`, draw: e === 0 ? <span className="text-[10px] font-semibold text-gray-600">Sin</span> : line(e * 2.4) }))} onChange={(e) => patch({ edge: e }, "edge")} />
              </>
            )}
          </>
        )}
        {kind === "link" && (
          <>
            <DockColor label="Color" value={el.color} auto={s.link || "#374151"} onChange={(c) => patch({ color: c }, "color")} testid="dock-color" />
            <Pick label="Grosor" testid="dock-width" value={[0.22, 0.35, 0.5, 0.8].reduce((a, b) => (Math.abs(b - (el.width ?? 0.45)) < Math.abs(a - (el.width ?? 0.45)) ? b : a))}
              options={[0.22, 0.35, 0.5, 0.8].map((w) => ({ value: w, label: `${w}`, draw: line(w * 4, null) }))} onChange={(w) => patch({ width: w }, "width")} />
            <Pick label="Trazo" testid="dock-dash" value={el.dash || "solid"}
              options={[{ value: "solid", label: "Continua", draw: line(1.8) }, { value: "dashed", label: "Discontinua", draw: line(1.8, "5 3") }, { value: "dotted", label: "Punteada", draw: line(2, "0.1 3.5") }]} onChange={(d) => patch({ dash: d }, "dash")} />
            {(el.mode === "zone" || (!selected && active === "zone")) && (
              <Pick label="Transparencia" testid="dock-alpha" value={[0.1, 0.18, 0.35, 0.6].reduce((a, b) => (Math.abs(b - (el.fillOpacity ?? 0.18)) < Math.abs(a - (el.fillOpacity ?? 0.18)) ? b : a))}
                options={[0.1, 0.18, 0.35, 0.6].map((a) => ({ value: a, label: `${Math.round(a * 100)} %`, draw: swatchAlpha(a) }))} onChange={(a) => patch({ fillOpacity: a }, "fillOpacity")} />
            )}
          </>
        )}
        {kind === "text" && (
          <>
            <DockColor label="Color" value={el.color} auto={s.textFill || "#111827"} onChange={(c) => patch({ color: c }, "color")} testid="dock-color" />
            <DockColor label="Fondo" value={el.bg} auto="transparent" onChange={(c) => patch({ bg: c }, "bg")} testid="dock-bg" />
            <Step label="Tamaño" testid="dock-size" text={(Number(el.size) || 3).toFixed(1).replace(".", ",")} onMinus={() => patch({ size: r2(clamp((Number(el.size) || 3) - 0.4, 0.8, 10)) }, "size")} onPlus={() => patch({ size: r2(clamp((Number(el.size) || 3) + 0.4, 0.8, 10)) }, "size")} />
            <Toggle label="Negrita" on={!!el.bold} onChange={(v) => patch({ bold: v || undefined }, "bold")} testid="dock-bold" />
          </>
        )}
        {/* predeterminado con texto (07/11/2026, Nacho: «dejar un grosor, color… preestablecido»): lo nuevo de este tipo saldrá así */}
        <button type="button" onClick={onDefault} title="Lo que dibujes de este tipo a partir de ahora saldrá así (grosor, color, trazo…)" data-testid="dock-default"
          className="mt-1 w-full rounded-md flex items-center justify-center gap-1 px-1 text-[10.5px] font-semibold leading-tight text-center" style={{ minHeight: 34, background: saved ? D.on : D.btn, color: saved ? D.onInk : "#facc15", border: `1px solid ${saved ? D.on : D.line}` }}>
          <Star className="w-3.5 h-3.5 shrink-0" fill={saved ? "currentColor" : "none"} />
          <span style={{ color: saved ? D.onInk : D.text }}>{saved ? "Guardado" : "Dejar como predeterminado"}</span>
        </button>
        <div className="grid grid-cols-2 gap-1">
          <button type="button" onClick={onMore} title="Más opciones" aria-label="Más opciones" data-testid="dock-more"
            className="h-8 rounded-md flex items-center justify-center" style={{ background: D.btn, color: D.text, border: `1px solid ${D.line}` }}>
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          {selected ? (
            <button type="button" onClick={onDelete} title="Quitar" aria-label="Quitar" data-testid="dock-delete"
              className="h-8 rounded-md flex items-center justify-center" style={{ background: D.btn, color: "#fca5a5", border: `1px solid ${D.line}` }}>
              <Trash2 className="w-4 h-4" />
            </button>
          ) : <span />}
        </div>
      </div>
    </aside>
  );
}

export { BALL_PATTERNS };
