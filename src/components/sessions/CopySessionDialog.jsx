import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { allTasks, fmtMin, isBlankTask, sessionClock, sessionTypeInfo, sessionTypeName } from "@/lib/sessionPlan";
import { longDate } from "./sessionHelpers";

/** Elegir una sesión anterior para copiar sus tareas, tipo, objetivos y notas en la actual (nunca la asistencia). */
export default function CopySessionDialog({ open, onOpenChange, sessions = [], teams = [], onPick }) {
  const teamName = (id) => teams.find((t) => t.id === id)?.name || "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-lg max-h-[85vh] overflow-hidden flex flex-col" data-testid="copy-session-dialog">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Copiar de otra sesión</DialogTitle>
          <DialogDescription className="text-xs">Se copian las tareas (con dibujos y contenidos), el tipo de sesión, los objetivos y las notas. La asistencia no se copia.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {sessions.length === 0 && <p className="text-sm text-gray-400 p-4 text-center">No hay sesiones anteriores.</p>}
          {sessions.map((s) => {
            const tasks = allTasks(s).filter((t) => !isBlankTask(t));
            const mins = sessionClock(s);
            const type = sessionTypeInfo(s.session_type);
            return (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2" data-testid={`copy-from-${s.id}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{longDate(s.date)} · {teamName(s.team_id)}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {type && <span style={{ color: type.color }} className="font-bold">{sessionTypeName(type)} · </span>}
                    {tasks.length} tareas · {fmtMin(mins)}{tasks[0]?.title ? ` · ${tasks.map((t) => t.title).filter(Boolean).slice(0, 2).join(", ")}` : ""}
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => onPick(s)}>Copiar</Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
