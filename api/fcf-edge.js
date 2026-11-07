// SONDA TEMPORAL (07/11/2026): ¿la FCF deja pasar a las funciones «edge» de Vercel (otras direcciones que las de Amazon)? Solo lectura; se quitará.
export const config = { runtime: 'edge' };
const KEY = '34d692850f5c421ba13fe332';
const H = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  accept: 'application/json, text/plain, */*', 'accept-language': 'ca-ES,ca;q=0.9,es;q=0.8', referer: 'https://www.fcf.cat/ca/competicio',
};
export default async function handler(req) {
  const url = new URL(req.url);
  if (url.searchParams.get('k') !== KEY) return new Response('no', { status: 404 });
  const out = [];
  for (const u of ['https://www.fcf.cat/api/competition/temporadas', 'https://www.fcf.cat/api/clubs/40493342']) {
    try { const r = await fetch(u, { headers: H }); const t = await r.text(); out.push({ u, status: r.status, cache: r.headers.get('x-cache'), pop: r.headers.get('x-amz-cf-pop'), head: t.slice(0, 120) }); }
    catch (e) { out.push({ u, error: String(e) }); }
  }
  let ip = null;
  try { ip = await (await fetch('https://api.ipify.org?format=json')).json(); } catch { /* sin IP */ }
  return new Response(JSON.stringify({ ip, out }), { headers: { 'content-type': 'application/json' } });
}
