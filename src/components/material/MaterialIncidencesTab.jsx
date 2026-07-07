import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";

const TYPE_LABELS = { daño: "Daño", perdida: "Pérdida", rotura: "Rotura", desgaste: "Desgaste", otro: "Otro" };
const SEVERITY_COLORS = {
  leve: "bg-yellow-100 text-yellow-700",
  moderada: "bg-orange-100 text-orange-700",
  grave: "bg-red-100 text-red-700",
};
const STATUS_LABELS = { abierta: "Abierta", en_gestion: "En gestión", resuelta: "Resuelta", baja: "Baja" };
const STATUS_COLORS = {
  abierta: "bg-red-100 text-red-700",
  en_gestion: "bg-amber-100 text-amber-700",
  resuelta: "bg-green-100 text-green-700",
  baja: "bg-gray-100 text-gray-500",
};

const EMPTY_FORM = {
  material_item_id: "", team_id: "", type: "daño", severity: "leve",
  description: "", reported_by: "", date: new Date().toISOString().split("T")[0],
  status: "abierta", resolution_notes: "", quantity_affected: 1,
};

export default function MaterialIncidencesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [resolving, setResolving] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState("abierta");

  const { data: incidences = [] } = useQuery({
    queryKey: ["material_incidences"],
    queryFn: () => base44.entities.MaterialIncidence.list("-date"),
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
    mutationFn: (data) => base44.entities.MaterialIncidence.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material_incidences"] });
      setShowForm(false);
      setForm(EMPTY_FORM);
      toast({ title: "Incidencia registrada" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MaterialIncidence.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material_incidences"] });
      setResolving(null);
      setResolutionNote("");
      toast({ title: "Incidencia actualizada" });
    },
  });

  const getItemName = (id) => items.find(i => i.id === id)?.name || "—";
  const getTeamName = (id) => teams.find(t => t.id === id)?.name || null;

  const filtered = filterStatus === "all" ? incidences : incidences.filter(i => i.status === filterStatus);

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate({ ...form, quantity_affected: Number(form.quantity_affected) });
  };

  const handleResolve = () => {
    updateMutation.mutate({ id: resolving, data: { status: "resuelta", resolution_notes: resolutionNote } });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="abierta">Abiertas</SelectItem>
            <SelectItem value="en_gestion">En gestión</SelectItem>
            <SelectItem value="resuelta">Resueltas</SelectItem>
            <SelectItem value="baja">Baja</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Registrar incidencia
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No hay incidencias {filterStatus !== "all" ? STATUS_LABELS[filterStatus]?.toLowerCase() + "s" : ""}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inc => (
            <div key={inc.id} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-gray-900">{getItemName(inc.material_item_id)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[inc.severity]}`}>
                      {inc.severity}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inc.status]}`}>
                      {STATUS_LABELS[inc.status]}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{TYPE_LABELS[inc.type]}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-1">
                    {getTeamName(inc.team_id) && <span>Equipo: {getTeamName(inc.team_id)}</span>}
                    <span>Fecha: {inc.date ? format(new Date(inc.date), "dd/MM/yyyy") : "—"}</span>
                    {inc.quantity_affected > 1 && <span>Afectados: {inc.quantity_affected}</span>}
                    {inc.reported_by && <span>Reportado por: {inc.reported_by}</span>}
                  </div>
                  {inc.description && <p className="text-xs text-gray-600">{inc.description}</p>}
                  {inc.resolution_notes && <p className="text-xs text-green-700 mt-1 italic">✓ {inc.resolution_notes}</p>}
                </div>
                {(inc.status === "abierta" || inc.status === "en_gestion") && (
                  <div className="flex gap-1 shrink-0">
                    {inc.status === "abierta" && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-700" onClick={() => updateMutation.mutate({ id: inc.id, data: { status: "en_gestion" } })}>
                        En gestión
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-green-700 gap-1" onClick={() => { setResolving(inc.id); setResolutionNote(""); }}>
                      <CheckCircle className="w-3.5 h-3.5" /> Resolver
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      <Dialog open={showForm} onOpenChange={v => !v && setShowForm(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar incidencia</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Material *</Label>
              <Select value={form.material_item_id} onValueChange={v => setForm({ ...form, material_item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar material..." /></SelectTrigger>
                <SelectContent>
                  {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gravedad</Label>
                <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leve">Leve</SelectItem>
                    <SelectItem value="moderada">Moderada</SelectItem>
                    <SelectItem value="grave">Grave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Equipo (opcional)</Label>
                <Select value={form.team_id} onValueChange={v => setForm({ ...form, team_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Sin equipo</SelectItem>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad afectada</Label>
                <Input type="number" min="1" value={form.quantity_affected} onChange={e => setForm({ ...form, quantity_affected: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>Reportado por</Label>
                <Input value={form.reported_by} onChange={e => setForm({ ...form, reported_by: e.target.value })} placeholder="Nombre" />
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={!form.material_item_id || saveMutation.isPending}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Resolve dialog */}
      <Dialog open={!!resolving} onOpenChange={v => !v && setResolving(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Resolver incidencia</DialogTitle></DialogHeader>
          <div>
            <Label>Notas de resolución</Label>
            <Textarea value={resolutionNote} onChange={e => setResolutionNote(e.target.value)} rows={3} placeholder="Describe cómo se resolvió..." />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setResolving(null)}>Cancelar</Button>
            <Button onClick={handleResolve} disabled={updateMutation.isPending}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}