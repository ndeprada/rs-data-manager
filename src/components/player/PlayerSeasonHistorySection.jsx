import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Pencil, Trash2, Trophy, Target, Clock, Activity, HeartPulse, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const EMPTY_FORM = {
  season: "", team_name: "", category: "",
  matches_played: 0, matches_starter: 0, matches_sub: 0, minutes_played: 0,
  goals: 0, assists: 0, yellow_cards: 0, red_cards: 0,
  training_sessions: 0, training_present: 0,
  injuries_count: 0, injuries_days: 0,
  avg_rating: "", notes: "",
};

export default function PlayerSeasonHistorySection({ playerId }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState(null);

  const { data: seasons = [], isLoading } = useQuery({
    queryKey: ["playerSeasonHistory", playerId],
    queryFn: () => base44.entities.PlayerSeasonHistory.filter({ player_id: playerId }),
    enabled: !!playerId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingRecord
      ? base44.entities.PlayerSeasonHistory.update(editingRecord.id, data)
      : base44.entities.PlayerSeasonHistory.create({ ...data, player_id: playerId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playerSeasonHistory", playerId] });
      setDialogOpen(false);
      setEditingRecord(null);
      setForm(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PlayerSeasonHistory.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playerSeasonHistory", playerId] });
      setDeleteId(null);
    },
  });

  const openNew = () => { setEditingRecord(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (r) => {
    setEditingRecord(r);
    setForm({
      season: r.season || "", team_name: r.team_name || "", category: r.category || "",
      matches_played: r.matches_played || 0, matches_starter: r.matches_starter || 0, matches_sub: r.matches_sub || 0,
      minutes_played: r.minutes_played || 0, goals: r.goals || 0, assists: r.assists || 0,
      yellow_cards: r.yellow_cards || 0, red_cards: r.red_cards || 0,
      training_sessions: r.training_sessions || 0, training_present: r.training_present || 0,
      injuries_count: r.injuries_count || 0, injuries_days: r.injuries_days || 0,
      avg_rating: r.avg_rating || "", notes: r.notes || "",
    });
    setDialogOpen(true);
  };

  const setF = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const setNum = (key, val) => setF(key, val === "" ? 0 : Number(val));

  // Sort: current season first, then descending
  const sorted = [...seasons].sort((a, b) => {
    if (a.is_current) return -1;
    if (b.is_current) return 1;
    return (b.season || "").localeCompare(a.season || "");
  });

  if (isLoading) return <div className="py-8 text-center text-gray-400 text-sm">Cargando historial...</div>;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
            {sorted.length} temporada{sorted.length !== 1 ? "s" : ""}
          </p>
          <Button size="sm" onClick={openNew} className="text-white text-xs h-8" style={{ background: "var(--granate)" }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Añadir temporada
          </Button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
          <Trophy className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>Sin historial registrado</p>
          {isAdmin && <p className="text-gray-300 text-xs mt-1">Usa el botón "Añadir temporada" para registrar la primera temporada</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((s) => {
            const attendancePct = s.training_sessions > 0 ? Math.round((s.training_present / s.training_sessions) * 100) : null;
            const team = teams.find(t => t.id === s.team_id);
            const teamName = s.team_name || team?.name || "—";

            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between gap-3 border-b border-gray-100"
                  style={{ background: s.is_current ? "linear-gradient(135deg, #6b1f28 0%, #3d0d13 100%)" : "#f9fafb" }}>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className={`text-lg font-black leading-none ${s.is_current ? "text-white" : "text-gray-900"}`}
                        style={{ fontFamily: "var(--font-display)" }}>
                        {s.season}
                      </p>
                      {s.is_current && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-orange-500 text-white">
                          Temporada actual
                        </span>
                      )}
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${s.is_current ? "text-white" : "text-gray-800"}`}>{teamName}</p>
                      {s.category && <p className={`text-[10px] ${s.is_current ? "text-white/60" : "text-gray-400"}`}>{s.category}</p>}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(s)} className={`p-1.5 rounded hover:bg-white/20 transition-colors ${s.is_current ? "text-white/70 hover:text-white" : "text-gray-400 hover:text-gray-700"}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(s.id)} className={`p-1.5 rounded hover:bg-red-50 transition-colors ${s.is_current ? "text-white/50 hover:text-red-300" : "text-gray-300 hover:text-red-500"}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Stats grid */}
                <div className="p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    {/* Partidos */}
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1" style={{ fontFamily: "var(--font-display)" }}>Partidos</p>
                      <p className="text-2xl font-black text-gray-900 leading-none">{s.matches_played || 0}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {s.matches_starter || 0}T · {s.matches_sub || 0}S
                      </p>
                    </div>
                    {/* Goles/Asist */}
                    <div className="rounded-xl p-3 text-center" style={{ background: "#fdf2f4" }}>
                      <p className="text-[10px] uppercase tracking-wide mb-1" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Goles / Asist.</p>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-2xl font-black leading-none" style={{ color: "var(--granate)" }}>{s.goals || 0}</span>
                        <span className="text-sm text-gray-400">/ {s.assists || 0}</span>
                      </div>
                      {s.minutes_played > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{s.minutes_played}' totales</p>}
                    </div>
                    {/* Asistencia */}
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1" style={{ fontFamily: "var(--font-display)" }}>Asistencia</p>
                      <p className="text-2xl font-black leading-none" style={{ color: attendancePct !== null ? (attendancePct >= 80 ? "#16a34a" : attendancePct >= 60 ? "#ea580c" : "#dc2626") : "#9ca3af" }}>
                        {attendancePct !== null ? `${attendancePct}%` : "—"}
                      </p>
                      {s.training_sessions > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{s.training_present}/{s.training_sessions} sesiones</p>}
                    </div>
                    {/* Lesiones */}
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1" style={{ fontFamily: "var(--font-display)" }}>Lesiones</p>
                      <p className="text-2xl font-black text-gray-900 leading-none">{s.injuries_count || 0}</p>
                      {s.injuries_days > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{s.injuries_days} días baja</p>}
                    </div>
                  </div>
                  {/* Tarjetas + rating + notas */}
                  <div className="flex flex-wrap gap-2 items-center">
                    {(s.yellow_cards > 0 || s.red_cards > 0) && (
                      <>
                        {s.yellow_cards > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-yellow-50 text-yellow-700 border-yellow-200 font-bold">
                            🟨 {s.yellow_cards}
                          </span>
                        )}
                        {s.red_cards > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-red-50 text-red-700 border-red-200 font-bold">
                            🟥 {s.red_cards}
                          </span>
                        )}
                      </>
                    )}
                    {s.avg_rating && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200 font-bold">
                        <Star className="w-3 h-3" /> {s.avg_rating} media
                      </span>
                    )}
                    {s.notes && (
                      <p className="text-xs text-gray-500 italic mt-1 w-full">{s.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditingRecord(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
              {editingRecord ? "Editar temporada" : "Nueva temporada"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1">Temporada *</Label>
                <Input value={form.season} onChange={e => setF("season", e.target.value)} placeholder="2024-2025" />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1">Equipo</Label>
                <Input value={form.team_name} onChange={e => setF("team_name", e.target.value)} placeholder="Cadete A" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1">Categoría</Label>
              <Input value={form.category} onChange={e => setF("category", e.target.value)} placeholder="Cadete S16 División Honor" />
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 pt-1" style={{ fontFamily: "var(--font-display)" }}>Partidos</p>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Jugados</Label><Input type="number" min="0" value={form.matches_played} onChange={e => setNum("matches_played", e.target.value)} /></div>
              <div><Label className="text-xs">Titular</Label><Input type="number" min="0" value={form.matches_starter} onChange={e => setNum("matches_starter", e.target.value)} /></div>
              <div><Label className="text-xs">Suplente</Label><Input type="number" min="0" value={form.matches_sub} onChange={e => setNum("matches_sub", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Minutos</Label><Input type="number" min="0" value={form.minutes_played} onChange={e => setNum("minutes_played", e.target.value)} /></div>
              <div><Label className="text-xs">Goles</Label><Input type="number" min="0" value={form.goals} onChange={e => setNum("goals", e.target.value)} /></div>
              <div><Label className="text-xs">Asist.</Label><Input type="number" min="0" value={form.assists} onChange={e => setNum("assists", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Amarillas</Label><Input type="number" min="0" value={form.yellow_cards} onChange={e => setNum("yellow_cards", e.target.value)} /></div>
              <div><Label className="text-xs">Rojas</Label><Input type="number" min="0" value={form.red_cards} onChange={e => setNum("red_cards", e.target.value)} /></div>
              <div><Label className="text-xs">Valoración media</Label><Input type="number" min="1" max="5" step="0.1" value={form.avg_rating} onChange={e => setF("avg_rating", e.target.value)} placeholder="—" /></div>
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 pt-1" style={{ fontFamily: "var(--font-display)" }}>Entrenamientos</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Sesiones totales</Label><Input type="number" min="0" value={form.training_sessions} onChange={e => setNum("training_sessions", e.target.value)} /></div>
              <div><Label className="text-xs">Sesiones asistidas</Label><Input type="number" min="0" value={form.training_present} onChange={e => setNum("training_present", e.target.value)} /></div>
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 pt-1" style={{ fontFamily: "var(--font-display)" }}>Lesiones</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Número de lesiones</Label><Input type="number" min="0" value={form.injuries_count} onChange={e => setNum("injuries_count", e.target.value)} /></div>
              <div><Label className="text-xs">Días de baja</Label><Input type="number" min="0" value={form.injuries_days} onChange={e => setNum("injuries_days", e.target.value)} /></div>
            </div>

            <div>
              <Label className="text-xs text-gray-600 mb-1">Notas de la temporada</Label>
              <Textarea value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Observaciones, hitos, cambio de equipo..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingRecord(null); setForm(EMPTY_FORM); }}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.season || saveMutation.isPending}
              className="text-white" style={{ background: "var(--granate)" }}>
              {saveMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
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