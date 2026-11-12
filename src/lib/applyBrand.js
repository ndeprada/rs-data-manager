// Pone en la página las variables CSS del club (colores y tipografías) y el título de la pestaña.
// Se llama en main.jsx antes de pintar la app. Sin cambios, salen los valores de Racing Sarrià
// (los mismos que ya tiene index.css como respaldo), así que no cambia nada de lo que se ve.
import { BRAND, DEFAULT_BRAND, brandCssVars } from "./brand.js";

export function applyBrand(b = BRAND) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(brandCssVars(b))) root.style.setProperty(k, v);
  // Tipografía de títulos del club (si no es la que ya trae la app, se carga desde su dirección)
  const f = b.fonts || {};
  if (f.titleUrl && f.titleUrl !== DEFAULT_BRAND.fonts.titleUrl && !document.getElementById("club-font-title")) {
    const st = document.createElement("style");
    st.id = "club-font-title";
    st.textContent = `@font-face{font-family:'${f.titleName}';src:url('${f.titleUrl}');font-weight:100 900;font-style:normal;font-display:swap}`;
    document.head.appendChild(st);
  }
}
