import { getCurrentUser } from './_lib/auth.js';
import { syncFcf } from './_lib/fcfSync.js';
import { standingsHandler, prefetchStandings } from './_lib/fcfStandings.js';
import { saveRelayItems, withRelay } from './_lib/fcfHttp.js';
import { db } from './_lib/db.js';
import { createBackup } from './_lib/backup.js';
import { acquireSyncLock, releaseSyncLock } from './_lib/syncLock.js';
import { relayKeyFor, userFromRelayKey } from './_lib/fcfRelayKey.js';
import { canUseAutoSync, publicStatus, readSyncStatus, recordRelaySync, runAutoSync, runTrackedSync } from './_lib/syncStatus.js';

// Una sola función para todo lo de la FCF (el plan gratuito de Vercel limita cuántas funciones se pueden tener):
//   /api/sync-fcf                → sincronizar ahora (botón de Equipos, o la ejecución programada de cada noche)
//   /api/sync-fcf?status=1       → cuándo fue la última sincronización y cómo salió
//   /api/sync-fcf?auto=1         → «sincroniza solo si toca»: la app lo pide al abrirse; el servidor decide (3 h tras una buena, 30 min tras una fallida)
//   /api/sync-fcf?standings=ID   → clasificación y próximos rivales de un equipo
//   /api/sync-fcf?relay=key      → llave personal del marcador «RS Manager · FCF» (con la sesión de la app)
//   /api/sync-fcf?relay=put|sync|standings (POST) → «Actualizar desde la FCF»: el marcador, dentro de la web de la FCF, trae los datos
//                                    (la FCF ya no deja leer al servidor), los entrega con put y pide sync/standings hasta que no falta
//                                    nada (public/fcf-relay.js). Llega desde www.fcf.cat con la llave en la cabecera x-rs-relay.

export default async function handler(req, res) {
  if (req.query?.standings) { req.query.team_id = req.query.standings; return standingsHandler(req, res); }
  if (req.query?.relay) return relayHandler(req, res);
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
    else if (r.blocked) res.status(200).json({ ok: false, blocked: true, error: r.error });
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

// «Actualizar desde la FCF» desde el navegador (relevo). Lo puede usar el personal del club, como la sincronización automática.
const FCF_ORIGINS = ['https://www.fcf.cat', 'https://fcf.cat'];
async function relayHandler(req, res) {
  const origin = String(req.headers.origin || '');
  if (FCF_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-rs-relay');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  const key = req.headers['x-rs-relay'];
  // Desde la web de la FCF solo vale la llave; la sesión de la app, solo desde la app
  const user = key ? await userFromRelayKey(key) : (FCF_ORIGINS.includes(origin) ? null : await getCurrentUser(req));
  if (!user) return res.status(401).json({ error: key ? 'bad_key' : 'auth_required' });
  if (!canUseAutoSync(user)) return res.status(403).json({ error: 'forbidden' });
  if (String(req.query.relay) === 'key') {
    if (key) return res.status(403).json({ error: 'forbidden' });
    return res.status(200).json({ key: relayKeyFor(user) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const mode = String(req.query.relay);
  try {
    if (mode === 'put') return res.status(200).json({ saved: await saveRelayItems(req.body?.items) });
    if (mode === 'sync' || mode === 'standings') {
      // `skip`: direcciones que la FCF no ha querido dar ni al navegador (p. ej. un acta que ya no existe): no se espera por ellas
      const skip = new Set(Array.isArray(req.body?.skip) ? req.body.skip.map(String) : []);
      const r = await withRelay(() => (mode === 'sync' ? syncFcf() : prefetchStandings()));
      const missing = r.missing.filter((u) => !skip.has(u));
      if (missing.length) return res.status(200).json({ done: false, missing });
      if (r.error) {
        if (r.error.code !== 'fcf_missing') console.error('relevo FCF', r.error);
        return res.status(200).json({ done: false, error: r.error.code === 'fcf_missing' ? 'La FCF no ha dado los datos del club' : r.error.message });
      }
      if (mode === 'sync') { try { await recordRelaySync(db, r.out); } catch (e) { console.error('estado de sincronización (relevo)', e); } }
      return res.status(200).json({ done: true, stats: r.out });
    }
    return res.status(400).json({ error: 'relay' });
  } catch (e) {
    console.error('relevo FCF', e);
    return res.status(500).json({ error: e.message });
  }
}
