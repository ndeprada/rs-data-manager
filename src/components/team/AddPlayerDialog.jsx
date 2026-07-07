import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const POSITIONS = [
  { value: "portero", label: "Portero" },
  { value: "lateral", label: "Lateral" },
  { value: "central", label: "Central" },
  { value: "libre", label: "Libre" },
  { value: "mediocentro", label: "Mediocentro" },
  { value: "interior", label: "Interior" },
  { value: "delantero_centro", label: "Delantero Centro" },
  { value: "extremo", label: "Extremo" },
];

const LATERALITY = [
  { value: "diestro", label: "Diestro" },
  { value: "zurdo", label: "Zurdo" },
  { value: "ambidiestro", label: "Ambidiestro" },
];

const emptyForm = {
  first_name: "", last_name: "", birth_date: "", position: "", secondary_position: "",
  laterality: "", jersey_number: "", phone: "", email: "", status: "activo", team_id: "",
};

export default function AddPlayerDialog({ open, onOpenChange, teamId, editingPlayer }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });

  useEffect(() => {
    if (editingPlayer) {
      setForm({
        first_name: editingPlayer.first_name || "",
        last_name: editingPlayer.last_name || "",
        birth_date: editingPlayer.birth_date || "",
        position: editingPlayer.position || "",
        secondary_position: editingPlayer.secondary_position || "",
        laterality: editingPlayer.laterality || "",
        jersey_number: editingPlayer.jersey_number || "",
        phone: editingPlayer.phone || "",
        email: editingPlayer.email || "",
        status: editingPlayer.status || "activo",
        team_id: editingPlayer.team_id || "",
      });
    } else {
      setForm({ ...emptyForm, team_id: teamId || "" });
    }
  }, [editingPlayer, open, teamId]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Player.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["players"] }); onOpenChange(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Player.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["players"] }); onOpenChange(false); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form, team_id: form.team_id || teamId, jersey_number: form.jersey_number ? Number(form.jersey_number) : undefined };
    if (editingPlayer) {
      updateMutation.mutate({ id: editingPlayer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900">{editingPlayer ? "Editar Jugador" : "Añadir Jugador"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!teamId && (
            <div className="space-y-2">
              <Label className="text-gray-700">Equipo *</Label>
              <Select value={form.team_id} onValueChange={v => setForm({ ...form, team_id: v })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar equipo" /></SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700">Posición principal</Label>
              <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Posición secundaria</Label>
              <Select value={form.secondary_position} onValueChange={(v) => setForm({ ...form, secondary_position: v })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700">Lateralidad</Label>
              <Select value={form.laterality} onValueChange={(v) => setForm({ ...form, laterality: v })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {LATERALITY.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Dorsal</Label>
              <Input type="number" value={form.jersey_number} onChange={(e) => setForm({ ...form, jersey_number: e.target.value })} className="border-gray-200" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">Fecha de nacimiento</Label>
            <Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} className="border-gray-200" />
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
            <Label className="text-gray-700">Estado</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="lesionado">Lesionado</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="text-white" style={{ background: "var(--granate)" }}>
              {editingPlayer ? "Guardar" : "Añadir"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}