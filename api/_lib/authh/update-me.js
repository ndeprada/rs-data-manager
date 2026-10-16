import { query } from '../db.js';
import { requireUser } from '../auth.js';

const REQUESTABLE_FUNCTIONS = [
  'director', 'director_deportivo', 'coordinador_general', 'coordinador_f7', 'coordinador_f11', 'entrenador', 'entrenador_porteros',
  'preparador_fisico', 'psicologo', 'fisioterapeuta', 'jugador', 'familiar',
];
// Datos de perfil que cada persona puede cambiarse a sí misma
const PROFILE_FIELDS = ['full_name', 'phone', 'photo_url', 'notes', 'birth_date', 'birth_country', 'birth_region', 'birth_province', 'birth_city'];
// Datos de la solicitud de acceso (solo mientras no tenga acceso aprobado)
const REQUEST_FIELDS = ['person_type', 'app_role_pending', 'requested_assignments', 'requested_team_id'];

export default async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'PATCH' && req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const body = req.body || {};
    const canRequest =
      user.role !== 'admin' &&
      user.access_status !== 'approved' &&
      user.access_status !== 'deleted' &&
      user.access_status !== 'rejected';

    const patch = {};
    PROFILE_FIELDS.forEach((k) => {
      if (k in body) patch[k] = body[k];
    });

    if (canRequest) {
      REQUEST_FIELDS.forEach((k) => {
        if (k in body) patch[k] = body[k];
      });
      if (patch.app_role_pending && !REQUESTABLE_FUNCTIONS.includes(patch.app_role_pending)) {
        res.status(400).json({ error: 'invalid_role' });
        return;
      }
      if (patch.person_type && !['jugador', 'cuerpo_tecnico', 'familiar'].includes(patch.person_type)) {
        res.status(400).json({ error: 'invalid_person_type' });
        return;
      }
      if (body.access_status === 'pending' && user.access_status !== 'rejected') {
        patch.access_status = 'pending';
      }
    }

    if (Object.keys(patch).length === 0) {
      res.status(200).json(user);
      return;
    }

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
