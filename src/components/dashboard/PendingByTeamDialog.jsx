import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, ChevronRight, ClipboardCheck, Trophy, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { totalsOf } from "@/lib/pendingByTeam";

const KINDS = [
  { value: "all", label: "Todo" },
  { value: "trainings", label: "Entrenos" },
  { value: "matches", label: "Partidos" },
];
const display = { fontFamily: "var(--font-display)" };
const when = (d) => format(new Date(d), "EEE d MMM · HH:mm", { locale: es });
const matchLink = (m) => `/MatchDetail?id=${m.event.id}&teamId=${m.event.team_id}${m.tab ? `&tab=${m.tab}` : ""}`;
const trainingLink = (ev) => `/MyTeam/Attendance?eventId=${ev.id}&teamId=${ev.team_id}`;

/**
 * Listado por equipos de lo que está sin registrar (entrenos sin asistencia y partidos sin gestionar).
 * rows: salida de groupPendingByTeam. kind: "all" | "trainings" | "matches" (qué alerta se pulsó).
 */
export default function PendingByTeamDialog({ open, onOpenChange, rows, kind: initialKind = "all" }) {
  const [kind, setKind] = useState(initialKind);
  const [expanded, setExpanded] = useState(() => new Set());
  useEffect(() => { if (open) { setKind(initialKind); setExpanded(new Set()); } }, [open, initialKind]);

  const visible = useMemo(() => {
    return rows
      .map((r) => {
        const trainings = kind === "matches" ? [] : r.trainings;
        const matches = kind === "trainings" ? [] : r.matches;
        return { ...r, trainings, matches, total: trainings.length + matches.length };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total); // estable: a igual número se mantiene el orden del club
  }, [rows, kind]);
  const totals = totalsOf(visible);
  const toggle = (key) => setExpanded((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const isOpen = (key) => expanded.has(key) || visible.length === 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-100 space-y-1">
          <DialogTitle className="text-sm font-black uppercase tracking-[0.12em]" style={{ ...display, color: "var(--granate)" }}>Pendientes por equipo</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Todo el club · {visible.length} {visible.length === 1 ? "equipo" : "equipos"}
            {kind !== "matches" && ` · ${totals.trainings} ${totals.trainings === 1 ? "entreno sin asistencia" : "entrenos sin asistencia"}`}
            {kind !== "trainings" && ` · ${totals.matches} ${totals.matches === 1 ? "partido sin gestionar" : "partidos sin gestionar"}`}
          </DialogDescription>
          <div className="flex gap-1 pt-1">
            {KINDS.map((k) => (
              <button key={k.value} type="button" onClick={() => setKind(k.value)}
                className={`h-7 px-3 text-[11px] font-bold rounded-md border ${kind === k.value ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"}`}>
                {k.label}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {visible.length === 0 && (
            <div className="px-5 py-8 flex items-center justify-center gap-1.5 text-sm font-semibold text-green-700">
              <CheckCircle2 className="w-4 h-4" /> Todos los equipos al día
            </div>
          )}
          {visible.map((r) => {
            const key = r.teamId || r.name;
            const open = isOpen(key);
            return (
              <div key={key}>
                <button type="button" onClick={() => toggle(key)} className="w-full px-5 py-2.5 flex items-center gap-3 text-left hover:bg-gray-50">
                  {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                  <span className="flex-1 min-w-0 truncate font-bold text-[13px] text-gray-900" style={display}>{r.name}</span>
                  {r.trainings.length > 0 && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700" title="Entrenos sin asistencia">
                      <ClipboardCheck className="w-3.5 h-3.5" /> {r.trainings.length}
                    </span>
                  )}
                  {r.matches.length > 0 && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--granate)]" title="Partidos sin gestionar">
                      <Trophy className="w-3.5 h-3.5" /> {r.matches.length}
                    </span>
                  )}
                </button>

                {open && (
                  <div className="pb-2 bg-gray-50/60">
                    {r.trainings.length > 0 && (
                      <div>
                        <p className="px-5 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-gray-400">Entrenos sin asistencia</p>
                        {r.trainings.map((ev) => (
                          <Link key={ev.id} to={trainingLink(ev)} className="flex items-center gap-2 px-5 pl-9 py-1.5 hover:bg-white group">
                            <span className="w-32 shrink-0 text-xs font-semibold text-gray-600 capitalize">{when(ev.date)}</span>
                            <span className="flex-1 min-w-0 truncate text-[13px] text-gray-900">{ev.title || "Entrenamiento"}</span>
                            <span className="text-[11px] font-bold whitespace-nowrap opacity-70 group-hover:opacity-100" style={{ color: "var(--granate)" }}>Pasar lista →</span>
                          </Link>
                        ))}
                      </div>
                    )}
                    {r.matches.length > 0 && (
                      <div>
                        <p className="px-5 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-gray-400">Partidos</p>
                        {r.matches.map((m) => (
                          <Link key={m.event.id} to={matchLink(m)} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 pl-9 py-1.5 hover:bg-white group">
                            <span className="w-32 shrink-0 text-xs font-semibold text-gray-600 capitalize">{when(m.event.date)}</span>
                            <span className="flex-1 min-w-0 truncate text-[13px] text-gray-900">{m.event.opponent || m.event.title || "Rival"}</span>
                            {/* En móvil los motivos bajan a una segunda línea */}
                            <span className="flex flex-wrap gap-1 order-last w-full pl-[8.5rem] sm:order-none sm:w-auto sm:pl-0 sm:justify-end sm:shrink-0">
                              {m.reasons.map((reason) => (
                                <span key={reason} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">{reason}</span>
                              ))}
                            </span>
                            <span className="text-[11px] font-bold whitespace-nowrap opacity-70 group-hover:opacity-100" style={{ color: "var(--granate)" }}>Ver →</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
