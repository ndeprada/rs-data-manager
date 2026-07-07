import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, MapPin, Lightbulb, Home, CheckCircle2, XCircle, Layers, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useTeamAccess } from "@/lib/TeamAccessContext";

const SURFACE_LABELS = {
  cesped_natural: "Césped natural",
  cesped_artificial: "Césped artificial",
  futsal: "Futsal",
  sala_polideportiva: "Sala polideportiva",
  pabellon: "Pabellón",
  pista_atletismo: "Pista atletismo",
  otro: "Otro",
};

const FORMAT_LABELS = {
  f11: "F11",
  f7: "F7",
  f5: "F5",
  f3: "F3",
  multiusos: "Multiusos",
};

const SURFACE_COLORS = {
  cesped_natural: "#16a34a",
  cesped_artificial: "#15803d",
  futsal: "#2563eb",
  sala_polideportiva: "#7c3aed",
  pabellon: "#7c3aed",
  pista_atletismo: "#ea580c",
  otro: "#64748b",
};

const emptyForm = {
  name: "", type: "cesped_artificial", format: "f11",
  location: "", capacity: "", lighting: false, indoor: false,
  available: true, notes: "", google_maps_url: "",
};

export default function Fields() {
  const qc = useQueryClient();
  const { isCoordinator } = useTeamAccess();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["fields"],
    queryFn: () => base44.entities.Field.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Field.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fields"] }); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Field.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fields"] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Field.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fields"] }); setDeleteId(null); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditingField(null); setForm(emptyForm); };

  const openNew = () => { setForm(emptyForm); setEditingField(null); setDialogOpen(true); };

  const openEdit = (field) => {
    setEditingField(field);
    setForm({
      name: field.name || "",
      type: field.type || "cesped_artificial",
      format: field.format || "f11",
      location: field.location || "",
      capacity: field.capacity || "",
      lighting: field.lighting ?? false,
      indoor: field.indoor ?? false,
      available: field.available ?? true,
      notes: field.notes || "",
      google_maps_url: field.google_maps_url || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form, capacity: form.capacity ? Number(form.capacity) : null };
    if (editingField) {
      updateMutation.mutate({ id: editingField.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (!isCoordinator) return (
    <div className="text-center py-20 text-gray-400">
      <Layers className="w-10 h-10 mx-auto mb-3 text-gray-200" />
      <p>Solo coordinadores y administradores pueden acceder a esta sección.</p>
    </div>
  );

  const available = fields.filter(f => f.available !== false);
  const unavailable = fields.filter(f => f.available === false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Administración</p>
          <h1>Campos</h1>
          <p className="text-gray-400 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>
            Gestión de instalaciones y espacios de entrenamiento
          </p>
        </div>
        <Button onClick={openNew} className="text-white h-8 text-xs" style={{ background: "var(--granate)" }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo campo
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total instalaciones", value: fields.length, color: "var(--granate)" },
          { label: "Disponibles", value: available.length, color: "#16a34a" },
          { label: "No disponibles", value: unavailable.length, color: "#dc2626" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 text-center">
            <p className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color }}>{value}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mt-0.5" style={{ fontFamily: "var(--font-display)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Fields grid */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : fields.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-12 text-center">
          <Layers className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
            No hay campos registrados
          </p>
          <Button onClick={openNew} className="mt-4 text-white text-xs" style={{ background: "var(--granate)" }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Añadir primer campo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fields.map(field => {
            const surfaceColor = SURFACE_COLORS[field.type] || "#64748b";
            const isAvailable = field.available !== false;
            return (
              <div key={field.id} className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden"
                style={{ borderTop: `3px solid ${surfaceColor}` }}>
                {/* Header */}
                <div className="px-4 pt-3 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900 uppercase truncate" style={{ fontFamily: "var(--font-display)" }}>
                        {field.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {field.type && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm text-white"
                            style={{ fontFamily: "var(--font-display)", background: surfaceColor }}>
                            {SURFACE_LABELS[field.type] || field.type}
                          </span>
                        )}
                        {field.format && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-gray-100 text-gray-600 border border-gray-200"
                            style={{ fontFamily: "var(--font-display)" }}>
                            {FORMAT_LABELS[field.format] || field.format}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isAvailable ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" title="Disponible" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" title="No disponible" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="px-4 pb-3 space-y-1.5">
                  {field.location && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="truncate">{field.location}</span>
                      {field.google_maps_url && (
                        <a href={field.google_maps_url} target="_blank" rel="noopener noreferrer"
                          className="ml-auto shrink-0 text-blue-500 hover:text-blue-700">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {field.indoor && (
                      <span className="flex items-center gap-1">
                        <Home className="w-3 h-3" /> Cubierto
                      </span>
                    )}
                    {field.lighting && (
                      <span className="flex items-center gap-1">
                        <Lightbulb className="w-3 h-3 text-yellow-500" /> Iluminación
                      </span>
                    )}
                    {field.capacity && (
                      <span>{field.capacity} jugadores</span>
                    )}
                  </div>
                  {field.notes && (
                    <p className="text-[11px] text-gray-400 line-clamp-2 mt-1">{field.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="px-4 py-2 border-t border-gray-100 flex justify-end gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => openEdit(field)}
                    className="h-7 px-2 text-xs text-gray-600 border-gray-200">
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteId(field.id)}
                    className="h-7 px-2 text-xs text-red-500 border-red-200 hover:bg-red-50">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
              {editingField ? "Editar campo" : "Nuevo campo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-gray-700 text-xs font-bold uppercase tracking-wider">Nombre *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                required placeholder="Ej: Campo 1, Sala Polideportiva..." className="mt-1 border-gray-200" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-700 text-xs font-bold uppercase tracking-wider">Superficie</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger className="mt-1 border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SURFACE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-700 text-xs font-bold uppercase tracking-wider">Formato</Label>
                <Select value={form.format} onValueChange={v => setForm({ ...form, format: v })}>
                  <SelectTrigger className="mt-1 border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FORMAT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-gray-700 text-xs font-bold uppercase tracking-wider">Ubicación</Label>
              <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="Dirección o nombre del recinto" className="mt-1 border-gray-200" />
            </div>
            <div>
              <Label className="text-gray-700 text-xs font-bold uppercase tracking-wider">URL Google Maps</Label>
              <Input value={form.google_maps_url} onChange={e => setForm({ ...form, google_maps_url: e.target.value })}
                placeholder="https://maps.google.com/..." className="mt-1 border-gray-200" />
            </div>
            <div>
              <Label className="text-gray-700 text-xs font-bold uppercase tracking-wider">Capacidad (jugadores)</Label>
              <Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })}
                placeholder="Ej: 22" className="mt-1 border-gray-200" />
            </div>
            {/* Toggles */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "lighting", label: "Iluminación" },
                { key: "indoor", label: "Cubierto" },
                { key: "available", label: "Disponible" },
              ].map(({ key, label }) => (
                <button key={key} type="button"
                  onClick={() => setForm(prev => ({ ...prev, [key]: !prev[key] }))}
                  className={`flex flex-col items-center gap-1 py-2 rounded-md border text-xs font-bold uppercase transition-colors ${form[key] ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-400"}`}
                  style={{ fontFamily: "var(--font-display)" }}>
                  <span className="text-lg">{form[key] ? "✓" : "○"}</span>
                  {label}
                </button>
              ))}
            </div>
            <div>
              <Label className="text-gray-700 text-xs font-bold uppercase tracking-wider">Notas</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Horarios de acceso, vestuarios, contacto responsable..." className="mt-1 border-gray-200" rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" className="text-white" style={{ background: "var(--granate)" }}
                disabled={createMutation.isPending || updateMutation.isPending}>
                {editingField ? "Guardar" : "Crear campo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar campo?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}