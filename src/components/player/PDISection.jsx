import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Star, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const emptyForm = { date: "", evaluator: "", period: "", technical: "", tactical: "", physical: "", mental: "", strengths: "", areas_to_improve: "", objectives: "", overall_rating: "" };

const FIELD_SECTIONS = [
  { key: "technical", label: "⚽ Habilidades Técnicas", placeholder: "Descripción del nivel técnico: control del balón, pase, regate, tiro..." },
  { key: "tactical", label: "🧠 Habilidades Tácticas", placeholder: "Comprensión del juego, posicionamiento, lectura del juego..." },
  { key: "physical", label: "💪 Condición Física", placeholder: "Resistencia, velocidad, fuerza, recuperación..." },
  { key: "mental", label: "🎯 Actitud y Aspectos Mentales", placeholder: "Motivación, concentración, trabajo en equipo, liderazgo..." },
  { key: "strengths", label: "✅ Puntos Fuertes", placeholder: "¿En qué destaca el jugador?" },
  { key: "areas_to_improve", label: "📈 Áreas de Mejora", placeholder: "¿En qué debe mejorar?" },
  { key: "objectives", label: "🎯 Objetivos para el siguiente período", placeholder: "Metas concretas y medibles para la próxima evaluación..." },
];

function PDICard({ pdi, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--granate-pale, #fdf2f4)" }}>
            <BookOpen className="w-5 h-5" style={{ color: "var(--granate)" }} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{pdi.period || new Date(pdi.date).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</p>
            <p className="text-sm text-gray-500">
              {new Date(pdi.date).toLocaleDateString("es-ES")}
              {pdi.evaluator && ` · ${pdi.evaluator}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pdi.overall_rating && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold" style={{ background: "var(--naranja-pale, #fff7ed)", color: "var(--naranja)" }}>
              <Star className="w-3.5 h-3.5" />{pdi.overall_rating}/10
            </span>
          )}
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => onEdit(pdi)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => onDelete(pdi.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-5 space-y-5">
          {FIELD_SECTIONS.map(({ key, label }) => pdi[key] ? (
            <div key={key}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
              <p className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded-xl px-4 py-3">{pdi[key]}</p>
            </div>
          ) : null)}
        </div>
      )}
    </div>
  );
}

export default function PDISection({ playerId, playerName, playerEmail }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["pdi", playerId],
    queryFn: () => base44.entities.PDI.filter({ player_id: playerId }, "-date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PDI.create({ ...data, player_id: playerId }),
    onSuccess: async (created) => {
      queryClient.invalidateQueries({ queryKey: ["pdi", playerId] });
      closeDialog();
      if (playerEmail) {
        const period = created.period || new Date(created.date).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
        const rating = created.overall_rating ? `\n⭐ Valoración global: ${created.overall_rating}/10` : "";
        await base44.integrations.Core.SendEmail({
          to: playerEmail,
          subject: `📊 Nueva evaluación PDI publicada`,
          body: `Hola ${playerName},\n\nTu entrenador ha publicado una nueva evaluación de rendimiento (PDI):\n\n📅 Período: ${period}${created.evaluator ? `\n👤 Evaluador: ${created.evaluator}` : ""}${rating}${created.strengths ? `\n\n✅ Puntos fuertes:\n${created.strengths}` : ""}${created.areas_to_improve ? `\n\n📈 Áreas de mejora:\n${created.areas_to_improve}` : ""}${created.objectives ? `\n\n🎯 Objetivos:\n${created.objectives}` : ""}\n\nAccede a tu perfil para ver la evaluación completa.\n\nRS Data Manager`,
        });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PDI.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pdi", playerId] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PDI.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pdi", playerId] }); setDeleteId(null); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditingItem(null); setForm(emptyForm); };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({ date: item.date || "", evaluator: item.evaluator || "", period: item.period || "", technical: item.technical || "", tactical: item.tactical || "", physical: item.physical || "", mental: item.mental || "", strengths: item.strengths || "", areas_to_improve: item.areas_to_improve || "", objectives: item.objectives || "", overall_rating: item.overall_rating || "" });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form, overall_rating: form.overall_rating ? Number(form.overall_rating) : undefined };
    if (editingItem) updateMutation.mutate({ id: editingItem.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--granate-pale, #fdf2f4)" }}>
            <BookOpen className="w-5 h-5" style={{ color: "var(--granate)" }} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">Plan de Desarrollo Individual (PDI)</h3>
            <p className="text-sm text-gray-500">Evaluaciones periódicas del rendimiento y desarrollo de <strong>{playerName}</strong>. Cada evaluación recoge una valoración completa del jugador en los aspectos técnico, táctico, físico y mental, junto con objetivos de mejora.</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="text-white shrink-0" style={{ background: "var(--granate)" }}>
            <Plus className="w-4 h-4 mr-2" /> Nueva Evaluación
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Cargando...</div>
      ) : records.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No hay evaluaciones registradas</p>
          <p className="text-gray-400 text-sm mt-1">Crea la primera evaluación PDI de este jugador</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((pdi) => (
            <PDICard key={pdi.id} pdi={pdi} onEdit={openEdit} onDelete={setDeleteId} />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="bg-white border-gray-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">{editingItem ? "Editar Evaluación PDI" : "Nueva Evaluación PDI"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700">Fecha de evaluación *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="border-gray-200" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Período evaluado</Label>
                <Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="Ej: Oct-Dic 2025" className="border-gray-200" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700">Entrenador evaluador</Label>
                <Input value={form.evaluator} onChange={(e) => setForm({ ...form, evaluator: e.target.value })} className="border-gray-200" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Valoración global (1-10)</Label>
                <Input type="number" min="1" max="10" step="0.1" value={form.overall_rating} onChange={(e) => setForm({ ...form, overall_rating: e.target.value })} className="border-gray-200" />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-4">
              {FIELD_SECTIONS.map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-2">
                  <Label className="text-gray-700">{label}</Label>
                  <Textarea value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} className="border-gray-200" rows={3} />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" className="text-white" style={{ background: "var(--granate)" }}>{editingItem ? "Guardar" : "Crear Evaluación"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evaluación?</AlertDialogTitle>
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