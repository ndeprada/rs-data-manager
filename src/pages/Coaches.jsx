import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Users, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { useAuth } from "@/lib/AuthContext";
import { buildLinks } from "@/lib/staffLink";
import { STAFF_FUNCTION_VALUES, teamRoleLabel } from "@/lib/staffRoles";

const ROLE_LABELS = {
  entrenador: "Entrenador",
  ayudante: "Ayudante",
  preparador_fisico: "Prep. Físico",
  portero_coach: "Portero Coach",
  medico: "Médico",
  fisioterapeuta: "Fisioterapeuta",
  coordinador: "Coordinador",
  otro: "Otro",
  coordinador_general: "Coord. General",
  director: "Director",
  director_deportivo: "Director Deportivo",
  coordinador_f7: "Coord. F7",
  coordinador_f11: "Coord. F11",
  entrenador_porteros: "Entren. Porteros",
  psicologo: "Psicólogo",
  admin: "Director / Admin",
};

const APP_STAFF_ROLES = STAFF_FUNCTION_VALUES;

export default function Coaches() {
  const navigate = useNavigate();
  const { isCoordinator, coordType, isCoordinatorGeneral } = useTeamAccess();
  const { user: currentUser } = useAuth();
  const [filterTeam, setFilterTeam] = useState("all");

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: staff = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.StaffMember.list() });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => base44.entities.User.list() });
  const { data: assignments = [] } = useQuery({
    queryKey: ["team_staff_assignments"],
    queryFn: () => base44.entities.TeamStaffAssignment.filter({ active: true }),
  });

  if (!isCoordinator) {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-400">No tienes acceso a esta sección.</p>
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

  const staffCards = staff.map(s => {
    const u = userOfStaff.get(s.id);
    const list = teamsOfStaff(s.id, s.team_id);
    return {
      ...s,
      role: u?.app_role || s.role,
      photo_url: s.photo_url || u?.photo_url || null,
      phone: s.phone || u?.phone || null,
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Administración</p>
          <h1>Personal</h1>
          <p className="text-gray-400 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>Miembros del personal del club</p>
        </div>
        <Select value={filterTeam} onValueChange={setFilterTeam}>
          <SelectTrigger className="w-48 border-gray-200 bg-white"><SelectValue placeholder="Todos los equipos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los equipos</SelectItem>
            {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center" style={{ borderRadius: "4px" }}>
          <Users className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
            No hay miembros del cuerpo técnico registrados
          </p>
          <p className="text-xs text-gray-300 mt-1">Añade miembros del staff desde la ficha de equipo</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => {
            const profileUrl = s._isUser ? `/CoachProfile?userId=${s._userId}` : `/CoachProfile?id=${s.id}`;
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
                      {ROLE_LABELS[s.role] || s.role}
                    </p>
                    {(s.team_list || []).slice(0, 3).map(a => {
                      const t = getTeam(a.team_id);
                      return t ? (
                        <p key={a.team_id} className="text-xs text-gray-400 mt-0.5 truncate">
                          {t.name}{a.team_role ? ` · ${teamRoleLabel(a.team_role)}` : ""}
                        </p>
                      ) : null;
                    })}
                    {(s.team_list || []).length > 3 && (
                      <p className="text-[11px] text-gray-300">+{s.team_list.length - 3} equipos más</p>
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