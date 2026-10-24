// TEMPORAL: sonda de diagnóstico de la conexión con la FCF. Solo devuelve códigos HTTP y cabeceras de la respuesta de la FCF. Se borra tras el diagnóstico.
export const PROBE_KEY = 'fd7591455b3a52d8';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const navegador = { 'user-agent': UA, accept: 'application/json, text/plain, */*', 'accept-language': 'ca-ES,ca;q=0.9,es;q=0.8,en;q=0.7', referer: 'https://www.fcf.cat/', origin: 'https://www.fcf.cat' };
const VARIANTS = {
  actual: { 'user-agent': UA, accept: 'application/json' },
  navegador,
  completa: { ...navegador, 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin', 'sec-ch-ua': '"Chromium";v="124", "Not-A.Brand";v="99"', 'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"macOS"' },
  sinCabeceras: {},
};
const TARGETS = {
  club: 'https://www.fcf.cat/api/clubs/40493342',
  temporadas: 'https://www.fcf.cat/api/competition/temporadas',
};

async function hit(url, headers) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(6000) });
    const txt = await r.text();
    const hs = {};
    r.headers.forEach((v, k) => { hs[k] = k === 'set-cookie' ? '(cookie)' : String(v).slice(0, 120); });
    let keys;
    if (r.ok) { try { const j = JSON.parse(txt); const d = j.data !== undefined ? j.data : j; keys = Array.isArray(d) ? `array(${d.length})` : Object.keys(d).slice(0, 8); } catch { keys = 'no-json'; } }
    return { status: r.status, ms: Date.now() - t0, headers: hs, keys, body: r.ok ? undefined : txt.replace(/\s+/g, ' ').slice(0, 300) };
  } catch (e) {
    return { error: String(e && e.message || e).slice(0, 200), ms: Date.now() - t0 };
  }
}

export async function runProbe() {
  const jobs = [];
  for (const [tn, url] of Object.entries(TARGETS)) for (const [vn, h] of Object.entries(VARIANTS)) jobs.push([`${tn}/${vn}`, url, h]);
  jobs.push(['home/actual', 'https://www.fcf.cat/', VARIANTS.actual]);
  const out = await Promise.all(jobs.map(async ([name, url, h]) => [name, await hit(url, h)]));
  let ip = null;
  try { ip = (await (await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) })).json()).ip; } catch { ip = 'desconocida'; }
  return { region: process.env.VERCEL_REGION || null, egress_ip: ip, results: Object.fromEntries(out) };
}
