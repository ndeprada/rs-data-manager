import { getCurrentUser } from './_lib/auth.js';
import { syncFcf } from './_lib/fcfSync.js';
import { standingsHandler } from './_lib/fcfStandings.js';
import { db } from './_lib/db.js';
import { createBackup } from './_lib/backup.js';

export default async function handler(req, res) {
  if (req.query?.standings) { req.query.team_id = req.query.standings; return standingsHandler(req, res); }
  const auth = req.headers.authorization || '';
  const cronOk = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk) {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'auth_required' });
    const allowed = user.role === 'admin' || String(user.app_role || '').startsWith('coordinador');
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
  }
  // La ejecución programada de cada noche también guarda la copia de seguridad diaria (sin parar la sincronización si falla)
  if (cronOk) {
    try { await createBackup(db, { kind: 'auto', note: 'Copia diaria' }); }
    catch (e) { console.error('backup diario', e); }
  }
  try {
    const stats = await syncFcf();
    res.status(200).json({ ok: true, ...stats });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
}
