// Modo oscuro de la app (fase 5 de la configuración del club, 12/11/2026).
// La app está escrita con colores claros (clases de Tailwind como bg-white o text-gray-500 y estilos en línea con los
// tonos del kit rs2). En vez de tocar miles de líneas, en modo oscuro se pone la clase `rs-dark` en <html> y una hoja de
// estilos que cambia esos colores claros por los oscuros. Sin modo oscuro no se genera ninguna regla.
// Quedan fuera (siempre como siempre): lo que está dentro de `.rs-nodark` (pizarra, editor de vídeo, hojas para
// imprimir) y la impresión (todo va dentro de @media screen).
// Sin importaciones de la app salvo brand.js: se prueba en Node (tests/darkTheme.test.mjs).
import { contrastRatio, mixHex, hexToRgbTriplet } from "./brand.js";
import { LIGHT_BGS, DARK_TEXTS } from "./darkColors.js";

export const THEMES = ["light", "dark", "choice"]; // como siempre · oscuro para todos · cada persona elige
export const THEME_PREF_KEY = "rs_theme";

// Paleta oscura (tonos cálidos, a juego con el fondo del kit rs2)
export const DARK = {
  bg: "#141011", surface: "#1E1819", surface2: "#251E1F", surface3: "#2F2728", surface4: "#3A3133",
  line: "#3B3133", lineSoft: "#2F2729", input: "#4A3F41",
  ink: "#EEE8E8", ink2: "#D2C8C9", ink3: "#BDB2B3", muted: "#A3979A", faint: "#857A7C", fainter: "#6E6365", ghost: "#574D4F",
};

// ¿Qué modo ve esta persona? `pref` = lo que eligió ella (solo cuenta si el club deja elegir)
export function themeFor(brand = {}, pref = "") {
  if (brand.theme === "dark") return "dark";
  if (brand.theme === "choice" && pref === "dark") return "dark";
  return "light";
}

// Versión del color que se lee sobre el fondo oscuro (se aclara mezclando con blanco hasta un contraste de 4,5)
export function readableOnDark(hex, bg = DARK.surface) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return DARK.ink;
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = mixHex(hex, "#FFFFFF", t);
    if (contrastRatio(c, bg) >= 4.5) return c;
  }
  return "#FFFFFF";
}

// Un fondo pastel en oscuro: el fondo oscuro con un toque de su color (se exagera el color del pastel y se mezcla poco)
export function darkTint(hex, amount = 0.11) {
  const deep = mixHex("#FFFFFF", hex, 8);
  return mixHex(DARK.surface, deep, amount);
}

// Colores de Tailwind (v3) para pasar los fondos pastel y los textos oscuros de color
const HUES = {
  red: ["#fca5a5", "#f87171", "#ef4444"], orange: ["#fdba74", "#fb923c", "#f97316"], amber: ["#fcd34d", "#fbbf24", "#f59e0b"],
  yellow: ["#fde047", "#facc15", "#eab308"], lime: ["#bef264", "#a3e635", "#84cc16"], green: ["#86efac", "#4ade80", "#22c55e"],
  emerald: ["#6ee7b7", "#34d399", "#10b981"], teal: ["#5eead4", "#2dd4bf", "#14b8a6"], cyan: ["#67e8f9", "#22d3ee", "#06b6d4"],
  sky: ["#7dd3fc", "#38bdf8", "#0ea5e9"], blue: ["#93c5fd", "#60a5fa", "#3b82f6"], indigo: ["#a5b4fc", "#818cf8", "#6366f1"],
  violet: ["#c4b5fd", "#a78bfa", "#8b5cf6"], purple: ["#d8b4fe", "#c084fc", "#a855f7"], fuchsia: ["#f0abfc", "#e879f9", "#d946ef"],
  pink: ["#f9a8d4", "#f472b6", "#ec4899"], rose: ["#fda4af", "#fb7185", "#f43f5e"],
};
const rgba = (hex, a) => `rgb(${hexToRgbTriplet(hex)} / ${a})`;

const rgbText = (hex) => `rgb(${hexToRgbTriplet(hex).split(" ").join(", ")})`;
// Lo que nunca cambia: pizarra, editor de vídeo y hojas para imprimir o descargar en PDF
// (llevan la clase rs-nodark: BoardEditor, BoardChipCard, VideoAnalysis, SessionSheet, SetPieceBoard)
const NO = ":not(.rs-nodark, .rs-nodark *)";
const sel = (list) => list.map((s) => `html.rs-dark ${s}${NO}`).join(",\n");
const rule = (list, body) => `${sel(list)} { ${body} }`;
const imp = (prop, v) => `${prop}: ${v} !important;`;
// Estilos en línea: React los escribe como «background: rgb(…)»; el color del texto se busca al principio o tras «; »
// para no confundirlo con background-color o border-color
const inlineBg = (hexes) => hexes.flatMap((h) => [`[style*="background: ${rgbText(h)}"]`, `[style*="background-color: ${rgbText(h)}"]`]);
const inlineColor = (hexes) => hexes.flatMap((h) => [`[style^="color: ${rgbText(h)}"]`, `[style*=" color: ${rgbText(h)}"]`]);
const inlineBorder = (hexes) => hexes.map((h) => `[style*="border"][style*="${rgbText(h)}"]`);
const tw = (cls) => `.${cls.replace(/([^a-zA-Z0-9_-])/g, "\\$1")}`;

// Hoja de estilos del modo oscuro con los colores del club
export function darkCss(colors = {}) {
  const D = DARK;
  const primary = colors.primary || "#73000A";
  const accent = colors.accent || "#FF6E00";
  const primaryInk = readableOnDark(primary);
  const accentInk = readableOnDark(accent);
  const primaryTint = `rgb(${hexToRgbTriplet(primary)} / .22)`;
  const accentTint = `rgb(${hexToRgbTriplet(accent)} / .16)`;
  const out = [];

  out.push(`html.rs-dark { color-scheme: dark; --club-primary-ink: ${primaryInk}; --club-accent-ink: ${accentInk}; }`);
  // Fondos suaves del club (variables): en oscuro, el fondo con un toque del color; dentro de lo que va en claro, los de siempre
  const pSoft = mixHex(D.surface, primary, 0.4), aSoft = mixHex(D.surface, accent, 0.16);
  const pSoftL = colors.primarySoft || "#FDF2F4", aSoftL = colors.accentSoft || "#FFF7ED";
  out.push(`html.rs-dark { --club-primary-soft: ${pSoft}; --club-primary-soft-rgb: ${hexToRgbTriplet(pSoft)}; --club-accent-soft: ${aSoft}; --club-accent-soft-rgb: ${hexToRgbTriplet(aSoft)}; }`);
  out.push(`html.rs-dark .rs-nodark { color-scheme: light; --club-primary-soft: ${pSoftL}; --club-primary-soft-rgb: ${hexToRgbTriplet(pSoftL)}; --club-accent-soft: ${aSoftL}; --club-accent-soft-rgb: ${hexToRgbTriplet(aSoftL)}; }`);
  // Variables de los componentes (ventanas, desplegables, menús): en HSL como las de shadcn
  out.push(`html.rs-dark { --background: 350 10% 7%; --foreground: 0 10% 92%; --card: 350 10% 11%; --card-foreground: 0 10% 92%;
  --popover: 350 10% 12%; --popover-foreground: 0 10% 92%; --secondary: 350 8% 17%; --secondary-foreground: 0 10% 92%;
  --muted: 350 8% 17%; --muted-foreground: 350 5% 62%; --accent: 350 8% 19%; --accent-foreground: 0 10% 92%;
  --border: 350 9% 22%; --input: 350 9% 26%; }`);
  // Variables del kit rs2 (Planificación)
  out.push(`html.rs-dark .rs2${NO} { --rs-bg: ${D.bg}; --rs-card: ${D.surface}; --rs-line: ${D.line}; --rs-line-soft: ${D.lineSoft}; --rs-head: ${D.surface2};
  --rs-soft: ${D.surface3}; --rs-ink: ${D.ink}; --rs-ink-2: ${D.ink2}; --rs-muted: ${D.muted}; --rs-faint: ${D.faint}; --rs-input: ${D.input};
  --rs-orange-soft: ${accentTint}; --rs-orange-ink: ${accentInk}; }`);
  out.push(`html.rs-dark body { background-color: ${D.bg}; color: ${D.ink}; }`);
  out.push(rule([".rs2-input"], `${imp("background-color", D.surface2)} ${imp("color", D.ink)}`));

  // Colores escritos a mano en estilos en línea (lista generada) y colores de Tailwind: primero, para que las reglas
  // concretas de debajo manden sobre ellas
  for (const h of LIGHT_BGS) out.push(rule(inlineBg([h]), imp("background-color", darkTint(h))));
  out.push(rule(inlineBorder(LIGHT_BGS), imp("border-color", D.line)));
  for (const h of DARK_TEXTS) out.push(rule(inlineColor([h]), imp("color", readableOnDark(h))));
  for (const [hue, [c300, c400, c500]] of Object.entries(HUES)) {
    out.push(rule([`bg-${hue}-50`, `bg-${hue}-50/30`, `bg-${hue}-50/40`, `bg-${hue}-50/60`, `bg-${hue}-50/70`].map(tw), imp("background-color", rgba(c500, 0.12))));
    out.push(rule([`bg-${hue}-100`, `bg-${hue}-100/60`].map(tw), imp("background-color", rgba(c500, 0.2))));
    out.push(rule([`bg-${hue}-200`].map(tw), imp("background-color", rgba(c500, 0.3))));
    out.push(rule([`hover:bg-${hue}-50`, `hover:bg-${hue}-100`].map((c) => `${tw(c)}:hover`), imp("background-color", rgba(c500, 0.24))));
    const hov = (c) => `${tw(c)}:hover`;
    out.push(rule([...[`text-${hue}-700`, `text-${hue}-800`, `text-${hue}-900`, `text-${hue}-900/80`].map(tw), hov(`hover:text-${hue}-700`)], imp("color", c300)));
    out.push(rule([tw(`text-${hue}-600`), hov(`hover:text-${hue}-600`)], imp("color", c400)));
    out.push(rule([...[`border-${hue}-100`, `border-${hue}-200`, `border-${hue}-300`].map(tw), hov(`hover:border-${hue}-200`)], imp("border-color", rgba(c500, 0.4))));
  }

  // Fondos
  out.push(rule([...["bg-white", "bg-white/80", "bg-white/90", "bg-white/95", "bg-[#fff]", "bg-[#ffffff]", "bg-card", "bg-background", "bg-popover"].map(tw), ...inlineBg(["#FFFFFF"]), '[style*="background: white"]'], imp("background-color", D.surface)));
  out.push(rule([...["bg-[#f5f5f5]", "bg-[#F5F2F1]", "bg-gray-100/60"].map(tw), ...inlineBg(["#F5F2F1", "#F5F5F5", "#F1EBEA"])], imp("background-color", D.bg)));
  out.push(rule([...["bg-gray-50", "bg-gray-50/60", "bg-gray-50/50", "bg-gray-50/70", "bg-gray-50/40", "bg-slate-50", "bg-[#FBF8F8]", "bg-[#FBF9F8]", "bg-muted/30", "bg-muted/50"].map(tw), ...inlineBg(["#FBF8F8", "#FBF9F8", "#FAFAFA", "#F9FAFB", "#FCFAFA"])], imp("background-color", D.surface2)));
  out.push(rule([...["bg-gray-100", "bg-slate-100", "bg-[#F3ECEB]", "bg-[#F3EEED]", "bg-muted", "bg-secondary"].map(tw), ...inlineBg(["#F3ECEB", "#EEE7E6", "#F0EAE9", "#F0EAEA", "#F1ECEB", "#ECE8E8", "#F3F4F6", "#F3EEED"])], imp("background-color", D.surface3)));
  out.push(rule([...["bg-gray-200", "bg-gray-200/70", "bg-slate-200"].map(tw), ...inlineBg(["#E6DEDD", "#E5E7EB", "#D9CFCE"])], imp("background-color", D.surface4)));
  out.push(rule([...["bg-club-soft", "bg-[#FBEFEF]", "bg-[#F6E2E2]", "bg-[#FDF2F4]"].map(tw), ...inlineBg([colors.primarySoft || "#FDF2F4", "#FBEFEF", "#FBEDEE", "#F6E2E2"])], imp("background-color", primaryTint)));
  out.push(rule([...["bg-club-accent-soft", "bg-[#FFE7D6]", "bg-[#FFF7ED]"].map(tw), ...inlineBg([colors.accentSoft || "#FFF7ED", "#FFE7D6"])], imp("background-color", accentTint)));
  // Al pasar el ratón
  out.push(rule(["hover:bg-gray-50", "hover:bg-gray-50/60", "hover:bg-gray-100", "hover:bg-gray-200", "hover:bg-white", "hover:bg-slate-50", "hover:bg-muted", "hover:bg-accent", "hover:bg-[#FBF8F8]"].map((c) => `${tw(c)}:hover`), imp("background-color", D.surface4)));
  out.push(rule(["hover:bg-club-soft", "hover:bg-[#FBEFEF]"].map((c) => `${tw(c)}:hover`), imp("background-color", `rgb(${hexToRgbTriplet(primary)} / .32)`)));

  // Textos
  out.push(rule([...["text-gray-900", "text-gray-800", "text-black", "text-slate-900", "text-slate-800", "text-foreground", "text-card-foreground", "text-[#1E1416]", "text-[#1F1416]", "text-[#0f1a2e]"].map(tw), ...inlineColor(["#1E1416", "#1F1416", "#111827", "#111111", "#000000", "#1F2937"])], imp("color", D.ink)));
  out.push(rule([...["text-gray-700", "text-slate-700", "text-[#3A2E30]"].map(tw), ...inlineColor(["#4A3D3F", "#3A2E30", "#374151"])], imp("color", D.ink2)));
  out.push(rule([...["text-gray-600", "text-slate-600"].map(tw), ...inlineColor(["#4B5563", "#5A5052"])], imp("color", D.ink3)));
  out.push(rule([...["text-gray-500", "text-slate-500", "text-muted-foreground"].map(tw), ...inlineColor(["#6B5E60", "#6B7280", "#64748B"])], imp("color", D.muted)));
  out.push(rule([...["text-gray-400", "text-slate-400", "text-[#9A8C8E]"].map(tw), ...inlineColor(["#9A8C8E", "#9CA3AF"])], imp("color", D.faint)));
  out.push(rule(["text-gray-300"].map(tw), imp("color", D.fainter)));
  out.push(rule(["text-gray-200"].map(tw), imp("color", D.ghost)));
  out.push(rule(["hover:text-gray-900", "hover:text-gray-800", "hover:text-gray-700", "hover:text-black"].map((c) => `${tw(c)}:hover`), imp("color", D.ink)));
  out.push(rule(["hover:text-gray-600", "hover:text-gray-500"].map((c) => `${tw(c)}:hover`), imp("color", D.ink3)));
  // El color del club como texto: una versión más clara que se lee sobre el fondo oscuro
  const varColor = (names) => names.flatMap((n) => [`[style^="color: var(${n})"]`, `[style*=" color: var(${n})"]`]);
  out.push(rule([...["text-club", "text-club-dark", "text-[#73000A]", "text-[#36000D]", "text-primary", "text-[var(--granate)]", "text-[color:var(--granate)]", "text-[var(--granate-dark)]"].map(tw), ...inlineColor([primary, colors.primaryDark || "#36000D"]), ...varColor(["--granate", "--granate-dark", "--club-primary", "--club-primary-dark"])], imp("color", primaryInk)));
  out.push(rule([...["text-club-accent", "text-[#FF6E00]", "text-[#8A3A00]"].map(tw), ...inlineColor(["#8A3A00"])], imp("color", accentInk)));
  // Títulos de las páginas (Layout pone h1/h2 en el color principal y h3 en el de acento)
  const H = `${NO}:not(.on-dark *, .on-dark, .rs2 *)`;
  out.push(`html.rs-dark main :is(h1, h2)${H} { color: ${primaryInk} !important; }`);
  out.push(`html.rs-dark main h3${H} { color: ${accentInk} !important; }`);

  // Bordes y separadores
  out.push(rule([...["border-gray-100", "border-gray-200", "border-gray-300", "border-slate-200", "border-[#E6DEDD]", "border-border", "border-input"].map(tw), ...inlineBorder(["#E6DEDD", "#EEE7E6", "#D9CFCE", "#DDD3D4", "#EFE6E6", "#E5E7EB", "#E5E5E5"])], imp("border-color", D.line)));
  out.push(rule(["border-gray-400"].map(tw), imp("border-color", D.input)));
  out.push(rule(["divide-gray-50", "divide-gray-100", "divide-gray-200"].map((c) => `${tw(c)} > :not([hidden]) ~ :not([hidden])`), imp("border-color", D.lineSoft)));
  out.push(rule(["hr", ".ql-toolbar.ql-snow", ".ql-container.ql-snow"], imp("border-color", D.line)));
  out.push(rule([".ql-snow .ql-stroke"], imp("stroke", D.muted)));
  out.push(rule([".ql-snow .ql-fill"], imp("fill", D.muted)));
  out.push(rule([".ql-snow .ql-picker"], imp("color", D.muted)));
  out.push(`html.rs-dark .ql-editor.ql-blank${NO}::before { ${imp("color", D.faint)} }`);

  // Campos de formulario
  out.push(rule([":is(input, select, textarea):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color])"], `background-color: ${D.surface2}; color: ${D.ink}; border-color: ${D.input};`));
  out.push(`html.rs-dark :is(input, textarea)${NO}::placeholder { ${imp("color", D.faint)} }`);
  // Sombras: más suaves para que no se vean como halos
  out.push(rule([".shadow-sm", ".shadow", ".shadow-md"].map((s) => s), imp("box-shadow", "0 1px 2px rgb(0 0 0 / .45)")));

  return `@media screen {\n${out.join("\n")}\n}`;
}
