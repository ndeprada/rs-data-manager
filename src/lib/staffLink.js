// Vincula usuarios registrados con fichas de cuerpo técnico (StaffMember) para que
// una misma persona no aparezca dos veces, y sincroniza sus equipos/roles.
import { base44 } from "@/api/base44Client";
import { CURRENT_SEASON, COACHING_TEAM_ROLES } from "@/lib/staffRoles";

export const normEmail = (s) => (s || "").toLowerCase().trim();
export const normName = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export const staffFullName = (s) => `${s.first_name || ""} ${s.last_name || ""}`.trim();

const tokens = (s) => normName(s).split(" ").filter(Boolean);
const subsetMatch = (a, b) => {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length < 2 || tb.length < 2) return false;
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return small.every((t) => big.includes(t));
};

/**
 * Devuelve Map(userId -> StaffMember) con la ficha de personal de cada usuario.
 * Prioridad: vínculo explícito (staff_member_id) > email (sin mayúsculas) > nombre exacto > nombre parcial.
 * Cada ficha se asigna como máximo a un usuario.
 */
export function buildLinks(users, staffList) {
  const links = new Map();
  const taken = new Set();
  const pending = [];
  users.forEach((u) => {
    const s = u.staff_member_id && staffList.find((x) => x.id === u.staff_member_id);
    if (s) {
      links.set(u.id, s);
      taken.add(s.id);
    } else pending.push(u);
  });
  const pass = (match) => {
    pending.forEach((u) => {
      if (links.has(u.id)) return;
      const cands = staffList.filter((s) => !taken.has(s.id) && match(u, s));
      if (cands.length === 1) {
        links.set(u.id, cands[0]);
        taken.add(cands[0].id);
      }
    });
  };
  pass((u, s) => normEmail(u.email) && normEmail(u.email) === normEmail(s.email));
  pass((u, s) => normName(u.full_name) && normName(u.full_name) === normName(staffFullName(s)));
  pass((u, s) => subsetMatch(u.full_name, staffFullName(s)));
  return links;
}

/** Equipos (ids) de una lista de asignaciones */
export const teamIdsOf = (assignments) => [...new Set(assignments.map((a) => a.team_id).filter(Boolean))];

/**
 * Guarda los equipos/roles de una persona (TeamStaffAssignment) y mantiene sincronizados
 * los campos antiguos (StaffMember.team_id) y el acceso por equipos del usuario.
 * wanted: [{ team_id, team_role }]; existing: asignaciones activas actuales de esa ficha.
 */
export async function syncAssignments(staffId, wanted, existing) {
  const clean = [];
  const seen = new Set();
  wanted.forEach((a) => {
    if (a.team_id && a.team_role && !seen.has(a.team_id)) {
      seen.add(a.team_id);
      clean.push({ team_id: a.team_id, team_role: a.team_role });
    }
  });

  const byTeam = new Map();
  const extras = [];
  existing.forEach((a) => {
    if (byTeam.has(a.team_id)) extras.push(a);
    else byTeam.set(a.team_id, a);
  });

  for (const a of clean) {
    const ex = byTeam.get(a.team_id);
    if (ex) {
      if (ex.team_role !== a.team_role) {
        await base44.entities.TeamStaffAssignment.update(ex.id, { team_role: a.team_role });
      }
      byTeam.delete(a.team_id);
    } else {
      await base44.entities.TeamStaffAssignment.create({
        staff_member_id: staffId,
        team_id: a.team_id,
        team_role: a.team_role,
        season: CURRENT_SEASON,
        active: true,
      });
    }
  }
  for (const ex of [...byTeam.values(), ...extras]) {
    await base44.entities.TeamStaffAssignment.update(ex.id, { active: false });
  }

  const first = clean[0];
  await base44.entities.StaffMember.update(staffId, {
    team_id: first?.team_id || "",
    team_role: first?.team_role || null,
  });
  return clean;
}

/** Campos de acceso por equipo que se guardan en el usuario a partir de sus asignaciones */
export function userTeamFields(appRole, assignments) {
  const ids = teamIdsOf(assignments);
  const coachIds = teamIdsOf(assignments.filter((a) => COACHING_TEAM_ROLES.includes(a.team_role)));
  const alsoCoach = appRole !== "entrenador" && coachIds.length > 0;
  return {
    team_ids: ids,
    team_id: ids[0] || null,
    secondary_role: alsoCoach ? "entrenador" : null,
    secondary_team_ids: alsoCoach ? coachIds : [],
  };
}

/**
 * Aplica el acceso de un usuario (alta/aprobación/edición) sin duplicar personas.
 * form: { role, app_role, access_status, phone, person_type, staff_member_id, assignments }
 *   staff_member_id: id de la ficha vinculada, "" = crear una nueva si hace falta.
 */
export async function saveUserAccess({ user, form, staffList, activeAssignments }) {
  const isStaff = form.person_type === "cuerpo_tecnico" && !!form.app_role;
  const patch = {
    role: form.role || "user",
    app_role: form.app_role || null,
    access_status: form.access_status || null,
    phone: form.phone || null,
    person_type: form.person_type || null,
  };
  if (form.access_status === "approved") {
    patch.app_role_pending = null;
    patch.requested_assignments = null;
  }

  if (form.person_type === "jugador") {
    patch.player_id = form.player_id || null;
    patch.staff_member_id = null;
    if (form.player_team_id) { patch.team_id = form.player_team_id; patch.team_ids = [form.player_team_id]; }
  }

  if (isStaff) {
    let staff = form.staff_member_id ? staffList.find((s) => s.id === form.staff_member_id) : null;
    const staffData = {
      phone: form.phone || null,
      role: form.app_role,
    };
    if (staff) {
      if (!staff.email) staffData.email = user.email;
      await base44.entities.StaffMember.update(staff.id, staffData);
    } else {
      const parts = (user.full_name || "").trim().split(/\s+/);
      staff = await base44.entities.StaffMember.create({
        first_name: parts[0] || "",
        last_name: parts.slice(1).join(" "),
        email: user.email,
        ...staffData,
        team_id: "",
      });
    }
    patch.staff_member_id = staff.id;
    const existing = activeAssignments.filter((a) => a.staff_member_id === staff.id);
    const saved = await syncAssignments(staff.id, form.assignments || [], existing);
    Object.assign(patch, userTeamFields(form.app_role, saved));
  }

  await base44.entities.User.update(user.id, patch);
  return patch;
}

/** Recalcula los equipos del usuario vinculado a una ficha tras cambiar sus asignaciones */
export async function syncUserTeamsForStaff(staffId) {
  if (!staffId) return;
  try {
    const users = await base44.entities.User.filter({ staff_member_id: staffId });
    const u = users[0];
    if (!u) return;
    const list = await base44.entities.TeamStaffAssignment.filter({ staff_member_id: staffId, active: true });
    await base44.entities.User.update(u.id, userTeamFields(u.app_role, list));
  } catch (_) {
    // best-effort: la ficha ya está guardada; el acceso por equipo se recalcula al revisar Accesos
  }
}
