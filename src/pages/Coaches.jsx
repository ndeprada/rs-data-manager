import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Users, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { useAuth } from "@/lib/AuthContext";

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
  coordinador_f7: "Coord. F7",
  coordinador_f11: "Coord. F11",
  entrenador_porteros: "Entren. Porteros",
  psicologo: "Psicólogo",
  admin: "Director / Admin",
};

const APP_STAFF_ROLES = ["coordinador_general", "coordinador_f7", "coordinador_f11", "entrenador", "preparador_fisico", "entrenador_porteros", "psicologo", "fisioterapeuta"];

export default function Coaches() {
  const navigate = useNavigate();
  const { isCoordinator, coordType, isCoordinatorGeneral } = useTeamAccess();
  const { user: currentUser } = useAuth();
  const [filterTeam, setFilterTeam] = useState("all");

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: staff = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.StaffMember.list() });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => base44.entities.User.list() });

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

  // Usuarios registrados con roles de staff (excluye admins que tratamos por separado)
  const staffEmails = new Set(staff.map(s => s.email).filter(Boolean));
  const usersAsStaff = users
    .filter(u => APP_STAFF_ROLES.includes(u.app_role) && u.access_status === "approved")
    .filter(u => !staffEmails.has(u.email))
    .map(u => {
      const teamIds = u.role_assignments?.flatMap(a => a.team_ids || []) ||
                      u.team_ids || (u.team_id ? [u.team_id] : []);
      const primaryTeamId = teamIds[0] || "";
      return {
        id: `user_${u.id}`,
        _userId: u.id,
        first_name: u.full_name?.split(" ")[0] || u.full_name || "",
        last_name: u.full_name?.split(" ").slice(1).join(" ") || "",
        role: u.app_role,
        team_id: primaryTeamId,
        team_ids: teamIds,
        photo_url: u.photo_url || null,
        phone: u.phone || null,
        email: u.email,
        _isUser: true,
      };
    });

  // Usuarios admin: incluir siempre en el cuerpo técnico
  const adminUsers = users
    .filter(u => u.role === "admin")
    .filter(u => !staffEmails.has(u.email))
    .filter(u => !usersAsStaff.some(s => s.email === u.email))
    .map(u => ({
      id: `user_${u.id}`,
      _userId: u.id,
      first_name: u.full_name?.split(" ")[0] || u.full_name || "",
      last_name: u.full_name?.split(" ").slice(1).join(" ") || "",
      role: "admin",
      team_id: "",
      team_ids: [],
      photo_url: u.photo_url || null,
      phone: u.phone || null,
      email: u.email,
      _isUser: true,
      _isAdmin: true,
    }));

  const allStaff = [...staff, ...usersAsStaff, ...adminUsers];

  const filtered = allStaff.filter(s => {
    if (s.role === "medico") return false;
    // Admins siempre visibles sin filtro de equipo
    if (s._isAdmin) return filterTeam === "all";
    if (filterTeam !== "all" && s.team_id !== filterTeam) return false;
    if (!isCoordinatorGeneral) {
      const sTeam = teams.find(t => t.id === s.team_id);
      if (coordType === "coordinador_f7" && !isF7Team(sTeam)) return false;
      if (coordType === "coordinador_f11" && !isF11Team(sTeam)) return false;
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
            const team = getTeam(s.team_id);
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
                    {team && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{team.name}</p>
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