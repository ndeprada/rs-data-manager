import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, Clock, Edit2, Trash2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";

const ROLE_LABELS = {
  admin: "Admin",
  entrenador: "Entrenador",
  preparador_fisico: "Preparador Físico",
  entrenador_porteros: "Entrenador de Porteros",
  psicologo: "Psicólogo",
  fisioterapeuta: "Fisioterapeuta",
  coordinador_f7: "Coordinador F7",
  coordinador_f11: "Coordinador F11",
  coordinador_general: "Coordinador General",
};

const STATUS_LABELS = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export default function Accesos() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editDialog, setEditDialog] = useState(null); // stores the user id
  const [editForm, setEditForm] = useState({});
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  if (currentUser?.role !== "admin") {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-400">No tienes acceso a esta sección.</p>
      </div>
    );
  }

  const filteredUsers = users.filter(u => {
    if (filterRole !== "all" && u.role !== filterRole && u.app_role !== filterRole) return false;
    if (filterStatus !== "all" && u.access_status !== filterStatus) return false;
    return true;
  });

  const approveMutation = useMutation({
    mutationFn: async (userId) => {
      const user = users.find(u => u.id === userId);
      if (!user) throw new Error("Usuario no encontrado");
      await base44.entities.User.update(userId, {
        app_role: user.app_role_pending,
        access_status: "approved",
        app_role_pending: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Acceso aprobado", description: "El usuario ha sido aprobado correctamente." });
    },
    onError: (err) => toast({ title: "Error al aprobar", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId) => {
      await base44.entities.User.update(userId, {
        access_status: "rejected",
        app_role_pending: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Acceso rechazado" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: () => base44.entities.StaffMember.list(),
  });

  const editMutation = useMutation({
    mutationFn: async ({ userId, payload }) => {
      // PASO 1: Actualizar User
      await base44.entities.User.update(userId, {
        role: payload.role || "user",
        app_role: payload.app_role || null,
        access_status: payload.access_status || null,
        phone: payload.phone || null,
      });

      // PASO 2: Buscar StaffMember por email
      const targetUser = users.find(u => u.id === userId);
      if (!targetUser) return;

      const allStaffList = await base44.entities.StaffMember.list();
      const linkedStaff = allStaffList.find(s => s.email?.toLowerCase() === targetUser.email?.toLowerCase());

      if (linkedStaff) {
        // Actualizar StaffMember existente
        await base44.entities.StaffMember.update(linkedStaff.id, {
          phone: payload.phone || null,
          role: payload.app_role || linkedStaff.role || "entrenador",
        });
        // Vincular si no estaba vinculado
        if (!targetUser.staff_member_id) {
          await base44.entities.User.update(userId, { staff_member_id: linkedStaff.id });
        }
      } else {
        // Crear nuevo StaffMember vinculado
        const nameParts = (targetUser.full_name || "").split(" ");
        const newStaff = await base44.entities.StaffMember.create({
          first_name: nameParts[0] || "",
          last_name: nameParts.slice(1).join(" ") || "",
          email: targetUser.email,
          phone: payload.phone || "",
          role: payload.app_role || "entrenador",
          team_id: "",
        });
        await base44.entities.User.update(userId, { staff_member_id: newStaff.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setEditDialog(null);
      toast({ title: "Usuario actualizado", description: "Los cambios se han guardado correctamente." });
    },
    onError: (err) => toast({ title: "Error al guardar", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId) => {
      await base44.entities.User.update(userId, {
        access_status: "deleted",
        app_role: null,
        app_role_pending: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteDialog(null);
      toast({ title: "Usuario eliminado" });
    },
    onError: (err) => toast({ title: "Error al eliminar", description: err.message, variant: "destructive" }),
  });

  const handleOpenEdit = (user) => {
    setEditForm({
      role: user.role || "user",
      app_role: user.app_role || "",
      access_status: user.access_status || "",
      phone: user.phone || "",
    });
    setEditDialog(user.id);
  };

  const handleSaveEdit = () => {
    if (!editDialog) return;
    editMutation.mutate({
      userId: editDialog,
      payload: {
        role: editForm.role || "user",
        app_role: editForm.app_role || null,
        access_status: editForm.access_status || null,
        phone: editForm.phone || null,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Administración</p>
        <h1>Accesos</h1>
        <p className="text-gray-400 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>Gestión de usuarios del sistema</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Filtrar por rol</label>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="border-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="coordinador_general">Coordinador General</SelectItem>
              <SelectItem value="coordinador_f7">Coordinador F7</SelectItem>
              <SelectItem value="coordinador_f11">Coordinador F11</SelectItem>
              <SelectItem value="entrenador">Entrenador</SelectItem>
              <SelectItem value="user">Usuario</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Filtrar por estado</label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="border-gray-200">
              <SelectValue />
            </SelectTrigger>
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
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center" style={{ borderRadius: "4px" }}>
          <p className="text-gray-400 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
            No hay usuarios
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 overflow-hidden" style={{ borderRadius: "4px" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-bold text-gray-600 text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>Usuario</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>Email</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>Rol</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>Estado</th>
                  <th className="px-4 py-3 text-right font-bold text-gray-600 text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-gray-900">{user.full_name}</p>
                        <p className="text-xs text-gray-500">{user.phone || "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900" style={{ color: user.role === "admin" ? "var(--naranja)" : "var(--granate)" }}>
                          {ROLE_LABELS[user.app_role] || ROLE_LABELS[user.role] || user.role}
                        </p>
                        {user.app_role_pending && (
                          <p className="text-xs text-gray-500">Solicitado: {ROLE_LABELS[user.app_role_pending] || user.app_role_pending}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {user.access_status === "pending" && (
                          <>
                            <Clock className="w-3.5 h-3.5 text-yellow-500" />
                            <span className="text-yellow-600">{STATUS_LABELS[user.access_status]}</span>
                          </>
                        )}
                        {user.access_status === "approved" && (
                          <>
                            <Check className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-green-600">{STATUS_LABELS[user.access_status]}</span>
                          </>
                        )}
                        {user.access_status === "rejected" && (
                          <>
                            <X className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-red-600">{STATUS_LABELS[user.access_status]}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.access_status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => approveMutation.mutate(user.id)}
                              disabled={approveMutation.isPending}
                              className="text-green-600 hover:bg-green-50 text-xs"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => rejectMutation.mutate(user.id)}
                              disabled={rejectMutation.isPending}
                              className="text-red-600 hover:bg-red-50 text-xs"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(user)}
                          className="text-gray-600 hover:bg-gray-100 text-xs"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteDialog(user.id)}
                          className="text-red-500 hover:bg-red-50 text-xs"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => { if (!open) setEditDialog(null); }}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Editar usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Teléfono</label>
              <Input
                value={editForm.phone || ""}
                onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                className="border-gray-200"
                type="tel"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Rol de plataforma</label>
              <Select value={editForm.role || "user"} onValueChange={(v) => setEditForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">Usuario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Rol en la app</label>
              <Select value={editForm.app_role || ""} onValueChange={(v) => setEditForm(f => ({ ...f, app_role: v }))}>
                <SelectTrigger className="border-gray-200">
                  <SelectValue placeholder="Sin rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sin rol</SelectItem>
                  <SelectItem value="coordinador_general">Coordinador General</SelectItem>
                  <SelectItem value="coordinador_f7">Coordinador F7</SelectItem>
                  <SelectItem value="coordinador_f11">Coordinador F11</SelectItem>
                  <SelectItem value="entrenador">Entrenador</SelectItem>
                  <SelectItem value="preparador_fisico">Preparador Físico</SelectItem>
                  <SelectItem value="entrenador_porteros">Entrenador de Porteros</SelectItem>
                  <SelectItem value="psicologo">Psicólogo</SelectItem>
                  <SelectItem value="fisioterapeuta">Fisioterapeuta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Estado de acceso</label>
              <Select value={editForm.access_status || ""} onValueChange={(v) => setEditForm(f => ({ ...f, access_status: v }))}>
                <SelectTrigger className="border-gray-200">
                  <SelectValue placeholder="Sin estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditDialog(null)} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={editMutation.isPending}
                className="flex-1 text-white"
                style={{ background: "var(--granate)" }}
              >
                {editMutation.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción eliminará el usuario del sistema. No se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteDialog)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}