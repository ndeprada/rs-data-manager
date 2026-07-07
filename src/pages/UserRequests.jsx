import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

const ROLE_LABELS = {
  entrenador: "Entrenador",
  preparador_fisico: "Preparador Físico",
  entrenador_porteros: "Entrenador de Porteros",
  psicologo: "Psicólogo",
  fisioterapeuta: "Fisioterapeuta",
  coordinador_f7: "Coordinador F7",
  coordinador_f11: "Coordinador F11",
  coordinador_general: "Coordinador General",
};

export default function UserRequests() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const pendingUsers = users.filter(u => u.access_status === "pending" && u.app_role_pending);

  const approveMutation = useMutation({
    mutationFn: async (user) => {
      await base44.entities.User.update(user.id, {
        app_role: user.app_role_pending,
        access_status: "approved",
        app_role_pending: null,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (user) => {
      await base44.entities.User.update(user.id, {
        access_status: "rejected",
        app_role_pending: null,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  if (currentUser?.role !== "admin") {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-400">No tienes acceso a esta sección.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Administración</p>
        <h1>Solicitudes de acceso</h1>
        <p className="text-gray-400 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>Usuarios pendientes de aprobación</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : pendingUsers.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center" style={{ borderRadius: "4px" }}>
          <Clock className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
            No hay solicitudes pendientes
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingUsers.map(u => (
            <div key={u.id} className="bg-white border border-gray-200 p-5 flex items-center justify-between gap-4" style={{ borderRadius: "4px" }}>
              <div>
                <p className="font-bold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>{u.full_name}</p>
                <p className="text-sm text-gray-500">{u.email}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Rol solicitado: <span className="font-semibold text-gray-600">{ROLE_LABELS[u.app_role_pending] || u.app_role_pending}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rejectMutation.mutate(u)}
                  disabled={rejectMutation.isPending}
                  className="text-red-500 border-red-200 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate(u)}
                  disabled={approveMutation.isPending}
                  className="text-white"
                  style={{ background: "var(--granate)" }}
                >
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}