import { requireUser } from './_lib/auth.js';
import { query } from './_lib/db.js';
import { isAdmin, isApproved } from './_lib/access.js';

// Avisa por email al entrenador de que tiene feedback nuevo.
// Solo envía si RESEND_API_KEY está configurada; si no, no hace nada (el aviso en la app sigue funcionando).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const user = await requireUser(req, res);
  if (!user) return;
  if (!isAdmin(user) && (!isApproved(user) || user.app_role === 'jugador')) return res.status(403).json({ error: 'forbidden' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(200).json({ sent: false, reason: 'no_provider' });

  try {
    const { feedback_id } = req.body || {};
    const { rows } = await query(`select data from entities where id = $1 and entity_type = 'CoachFeedback'`, [feedback_id]);
    const fb = rows[0]?.data;
    if (!fb || fb.status !== 'enviado') return res.status(404).json({ error: 'not_found' });

    let email = '';
    let name = '';
    if (String(fb.staff_id).startsWith('user_')) {
      const r = await query(`select email from auth_users where id = $1`, [String(fb.staff_id).slice(5)]);
      email = r.rows[0]?.email || '';
    } else {
      const r = await query(`select data from entities where id = $1 and entity_type = 'StaffMember'`, [fb.staff_id]);
      email = r.rows[0]?.data?.email || '';
      name = r.rows[0]?.data?.first_name || '';
    }
    if (!email) return res.status(200).json({ sent: false, reason: 'no_email' });

    const from = process.env.NOTIFY_FROM || 'RS Manager <onboarding@resend.dev>';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Tienes feedback nuevo en RS Manager',
        html: `<p>Hola${name ? ' ' + name : ''},</p><p>${fb.author_name || 'Coordinación'} te ha enviado feedback${fb.date ? ' (' + fb.date + ')' : ''}. Entra en <a href="https://rs-dm.vercel.app">RS Manager</a> → Perfil y feedback para verlo.</p>`,
      }),
    });
    res.status(200).json({ sent: r.ok });
  } catch (err) {
    console.error(err);
    res.status(200).json({ sent: false, reason: 'error' });
  }
}
