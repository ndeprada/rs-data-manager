import { getCurrentUser } from './_lib/auth.js';
import { syncFcf } from './_lib/fcfSync.js';
import { standingsHandler } from './_lib/fcfStandings.js';
import { db } from './_lib/db.js';
import { createBackup } from './_lib/backup.js';
import { acquireSyncLock, releaseSyncLock } from './_lib/syncLock.js';
import { canUseAutoSync, publicStatus, readSyncStatus, runAutoSync, runTrackedSync } from './_lib/syncStatus.js';

// Una sola función para todo lo de la FCF (el plan gratuito de Vercel limita cuántas funciones se pueden tener):
//   /api/sync-fcf                → sincronizar ahora (botón de Equipos, o la ejecución programada de cada noche)
//   /api/sync-fcf?status=1       → cuándo fue la última sincronización y cómo salió
//   /api/sync-fcf?auto=1         → «sincroniza solo si toca»: la app lo pide al abrirse; el servidor decide (3 h tras una buena, 30 min tras una fallida)
//   /api/sync-fcf?standings=ID   → clasificación y próximos rivales de un equipo

// SONDA TEMPORAL (07/11/2026): la FCF vuelve a contestar 403. Prueba varias formas de pedir los datos (solo lectura) y devuelve
// solo los códigos y algunas cabeceras de respuesta. Se quita en cuanto se sepa qué acepta.
const PROBE_KEY = '34d692850f5c421ba13fe332';
async function probeFcf(res) {
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
  const ch = { 'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"', 'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"macOS"' };
  const variants = {
    actual: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json, text/plain, */*', 'accept-language': 'ca-ES,ca;q=0.9,es;q=0.8,en;q=0.7', referer: 'https://www.fcf.cat/', origin: 'https://www.fcf.cat' },
    sinOrigin: { 'user-agent': UA, accept: 'application/json, text/plain, */*', 'accept-language': 'ca-ES,ca;q=0.9,es;q=0.8', referer: 'https://www.fcf.cat/' },
    navegador: { 'user-agent': UA, accept: 'application/json, text/plain, */*', 'accept-language': 'ca-ES,ca;q=0.9,es;q=0.8', 'accept-encoding': 'gzip, deflate, br', referer: 'https://www.fcf.cat/', ...ch, 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin' },
    pagina: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'accept-language': 'ca-ES,ca;q=0.9,es;q=0.8', 'accept-encoding': 'gzip, deflate, br', ...ch, 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none', 'upgrade-insecure-requests': '1' },
    minimo: {},
  };
  const out = [];
  const hit = async (u, name, h) => {
    try {
      const r = await fetch(u, { headers: h, redirect: 'manual' });
      const txt = await r.text().catch(() => '');
      out.push({ u, name, status: r.status, cache: r.headers.get('x-cache'), type: r.headers.get('content-type'), loc: r.headers.get('location'), body: txt.slice(0, 160).replace(/\s+/g, ' ') });
      return { r, txt };
    } catch (e) { out.push({ u, name, error: String(e?.message || e) }); return null; }
  };
  // 1) la web: qué cookies pone y a qué direcciones de datos llama
  const page = await hit('https://www.fcf.cat/ca', 'web', variants.pagina);
  const cookies = (page?.r.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]);
  const html = page?.txt || '';
  const apis = [...new Set((html.match(/[a-z0-9:/._-]*api[a-z0-9/._?=&-]*/gi) || []).filter((x) => x.length > 4))].slice(0, 40);
  const scripts = [...new Set((html.match(/src="([^"]+\.js[^"]*)"/g) || []).map((x) => x.slice(5, -1)))].slice(0, 15);
  // 2) en los scripts de la web, las direcciones de datos
  const jsApis = new Set();
  for (const sc of scripts.slice(0, 8)) {
    try {
      const u = sc.startsWith('http') ? sc : `https://www.fcf.cat${sc.startsWith('/') ? '' : '/'}${sc}`;
      const t = await (await fetch(u, { headers: variants.pagina })).text();
      for (const m of t.match(/["'`][^"'`\s]{0,80}\/api\/[^"'`\s]{0,80}["'`]/g) || []) jsApis.add(m.slice(0, 120));
      for (const m of t.match(/https?:\/\/[a-z0-9.-]*fcf[a-z0-9.-]*\.[a-z]+[^"'`\s]{0,40}/gi) || []) jsApis.add(m.slice(0, 120));
    } catch { /* sigue */ }
  }
  // 3) la misma consulta con las cookies de la web y sin www
  const ck = cookies.length ? { cookie: cookies.join('; ') } : {};
  await hit('https://www.fcf.cat/api/clubs/40493342', 'conCookies', { ...variants.navegador, ...ck });
  await hit('https://fcf.cat/api/clubs/40493342', 'sinWww', variants.navegador);
  let ip = null;
  try { ip = await (await fetch('https://api.ipify.org?format=json')).json(); } catch { /* sin IP */ }
  return res.status(200).json({ region: process.env.VERCEL_REGION, ip, cookies: cookies.map((c) => c.split('=')[0]), apis, scripts, jsApis: [...jsApis].slice(0, 60), out });

}

export default async function handler(req, res) {
  if (req.query?.probe === PROBE_KEY) return probeFcf(res);
  if (req.query?.standings) { req.query.team_id = req.query.standings; return standingsHandler(req, res); }
  const auth = req.headers.authorization || '';
  const cronOk = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  const wantsStatus = !cronOk && !!req.query?.status;
  const wantsAuto = !cronOk && !wantsStatus && !!req.query?.auto;
  if (!cronOk) {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'auth_required' });
    const allowed = (wantsStatus || wantsAuto)
      ? canUseAutoSync(user)
      : user.role === 'admin' || String(user.app_role || '').startsWith('coordinador');
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
  }

  if (wantsStatus) {
    try { return res.status(200).json(publicStatus(await readSyncStatus(db))); }
    catch (e) { console.error('estado de sincronización', e); return res.status(500).json({ error: 'status_unavailable' }); }
  }

  if (wantsAuto) return autoSync(res);

  // La ejecución programada de cada noche también guarda la copia de seguridad diaria (sin parar la sincronización si falla)
  if (cronOk) {
    try { await createBackup(db, { kind: 'auto', note: 'Copia diaria' }); }
    catch (e) { console.error('backup diario', e); }
  }
  if (!(await acquireSyncLock(db))) {
    return res.status(409).json({ ok: false, error: 'Ya hay una sincronización en marcha. Espera un par de minutos y vuelve a mirar.' });
  }
  try {
    const r = await runTrackedSync(db, cronOk ? 'noche' : 'manual', syncFcf);
    if (r.ok) res.status(200).json({ ok: true, ...r.stats });
    else res.status(500).json({ ok: false, error: r.error });
  } finally {
    try { await releaseSyncLock(db); } catch (e) { console.error('liberar candado', e); }
  }
}

// Al abrir la app: si no toca, no hace nada (respuesta inmediata); si toca, sincroniza igual que el botón.
async function autoSync(res) {
  try {
    return res.status(200).json(await runAutoSync(db, syncFcf));
  } catch (e) {
    console.error('sincronización automática', e);
    return res.status(500).json({ ran: false, error: 'auto_failed' });
  }
}
