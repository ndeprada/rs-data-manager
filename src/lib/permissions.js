// Permisos por función del club. Fuente única: la usan las pantallas y el servidor (api/_lib/access.js la importa).
//
// Cada función tiene un conjunto de capacidades. Si una persona tiene además un rol secundario (por ejemplo,
// coordinación que también entrena), se juntan las dos y gana la más amplia.
//
//   players      all | team  → qué jugadores ve (lista y ficha). "team" = solo los de sus equipos
//   stats        all | team | none → estadísticas de equipos (pantalla Estadísticas)
//   manage       all | team | none → convocatoria, acta y táctica (team = solo los equipos que entrena)
//   playerEval   edit | view | none → objetivos (PDI) y evaluaciones del jugador
//   medical      edit | view | none → lesiones, informes y documentos del jugador
//   load         edit | none → carga de entrenamiento
//   editPlayers  datos de la ficha del jugador y sus estadísticas de partido
//   coaches      all | stage | own → perfiles de entrenadores (feedback y evaluaciones)
//   evalCoaches  puede escribir feedback y evaluaciones a entrenadores
//   administration  pantallas de administración (accesos, temporada, personal…)
//   panel, myTeam, tools  qué apartados del menú tiene (panel del club, Mi Equipo y herramientas)

import { WEAK_FOOT_FIELD, isValidWeakFoot } from './weakFoot.js';

export const DIRECCION = ['director', 'director_deportivo', 'coordinador_general'];
export const COORD_ETAPA = ['coordinador_f7', 'coordinador_f11'];
export const COORDINATORS = [...DIRECCION, ...COORD_ETAPA];

const ALL_TOOLS = ['stats', 'methodology', 'tactics', 'scouting', 'reports', 'material'];
const MENU = { panel: true, myTeam: true, tools: ALL_TOOLS };

const COORD = {
  players: 'all', stats: 'all', manage: 'none', playerEval: 'edit', medical: 'edit', load: 'edit',
  editPlayers: true, coaches: 'all', evalCoaches: true, administration: true, ...MENU,
};

const CAPS = {
  admin: { ...COORD, manage: 'all' },
  director_deportivo: { ...COORD, manage: 'all' },
  director: { ...COORD },
  coordinador_general: { ...COORD },
  coordinador_f7: { ...COORD, coaches: 'stage' },
  coordinador_f11: { ...COORD, coaches: 'stage' },
  entrenador: {
    players: 'team', stats: 'team', manage: 'team', playerEval: 'edit', medical: 'edit', load: 'edit',
    editPlayers: true, coaches: 'own', evalCoaches: false, administration: false, ...MENU,
  },
  entrenador_porteros: {
    players: 'all', stats: 'all', manage: 'none', playerEval: 'edit', medical: 'none', load: 'none',
    editPlayers: false, coaches: 'own', evalCoaches: false, administration: false, ...MENU,
  },
  psicologo: {
    players: 'all', stats: 'all', manage: 'none', playerEval: 'edit', medical: 'view', load: 'none',
    editPlayers: false, coaches: 'all', evalCoaches: true, administration: false,
    panel: false, myTeam: false, tools: ['stats'],
  },
  preparador_fisico: {
    players: 'all', stats: 'all', manage: 'none', playerEval: 'edit', medical: 'view', load: 'edit',
    editPlayers: false, coaches: 'own', evalCoaches: false, administration: false, ...MENU,
  },
  fisioterapeuta: {
    players: 'all', stats: 'none', manage: 'none', playerEval: 'none', medical: 'edit', load: 'edit',
    editPlayers: false, coaches: 'own', evalCoaches: false, administration: false,
    panel: false, myTeam: false, tools: [],
  },
};

// Sin función conocida (jugador, familiar, pendiente…): nada
const NONE = {
  players: 'team', stats: 'none', manage: 'none', playerEval: 'none', medical: 'none', load: 'none',
  editPlayers: false, coaches: 'own', evalCoaches: false, administration: false,
  panel: true, myTeam: true, tools: [],
};

const RANK = {
  players: ['team', 'all'],
  stats: ['none', 'team', 'all'],
  manage: ['none', 'team', 'all'],
  playerEval: ['none', 'view', 'edit'],
  medical: ['none', 'view', 'edit'],
  load: ['none', 'edit'],
  coaches: ['own', 'stage', 'all'],
};
const BOOLS = ['editPlayers', 'evalCoaches', 'administration', 'panel', 'myTeam'];

function merge(a, b) {
  const out = { ...a };
  for (const [k, order] of Object.entries(RANK)) out[k] = order[Math.max(order.indexOf(a[k]), order.indexOf(b[k]))];
  for (const k of BOOLS) out[k] = !!(a[k] || b[k]);
  out.tools = [...new Set([...a.tools, ...b.tools])];
  return out;
}

// Funciones que cuentan para una persona (la principal y, si la hay, la secundaria de entrenador)
export function rolesOf(user) {
  if (!user) return [];
  const roles = [];
  if (user.role === 'admin') roles.push('admin');
  if (user.app_role) roles.push(user.app_role);
  if (user.secondary_role) roles.push(user.secondary_role);
  return roles;
}

export function permissionsOf(user) {
  const known = rolesOf(user).filter((r) => CAPS[r]);
  const caps = known.length ? known.map((r) => CAPS[r]).reduce(merge) : NONE;
  const roles = rolesOf(user);
  return {
    ...caps,
    roles,
    isAdmin: roles.includes('admin'),
    // Pantalla "Mi equipo" con selector de cualquier equipo (solo lectura salvo que además entrenen)
    allTeams: caps.players === 'all',
    // Quienes no ven a todos los jugadores solo trabajan con sus equipos
    teamScoped: caps.players !== 'all',
    canViewCoachProfiles: caps.coaches !== 'own',
    canSeePlayerTab: (tab) => playerTabVisible(caps, tab),
  };
}

// Pestañas de la ficha de jugador
export function playerTabVisible(caps, tab) {
  switch (tab) {
    case 'pdi': return caps.playerEval !== 'none';
    case 'injuries': case 'documents': return caps.medical !== 'none';
    default: return true;
  }
}

// Convocatoria, acta y táctica de un equipo concreto
export function canManageTeamWith(perms, teamId, coachTeamIds = []) {
  if (perms.manage === 'all') return true;
  return perms.manage === 'team' && !!teamId && coachTeamIds.includes(teamId);
}

// ── Reglas del servidor sobre entidades ──────────────────────────────────────
export const MEDICAL_ENTITIES = new Set(['Injury', 'PlayerDocument']);
export const PLAYER_EVAL_ENTITIES = new Set(['Evaluation360', 'PDI', 'PDIGoal']);
export const COACH_EVAL_ENTITIES = new Set(['CoachFeedback', 'CoachPDI', 'CoachEval360', 'CoachMatchNote', 'CoachSessionObs', 'CoachQuarterClose']);
// Planificación de plantillas (Scouting → Planificación): quién continúa, quién se va y a quién se quiere fichar. Solo dirección y coordinación.
export const PLANNING_ENTITIES = new Set(['SquadPlanEntry']);
// Sesiones de entrenamiento: son personales de cada entrenador (owner_id). Las ve toda la coordinación, pero solo las cambia su autor.
export const SESSION_ENTITIES = new Set(['CoachSession']);
// Campos de la ficha del jugador que solo escribe quien puede editar fichas (entrenadores y coordinación)
export const PLAYER_STAFF_FIELDS = [WEAK_FOOT_FIELD];

// Datos de entrenadores que ve la propia persona (no los borradores)
export function ownerCanSeeCoachDoc(entity, doc) {
  switch (entity) {
    case 'CoachFeedback': return doc.status === 'enviado';
    case 'CoachPDI': return doc.visibility === 'publicado';
    case 'CoachEval360': return doc.status === 'publicada' || doc.kind === 'autoevaluacion';
    case 'CoachSessionObs': return doc.status === 'publicada';
    case 'CoachQuarterClose': return doc.status === 'publicado';
    default: return false; // CoachMatchNote: solo quien evalúa
  }
}

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const staffName = (s) => `${s.first_name || ''} ${s.last_name || ''}`.trim();

// Ficha(s) de personal de un usuario: mismo criterio que la pantalla (vínculo > email > nombre exacto > nombre parcial).
// Devuelve los ids con los que se guardan sus datos de entrenador: ficha y "user_<id>".
export function staffIdsOfUser(user, users, staffList) {
  const ids = new Set([`user_${user.id}`]);
  const taken = new Set();
  const links = new Map();
  const pending = [];
  for (const u of users) {
    const s = u.staff_member_id && staffList.find((x) => x.id === u.staff_member_id);
    if (s) { links.set(u.id, s); taken.add(s.id); } else pending.push(u);
  }
  const pass = (match) => {
    for (const u of pending) {
      if (links.has(u.id)) continue;
      const cands = staffList.filter((s) => !taken.has(s.id) && match(u, s));
      if (cands.length === 1) { links.set(u.id, cands[0]); taken.add(cands[0].id); }
    }
  };
  const email = (s) => (s || '').toLowerCase().trim();
  const subset = (a, b) => {
    const ta = norm(a).split(' ').filter(Boolean), tb = norm(b).split(' ').filter(Boolean);
    if (ta.length < 2 || tb.length < 2) return false;
    const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
    return small.every((t) => big.includes(t));
  };
  pass((u, s) => email(u.email) && email(u.email) === email(s.email));
  pass((u, s) => norm(u.full_name) && norm(u.full_name) === norm(staffName(s)));
  pass((u, s) => subset(u.full_name, staffName(s)));
  const mine = links.get(user.id);
  if (mine) ids.add(mine.id);
  return ids;
}

// ¿Puede esta persona escribir (crear, cambiar o borrar)? existing = documento actual (si lo hay), ownIds = sus ids de personal.
export function checkRoleWrite({ perms, entity, method, body = {}, existing = null, ownIds = new Set() }) {
  if (perms.isAdmin) return { ok: true };
  if (entity === 'Event') {
    // Evento de todo el club (una copia por equipo): lo crea o cambia solo coordinación
    return body.club_event_id !== undefined && !perms.administration ? { ok: false, error: 'forbidden_role' } : { ok: true };
  }
  if (entity === 'Player') {
    // Valoración de la pierna no hábil: solo entrenadores y coordinación, y con un valor de 1 a 5 (o vacío para quitarla)
    if (body[WEAK_FOOT_FIELD] === undefined) return { ok: true };
    if (!perms.editPlayers) return { ok: false, error: 'forbidden_role' };
    return body[WEAK_FOOT_FIELD] === null || isValidWeakFoot(body[WEAK_FOOT_FIELD]) ? { ok: true } : { ok: false, error: 'invalid_value' };
  }
  if (MEDICAL_ENTITIES.has(entity)) return perms.medical === 'edit' ? { ok: true } : { ok: false, error: 'forbidden_role' };
  if (PLAYER_EVAL_ENTITIES.has(entity)) return perms.playerEval === 'edit' ? { ok: true } : { ok: false, error: 'forbidden_role' };
  if (PLANNING_ENTITIES.has(entity)) return perms.administration ? { ok: true } : { ok: false, error: 'forbidden_role' };
  if (COACH_EVAL_ENTITIES.has(entity)) {
    if (perms.evalCoaches) return { ok: true };
    const isOwn = (d) => !!d && ownIds.has(d.staff_id);
    const update = method === 'PUT' || method === 'PATCH';
    // La persona evaluada solo puede contestar a lo que se le ha enviado y escribir su autoevaluación
    const deny = { ok: false, error: 'forbidden_role' };
    // Nunca puede cambiar a quién va dirigido ni publicar/despublicar lo que otros escribieron sobre ella
    if (body.staff_id !== undefined && !ownIds.has(body.staff_id)) return deny;
    if (entity === 'CoachEval360') {
      if (method === 'POST') return isOwn(body) && body.kind === 'autoevaluacion' ? { ok: true } : deny;
      return isOwn(existing) && existing.kind === 'autoevaluacion' && (body.kind === undefined || body.kind === 'autoevaluacion') ? { ok: true } : deny;
    }
    // Observación de sesión: la escribe y la publica solo quien evalúa; el entrenador la lee cuando se publica y no la cambia
    // Cierre trimestral: lo hace y lo publica solo quien evalúa
    if (entity === 'CoachSessionObs' || entity === 'CoachQuarterClose') return deny;
    // El estado de cada anotación (pendiente / seguir trabajando / asimilado) lo fija quien evalúa, no quien la recibe
    if (body.progress !== undefined) return deny;
    if (update && isOwn(existing) && ownerCanSeeCoachDoc(entity, existing) && body.status === undefined && body.visibility === undefined) return { ok: true };
    return deny;
  }
  return { ok: true };
}

// Sesiones de entrenamiento: cada persona escribe solo las suyas (la coordinación y la administración las leen todas)
export function checkSessionWrite({ perms, userId, method, body = {}, existing = null }) {
  if (perms.isAdmin) return { ok: true };
  const deny = { ok: false, error: 'forbidden_role' };
  if (method === 'POST') return body.owner_id === userId ? { ok: true } : deny;
  if (!existing || existing.owner_id !== userId) return deny;
  return body.owner_id === undefined || body.owner_id === userId ? { ok: true } : deny;
}

export function filterSessionRead({ perms, userId, docs }) {
  if (perms.isAdmin || perms.administration) return docs;
  return docs.filter((d) => d.owner_id === userId);
}

// Lo que puede leer: devuelve los documentos permitidos. Las lecturas no fallan: lo no permitido simplemente no sale.
export function filterRoleRead({ perms, entity, docs, ownIds = new Set(), userId = null }) {
  if (perms.isAdmin) return docs;
  if (MEDICAL_ENTITIES.has(entity)) return perms.medical === 'none' ? [] : docs;
  if (PLAYER_EVAL_ENTITIES.has(entity)) return perms.playerEval === 'none' ? [] : docs;
  if (PLANNING_ENTITIES.has(entity)) return perms.administration ? docs : [];
  if (SESSION_ENTITIES.has(entity)) return filterSessionRead({ perms, userId, docs });
  if (COACH_EVAL_ENTITIES.has(entity)) {
    if (perms.coaches !== 'own') return docs;
    return docs.filter((d) => ownIds.has(d.staff_id) && ownerCanSeeCoachDoc(entity, d));
  }
  return docs;
}
