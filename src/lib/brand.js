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

export const DEFAULT_BRAND = Object.freeze({
  appName: "RS Manager",
  clubName: "Racing Sarrià",
  // Escudo: el de color para fondos claros y el blanco para fondos oscuros
  logo: "https://media.base44.com/images/public/69c2d5060bf86f45f1a86177/6ddddac4f_Escudo_Granate.png",
  logoWhite: "https://media.base44.com/images/public/69c2d5060bf86f45f1a86177/09c970d20_Escudo_Blanco.png",
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
    bodyName: "IBM Plex Sans Condensed", // tipografía de los textos
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
  Object.assign(BRAND, { ...d, ...cfg, colors, fonts });
  Object.assign(C, colors);
  Object.assign(F, fonts, {
    title: fontStack(fonts.titleName), // "'Racing Sarria', sans-serif"
    body: fontStack(fonts.bodyName),
    titleBody: `'${fonts.titleName}', '${fonts.bodyName}', sans-serif`,
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
  };
  for (const [k, hex] of Object.entries({ primary: c.primary, "primary-dark": c.primaryDark, "primary-soft": c.primarySoft, accent: c.accent, "accent-soft": c.accentSoft, deep: c.deep })) {
    v[`--club-${k}-rgb`] = hexToRgbTriplet(hex);
  }
  return v;
}
