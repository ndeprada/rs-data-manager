import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Ban, RotateCcw, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { sortTeams } from "@/lib/teamOrder";
import { CANCEL_REASONS, bulkTargets, cancelPatch, restorePatch } from "@/lib/eventCancel";
import { bulkNotice } from "@/lib/cancelNotice";
import { notifyTeamsPush, pushResultText } from "@/lib/notifyTeam";

const today = () => format(new Date(), "yyyy-MM-dd");
const GROUPS = ["jugadores", "familiares", "tecnico"];

/**
 * Cancela de golpe los entrenamientos (y, si se quiere, los partidos) de uno o varios días: un festivo para todo el club,
 * un fin de semana de lluvia… Antes de confirmar se ve la lista exacta, y al terminar se puede deshacer.
 * Coordinación elige todo el club o un equipo; un entrenador, sus equipos.
 */
export default function BulkCancelDialog({ open, onOpenChange, defaultTeamId }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isCoordinator, coachTeamIds } = useTeamAccess();
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date"), enabled: open });
  const { data: allTeams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list(), enabled: open });
  const myTeams = useMemo(() => sortTeams(isCoordinator ? allTeams : allTeams.filter((t) => (coachTeamIds || []).includes(t.id))), [isCoordinator, allTeams, coachTeamIds]);

  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [reason, setReason] = useState("festivo");
  const [scope, setScope] = useState("club"); // club | team
  const [teamId, setTeamId] = useState("");
  const [includeMatches, setIncludeMatches] = useState(false);
  const [notify, setNotify] = useState(true);
  const [done, setDone] = useState(null); // { ids, notified }

  useEffect(() => {
    if (!open) return;
    setFrom(today()); setTo(today()); setReason("festivo"); setIncludeMatches(false); setNotify(true); setDone(null);
    setScope(isCoordinator && !defaultTeamId ? "club" : "team");
    setTeamId(defaultTeamId || "");
  }, [open, defaultTeamId, isCoordinator]);

  // Equipos afectados: todo el club (coordinación), un equipo, o —si un entrenador tiene varios— todos los suyos
  const scopeTeamIds = scope === "club" ? (isCoordinator ? null : myTeams.map((t) => t.id)) : teamId ? [teamId] : (isCoordinator ? [] : myTeams.map((t) => t.id));
  const targets = useMemo(() => bulkTargets(events, { from, to, teamIds: scopeTeamIds, includeMatches }), [events, from, to, scopeTeamIds, includeMatches]); // eslint-disable-line react-hooks/exhaustive-deps
  const teamName = (id) => allTeams.find((t) => t.id === id)?.name || "—";
  const affectedTeams = useMemo(() => [...new Set(targets.map((e) => e.team_id).filter(Boolean))], [targets]);

  const notice = bulkNotice({ from, to, reason, includeMatches });
  const { data: preview } = useQuery({
    queryKey: ["bulk-cancel-recipients", [...affectedTeams].sort().join(",")],
    queryFn: () => base44.club.preview({ team_ids: affectedTeams, groups: GROUPS }),
    enabled: open && !done && notify && affectedTeams.length > 0,
    staleTime: 30000,
  });
  const nobody = preview && preview.recipients === 0;

  const run = useMutation({
    mutationFn: async () => {
      const list = targets;
      for (let i = 0; i < list.length; i += 10) await Promise.all(list.slice(i, i + 10).map((e) => base44.entities.Event.update(e.id, cancelPatch(reason))));
      let notified = null, noticeError = null;
      if (notify && !nobody && affectedTeams.length > 0) {
        try {
          notified = await notifyTeamsPush({
            teamIds: affectedTeams, title: notice.title, body: notice.body,
            label: scope === "club" && isCoordinator ? "Todo el club · cancelación" : `${affectedTeams.length} equipo${affectedTeams.length === 1 ? "" : "s"} · cancelación`,
          });
        } catch (e) { noticeError = e; }
      }
      return { ids: list.map((e) => e.id), notified, noticeError };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setDone(r);
      if (r.notified) toast({ title: "Aviso enviado", description: pushResultText(r.notified) });
      if (r.noticeError) toast({ title: "Se han cancelado, pero no se pudo enviar el aviso", description: "Puedes enviarlo desde Avisos.", variant: "destructive" });
    },
  });

  const undo = useMutation({
    mutationFn: async () => {
      const ids = done.ids;
      for (let i = 0; i < ids.length; i += 10) await Promise.all(ids.slice(i, i + 10).map((id) => base44.entities.Event.update(id, restorePatch())));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); onOpenChange(false); },
  });

  const n = targets.length;
  const noun = includeMatches ? "evento" : "entreno";
  const invalidRange = !from || !to || from > to;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900 font-black text-base" style={{ fontFamily: "var(--font-display)" }}>Cancelar varios días</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">Festivo, lluvia… Los entrenos siguen en el calendario, marcados como cancelados.</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
              <span>
                {done.ids.length} {done.ids.length === 1 ? noun : `${noun}s`} cancelado{done.ids.length === 1 ? "" : "s"}.
                {done.notified ? " El aviso ya se ha enviado al móvil." : ""}
              </span>
            </p>
            {done.notified && <p className="text-xs text-gray-500">Si lo deshaces, el aviso que ya salió no se retira: avisa de nuevo desde Avisos.</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" disabled={undo.isPending} onClick={() => undo.mutate()}>
                <RotateCcw className="w-4 h-4 mr-1.5" /> {undo.isPending ? "Deshaciendo…" : "Deshacer"}
              </Button>
              <Button type="button" variant="club" className="flex-1" onClick={() => onOpenChange(false)}>Listo</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Desde</p>
                <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }}
                  className="w-full h-9 rounded-md border border-gray-200 bg-transparent text-sm shadow-sm px-1.5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Hasta</p>
                <input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-200 bg-transparent text-sm shadow-sm px-1.5" />
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Motivo</p>
              <div className="flex flex-wrap gap-1.5">
                {CANCEL_REASONS.map((r) => (
                  <button key={r.value} type="button" onClick={() => setReason(r.value)}
                    className={`h-8 px-3 text-xs font-bold rounded-md border ${reason === r.value ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Equipos</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {isCoordinator && (
                  <button type="button" onClick={() => setScope("club")}
                    className={`h-8 px-3 text-xs font-bold rounded-md border ${scope === "club" ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
                    Todo el club
                  </button>
                )}
                {(isCoordinator || myTeams.length > 1) && (
                  <button type="button" onClick={() => setScope("team")}
                    className={`h-8 px-3 text-xs font-bold rounded-md border ${scope === "team" ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
                    {isCoordinator ? "Un equipo" : "Un equipo mío"}
                  </button>
                )}
                {scope === "team" && (
                  <Select value={teamId || (isCoordinator ? "" : "__mine__")} onValueChange={(v) => setTeamId(v === "__mine__" ? "" : v)}>
                    <SelectTrigger className="h-8 w-44 text-xs border-gray-200"><SelectValue placeholder="Elige equipo…" /></SelectTrigger>
                    <SelectContent>
                      {!isCoordinator && <SelectItem value="__mine__">Todos mis equipos</SelectItem>}
                      {myTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {!isCoordinator && myTeams.length === 1 && <span className="text-xs font-semibold text-gray-700">{myTeams[0].name}</span>}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
              <Checkbox checked={includeMatches} onCheckedChange={(v) => setIncludeMatches(!!v)} /> Incluir también los partidos (por defecto solo entrenos)
            </label>

            {/* Lo que se va a cancelar */}
            <div className="rounded-md border border-gray-200 bg-gray-50">
              <p className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                {invalidRange ? "Revisa las fechas" : n === 0 ? "No hay nada que cancelar en esas fechas" : `Se cancelarán ${n} ${n === 1 ? noun : `${noun}s`} de ${affectedTeams.length} equipo${affectedTeams.length === 1 ? "" : "s"}`}
              </p>
              {n > 0 && (
                <ul className="max-h-36 overflow-y-auto divide-y divide-gray-100">
                  {targets.map((e) => (
                    <li key={e.id} className="px-2.5 py-1 text-[11px] text-gray-600 flex items-center gap-2">
                      <span className="capitalize w-24 shrink-0">{format(new Date(e.date), "EEE d MMM", { locale: es })}</span>
                      <span className="w-10 shrink-0 text-gray-400">{format(new Date(e.date), "HH:mm")}</span>
                      <span className="truncate font-medium text-gray-700">{teamName(e.team_id)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {n > 0 && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5 space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <Checkbox checked={notify} onCheckedChange={(v) => setNotify(!!v)} /> Avisar al móvil de esos equipos
                </label>
                {notify && (
                  <>
                    <p className="text-[11px] text-gray-600 italic pl-6">«{notice.body}»</p>
                    <p className="text-[11px] text-gray-500 pl-6">
                      {nobody ? "Nadie de esos equipos tiene la app con avisos: no se enviará nada."
                        : preview ? `Llegará a ${preview.recipients} persona${preview.recipients === 1 ? "" : "s"} (jugadores, familias y cuerpo técnico).` : "Calculando a cuántas personas llegará…"}
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Volver</Button>
              <Button type="button" variant="club" className="flex-1" disabled={run.isPending || n === 0 || invalidRange || (scope === "team" && isCoordinator && !teamId)} onClick={() => run.mutate()}>
                <Ban className="w-4 h-4 mr-1.5" /> {run.isPending ? "Cancelando…" : n > 0 ? `Cancelar ${n}` : "Cancelar"}
              </Button>
            </div>
            {run.isError && <p className="text-xs text-red-600">No se ha podido guardar todo. Revisa el calendario e inténtalo de nuevo.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
