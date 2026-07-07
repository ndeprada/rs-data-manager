import React from "react";
import { Clock, Zap, Edit2, Trash2, Plus } from "lucide-react";
import { getGameMoment, getSessionPhase, getDifficulty } from "./methodologyConfig";

export default function TaskCard({ task, onEdit, onDelete, onAddToSession, compact = false }) {
  const moment = getGameMoment(task.game_moment);
  const phase = getSessionPhase(task.session_phase);
  const diff = getDifficulty(task.difficulty);

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors group">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: moment.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{task.name}</p>
          <p className="text-[10px] text-gray-400">{task.duration_minutes}min · {moment.label}</p>
        </div>
        {onAddToSession && (
          <button onClick={() => onAddToSession(task)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded bg-gray-100 hover:bg-gray-200 transition-all">
            <Plus className="w-3 h-3 text-gray-600" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      {/* Phase color strip */}
      <div className="h-1 w-full" style={{ background: phase.color }} />

      {/* Diagram/image preview */}
      {task.diagram_url && (
        <div className="h-32 overflow-hidden bg-gray-50">
          <img src={task.diagram_url} alt={task.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
              {task.name}
            </h3>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
              {phase.label}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            {onEdit && (
              <button onClick={() => onEdit(task)} className="p-1 rounded hover:bg-gray-100 transition-colors">
                <Edit2 className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(task)} className="p-1 rounded hover:bg-red-50 transition-colors">
                <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
              </button>
            )}
          </div>
        </div>

        {task.description && (
          <p className="text-xs text-gray-600 line-clamp-2">{task.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5 items-center">
          {/* Duration */}
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <Clock className="w-3 h-3" /> {task.duration_minutes || "—"}min
          </span>

          {/* Game moment */}
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: moment.bg, color: moment.color, fontFamily: "var(--font-display)" }}>
            {moment.label}
          </span>

          {/* Difficulty */}
          <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: `${diff.color}18`, color: diff.color, fontFamily: "var(--font-display)" }}>
            <Zap className="w-2.5 h-2.5" /> {diff.label}
          </span>
        </div>

        {/* Media count */}
        {task.media_files?.length > 0 && (
          <p className="text-[10px] text-gray-400">{task.media_files.length} archivo(s) adjunto(s)</p>
        )}

        {onAddToSession && (
          <button onClick={() => onAddToSession(task)}
            className="w-full text-xs py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1.5">
            <Plus className="w-3 h-3" /> Añadir a sesión
          </button>
        )}
      </div>
    </div>
  );
}