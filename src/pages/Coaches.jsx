import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Users, ChevronRight, List, LayoutGrid } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { useAuth } from "@/lib/AuthContext";
import { buildLinks } from "@/lib/staffLink";
import { STAFF_FUNCTION_VALUES, teamRoleLabel } from "@/lib/staffRoles";
import { compareTeams, teamRank } from "@/lib/teamOrder";
import TabBar from "@/components/common/TabBar";
import StaffTable from "@/components/coach/StaffTable";

import { PageTitle } from "@/components/common/PageHeader";
import { useT, msg } from "@/i18n";
const ROLE_LABELS = {
  entrenador: msg("Entrenador"),
  ayudante: msg("Ayudante"),
  preparador_fisico: msg("Prep. Físico"),
  portero_coach: msg("Portero Coach"),
  medico: msg("Médico"),
  fisioterapeuta: msg("Fisioterapeuta"),
  coordinador: msg("Coordinador"),
  otro: msg("Otro"),
  coordinador_general: msg("Coord. General"),
  director: msg("Director"),
  director_deportivo: msg("Director Deportivo"),
  coordinador_f7: msg("Coord. F7"),
  coordinador_f11: msg("Coord. F11"),
  entrenador_porteros: msg("Entren. Porteros"),
  psicologo: msg("Técnico · Área psicología"),
  admin: msg("Director / Admin"),
};

const APP_STAFF_ROLES = STAFF_FUNCTION_VALUES;

// La vista elegida (lista o tarjetas) se recuerda en este navegador
const VIEW_KEY = "rs-personal-vista";
const readView = () => {
  try { return localStorage.getItem(VIEW_KEY) === "tarjetas" ? "tarjetas" : "lista"; } catch { return "lista"; }
};

export default function Coaches() {
  const t = useT();
  const navigate = useNavigate();
  const [view, setViewState] = useState(readView);
  const setView = (v) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* sin almacenamiento: no se recuerda */ }
  };
  const { isCoordinator, coordType, isCoordinatorGeneral, perms } = useTeamAccess();
  const { user: currentUser } = useAuth();
  const [filterTeam, setFilterTeam] = useState("all");

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: staff = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.StaffMember.list() });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => base44.entities.User.list() });
  const { data: assignments = [] } = useQuery({
    queryKey: ["team_staff_assignments"],
    queryFn: () => base44.entities.TeamStaffAssignment.filter({ active: true }),
  });

  if (!isCoordinator && !perms.canViewCoachProfiles) {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-400">{t("No tienes acceso a esta sección.")}</p>
      </div>
    );
  }

  const isF7Team = (t) => {
    if (!t) return false;
    const cat = (t.category || "").toLowerCase();
    return cat.includes("alevin") || cat.includes("benjamin") || cat.includes("benjami") || cat.includes("prebenjami") || cat.includes("ludica") || cat.includes("f7");
  };
  const isF11Team = (t) => !isF7Team(t);

  // Una persona = una tarjeta: los usuarios registrados se enlazan con su ficha de personal
  // (por vínculo, email sin mayúsculas o nombre) y solo salen aparte si no tienen ficha.
  const liveUsers = users.filter(u => u.access_status !== "deleted");
  const links = buildLinks(liveUsers, staff);
  const linkedStaffIds = new Set([...links.values()].map(s => s.id));
  const userOfStaff = new Map([...links.entries()].map(([uid, s]) => [s.id, liveUsers.find(u => u.id === uid)]));

  const teamsOfStaff = (staffId, fallbackTeamId) => {
    const list = assignments.filter(a => a.staff_member_id === staffId).map(a => ({ team_id: a.team_id, team_role: a.team_role }));
    if (list.length === 0 && fallbackTeamId) list.push({ team_id: fallbackTeamId, team_role: null });
    return list;
  };

  const accessOf = (u) => {
    if (!u) return null;
    if (u.role === "admin" || u.access_status === "approved" || (!u.access_status && u.app_role)) return "approved";
    return u.access_status === "pending" ? "pending" : null;
  };

  const staffCards = staff.map(s => {
    const u = userOfStaff.get(s.id);
    const list = teamsOfStaff(s.id, s.team_id);
    return {
      ...s,
      role: u?.app_role || s.role,
      photo_url: s.photo_url || u?.photo_url || null,
      phone: s.phone || u?.phone || null,
      email: s.email || u?.email || null,
      birth_date: s.birth_date || u?.birth_date || null,
      _access: accessOf(u),
      team_list: list,
      team_id: list[0]?.team_id || s.team_id,
    };
  });

  const usersAsStaff = liveUsers
    .filter(u => APP_STAFF_ROLES.includes(u.app_role) && u.access_status === "approved")
    .filter(u => !links.has(u.id))
    .map(u => {
      const teamIds = u.team_ids || (u.team_id ? [u.team_id] : []);
      return {
        id: `user_${u.id}`,
        _userId: u.id,
        first_name: u.full_name?.split(" ")[0] || u.full_name || "",
        last_name: u.full_name?.split(" ").slice(1).join(" ") || "",
        role: u.app_role,
        team_id: teamIds[0] || "",
        team_list: teamIds.map(id => ({ team_id: id, team_role: null })),
        photo_url: u.photo_url || null,
        phone: u.phone || null,
        email: u.email,
        birth_date: u.birth_date || null,
        _access: "approved",
        _isUser: true,
      };
    });

  // Administradores sin ficha ni función de personal
  const adminUsers = liveUsers
    .filter(u => u.role === "admin")
    .filter(u => !links.has(u.id))
    .filter(u => !usersAsStaff.some(s => s._userId === u.id))
    .map(u => ({
      id: `user_${u.id}`,
      _userId: u.id,
      first_name: u.full_name?.split(" ")[0] || u.full_name || "",
      last_name: u.full_name?.split(" ").slice(1).join(" ") || "",
      role: "admin",
      team_id: "",
      team_list: [],
      photo_url: u.photo_url || null,
      phone: u.phone || null,
      email: u.email,
      birth_date: u.birth_date || null,
      _access: "approved",
      _isUser: true,
      _isAdmin: true,
    }));

  const allStaff = [...staffCards, ...usersAsStaff, ...adminUsers];

  const filtered = allStaff.filter(s => {
    if (s.role === "medico") return false;
    // Admins siempre visibles sin filtro de equipo
    if (s._isAdmin) return filterTeam === "all";
    const teamIdsOfS = (s.team_list || []).map(a => a.team_id);
    if (filterTeam !== "all" && !teamIdsOfS.includes(filterTeam)) return false;
    if (!isCoordinatorGeneral) {
      const sTeams = teamIdsOfS.map(id => teams.find(t => t.id === id));
      if (coordType === "coordinador_f7" && !sTeams.some(isF7Team)) return false;
      if (coordType === "coordinador_f11" && !sTeams.some(isF11Team)) return false;
    }
    return true;
  });

  const getTeam = (id) => teams.find(t => t.id === id);
  const profileUrlOf = (s) => (s._isUser ? `/CoachProfile?userId=${s._userId}` : `/CoachProfile?id=${s.id}`);

  // Filas de la lista: una por persona, con sus equipos en el orden del club (Primer Equipo, Juvenil, Cadet…)
  const rows = filtered.map(s => ({
    key: s.id,
    url: profileUrlOf(s),
    name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || t("Sin nombre"),
    initials: `${s.first_name?.[0] || ""}${s.last_name?.[0] || ""}`,
    photo_url: s.photo_url,
    isAdmin: !!s._isAdmin,
    roleLabel: ROLE_LABELS[s.role] ? t(ROLE_LABELS[s.role]) : s.role || "—",
    roleEs: ROLE_LABELS[s.role] || s.role || "—", // para el Excel y la hoja impresa (siempre en español)
    birth_date: s.birth_date,
    teams: (s.team_list || [])
      .map(a => ({ a, t: getTeam(a.team_id) }))
      .filter(x => x.t)
      .sort((x, y) => compareTeams(x.t, y.t))
      .map(({ a, t }) => ({ id: t.id, name: t.name, rank: teamRank(t), role: a.team_role })),
    phone: s.phone,
    email: s.email,
    access: s._access,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageTitle kicker={t("Administración")} title={t("Personal")} subtitle={filtered.length === 1 ? t("Miembros del personal del club · {n} persona", { n: 1 }) : t("Miembros del personal del club · {n} personas", { n: filtered.length })} />
        <div className="flex items-center gap-2 flex-wrap">
          <TabBar value={view} onChange={setView}
            items={[{ value: "lista", label: msg("Lista"), icon: List }, { value: "tarjetas", label: msg("Tarjetas"), icon: LayoutGrid }]} />
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-48 border-gray-200 bg-white"><SelectValue placeholder={t("Todos los equipos")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todos los equipos")}</SelectItem>
              {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center" style={{ borderRadius: "4px" }}>
          <Users className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
            {t("No hay miembros del cuerpo técnico registrados")}
          </p>
          <p className="text-xs text-gray-300 mt-1">{t("Añade miembros del staff desde la ficha de equipo")}</p>
        </div>
      ) : view === "lista" ? (
        <StaffTable rows={rows} onOpen={navigate} filterLabel={filterTeam === "all" ? "Todos los equipos" : getTeam(filterTeam)?.name || "Equipo"} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => {
            const profileUrl = profileUrlOf(s);
            return (
              <button key={s.id} onClick={() => navigate(profileUrl)}
                className="bg-white border border-gray-200 p-5 text-left hover:shadow-md transition-all group"
                style={{ borderRadius: "4px", borderLeft: `3px solid ${s._isAdmin ? "var(--naranja)" : "var(--granate)"}` }}>
                <div className="flex items-start gap-4">
                  {s.photo_url ? (
                    <img src={s.photo_url} alt={`${s.first_name} ${s.last_name}`} className="w-20 h-20 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-3xl shrink-0"
                      style={{ background: s._isAdmin ? "var(--naranja)" : "var(--granate)", fontFamily: "var(--font-display)" }}>
                      {s.first_name?.[0]}{s.last_name?.[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-900 truncate" style={{ fontFamily: "var(--font-display)" }}>
                      {s.first_name} {s.last_name}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-wide mt-0.5" style={{ color: "var(--naranja)", fontFamily: "var(--font-display)" }}>
                      {ROLE_LABELS[s.role] ? t(ROLE_LABELS[s.role]) : s.role}
                    </p>
                    {(s.team_list || []).slice(0, 3).map(a => {
                      const tm = getTeam(a.team_id);
                      return tm ? (
                        <p key={a.team_id} className="text-xs text-gray-400 mt-0.5 truncate">
                          {tm.name}{a.team_role ? ` · ${t(teamRoleLabel(a.team_role))}` : ""}
                        </p>
                      ) : null;
                    })}
                    {(s.team_list || []).length > 3 && (
                      <p className="text-[11px] text-gray-300">{t("+{v} equipos más", { v: s.team_list.length - 3 })}</p>
                    )}
                    {s.phone && <p className="text-xs text-gray-400 mt-0.5">{s.phone}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}