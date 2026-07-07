import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check, Clock, X, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

const STATUS_CONFIG = {
  pendiente: { label: "Pendiente", cls: "bg-yellow-100 text-yellow-700", icon: Clock },
  completado: { label: "Completado", cls: "bg-green-100 text-green-700", icon: Check },
  cancelado: { label: "Cancelado", cls: "bg-gray-100 text-gray-500", icon: X },
};

const EMPTY_FORM = { scheduled_date: "", notes: "" };

export default function PlayerFollowUpTab({ playerId }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState(null);
  const [completeDialog, setCompleteDialog] = useState(null); // { id, completion_notes }

  const { data: followUps = [], isLoading } = useQuery({
    queryKey: ["follow_ups_player", playerId],
    queryFn: () => base44.entities.FollowUp.filter({ player_id: playerId }, "-scheduled_date"),
    enabled: !!playerId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FollowUp.create({ ...data, player_id: playerId, status: "pendiente" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow_ups_player", playerId] });
      queryClient.invalidateQueries({ queryKey: ["follow_ups"] });
      setFormOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Seguimiento programado." });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FollowUp.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow_ups_player", playerId] });
      queryClient.invalidateQueries({ queryKey: ["follow_ups"] });
      setCompleteDialog(null);
      toast({ title: "Seguimiento actualizado." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FollowUp.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow_ups_player", playerId] });
      queryClient.invalidateQueries({ queryKey: ["follow_ups"] });
      setDeleteId(null);
      toast({ title: "Seguimiento eliminado." });
    },
  });

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const markComplete = () => {
    if (!completeDialog) return;
    updateMutation.mutate({
      id: completeDialog.id,
      data: {
        status: "completado",
        completed_date: new Date().toISOString().split("T")[0],
        completion_notes: completeDialog.notes || "",
      },
    });
  };

  const markCancelled = (id) => updateMutation.mutate({ id, data: { status: "cancelado" } });

  if (isLoading) return <div className="flex justify-center p-8"><div className="w-6 h-6 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin" /></div>;

  const pending = followUps.filter(f => f.status === "pendiente");
  const rest = followUps.filter(f => f.status !== "pendiente");

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
          {pending.length} pendiente{pending.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={() => setFormOpen(true)} className="text-white" style={{ background: "var(--granate)" }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Programar seguimiento
        </Button>
      </div>

      {followUps.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <CalendarClock className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No hay seguimientos programados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...pending, ...rest].map(fu => {
            const cfg = STATUS_CONFIG[fu.status] || STATUS_CONFIG.pendiente;
            const Icon = cfg.icon;
            const isPending = fu.status === "pendiente";
            const date = fu.scheduled_date ? new Date(fu.scheduled_date).toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" }) : "—";
            const isPast = fu.scheduled_date && new Date(fu.scheduled_date) < new Date() && isPending;
            return (
              <div key={fu.id} className={`bg-white border rounded-xl shadow-sm overflow-hidden ${isPast ? "border-orange-200" : "border-gray-200"}`}>
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded-lg ${cfg.cls}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900">{date}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
                      {isPast && <span className="text-xs text-orange-600 font-medium">· Vencido</span>}
                    </div>
                    {fu.notes && <p className="text-xs text-gray-500 mt-0.5">{fu.notes}</p>}
                    {fu.completion_notes && <p className="text-xs text-green-600 mt-1">✅ {fu.completion_notes}</p>}
                    {fu.completed_date && <p className="text-xs text-gray-400 mt-0.5">Completado: {new Date(fu.completed_date).toLocaleDateString("es")}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {isPending && (
                      <>
                        <button
                          onClick={() => setCompleteDialog({ id: fu.id, notes: "" })}
                          className="px-2 py-1 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => markCancelled(fu.id)}
                          className="px-2 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 text-xs font-bold transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button onClick={() => setDeleteId(fu.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Programar seguimiento */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Programar seguimiento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label className="text-xs">Fecha programada *</Label><Input type="date" value={form.scheduled_date} onChange={e => set("scheduled_date", e.target.value)} required /></div>
            <div><Label className="text-xs">Notas previas</Label><Textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Partido a observar, objetivo del seguimiento..." /></div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending} className="flex-1 text-white" style={{ background: "var(--granate)" }}>
                {createMutation.isPending ? "Guardando..." : "Programar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Completar seguimiento */}
      <Dialog open={!!completeDialog} onOpenChange={open => { if (!open) setCompleteDialog(null); }}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Marcar como completado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Notas de finalización</Label>
              <Textarea rows={3}
                value={completeDialog?.notes || ""}
                onChange={e => setCompleteDialog(d => ({ ...d, notes: e.target.value }))}
                placeholder="¿Qué se observó? ¿Cuál es la conclusión?"
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setCompleteDialog(null)} className="flex-1">Cancelar</Button>
              <Button onClick={markComplete} disabled={updateMutation.isPending} className="flex-1 text-white" style={{ background: "var(--granate)" }}>
                {updateMutation.isPending ? "Guardando..." : "Confirmar completado"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar seguimiento?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}