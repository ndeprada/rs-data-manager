// «Actualizar desde la FCF» (07/11/2026). La FCF ya no deja que el servidor de la app lea su API (403 a todo lo que sale de Vercel/Amazon),
// pero sí la lee el navegador que está en su web. Por eso:
//   1. La persona guarda una vez el marcador «RS Manager · FCF» (lleva su llave personal: api/_lib/fcfRelayKey.js).
//   2. Abre www.fcf.cat y pulsa el marcador: carga public/fcf-relay.js de la app, que hace todo desde la propia web de la FCF
//      (lee allí lo que la app echa en falta y se lo entrega) y enseña cómo va en un recuadro.
// Solo lectura en la FCF.

export const FCF_HOME = "https://www.fcf.cat/ca";

/** Código del marcador (una sola línea). `app` = dirección de la app (https://rs-dm.vercel.app); `key` = llave personal. */
export function bookmarkletCode(app, key) {
  const A = JSON.stringify(String(app).replace(/\/+$/, ""));
  const K = JSON.stringify(String(key || ""));
  const src = `(()=>{if(!/(^|\\.)fcf\\.cat$/.test(location.hostname)){alert("Abre www.fcf.cat y vuelve a pulsar «RS Manager · FCF»");return}`
    + `window.__rsRelayApp=${A};window.__rsRelayKey=${K};const s=document.createElement("script");`
    + `s.src=${A}+"/fcf-relay.js?v="+Date.now();s.onerror=()=>alert("No se ha podido abrir RS Manager. ¿Hay conexión?");`
    + `document.body.appendChild(s)})()`;
  return "javascript:" + encodeURIComponent(src);
}
