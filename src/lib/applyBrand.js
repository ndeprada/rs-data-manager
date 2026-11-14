// Pone en la página las variables CSS del club (colores y tipografías), carga las tipografías que no trae la
// app, y cambia el título de la pestaña, el color de la barra del móvil y el icono.
// Se llama en main.jsx antes de pintar la app. Sin configuración, salen los valores de Racing Sarrià (los mismos
// que ya tiene index.html / index.css), así que no cambia nada de lo que se ve.
import { BRAND, FONT_ROLES, brandCssVars } from "./brand.js";
import { patternCss } from "./pagePatterns.js";
import { darkCss, themeFor, THEME_PREF_KEY } from "./darkTheme.js";

// Modo que ha elegido esta persona (solo cuenta si el club deja elegir)
export function themePref() {
  try { return window.localStorage.getItem(THEME_PREF_KEY) || ""; } catch { return ""; }
}

// Pone o quita el modo oscuro (clase rs-dark en <html> y su hoja de estilos)
export function applyTheme(b = BRAND) {
  if (typeof document === "undefined") return;
  const dark = themeFor(b, themePref()) === "dark";
  const root = document.documentElement;
  root.classList.toggle("rs-dark", dark);
  let st = document.getElementById("club-dark");
  if (dark) {
    if (!st) { st = document.createElement("style"); st.id = "club-dark"; document.head.appendChild(st); }
    st.textContent = darkCss(b.colors);
    setMeta('meta[name="theme-color"]', "content", "#141011");
  } else if (st) {
    st.remove();
  }
}

// La persona cambia de modo (botón del menú): se guarda en este navegador y se aplica al momento
export function setThemePref(pref, b = BRAND) {
  try { window.localStorage.setItem(THEME_PREF_KEY, pref === "dark" ? "dark" : "light"); } catch { /* sin almacenamiento */ }
  applyTheme(b);
}

// Carga una tipografía (Google Fonts o archivo subido). `id` evita cargarla dos veces.
export function loadFont({ name, kind, url }, id) {
  if (typeof document === "undefined" || !name) return;
  const key = `club-font-${id}`;
  const prev = document.getElementById(key);
  const sig = `${kind}|${name}|${url || ""}`;
  if (prev?.dataset.sig === sig) return;
  prev?.remove();
  let el = null;
  if (kind === "google") {
    el = document.createElement("link");
    el.rel = "stylesheet";
    el.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@300;400;500;600;700;800;900&display=swap`;
  } else if (kind === "file" && url) {
    el = document.createElement("style");
    el.textContent = `@font-face{font-family:'${name.replace(/'/g, "")}';src:url('${url.replace(/'/g, "%27")}');font-weight:100 900;font-style:normal;font-display:swap}`;
  }
  if (!el) return;
  el.id = key;
  el.dataset.sig = sig;
  document.head.appendChild(el);
}

const setMeta = (sel, attr, value) => { const el = document.querySelector(sel); if (el && value) el.setAttribute(attr, value); };

export function applyBrand(b = BRAND) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(brandCssVars(b))) root.style.setProperty(k, v);
  const f = b.fonts || {};
  for (const role of FONT_ROLES) loadFont({ name: f[`${role}Name`], kind: f[`${role}Kind`], url: f[`${role}Url`] }, role);
  if (b.appName) {
    document.title = b.appName;
    setMeta('meta[name="apple-mobile-web-app-title"]', "content", b.appName);
  }
  setMeta('meta[name="theme-color"]', "content", b.colors?.primary);
  // Icono de la pestaña: el servidor lo hace cuadrado sin deformar (un escudo no es cuadrado y el navegador lo estiraba).
  // La «v» cambia con la imagen para que el navegador no se quede con el de antes.
  const favSrc = b.icon || b.logo || "";
  let h = 0; for (let i = 0; i < favSrc.length; i += 1) h = (h * 31 + favSrc.charCodeAt(i)) | 0;
  setMeta('link[rel="icon"]', "href", `/api/icon?fav=1&s=64&v=${(h >>> 0).toString(36)}`);
  // Patrones de página: solo hay reglas si se ha cambiado algo
  const css = patternCss(b, b.colors);
  let st = document.getElementById("club-patterns");
  if (css && !st) { st = document.createElement("style"); st.id = "club-patterns"; document.head.appendChild(st); }
  if (st) st.textContent = css;
  applyTheme(b);
}
