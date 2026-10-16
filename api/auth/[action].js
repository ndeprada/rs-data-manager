// Una sola función para login / logout / me / register / update-me (el plan de Vercel limita el número de funciones).
import login from '../_lib/authh/login.js';
import logout from '../_lib/authh/logout.js';
import me from '../_lib/authh/me.js';
import register from '../_lib/authh/register.js';
import updateMe from '../_lib/authh/update-me.js';

const ROUTES = { login, logout, me, register, 'update-me': updateMe };

export default async function handler(req, res) {
  const fn = ROUTES[req.query.action];
  if (!fn) { res.status(404).json({ error: 'not_found' }); return; }
  return fn(req, res);
}
