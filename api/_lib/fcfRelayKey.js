// Llave personal del marcador «RS Manager · FCF» (07/11/2026).
// El marcador trabaja dentro de la web de la FCF y desde allí habla con la app; la sesión de la app no viaja (la cookie es SameSite=Lax),
// así que el marcador lleva una llave: «<id del usuario>.<firma>». La firma sale del secreto del servidor, del usuario y de su
// `fcf_relay_v` (subirlo invalida las llaves anteriores). No se guarda en ninguna tabla.
// Solo sirve para el relevo de la FCF (traer datos y lanzar la sincronización); en cada uso se vuelve a comprobar que la persona sigue
// siendo personal aprobado del club.
import crypto from 'node:crypto';
import { query } from './db.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const sign = (id, v) => crypto.createHmac('sha256', SECRET).update(`fcf-relay|${id}|${v || 1}`).digest('base64url').slice(0, 32);

export const relayKeyFor = (user) => `${user.id}.${sign(user.id, user.fcf_relay_v)}`;

/** Comprueba la llave contra los datos del usuario (sin base de datos) */
export function keyMatches(key, user) {
  const s = String(key || '');
  const i = s.lastIndexOf('.');
  if (i <= 0 || !user) return false;
  const want = sign(user.id, user.fcf_relay_v);
  const got = s.slice(i + 1);
  return s.slice(0, i) === String(user.id) && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/** Usuario dueño de la llave, o null */
export async function userFromRelayKey(key) {
  const s = String(key || '');
  const i = s.lastIndexOf('.');
  if (i <= 0 || s.length > 200 || !UUID.test(s.slice(0, i))) return null;
  const { rows } = await query(
    `select e.id, e.data, a.email from entities e join auth_users a on a.id = e.id where e.id = $1 and e.entity_type = 'User'`,
    [s.slice(0, i)]
  );
  if (!rows[0]) return null;
  const user = { id: rows[0].id, email: rows[0].email, ...rows[0].data };
  return keyMatches(s, user) ? user : null;
}
