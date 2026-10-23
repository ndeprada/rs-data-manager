import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, BookmarkPlus, Copy, Library, ListChecks, Pencil, Trash2 } from "lucide-react";
import ContentPicker, { ContentChip } from "./ContentPicker";
import PitchBoard, { hasBoard } from "./PitchBoard";
import LibraryTaskPicker from "./LibraryTaskPicker";
import { PHASES, PHASE_PRESETS, TASK_TYPES, fmtMin, hasText, isBlankTask, phasesLabel, taskMinutes, taskTypeLabel, taskWarnings } from "@/lib/sessionPlan";
import { libraryToSessionTask, sessionTaskToLibrary } from "@/lib/taskLibrary";

const L = ({ children, className = "" }) => (
  <Label className={`text-[11px] font-bold uppercase tracking-wider text-gray-500 ${className}`}>{children}</Label>
);

const GROUPS = ["Individual", "Colectiva", "Otras"];
const GROUP_LABEL = { Individual: "Orientación individual", Colectiva: "Orientación colectiva", Otras: "Otras" };

export default function TaskEditor({ task, index, label, stage, roster, onChange, onRemove, onMove, onDuplicate, canMoveUp, canMoveDown, defaultOpen = false }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(hasBoard(task.board));
  const [libOpen, setLibOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const set = (patch) => onChange(patch);

  // Biblioteca de tareas ↔ sesión: cargar copia una tarea de la biblioteca en esta; guardar crea una tarea NUEVA en la biblioteca.
  // En ningún caso se modifica una tarea que ya está en la biblioteca.
  const loadFromLibrary = (lib) => {
    if (!isBlankTask(task) && !window.confirm(`Se sustituirá lo escrito en esta tarea (título, descripción, tiempos, dibujo…) por «${lib.name}». Los contenidos del currículum se mantienen. ¿Continuar?`)) return;
    const { id: _id, part: _part, principal: _p, secondary: _s, no_curriculum: _n, ...rest } = libraryToSessionTask(lib, task.part);
    set({ ...rest, diagram_url: rest.diagram_url || "", library_saved: null });
    setBoardOpen(hasBoard(rest.board));
  };
  const saveToLibrary = async () => {
    const name = String(task.title || "").trim();
    if (!hasText(name)) { toast({ title: "Pon un título a la tarea para guardarla en la biblioteca", variant: "destructive" }); return; }
    if (task.library_saved && !window.confirm(`Ya la guardaste en la biblioteca como «${task.library_saved.name}». ¿Guardar otra copia nueva?`)) return;
    setSaving(true);
    try {
      const created = await base44.entities.TrainingTask.create(sessionTaskToLibrary(task));
      queryClient.invalidateQueries({ queryKey: ["training_tasks"] });
      set({ library_saved: { id: created?.id ?? null, name } });
      toast({ title: "Guardada en la biblioteca", description: `«${name}» ya está en Metodología → Biblioteca de tareas.` });
    } catch (err) {
      toast({ title: "No se pudo guardar en la biblioteca", description: err?.message || "Inténtalo de nuevo.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  const mins = taskMinutes(task);
  const warns = taskWarnings(task);
  const phaseSet = new Set(task.phases || []);
  const togglePhase = (id) => set({ phases: phaseSet.has(id) ? task.phases.filter((p) => p !== id) : [...(task.phases || []), id] });
  const sameAs = (arr) => arr.length === phaseSet.size && arr.every((p) => phaseSet.has(p));
  const nums = (k, v) => set({ [k]: v === "" ? "" : Math.max(0, Number(String(v).replace(",", ".")) || 0) });

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
            {label} {index + 1}{task.title ? ` · ${task.title}` : ""}
          </p>
          {!open && (
            <div className="flex flex-wrap items-center gap-1 mt-0.5">
              {task.type && <span className="text-[10px] text-gray-500">{taskTypeLabel(task.type)}</span>}
              {task.no_curriculum && <span className="text-[10px] rounded bg-gray-200 text-gray-600 px-1">Sin currículum</span>}
              {(task.principal || []).map((id) => <ContentChip key={id} id={id} stage={stage} kind="principal" />)}
              {(task.secondary || []).map((id) => <ContentChip key={id} id={id} stage={stage} kind="secondary" />)}
            </div>
          )}
        </div>
        {warns.length > 0 && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" aria-label="Tiene avisos" />}
        <span className="text-sm font-black text-gray-700 shrink-0" style={{ fontFamily: "var(--font-display)" }}>{mins ? fmtMin(mins) : "—"}</span>
      </div>

      {open && (
        <div className="p-3 space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 space-y-1.5" data-testid="task-library-bar">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setLibOpen(true)}><Library className="w-3.5 h-3.5" /> Cargar de la biblioteca</Button>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={saveToLibrary} disabled={saving}><BookmarkPlus className="w-3.5 h-3.5" /> {saving ? "Guardando…" : "Guardar en la biblioteca"}</Button>
            </div>
            {task.from_library && (
              <p className="text-[11px] text-amber-800">
                Cargada de la biblioteca: «{task.from_library.name}». Lo que cambies aquí vale solo para esta sesión y la tarea de la biblioteca no se modifica. Si quieres conservar los cambios, «Guardar en la biblioteca» crea una tarea nueva.
              </p>
            )}
            {task.library_saved && <p className="text-[11px] text-green-700">Guardada en la biblioteca como «{task.library_saved.name}».</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_16rem] gap-3">
            <div>
              <L>Título de la tarea</L>
              <Input value={task.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ej: Rondo de presión 6v3+3v6" className="mt-1" />
            </div>
            <div>
              <L>Tipo de tarea</L>
              <Select value={task.type || ""} onValueChange={(v) => set({ type: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Elegir tipo…" /></SelectTrigger>
                <SelectContent>
                  {GROUPS.map((g) => (
                    <SelectGroup key={g}>
                      <SelectLabel>{GROUP_LABEL[g]}</SelectLabel>
                      {TASK_TYPES.filter((t) => t.group === g).map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 items-end">
            <div>
              <L>Series</L>
              <Input type="number" inputMode="decimal" min={1} value={task.series} onChange={(e) => nums("series", e.target.value)} className="mt-1" />
            </div>
            <div>
              <L>Min. por serie</L>
              <Input type="number" inputMode="decimal" min={0} step="0.5" value={task.serie_min} onChange={(e) => nums("serie_min", e.target.value)} className="mt-1" />
            </div>
            <div>
              <L>Recup. (min)</L>
              <Input type="number" inputMode="decimal" min={0} step="0.5" value={task.rec_min} onChange={(e) => nums("rec_min", e.target.value)} className="mt-1" />
            </div>
            <div className="col-span-3 sm:col-span-1">
              <L>Total (min)</L>
              <Input type="number" inputMode="decimal" min={0} step="0.5" value={task.total_override} onChange={(e) => nums("total_override", e.target.value)} placeholder={String(taskMinutes({ ...task, total_override: "" }) || "")} className="mt-1" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 -mt-1">El total se calcula con series × minutos + recuperaciones. Si lo escribes tú, manda el tuyo.</p>

          <div>
            <L>Descripción</L>
            <Textarea value={task.description} onChange={(e) => set({ description: e.target.value })} rows={4} className="mt-1 text-sm" placeholder={"Una línea por punto:\n3 equipos de 6 jugadores\n1 equipo conserva contra la presión de 3…"} />
          </div>

          <div className="rounded-lg border border-gray-200 p-2.5 space-y-2.5 bg-gray-50/60">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-gray-700" style={{ fontFamily: "var(--font-display)" }}>Qué se trabaja</p>
                <p className="text-[11px] text-gray-500">Es lo que alimenta el control de contenidos de la temporada.</p>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-gray-600 shrink-0 cursor-pointer">
                <Switch checked={!!task.no_curriculum} onCheckedChange={(v) => set({ no_curriculum: v })} />
                Sin contenidos (PF, activación…)
              </label>
            </div>

            <div>
              <L>Objetivo</L>
              <Input value={task.objective} onChange={(e) => set({ objective: e.target.value })} placeholder="Mejora de la presión y los espacios libres" className="mt-1" />
            </div>

            <div>
              <L>Momento / fase del juego</L>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PHASES.map((p) => (
                  <button key={p.id} type="button" onClick={() => togglePhase(p.id)} aria-pressed={phaseSet.has(p.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${phaseSet.has(p.id) ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {PHASE_PRESETS.map((p) => (
                  <button key={p.id} type="button" onClick={() => set({ phases: sameAs(p.phases) ? [] : p.phases })}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${sameAs(p.phases) ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
                    {p.label}
                  </button>
                ))}
                {phaseSet.size > 0 && <span className="text-[11px] text-gray-400 self-center">En la ficha: {phasesLabel(task.phases)}</span>}
              </div>
            </div>

            {!task.no_curriculum && (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <L>Contenidos</L>
                  <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setPickerOpen(true)}>
                    <ListChecks className="w-3.5 h-3.5" /> {(task.principal || []).length + (task.secondary || []).length ? "Cambiar contenidos" : "Elegir contenidos"}
                  </Button>
                </div>
                <div className="mt-1.5 space-y-1">
                  {(task.principal || []).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400 w-20 shrink-0">Principales</span>
                      {task.principal.map((id) => <ContentChip key={id} id={id} stage={stage} kind="principal" onRemove={() => set({ principal: task.principal.filter((x) => x !== id) })} />)}
                    </div>
                  )}
                  {(task.secondary || []).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400 w-20 shrink-0">Secundarios</span>
                      {task.secondary.map((id) => <ContentChip key={id} id={id} stage={stage} kind="secondary" onRemove={() => set({ secondary: task.secondary.filter((x) => x !== id) })} />)}
                    </div>
                  )}
                  {!(task.principal || []).length && !(task.secondary || []).length && <p className="text-xs text-gray-400">Aún no has elegido contenidos.</p>}
                </div>
              </div>
            )}
          </div>

          <div>
            <L>Correcciones</L>
            <Textarea value={task.corrections} onChange={(e) => set({ corrections: e.target.value })} rows={3} className="mt-1 text-sm" placeholder="Consignas para desarrollar los contenidos: jugar de costado, doy y voy, aparecer en los espacios libres…" />
          </div>
          <div>
            <L>Correcciones por entrenador <span className="normal-case font-normal text-gray-400">(opcional)</span></L>
            <Textarea value={task.staff_corrections} onChange={(e) => set({ staff_corrections: e.target.value })} rows={2} className="mt-1 text-sm" placeholder={"1E N: Correcciones OP\nEA M: Correcciones espacios libres"} />
          </div>
          <div>
            <L>Puntuación</L>
            <Textarea value={task.scoring} onChange={(e) => set({ scoring: e.target.value })} rows={2} className="mt-1 text-sm" placeholder={"8 pases = 1 punto.\n[3p] equipo ganador"} />
          </div>

          {warns.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 space-y-1">
              {warns.map((w) => <p key={w} className="text-xs text-amber-800 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{w}</p>)}
            </div>
          )}

          <div>
            <button type="button" onClick={() => setBoardOpen((o) => !o)} className="flex items-center gap-1.5 text-xs font-bold text-[var(--granate)]">
              <Pencil className="w-3.5 h-3.5" /> {boardOpen ? "Ocultar dibujo" : hasBoard(task.board) ? "Editar dibujo" : "Añadir dibujo"}
            </button>
            {boardOpen && <div className="mt-2"><PitchBoard value={task.board} onChange={(board) => set({ board })} roster={roster} filename={task.title || "tarea"} /></div>}
            {task.diagram_url && (
              <div className="mt-2 flex items-center gap-2">
                <img src={task.diagram_url} alt="Imagen de la tarea" className="h-14 rounded border border-gray-200 bg-white object-contain" />
                <span className="text-[11px] text-gray-500 flex-1">Imagen de la tarea (viene de la biblioteca){hasBoard(task.board) ? ": en la ficha se imprime el dibujo de la pizarra." : "."}</span>
                <button type="button" className="text-[11px] text-red-600 underline" onClick={() => set({ diagram_url: "" })}>Quitar imagen</button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-1 pt-1 border-t border-gray-100">
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => onMove(-1)} disabled={!canMoveUp} title="Subir"><ArrowUp className="w-4 h-4" /></Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => onMove(1)} disabled={!canMoveDown} title="Bajar"><ArrowDown className="w-4 h-4" /></Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={onDuplicate} title="Duplicar tarea"><Copy className="w-4 h-4" /></Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-red-600" onClick={onRemove} title="Quitar tarea"><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      <LibraryTaskPicker open={libOpen} onOpenChange={setLibOpen} part={task.part} onPick={loadFromLibrary} />
      <ContentPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        stage={stage}
        principal={task.principal || []}
        secondary={task.secondary || []}
        onChange={(patch) => set(patch)}
      />
    </div>
  );
}
