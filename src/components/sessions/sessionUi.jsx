import React from "react";
import "./sessionFonts";

// Piezas de la pantalla de sesiones con el aspecto de la maqueta aprobada por Nacho (02/11/2026):
// fondo #F5F2F1, tarjetas blancas con borde #E6DEDD y radio 12, títulos en Barlow Condensed, texto en Inter,
// etiquetas de 11 px en mayúsculas y bandas granate oscuro (#36000D) para las partes de la sesión.
export const C = { granate: "#73000A", dark: "#36000D", ink: "#1F1416", soft: "#3A2E30", muted: "#6B5E60", line: "#E6DEDD", field: "#DDD3D4", pale: "#FBF8F8", paleLine: "#EFE6E6", bg: "#F5F2F1" };
export const DISPLAY = "'Barlow Condensed', 'Racing Sarria', Arial, sans-serif";

export const D = ({ as: Tag = "div", size = 18, className = "", style, children, ...rest }) => (
  <Tag className={`ss-d ${className}`} style={{ fontFamily: DISPLAY, textTransform: "uppercase", letterSpacing: ".02em", fontWeight: 800, fontSize: size, color: C.granate, lineHeight: 1.1, ...style }} {...rest}>{children}</Tag>
);

export const Lab = ({ children, className = "", style }) => (
  <span className={className} style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: C.muted, ...style }}>{children}</span>
);

export const Field = ({ label, children, className = "" }) => (
  <label className={`flex flex-col gap-[5px] min-w-0 ${className}`}><Lab>{label}</Lab>{children}</label>
);

export const SCard = ({ children, className = "", style, ...rest }) => (
  <section className={`bg-white rounded-xl ${className}`} style={{ border: `1px solid ${C.line}`, ...style }} {...rest}>{children}</section>
);

export const Band = ({ title, minutes, children }) => (
  <div className="flex items-center gap-2.5 px-5 py-3" style={{ background: C.dark, color: "#fff" }}>
    <D size={18} style={{ color: "#fff", flex: 1 }}>{title}</D>
    {children}
    {minutes != null && <D size={18} style={{ color: "#fff" }}>{minutes}</D>}
  </div>
);

// Botón con el aspecto de la maqueta
export const SBtn = ({ primary = false, small = false, className = "", style, children, ...rest }) => (
  <button type="button" className={`inline-flex items-center gap-1.5 rounded-lg font-semibold disabled:opacity-50 ${small ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-[13px]"} ${className}`}
    style={{ border: `1px solid ${primary ? C.granate : C.field}`, background: primary ? C.granate : "#fff", color: primary ? "#fff" : C.soft, ...style }} {...rest}>{children}</button>
);

// Pastilla (fase, tipo de sesión…): elegida = rellena
export const Pill = ({ on, color = C.granate, dashed = false, className = "", children, ...rest }) => (
  <button type="button" aria-pressed={!!on} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-xs font-semibold ${className}`}
    style={on ? { background: color, borderColor: color, color: "#fff", border: `1px solid ${color}` } : { background: "#fff", color: color === C.granate ? C.soft : color, border: `1px ${dashed ? "dashed" : "solid"} ${color === C.granate ? C.field : `${color}55`}` }} {...rest}>{children}</button>
);

// Clases de los campos de texto como en la maqueta (borde #DDD3D4, radio 8, 14 px)
export const inputCls = "rounded-lg border-[#DDD3D4] text-sm text-[#1F1416] focus-visible:ring-[#73000A]/30";
