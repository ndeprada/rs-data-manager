import { query } from '../_lib/db.js';
import { comparePassword, signToken, setAuthCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'email_and_password_required' });
      return;
    }
    const { rows } = await query(
      `select a.id, a.password_hash, a.email, e.data
         from auth_users a
         join entities e on e.id = a.id and e.entity_type = 'User'
        where a.email = $1`,
      [email.toLowerCase().trim()]
    );
    const row = rows[0];
    if (!row) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }
    const ok = await comparePassword(password, row.password_hash);
    if (!ok) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }
    const token = signToken(row.id);
    setAuthCookie(res, token);
    res.status(200).json({ id: row.id, email: row.email, ...row.data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'login_failed', message: err.message });
  }
}
