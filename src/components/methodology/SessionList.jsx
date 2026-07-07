import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Clock, Calendar, ChevronDown, ChevronRight, Edit2, Trash2, Copy, Eye } from "lucide-react";
import SessionFormDialog from "./SessionFormDialog";
import SessionDetailView from "./SessionDetailView";
import { GAME_MOMENTS, SESSION_PHASES, SESSION_STATUS, getGameMoment } from "./methodologyConfig";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

function StatusBadge({ status }) {
  const s = SESSION_STATUS.find(x => x.value === status) || SESSION_STATUS[0];
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${s.color}18`, color: s.color, fontFamily: "var(--font-display)" }}>
      {s.label}
    </span>
  );
}

function SessionRow({ session, tasks, onEdit, onDelete, onDuplicate, onView }) {
  const [expanded, setExpanded] = useState(false);
  const moment = getGameMoment(session.main_game_moment);
  const sessionTasks = (session.tasks || []).map(st => tasks.find(t => t.id === st.task_id)).filter(Boolean);
  const momentMinutes = session.minutes_by_game_moment || {};

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpanded(e => !e)}>
        <div className="w-0.5 h-10 rounded-full shrink-0" style={{ background: moment.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
              {session.title}
            </p>
            <StatusBadge status={session.status} />
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar className="w-3 h-3" />
              {session.date ? format(parseISO(session.date), "d MMM yyyy", { locale: es }) : "—"}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" /> {session.total_duration_minutes || 0}min
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: moment.bg, color: moment.color, fontFamily: "var(--font-display)" }}>
              {moment.label}
            </span>
            <span className="text-xs text-gray-400">{sessionTasks.length} tareas</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={e => { e.stopPropagation(); onView(session); }} className="p-1.5 rounded hover:bg-blue-50" title="Ver ficha">
            <Eye className="w-3.5 h-3.5 text-blue-400" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDuplicate(session); }} className="p-1.5 rounded hover:bg-gray-100" title="Duplicar">
            <Copy className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit(session); }} className="p-1.5 rounded hover:bg-gray-100">
            <Edit2 className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(session); }} className="p-1.5 rounded hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
          </button>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-300" /> : <ChevronRight className="w-4 h-4 text-gray-300" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-3 space-y-3 bg-gray-50/50">
          {session.objectives && (
            <p className="text-xs text-gray-600"><span className="font-bold uppercase text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Objetivos: </span>{session.objectives}</p>
          )}

          {/* Minutes breakdown */}
          {Object.keys(momentMinutes).length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5" style={{ fontFamily: "var(--font-display)" }}>Distribución de minutos</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(momentMinutes).map(([m, mins]) => {
                  if (!mins) return null;
                  const gm = GAME_MOMENTS.find(x => x.value === m);
                  if (!gm) return null;
                  return (
                    <span key={m} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: gm.bg, color: gm.color, fontFamily: "var(--font-display)" }}>
                      {gm.label}: {mins}min
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Task list */}
          {sessionTasks.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5" style={{ fontFamily: "var(--font-display)" }}>Tareas</p>
              <div className="space-y-1">
                {SESSION_PHASES.map(phase => {
                  const pt = sessionTasks.filter(t => t.session_phase === phase.value);
                  if (!pt.length) return null;
                  return (
                    <div key={phase.value}>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1" style={{ color: phase.color, fontFamily: "var(--font-display)" }}>{phase.label}</span>
                      {pt.map(t => {
                        const st = session.tasks.find(x => x.task_id === t.id);
                        const dur = st?.duration_override || t.duration_minutes;
                        const gm = GAME_MOMENTS.find(m => m.value === t.game_moment);
                        return (
                          <div key={t.id} className="flex items-center gap-2 px-2 py-1 rounded text-xs bg-white border border-gray-100 mb-0.5">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: gm?.color || "#ccc" }} />
                            <span className="flex-1 font-medium">{t.name}</span>
                            <span className="text-gray-400">{dur}min</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SessionList({ teams = [], isCoordinator, defaultTeamId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [viewingSession, setViewingSession] = useState(null);
  const [filterTeam, setFilterTeam] = useState(defaultTeamId || "all");
  const [filterStatus, setFilterStatus] = useState("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["training_sessions"],
    queryFn: () => base44.entities.TrainingSession.list("-date", 200),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["training_tasks"],
    queryFn: () => base44.entities.TrainingTask.list("-created_date", 300),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TrainingSession.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["training_sessions"] }); toast({ title: "Sesión creada" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TrainingSession.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["training_sessions"] }); toast({ title: "Sesión actualizada" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TrainingSession.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["training_sessions"] }); toast({ title: "Sesión eliminada" }); },
  });

  const handleSave = (form) => {
    if (editingSession) updateMutation.mutate({ id: editingSession.id, data: form });
    else createMutation.mutate(form);
    setEditingSession(null);
  };

  const handleDuplicate = (session) => {
    const { id, created_date, updated_date, ...rest } = session;
    createMutation.mutate({ ...rest, title: `${rest.title} (copia)`, status: "planificada" });
    toast({ title: "Sesión duplicada" });
  };

  const filtered = sessions.filter(s => {
    const matchTeam = filterTeam === "all" || s.team_id === filterTeam;
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    return matchTeam && matchStatus;
  });

  // If viewing a session detail
  if (viewingSession) {
    const team = teams.find(t => t.id === viewingSession.team_id);
    return (
      <SessionDetailView
        session={viewingSession}
        allTasks={tasks}
        team={team}
        onBack={() => setViewingSession(null)}
        onEdit={() => { setEditingSession(viewingSession); setViewingSession(null); setDialogOpen(true); }}
        onUpdateSession={async (updatedSession) => {
          await updateMutation.mutateAsync({ id: updatedSession.id, data: updatedSession });
          setViewingSession(updatedSession);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {isCoordinator && (
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Todos los equipos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los equipos</SelectItem>
              {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {SESSION_STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => { setEditingSession(null); setDialogOpen(true); }} className="text-white gap-1.5" style={{ background: "var(--granate)" }}>
          <Plus className="w-4 h-4" /> Nueva Sesión
        </Button>
      </div>

      <p className="text-xs text-gray-400">{filtered.length} sesión{filtered.length !== 1 ? "es" : ""}</p>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No hay sesiones todavía.</p>
          <Button onClick={() => setDialogOpen(true)} variant="outline" className="mt-4 gap-1.5">
            <Plus className="w-4 h-4" /> Crear primera sesión
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(session => (
            <SessionRow
              key={session.id}
              session={session}
              tasks={tasks}
              onEdit={s => { setEditingSession(s); setDialogOpen(true); }}
              onDelete={s => deleteMutation.mutate(s.id)}
              onDuplicate={handleDuplicate}
              onView={s => setViewingSession(s)}
            />
          ))}
        </div>
      )}

      <SessionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        session={editingSession}
        onSave={handleSave}
        teams={teams}
      />
    </div>
  );
}