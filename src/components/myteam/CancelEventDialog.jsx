import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Ban, RotateCcw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { CANCEL_REASONS, cancelPatch, restorePatch, cancelWord, isCancelled, cancelText } from "@/lib/eventCancel";
import { cancelNotice } from "@/lib/cancelNotice";
import { clubSiblings } from "@/lib/clubEvent";
import { notifyTeamsPush, pushResultText } from "@/lib/notifyTeam";
import { useT, useDateLocale } from "@/i18n";

/**
 * Marca un evento como cancelado/suspendido (con motivo) o lo restaura.
 * El evento sigue en el calendario, pero ya no cuenta como pendiente de pasar lista, convocar, etc.
 * Al cancelar se puede avisar al móvil del equipo (jugadores, familias y cuerpo técnico).
 * Si es un evento de todo el club, coordinación puede aplicarlo a todos los equipos a la vez.
 */
export default function CancelEventDialog({ open, onOpenChange, event, onDone }) {
  const t = useT();
  const dfl = useDateLocale();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isCoordinator, coachTeamIds } = useTeamAccess();
  const [reason, setReason] = useState("lluvia");
  const [notify, setNotify] = useState(true);
  const [applyAll, setApplyAll] = useState(true);
  const cancelled = isCancelled(event);
  useEffect(() => { if (open) { setReason(event?.cancel_reason || "lluvia"); setNotify(true); setApplyAll(true); } }, [open, event?.id, event?.cancel_reason]);

  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date"), enabled: open });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list(), enabled: open });

  const group = useMemo(() => clubSiblings(events, event), [events, event]);
  const canApplyAll = isCoordinator && group.length > 1;
  const all = canApplyAll && applyAll;
  // A quiénes afecta: a este evento o, si es de todo el club, a todas sus copias que aún no están en ese estado
  const targets = useMemo(() => (all ? group.filter((e) => isCancelled(e) === cancelled) : event ? [event] : []), [all, group, event, cancelled]);
  const teamIds = useMemo(() => [...new Set(targets.map((e) => e.team_id).filter(Boolean))], [targets]);
  const teamName = teams.find((t) => t.id === event?.team_id)?.name || "";

  // Solo se puede avisar a los equipos que uno gestiona (coordinación, a todos)
  const canNotify = !cancelled && teamIds.length > 0 && (isCoordinator || teamIds.every((id) => (coachTeamIds || []).includes(id)));
  const notice = cancelNotice(event || {}, { teamName, reason, group: all });
  const { data: preview } = useQuery({
    queryKey: ["cancel-recipients", [...teamIds].sort().join(",")],
    queryFn: () => base44.club.preview({ team_ids: teamIds, groups: ["jugadores", "familiares", "tecnico"] }),
    enabled: open && canNotify && notify,
    staleTime: 30000,
  });
  const nobody = preview && preview.recipients === 0;
  const sendNotice = canNotify && notify && !nobody;

  const save = useMutation({
    mutationFn: async ({ patch, list, withNotice }) => {
      for (let i = 0; i < list.length; i += 10) await Promise.all(list.slice(i, i + 10).map((e) => base44.entities.Event.update(e.id, patch)));
      if (!withNotice) return { sent: null };
      try {
        const sent = await notifyTeamsPush({
          teamIds, title: notice.title, body: notice.body,
          label: all ? "Todos los equipos · cancelación" : `${teamName || "Equipo"} · cancelación`,
        });
        return { sent };
      } catch (e) {
        return { sent: null, noticeError: e };
      }
    },
    onSuccess: ({ sent, noticeError }) => {
      qc.invalidateQueries({ queryKey: ["events"] });
      if (sent) toast({ title: t("Aviso enviado"), description: pushResultText(sent, t) });
      if (noticeError) toast({ title: t("Se ha marcado como cancelado, pero no se pudo enviar el aviso"), description: t("Puedes enviarlo desde Avisos."), variant: "destructive" });
      onDone?.();
      onOpenChange(false);
    },
  });

  if (!event) return null;
  const isMatchEv = cancelWord(event) === "Suspendido";
  const word = t(cancelWord(event)).toLowerCase(); // «cancelado» o «suspendido»
  const n = targets.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-gray-900 font-black text-base" style={{ fontFamily: "var(--font-display)" }}>
            {cancelled ? t("Evento {word}", { word }) : t("Marcar como {word}", { word })}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{event.title}</span>
            {event.date && <> · <span className="capitalize">{format(new Date(event.date), "EEE d MMM · HH:mm", { locale: dfl })}</span></>}
          </DialogDescription>
        </DialogHeader>

        {cancelled ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 flex items-center gap-2"><Ban className="w-4 h-4 text-gray-500" /> {cancelText(event, t)}</p>
            <p className="text-xs text-gray-500">{t("Si lo restauras vuelve a ser un evento normal y volverá a contar como pendiente si nadie lo gestiona.")}</p>
            {canApplyAll && (
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                <Checkbox checked={applyAll} onCheckedChange={(v) => setApplyAll(!!v)} /> {t("Restaurarlo en los {length} equipos", { length: group.length })}
              </label>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>{t("Cerrar")}</Button>
              <Button type="button" variant="club" className="flex-1" disabled={save.isPending || n === 0} onClick={() => save.mutate({ patch: restorePatch(), list: targets, withNotice: false })}>
                <RotateCcw className="w-4 h-4 mr-1.5" /> {save.isPending ? t("Restaurando…") : t("Restaurar")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">{t("Motivo")}</p>
              <div className="flex flex-wrap gap-1.5">
                {CANCEL_REASONS.map((r) => (
                  <button key={r.value} type="button" onClick={() => setReason(r.value)}
                    className={`h-8 px-3 text-xs font-bold rounded-md border ${reason === r.value ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
                    {t(r.label)}
                  </button>
                ))}
              </div>
            </div>
            {canApplyAll && (
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                <Checkbox checked={applyAll} onCheckedChange={(v) => setApplyAll(!!v)} /> {t("Aplicarlo a los {length} equipos (es el mismo evento)", { length: group.length })}
              </label>
            )}
            {canNotify && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5 space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <Checkbox checked={notify} onCheckedChange={(v) => setNotify(!!v)} /> {t("Avisar al móvil del equipo")}
                </label>
                {notify && (
                  <>
                    <p className="text-[11px] text-gray-600 italic pl-6">«{notice.body}»</p>
                    <p className="text-[11px] text-gray-500 pl-6">
                      {nobody ? t("Nadie de este equipo tiene la app con avisos: no se enviará nada.")
                        : preview ? (preview.recipients === 1 ? t("Llegará a {n} persona (jugadores, familias y cuerpo técnico).", { n: 1 }) : t("Llegará a {n} personas (jugadores, familias y cuerpo técnico).", { n: preview.recipients })) : t("Calculando a cuántas personas llegará…")}
                    </p>
                  </>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500">{t("Seguirá en el calendario marcado como {word}, y no saldrá como pendiente de pasar lista o gestionar.", { word })}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>{t("Volver")}</Button>
              <Button type="button" variant="club" className="flex-1" disabled={save.isPending || n === 0} onClick={() => save.mutate({ patch: cancelPatch(reason), list: targets, withNotice: sendNotice })}>
                <Ban className="w-4 h-4 mr-1.5" /> {save.isPending ? t("Guardando…") : n > 1 ? (isMatchEv ? t("Marcar {n} suspendidos", { n }) : t("Marcar {n} cancelados", { n })) : t("Marcar {word}", { word })}
              </Button>
            </div>
          </div>
        )}
        {save.isError && <p className="text-xs text-red-600">{t("No se ha podido guardar. Inténtalo de nuevo.")}</p>}
      </DialogContent>
    </Dialog>
  );
}
