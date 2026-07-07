import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LOAD_OPTIONS = [
  { value: "muy_baja", label: "Muy Baja", color: "#10b981" },
  { value: "baja", label: "Baja", color: "#3b82f6" },
  { value: "moderada", label: "Moderada", color: "#f59e0b" },
  { value: "alta", label: "Alta", color: "#ef4444" },
  { value: "muy_alta", label: "Muy Alta", color: "#991b1b" },
];

export default function SessionReportDialog({ open, onOpenChange, event, teamId, coachName }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    session_objectives: "",
    physical_load: "moderada",
    tactical_notes: "",
    observations: "",
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SessionReport.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessionReports"] });
      handleClose();
    },
  });

  const handleClose = () => {
    setForm({
      session_objectives: "",
      physical_load: "moderada",
      tactical_notes: "",
      observations: "",
    });
    onOpenChange(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      event_id: event?.id,
      team_id: teamId,
      date: event?.date ? new Date(event.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      session_objectives: form.session_objectives,
      physical_load: form.physical_load,
      tactical_notes: form.tactical_notes,
      observations: form.observations,
      coach_name: coachName,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900">
            Informe de Sesión - {event?.title || "Nueva Sesión"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Objetivos */}
          <div className="space-y-2">
            <Label className="text-gray-700 font-medium">Objetivos de la Sesión</Label>
            <Textarea
              placeholder="Describe los objetivos principales de esta sesión de entrenamiento..."
              value={form.session_objectives}
              onChange={(e) => setForm({ ...form, session_objectives: e.target.value })}
              className="border-gray-200 h-20 resize-none"
            />
            <p className="text-xs text-gray-400">Ej: Mejorar presión defensiva, trabajo de transición...</p>
          </div>

          {/* Carga Física */}
          <div className="space-y-2">
            <Label className="text-gray-700 font-medium">Carga Física Percibida</Label>
            <Select value={form.physical_load} onValueChange={(v) => setForm({ ...form, physical_load: v })}>
              <SelectTrigger className="border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOAD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: opt.color }} />
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400">Evalúa la intensidad del entrenamiento</p>
          </div>

          {/* Notas Tácticas */}
          <div className="space-y-2">
            <Label className="text-gray-700 font-medium">Notas Tácticas</Label>
            <Textarea
              placeholder="Observaciones sobre el rendimiento táctico, ajustes realizados, áreas de mejora..."
              value={form.tactical_notes}
              onChange={(e) => setForm({ ...form, tactical_notes: e.target.value })}
              className="border-gray-200 h-24 resize-none"
            />
          </div>

          {/* Observaciones Generales */}
          <div className="space-y-2">
            <Label className="text-gray-700 font-medium">Observaciones Generales</Label>
            <Textarea
              placeholder="Notas adicionales, acciones futuras, estado de lesiones, etc..."
              value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
              className="border-gray-200 h-20 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" className="text-white" style={{ background: "var(--granate)" }}>
              Guardar Informe
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}