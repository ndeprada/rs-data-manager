import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Star } from "lucide-react";
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
      {[1, 2, 3].map((i) => (
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

// Ventana para apuntar a mano o corregir los datos de un jugador en un partido (pestaña Partidos de su ficha).
// Antes era la tabla «Registro de Partidos»; desde el 14/11/2026 la tabla es la de la pestaña y esto solo la ventana.
export default function MatchStatDialog({ playerId, item, open, onClose }) {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const editingItem = item || null;
  const dialogOpen = open;

  React.useEffect(() => {
    if (!open) return;
    setForm(item ? {
      date: String(item.date || "").slice(0, 10), opponent: item.opponent || "", starter: item.starter !== false,
      minutes_played: item.minutes_played ?? "", goals: item.goals || 0, assists: item.assists || 0,
      yellow_cards: item.yellow_cards || 0, double_yellow_card: item.double_yellow_card || 0, red_cards: item.red_cards || 0,
      rating: item.rating || 0, notes: item.notes || "",
    } : emptyForm);
  }, [open, item]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["matchstats", playerId] });
    queryClient.invalidateQueries({ queryKey: ["matchstats_all"] });
  };
  const closeDialog = () => { onClose?.(); };
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MatchStats.create({ ...data, player_id: playerId }),
    onSuccess: () => { refresh(); closeDialog(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MatchStats.update(id, data),
    onSuccess: () => { refresh(); closeDialog(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MatchStats.delete(id),
    onSuccess: () => { refresh(); setDeleteId(null); closeDialog(); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      minutes_played: form.minutes_played !== "" ? Number(form.minutes_played) : undefined,
      goals: Number(form.goals), assists: Number(form.assists),
      yellow_cards: Number(form.yellow_cards), double_yellow_card: Number(form.double_yellow_card), red_cards: Number(form.red_cards),
      rating: form.rating ? Number(form.rating) : undefined,
    };
    // Los de un partido del calendario conservan su fecha y su rival
    if (editingItem?.event_id) { delete data.date; delete data.opponent; }
    if (editingItem) updateMutation.mutate({ id: editingItem.id, data });
    else createMutation.mutate(data);
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">{editingItem ? "Editar Partido" : "Registrar Partido"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingItem?.event_id && <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700">Fecha *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="border-gray-200" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Rival</Label>
                <Input value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} className="border-gray-200" />
              </div>
            </div>}

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
                  {["", "Mal", "Bien", "Muy bien"][form.rating]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700">Notas del entrenador</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-gray-200" rows={3} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              {editingItem && <Button type="button" variant="outline" className="mr-auto text-red-600" onClick={() => setDeleteId(editingItem.id)} data-testid="matchstat-delete"><Trash2 className="w-3.5 h-3.5 mr-1" />Eliminar</Button>}
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button variant="club" type="submit">{editingItem ? "Guardar" : "Registrar"}</Button>
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
    </>
  );
}
