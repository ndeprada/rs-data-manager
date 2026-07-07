import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle, XCircle, Activity, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

function getStatus(r) {
  if (r.status) return r.status;
  if (r.attended === false) return "absent";
  return "present";
}

const STATUS_CONFIG = {
  present: { label: "Presente",        icon: CheckCircle, iconClass: "text-green-500",  badge: "bg-green-50 text-green-700" },
  apart:   { label: "Trabajo a parte", icon: Activity,    iconClass: "text-blue-500",   badge: "bg-blue-50 text-blue-700" },
  absent:  { label: "Ausente",         icon: XCircle,     iconClass: "text-red-400",    badge: "bg-red-50 text-red-600" },
};

const ABSENCE_REASONS = {
  lesion:   "Lesión",
  enfermo:  "Enfermedad",
  clase:    "Clase",
  examen:   "Examen",
  viaje:    "Viaje",
  familiar: "Motivo familiar",
  permiso:  "Permiso",
  otro:     "Otro",
};

const emptyForm = { date: "", status: "present", absence_reason: "", notes: "" };

export default function AttendanceSection({ playerId }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", playerId],
    queryFn: () => base44.entities.TrainingAttendance.filter({ player_id: playerId }, "-date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TrainingAttendance.create({ ...data, player_id: playerId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["attendance", playerId] }); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TrainingAttendance.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["attendance", playerId] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TrainingAttendance.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["attendance", playerId] }); setDeleteId(null); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditingItem(null); setForm(emptyForm); };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      date: item.date || "",
      status: getStatus(item),
      absence_reason: item.absence_reason || "",
      notes: item.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      attended: form.status !== "absent",
      justified: form.status === "apart" || !!form.absence_reason,
      absence_reason: form.status === "absent" ? form.absence_reason : undefined,
    };
    if (editingItem) updateMutation.mutate({ id: editingItem.id, data });
    else createMutation.mutate(data);
  };

  const total = records.length;
  const presentCount = records.filter((r) => getStatus(r) === "present").length;
  const apartCount = records.filter((r) => getStatus(r) === "apart").length;
  const absentCount = records.filter((r) => getStatus(r) === "absent").length;
  const pct = total > 0 ? Math.round(((presentCount + apartCount) / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total sesiones", value: total },
          { label: "Presente", value: presentCount },
          { label: "Trabajo a parte", value: apartCount },
          { label: "% Participación", value: `${pct}%` },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600 font-medium">Tasa de participación</span>
            <span className="font-bold text-gray-900">{pct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
            <div className="h-full rounded-l-full transition-all bg-green-500" style={{ width: `${total > 0 ? (presentCount / total) * 100 : 0}%` }} />
            <div className="h-full transition-all bg-blue-400" style={{ width: `${total > 0 ? (apartCount / total) * 100 : 0}%` }} />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Presente</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Trabajo a parte</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block" />Ausente ({absentCount})</span>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Registro de Asistencia</h3>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="text-white" style={{ background: "var(--granate)" }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Añadir
          </Button>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay registros de asistencia</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {records.map((r) => {
              const st = getStatus(r);
              const cfg = STATUS_CONFIG[st];
              const Icon = cfg.icon;
              return (
                <div key={r.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                  <Icon className={`w-5 h-5 shrink-0 ${cfg.iconClass}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">
                      {new Date(r.date).toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-0.5">
                      {st === "absent" && r.absence_reason && (
                        <span className="text-xs text-gray-500">{ABSENCE_REASONS[r.absence_reason] || r.absence_reason}</span>
                      )}
                      {r.notes && <span className="text-xs text-gray-400 italic">{r.notes}</span>}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">{editingItem ? "Editar Registro" : "Registrar Asistencia"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700">Fecha *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="border-gray-200" />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700">Estado</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "present", label: "Presente",        color: "border-green-400 bg-green-50 text-green-700" },
                  { value: "apart",   label: "Trabajo a parte", color: "border-blue-400 bg-blue-50 text-blue-700" },
                  { value: "absent",  label: "Ausente",         color: "border-red-400 bg-red-50 text-red-600" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, status: opt.value, absence_reason: "" })}
                    className={`py-2.5 px-2 rounded-xl border-2 text-xs font-semibold text-center transition-all ${
                      form.status === opt.value ? opt.color : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {form.status === "absent" && (
              <div className="space-y-2">
                <Label className="text-gray-700">Motivo de la ausencia</Label>
                <Select value={form.absence_reason} onValueChange={(v) => setForm({ ...form, absence_reason: v })}>
                  <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar motivo" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ABSENCE_REASONS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.status === "apart" && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-700">
                El jugador asistió pero trabajó de forma diferenciada (fisio, preparador físico, recuperación…)
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-gray-700">Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-gray-200" rows={2} placeholder="Observaciones opcionales..." />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" className="text-white" style={{ background: "var(--granate)" }}>{editingItem ? "Guardar" : "Registrar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
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