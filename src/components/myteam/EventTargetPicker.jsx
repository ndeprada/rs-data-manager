import React, { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sortTeams, isF7Team } from "@/lib/teamOrder";
import { teamSets, scopeLabel } from "@/lib/clubEvent";

const LABEL = "text-xs font-bold uppercase tracking-wider text-gray-500 mb-1";

const Chip = ({ on, onClick, children, small = false, title }) => (
  <button type="button" onClick={onClick} title={title}
    className={`${small ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"} rounded-full font-bold border transition-colors ${on ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
    style={on ? { background: "var(--granate)" } : undefined}>
    {children}
  </button>
);

/**
 * Para qué equipos se crea el evento.
 * Un entrenador (o quien no coordina) elige un solo equipo. Coordinación puede además elegir «Varios equipos»:
 * a mano, o con las selecciones rápidas Todos / Fútbol 11 / Fútbol 7. Se crea una copia del evento en cada equipo.
 *   value = { multi, teamId, teamIds }   ·   onChange(patch)
 */
export default function EventTargetPicker({ teams, canMulti, value, onChange }) {
  const sorted = useMemo(() => sortTeams(teams), [teams]);
  const sets = useMemo(() => teamSets(sorted, isF7Team), [sorted]);
  const picked = sorted.filter((t) => value.teamIds.includes(t.id));
  const on = (ids) => ids.every((id) => value.teamIds.includes(id));
  const toggleSet = (ids) => onChange({ teamIds: on(ids) ? value.teamIds.filter((id) => !ids.includes(id)) : [...new Set([...value.teamIds, ...ids])] });
  const toggleTeam = (id) => onChange({ teamIds: value.teamIds.includes(id) ? value.teamIds.filter((x) => x !== id) : [...value.teamIds, id] });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className={`${LABEL} mb-0`}>{value.multi ? "Equipos *" : "Equipo *"}</p>
        {canMulti && (
          <div className="flex gap-1">
            <Chip small on={!value.multi} onClick={() => onChange({ multi: false })}>Un equipo</Chip>
            <Chip small on={value.multi} onClick={() => onChange({ multi: true })}>Varios equipos</Chip>
          </div>
        )}
      </div>

      {!value.multi ? (
        <Select value={value.teamId} onValueChange={(v) => onChange({ teamId: v })}>
          <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar equipo…" /></SelectTrigger>
          <SelectContent>
            {sorted.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <div className="rounded-lg border border-gray-200 p-2.5 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {sets.map((s) => <Chip key={s.key} on={on(s.ids)} onClick={() => toggleSet(s.ids)} title={`${s.ids.length} equipos`}>{s.label}</Chip>)}
            {picked.length > 0 && <button type="button" onClick={() => onChange({ teamIds: [] })} className="ml-auto text-[11px] font-bold text-gray-400 hover:text-gray-700">Quitar todos</button>}
          </div>
          <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
            {sorted.map((t) => <Chip key={t.id} small on={value.teamIds.includes(t.id)} onClick={() => toggleTeam(t.id)}>{t.name}</Chip>)}
          </div>
          <p className="text-[11px] text-gray-500">
            {picked.length === 0
              ? "Elige los equipos en los que quieres crear el evento."
              : picked.length === 1
                ? "Un solo equipo: se creará como un evento normal."
                : picked.length === sorted.length
                  ? `Se creará en los ${picked.length} equipos del club. Después podrás editarlo o borrarlo en todos a la vez.`
                  : `Se creará en ${picked.length} equipos (${scopeLabel(picked, sorted)}). Después podrás editarlo o borrarlo en todos a la vez.`}
          </p>
        </div>
      )}
    </div>
  );
}
