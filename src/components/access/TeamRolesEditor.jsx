import { sortTeams } from "@/lib/teamOrder";
import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Editor de "equipo + rol en el equipo". Una persona puede tener varias filas
 * (p. ej. 1er entrenador en un equipo y 2º en otro). Un equipo solo puede salir una vez.
 */
export default function TeamRolesEditor({ value = [], onChange, teams = [], roleOptions, label = "Equipos y rol en cada uno", compact = false }) {
  const update = (i, field, v) => onChange(value.map((a, idx) => (idx === i ? { ...a, [field]: v } : a)));
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { team_id: "", team_role: "" }]);

  const usedTeams = (i) => new Set(value.filter((a, idx) => idx !== i && a.team_id).map((a) => a.team_id));
  const sortedTeams = sortTeams(teams);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</label>
        <button
          type="button"
          onClick={add}
          className="text-xs font-bold flex items-center gap-1 hover:underline"
          style={{ color: "var(--granate)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Añadir equipo
        </button>
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Sin equipos asignados</p>
      ) : (
        <div className="space-y-2">
          {value.map((a, i) => {
            const used = usedTeams(i);
            return (
              <div key={i} className={`flex gap-2 items-center ${compact ? "flex-wrap" : ""}`}>
                <div className="flex-1 min-w-[130px]">
                  <Select value={a.team_id || ""} onValueChange={(v) => update(i, "team_id", v)}>
                    <SelectTrigger className="border-gray-200 text-sm h-9">
                      <SelectValue placeholder="Equipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedTeams.filter((t) => !used.has(t.id)).map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[130px]">
                  <Select value={a.team_role || ""} onValueChange={(v) => update(i, "team_role", v)}>
                    <SelectTrigger className="border-gray-200 text-sm h-9">
                      <SelectValue placeholder="Rol en el equipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                  aria-label="Quitar equipo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
