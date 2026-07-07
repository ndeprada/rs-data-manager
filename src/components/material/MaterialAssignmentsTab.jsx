import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeftRight, CheckCircle, XCircle, Undo2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";

const STATUS_COLORS = {
  activo: "bg-blue-100 text-blue-700",
  devuelto: "bg-green-100 text-green-700",
  perdido: "bg-red-100 text-red-700",
};

const STATUS_LABELS = { activo: "Asignado", devuelto: "Devuelto", perdido: "Perdido" };

const EMPTY_FORM = { material_item_id: "", team_id: "", quantity: "", assigned_date: new Date().toISOString().split("T")[0], return_date: "", status: "activo", notes: "" };

export default function MaterialAssignmentsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState("activo");

  const { data: assignments = [] } = useQuery({
    queryKey: ["material_assignments"],
    queryFn: () => base44.entities.MaterialAssignment.list("-assigned_date"),
  });

  const { data: items = [] } = useQuery({
    queryKey: ["material_items"],
    queryFn: () => base44.entities.MaterialItem.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.MaterialAssignment.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material_assignments"] });
      setShowForm(false);
      setForm(EMPTY_FORM);
      toast({ title: "Asignación registrada" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MaterialAssignment.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material_assignments"] });
      toast({ title: "Estado actualizado" });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate({ ...form, quantity: Number(form.quantity) });
  };

  const getItemName = (id) => items.find(i => i.id === id)?.name || "—";
  const getTeamName = (id) => teams.find(t => t.id === id)?.name || "—";

  const filtered = filterStatus === "all" ? assignments : assignments.filter(a => a.status === filterStatus);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="activo">Asignados</SelectItem>
            <SelectItem value="devuelto">Devueltos</SelectItem>
            <SelectItem value="perdido">Perdidos</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Nueva asignación
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ArrowLeftRight className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No hay asignaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => (
            <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-900">{getItemName(a.material_item_id)}</span>
                  <span className="text-gray-400 text-sm">→</span>
                  <span className="text-sm text-gray-700">{getTeamName(a.team_id)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status]}`}>
                    {STATUS_LABELS[a.status]}
                  </span>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-gray-500">
                  <span>Cantidad: <strong>{a.quantity}</strong></span>
                  <span>Asignado: {a.assigned_date ? format(new Date(a.assigned_date), "dd/MM/yyyy") : "—"}</span>
                  {a.return_date && <span>Devuelto: {format(new Date(a.return_date), "dd/MM/yyyy")}</span>}
                </div>
                {a.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{a.notes}</p>}
              </div>
              {a.status === "activo" && (
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-green-700 gap-1" onClick={() => updateMutation.mutate({ id: a.id, data: { status: "devuelto", return_date: new Date().toISOString().split("T")[0] } })}>
                    <Undo2 className="w-3.5 h-3.5" /> Devuelto
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600 gap-1" onClick={() => updateMutation.mutate({ id: a.id, data: { status: "perdido" } })}>
                    <XCircle className="w-3.5 h-3.5" /> Perdido
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => !v && setShowForm(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nueva asignación de material</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Material *</Label>
              <Select value={form.material_item_id} onValueChange={v => setForm({ ...form, material_item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar material..." /></SelectTrigger>
                <SelectContent>
                  {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name} (disp: {i.available_quantity ?? 0})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Equipo *</Label>
              <Select value={form.team_id} onValueChange={v => setForm({ ...form, team_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar equipo..." /></SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cantidad *</Label>
                <Input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
              </div>
              <div>
                <Label>Fecha asignación</Label>
                <Input type="date" value={form.assigned_date} onChange={e => setForm({ ...form, assigned_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={!form.material_item_id || !form.team_id || !form.quantity || saveMutation.isPending}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}