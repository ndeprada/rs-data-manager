// Aspecto del club: nombre de la app, escudo, colores y tipografías. Fuente única para toda la app.
//
// Los valores por defecto son los de Racing Sarrià (el diseño actual). Más adelante, la página de
// Configuración guardará los del club en la base de datos y se aplicarán con setBrand() ANTES de cargar la
// app (main.jsx), así que todo lo que lee BRAND, C o F (también constantes de módulo) ya sale con ellos.
//
// Sin importaciones de la app ni del navegador: lo usan también las pruebas en Node.
//   C = colores (hex)            → para estilos en línea, dibujos, PDF e impresiones
//   F = tipografías (font-family) → ídem
// En CSS y clases de Tailwind se usan las variables --club-* que pone applyBrand() (src/lib/applyBrand.js):
//   text-club, bg-club-dark, border-club-accent, bg-club-soft… (ver tailwind.config.js)

import { cleanPatterns } from "./pagePatterns.js";
import { MENU_KEYS } from "./menuSections.js";

export const DEFAULT_BRAND = Object.freeze({
  appName: "RS Manager",
  clubName: "Racing Sarrià",
  shortName: "Racing", // nombre corto (pizarra de balón parado, textos breves)
  fcfName: "RACING SARRI", // cómo aparece el club en el nombre de sus equipos en las actas de la FCF
  hidden: Object.freeze([]), // apartados del menú ocultos (menuSections.js)
  // Escudo: el de color para fondos claros y el blanco para fondos oscuros
  logo: "https://media.base44.com/images/public/69c2d5060bf86f45f1a86177/6ddddac4f_Escudo_Granate.png",
  logoWhite: "https://media.base44.com/images/public/69c2d5060bf86f45f1a86177/09c970d20_Escudo_Blanco.png",
  loginImage: "", // imagen de fondo de la pantalla de acceso (sin ella, fondo gris claro)
  icon: "", // icono de la app instalable (sin él, el de siempre de /api/icon)
  web: "", // web del club
  social: Object.freeze({ instagram: "", x: "", facebook: "", youtube: "", tiktok: "" }),
  patterns: Object.freeze({}), // ajustes por patrón de página (pagePatterns.js); vacío = como siempre
  pages: Object.freeze({}), // patrón o ajustes propios de una página
  colors: Object.freeze({
    primary: "#73000A", // granate: títulos, botones, cabeceras
    primaryDark: "#36000D", // granate oscuro: bandas, degradados, menú
    primarySoft: "#FDF2F4", // fondo muy claro del color principal
    accent: "#FF6E00", // naranja: subtítulos, detalles, lo que se resalta
    accentSoft: "#FFF7ED", // fondo muy claro del acento
    deep: "#24000A", // casi negro del color principal: barras de la pizarra
  }),
  fonts: Object.freeze({
    titleName: "Racing Sarria", // tipografía de los títulos (h1, h2, números grandes)
    titleUrl: "/fonts/RacingSarria.ttf",
    titleKind: "builtin", // builtin (ya en la app) · google (Google Fonts) · file (archivo subido)
    bodyName: "IBM Plex Sans Condensed", // tipografía de los textos
    bodyUrl: "",
    bodyKind: "builtin",
    numbersName: "Racing Sarria", // números grandes de los resúmenes
    numbersUrl: "/fonts/RacingSarria.ttf",
    numbersKind: "builtin",
  }),
});

const fontStack = (name, fallback = "sans-serif") => `'${name}', ${fallback}`;

// Objetos vivos: se rellenan con los valores del club (setBrand) y el resto del código los lee
export const BRAND = {};
export const C = {};
export const F = {};

export function setBrand(cfg = {}) {
  const d = DEFAULT_BRAND;
  const colors = { ...d.colors, ...(cfg.colors || {}) };
  const fonts = { ...d.fonts, ...(cfg.fonts || {}) };
  const social = { ...d.social, ...(cfg.social || {}) };
  Object.assign(BRAND, { ...d, ...cfg, colors, fonts, social, patterns: cfg.patterns || {}, pages: cfg.pages || {}, hidden: cfg.hidden || [] });
  Object.assign(C, colors);
  Object.assign(F, fonts, {
    title: fontStack(fonts.titleName), // "'Racing Sarria', sans-serif"
    body: fontStack(fonts.bodyName),
    titleBody: `'${fonts.titleName}', '${fonts.bodyName}', sans-serif`,
    numbers: fontStack(fonts.numbersName),
  });
  return BRAND;
}
setBrand();

// "#73000A" → "115 0 10" (para rgb(var(--x) / alfa) de Tailwind)
export function hexToRgbTriplet(hex) {
  const h = String(hex || "").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (!Number.isFinite(n) || full.length !== 6) return "0 0 0";
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

// Variables CSS del club (las aplica applyBrand en :root)
export function brandCssVars(b = BRAND) {
  const c = b.colors, f = b.fonts;
  const v = {
    "--club-primary": c.primary,
    "--club-primary-dark": c.primaryDark,
    "--club-primary-soft": c.primarySoft,
    "--club-accent": c.accent,
    "--club-accent-soft": c.accentSoft,
    "--club-deep": c.deep,
    "--club-font-title": fontStack(f.titleName),
    "--club-font-body": fontStack(f.bodyName),
    "--club-font-numbers": fontStack(f.numbersName),
  };
  for (const [k, hex] of Object.entries({ primary: c.primary, "primary-dark": c.primaryDark, "primary-soft": c.primarySoft, accent: c.accent, "accent-soft": c.accentSoft, deep: c.deep })) {
    v[`--club-${k}-rgb`] = hexToRgbTriplet(hex);
  }
  return v;
}

// ── Configuración del club (página Configuración) ───────────────────────────────────────────────
// Lo que se guarda en la base de datos es solo lo que cambia respecto a DEFAULT_BRAND (brandDiff), ya
// limpio (cleanBrand). Así, sin configuración guardada, todo sale exactamente como Racing Sarrià.

export const COLOR_KEYS = ["primary", "primaryDark", "primarySoft", "accent", "accentSoft", "deep"];
export const FONT_ROLES = ["title", "body", "numbers"];
export const FONT_KINDS = ["builtin", "google", "file"];
export const SOCIAL_KEYS = ["instagram", "x", "facebook", "youtube", "tiktok"];
// Tipografías que ya trae la app (no hace falta cargar nada)
export const BUILTIN_FONTS = [
  { name: "Racing Sarria", url: "/fonts/RacingSarria.ttf" },
  { name: "IBM Plex Sans Condensed", url: "" },
];
// Sugerencias de Google Fonts (se puede escribir cualquier otra)
export const GOOGLE_FONT_SUGGESTIONS = ["Barlow Condensed", "Oswald", "Bebas Neue", "Anton", "Roboto Condensed", "Saira Condensed", "Teko", "Archivo", "Inter", "Montserrat", "Poppins", "Roboto"];

const isHex = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
// Direcciones válidas: https://… o una ruta propia /…
const cleanUrl = (v) => {
  const s = str(v, 600);
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  return /^https:\/\/[^\s"'<>()]+$/i.test(s) ? s : "";
};
const cleanFontName = (v) => str(v, 60).replace(/[^\p{L}\p{N} \-]/gu, "").replace(/\s+/g, " ").trim();

// Deja solo lo que se puede guardar, con valores válidos (también en el servidor)
export function cleanBrand(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const k of ["appName", "clubName", "fcfName"]) { const v = str(r[k], 40); if (v) out[k] = v; }
  { const v = str(r.shortName, 20); if (v) out.shortName = v; }
  if (Array.isArray(r.hidden)) { const h = MENU_KEYS.filter((k) => r.hidden.includes(k)); if (h.length) out.hidden = h; }
  for (const k of ["logo", "logoWhite", "loginImage", "icon", "web"]) { const v = cleanUrl(r[k]); if (v) out[k] = v; }
  if (r.social && typeof r.social === "object") {
    const so = {};
    for (const k of SOCIAL_KEYS) { const v = cleanUrl(r.social[k]); if (v) so[k] = v; }
    if (Object.keys(so).length) out.social = so;
  }
  if (r.colors && typeof r.colors === "object") {
    const co = {};
    for (const k of COLOR_KEYS) if (isHex(r.colors[k])) co[k] = r.colors[k].toUpperCase();
    if (Object.keys(co).length) out.colors = co;
  }
  if (r.fonts && typeof r.fonts === "object") {
    const fo = {};
    for (const role of FONT_ROLES) {
      const name = cleanFontName(r.fonts[`${role}Name`]);
      if (!name) continue;
      const kind = FONT_KINDS.includes(r.fonts[`${role}Kind`]) ? r.fonts[`${role}Kind`] : "builtin";
      const url = kind === "google" ? "" : cleanUrl(r.fonts[`${role}Url`]);
      if (kind === "file" && !url) continue;
      fo[`${role}Name`] = name; fo[`${role}Kind`] = kind; fo[`${role}Url`] = url;
    }
    if (Object.keys(fo).length) out.fonts = fo;
  }
  Object.assign(out, cleanPatterns({ patterns: r.patterns, pages: r.pages }));
  return out;
}

// Configuración completa (por defecto + lo guardado), lista para editar
export function fullBrand(cfg = {}) {
  const d = DEFAULT_BRAND, c = cleanBrand(cfg);
  return { ...d, ...c, colors: { ...d.colors, ...(c.colors || {}) }, fonts: { ...d.fonts, ...(c.fonts || {}) }, social: { ...d.social, ...(c.social || {}) }, patterns: c.patterns || {}, pages: c.pages || {}, hidden: c.hidden || [] };
}

// Solo lo que cambia respecto a los valores por defecto
export function brandDiff(full = {}) {
  const c = cleanBrand(full), d = DEFAULT_BRAND, out = {};
  for (const k of ["appName", "clubName", "shortName", "fcfName", "logo", "logoWhite", "loginImage", "icon", "web"]) if (c[k] && c[k] !== d[k]) out[k] = c[k];
  if (c.hidden) out.hidden = c.hidden;
  for (const group of ["social", "colors"]) {
    const g = {};
    for (const [k, v] of Object.entries(c[group] || {})) if (v !== d[group][k]) g[k] = v;
    if (Object.keys(g).length) out[group] = g;
  }
  const fo = {};
  for (const role of FONT_ROLES) {
    const keys = [`${role}Name`, `${role}Kind`, `${role}Url`];
    if (!c.fonts?.[keys[0]]) continue;
    if (keys.some((k) => (c.fonts[k] || "") !== (d.fonts[k] || ""))) for (const k of keys) fo[k] = c.fonts[k];
  }
  if (Object.keys(fo).length) out.fonts = fo;
  if (c.patterns) out.patterns = c.patterns;
  if (c.pages) out.pages = c.pages;
  return out;
}

// ── Colores: tonos derivados y contraste ──
const rgbOf = (hex) => hexToRgbTriplet(hex).split(" ").map(Number);
const toHex = (rgb) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
export const mixHex = (a, b, t) => { const x = rgbOf(a), y = rgbOf(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };

// Tonos que acompañan al color principal y al acento (los de Racing salen casi iguales a los de siempre)
export function deriveTones(primary, accent) {
  return {
    primaryDark: mixHex(primary, "#000000", 0.53),
    deep: mixHex(primary, "#000000", 0.69),
    primarySoft: mixHex(primary, "#FFFFFF", 0.95),
    accentSoft: mixHex(accent, "#FFFFFF", 0.94),
  };
}

const lum = (hex) => {
  const [r, g, b] = rgbOf(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// Contraste WCAG entre dos colores (1 a 21; para leer bien hace falta 4,5 o más)
export function contrastRatio(a, b) {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
// Avisos de colores que se leerán mal
export function colorWarnings(colors) {
  const c = { ...DEFAULT_BRAND.colors, ...(colors || {}) };
  const w = [];
  if (contrastRatio(c.primary, "#FFFFFF") < 4.5) w.push({ key: "primary", text: "El color principal se lee mal sobre fondo blanco (títulos y botones)." });
  if (contrastRatio("#FFFFFF", c.primaryDark) < 4.5) w.push({ key: "primaryDark", text: "El texto blanco se lee mal sobre el color oscuro (menú y bandas)." });
  if (contrastRatio(c.accent, "#FFFFFF") < 2.5) w.push({ key: "accent", text: "El acento es muy claro: los detalles en ese color apenas se verán sobre blanco." });
  if (contrastRatio(c.primary, c.primarySoft) < 4.5) w.push({ key: "primarySoft", text: "El fondo claro está demasiado cerca del color principal." });
  return w;
}
