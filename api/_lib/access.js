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
const PROFILE_FIELDS = new Set(['phone', 'notes', 'birth_date', 'photo_url', 'full_name', 'birth_country', 'birth_region', 'birth_province', 'birth_city']);
// Campos de vinculación a equipos: además los puede tocar la coordinación
const TEAM_LINK_FIELDS = new Set(['staff_member_id', 'team_id', 'team_ids', 'secondary_role', 'secondary_team_ids']);

const CLUB_PRIVATE = new Set(['Notice', 'PushSubscription', 'GuardianLink', 'PushConfig', 'IcsConfig', 'SeasonClose', 'FcfSyncLock']);

const COORDINATOR_ROLES = ['director', 'director_deportivo', 'coordinador_general', 'coordinador_f7', 'coordinador_f11'];

export const isAdmin = (u) => u.role === 'admin';
// Usuarios antiguos sin estado pero con función asignada se consideran aprobados (igual que en la app)
export const isApproved = (u) =>
  isAdmin(u) || u.access_status === 'approved' || (!u.access_status && !!u.app_role);

export function checkEntityAccess(user, entity, method, body = {}, targetId = null) {
  if (isAdmin(user)) return { ok: true };

  // Avisos, suscripciones push y vínculos de familiares: solo a través de /api/club (cada persona ve lo suyo)
  if (CLUB_PRIVATE.has(entity)) return { ok: false, error: 'club_private' };
  // Familiares: aún sin acceso a datos del club (su vista limitada llegará aparte)
  if (user.app_role === 'familiar') {
    if (method === 'GET' && entity === 'Team') return { ok: true };
    return { ok: false, error: 'guardian_forbidden' };
  }

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

// Mismo criterio que la app: convocatoria completa, alineación completa y minutos de todos los titulares.
function matchClosed(ev, conv, evStats) {
  const n = ev.football_format === 'f7' ? 7 : ev.football_format === 'f5' ? 5 : 11;
  if (!conv || (conv.player_ids || []).length < n) return false;
  const starters = conv.starters || [];
  if (starters.length < n) return false;
  return starters.every((id) => evStats.some((s) => s.player_id === id && (s.minutes_played || 0) > 0));
}

export async function playerFilterDocs(user, entity, docs) {
  const scope = await playerScope(user);
  let closed = null;
  if (entity === 'Event' && scope.teamId) {
    const { rows: cv } = await query(`select data from entities where entity_type = 'Convocatoria' and data ->> 'team_id' = $1`, [scope.teamId]);
    const { rows: ms } = await query(
      `select data from entities where entity_type = 'MatchStats' and data ->> 'event_id' = any($1)`,
      [docs.filter((d) => d.team_id === scope.teamId).map((d) => d.id)]
    );
    const convBy = new Map(cv.map((r) => [r.data.event_id, r.data]));
    const statsBy = new Map();
    for (const r of ms) { if (!statsBy.has(r.data.event_id)) statsBy.set(r.data.event_id, []); statsBy.get(r.data.event_id).push(r.data); }
    closed = (d) => matchClosed(d, convBy.get(d.id), statsBy.get(d.id) || []);
  }
  const out = [];
  for (const d of docs) {
    const v = playerView(entity, d, scope, user.id);
    if (v) out.push(closed && v.team_id === scope.teamId ? { ...v, stats_closed: closed(d) } : v);
  }
  return out;
}

// ── Gestión de convocatorias: solo admin y entrenadores del propio equipo ─────
export function coachTeamIdsOf(u) {
  if (u.app_role === 'entrenador') return [...(u.team_ids || []), ...(u.team_id ? [u.team_id] : [])];
  if (u.secondary_role === 'entrenador') return u.secondary_team_ids || [];
  return [];
}

const TEAM_MANAGED = new Set(['Convocatoria']);

export async function checkTeamWrite(user, entity, method, body, id) {
  if (method === 'GET' || !TEAM_MANAGED.has(entity) || isAdmin(user)) return { ok: true };
  let teamId = body?.team_id || null;
  let eventId = body?.event_id || null;
  if (id) {
    const { rows } = await query(`select data from entities where entity_type = $1 and id = $2`, [entity, id]);
    if (rows[0]) { teamId = rows[0].data?.team_id || teamId; eventId = rows[0].data?.event_id || eventId; }
  }
  if (!teamId && eventId) {
    const { rows } = await query(`select data from entities where entity_type = 'Event' and id::text = $1`, [String(eventId)]);
    teamId = rows[0]?.data?.team_id || null;
  }
  if (!teamId) return { ok: true };
  return coachTeamIdsOf(user).includes(teamId) ? { ok: true } : { ok: false, error: 'not_team_coach' };
}
