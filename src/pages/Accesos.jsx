import React, { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, Clock, Edit2, Trash2, Mail, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { relLabel } from "@/components/avisos/PlayerPicker";
import { APP_FUNCTIONS, FUNCTION_LABELS, TEAM_ROLES, teamRoleLabel, functionConfig } from "@/lib/staffRoles";
import { buildLinks, saveUserAccess, staffFullName, userTeamFields } from "@/lib/staffLink";
import TeamRolesEditor from "@/components/access/TeamRolesEditor";

import { PageTitle } from "@/components/common/PageHeader";
const STATUS_LABELS = { pending: "Pendiente", approved: "Aprobado", rejected: "Rechazado" };
const NEW_STAFF = "__new__";

const Label = ({ children }) => (
  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">{children}</label>
);

export default function Accesos() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editUser, setEditUser] = useState(null); // usuario que se edita / aprueba
  const [editForm, setEditForm] = useState({});
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: users = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: () => base44.entities.User.list() });
  const { data: staff = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.StaffMember.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: assignments = [] } = useQuery({
    queryKey: ["team_staff_assignments"],
    queryFn: () => base44.entities.TeamStaffAssignment.filter({ active: true }),
  });

  const liveUsers = useMemo(() => users.filter((u) => u.access_status !== "deleted"), [users]);
  const links = useMemo(() => buildLinks(liveUsers, staff), [liveUsers, staff]);
  const playerLabel = (p) => `${[p.nickname || p.first_name, p.last_name].filter(Boolean).join(" ")} · ${teams.find((t) => t.id === p.team_id)?.name || "sin equipo"}`;
  const norm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  // Sugerencia de ficha: jugador del equipo solicitado cuyo nombre coincide con el del usuario
  const suggestPlayer = (u) => {
    const tokens = norm(u.full_name).split(/\s+/).filter((t) => t.length > 1);
    if (!tokens.length) return "";
    const pool = players.filter((p) => !u.requested_team_id || p.team_id === u.requested_team_id);
    let best = null, bestScore = 0;
    for (const p of pool) {
      const hay = norm(`${p.first_name} ${p.last_name} ${p.nickname || ""}`);
      const score = tokens.filter((t) => hay.includes(t)).length;
      if (score > bestScore) { best = p; bestScore = score; }
    }
    return bestScore >= Math.min(2, tokens.length) ? best.id : "";
  };
  const teamName = (id) => teams.find((t) => t.id === id)?.name || "—";
  const assignmentsOfStaff = (staffId) => assignments.filter((a) => a.staff_member_id === staffId);

  // Reparación automática: enlaza usuarios con su ficha de personal y rellena sus equipos
  const repaired = useRef(new Set());
  useEffect(() => {
    if (currentUser?.role !== "admin" || isLoading || users.length === 0 || staff.length === 0) return;
    liveUsers.forEach(async (u) => {
      if (repaired.current.has(u.id)) return;
      const s = links.get(u.id);
      if (!s) return;
      const patch = {};
      if (u.staff_member_id !== s.id) patch.staff_member_id = s.id;
      if (!(u.team_ids?.length > 0) && u.app_role) {
        let list = assignmentsOfStaff(s.id);
        if (list.length === 0 && s.team_id) list = [{ team_id: s.team_id, team_role: s.team_role || null }];
        if (list.length > 0) Object.assign(patch, userTeamFields(u.app_role, list));
      }
      if (Object.keys(patch).length === 0) return;
      repaired.current.add(u.id);
      try {
        await base44.entities.User.update(u.id, patch);
        queryClient.invalidateQueries({ queryKey: ["users"] });
      } catch (_) {}
    });
  }, [liveUsers, staff, assignments, links, isLoading]);

  // Limpieza: asignaciones activas repetidas (misma persona y equipo) → se queda la más antigua
  const dedupDone = useRef(false);
  useEffect(() => {
    if (currentUser?.role !== "admin" || dedupDone.current || assignments.length === 0) return;
    const seen = new Map();
    const extras = [];
    [...assignments]
      .sort((a, b) => String(a.created_date).localeCompare(String(b.created_date)))
      .forEach((a) => {
        const key = `${a.staff_member_id}:${a.team_id}`;
        if (seen.has(key)) extras.push(a);
        else seen.set(key, a);
      });
    dedupDone.current = true;
    if (extras.length === 0) return;
    Promise.all(extras.map((a) => base44.entities.TeamStaffAssignment.update(a.id, { active: false })))
      .then(() => queryClient.invalidateQueries({ queryKey: ["team_staff_assignments"] }))
      .catch(() => {});
  }, [assignments]);

  const saveMutation = useMutation({
    mutationFn: ({ user, form }) => saveUserAccess({ user, form, staffList: staff, activeAssignments: assignments }),
    onSuccess: (_, { form }) => {
      ["users", "staff", "team_staff_assignments"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      setEditUser(null);
      toast({
        title: form.access_status === "approved" ? "Acceso guardado" : "Cambios guardados",
        description: "Se ha vinculado a una única ficha de personal con sus equipos y roles.",
      });
    },
    onError: (err) => toast({ title: "Error al guardar", description: err.message, variant: "destructive" }),
  });

  // Familiares: su acceso depende de que el club apruebe el vínculo con el jugador
  const { data: pendingLinks = [] } = useQuery({ queryKey: ["pendingLinks"], queryFn: () => base44.club.pendingLinks(), refetchInterval: 60000 });
  const isFamily = (u) => u.app_role === "familiar" || u.app_role_pending === "familiar" || u.person_type === "familiar";
  const familyDecide = useMutation({
    mutationFn: async ({ user, decision }) => {
      const mine = pendingLinks.filter((l) => l.user_id === user.id);
      for (const l of mine) await base44.club.decideLink(l.id, decision);
      if (decision === "reject") await base44.entities.User.update(user.id, { access_status: "rejected", app_role_pending: null });
    },
    onSuccess: (_, { decision }) => {
      ["users", "pendingLinks", "pending-users"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast({ title: decision === "approve" ? "Familiar vinculado" : "Solicitud rechazada" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.update(userId, { access_status: "rejected", app_role_pending: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Acceso rechazado" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId) =>
      base44.entities.User.update(userId, { access_status: "deleted", app_role: null, app_role_pending: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteDialog(null);
      toast({ title: "Usuario eliminado" });
    },
    onError: (err) => toast({ title: "Error al eliminar", description: err.message, variant: "destructive" }),
  });

  if (currentUser?.role !== "admin") {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-400">No tienes acceso a esta sección.</p>
      </div>
    );
  }

  const isPlayerReq = (u) => u.person_type === "jugador" || u.app_role === "jugador" || u.app_role_pending === "jugador";

  const openEdit = (u, approving = false) => {
    const linked = links.get(u.id);
    const fn = u.app_role || u.app_role_pending || "";
    const player = isPlayerReq(u);
    let list = [];
    if (linked) {
      list = assignmentsOfStaff(linked.id).map((a) => ({ team_id: a.team_id, team_role: a.team_role }));
      if (list.length === 0 && linked.team_id) list = [{ team_id: linked.team_id, team_role: linked.team_role || "" }];
    }
    if (approving && list.length === 0 && u.requested_assignments?.length) list = u.requested_assignments;
    setEditForm({
      role: u.role || "user",
      person_type: player ? "jugador" : "cuerpo_tecnico",
      app_role: player ? "jugador" : fn,
      access_status: approving ? "approved" : u.access_status || "",
      phone: u.phone || "",
      staff_member_id: linked?.id || NEW_STAFF,
      assignments: list,
      player_id: player ? (u.player_id || suggestPlayer(u)) : (u.player_id || ""),
    });
    setEditUser({ ...u, _approving: approving, _linked: linked || null });
  };

  const handleSave = () => {
    if (!editUser) return;
    if (editForm.person_type === "jugador" && editForm.access_status === "approved" && !editForm.player_id) {
      toast({ title: "Falta vincular la ficha de jugador", description: "Elige a qué jugador corresponde esta cuenta para que vea sus datos.", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      user: editUser,
      form: {
        ...editForm,
        staff_member_id: editForm.staff_member_id === NEW_STAFF ? "" : editForm.staff_member_id,
        player_team_id: players.find((p) => p.id === editForm.player_id)?.team_id || "",
      },
    });
  };

  const filteredUsers = liveUsers.filter((u) => {
    if (filterRole !== "all" && u.role !== filterRole && u.app_role !== filterRole) return false;
    if (filterStatus !== "all" && u.access_status !== filterStatus) return false;
    return true;
  });

  const isStaffForm = editForm.person_type === "cuerpo_tecnico";
  const fnCfg = functionConfig(editForm.app_role);
  const showTeamsEditor = isStaffForm && fnCfg && fnCfg.teams !== "none";
  const sortedStaff = [...staff].sort((a, b) => staffFullName(a).localeCompare(staffFullName(b), "es"));
  const incomplete = (editForm.assignments || []).some((a) => (a.team_id && !a.team_role) || (!a.team_id && a.team_role));
  const needsTeam = isStaffForm && fnCfg?.teams === "required" && editForm.access_status === "approved" &&
    !(editForm.assignments || []).some((a) => a.team_id && a.team_role);

  return (
    <div className="space-y-4">
      <PageTitle kicker="Administración" title="Accesos" subtitle="Gestión de usuarios del sistema" />

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <Label>Filtrar por rol</Label>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              {APP_FUNCTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              <SelectItem value="jugador">Jugador</SelectItem>
              <SelectItem value="user">Usuario</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-48">
          <Label>Filtrar por estado</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="approved">Aprobado</SelectItem>
              <SelectItem value="rejected">Rechazado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-[var(--granate)] rounded-full animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center" style={{ borderRadius: "4px" }}>
          <p className="text-gray-400 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>No hay usuarios</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 overflow-hidden" style={{ borderRadius: "4px" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Usuario", "Función y equipos", "Estado", "Acciones"].map((h, i) => (
                    <th key={h} className={`px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wider ${i === 3 ? "text-right" : "text-left"}`} style={{ fontFamily: "var(--font-display)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => {
                  const linked = links.get(user.id);
                  const list = linked ? assignmentsOfStaff(linked.id) : [];
                  const requested = user.access_status === "pending" ? user.requested_assignments || [] : [];
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{user.full_name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3 text-gray-400" />{user.email}</p>
                        {user.phone && <p className="text-xs text-gray-400">{user.phone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: user.role === "admin" ? "var(--naranja)" : "var(--granate)" }}>
                          {user.role === "admin" && !user.app_role ? "Admin" : user.app_role === "familiar" ? "Familiar" : FUNCTION_LABELS[user.app_role] || FUNCTION_LABELS[user.role] || user.role}
                          {user.role === "admin" && user.app_role && <span className="text-[10px] text-gray-400 font-normal"> · admin</span>}
                        </p>
                        {user.app_role_pending && (
                          <p className="text-xs text-gray-500">Solicita: <b>{user.app_role_pending === "familiar" ? "Acceso como familiar" : FUNCTION_LABELS[user.app_role_pending] || user.app_role_pending}</b></p>
                        )}
                        {isFamily(user) && pendingLinks.filter((l) => l.user_id === user.id).map((l) => (
                          <p key={l.id} className="text-[11px] text-yellow-700 mt-0.5">{relLabel(l.relationship)} de <b>{l.player?.name}</b>{l.player?.team ? ` · ${l.player.team}` : ""}</p>
                        ))}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {list.map((a) => (
                            <span key={a.id} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {teamName(a.team_id)} · {teamRoleLabel(a.team_role)}
                            </span>
                          ))}
                          {requested.map((a, i) => (
                            <span key={`r${i}`} className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-200">
                              {teamName(a.team_id)} · {teamRoleLabel(a.team_role)}
                            </span>
                          ))}
                          {user.player_id && players.find((p) => p.id === user.player_id) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{playerLabel(players.find((p) => p.id === user.player_id))}</span>
                          )}
                          {user.app_role_pending === "jugador" && user.requested_team_id && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-200">{teamName(user.requested_team_id)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {user.access_status === "pending" && <><Clock className="w-3.5 h-3.5 text-yellow-500" /><span className="text-yellow-600">{STATUS_LABELS.pending}</span></>}
                          {user.access_status === "approved" && <><Check className="w-3.5 h-3.5 text-green-500" /><span className="text-green-600">{STATUS_LABELS.approved}</span></>}
                          {user.access_status === "rejected" && <><X className="w-3.5 h-3.5 text-red-500" /><span className="text-red-600">{STATUS_LABELS.rejected}</span></>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isFamily(user) && pendingLinks.some((l) => l.user_id === user.id) && (
                            <>
                              <Button size="sm" variant="ghost" title="Aprobar vínculo" onClick={() => familyDecide.mutate({ user, decision: "approve" })} disabled={familyDecide.isPending} className="text-green-600 hover:bg-green-50 text-xs"><Check className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" title="Rechazar" onClick={() => familyDecide.mutate({ user, decision: "reject" })} disabled={familyDecide.isPending} className="text-red-600 hover:bg-red-50 text-xs"><X className="w-4 h-4" /></Button>
                            </>
                          )}
                          {!isFamily(user) && user.access_status === "pending" && (
                            <>
                              <Button size="sm" variant="ghost" title="Revisar y aprobar" onClick={() => openEdit(user, true)} className="text-green-600 hover:bg-green-50 text-xs">
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" title="Rechazar" onClick={() => rejectMutation.mutate(user.id)} disabled={rejectMutation.isPending} className="text-red-600 hover:bg-red-50 text-xs">
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {!isFamily(user) && (
                            <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(user)} className="text-gray-600 hover:bg-gray-100 text-xs">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" title="Eliminar" onClick={() => setDeleteDialog(user.id)} className="text-red-500 hover:bg-red-50 text-xs">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Aprobar / editar */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
              {editUser?._approving ? "Aprobar acceso" : "Editar usuario"} · {editUser?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editUser?.app_role_pending && (
              <div className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 rounded px-3 py-2">
                Solicita: <b>{FUNCTION_LABELS[editUser.app_role_pending]}</b>
                {(editUser.requested_assignments || []).map((a, i) => (
                  <span key={i}> · {teamName(a.team_id)} ({teamRoleLabel(a.team_role)})</span>
                ))}
                {editUser.requested_team_id && <span> · {teamName(editUser.requested_team_id)}</span>}
                . Puedes ajustarlo aquí antes de aprobar.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={editForm.person_type || "cuerpo_tecnico"}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, person_type: v, app_role: v === "jugador" ? "jugador" : (f.app_role === "jugador" ? "" : f.app_role) }))}
                >
                  <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cuerpo_tecnico">Cuerpo técnico</SelectItem>
                    <SelectItem value="jugador">Jugador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado de acceso</Label>
                <Select value={editForm.access_status || ""} onValueChange={(v) => setEditForm((f) => ({ ...f, access_status: v }))}>
                  <SelectTrigger className="border-gray-200"><SelectValue placeholder="Sin estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="approved">Aprobado</SelectItem>
                    <SelectItem value="rejected">Rechazado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isStaffForm && (
              <div>
                <Label>Función en el club</Label>
                <Select value={editForm.app_role || ""} onValueChange={(v) => setEditForm((f) => ({ ...f, app_role: v }))}>
                  <SelectTrigger className="border-gray-200"><SelectValue placeholder="Selecciona función" /></SelectTrigger>
                  <SelectContent>
                    {APP_FUNCTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fnCfg?.hint && <p className="text-[11px] text-gray-400 mt-1">{fnCfg.hint}</p>}
              </div>
            )}

            {showTeamsEditor && (
              <div className="p-3 bg-gray-50 rounded-sm border border-gray-100">
                <TeamRolesEditor
                  value={editForm.assignments || []}
                  onChange={(a) => setEditForm((f) => ({ ...f, assignments: a }))}
                  teams={teams}
                  roleOptions={TEAM_ROLES}
                  label="Equipos y rol exacto en cada uno"
                  compact
                />
                <p className="text-[11px] text-gray-400 mt-2">Una misma persona puede tener varios equipos y un rol distinto en cada uno.</p>
              </div>
            )}

            {!isStaffForm && (
              <div>
                <Label>Ficha de jugador vinculada *</Label>
                <Select value={editForm.player_id || ""} onValueChange={(v) => setEditForm((f) => ({ ...f, player_id: v }))}>
                  <SelectTrigger className="border-gray-200"><SelectValue placeholder="Elige el jugador" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {[...players]
                      .filter((p) => p.status !== "baja")
                      .sort((a, b) => ((a.team_id === editUser?.requested_team_id ? 0 : 1) - (b.team_id === editUser?.requested_team_id ? 0 : 1)) || playerLabel(a).localeCompare(playerLabel(b), "es"))
                      .map((p) => <SelectItem key={p.id} value={p.id}>{playerLabel(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1"><Link2 className="w-3 h-3" />Con esta ficha el jugador verá solo sus datos y los de su equipo (sin valoraciones de partido ni notas internas).</p>
              </div>
            )}

            {isStaffForm && editForm.app_role && (
              <div>
                <Label>Ficha de personal vinculada</Label>
                <Select value={editForm.staff_member_id || NEW_STAFF} onValueChange={(v) => setEditForm((f) => ({ ...f, staff_member_id: v }))}>
                  <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NEW_STAFF}>Crear ficha nueva</SelectItem>
                    {sortedStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{staffFullName(s)}{s.email ? ` (${s.email})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  {editUser?._linked ? "Vinculada automáticamente a su ficha existente." : "Si ya existe su ficha, elígela para no duplicar a la persona."}
                </p>
              </div>
            )}

            {isStaffForm && editForm.app_role && (
              <div>
                <Label>También es jugador (opcional)</Label>
                <Select value={editForm.player_id || "__none__"} onValueChange={(v) => setEditForm((f) => ({ ...f, player_id: v === "__none__" ? "" : v }))}>
                  <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__none__">No, solo cuerpo técnico</SelectItem>
                    {[...players]
                      .filter((p) => p.status !== "baja")
                      .sort((a, b) => playerLabel(a).localeCompare(playerLabel(b), "es"))
                      .map((p) => <SelectItem key={p.id} value={p.id}>{playerLabel(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1"><Link2 className="w-3 h-3" />Entra como cuerpo técnico y en el menú tiene "Mi ficha de jugador". También recibe los avisos dirigidos a jugadores.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Teléfono</Label>
                <Input value={editForm.phone || ""} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="border-gray-200" type="tel" />
              </div>
              <div>
                <Label>Rol de plataforma</Label>
                <Select value={editForm.role || "user"} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">Usuario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(incomplete || needsTeam) && (
              <p className="text-xs text-orange-600">
                {incomplete ? "Completa equipo y rol en cada fila (o quita la fila)." : "Un entrenador necesita al menos un equipo con su rol."}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)} className="flex-1">Cancelar</Button>
              <Button variant="club"
                onClick={handleSave}
                disabled={saveMutation.isPending || incomplete || needsTeam || (isStaffForm && !editForm.app_role && editForm.access_status === "approved")}
                className="flex-1"
              >
                {saveMutation.isPending ? "Guardando..." : editUser?._approving ? "Aprobar y guardar" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Eliminar */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>Se le quitará el acceso a la aplicación. Su ficha de personal y su historial se conservan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteDialog)} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700 text-white">
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
