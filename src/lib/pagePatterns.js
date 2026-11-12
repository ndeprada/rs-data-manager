// Patrones de página (Configuración del club, fase 3): como el «patrón de diapositivas» de PowerPoint.
// Cada página usa un patrón (Listados, Fichas, Paneles…) y los ajustes del patrón valen para todas sus páginas;
// a una página se le puede cambiar el patrón o algún ajuste solo a ella.
//
// Sin ajustes guardados NO se genera ninguna regla: la app se ve exactamente igual que siempre (Racing).
// Sin importaciones de la app: lo usan también el servidor (limpieza) y las pruebas en Node.

export const PATTERNS = [
  { key: "listados", label: "Listados", help: "Páginas con listas y tablas: jugadores, equipos, partidos, personal…" },
  { key: "fichas", label: "Fichas", help: "La ficha de un jugador, de un equipo, de un entrenador o de un partido." },
  { key: "paneles", label: "Paneles", help: "Resúmenes con cifras y tarjetas: Panel, Mi equipo, Temporada." },
  { key: "planificacion", label: "Planificación y scouting", help: "Plantillas, campograma y base de datos de scouting." },
  { key: "herramientas", label: "Herramientas a pantalla completa", help: "Táctica, Vídeo y Metodología." },
  { key: "familias", label: "Zona de familias y jugadores", help: "Lo que ven los jugadores y las familias." },
  { key: "acceso", label: "Acceso y alta", help: "Pantalla para entrar, alta y espera de aprobación." },
];
export const PATTERN_KEYS = PATTERNS.map((p) => p.key);

// Páginas y su patrón por defecto. `path` = dirección de la página (o una clave propia para las de fuera del menú).
export const PAGES = [
  { path: "/Dashboard", label: "Panel", pattern: "paneles" },
  { path: "/Calendar", label: "Calendario", pattern: "listados" },
  { path: "/Teams", label: "Equipos", pattern: "listados" },
  { path: "/Players", label: "Jugadores", pattern: "listados" },
  { path: "/Coaches", label: "Personal", pattern: "listados" },
  { path: "/Accesos", label: "Accesos", pattern: "listados" },
  { path: "/Season", label: "Temporada", pattern: "paneles" },
  { path: "/Fields", label: "Campos", pattern: "listados" },
  { path: "/Avisos", label: "Avisos", pattern: "listados" },
  { path: "/MyTeam", label: "Mi equipo", pattern: "paneles" },
  { path: "/MyTeam/Squad", label: "Mi equipo · Plantilla", pattern: "listados" },
  { path: "/MyTeam/Matches", label: "Mi equipo · Partidos", pattern: "listados" },
  { path: "/MyTeam/Attendance", label: "Mi equipo · Entrenamientos", pattern: "listados" },
  { path: "/MyTeam/Development", label: "Mi equipo · Desarrollo", pattern: "paneles" },
  { path: "/Matches", label: "Partidos", pattern: "listados" },
  { path: "/Attendance", label: "Asistencia", pattern: "listados" },
  { path: "/Stats", label: "Estadísticas", pattern: "paneles" },
  { path: "/Reports", label: "Informes", pattern: "listados" },
  { path: "/Material", label: "Material", pattern: "listados" },
  { path: "/PlayerProfile", label: "Ficha del jugador", pattern: "fichas" },
  { path: "/TeamDetail", label: "Ficha del equipo", pattern: "fichas" },
  { path: "/CoachProfile", label: "Ficha del entrenador", pattern: "fichas" },
  { path: "/MatchDetail", label: "Ficha del partido", pattern: "fichas" },
  { path: "/Scouting", label: "Planificación", pattern: "planificacion" },
  { path: "/Tactics", label: "Táctica", pattern: "herramientas" },
  { path: "/Video", label: "Vídeo", pattern: "herramientas" },
  { path: "/Methodology", label: "Metodología", pattern: "herramientas" },
  { path: "/PlayerTeam", label: "Jugador · Mi equipo", pattern: "familias" },
  { path: "familia", label: "Familias · Inicio", pattern: "familias" },
  { path: "acceso", label: "Pantalla de acceso", pattern: "acceso" },
  { path: "alta", label: "Alta y espera de aprobación", pattern: "acceso" },
];
const PAGE_PATHS = new Set(PAGES.map((p) => p.path));

// Ajustes de un patrón (o de una página). Sin dato = como el resto de la app.
export const PATTERN_FIELDS = [
  { key: "bg", label: "Fondo de la página", type: "color" },
  { key: "titleColor", label: "Color de los títulos", type: "choice", options: ["primary", "primaryDark", "accent", "ink"] },
  { key: "titleCase", label: "Títulos en mayúsculas", type: "choice", options: ["upper", "normal"] },
  { key: "titleSize", label: "Tamaño de los títulos", type: "choice", options: ["s", "m", "l"] },
  { key: "subColor", label: "Color de los subtítulos", type: "choice", options: ["accent", "primary", "muted"] },
  { key: "subCase", label: "Subtítulos en mayúsculas", type: "choice", options: ["upper", "normal"] },
  { key: "radius", label: "Esquinas de las tarjetas", type: "choice", options: ["square", "soft", "round"] },
  { key: "shadow", label: "Sombra de las tarjetas", type: "choice", options: ["none", "soft", "strong"] },
  { key: "border", label: "Borde de las tarjetas", type: "choice", options: ["yes", "no"] },
  { key: "density", label: "Tamaño de todo", type: "choice", options: ["compact", "normal", "wide"] },
];
export const CHOICE_LABELS = {
  primary: "Principal", primaryDark: "Principal oscuro", accent: "Acento", ink: "Casi negro", muted: "Gris",
  upper: "Sí", normal: "No", s: "Pequeño", m: "Normal", l: "Grande",
  square: "Rectas", soft: "Suaves", round: "Redondeadas", none: "Sin sombra", strong: "Marcada",
  yes: "Sí", no: "No", compact: "Compacto", wide: "Amplio",
};
// Etiqueta de una opción según el ajuste (en mayúsculas/borde «normal» = No; en tamaño «normal» = Normal)
export const choiceLabel = (field, v) => (v === "normal" && !["titleCase", "subCase"].includes(field) ? "Normal" : CHOICE_LABELS[v] || v);

const isHex = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

// Deja solo ajustes válidos
export function cleanSettings(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const f of PATTERN_FIELDS) {
    const v = raw[f.key];
    if (f.type === "color" ? isHex(v) : f.options.includes(v)) out[f.key] = f.type === "color" ? v.toUpperCase() : v;
  }
  return out;
}

// { patterns: { listados: {...} }, pages: { "/Players": { pattern?, ...ajustes } } } ya limpio y sin vacíos
export function cleanPatterns(raw = {}) {
  const out = {};
  const pats = {};
  for (const k of PATTERN_KEYS) {
    const s = cleanSettings(raw?.patterns?.[k]);
    if (Object.keys(s).length) pats[k] = s;
  }
  if (Object.keys(pats).length) out.patterns = pats;
  const pages = {};
  for (const [path, v] of Object.entries(raw?.pages || {})) {
    if (!PAGE_PATHS.has(path) || !v || typeof v !== "object") continue;
    const s = cleanSettings(v);
    const def = PAGES.find((p) => p.path === path).pattern;
    if (PATTERN_KEYS.includes(v.pattern) && v.pattern !== def) s.pattern = v.pattern;
    if (Object.keys(s).length) pages[path] = s;
  }
  if (Object.keys(pages).length) out.pages = pages;
  return out;
}

// Página (por su dirección) → { path, pattern }. Las direcciones sin patrón propio usan «listados».
export function pageInfo(pathname, cfg = {}) {
  const page = PAGES.find((p) => p.path === pathname);
  if (!page) return { path: pathname, pattern: null };
  return { path: page.path, pattern: cfg.pages?.[page.path]?.pattern || page.pattern };
}

// Ajustes efectivos de una página = los de su patrón + los propios
export function pageSettings(path, cfg = {}) {
  const info = pageInfo(path, cfg);
  const own = { ...(cfg.pages?.[path] || {}) };
  delete own.pattern;
  return { ...(cfg.patterns?.[info.pattern] || {}), ...own };
}

const TITLE_ZOOM = { s: 0.85, l: 1.18 };
const RADIUS = { square: "2px", soft: "8px", round: "16px" };
const SHADOW = { none: "none", soft: "0 1px 4px rgba(0,0,0,.07)", strong: "0 4px 16px rgba(0,0,0,.13)" };
const DENSITY = { compact: 0.9, wide: 1.08 };

// Reglas CSS de un grupo de ajustes para un selector (scope). Sin ajustes, cadena vacía.
export function settingsCss(scope, s, colors) {
  const c = { ink: "#1F1416", muted: "#6B5F61", ...colors };
  const titles = [`${scope} h1`, `${scope} h2`, `${scope} .rs-title`, `${scope} .rs2-display:not(.tabular-nums)`].join(", ");
  const subs = [`${scope} h3`, `${scope} h4`, `${scope} h5`, `${scope} h6`, `${scope} .rs-subtitle`].join(", ");
  const cards = [`${scope} .rs-card`, `${scope} .rs2-card`, `${scope} :is(div, section).bg-white[class*="rounded"]`].join(", ");
  const r = [];
  if (s.bg) r.push(`${scope}, ${scope} > .min-h-screen, ${scope} .rs2 { background: ${s.bg} !important; }`);
  if (s.titleColor) r.push(`${titles} { color: ${c[s.titleColor]} !important; }`);
  if (s.titleCase) r.push(`${titles} { text-transform: ${s.titleCase === "upper" ? "uppercase" : "none"} !important; }`);
  if (TITLE_ZOOM[s.titleSize]) r.push(`${titles} { zoom: ${TITLE_ZOOM[s.titleSize]}; }`);
  if (s.subColor) r.push(`${subs} { color: ${c[s.subColor]} !important; }`);
  if (s.subCase) r.push(`${subs} { text-transform: ${s.subCase === "upper" ? "uppercase" : "none"} !important; }`);
  if (RADIUS[s.radius]) r.push(`${cards} { border-radius: ${RADIUS[s.radius]} !important; }`);
  if (SHADOW[s.shadow]) r.push(`${cards} { box-shadow: ${SHADOW[s.shadow]} !important; }`);
  if (s.border === "no") r.push(`${cards} { border-color: transparent !important; }`);
  if (DENSITY[s.density]) r.push(`${scope} [data-pattern-body] { zoom: ${DENSITY[s.density]}; }`, `${scope}[data-pattern-body] { zoom: ${DENSITY[s.density]}; }`);
  return r.join("\n");
}

// Todas las reglas de la configuración: primero los patrones, luego las páginas (que mandan sobre su patrón).
// Cada página se pinta con [data-pattern] (su patrón) y [data-page] (la página).
export function patternCss(cfg = {}, colors = {}) {
  const out = [];
  for (const k of PATTERN_KEYS) {
    const s = cfg.patterns?.[k];
    if (s && Object.keys(s).length) out.push(settingsCss(`[data-pattern="${k}"][data-pattern]`, s, colors)); // doble atributo: gana a las reglas de rs2.css
  }
  for (const [path, v] of Object.entries(cfg.pages || {})) {
    const s = { ...v };
    delete s.pattern;
    if (Object.keys(s).length) out.push(settingsCss(`[data-pattern][data-page="${path}"][data-page]`, s, colors));
  }
  return out.filter(Boolean).join("\n");
}
