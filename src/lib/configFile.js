// Archivo de la configuración del club (exportar / importar en Configuración → Modo y copia).
// Sin importaciones de la app salvo brand.js: se prueba en Node (tests/brand.test.mjs).
import { cleanBrand } from "./brand.js";

export const CONFIG_FILE_APP = "club-app-config";
export const CONFIG_FILE_VERSION = 1;

// Lo que se descarga: solo lo que cambia respecto a los valores por defecto (como lo que se guarda)
export function configFile(diff, { clubName = "", appName = "", now = new Date() } = {}) {
  return { app: CONFIG_FILE_APP, version: CONFIG_FILE_VERSION, exported_at: now.toISOString(), club: clubName, app_name: appName, brand: cleanBrand(diff) };
}

// Lee un archivo exportado (también admite la configuración sola). Lanza «not_config» si no lo parece.
export function readConfigFile(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("not_config");
  if (data.app === CONFIG_FILE_APP) {
    if (!data.brand || typeof data.brand !== "object") throw new Error("not_config");
    return cleanBrand(data.brand);
  }
  // Un objeto suelto solo vale si lo que trae se reconoce como configuración
  const c = cleanBrand(data);
  if (!Object.keys(c).length) throw new Error("not_config");
  return c;
}

// Qué partes trae (para el mensaje después de importar)
export const SUMMARY_KEYS = ["names", "images", "links", "colors", "fonts", "patterns", "structure", "theme"];
export function configSummary(brand = {}) {
  const b = cleanBrand(brand), out = [];
  if (b.appName || b.clubName) out.push("names");
  if (b.logo || b.logoWhite || b.icon || b.loginImage) out.push("images");
  if (b.web || b.social) out.push("links");
  if (b.colors) out.push("colors");
  if (b.fonts) out.push("fonts");
  if (b.patterns || b.pages) out.push("patterns");
  if (b.shortName || b.fcfName || b.hidden) out.push("structure");
  if (b.theme) out.push("theme");
  return out;
}
