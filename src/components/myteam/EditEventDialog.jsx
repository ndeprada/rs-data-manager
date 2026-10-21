import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { es } from "date-fns/locale";
import { format, differenceInCalendarDays, startOfDay, parseISO, addDays } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Upload, Ban } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { clubSiblings } from "@/lib/clubEvent";
import { sortTeams } from "@/lib/teamOrder";
import { isCancelled, cancelText } from "@/lib/eventCancel";
import CancelEventDialog from "@/components/myteam/CancelEventDialog";
import EventPlaceFields from "@/components/myteam/EventPlaceFields";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const EVENT_TYPES = [
  { value: "entrenamiento",        label: "Entrenamiento" },
  { value: "entrenamiento_fisico", label: "Físico" },
  { value: "sesion_teorica",       label: "Sesión teórica" },
  { value: "sesion_video",         label: "Sesión de vídeo" },
  { value: "partido_liga",         label: "Partido de liga" },
  { value: "partido_amistoso",     label: "Partido amistoso" },
  { value: "torneo",               label: "Torneo" },
  { value: "reunion_equipo",       label: "Reunión de equipo" },
  { value: "reunion_jugador",      label: "Reunión con jugador" },
  { value: "reunion_capitanes",    label: "Reunión de capitanes" },
  { value: "stage",                label: "Stage" },
  { value: "concentracion",        label: "Concentración" },
  { value: "cena_equipo",          label: "Cena de equipo" },
  { value: "comida_equipo",        label: "Comida de equipo" },
  { value: "evento_club",          label: "Evento del club" },
];

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];

export default function EditEventDialog({ open, onOpenChange, event }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [seriesConfirm, setSeriesConfirm] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [applyAll, setApplyAll] = useState(true);
  const { isCoordinator } = useTeamAccess();
  // Evento de todo el club: coordinación puede cambiarlo o borrarlo en todos los equipos a la vez
  const { data: allEvents = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date"), enabled: open && !!event?.club_event_id });
  const group = clubSiblings(allEvents, event);
  const canApplyAll = isCoordinator && group.length > 1;
  useEffect(() => { if (open) setApplyAll(true); }, [open, event?.id]);

  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Eventos de la serie (para ver y ampliar sus fechas de inicio y fin)
  const { data: seriesEvents = [] } = useQuery({
    queryKey: ["series-events", event?.series_id],
    queryFn: () => base44.entities.Event.filter({ series_id: event.series_id }),
    enabled: !!event?.series_id && open,
  });
  const seriesDays = seriesEvents.map((e) => String(e.date).slice(0, 10)).sort();
  const seriesFirst = seriesDays[0] || "";
  const seriesLast = seriesDays[seriesDays.length - 1] || "";
  useEffect(() => {
    if (seriesFirst) setForm((p) => ({ ...p, series_from: seriesFirst, series_until: seriesLast }));
  }, [seriesFirst, seriesLast]);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: fields = [] } = useQuery({
    queryKey: ["fields"],
    queryFn: () => base44.entities.Field.list(),
  });

  useEffect(() => {
    if (event) {
      const dateObj = new Date(event.date);
      const endDateObj = event.end_date ? new Date(event.end_date) : null;
      setForm((prev) => ({
        series_from: prev.series_from, series_until: prev.series_until,
        type: event.type || "entrenamiento",
        team_id: event.team_id || "",
        title: event.title || "",
        date: format(dateObj, "yyyy-MM-dd"),
        time: format(dateObj, "HH:mm"),
        end_time: endDateObj ? format(endDateObj, "HH:mm") : "",
        location: event.location || "",
        field_id: event.field_id || "",
        location_url: event.location_url || "",
        opponent: event.opponent || "",
        opponent_logo_url: event.opponent_logo_url || "",
        notes: event.notes || "",
      }));
    }
  }, [event]);

  const handleOpponentLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set("opponent_logo_url", file_url);
    setUploadingLogo(false);
  };

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const isMatch = MATCH_TYPES.includes(form.type);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Event.update(event.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onOpenChange(false);
    },
  });

  const fmtNaive = (d) => format(d, "yyyy-MM-dd'T'HH:mm");

  const updateSeriesMutation = useMutation({
    mutationFn: async (data) => {
      const allEvents = await base44.entities.Event.filter({ series_id: event.series_id });
      // Si cambias la fecha de este evento, el resto de la serie se desplaza los mismos días
      // (p. ej. de martes a jueves = +2 días en todos). La hora se aplica a todos.
      const shift = differenceInCalendarDays(parseISO(form.date), startOfDay(new Date(event.date)));
      const [hh, mm] = (form.time || "00:00").split(":").map(Number);
      const [ehh, emm] = form.end_time ? form.end_time.split(":").map(Number) : [null, null];
      const { date: _d, end_date: _e, ...common } = data;
      const mk = (day) => {
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm);
        const end = ehh !== null ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), ehh, emm) : undefined;
        return { date: fmtNaive(start), end_date: end ? fmtNaive(end) : undefined };
      };
      const days = allEvents.map((e) => { const o = new Date(e.date); return new Date(o.getFullYear(), o.getMonth(), o.getDate() + shift); }).sort((a, b) => a - b);
      const fromD = form.series_from && form.series_from !== seriesFirst ? parseISO(form.series_from) : null;
      const untilD = form.series_until && form.series_until !== seriesLast ? parseISO(form.series_until) : null;
      const stepDays = days.length > 1 ? Math.max(1, differenceInCalendarDays(days[1], days[0])) : 7;
      // Fechas nuevas al ampliar la serie hacia atrás (antes del primer día) o hacia delante (después del último)
      const toCreate = [];
      if (fromD && days.length) for (let d = addDays(days[0], -stepDays); d >= fromD && toCreate.length < 400; d = addDays(d, -stepDays)) toCreate.push(d);
      if (untilD && days.length) for (let d = addDays(days[days.length - 1], stepDays); d <= untilD && toCreate.length < 400; d = addDays(d, stepDays)) toCreate.push(d);
      // Eventos que quedan fuera si se acorta la serie
      const outside = (day) => (fromD && day < fromD) || (untilD && day > untilD);
      const toDelete = allEvents.filter((e) => { const o = new Date(e.date); return outside(new Date(o.getFullYear(), o.getMonth(), o.getDate() + shift)); });
      const keep = allEvents.filter((e) => !toDelete.includes(e));
      for (let i = 0; i < keep.length; i += 10) {
        await Promise.all(keep.slice(i, i + 10).map((e) => {
          const old = new Date(e.date);
          const day = new Date(old.getFullYear(), old.getMonth(), old.getDate() + shift);
          return base44.entities.Event.update(e.id, { ...common, ...mk(day) });
        }));
      }
      for (let i = 0; i < toDelete.length; i += 10) await Promise.all(toDelete.slice(i, i + 10).map((e) => base44.entities.Event.delete(e.id)));
      // Los eventos nuevos de la serie no heredan el marcado de cancelado del primero
      const { id: _i, created_date: _c, updated_date: _u, created_at: _ca, updated_at: _ua, score_home: _sh, score_away: _sa, cancelled: _cx, cancel_reason: _cr, ...tpl } = allEvents[0];
      for (let i = 0; i < toCreate.length; i += 10) {
        await Promise.all(toCreate.slice(i, i + 10).map((day) => base44.entities.Event.create({ ...tpl, ...common, ...mk(day), series_id: event.series_id })));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["series-events"] });
      setSeriesConfirm(false);
      onOpenChange(false);
    },
  });

  const deleteSeriesMutation = useMutation({
    mutationFn: async () => {
      const allEvents = await base44.entities.Event.filter({ series_id: event.series_id });
      for (let i = 0; i < allEvents.length; i += 10) {
        await Promise.all(allEvents.slice(i, i + 10).map((e) => base44.entities.Event.delete(e.id)));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setConfirmDelete(false);
      onOpenChange(false);
    },
  });

  // Evento de club en todos los equipos: mismos cambios en cada copia (sin tocar el equipo de cada una)
  const updateClubMutation = useMutation({
    mutationFn: async (data) => {
      const { team_id: _t, ...common } = data;
      for (let i = 0; i < group.length; i += 10) await Promise.all(group.slice(i, i + 10).map((e) => base44.entities.Event.update(e.id, e.id === event.id ? data : common)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onOpenChange(false);
    },
  });

  const deleteClubMutation = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < group.length; i += 10) await Promise.all(group.slice(i, i + 10).map((e) => base44.entities.Event.delete(e.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setConfirmDelete(false);
      onOpenChange(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Event.delete(event.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setConfirmDelete(false);
      onOpenChange(false);
    },
  });

  const buildData = () => {
    const dateStr = form.date;
    const endDate = form.end_time ? `${dateStr}T${form.end_time}:00` : undefined;
    // Partido con la fecha cambiada = aplazado: se guarda la fecha original y se bloquea la fecha para que la sincronización con la FCF no la pise
    const moved = isMatch && String(event.date || "").slice(0, 10) !== dateStr;
    return {
      ...(moved ? { postponed_from: event.postponed_from || event.date, date_locked: true } : {}),
      type: form.type,
      ...(form.team_id ? { team_id: form.team_id } : {}),
      title: form.title || (isMatch && form.opponent ? `vs ${form.opponent}` : EVENT_TYPES.find(t => t.value === form.type)?.label || ""),
      date: `${dateStr}T${form.time}:00`,
      end_date: endDate,
      location: form.location || undefined,
      field_id: form.field_id || undefined,
      location_url: form.location_url?.trim() || undefined,
      opponent: isMatch ? (form.opponent || undefined) : undefined,
      opponent_logo_url: isMatch ? (form.opponent_logo_url || undefined) : undefined,
      notes: form.notes || undefined,
    };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = buildData();
    if (canApplyAll && applyAll) {
      updateClubMutation.mutate(data);
    } else if (event.series_id) {
      setPendingData(data);
      setSeriesConfirm(true);
    } else {
      updateMutation.mutate(data);
    }
  };

  if (!event) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white border-gray-200 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="mb-1">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold" style={{ fontFamily: "var(--font-display)" }}>Editar evento</p>
              <DialogTitle className="text-gray-900 font-black text-lg" style={{ fontFamily: "var(--font-display)" }}>
                {event.title}
              </DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isCancelled(event) && (
              <button type="button" onClick={() => setCancelOpen(true)}
                className="w-full flex items-center gap-2 rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-200">
                <Ban className="w-4 h-4 shrink-0" /> <span className="flex-1">{cancelText(event)}</span> <span className="font-normal text-gray-500">Restaurar</span>
              </button>
            )}
            {event.club_event_id && (
              <div className="rounded-md border border-red-100 bg-red-50/60 px-3 py-2 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--granate)]">Evento de todo el club{group.length > 1 ? ` · ${group.length} equipos` : ""}</p>
                {canApplyAll ? (
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                    <Checkbox checked={applyAll} onCheckedChange={(v) => setApplyAll(!!v)} /> Aplicar los cambios a todos los equipos
                  </label>
                ) : (
                  <p className="text-[11px] text-gray-500">Los cambios solo afectan a la copia de este equipo.</p>
                )}
              </div>
            )}
            {/* Tipo */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Tipo de evento</p>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Rival (solo partidos) */}
            {isMatch && (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Rival</p>
                  <Input value={form.opponent} onChange={e => set("opponent", e.target.value)} placeholder="Nombre del rival…" className="border-gray-200" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Escudo del rival</p>
                  <div className="flex items-center gap-3">
                    {form.opponent_logo_url && (
                      <img src={form.opponent_logo_url} alt="Escudo rival" className="w-10 h-10 object-contain rounded border border-gray-200 p-0.5" />
                    )}
                    <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingLogo ? "Subiendo…" : (form.opponent_logo_url ? "Cambiar escudo" : "Subir escudo")}
                      <input type="file" accept="image/*" className="hidden" onChange={handleOpponentLogoUpload} disabled={uploadingLogo} />
                    </label>
                    {form.opponent_logo_url && (
                      <button type="button" onClick={() => set("opponent_logo_url", "")} className="text-xs text-red-400 hover:text-red-600">Quitar</button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Equipo */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Equipo</p>
              <Select value={form.team_id || ""} onValueChange={v => set("team_id", v)}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder="Equipo…" /></SelectTrigger>
                <SelectContent>
                  {sortTeams(teams).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Título */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Título</p>
              <Input value={form.title} onChange={e => set("title", e.target.value)} className="border-gray-200" />
            </div>

            {/* Fecha y hora */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Fecha</p>
                <input type="date" value={form.date} onChange={e => set("date", e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-200 bg-transparent text-sm shadow-sm px-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Inicio</p>
                <input type="time" value={form.time} onChange={e => set("time", e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-200 bg-transparent text-sm shadow-sm px-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Fin</p>
                <input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-200 bg-transparent text-sm shadow-sm px-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
            </div>

            {event.series_id && form.series_from && (
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 -mt-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">Serie · {seriesEvents.length} eventos</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-500 mb-0.5">Primer día</p>
                    <input type="date" value={form.series_from} onChange={e => set("series_from", e.target.value)}
                      className="w-full h-8 rounded-md border border-gray-200 bg-white text-sm px-1.5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 mb-0.5">Último día</p>
                    <input type="date" value={form.series_until} onChange={e => set("series_until", e.target.value)}
                      className="w-full h-8 rounded-md border border-gray-200 bg-white text-sm px-1.5" />
                  </div>
                </div>
                {(form.series_from !== seriesFirst || form.series_until !== seriesLast) && (
                  <p className="text-[10px] text-amber-700 mt-1">Al guardar con «Todos los eventos de la serie» se añadirán (o quitarán) eventos para cubrir estas fechas, con la misma frecuencia.</p>
                )}
              </div>
            )}

            {isMatch && String(event.date || "").slice(0, 10) !== form.date && form.date && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 -mt-2">
                Se guardará como <b>partido aplazado</b> (fecha original: {format(new Date(event.postponed_from || event.date), "d MMM", { locale: es })}). Se mantiene todo lo anotado en el partido.
              </p>
            )}

            {/* Lugar y campo */}
            <EventPlaceFields form={form} set={set} />

            {/* Notas */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Notas</p>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="border-gray-200" placeholder="Observaciones…" />
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" size="icon" onClick={() => setConfirmDelete(true)} className="text-red-400 hover:text-red-600 hover:bg-red-50 border-red-200" title="Eliminar evento">
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => setCancelOpen(true)}
                className={isCancelled(event) ? "text-gray-700 border-gray-400 bg-gray-100" : "text-gray-500 hover:text-gray-800"}
                title={isCancelled(event) ? "Evento cancelado: restaurar" : "Marcar como cancelado o suspendido (lluvia, festivo…)"}>
                <Ban className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
              <Button variant="club" type="submit" disabled={updateMutation.isPending || updateClubMutation.isPending} className="flex-1">
                {updateMutation.isPending || updateClubMutation.isPending ? "Guardando…" : canApplyAll && applyAll ? `Guardar en ${group.length} equipos` : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <CancelEventDialog open={cancelOpen} onOpenChange={setCancelOpen} event={event} onDone={() => onOpenChange(false)} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
            <AlertDialogDescription>
              {event.series_id ? "Este evento forma parte de una serie recurrente. Esta acción no se puede deshacer." : canApplyAll ? "Es un evento de todo el club: puedes borrarlo solo en este equipo o en todos. Esta acción no se puede deshacer." : "Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {event.series_id && (
              <Button variant="outline" onClick={() => deleteSeriesMutation.mutate()} disabled={deleteSeriesMutation.isPending} className="text-red-600 border-red-200 hover:bg-red-50">
                {deleteSeriesMutation.isPending ? "Eliminando…" : "Toda la serie"}
              </Button>
            )}
            {canApplyAll && (
              <Button variant="outline" onClick={() => deleteClubMutation.mutate()} disabled={deleteClubMutation.isPending} className="text-red-600 border-red-200 hover:bg-red-50">
                {deleteClubMutation.isPending ? "Eliminando…" : `En los ${group.length} equipos`}
              </Button>
            )}
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-red-600 hover:bg-red-700 text-white">
              {event.series_id || canApplyAll ? "Solo este" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={seriesConfirm} onOpenChange={open => { if (!open) setSeriesConfirm(false); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Evento recurrente</AlertDialogTitle>
            <AlertDialogDescription>
              Este evento forma parte de una serie. ¿A qué eventos quieres aplicar los cambios? Si has cambiado la fecha (por ejemplo de martes a jueves), toda la serie se moverá esos mismos días. Si has cambiado el primer o el último día de la serie, se añadirán o quitarán eventos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => { setSeriesConfirm(false); updateMutation.mutate(pendingData); }}
              disabled={updateMutation.isPending}
            >
              Solo este evento
            </Button>
            <Button variant="club"
              onClick={() => updateSeriesMutation.mutate(pendingData)}
              disabled={updateSeriesMutation.isPending}
            >
              {updateSeriesMutation.isPending ? "Guardando…" : "Todos los eventos de la serie"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}