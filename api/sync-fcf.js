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
export default async function handler(req, res) {
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
