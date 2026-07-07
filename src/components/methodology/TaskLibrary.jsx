import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import TaskCard from "./TaskCard";
import TaskFormDialog from "./TaskFormDialog";
import { GAME_MOMENTS, SESSION_PHASES } from "./methodologyConfig";
import { useToast } from "@/components/ui/use-toast";

export default function TaskLibrary({ teams = [], isCoordinator }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [search, setSearch] = useState("");
  const [filterMoment, setFilterMoment] = useState("all");
  const [filterPhase, setFilterPhase] = useState("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["training_tasks"],
    queryFn: () => base44.entities.TrainingTask.list("-created_date", 300),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TrainingTask.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["training_tasks"] }); toast({ title: "Tarea creada" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TrainingTask.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["training_tasks"] }); toast({ title: "Tarea actualizada" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TrainingTask.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["training_tasks"] }); toast({ title: "Tarea eliminada" }); },
  });

  const handleSave = (form) => {
    if (editingTask) updateMutation.mutate({ id: editingTask.id, data: form });
    else createMutation.mutate(form);
    setEditingTask(null);
  };

  const handleEdit = (task) => { setEditingTask(task); setDialogOpen(true); };
  const handleNew = () => { setEditingTask(null); setDialogOpen(true); };

  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase());
    const matchMoment = filterMoment === "all" || t.game_moment === filterMoment;
    const matchPhase = filterPhase === "all" || t.session_phase === filterPhase;
    return matchSearch && matchMoment && matchPhase;
  });

  // Group by phase
  const byPhase = SESSION_PHASES.map(p => ({
    phase: p,
    items: filtered.filter(t => t.session_phase === p.value)
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tarea..." className="pl-8" />
        </div>
        <Select value={filterMoment} onValueChange={setFilterMoment}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Momento del juego" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los momentos</SelectItem>
            {GAME_MOMENTS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPhase} onValueChange={setFilterPhase}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Fase" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las fases</SelectItem>
            {SESSION_PHASES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={handleNew} className="text-white gap-1.5" style={{ background: "var(--granate)" }}>
          <Plus className="w-4 h-4" /> Nueva Tarea
        </Button>
      </div>

      {/* Stats */}
      <p className="text-xs text-gray-400">{filtered.length} tarea{filtered.length !== 1 ? "s" : ""} en la biblioteca</p>

      {/* Tasks grouped by phase */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No hay tareas en la biblioteca.</p>
          <p className="text-xs mt-1">Crea tu primera tarea para empezar a planificar sesiones.</p>
          <Button onClick={handleNew} variant="outline" className="mt-4 gap-1.5">
            <Plus className="w-4 h-4" /> Crear primera tarea
          </Button>
        </div>
      ) : (
        byPhase.map(({ phase, items }) => (
          <div key={phase.value} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: phase.color }} />
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: "var(--font-display)", color: phase.color }}>
                {phase.label} <span className="text-gray-400 font-normal">({items.length})</span>
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {items.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={handleEdit}
                  onDelete={(t) => deleteMutation.mutate(t.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        onSave={handleSave}
        teams={teams}
      />
    </div>
  );
}