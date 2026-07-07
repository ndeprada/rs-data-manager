import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Package, Edit, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const CATEGORIES = {
  balon: "Balón",
  peto: "Peto",
  cono: "Cono",
  porterias: "Portería",
  ropa: "Ropa",
  equipacion: "Equipación",
  medico: "Material médico",
  electronico: "Electrónico",
  otro: "Otro",
};

const CATEGORY_COLORS = {
  balon: "bg-orange-100 text-orange-700",
  peto: "bg-yellow-100 text-yellow-700",
  cono: "bg-red-100 text-red-700",
  porterias: "bg-blue-100 text-blue-700",
  ropa: "bg-purple-100 text-purple-700",
  equipacion: "bg-indigo-100 text-indigo-700",
  medico: "bg-green-100 text-green-700",
  electronico: "bg-gray-100 text-gray-700",
  otro: "bg-gray-100 text-gray-600",
};

const CONDITION_COLORS = {
  bueno: "bg-green-100 text-green-700",
  regular: "bg-yellow-100 text-yellow-700",
  malo: "bg-red-100 text-red-700",
  baja: "bg-gray-100 text-gray-500",
};

const CONDITION_LABELS = {
  bueno: "Bueno",
  regular: "Regular",
  malo: "Malo",
  baja: "Baja",
};

const EMPTY_FORM = { name: "", category: "balon", total_quantity: "", available_quantity: "", condition: "bueno", notes: "" };

export default function MaterialInventoryTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterCategory, setFilterCategory] = useState("all");
  const [deleteId, setDeleteId] = useState(null);

  const { data: items = [] } = useQuery({
    queryKey: ["material_items"],
    queryFn: () => base44.entities.MaterialItem.list(),
  });

  const { data: incidences = [] } = useQuery({
    queryKey: ["material_incidences"],
    queryFn: () => base44.entities.MaterialIncidence.filter({ status: "abierta" }),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.MaterialItem.update(editing.id, data)
      : base44.entities.MaterialItem.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material_items"] });
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast({ title: editing ? "Material actualizado" : "Material añadido" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MaterialItem.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material_items"] });
      setDeleteId(null);
      toast({ title: "Material eliminado" });
    },
  });

  const openEdit = (item) => {
    setEditing(item);
    setForm({ name: item.name, category: item.category, total_quantity: item.total_quantity ?? "", available_quantity: item.available_quantity ?? "", condition: item.condition || "bueno", notes: item.notes || "" });
    setShowForm(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate({ ...form, total_quantity: Number(form.total_quantity), available_quantity: Number(form.available_quantity) });
  };

  const getOpenIncidences = (itemId) => incidences.filter(i => i.material_item_id === itemId).length;

  const filtered = filterCategory === "all" ? items : items.filter(i => i.category === filterCategory);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Añadir material
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No hay material registrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(item => {
            const openInc = getOpenIncidences(item.id);
            return (
              <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category] || "bg-gray-100 text-gray-600"}`}>
                        {CATEGORIES[item.category] || item.category}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONDITION_COLORS[item.condition] || "bg-gray-100"}`}>
                        {CONDITION_LABELS[item.condition] || item.condition}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                      <Edit className="w-3.5 h-3.5 text-gray-400" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteId(item.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-600 border-t pt-2">
                  <div>
                    <span className="text-gray-400">Total</span>
                    <p className="font-bold text-base text-gray-900 leading-tight">{item.total_quantity ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Disponible</span>
                    <p className={`font-bold text-base leading-tight ${(item.available_quantity ?? 0) === 0 ? "text-red-500" : "text-green-600"}`}>
                      {item.available_quantity ?? 0}
                    </p>
                  </div>
                  {openInc > 0 && (
                    <div className="ml-auto flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="font-semibold">{openInc} incidencia{openInc > 1 ? "s" : ""}</span>
                    </div>
                  )}
                </div>

                {item.notes && <p className="text-xs text-gray-500 italic">{item.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar material" : "Añadir material"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Balón de entrenamiento" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.condition} onValueChange={v => setForm({ ...form, condition: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONDITION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cantidad total</Label>
                <Input type="number" min="0" value={form.total_quantity} onChange={e => setForm({ ...form, total_quantity: e.target.value })} placeholder="0" />
              </div>
              <div>
                <Label>Cantidad disponible</Label>
                <Input type="number" min="0" value={form.available_quantity} onChange={e => setForm({ ...form, available_quantity: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>¿Eliminar material?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteId)}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}