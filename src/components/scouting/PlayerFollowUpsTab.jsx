import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CheckCircle2, XCircle, Clock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

const STATUS_CONFIG = {
  pendiente:  { label: "Pendiente",   icon: Clock,         cls: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  completado: { label: "Completado",  icon: CheckCircle2,  cls: "text-green-600 bg-green-50 border-green-200"   },
  cancelado:  { label: "Cancelado",   icon: XCircle,       cls: "text-gray-500 bg-gray-50 border-gray-200"      },
};

const EMPTY_FORM = { scheduled_date: "", notes: "" };
const EMPTY_COMPLETE = { completed_date: "", completion_notes: "" };

export default function PlayerFollowUpsTab({ playerId }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [completeDialog, setCompleteDialog] = useState(null); // follow-up id
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [completeForm, setCompleteForm] = useState(EMPTY_COMPLETE);

  const { data: followups = [] } = useQuery({
    queryKey: ["followups_player", playerId],
    queryFn: () => base44.entities.FollowUp.filter({ player_id: playerId }),
    enabled: !!playerId,
  });

  const sorted = [...followups].sort((a, b) => (b.scheduled_date || "").localeCompare(a.scheduled_date || ""));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FollowUp.create({ ...data, player_id: playerId, status: "pendiente" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups_player", playerId] });
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      setFormOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Seguimiento programado." });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FollowUp.update(id, { ...data, status: "completado" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups_player", playerId] });
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      setCompleteDialog(null);
      setCompleteForm(EMPTY_COMPLETE);
      toast({ title: "Seguimiento completado." });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => base44.entities.FollowUp.update(id, { status: "cancelado" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups_player", playerId] });
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      toast({ title: "Seguimiento cancelado." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FollowUp.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups_player", playerId] });
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      setDeleteId(null);
      toast({ title: "Seguimiento eliminado." });
    },
  });

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
          {followups.length} seguimiento{followups.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={() => setFormOpen(true)} className="text-white" style={{ background: "var(--granate)" }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Programar seguimiento
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No hay seguimientos registrados</div>
      ) : (
        <div className="space-y-2">
          {sorted.map(fu => {
            const cfg = STATUS_CONFIG[fu.status] || STATUS_CONFIG.pendiente;
            const Icon = cfg.icon;
            return (
              <div key={fu.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.cls.split(" ")[0]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {fu.scheduled_date ? new Date(fu.scheduled_date).toLocaleDateString("es") : "Sin fecha"}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                      </div>
                      {fu.notes && <p className="text-sm text-gray-600 mt-1">{fu.notes}</p>}
                      {fu.completed_date && (
                        <p className="text-xs text-green-600 mt-1">
                          Completado el {new Date(fu.completed_date).toLocaleDateString("es")}
                        </p>
                      )}
                      {fu.completion_notes && <p className="text-xs text-gray-500 mt-0.5">{fu.completion_notes}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {fu.status === "pendiente" && (
                      <>
                        <button
                          onClick={() => { setCompleteDialog(fu.id); setCompleteForm({ completed_date: new Date().toISOString().split("T")[0], completion_notes: "" }); }}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600"
                          title="Marcar completado"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => cancelMutation.mutate(fu.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          title="Cancelar"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button onClick={() => setDeleteId(fu.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Programar seguimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">Fecha *</Label><Input type="date" value={form.scheduled_date} onChange={e => set("scheduled_date", e.target.value)} /></div>
            <div><Label className="text-xs">Notas previas</Label><Textarea rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="¿Qué se quiere observar?" /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.scheduled_date || createMutation.isPending}
                className="flex-1 text-white" style={{ background: "var(--granate)" }}
              >
                {createMutation.isPending ? "Guardando..." : "Programar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={!!completeDialog} onOpenChange={open => { if (!open) setCompleteDialog(null); }}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Completar seguimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">Fecha de finalización</Label><Input type="date" value={completeForm.completed_date} onChange={e => setCompleteForm(f => ({ ...f, completed_date: e.target.value }))} /></div>
            <div><Label className="text-xs">Notas de finalización</Label><Textarea rows={3} value={completeForm.completion_notes} onChange={e => setCompleteForm(f => ({ ...f, completion_notes: e.target.value }))} placeholder="Resumen de lo observado..." /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setCompleteDialog(null)} className="flex-1">Cancelar</Button>
              <Button
                onClick={() => completeMutation.mutate({ id: completeDialog, data: completeForm })}
                disabled={completeMutation.isPending}
                className="flex-1 text-white" style={{ background: "var(--granate)" }}
              >
                {completeMutation.isPending ? "Guardando..." : "Completar"}
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