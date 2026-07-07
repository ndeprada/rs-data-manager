import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const emptyForm = {
  date: "", opponent: "", starter: true,
  minutes_played: "", goals: 0, assists: 0,
  yellow_cards: 0, double_yellow_card: 0, red_cards: 0,
  rating: 0, notes: ""
};

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-7 h-7 transition-colors ${i <= (hover || value) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function MatchStatsSection({ playerId }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: stats = [], isLoading } = useQuery({
    queryKey: ["matchstats", playerId],
    queryFn: () => base44.entities.MatchStats.filter({ player_id: playerId }, "-date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MatchStats.create({ ...data, player_id: playerId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["matchstats", playerId] }); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MatchStats.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["matchstats", playerId] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MatchStats.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["matchstats", playerId] }); setDeleteId(null); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditingItem(null); setForm(emptyForm); };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      date: item.date || "",
      opponent: item.opponent || "",
      starter: item.starter !== false,
      minutes_played: item.minutes_played ?? "",
      goals: item.goals || 0,
      assists: item.assists || 0,
      yellow_cards: item.yellow_cards || 0,
      double_yellow_card: item.double_yellow_card || 0,
      red_cards: item.red_cards || 0,
      rating: item.rating || 0,
      notes: item.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      minutes_played: form.minutes_played !== "" ? Number(form.minutes_played) : undefined,
      goals: Number(form.goals),
      assists: Number(form.assists),
      yellow_cards: Number(form.yellow_cards),
      double_yellow_card: Number(form.double_yellow_card),
      red_cards: Number(form.red_cards),
      rating: form.rating ? Number(form.rating) : undefined,
    };
    if (editingItem) updateMutation.mutate({ id: editingItem.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* List */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Registro de Partidos</h3>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="text-white" style={{ background: "var(--granate)" }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Añadir
          </Button>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : stats.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay partidos registrados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500">
                  <th className="text-left font-medium px-4 py-3">Fecha</th>
                  <th className="text-left font-medium px-4 py-3">Rival</th>
                  <th className="text-center font-medium px-2 py-3">Rol</th>
                  <th className="text-center font-medium px-2 py-3">Min</th>
                  <th className="text-center font-medium px-2 py-3">⚽</th>
                  <th className="text-center font-medium px-2 py-3">🅰️</th>
                  <th className="text-center font-medium px-2 py-3">🟨</th>
                  <th className="text-center font-medium px-2 py-3">🟨🟨</th>
                  <th className="text-center font-medium px-2 py-3">🟥</th>
                  <th className="text-center font-medium px-2 py-3">Val.</th>
                  <th className="text-right font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700">{new Date(s.date).toLocaleDateString("es-ES")}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.opponent || "—"}</td>
                    <td className="px-2 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.starter !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {s.starter !== false ? "Titular" : "Suplente"}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center text-gray-500">{s.minutes_played ?? "—"}'</td>
                    <td className="px-2 py-3 text-center font-semibold text-gray-900">{s.goals || 0}</td>
                    <td className="px-2 py-3 text-center font-semibold text-gray-900">{s.assists || 0}</td>
                    <td className="px-2 py-3 text-center text-gray-500">{s.yellow_cards || 0}</td>
                    <td className="px-2 py-3 text-center text-gray-500">{s.double_yellow_card || 0}</td>
                    <td className="px-2 py-3 text-center text-gray-500">{s.red_cards || 0}</td>
                    <td className="px-2 py-3 text-center">
                      {s.rating ? (
                        <span className="inline-flex items-center gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} className={`w-3 h-3 ${i <= s.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                          ))}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">{editingItem ? "Editar Partido" : "Registrar Partido"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700">Fecha *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="border-gray-200" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Rival</Label>
                <Input value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} className="border-gray-200" />
              </div>
            </div>

            {/* Titular / Suplente */}
            <div className="space-y-2">
              <Label className="text-gray-700">Participación</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: true, label: "Titular" },
                  { value: false, label: "Suplente" },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setForm({ ...form, starter: opt.value })}
                    className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      form.starter === opt.value
                        ? "border-green-400 bg-green-50 text-green-700"
                        : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-gray-700">Minutos</Label>
                <Input type="number" value={form.minutes_played} onChange={(e) => setForm({ ...form, minutes_played: e.target.value })} className="border-gray-200" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Goles</Label>
                <Input type="number" min="0" value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} className="border-gray-200" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Asistencias</Label>
                <Input type="number" min="0" value={form.assists} onChange={(e) => setForm({ ...form, assists: e.target.value })} className="border-gray-200" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-gray-700">🟨 Amarillas</Label>
                <Input type="number" min="0" max="2" value={form.yellow_cards} onChange={(e) => setForm({ ...form, yellow_cards: e.target.value })} className="border-gray-200" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">🟨🟨 Doble amarilla</Label>
                <Input type="number" min="0" max="1" value={form.double_yellow_card} onChange={(e) => setForm({ ...form, double_yellow_card: e.target.value })} className="border-gray-200" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">🟥 Roja directa</Label>
                <Input type="number" min="0" max="1" value={form.red_cards} onChange={(e) => setForm({ ...form, red_cards: e.target.value })} className="border-gray-200" />
              </div>
            </div>

            {/* Valoración estrellas */}
            <div className="space-y-2">
              <Label className="text-gray-700">Valoración del entrenador</Label>
              <StarPicker value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} />
              {form.rating > 0 && (
                <p className="text-xs text-gray-400">
                  {["", "Muy malo", "Regular", "Aceptable", "Bueno", "Excelente"][form.rating]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700">Notas del entrenador</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-gray-200" rows={3} />
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