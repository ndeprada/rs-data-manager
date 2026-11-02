import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArrowDown, ArrowUp, BookmarkPlus, ChevronDown, ChevronRight, Copy, Library, ListChecks, Plus, Trash2, X } from "lucide-react";
import { C, D, Field, Lab, Pill, SBtn, inputCls } from "./sessionUi";
import ContentPicker, { ContentChip } from "./ContentPicker";
import PitchBoard, { hasBoard } from "./PitchBoard";
import LibraryTaskPicker from "./LibraryTaskPicker";
import { PHASES, TASK_STAFF_ROLES, recText, TASK_TYPES, fmtMin, hasText, isBlankTask, seriesLabel, taskMinutes, taskWarnings } from "@/lib/sessionPlan";
import { libraryToSessionTask, sessionTaskToLibrary } from "@/lib/taskLibrary";


const GROUPS = ["Individual", "Colectiva", "Otras"];
const GROUP_LABEL = { Individual: "Orientación individual", Colectiva: "Orientación colectiva", Otras: "Otras" };

export default function TaskEditor({ task, index, label, stage, roster, onChange, onRemove, onMove, onDuplicate, canMoveUp, canMoveDown, defaultOpen = false, part, onChangePart, staffNames = [], prevStaff = null }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const GAME_PHASES = ["ataque_org", "defensa_org", "trans_of", "trans_def"];
  const allGame = GAME_PHASES.every((p) => phaseSet.has(p));
  const toggleAll = () => set({ phases: allGame ? (task.phases || []).filter((p) => !GAME_PHASES.includes(p)) : [...new Set([...(task.phases || []), ...GAME_PHASES])] });
  const roles = task.staff_roles || [];
  const setRole = (i, patch) => set({ staff_roles: roles.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  const addRole = (role) => set({ staff_roles: [...roles, { role, name: "", aspect: "" }] });
  const removeRole = (i) => set({ staff_roles: roles.filter((_, k) => k !== i) });
  const nums = (k, v) => set({ [k]: v === "" ? "" : Math.max(0, Number(String(v).replace(",", ".")) || 0) });

  const rec = Number(String(task.rec_min || "").replace(",", ".")) || 0;
  const seriesText = [seriesLabel(task), rec ? `rec. ${recText(rec)}` : ""].filter(Boolean).join(" · ");
  const P = task.principal || [], S = task.secondary || [];

  return (
    <div style={{ borderTop: index ? `1px solid ${C.paleLine}` : 0 }} data-testid={`task-${task.id}`}>
      {/* Fila de la tarea (cerrada: así se ve en la maqueta) */}
      <div className="flex items-start gap-3 px-4 sm:px-5 py-3 cursor-pointer hover:bg-[#FBF8F8]" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown className="w-4 h-4 shrink-0 mt-1" style={{ color: C.muted }} /> : <ChevronRight className="w-4 h-4 shrink-0 mt-1" style={{ color: C.muted }} />}
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <D size={open ? 20 : 16} className="min-w-0" style={open ? { flex: 1 } : undefined}>{index + 1} · {task.title || (open ? label : "Sin título")}</D>
          {!open && seriesText && <span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>{seriesText}</span>}
          {!open && task.no_curriculum && <span className="text-[11px] rounded px-1.5" style={{ background: "#F3F0F0", color: C.muted }}>Sin contenidos</span>}
          {!open && P.map((id) => <ContentChip key={id} id={id} stage={stage} kind="principal" task={task} />)}
          {!open && S.map((id) => <ContentChip key={id} id={id} stage={stage} kind="secondary" task={task} />)}
        </div>
        {warns.length > 0 && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-label="Tiene avisos" />}
        <span className="text-[13px] font-bold shrink-0 mt-0.5" style={{ color: C.ink }}>{mins ? fmtMin(mins) : "—"}</span>
      </div>

      {open && (
        <div className="px-5 pb-5 flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2.5" data-testid="task-library-bar">
            {onChangePart && (
              <div className="flex rounded-lg overflow-hidden text-xs font-semibold" style={{ border: `1px solid ${C.field}` }} role="group" aria-label="Parte de la sesión" data-testid="task-part">
                {[["initial", "Parte inicial"], ["main", "Parte principal"]].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => k !== part && onChangePart(k)} aria-pressed={k === part}
                    className="px-2.5 py-1.5" style={k === part ? { background: C.granate, color: "#fff" } : { background: "#fff", color: C.muted }}>{l}</button>
                ))}
              </div>
            )}
            <span className="flex-1" />
            <SBtn small onClick={() => setLibOpen(true)}><Library className="w-3.5 h-3.5" /> Cargar de la biblioteca</SBtn>
            <SBtn small onClick={saveToLibrary} disabled={saving}><BookmarkPlus className="w-3.5 h-3.5" /> {saving ? "Guardando…" : "Guardar en la biblioteca"}</SBtn>
          </div>
          {task.from_library && <p className="text-[11px] text-amber-800 -mt-1.5">Cargada de la biblioteca: «{task.from_library.name}». Lo que cambies aquí vale solo para esta sesión.</p>}
          {task.library_saved && <p className="text-[11px] text-green-700 -mt-1.5">Guardada en la biblioteca como «{task.library_saved.name}».</p>}

          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_220px] gap-3">
            <Field label="Título"><Input value={task.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ej: Juego de posición 6v6+3" className={`${inputCls} font-semibold`} /></Field>
            <Field label="Tipo de tarea">
              <Select value={task.type || ""} onValueChange={(v) => v && set({ type: v })}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="Elegir tipo…" /></SelectTrigger>
                <SelectContent>
                  {GROUPS.map((g) => (
                    <SelectGroup key={g}>
                      <SelectLabel>{GROUP_LABEL[g]}</SelectLabel>
                      {TASK_TYPES.filter((t) => t.group === g).map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-[repeat(4,minmax(0,1fr))_1.4fr] gap-3 items-end">
            <Field label="Series"><Input type="number" inputMode="decimal" min={1} value={task.series} onChange={(e) => nums("series", e.target.value)} className={inputCls} /></Field>
            <Field label="Min. por serie"><Input type="number" inputMode="decimal" min={0} step="0.5" value={task.serie_min} onChange={(e) => nums("serie_min", e.target.value)} className={inputCls} /></Field>
            <Field label="Recuperación (min)"><Input type="number" inputMode="decimal" min={0} step="0.5" value={task.rec_min} onChange={(e) => nums("rec_min", e.target.value)} className={inputCls} /></Field>
            <Field label="Total"><Input type="number" inputMode="decimal" min={0} step="0.5" value={task.total_override} onChange={(e) => nums("total_override", e.target.value)} placeholder={`${taskMinutes({ ...task, total_override: "" }) || ""} (auto)`} className={`${inputCls} bg-[#FBF8F8] font-bold`} /></Field>
            <p className="text-xs pb-2.5 col-span-2 sm:col-span-1" style={{ color: C.muted }}>{seriesLabel(task) ? `${seriesLabel(task)}${Number(task.series) > 1 && rec ? ` + ${Math.round(Number(task.series)) - 1} recuperaciones de ${recText(rec)}` : ""}` : "Series × minutos + recuperaciones"}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Espacio"><Input value={task.space || ""} onChange={(e) => set({ space: e.target.value })} placeholder="40 × 35 m" className={inputCls} /></Field>
            <Field label="Jugadores"><Input value={task.players_n || ""} onChange={(e) => set({ players_n: e.target.value })} placeholder="15 (6v6 + 3 comodines)" className={inputCls} /></Field>
            <Field label="Material"><Input value={task.material || ""} onChange={(e) => set({ material: e.target.value })} placeholder="12 conos, petos de 3 colores…" className={inputCls} /></Field>
          </div>

          <Field label="Descripción"><Textarea value={task.description} onChange={(e) => set({ description: e.target.value })} rows={3} className={`${inputCls} leading-relaxed`} placeholder={"Una línea por punto:\nDos equipos de 6 y 3 comodines…"} /></Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Objetivo de la tarea"><Input value={task.objective} onChange={(e) => set({ objective: e.target.value })} placeholder="Encontrar al hombre libre y progresar por dentro" className={inputCls} /></Field>
            <div className="flex flex-col gap-1.5">
              <Lab>Fase del juego</Lab>
              <div className="flex flex-wrap gap-1.5">
                {PHASES.map((p) => <Pill key={p.id} on={phaseSet.has(p.id)} onClick={() => togglePhase(p.id)}>{p.label}</Pill>)}
                <Pill on={allGame} dashed color={C.soft} onClick={toggleAll} data-testid="phase-all">Todas</Pill>
              </div>
            </div>
          </div>

          <div className="rounded-[10px] px-3.5 py-3 flex flex-col gap-2.5" style={{ background: C.pale, border: `1px solid ${C.paleLine}` }}>
            <div className="flex flex-wrap items-center gap-2.5">
              <D size={16} style={{ color: C.soft, flex: 1 }}>Contenidos</D>
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer" style={{ color: C.muted }}>
                <Switch checked={!!task.no_curriculum} onCheckedChange={(v) => set({ no_curriculum: v })} /> Sin contenidos (PF, activación…)
              </label>
              {!task.no_curriculum && <SBtn small onClick={() => setPickerOpen(true)}><ListChecks className="w-3.5 h-3.5" /> {P.length + S.length ? "Cambiar contenidos" : "Elegir contenidos"}</SBtn>}
            </div>
            {!task.no_curriculum && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <Lab style={{ width: 110 }}>Principales {P.length}/2</Lab>
                  {P.map((id) => <ContentChip key={id} id={id} stage={stage} kind="principal" task={task} onRemove={() => set({ principal: P.filter((x) => x !== id) })} />)}
                  {P.length > 0 && mins > 0 && <span className="text-xs" style={{ color: C.muted }}>{fmtMin(mins)} a cada uno</span>}
                  {!P.length && <span className="text-xs" style={{ color: C.muted }}>Ninguno</span>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Lab style={{ width: 110 }}>Secundarios {S.length}/2</Lab>
                  {S.map((id) => <ContentChip key={id} id={id} stage={stage} kind="secondary" task={task} onRemove={() => set({ secondary: S.filter((x) => x !== id) })} />)}
                  {S.length > 0 && mins > 0 && <span className="text-xs" style={{ color: C.muted }}>{fmtMin(mins)} cada uno, como secundario</span>}
                  {!S.length && <span className="text-xs" style={{ color: C.muted }}>Ninguno</span>}
                </div>
              </>
            )}
          </div>

          <Field label="Correcciones"><Textarea value={task.corrections} onChange={(e) => set({ corrections: e.target.value })} rows={3} className={`${inputCls} leading-relaxed`} placeholder="Perfil abierto antes de recibir. Apoyo de costado…" /></Field>

          <div className="flex flex-col gap-2" data-testid="task-staff">
            <div className="flex items-center gap-2.5">
              <Lab style={{ flex: 1 }}>Cuerpo técnico en la tarea</Lab>
              {prevStaff?.length > 0 && roles.length === 0
                ? <button type="button" className="text-xs font-semibold hover:underline" style={{ color: C.granate }} onClick={() => set({ staff_roles: prevStaff.map((r) => ({ ...r })) })}>Copiar el de la tarea anterior</button>
                : <span className="text-xs" style={{ color: C.muted }}>Quién está y de qué se encarga</span>}
            </div>
            {roles.map((r, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[190px_190px_minmax(0,1fr)_28px] gap-2 items-center" data-testid={`staff-row-${i}`}>
                <Select value={r.role} onValueChange={(v) => v && setRole(i, { role: v })}>
                  <SelectTrigger className={`${inputCls} h-9 font-semibold`}><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_STAFF_ROLES.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={r.name || ""} onChange={(e) => setRole(i, { name: e.target.value })} placeholder="Nombre" list="session-staff-names" className={`${inputCls} h-9`} />
                <Input value={r.aspect || ""} onChange={(e) => setRole(i, { aspect: e.target.value })} placeholder="De qué se encarga" className={`${inputCls} h-9`} />
                <button type="button" onClick={() => removeRole(i)} className="p-1 rounded hover:bg-gray-100" style={{ color: "#9A8C8E" }} aria-label="Quitar"><X className="w-4 h-4" /></button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs" style={{ color: C.muted }}>Añadir:</span>
              {TASK_STAFF_ROLES.map((x) => (
                <Pill key={x.id} onClick={() => addRole(x.id)} className="!py-[3px]" data-testid={`staff-add-${x.id}`}><Plus className="w-3 h-3" />{x.label}</Pill>
              ))}
            </div>
            <datalist id="session-staff-names">{staffNames.map((n) => <option key={n} value={n} />)}</datalist>
            {hasText(task.staff_corrections) && (
              <Field label="Correcciones por entrenador (formato antiguo)"><Textarea value={task.staff_corrections} onChange={(e) => set({ staff_corrections: e.target.value })} rows={2} className={inputCls} /></Field>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3.5 items-start">
            <div className="flex flex-col gap-1.5 min-w-0">
              <Lab>Dibujo · la pizarra de siempre</Lab>
              <PitchBoard value={task.board} onChange={(board) => set({ board })} roster={roster} filename={task.title || "tarea"} />
              {task.diagram_url && (
                <div className="mt-1 flex items-center gap-2">
                  <img src={task.diagram_url} alt="Imagen de la tarea" className="h-14 rounded border border-gray-200 bg-white object-contain" />
                  <span className="text-[11px] flex-1" style={{ color: C.muted }}>Imagen que venía de la biblioteca{hasBoard(task.board) ? ": en la hoja sale el dibujo de la pizarra." : "."}</span>
                  <button type="button" className="text-[11px] text-red-600 underline" onClick={() => set({ diagram_url: "" })}>Quitar imagen</button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2.5">
              <Field label="Equipos"><Textarea value={task.teams_text || ""} onChange={(e) => set({ teams_text: e.target.value })} rows={3} className={`${inputCls} leading-relaxed`} placeholder={"Granate: Marc, Pol, Biel…\nAzul: Pau, Arnau…\nComodines: Martí, Iker"} /></Field>
              <Field label="Puntuación"><Textarea value={task.scoring} onChange={(e) => set({ scoring: e.target.value })} rows={2} className={inputCls} placeholder="6 pases = 1 punto · cambio de orientación = 2" /></Field>
            </div>
          </div>

          {warns.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 space-y-1">
              {warns.map((w) => <p key={w} className="text-xs text-amber-800 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{w}</p>)}
            </div>
          )}

          <div className="flex items-center justify-end gap-1">
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
        principal={P}
        secondary={S}
        custom={task.custom_contents || {}}
        onChange={(patch) => set(patch)}
      />
    </div>
  );
}
