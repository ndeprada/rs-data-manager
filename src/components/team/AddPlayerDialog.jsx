import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COUNTRIES, PROVINCES, regionOfProvince, countryOf } from "@/lib/countries";
import { getRoleOptions, findRole } from "@/lib/competencyCatalog";
import { LEVELS, EXTRA_LEVELS, getExtraPositions } from "@/lib/playerPositions";
import { Plus, X } from "lucide-react";

const POSITIONS = [
  { value: "portero", label: "Portero" },
  { value: "lateral", label: "Lateral" },
  { value: "central", label: "Central" },
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
  first_name: "", last_name: "", nickname: "", birth_date: "", birth_year: "", position: "", reference_role: "", extra_positions: [],
  laterality: "", nationality: "", region: "", birth_province: "", birth_place: "", jersey_number: "", phone: "", email: "", status: "activo", team_id: "",
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
        nickname: editingPlayer.nickname || "",
        birth_date: editingPlayer.birth_date || "",
        birth_year: editingPlayer.birth_year || (editingPlayer.birth_date ? String(editingPlayer.birth_date).slice(0, 4) : ""),
        position: editingPlayer.position || "",
        reference_role: editingPlayer.reference_role || "",
        extra_positions: getExtraPositions(editingPlayer).map((e) => ({ position: e.position, role: e.role || "", level: e.level === "competente" ? "competente" : "secundaria" })),
        laterality: editingPlayer.laterality || "",
        nationality: countryOf(editingPlayer)?.a3 || "",
        region: editingPlayer.region || "",
        birth_province: editingPlayer.birth_province || "",
        birth_place: editingPlayer.birth_place || "",
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
    const extras = (form.extra_positions || []).filter((e) => e.position && !(e.position === form.position && (e.role || "") === (form.reference_role || "")));
    const data = { ...form, extra_positions: extras, secondary_position: extras[0]?.position || "", birth_year: form.birth_year ? Number(form.birth_year) : null, birth_date: form.birth_date || null, team_id: form.team_id || teamId, jersey_number: form.jersey_number ? Number(form.jersey_number) : undefined };
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
          <div className="space-y-1">
            <Label className="text-gray-700">Apodo <span className="text-gray-400 font-normal">(opcional)</span></Label>
            <Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className="border-gray-200" />
            <p className="text-[11px] text-gray-400">Se muestra en la app en lugar del nombre. El nombre y apellidos oficiales (FCF) no cambian.</p>
          </div>
          <div className="space-y-3 rounded-md border border-gray-200 p-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: LEVELS.natural.color }} />
              <Label className="text-gray-700">Posición natural (principal)</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v, reference_role: "" })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder="Posición" /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {getRoleOptions(form.position).length > 0 ? (
                <Select value={form.reference_role} onValueChange={(v) => setForm({ ...form, reference_role: v })}>
                  <SelectTrigger className="border-gray-200"><SelectValue placeholder="Rol" /></SelectTrigger>
                  <SelectContent>
                    {getRoleOptions(form.position).map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : <div />}
            </div>
            {form.reference_role && <p className="text-xs text-gray-500">{findRole(form.reference_role)?.role.description}</p>}

            <div className="pt-1 space-y-2">
              <Label className="text-gray-700">Otras posiciones <span className="text-gray-400 font-normal">(verde claro = secundaria · naranja = competente)</span></Label>
              {(form.extra_positions || []).map((e, idx) => {
                const upd = (patch) => setForm({ ...form, extra_positions: form.extra_positions.map((x, i) => (i === idx ? { ...x, ...patch } : x)) });
                const roles = getRoleOptions(e.position);
                return (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                    <Select value={e.position} onValueChange={(v) => upd({ position: v, role: "" })}>
                      <SelectTrigger className="border-gray-200"><SelectValue placeholder="Posición" /></SelectTrigger>
                      <SelectContent>{POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {roles.length > 0 ? (
                      <Select value={e.role} onValueChange={(v) => upd({ role: v })}>
                        <SelectTrigger className="border-gray-200"><SelectValue placeholder="Rol" /></SelectTrigger>
                        <SelectContent>{roles.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <div />}
                    <Select value={e.level} onValueChange={(v) => upd({ level: v })}>
                      <SelectTrigger className="border-gray-200 w-[130px]">
                        <span className="w-2.5 h-2.5 rounded-full mr-1.5 shrink-0" style={{ background: LEVELS[e.level]?.color }} /><SelectValue />
                      </SelectTrigger>
                      <SelectContent>{EXTRA_LEVELS.map((l) => <SelectItem key={l} value={l}>{LEVELS[l].label}</SelectItem>)}</SelectContent>
                    </Select>
                    <button type="button" aria-label="Quitar posición" onClick={() => setForm({ ...form, extra_positions: form.extra_positions.filter((_, i) => i !== idx) })} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              <button type="button" onClick={() => setForm({ ...form, extra_positions: [...(form.extra_positions || []), { position: "", role: "", level: "secundaria" }] })}
                className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--granate)" }}>
                <Plus className="w-3.5 h-3.5" /> Añadir posición
              </button>
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
            <Label className="text-gray-700">Nacionalidad</Label>
            <Select value={form.nationality || "none"} onValueChange={(v) => setForm({ ...form, nationality: v === "none" ? "" : v, region: v === "ESP" ? form.region : "", birth_province: v === "ESP" ? form.birth_province : "" })}>
              <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">Sin indicar</SelectItem>
                {COUNTRIES.map((c) => <SelectItem key={c.a3} value={c.a3}>{c.name} ({c.a3})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.nationality && (
            <div className="grid grid-cols-2 gap-4">
              {form.nationality === "ESP" && (
                <div className="space-y-2">
                  <Label className="text-gray-700">Provincia de nacimiento</Label>
                  <Select value={form.birth_province || "none"} onValueChange={(v) => { const p = v === "none" ? "" : v; setForm({ ...form, birth_province: p, region: regionOfProvince(p) }); }}>
                    <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="none">Sin indicar</SelectItem>
                      {PROVINCES.map((p) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className={`space-y-2 ${form.nationality === "ESP" ? "" : "col-span-2"}`}>
                <Label className="text-gray-700">Ciudad / municipio</Label>
                <Input value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} className="border-gray-200" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700">Año de nacimiento</Label>
              <Input type="number" min="1980" max="2030" placeholder="2009" value={form.birth_year}
                onChange={(e) => setForm({ ...form, birth_year: e.target.value })} className="border-gray-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Fecha completa <span className="text-gray-400 font-normal">(opcional)</span></Label>
              <Input type="date" value={form.birth_date || ""}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value, birth_year: e.target.value ? e.target.value.slice(0, 4) : form.birth_year })} className="border-gray-200" />
            </div>
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