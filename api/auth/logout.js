import { clearAuthCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  clearAuthCookie(res);
  res.status(200).json({ ok: true });
}
