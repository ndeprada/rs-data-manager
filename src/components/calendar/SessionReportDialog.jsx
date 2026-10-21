import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT, msg } from "@/i18n";

const LOAD_OPTIONS = [
  { value: "muy_baja", label: msg("Muy Baja"), color: "#10b981" },
  { value: "baja", label: msg("Baja"), color: "#3b82f6" },
  { value: "moderada", label: msg("Moderada"), color: "#f59e0b" },
  { value: "alta", label: msg("Alta"), color: "#ef4444" },
  { value: "muy_alta", label: msg("Muy Alta"), color: "#991b1b" },
];

export default function SessionReportDialog({ open, onOpenChange, event, teamId, coachName }) {
  const t = useT();
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
            {t("Informe de Sesión - {title}", { title: event?.title || t("Nueva Sesión") })}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Objetivos */}
          <div className="space-y-2">
            <Label className="text-gray-700 font-medium">{t("Objetivos de la Sesión")}</Label>
            <Textarea
              placeholder={t("Describe los objetivos principales de esta sesión de entrenamiento...")}
              value={form.session_objectives}
              onChange={(e) => setForm({ ...form, session_objectives: e.target.value })}
              className="border-gray-200 h-20 resize-none"
            />
            <p className="text-xs text-gray-400">{t("Ej: Mejorar presión defensiva, trabajo de transición...")}</p>
          </div>

          {/* Carga Física */}
          <div className="space-y-2">
            <Label className="text-gray-700 font-medium">{t("Carga Física Percibida")}</Label>
            <Select value={form.physical_load} onValueChange={(v) => setForm({ ...form, physical_load: v })}>
              <SelectTrigger className="border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOAD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: opt.color }} />
                      {t(opt.label)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400">{t("Evalúa la intensidad del entrenamiento")}</p>
          </div>

          {/* Notas Tácticas */}
          <div className="space-y-2">
            <Label className="text-gray-700 font-medium">{t("Notas Tácticas")}</Label>
            <Textarea
              placeholder={t("Observaciones sobre el rendimiento táctico, ajustes realizados, áreas de mejora...")}
              value={form.tactical_notes}
              onChange={(e) => setForm({ ...form, tactical_notes: e.target.value })}
              className="border-gray-200 h-24 resize-none"
            />
          </div>

          {/* Observaciones Generales */}
          <div className="space-y-2">
            <Label className="text-gray-700 font-medium">{t("Observaciones Generales")}</Label>
            <Textarea
              placeholder={t("Notas adicionales, acciones futuras, estado de lesiones, etc...")}
              value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
              className="border-gray-200 h-20 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              {t("Cancelar")}
            </Button>
            <Button variant="club" type="submit">
              {t("Guardar Informe")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}