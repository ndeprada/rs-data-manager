// Arranque del aspecto del club. main.jsx lo importa ANTES que la app: así, cuando se cargan los módulos que leen
// C / F / BRAND (también constantes de módulo), ya tienen los valores del club.
//
// De dónde sale la configuración:
//   1. una prueba sin guardar de la página Configuración («Probar en toda la app», solo en esta pestaña)
//   2. la última guardada que vio este navegador (copia en localStorage)
//   3. si no hay nada, los valores por defecto (Racing Sarrià)
// Después, refreshBrand() pregunta al servidor y, si ha cambiado, guarda la copia y recarga la página una vez.
import { setBrand, cleanBrand } from "./brand.js";

export const BRAND_KEY = "rs_brand";
export const BRAND_DRAFT_KEY = "rs_brand_draft";

const read = (store, key) => {
  try {
    const raw = store.getItem(key);
    return raw ? cleanBrand(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

const draft = typeof window !== "undefined" ? read(window.sessionStorage, BRAND_DRAFT_KEY) : null;
const cached = typeof window !== "undefined" ? read(window.localStorage, BRAND_KEY) : null;
setBrand(draft || cached || {});

// ¿Se está probando un aspecto sin guardar?
export const brandDraftActive = !!draft;

export function startBrandDraft(cfg) {
  try { window.sessionStorage.setItem(BRAND_DRAFT_KEY, JSON.stringify(cleanBrand(cfg))); } catch { /* sin almacenamiento */ }
  window.location.reload();
}

export function endBrandDraft() {
  try { window.sessionStorage.removeItem(BRAND_DRAFT_KEY); } catch { /* sin almacenamiento */ }
  window.location.reload();
}

// Guarda la copia local de lo que hay en el servidor (después de guardar en Configuración)
export function storeBrand(cfg) {
  try {
    const c = cleanBrand(cfg);
    if (Object.keys(c).length) window.localStorage.setItem(BRAND_KEY, JSON.stringify(c));
    else window.localStorage.removeItem(BRAND_KEY);
  } catch { /* sin almacenamiento */ }
}

const same = (a, b) => JSON.stringify(cleanBrand(a || {})) === JSON.stringify(cleanBrand(b || {}));

// Pregunta al servidor por la configuración; si no coincide con la copia local, la guarda y recarga una vez
export async function refreshBrand() {
  try {
    const r = await fetch("/api/club?a=brand", { credentials: "same-origin" });
    if (!r.ok) return;
    const { brand } = await r.json();
    if (same(brand, cached)) return;
    storeBrand(brand);
    if (draft) return; // durante una prueba no se recarga: la prueba manda
    const mark = JSON.stringify(cleanBrand(brand || {}));
    if (window.sessionStorage.getItem("rs_brand_reloaded") === mark) return; // evita recargar en bucle
    window.sessionStorage.setItem("rs_brand_reloaded", mark);
    window.location.reload();
  } catch {
    /* sin conexión: se queda con la copia local */
  }
}
