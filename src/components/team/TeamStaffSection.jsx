import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import AddStaffDialog from "@/components/team/AddStaffDialog";

import { CURRENT_SEASON, TEAM_ROLES, teamRoleLabel, teamRoleRank } from "@/lib/staffRoles";
import { syncUserTeamsForStaff } from "@/lib/staffLink";
import { useT } from "@/i18n";

export default function TeamStaffSection({ teamId }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newStaffOpen, setNewStaffOpen] = useState(false);
  const [editDialog, setEditDialog] = useState(null); // { assignmentId, team_role }
  const [deleteId, setDeleteId] = useState(null);   // assignmentId to delete
  const [form, setForm] = useState({ staff_member_id: "", team_role: "" });

  // ── Data ───────────────────────────────────────────────────────────────
  const { data: assignments = [], isFetched: assignmentsLoaded } = useQuery({
    queryKey: ["team_staff_assignments", teamId],
    queryFn: () => base44.entities.TeamStaffAssignment.filter({ team_id: teamId, active: true }),
    enabled: !!teamId,
  });

  const { data: allStaff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: () => base44.entities.StaffMember.list(),
  });

  // ── Auto-migrate: crea la asignación de quien tiene team_id pero aún no tiene asignación ──
  // (una sola vez por persona y equipo: antes se repetía en bucle y creaba asignaciones duplicadas)
  const migrating = useRef(new Set());
  useEffect(() => {
    if (!teamId || !assignmentsLoaded || allStaff.length === 0) return;
    const assignedStaffIds = new Set(assignments.map(a => a.staff_member_id));
    const toMigrate = allStaff.filter(
      s => s.team_id === teamId && !assignedStaffIds.has(s.id) && !migrating.current.has(`${s.id}:${teamId}`)
    );
    toMigrate.forEach(async (s) => {
      migrating.current.add(`${s.id}:${teamId}`);
      try {
        await base44.entities.TeamStaffAssignment.create({
          staff_member_id: s.id,
          team_id: teamId,
          team_role: s.team_role || null,
          season: CURRENT_SEASON,
          active: true,
        });
        queryClient.invalidateQueries({ queryKey: ["team_staff_assignments", teamId] });
      } catch (_) {}
    });
  }, [teamId, allStaff, assignments, assignmentsLoaded]);

  // Build combined view: assignment + staff data
  const seenStaff = new Set();
  const teamStaff = assignments
    .filter(a => (seenStaff.has(a.staff_member_id) ? false : (seenStaff.add(a.staff_member_id), true)))
    .map(a => {
      const staff = allStaff.find(s => s.id === a.staff_member_id);
      if (!staff) return null;
      return { ...staff, team_role: a.team_role, assignment_id: a.id };
    })
    .filter(Boolean)
    .sort((a, b) => teamRoleRank(a.team_role) - teamRoleRank(b.team_role));

  // Staff available to add (not already assigned)
  const assignedStaffIds = new Set(assignments.map(a => a.staff_member_id));
  const availableStaff = allStaff.filter(s => !assignedStaffIds.has(s.id));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["team_staff_assignments", teamId] });
    queryClient.invalidateQueries({ queryKey: ["staff"] });
  };

  // ── Mutations ──────────────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: async ({ staff_member_id, team_role }) => {
      // Create assignment
      await base44.entities.TeamStaffAssignment.create({
        staff_member_id,
        team_id: teamId,
        team_role,
        season: CURRENT_SEASON,
        active: true,
      });
      // Keep StaffMember.team_id in sync for backwards compat
      await base44.entities.StaffMember.update(staff_member_id, { team_id: teamId, team_role });
      await syncUserTeamsForStaff(staff_member_id);
    },
    onSuccess: () => {
      invalidate();
      setAddDialogOpen(false);
      setForm({ staff_member_id: "", team_role: "" });
      toast({ title: t("Miembro añadido al cuerpo técnico.") });
    },
    onError: (err) => toast({ title: t("Error"), description: err.message, variant: "destructive" }),
  });

  const editRoleMutation = useMutation({
    mutationFn: async ({ assignmentId, staff_member_id, team_role }) => {
      await base44.entities.TeamStaffAssignment.update(assignmentId, { team_role });
      await base44.entities.StaffMember.update(staff_member_id, { team_role });
      await syncUserTeamsForStaff(staff_member_id);
    },
    onSuccess: () => {
      invalidate();
      setEditDialog(null);
      toast({ title: t("Rol actualizado.") });
    },
    onError: (err) => toast({ title: t("Error"), description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (assignmentId) => {
      const a = assignments.find(x => x.id === assignmentId);
      await base44.entities.TeamStaffAssignment.update(assignmentId, { active: false });
      // Limpiar el campo antiguo para que la migración automática no lo vuelva a crear
      const s = allStaff.find(x => x.id === a?.staff_member_id);
      if (s && s.team_id === teamId) {
        await base44.entities.StaffMember.update(s.id, { team_id: "" });
      }
      await syncUserTeamsForStaff(a?.staff_member_id);
    },
    onSuccess: () => {
      invalidate();
      setDeleteId(null);
      toast({ title: t("Miembro desvinculado del equipo.") });
    },
    onError: (err) => toast({ title: t("Error"), description: err.message, variant: "destructive" }),
  });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{t("Cuerpo Técnico del Equipo")}</h3>
          <Button variant="club" size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> {t("Añadir miembro")}
          </Button>
        </div>

        {teamStaff.length === 0 ? (
          <div className="p-6 text-center border border-gray-200 rounded-lg bg-gray-50">
            <p className="text-gray-400 text-sm">{t("No hay miembros asignados al cuerpo técnico")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {teamStaff.map((member) => (
              <div key={member.assignment_id} className="flex items-center justify-between px-3 py-1.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-2.5 min-w-0">
                  {member.photo_url ? (
                    <img src={member.photo_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: "var(--granate)" }}>
                      {member.first_name?.[0]}{member.last_name?.[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{member.first_name} {member.last_name} <span className="text-[11px] font-medium ml-1" style={{ color: "var(--granate)" }}>{teamRoleLabel(member.team_role)}</span></p>
                    <div className="flex gap-3 flex-wrap">
                      {member.email && <span className="text-[11px] text-gray-400 flex items-center gap-1 min-w-0"><Mail className="w-3 h-3" />{member.email}</span>}
                      {member.phone && <span className="text-[11px] text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" />{member.phone}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditDialog({ assignmentId: member.assignment_id, staff_member_id: member.id, team_role: member.team_role || "" })}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(member.assignment_id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog: Añadir */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle>{t("Añadir al Cuerpo Técnico")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("Miembro del Staff *")}</Label>
              <Select value={form.staff_member_id} onValueChange={(v) => setForm(f => ({ ...f, staff_member_id: v }))}>
                <SelectTrigger className="border-gray-200">
                  <SelectValue placeholder={t("Seleccionar miembro")} />
                </SelectTrigger>
                <SelectContent>
                  {availableStaff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                      {s.email ? ` (${s.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => setNewStaffOpen(true)}
                className="text-xs font-medium flex items-center gap-1 hover:underline"
                style={{ color: "var(--granate)" }}
              >
                <Plus className="w-3 h-3" /> {t("Crear nuevo miembro del staff")}
              </button>
            </div>
            <div className="space-y-2">
              <Label>{t("Rol en el Equipo *")}</Label>
              <Select value={form.team_role} onValueChange={(v) => setForm(f => ({ ...f, team_role: v }))}>
                <SelectTrigger className="border-gray-200">
                  <SelectValue placeholder={t("Seleccionar rol")} />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{t(r.label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setAddDialogOpen(false); setForm({ staff_member_id: "", team_role: "" }); }}>
                {t("Cancelar")}
              </Button>
              <Button variant="club"
                onClick={() => addMutation.mutate(form)}
                disabled={!form.staff_member_id || !form.team_role || addMutation.isPending}
              >
                {addMutation.isPending ? t("Añadiendo...") : t("Añadir")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar rol */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle>{t("Editar Rol en el Equipo")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("Nuevo Rol")}</Label>
              <Select value={editDialog?.team_role || ""} onValueChange={(v) => setEditDialog(d => ({ ...d, team_role: v }))}>
                <SelectTrigger className="border-gray-200">
                  <SelectValue placeholder={t("Seleccionar rol")} />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{t(r.label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setEditDialog(null)}>{t("Cancelar")}</Button>
              <Button variant="club"
                onClick={() => editRoleMutation.mutate(editDialog)}
                disabled={!editDialog?.team_role || editRoleMutation.isPending}
              >
                {editRoleMutation.isPending ? "Guardando..." : t("Guardar")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Crear nuevo miembro del staff */}
      <AddStaffDialog
        open={newStaffOpen}
        onOpenChange={setNewStaffOpen}
        teamId={teamId}
        editingStaff={null}
        onCreated={(created) => {
          queryClient.setQueryData(["staff"], (old = []) => [...old, created]);
          setForm((f) => ({ ...f, staff_member_id: created.id }));
          toast({ title: t("Miembro del staff creado. Ahora elige su rol y pulsa Añadir.") });
        }}
      />

      {/* Alert: Eliminar */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("¿Desvincular del equipo?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Se eliminará este miembro del cuerpo técnico del equipo. El miembro no será eliminado del sistema.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? "Desvinculando..." : t("Desvincular")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
