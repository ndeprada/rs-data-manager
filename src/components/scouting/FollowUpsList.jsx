import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

const STATUS_STYLES = {
  pendiente: { label: "Pendiente", icon: Clock, cls: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  completado: { label: "Completado", icon: Check, cls: "text-green-600 bg-green-50 border-green-200" },
  cancelado: { label: "Cancelado", icon: X, cls: "text-gray-400 bg-gray-50 border-gray-200" },
};

const EMPTY_FORM = { player_id: "", scheduled_date: "", status: "pendiente", notes: "", completed_date: "", completion_notes: "" };

export default function FollowUpsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: followups = [] } = useQuery({ queryKey: ["followups"], queryFn: () => base44.entities.FollowUp.list("-scheduled_date", 200) });
  const { data: players = [] } = useQuery({ queryKey: ["scouted_players"], queryFn: () => base44.entities.ScoutedPlayer.list("-created_date", 500) });

  const create = useMutation({
    mutationFn: (data) => base44.entities.FollowUp.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["followups"] }); setFormOpen(false); setForm(EMPTY_FORM); toast({ title: "Seguimiento creado." }); },
    onError: err => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const update = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FollowUp.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["followups"] }); setFormOpen(false); setEditing(null); setForm(EMPTY_FORM); toast({ title: "Seguimiento actualizado." }); },
    onError: err => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: (id) => base44.entities.FollowUp.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["followups"] }); setDeleteId(null); },
  });

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (f) => {
    setEditing(f);
    setForm({ player_id: f.player_id || "", scheduled_date: f.scheduled_date || "", status: f.status || "pendiente", notes: f.notes || "", completed_date: f.completed_date || "", completion_notes: f.completion_notes || "" });
    setFormOpen(true);
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) update.mutate({ id: editing.id, data: form });
    else create.mutate(form);
  };

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const playerName = (id) => {
    const p = players.find(p => p.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "—";
  };

  const filtered = followups.filter(f => filterStatus === "all" || f.status === filterStatus);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="completado">Completado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openNew} className="text-white" style={{ background: "var(--granate)" }}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo seguimiento
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <Clock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>No hay seguimientos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => {
            const st = STATUS_STYLES[f.status] || STATUS_STYLES.pendiente;
            const IconComp = st.icon;
            return (
              <div key={f.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4 shadow-sm">
                <div className={`p-2 rounded-lg border ${st.cls} shrink-0`}><IconComp className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{playerName(f.player_id)}</p>
                  <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 mt-0.5">
                    <span>📅 {f.scheduled_date ? new Date(f.scheduled_date).toLocaleDateString("es") : "—"}</span>
                    <span className={`font-medium ${st.cls.split(" ")[0]}`}>{st.label}</span>
                  </div>
                  {f.notes && <p className="text-xs text-gray-500 mt-1 truncate">{f.notes}</p>}
                  {f.completion_notes && <p className="text-xs text-green-600 mt-0.5 truncate">{f.completion_notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(f)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteId(f.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={open => { setFormOpen(open); if (!open) { setEditing(null); setForm(EMPTY_FORM); }}}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
              {editing ? "Editar seguimiento" : "Nuevo seguimiento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-xs">Jugador *</Label>
              <Select value={form.player_id} onValueChange={v => set("player_id", v)} required>
                <SelectTrigger><SelectValue placeholder="Seleccionar jugador" /></SelectTrigger>
                <SelectContent>
                  {players.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Fecha programada *</Label><Input type="date" value={form.scheduled_date} onChange={e => set("scheduled_date", e.target.value)} required /></div>
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Notas previas</Label><Textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
            {form.status === "completado" && (
              <>
                <div><Label className="text-xs">Fecha completado</Label><Input type="date" value={form.completed_date} onChange={e => set("completed_date", e.target.value)} /></div>
                <div><Label className="text-xs">Notas al completar</Label><Textarea rows={2} value={form.completion_notes} onChange={e => set("completion_notes", e.target.value)} /></div>
              </>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending || update.isPending} className="text-white" style={{ background: "var(--granate)" }}>
                {(create.isPending || update.isPending) ? "Guardando..." : editing ? "Guardar" : "Crear"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar seguimiento?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}