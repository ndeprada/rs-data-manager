import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ROLES = [
  { value: "entrenador", label: "Entrenador" },
  { value: "ayudante", label: "Ayudante" },
  { value: "preparador_fisico", label: "Preparador Físico" },
  { value: "portero_coach", label: "Entrenador de Porteros" },
  { value: "medico", label: "Médico" },
  { value: "fisioterapeuta", label: "Fisioterapeuta" },
  { value: "coordinador", label: "Coordinador" },
  { value: "otro", label: "Otro" },
];

const emptyForm = { first_name: "", last_name: "", role: "", phone: "", email: "", notes: "" };

export default function AddStaffDialog({ open, onOpenChange, teamId, editingStaff, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (editingStaff) {
      setForm({
        first_name: editingStaff.first_name || "",
        last_name: editingStaff.last_name || "",
        role: editingStaff.role || "",
        phone: editingStaff.phone || "",
        email: editingStaff.email || "",
        notes: editingStaff.notes || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [editingStaff, open]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.StaffMember.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      onOpenChange(false);
      onCreated?.(created);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.StaffMember.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff"] }); onOpenChange(false); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form, team_id: teamId };
    if (editingStaff) {
      updateMutation.mutate({ id: editingStaff.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-gray-900">{editingStaff ? "Editar Miembro" : "Añadir Cuerpo Técnico"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700">Nombre *</Label>
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required className="border-gray-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Apellidos *</Label>
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required className="border-gray-200" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">Rol *</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700">Teléfono</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="border-gray-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border-gray-200" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">Notas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-gray-200" rows={2} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="text-white" style={{ background: "var(--granate)" }}>
              {editingStaff ? "Guardar" : "Añadir"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
