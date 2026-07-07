import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TEAM_ROLES = [
  { value: "primer_entrenador", label: "Primer Entrenador" },
  { value: "segundo_entrenador", label: "Segundo Entrenador" },
  { value: "asistente", label: "Asistente" },
  { value: "preparador_fisico", label: "Preparador Físico" },
  { value: "entrenador_porteros", label: "Entrenador de Porteros" },
  { value: "delegado", label: "Delegado" },
  { value: "fisio", label: "Fisio" },
  { value: "analista", label: "Analista" },
];

const teamRoleLabels = Object.fromEntries(TEAM_ROLES.map(r => [r.value, r.label]));

export default function CoachTeamAssignments({ assignments = [], teams = [], onChange }) {
  const [editingAssignments, setEditingAssignments] = useState(assignments || []);

  const handleAddAssignment = () => {
    setEditingAssignments([...editingAssignments, { team_id: "", team_role: "" }]);
  };

  const handleUpdateAssignment = (index, field, value) => {
    const updated = [...editingAssignments];
    updated[index][field] = value;
    setEditingAssignments(updated);
    onChange(updated);
  };

  const handleRemoveAssignment = (index) => {
    const updated = editingAssignments.filter((_, i) => i !== index);
    setEditingAssignments(updated);
    onChange(updated);
  };

  const assignedTeamIds = new Set(editingAssignments.filter(a => a.team_id).map(a => a.team_id));
  const availableTeams = teams.filter(t => !assignedTeamIds.has(t.id) || editingAssignments.some((a, i) => a.team_id === t.id && assignments[i]?.team_id === t.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Equipos Asignados</label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddAssignment}
          className="text-xs"
        >
          <Plus className="w-3 h-3 mr-1" /> Añadir equipo
        </Button>
      </div>

      {editingAssignments.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Sin equipos asignados</p>
      ) : (
        <div className="space-y-3">
          {editingAssignments.map((assignment, index) => (
            <div key={index} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Equipo</label>
                <Select value={assignment.team_id || ""} onValueChange={(v) => handleUpdateAssignment(index, "team_id", v)}>
                  <SelectTrigger className="border-gray-200 text-sm">
                    <SelectValue placeholder="Selecciona equipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeams.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Rol</label>
                <Select value={assignment.team_role || ""} onValueChange={(v) => handleUpdateAssignment(index, "team_role", v)}>
                  <SelectTrigger className="border-gray-200 text-sm">
                    <SelectValue placeholder="Selecciona rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleRemoveAssignment(index)}
                className="text-red-500 hover:bg-red-50 p-2"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}