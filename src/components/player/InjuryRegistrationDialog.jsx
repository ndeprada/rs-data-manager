import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const INJURY_TYPES = [
  { value: "muscular", label: "Lesión muscular" },
  { value: "osea", label: "Lesión ósea" },
  { value: "ligamento", label: "Lesión de ligamento" },
  { value: "tendon", label: "Lesión de tendón" },
  { value: "contusion", label: "Contusión" },
  { value: "otro", label: "Otra" },
];

const BODY_PARTS = [
  { value: "tobillo", label: "Tobillo" },
  { value: "rodilla", label: "Rodilla" },
  { value: "muslo", label: "Muslo" },
  { value: "gemelo", label: "Gemelo" },
  { value: "isquiotibial", label: "Isquiotibial" },
  { value: "cadera", label: "Cadera" },
  { value: "espalda", label: "Espalda" },
  { value: "hombro", label: "Hombro" },
  { value: "brazo", label: "Brazo" },
  { value: "cabeza", label: "Cabeza" },
  { value: "otro", label: "Otra" },
];

const SEVERITIES = [
  { value: "leve", label: "Leve" },
  { value: "moderada", label: "Moderada" },
  { value: "grave", label: "Grave" },
];

export default function InjuryRegistrationDialog({ playerId, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    type: "",
    body_part: "",
    severity: "",
    injury_date: new Date().toISOString().split("T")[0],
    expected_return: "",
    diagnosis: "",
    description: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Create injury
      const injury = await base44.entities.Injury.create(data);
      // Update player status to lesionado
      await base44.entities.Player.update(playerId, { status: "lesionado" });
      return injury;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["injuries"] });
      queryClient.invalidateQueries({ queryKey: ["players"] });
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!form.type || !form.body_part || !form.severity) {
      alert("Por favor completa los campos obligatorios");
      return;
    }

    createMutation.mutate({
      player_id: playerId,
      ...form,
      status: "activa",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" style={{ color: "var(--granate)" }} />
              Registrar Lesión
            </h2>
            <p className="text-xs text-gray-400">Completa los datos de la lesión</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Type */}
            <div className="space-y-2">
              <Label className="text-gray-700 font-semibold">Tipo de lesión *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {INJURY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Body part */}
            <div className="space-y-2">
              <Label className="text-gray-700 font-semibold">Zona afectada *</Label>
              <Select value={form.body_part} onValueChange={(v) => setForm({ ...form, body_part: v })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar zona" /></SelectTrigger>
                <SelectContent>
                  {BODY_PARTS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <Label className="text-gray-700 font-semibold">Gravedad *</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar gravedad" /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Injury date */}
            <div className="space-y-2">
              <Label className="text-gray-700 font-semibold">Fecha de lesión</Label>
              <Input
                type="date"
                value={form.injury_date}
                onChange={(e) => setForm({ ...form, injury_date: e.target.value })}
                className="border-gray-200"
              />
            </div>

            {/* Expected return */}
            <div className="space-y-2">
              <Label className="text-gray-700 font-semibold">Fecha estimada de regreso</Label>
              <Input
                type="date"
                value={form.expected_return}
                onChange={(e) => setForm({ ...form, expected_return: e.target.value })}
                className="border-gray-200"
              />
            </div>
          </div>

          {/* Diagnosis */}
          <div className="space-y-2">
            <Label className="text-gray-700 font-semibold">Diagnóstico médico</Label>
            <textarea
              value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
              placeholder="Descripción del diagnóstico"
              className="w-full h-20 px-3 py-2 border border-gray-200 rounded-lg resize-none text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-gray-700 font-semibold">Notas adicionales</Label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Observaciones del entrenador"
              className="w-full h-20 px-3 py-2 border border-gray-200 rounded-lg resize-none text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex gap-2 sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="flex-1 text-white"
            style={{ background: "var(--granate)" }}
          >
            <Plus className="w-4 h-4 mr-2" /> Registrar
          </Button>
        </div>
      </div>
    </div>
  );
}