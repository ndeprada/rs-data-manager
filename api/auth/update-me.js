import { query } from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'PATCH' && req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const patch = req.body || {};
    const { rows } = await query(
      `update entities set data = data || $2::jsonb, updated_at = now()
        where entity_type = 'User' and id = $1
        returning id, data`,
      [user.id, JSON.stringify(patch)]
    );
    res.status(200).json({ id: rows[0].id, email: user.email, ...rows[0].data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'update_me_failed', message: err.message });
  }
}
