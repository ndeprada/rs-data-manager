import { query } from '../_lib/db.js';
import { hashPassword, signToken, setAuthCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  try {
    const { email, password, full_name } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'email_and_password_required' });
      return;
    }

    const existing = await query('select id from auth_users where email = $1', [
      email.toLowerCase().trim(),
    ]);
    if (existing.rows[0]) {
      res.status(409).json({ error: 'email_already_registered' });
      return;
    }

    const { rows: countRows } = await query(
      `select count(*)::int as n from entities where entity_type = 'User'`
    );
    const isFirstUser = countRows[0].n === 0;

    const password_hash = await hashPassword(password);
    const { rows: authRows } = await query(
      `insert into auth_users (email, password_hash) values ($1, $2) returning id`,
      [email.toLowerCase().trim(), password_hash]
    );
    const userId = authRows[0].id;

    const profile = {
      full_name: full_name || '',
      role: isFirstUser ? 'admin' : 'user',
      app_role: isFirstUser ? 'coordinador_general' : undefined,
      access_status: isFirstUser ? 'approved' : 'pending',
    };
    Object.keys(profile).forEach((k) => profile[k] === undefined && delete profile[k]);

    await query(
      `insert into entities (id, entity_type, data) values ($1, 'User', $2::jsonb)`,
      [userId, JSON.stringify(profile)]
    );

    const token = signToken(userId);
    setAuthCookie(res, token);
    res.status(201).json({ id: userId, email, ...profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'register_failed', message: err.message });
  }
}
