import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, X, GripVertical, Clock, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { GAME_MOMENTS, SESSION_PHASES } from "./methodologyConfig";
import TaskCard from "./TaskCard";
import TaskFormDialog from "./TaskFormDialog";
import { useToast } from "@/components/ui/use-toast";

const EMPTY_SESSION = {
  title: "", team_id: "", date: new Date().toISOString().split("T")[0],
  objectives: "", main_game_moment: "mixto", notes: "",
  status: "planificada", tasks: [], season: "2025-2026"
};

export default function SessionFormDialog({ open, onOpenChange, session, onSave, teams = [] }) {
  const [form, setForm] = useState(EMPTY_SESSION);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskPhaseFilter, setTaskPhaseFilter] = useState("all");
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allTasks = [] } = useQuery({
    queryKey: ["training_tasks"],
    queryFn: () => base44.entities.TrainingTask.list("-created_date", 300),
    enabled: open,
  });

  useEffect(() => {
    if (session) setForm({ ...EMPTY_SESSION, ...session });
    else setForm(EMPTY_SESSION);
  }, [session, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Session tasks with full task data
  const sessionTasksWithData = (form.tasks || []).map(st => {
    const taskData = allTasks.find(t => t.id === st.task_id);
    return { ...st, taskData };
  }).filter(st => st.taskData);

  const totalMinutes = sessionTasksWithData.reduce((sum, st) =>
    sum + (st.duration_override || st.taskData?.duration_minutes || 0), 0);

  // Minutes by game moment
  const minutesByMoment = {};
  sessionTasksWithData.forEach(st => {
    const mins = st.duration_override || st.taskData?.duration_minutes || 0;
    const m = st.taskData?.game_moment || "ninguno";
    minutesByMoment[m] = (minutesByMoment[m] || 0) + mins;
  });

  const addTask = (task) => {
    const alreadyIn = form.tasks.some(t => t.task_id === task.id);
    if (alreadyIn) { toast({ title: "Esta tarea ya está en la sesión" }); return; }
    const newEntry = { task_id: task.id, order: form.tasks.length + 1, duration_override: null, notes: "" };
    set("tasks", [...form.tasks, newEntry]);
  };

  const removeTask = (taskId) => {
    set("tasks", form.tasks.filter(t => t.task_id !== taskId).map((t, i) => ({ ...t, order: i + 1 })));
  };

  const updateTaskDuration = (taskId, value) => {
    set("tasks", form.tasks.map(t =>
      t.task_id === taskId ? { ...t, duration_override: value ? Number(value) : null } : t
    ));
  };

  const filteredLibrary = allTasks.filter(t => {
    const matchSearch = !taskSearch || t.name.toLowerCase().includes(taskSearch.toLowerCase());
    const matchPhase = taskPhaseFilter === "all" || t.session_phase === taskPhaseFilter;
    return matchSearch && matchPhase;
  });

  const handleCreateTask = async (taskData) => {
    const created = await base44.entities.TrainingTask.create(taskData);
    queryClient.invalidateQueries({ queryKey: ["training_tasks"] });
    // Auto-add to session
    const newEntry = { task_id: created.id, order: form.tasks.length + 1, duration_override: null, notes: "" };
    set("tasks", [...form.tasks, newEntry]);
    toast({ title: `Tarea "${created.name}" creada y añadida a la sesión` });
  };

  const handleSave = () => {
    if (!form.title.trim()) { toast({ title: "El título es obligatorio", variant: "destructive" }); return; }
    if (!form.team_id) { toast({ title: "Selecciona un equipo", variant: "destructive" }); return; }
    const minutesSummary = {};
    sessionTasksWithData.forEach(st => {
      const mins = st.duration_override || st.taskData?.duration_minutes || 0;
      const m = st.taskData?.game_moment || "ninguno";
      minutesSummary[m] = (minutesSummary[m] || 0) + mins;
    });
    onSave({
      ...form,
      total_duration_minutes: totalMinutes,
      minutes_by_game_moment: minutesSummary,
    });
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
            {session ? "Editar Sesión" : "Nueva Sesión de Entrenamiento"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4 min-h-0">
          {/* LEFT: session details */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Título *</Label>
                <Input value={form.title} onChange={e => set("title", e.target.value)}
                  placeholder="Ej: Sesión pressing alto - Jornada 12" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Equipo *</Label>
                <Select value={form.team_id} onValueChange={v => set("team_id", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar equipo" /></SelectTrigger>
                  <SelectContent>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Fecha</Label>
                <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Momento principal</Label>
                <Select value={form.main_game_moment} onValueChange={v => set("main_game_moment", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixto">Mixto</SelectItem>
                    {GAME_MOMENTS.filter(m => m.value !== "ninguno").map(m =>
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Estado</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planificada">Planificada</SelectItem>
                    <SelectItem value="realizada">Realizada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Session label + match ref */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Etiqueta sesión</Label>
                <Input value={form.session_label || ""} onChange={e => set("session_label", e.target.value)}
                  placeholder="MD-2, MD+1, VEL, FUE..." className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Partido referencia</Label>
                <Input value={form.match_reference || ""} onChange={e => set("match_reference", e.target.value)}
                  placeholder="Racing – APA 28/3 (13:10h)" className="mt-1" />
              </div>
            </div>

            {/* ATQ / DEF objectives */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-blue-600">Objetivos ATQ</Label>
                <Textarea value={form.objectives_atk || ""} onChange={e => set("objectives_atk", e.target.value)}
                  placeholder="Crear espacios en último tercio..." rows={2} className="mt-1 text-xs" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--granate)" }}>Objetivos DEF</Label>
                <Textarea value={form.objectives_def || ""} onChange={e => set("objectives_def", e.target.value)}
                  placeholder="Transición defensiva..." rows={2} className="mt-1 text-xs" />
              </div>
            </div>

            {/* Plan de partido / activación */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Plan de partido / Activación inicial</Label>
              <Textarea value={form.initial_plan || ""} onChange={e => set("initial_plan", e.target.value)}
                placeholder="Explicación plan de partido, sistema, activación ABF ofensiva..." rows={3} className="mt-1 text-xs" />
            </div>

            {/* Tasks in session */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Tareas ({sessionTasksWithData.length})
                </Label>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" /> {totalMinutes} min total
                </span>
              </div>

              {sessionTasksWithData.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400 text-sm">
                  Añade tareas desde la biblioteca →
                </div>
              ) : (
                <div className="space-y-1.5">
                  {SESSION_PHASES.map(phase => {
                    const phaseTasks = sessionTasksWithData.filter(st => st.taskData.session_phase === phase.value);
                    if (!phaseTasks.length) return null;
                    return (
                      <div key={phase.value}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-2 h-2 rounded-full" style={{ background: phase.color }} />
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: phase.color, fontFamily: "var(--font-display)" }}>
                            {phase.label}
                          </span>
                        </div>
                        {phaseTasks.map(st => (
                          <div key={st.task_id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100 mb-1">
                            <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
                                {st.taskData.name}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Input
                                type="number" min={1} max={120}
                                value={st.duration_override || st.taskData.duration_minutes || ""}
                                onChange={e => updateTaskDuration(st.task_id, e.target.value)}
                                className="w-16 h-6 text-xs text-center px-1"
                              />
                              <span className="text-[10px] text-gray-400">min</span>
                              <button onClick={() => removeTask(st.task_id)} className="p-1 rounded hover:bg-red-50 ml-1">
                                <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Minutes summary */}
              {sessionTasksWithData.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(minutesByMoment).map(([moment, mins]) => {
                    const m = GAME_MOMENTS.find(gm => gm.value === moment);
                    if (!m || !mins) return null;
                    return (
                      <span key={moment} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: m.bg, color: m.color, fontFamily: "var(--font-display)" }}>
                        {m.label}: {mins}min
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Notas</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="mt-1" />
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSave} className="flex-1 text-white" style={{ background: "var(--granate)" }}>
                {session ? "Guardar cambios" : "Crear sesión"}
              </Button>
            </div>
          </div>

          {/* RIGHT: task library sidebar */}
          <div className="w-72 shrink-0 border-l border-gray-100 pl-4 flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500" style={{ fontFamily: "var(--font-display)" }}>
                Biblioteca de Tareas
              </p>
              <Button size="sm" variant="outline" onClick={() => setNewTaskDialogOpen(true)}
                className="h-7 text-xs gap-1 px-2" style={{ borderColor: "var(--granate)", color: "var(--granate)" }}>
                <Plus className="w-3 h-3" /> Nueva
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input value={taskSearch} onChange={e => setTaskSearch(e.target.value)}
                placeholder="Buscar..." className="pl-8 h-8 text-xs" />
            </div>
            <Select value={taskPhaseFilter} onValueChange={setTaskPhaseFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las fases</SelectItem>
                {SESSION_PHASES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {filteredLibrary.map(task => (
                <TaskCard key={task.id} task={task} compact onAddToSession={addTask} />
              ))}
              {filteredLibrary.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Sin resultados</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <TaskFormDialog
      open={newTaskDialogOpen}
      onOpenChange={setNewTaskDialogOpen}
      task={null}
      onSave={handleCreateTask}
      teams={teams}
    />
    </>
  );
}