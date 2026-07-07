import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function skillColor(v) {
  if (!v) return "#e5e7eb";
  if (v <= 3) return "#ef4444";
  if (v <= 5) return "#f97316";
  if (v <= 7) return "#eab308";
  return "#22c55e";
}

const SKILLS = [
  { key: "skill_technical", label: "Técnica" },
  { key: "skill_physical",  label: "Física" },
  { key: "skill_tactical",  label: "Táctica" },
  { key: "skill_mental",    label: "Mental" },
  { key: "skill_attack",    label: "Ataque" },
  { key: "skill_defense",   label: "Defensa" },
];

const EMPTY_FORM = {
  season: "", club: "", category: "", team_name: "", position: "",
  matches_played: "", goals: "", assists: "", avg_rating: "",
  skill_technical: "", skill_physical: "", skill_tactical: "",
  skill_mental: "", skill_attack: "", skill_defense: "",
  decision: "seguir_viendo", notes: "",
};

export default function PlayerSeasonHistoryTab({ playerId }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: seasons = [] } = useQuery({
    queryKey: ["scouting_seasons", playerId],
    queryFn: () => base44.entities.ScoutingSeasonHistory.filter({ player_id: playerId }),
    enabled: !!playerId,
  });

  const sorted = [...seasons].sort((a, b) => b.season?.localeCompare(a.season || "") || 0);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ScoutingSeasonHistory.create({ ...data, player_id: playerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouting_seasons", playerId] });
      setFormOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Temporada añadida." });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScoutingSeasonHistory.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouting_seasons", playerId] });
      setFormOpen(false);
      setEditing(null);
      toast({ title: "Temporada actualizada." });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScoutingSeasonHistory.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouting_seasons", playerId] });
      setDeleteId(null);
      toast({ title: "Temporada eliminada." });
    },
  });

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (s) => {
    setEditing(s.id);
    setForm({
      season: s.season || "", club: s.club || "", category: s.category || "",
      team_name: s.team_name || "", position: s.position || "",
      matches_played: s.matches_played ?? "", goals: s.goals ?? "", assists: s.assists ?? "",
      avg_rating: s.avg_rating ?? "",
      skill_technical: s.skill_technical ?? "", skill_physical: s.skill_physical ?? "",
      skill_tactical: s.skill_tactical ?? "", skill_mental: s.skill_mental ?? "",
      skill_attack: s.skill_attack ?? "", skill_defense: s.skill_defense ?? "",
      decision: s.decision || "seguir_viendo", notes: s.notes || "",
    });
    setFormOpen(true);
  };

  const handleSave = () => {
    const data = {
      ...form,
      matches_played: form.matches_played !== "" ? Number(form.matches_played) : null,
      goals: form.goals !== "" ? Number(form.goals) : null,
      assists: form.assists !== "" ? Number(form.assists) : null,
      avg_rating: form.avg_rating !== "" ? Number(form.avg_rating) : null,
      ...Object.fromEntries(SKILLS.map(s => [s.key, form[s.key] !== "" ? Number(form[s.key]) : null])),
    };
    if (editing) updateMutation.mutate({ id: editing, data });
    else createMutation.mutate(data);
  };

  const chartData = sorted
    .filter(s => s.avg_rating)
    .map(s => ({ season: s.season, rating: s.avg_rating }))
    .reverse();

  const decisionClasses = {
    fichar: "bg-green-50 text-green-700 border-green-200",
    seguir_viendo: "bg-blue-50 text-blue-700 border-blue-200",
    descartar: "bg-gray-100 text-gray-500 border-gray-200",
  };
  const decisionLabels = { fichar: "Fichar", seguir_viendo: "Seguir viendo", descartar: "Descartar" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
          {seasons.length} temporada{seasons.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={openNew} className="text-white" style={{ background: "var(--granate)" }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Añadir temporada
        </Button>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1" style={{ fontFamily: "var(--font-display)" }}>
            <TrendingUp className="w-3.5 h-3.5" /> Evolución valoración media
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="season" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `${v}/5`} />
              <Line type="monotone" dataKey="rating" stroke="#8B1A2B" strokeWidth={2} dot={{ fill: "#8B1A2B", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* List */}
      {sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No hay historial de temporadas</div>
      ) : (
        <div className="space-y-2">
          {sorted.map(s => {
            const isOpen = expanded === s.id;
            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>{s.season}</span>
                      {s.club && <span className="text-sm text-gray-600">{s.club}</span>}
                      {s.category && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{s.category}</span>}
                      {s.decision && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${decisionClasses[s.decision]}`}>{decisionLabels[s.decision]}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 mt-1">
                      {s.position && <span>📍 {s.position}</span>}
                      {s.matches_played != null && <span>⚽ {s.matches_played} partidos</span>}
                      {s.goals != null && <span>🥅 {s.goals} goles</span>}
                      {s.assists != null && <span>🎯 {s.assists} asist.</span>}
                      {s.avg_rating != null && <span className="font-semibold" style={{ color: "var(--granate)" }}>★ {s.avg_rating}/5</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setExpanded(isOpen ? null : s.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-gray-50">
                    {SKILLS.some(sk => s[sk.key]) && (
                      <div className="space-y-2">
                        {SKILLS.map(sk => {
                          const v = s[sk.key] || 0;
                          return (
                            <div key={sk.key} className="flex items-center gap-3">
                              <span className="text-xs text-gray-500 w-20 shrink-0">{sk.label}</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div className="h-2 rounded-full transition-all" style={{ width: `${v * 10}%`, background: skillColor(v) }} />
                              </div>
                              <span className="text-xs font-bold w-10 text-right" style={{ color: skillColor(v) }}>{v}/10</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {s.notes && <p className="text-sm text-gray-600">{s.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
              {editing ? "Editar temporada" : "Nueva temporada"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Temporada *</Label><Input value={form.season} onChange={e => set("season", e.target.value)} placeholder="2024-2025" /></div>
              <div><Label className="text-xs">Club</Label><Input value={form.club} onChange={e => set("club", e.target.value)} /></div>
              <div><Label className="text-xs">Categoría</Label><Input value={form.category} onChange={e => set("category", e.target.value)} placeholder="Sub-14" /></div>
              <div><Label className="text-xs">Nombre equipo</Label><Input value={form.team_name} onChange={e => set("team_name", e.target.value)} /></div>
              <div><Label className="text-xs">Posición</Label><Input value={form.position} onChange={e => set("position", e.target.value)} /></div>
              <div>
                <Label className="text-xs">Decisión</Label>
                <Select value={form.decision} onValueChange={v => set("decision", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seguir_viendo">Seguir viendo</SelectItem>
                    <SelectItem value="fichar">Fichar</SelectItem>
                    <SelectItem value="descartar">Descartar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Partidos jugados</Label><Input type="number" value={form.matches_played} onChange={e => set("matches_played", e.target.value)} /></div>
              <div><Label className="text-xs">Goles</Label><Input type="number" value={form.goals} onChange={e => set("goals", e.target.value)} /></div>
              <div><Label className="text-xs">Asistencias</Label><Input type="number" value={form.assists} onChange={e => set("assists", e.target.value)} /></div>
              <div><Label className="text-xs">Valoración media (1-5)</Label><Input type="number" min="0" max="5" step="0.1" value={form.avg_rating} onChange={e => set("avg_rating", e.target.value)} /></div>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Habilidades (1-10)</p>
            <div className="grid grid-cols-2 gap-3">
              {SKILLS.map(sk => (
                <div key={sk.key}><Label className="text-xs">{sk.label}</Label><Input type="number" min="0" max="10" value={form[sk.key]} onChange={e => set(sk.key, e.target.value)} /></div>
              ))}
            </div>
            <div><Label className="text-xs">Notas / Resumen</Label><Textarea rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => { setFormOpen(false); setEditing(null); }} className="flex-1">Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={!form.season || createMutation.isPending || updateMutation.isPending}
                className="flex-1 text-white" style={{ background: "var(--granate)" }}
              >
                {createMutation.isPending || updateMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar temporada?</AlertDialogTitle>
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