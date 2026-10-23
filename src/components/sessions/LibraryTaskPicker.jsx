import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Library, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { hasBoard } from "@/lib/board";
import { filterLibraryTasks } from "@/lib/taskLibrary";
import { SESSION_PHASES, getGameMoment } from "@/components/methodology/methodologyConfig";
import { PitchView } from "./PitchBoard";

const TYPE_LABEL = {
  parejas: "Parejas", analitico: "Analítico", finalizaciones: "Finalizaciones", figura_pases: "Figura de pases", rondo: "Rondo",
  juego_posicion: "Juego de posición", juego_aplicacion: "Juego de aplicación", juego_posesion: "Juego de posesión", juego_situacion: "Juego de situación",
  partido: "Partido", partido_reducido: "Partido reducido", abp: "ABP", preparacion_partido: "Preparación de partido", juego: "Juego", activacion_sin_balon: "Activación sin balón",
};

const Thumb = ({ task }) => (
  <div className="w-24 h-16 shrink-0 rounded-md border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
    {hasBoard(task.board) ? <PitchView board={task.board} style={{ height: "100%", width: "auto", maxWidth: "100%" }} />
      : task.diagram_url ? <img src={task.diagram_url} alt="" className="w-full h-full object-cover" />
        : <Library className="w-5 h-5 text-gray-300" aria-hidden="true" />}
  </div>
);

/**
 * Elegir una tarea de la biblioteca de Metodología para llevarla a la sesión.
 * part       "inicial" | "principal": decide la fase que se muestra primero (calentamiento / parte principal)
 * onPick(t)  recibe la tarea de la biblioteca elegida
 */
export default function LibraryTaskPicker({ open, onOpenChange, part = "principal", onPick, title = "Cargar una tarea de la biblioteca" }) {
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState(null);
  const current = phase ?? (part === "inicial" ? "calentamiento" : "parte_principal");
  // Cada vez que se abre empieza limpio: sin la búsqueda ni el filtro de la vez anterior
  useEffect(() => { if (open) { setQ(""); setPhase(null); } }, [open]);
  const { data: tasks = [], isLoading, isError } = useQuery({
    queryKey: ["training_tasks"],
    queryFn: () => base44.entities.TrainingTask.list("-created_date", 300),
    enabled: open,
  });
  const list = useMemo(() => filterLibraryTasks(tasks, { query: q, phase: current }), [tasks, q, current]);
  const phases = [{ value: "", label: "Todas" }, ...SESSION_PHASES];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 shrink-0">
          <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{title}</DialogTitle>
          <DialogDescription className="text-xs">
            Se copia a la sesión: lo que cambies aquí no modifica la tarea de la biblioteca.
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 pb-2 space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, descripción o etiqueta…" className="pl-8" aria-label="Buscar tarea" />
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Fase de la sesión">
            {phases.map((p) => (
              <button key={p.value} type="button" aria-pressed={current === p.value} onClick={() => setPhase(p.value)}
                className={`h-7 px-2.5 rounded-full border text-xs font-semibold ${current === p.value ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
          {isLoading && <p className="text-sm text-gray-400 py-6 text-center">Cargando la biblioteca…</p>}
          {isError && <p className="text-sm text-red-600 py-6 text-center" role="alert">No se pudo leer la biblioteca de tareas.</p>}
          {!isLoading && !isError && !tasks.length && <p className="text-sm text-gray-500 py-6 text-center">La biblioteca todavía no tiene tareas. Se crean en Metodología → Biblioteca de tareas, o desde una tarea de la sesión con «Guardar en la biblioteca».</p>}
          {!isLoading && !isError && tasks.length > 0 && !list.length && <p className="text-sm text-gray-500 py-6 text-center">Ninguna tarea coincide{current ? ". Prueba con «Todas» las fases." : "."}</p>}
          {list.map((t) => {
            const moment = getGameMoment(t.game_moment);
            return (
              <button key={t.id} type="button" onClick={() => { onPick(t); onOpenChange(false); }}
                className="w-full text-left flex gap-2.5 items-center p-2 rounded-lg border border-gray-200 hover:border-[var(--granate)] hover:bg-[var(--granate-pale)]/40 transition-colors">
                <Thumb task={t} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold truncate" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{t.name}</span>
                  <span className="block text-[11px] text-gray-500 truncate">
                    {[t.duration_minutes ? `${t.duration_minutes}’` : "", TYPE_LABEL[t.task_type], t.game_moment && t.game_moment !== "ninguno" ? moment.label : "", t.players_count ? `${t.players_count} jug.` : ""].filter(Boolean).join(" · ")}
                  </span>
                  {t.description && <span className="block text-[11px] text-gray-400 truncate">{t.description}</span>}
                </span>
                <span className="text-xs font-bold text-[var(--granate)] shrink-0">Cargar</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
