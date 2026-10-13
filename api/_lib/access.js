// Reglas de acceso del almacén genérico de entidades.
// - Administrador: todo.
// - Usuario aprobado: leer y escribir datos del club, pero NO cambiar permisos de usuarios.
// - Usuario sin aprobar (pendiente, rechazado, eliminado o sin solicitud): solo puede ver los equipos
//   (para elegir el suyo al registrarse). Nada de datos de jugadores.

const PERMISSION_FIELDS = new Set([
  'role', 'app_role', 'app_role_pending', 'access_status', 'person_type',
  'requested_assignments', 'requested_team_id', 'rejection_reason',
]);
// Campos de perfil que cualquier usuario aprobado puede editar (propio o, en la ficha de personal, ajeno)
const PROFILE_FIELDS = new Set(['phone', 'notes', 'birth_date', 'photo_url', 'full_name']);
// Campos de vinculación a equipos: además los puede tocar la coordinación
const TEAM_LINK_FIELDS = new Set(['staff_member_id', 'team_id', 'team_ids', 'secondary_role', 'secondary_team_ids']);

const COORDINATOR_ROLES = ['director', 'director_deportivo', 'coordinador_general', 'coordinador_f7', 'coordinador_f11'];

export const isAdmin = (u) => u.role === 'admin';
// Usuarios antiguos sin estado pero con función asignada se consideran aprobados (igual que en la app)
export const isApproved = (u) =>
  isAdmin(u) || u.access_status === 'approved' || (!u.access_status && !!u.app_role);

export function checkEntityAccess(user, entity, method, body = {}, targetId = null) {
  if (isAdmin(user)) return { ok: true };

  if (!isApproved(user)) {
    if (method === 'GET' && entity === 'Team') return { ok: true };
    return { ok: false, error: 'not_approved' };
  }

  if (entity === 'User' && method !== 'GET') {
    if (method !== 'PUT' && method !== 'PATCH') return { ok: false, error: 'admin_only' };
    const isCoordinator = COORDINATOR_ROLES.includes(user.app_role);
    const isSelf = targetId === user.id;
    for (const key of Object.keys(body || {})) {
      if (PROFILE_FIELDS.has(key)) continue;
      if (TEAM_LINK_FIELDS.has(key) && (isCoordinator || (isSelf && key === 'staff_member_id'))) continue;
      return { ok: false, error: 'forbidden_field', field: key };
    }
  }
  return { ok: true };
}

export { PERMISSION_FIELDS, PROFILE_FIELDS };
