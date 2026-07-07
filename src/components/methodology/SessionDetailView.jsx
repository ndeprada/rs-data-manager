import React, { useState } from "react";
import { GAME_MOMENTS, SESSION_PHASES, getGameMoment, getSessionPhase } from "./methodologyConfig";
import { Clock, Printer, ChevronLeft, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

// Resolve task data: inline overrides library
function resolveTask(sessionTask, allTasks) {
  const lib = allTasks.find(t => t.id === sessionTask.task_id) || {};
  return {
    name: sessionTask.inline_name || lib.name || "Sin nombre",
    description: sessionTask.inline_description || lib.description || "",
    game_moment: sessionTask.inline_game_moment || lib.game_moment || "ninguno",
    session_phase: sessionTask.inline_session_phase || lib.session_phase || "parte_principal",
    duration_minutes: sessionTask.duration_override || lib.duration_minutes || 0,
    principles: sessionTask.inline_principles || lib.principles || "",
    sub_principles: sessionTask.inline_sub_principles || lib.sub_principles || "",
    corrections: sessionTask.inline_corrections || lib.corrections || "",
    scoring: sessionTask.inline_scoring || lib.scoring || "",
    coaching_1e: sessionTask.inline_coaching_1e || lib.coaching_points_1e || "",
    coaching_eam: sessionTask.inline_coaching_eam || lib.coaching_points_ea_m || "",
    coaching_eai: sessionTask.inline_coaching_eai || lib.coaching_points_ea_i || "",
    diagram_url: sessionTask.inline_diagram_url || lib.diagram_url || "",
    space: sessionTask.inline_space || lib.space || "",
    players_count: lib.players_count || "",
  };
}

function TaskColumn({ sessionTask, allTasks, index, onUpdateDiagram }) {
  const t = resolveTask(sessionTask, allTasks);
  const moment = getGameMoment(t.game_moment);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleDiagramUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onUpdateDiagram(sessionTask.task_id || index, file_url);
    setUploading(false);
    toast({ title: "Diagrama subido" });
  };

  return (
    <div className="border border-gray-300 rounded flex flex-col overflow-hidden bg-white" style={{ minWidth: 0 }}>
      {/* Header: name + duration + moment */}
      <div className="px-2 py-1.5 border-b border-gray-300" style={{ background: moment.bg }}>
        <p className="text-xs font-black uppercase leading-tight" style={{ fontFamily: "var(--font-display)", color: moment.color }}>
          {t.name}
          {t.space && <span className="font-normal text-[10px] ml-1">· {t.space}</span>}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] font-bold" style={{ color: moment.color }}>{moment.label}</span>
          {t.duration_minutes > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-500"><Clock className="w-2.5 h-2.5" />{t.duration_minutes}min</span>
          )}
        </div>
      </div>

      <div className="flex-1 p-2 space-y-2 text-xs">
        {/* Description / Tasks */}
        {t.description && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-0.5" style={{ fontFamily: "var(--font-display)" }}>Descripción</p>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{t.description}</p>
          </div>
        )}

        {/* Principles */}
        {(t.principles || t.sub_principles) && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-0.5" style={{ fontFamily: "var(--font-display)" }}>Principios / Subprincipios</p>
            {t.principles && <p className="text-gray-700 whitespace-pre-line">{t.principles}</p>}
            {t.sub_principles && <p className="text-gray-600 whitespace-pre-line mt-0.5">{t.sub_principles}</p>}
          </div>
        )}

        {/* Corrections */}
        {t.corrections && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-0.5" style={{ fontFamily: "var(--font-display)" }}>Correcciones</p>
            <p className="text-gray-700 whitespace-pre-line">{t.corrections}</p>
          </div>
        )}

        {/* Coaching points */}
        {(t.coaching_1e || t.coaching_eam || t.coaching_eai) && (
          <div className="border-t border-gray-100 pt-1.5 space-y-1">
            {t.coaching_1e && (
              <div className="flex gap-1.5">
                <span className="text-[9px] font-black shrink-0" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>1E N:</span>
                <span className="text-[10px] text-gray-600">{t.coaching_1e}</span>
              </div>
            )}
            {t.coaching_eam && (
              <div className="flex gap-1.5">
                <span className="text-[9px] font-black shrink-0" style={{ fontFamily: "var(--font-display)", color: "var(--naranja)" }}>EA M:</span>
                <span className="text-[10px] text-gray-600">{t.coaching_eam}</span>
              </div>
            )}
            {t.coaching_eai && (
              <div className="flex gap-1.5">
                <span className="text-[9px] font-black shrink-0" style={{ fontFamily: "var(--font-display)", color: "#2563eb" }}>EA I:</span>
                <span className="text-[10px] text-gray-600">{t.coaching_eai}</span>
              </div>
            )}
          </div>
        )}

        {/* Scoring */}
        {t.scoring && (
          <div className="bg-gray-50 border border-gray-200 rounded p-1.5">
            <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-0.5" style={{ fontFamily: "var(--font-display)" }}>Puntuación</p>
            <p className="text-gray-700 whitespace-pre-line">{t.scoring}</p>
          </div>
        )}

        {/* Diagram */}
        {t.diagram_url ? (
          <div className="border border-gray-200 rounded overflow-hidden bg-gray-50 mt-1">
            <img src={t.diagram_url} alt="diagrama" className="w-full object-contain max-h-36" />
          </div>
        ) : (
          <label className="flex items-center justify-center gap-1.5 border border-dashed border-gray-200 rounded p-2 cursor-pointer hover:border-gray-400 transition-colors text-[10px] text-gray-400 mt-1">
            {uploading ? "Subiendo..." : <><Upload className="w-3 h-3" />Subir diagrama</>}
            <input type="file" accept="image/*" onChange={handleDiagramUpload} className="hidden" disabled={uploading} />
          </label>
        )}
      </div>
    </div>
  );
}

export default function SessionDetailView({ session, allTasks, allPlayers = [], team, onBack, onEdit, onUpdateSession }) {
  const { toast } = useToast();

  if (!session) return null;

  const sessionTaskEntries = session.tasks || [];

  // Group by phase
  const tasksByPhase = SESSION_PHASES.map(phase => ({
    phase,
    tasks: sessionTaskEntries.filter(st => {
      const resolved = resolveTask(st, allTasks);
      return resolved.session_phase === phase.value;
    })
  })).filter(g => g.tasks.length > 0);

  const handleUpdateDiagram = async (taskKey, diagramUrl) => {
    const updatedTasks = sessionTaskEntries.map((st, i) => {
      const key = st.task_id || i;
      if (key === taskKey) return { ...st, inline_diagram_url: diagramUrl };
      return st;
    });
    onUpdateSession({ ...session, tasks: updatedTasks });
  };

  const handlePrint = () => {
    window.print();
  };

  const dateStr = session.date ? format(parseISO(session.date), "EEEE d 'de' MMMM yyyy", { locale: es }) : "";
  const totalMin = session.total_duration_minutes || sessionTaskEntries.reduce((s, st) => {
    const t = resolveTask(st, allTasks);
    return s + (t.duration_minutes || 0);
  }, 0);

  // Part principal tasks (for column layout)
  const mainTasks = sessionTaskEntries.filter(st => {
    const r = resolveTask(st, allTasks);
    return r.session_phase === "parte_principal";
  });
  const warmupTasks = sessionTaskEntries.filter(st => {
    const r = resolveTask(st, allTasks);
    return r.session_phase === "calentamiento";
  });
  const cooldownTasks = sessionTaskEntries.filter(st => {
    const r = resolveTask(st, allTasks);
    return r.session_phase === "vuelta_calma";
  });

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center gap-3 print:hidden">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <div className="flex-1" />
        <Button variant="outline" onClick={handlePrint} className="gap-1.5 text-xs">
          <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
        </Button>
        {onEdit && (
          <Button onClick={onEdit} className="gap-1.5 text-xs text-white" style={{ background: "var(--granate)" }}>
            Editar Sesión
          </Button>
        )}
      </div>

      {/* SESSION SHEET */}
      <div className="bg-white border border-gray-300 rounded overflow-hidden print:shadow-none" id="session-sheet">

        {/* ── HEADER ── */}
        <div className="border-b-2 border-gray-800 px-3 py-2 flex flex-wrap gap-x-6 gap-y-1 items-center" style={{ background: "var(--granate)" }}>
          <span className="text-white font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)" }}>
            {team?.name || "—"}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase text-white/60" style={{ fontFamily: "var(--font-display)" }}>FECHA</span>
            <span className="text-white text-xs font-bold capitalize" style={{ fontFamily: "var(--font-display)" }}>{dateStr}</span>
          </div>
          {session.session_label && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase text-white/60" style={{ fontFamily: "var(--font-display)" }}>SESIÓN</span>
              <span className="text-white text-xs font-black px-1.5 py-0.5 rounded" style={{ background: "var(--naranja)", fontFamily: "var(--font-display)" }}>{session.session_label}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase text-white/60" style={{ fontFamily: "var(--font-display)" }}>TIEMPO</span>
            <span className="text-white text-xs font-bold" style={{ fontFamily: "var(--font-display)" }}>{totalMin}'</span>
          </div>
          {session.match_reference && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[9px] font-black uppercase text-white/60" style={{ fontFamily: "var(--font-display)" }}>PARTIDO</span>
              <span className="text-white text-xs" style={{ fontFamily: "var(--font-display)" }}>{session.match_reference}</span>
            </div>
          )}
        </div>

        {/* ── OBJECTIVES ── */}
        {(session.objectives_atk || session.objectives_def) && (
          <div className="border-b border-gray-200 px-3 py-2 grid grid-cols-2 gap-3">
            {session.objectives_atk && (
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider" style={{ fontFamily: "var(--font-display)", color: "#2563eb" }}>ATQ</span>
                <p className="text-xs text-gray-700 mt-0.5">{session.objectives_atk}</p>
              </div>
            )}
            {session.objectives_def && (
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>DEF</span>
                <p className="text-xs text-gray-700 mt-0.5">{session.objectives_def}</p>
              </div>
            )}
          </div>
        )}

        {/* ── WARM-UP ── */}
        {warmupTasks.length > 0 && (
          <div className="border-b border-gray-200">
            <div className="px-3 py-1.5 border-b border-gray-200" style={{ background: "#fef3c7" }}>
              <span className="text-[10px] font-black uppercase tracking-wider" style={{ fontFamily: "var(--font-display)", color: "#d97706" }}>
                Parte Inicial [{warmupTasks.reduce((s, st) => s + (resolveTask(st, allTasks).duration_minutes || 0), 0)}']
              </span>
            </div>
            <div className={`p-3 grid gap-3`} style={{ gridTemplateColumns: `repeat(${Math.max(warmupTasks.length, 1)}, minmax(0, 1fr))` }}>
              {warmupTasks.map((st, i) => (
                <TaskColumn key={st.task_id || i} sessionTask={st} allTasks={allTasks} index={i} onUpdateDiagram={handleUpdateDiagram} />
              ))}
              {/* Initial plan box */}
              {session.initial_plan && (
                <div className="border border-gray-200 rounded p-2 bg-gray-50">
                  <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1" style={{ fontFamily: "var(--font-display)" }}>Plan de Partido + Activ.</p>
                  <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{session.initial_plan}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Only initial plan, no warmup tasks */}
        {warmupTasks.length === 0 && session.initial_plan && (
          <div className="border-b border-gray-200">
            <div className="px-3 py-1.5 border-b border-gray-200" style={{ background: "#fef3c7" }}>
              <span className="text-[10px] font-black uppercase tracking-wider" style={{ fontFamily: "var(--font-display)", color: "#d97706" }}>Parte Inicial</span>
            </div>
            <div className="p-3">
              <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{session.initial_plan}</p>
            </div>
          </div>
        )}

        {/* ── MAIN PART ── */}
        {mainTasks.length > 0 && (
          <div className="border-b border-gray-200">
            <div className="px-3 py-1.5 border-b border-gray-200" style={{ background: "#f9f2f4" }}>
              <span className="text-[10px] font-black uppercase tracking-wider" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
                Parte Principal [{mainTasks.reduce((s, st) => s + (resolveTask(st, allTasks).duration_minutes || 0), 0)}']
              </span>
            </div>
            <div className={`p-3 grid gap-3`} style={{ gridTemplateColumns: `repeat(${Math.min(mainTasks.length, 3)}, minmax(0, 1fr))` }}>
              {mainTasks.map((st, i) => (
                <TaskColumn key={st.task_id || i} sessionTask={st} allTasks={allTasks} index={i} onUpdateDiagram={handleUpdateDiagram} />
              ))}
            </div>
          </div>
        )}

        {/* ── COOL DOWN ── */}
        {cooldownTasks.length > 0 && (
          <div>
            <div className="px-3 py-1.5 border-b border-gray-200" style={{ background: "#f3f4f6" }}>
              <span className="text-[10px] font-black uppercase tracking-wider" style={{ fontFamily: "var(--font-display)", color: "#6b7280" }}>
                Vuelta a la Calma [{cooldownTasks.reduce((s, st) => s + (resolveTask(st, allTasks).duration_minutes || 0), 0)}']
              </span>
            </div>
            <div className={`p-3 grid gap-3`} style={{ gridTemplateColumns: `repeat(${Math.min(cooldownTasks.length, 3)}, minmax(0, 1fr))` }}>
              {cooldownTasks.map((st, i) => (
                <TaskColumn key={st.task_id || i} sessionTask={st} allTasks={allTasks} index={i} onUpdateDiagram={handleUpdateDiagram} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {sessionTaskEntries.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            <p className="text-sm">Esta sesión no tiene tareas todavía.</p>
          </div>
        )}
      </div>
    </div>
  );
}