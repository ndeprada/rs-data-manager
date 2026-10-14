// Reglas de acceso del almacén genérico de entidades.
// - Administrador: todo.
// - Usuario aprobado: leer y escribir datos del club, pero NO cambiar permisos de usuarios.
// - Usuario sin aprobar (pendiente, rechazado, eliminado o sin solicitud): solo puede ver los equipos
//   (para elegir el suyo al registrarse). Nada de datos de jugadores.

import { query } from './db.js';

const PERMISSION_FIELDS = new Set([
  'role', 'app_role', 'player_id', 'app_role_pending', 'access_status', 'person_type',
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

  // Jugador: solo lectura de sus datos (se filtra fila a fila en los handlers). Solo puede editar su propio perfil.
  if (isPlayerUser(user)) {
    if (entity === 'User') {
      if (method === 'GET') return { ok: true };
    } else if (method !== 'GET') {
      return { ok: false, error: 'player_readonly' };
    } else if (!PLAYER_READABLE.has(entity)) {
      return { ok: false, error: 'player_forbidden' };
    }
  }

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

// ── Acceso de jugadores ──────────────────────────────────────────────────────
export const isPlayerUser = (u) => !isAdmin(u) && u.app_role === 'jugador';

const PLAYER_READABLE = new Set([
  'Team', 'Player', 'Event', 'Convocatoria', 'MatchStats', 'TrainingAttendance', 'Injury',
  'PlayerDocument', 'PDI', 'PDIGoal', 'Evaluation360', 'PlayerSeasonHistory', 'TrainingLoad', 'MatchAvailability',
]);
// Datos mínimos de un compañero de equipo
const TEAMMATE_FIELDS = ['first_name', 'last_name', 'nickname', 'jersey_number', 'position', 'photo_url', 'team_id', 'status', 'birth_year'];
const NOTE_KEY = /note|obs|comment|private|internal|rating|valoraci/i;

async function playerScope(user) {
  const playerId = user.player_id || null;
  if (!playerId) return { playerId: null, teamId: null };
  const { rows } = await query(`select data from entities where entity_type = 'Player' and id = $1`, [playerId]);
  return { playerId, teamId: rows[0]?.data?.team_id || null };
}

// Devuelve el documento visible para el jugador (o null) con los campos sensibles retirados.
export function playerView(entity, doc, scope, userId) {
  const { playerId, teamId } = scope;
  const own = playerId && (entity === 'Player' ? doc.id === playerId : doc.player_id === playerId);
  const strip = (d, extra = []) => {
    const out = {};
    for (const [k, v] of Object.entries(d)) if (!NOTE_KEY.test(k) && !extra.includes(k)) out[k] = v;
    return out;
  };
  switch (entity) {
    case 'Team': return doc;
    case 'Player': {
      if (own) return doc;
      if (teamId && doc.team_id === teamId) {
        const out = { id: doc.id };
        for (const k of TEAMMATE_FIELDS) if (doc[k] !== undefined) out[k] = doc[k];
        return out;
      }
      return null;
    }
    case 'Event': return teamId && doc.team_id === teamId ? strip(doc) : null;
    case 'Convocatoria': return teamId && doc.team_id === teamId ? doc : null;
    case 'MatchStats': return own ? strip(doc) : null;
    case 'TrainingAttendance': case 'MatchAvailability': return own ? strip(doc) : null;
    case 'Injury': case 'PlayerDocument': case 'PlayerSeasonHistory': case 'TrainingLoad': return own ? doc : null;
    case 'PDI': case 'PDIGoal': case 'Evaluation360': return own && doc.visible_to_player === true ? doc : null;
    case 'User': return doc.id === userId ? doc : null;
    default: return null;
  }
}

export async function playerFilterDocs(user, entity, docs) {
  const scope = await playerScope(user);
  const out = [];
  for (const d of docs) {
    const v = playerView(entity, d, scope, user.id);
    if (v) out.push(v);
  }
  return out;
}
