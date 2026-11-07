// «Actualizar desde la FCF» (07/11/2026). La FCF ya no deja que el servidor de la app lea su API (403 a todo lo que sale de Vercel/Amazon),
// pero sí la lee el navegador que está en su web. Así que el navegador hace de relevo:
//   1. La persona abre www.fcf.cat (desde la app, con «Abrir la web de la FCF») y pulsa el marcador «RS Manager · FCF».
//   2. El marcador se presenta a la app (mensaje entre ventanas) y desde ese momento contesta a «tráeme estas direcciones»
//      leyéndolas en la propia web de la FCF (mismo sitio: permitido).
//   3. La app pregunta al servidor qué le falta (?relay=sync y luego ?relay=standings), se lo pide al marcador, se lo entrega al
//      servidor (?relay=put) y vuelve a preguntar, hasta que no falta nada.
// Solo lectura en la FCF. El marcador solo contesta a la app y solo lee direcciones /api/ de fcf.cat; la app solo acepta mensajes de fcf.cat.

export const FCF_ORIGINS = ["https://www.fcf.cat", "https://fcf.cat"];
export const isFcfOrigin = (o) => FCF_ORIGINS.includes(o);
export const FCF_HOME = "https://www.fcf.cat/ca";
export const RELAY_WINDOW = "rs-fcf";

/** Código del marcador (una sola línea). `app` = dirección de la app (https://rs-dm.vercel.app). */
export function bookmarkletCode(app) {
  const A = JSON.stringify(app);
  const src = `(()=>{const A=${A};if(!/(^|\\.)fcf\\.cat$/.test(location.hostname)){alert("Abre www.fcf.cat y vuelve a pulsar «RS Manager · FCF»");return}`
    + `let t=window.opener&&!window.opener.closed?window.opener:null;if(!t)t=window.open(A+"/FcfRelay","rs-fcf-relay");`
    + `const hi=()=>{try{t&&t.postMessage({t:"rs-relay-hello"},A)}catch(e){}};`
    + `if(window.__rsRelay){window.__rsRelay(t);return}`
    + `const ok=u=>{try{const x=new URL(u);return /(^|\\.)fcf\\.cat$/.test(x.hostname)&&x.pathname.startsWith("/api/")}catch(e){return false}};`
    + `addEventListener("message",async e=>{if(e.origin!==A)return;const d=e.data||{};`
    + `if(d.t==="rs-relay-ping"){t=e.source;hi();return}`
    + `if(d.t!=="rs-relay-get")return;const q=(d.urls||[]).filter(ok),out=[];let i=0;`
    + `const w=async()=>{while(i<q.length){const u=q[i++];try{const x=new URL(u);const r=await fetch(x.pathname+x.search,{credentials:"same-origin"});`
    + `out.push(r.ok?{url:u,body:await r.json()}:{url:u,status:r.status})}catch(err){out.push({url:u,error:String(err)})}}};`
    + `await Promise.all([1,2,3,4,5,6].map(w));try{e.source.postMessage({t:"rs-relay-got",id:d.id,out},A)}catch(err){}});`
    + `window.__rsRelay=n=>{t=n||t;hi()};hi();let k=0;const iv=setInterval(()=>{hi();if(++k>30)clearInterval(iv)},700);`
    + `if(!/RS Manager/.test(document.title))document.title="⇄ RS Manager · "+document.title})()`;
  return "javascript:" + encodeURIComponent(src);
}

/** Reparte lo traído en trozos que caben en una petición (el servidor admite ~4,5 MB) */
export function chunkItems(items, maxBytes = 1_500_000) {
  const out = [];
  let cur = [], size = 0;
  for (const it of items) {
    const n = JSON.stringify(it).length;
    if (cur.length && size + n > maxBytes) { out.push(cur); cur = []; size = 0; }
    cur.push(it); size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * Hace las vueltas hasta que el servidor no echa nada en falta.
 * @param {{ post:(mode:string, body?:object)=>Promise<any>, fetchUrls:(urls:string[])=>Promise<any[]>, onStep?:(s:object)=>void, maxRounds?:number }} deps
 * @returns {Promise<{ sync:any, standings:any, skipped:string[] }>}
 */
export async function runRelay({ post, fetchUrls, onStep, maxRounds = 12 }) {
  const failed = new Set();
  const result = { skipped: [] };
  for (const job of ["sync", "standings"]) {
    let last = "";
    for (let round = 1; ; round++) {
      onStep?.({ job, round, phase: "server" });
      const r = await post(job, { skip: [...failed] });
      if (r?.done) { result[job] = r.stats || {}; break; }
      const missing = (r?.missing || []).filter((u) => !failed.has(u));
      if (!missing.length) throw new Error(r?.error || "El servidor no ha podido terminar");
      const key = [...missing].sort().join("|");
      if (round > maxRounds || key === last) throw new Error("La FCF no termina de dar los datos. Vuelve a intentarlo en un rato.");
      last = key;
      onStep?.({ job, round, phase: "fcf", count: missing.length });
      const got = await fetchUrls(missing);
      const items = [];
      for (const g of got || []) {
        if (g && g.body !== undefined && g.body !== null && typeof g.body === "object") items.push({ url: g.url, body: g.body });
        else if (g?.url) failed.add(g.url);
      }
      // Lo que la FCF no da ni al navegador (un acta que ya no existe, p. ej.) no se espera
      for (const u of missing) if (!got?.some((g) => g?.url === u)) failed.add(u);
      if (!items.length && missing.every((u) => failed.has(u)) && job === "sync" && round === 1) throw new Error("La FCF no ha devuelto datos. ¿Sigue abierta su web?");
      onStep?.({ job, round, phase: "save", count: items.length });
      for (const chunk of chunkItems(items)) await post("put", { items: chunk });
    }
  }
  result.skipped = [...failed];
  return result;
}

/** Petición al servidor de la app */
export async function relayPost(mode, body = {}) {
  const r = await fetch(`/api/sync-fcf?relay=${mode}`, {
    method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}
