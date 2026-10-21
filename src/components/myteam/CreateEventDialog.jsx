import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, parseISO, differenceInCalendarDays, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import EventPlaceFields from "@/components/myteam/EventPlaceFields";
import { Checkbox } from "@/components/ui/checkbox";
import { Repeat } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { notifyTeamPush, notifyTeamsPush, pushResultText } from "@/lib/notifyTeam";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { CLUB_ALL, CLUB_EVENT_TYPE, clubEventCopies } from "@/lib/clubEvent";

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
const MULTIDAY_TYPES = ["torneo", "stage", "concentracion"];

const WEEKDAYS = [
  { dow: 1, label: "L", name: "Lunes" }, { dow: 2, label: "M", name: "Martes" }, { dow: 3, label: "X", name: "Miércoles" },
  { dow: 4, label: "J", name: "Jueves" }, { dow: 5, label: "V", name: "Viernes" }, { dow: 6, label: "S", name: "Sábado" }, { dow: 0, label: "D", name: "Domingo" },
];

const buildDefaultNotificationMessage = (form, teams) => {
  const team = teams?.find(t => t.id === form.teamId);
  const wholeClub = form.teamId === CLUB_ALL;
  const eventLabel = EVENT_TYPES.find(t => t.value === form.type)?.label || form.type;
  const dateStr = form.date ? `${form.date}T${form.time}:00` : "";
  const formattedDate = dateStr ? format(new Date(dateStr), "dd/MM/yyyy 'a las' HH:mm") : "";
  const title = form.title?.trim() || (MATCH_TYPES.includes(form.type) && form.opponent ? `vs ${form.opponent}` : eventLabel);
  return `Se ha añadido un nuevo evento al calendario:\n\n📌 ${title}\n🏷️ Tipo: ${eventLabel}\n📅 Fecha: ${formattedDate}${form.location ? `\n📍 Lugar: ${form.location}` : ""}${team ? `\n🛡️ Equipo: ${team.name}` : wholeClub ? "\n🛡️ Para todo el club" : ""}${form.notes ? `\n📝 Notas: ${form.notes}` : ""}`;
};

const FREQ_OPTIONS = [
  { value: "weekly", label: "Cada semana" },
  { value: "biweekly", label: "Cada 2 semanas" },
  { value: "monthly", label: "Una vez al mes" },
];
const ORDINALS = ["primer", "segundo", "tercer", "cuarto", "quinto"];

// Fechas de la serie entre "desde" y "hasta" (inclusive).
// Semanal / cada 2 semanas: los días de la semana marcados. Mensual: el mismo día (p. ej. "segundo martes") que la fecha de inicio.
function getOccurrenceDates(from, until, weekdays, freq = "weekly") {
  const dates = [];
  if (!from || !until) return dates;
  const start = parseISO(from);
  const end = parseISO(until);
  const nth = (d) => Math.floor((d.getDate() - 1) / 7);
  const weekIdx = (d) => Math.floor(differenceInCalendarDays(d, startOfWeek(start, { weekStartsOn: 1 })) / 7);
  for (let d = start; d <= end && dates.length < 366; d = addDays(d, 1)) {
    if (freq === "monthly") { if (d.getDay() === start.getDay() && nth(d) === nth(start)) dates.push(d); }
    else if (weekdays.includes(d.getDay()) && (freq === "weekly" || weekIdx(d) % 2 === 0)) dates.push(d);
  }
  return dates;
}

// Fin de temporada por defecto: 30 de junio
function defaultSeasonEnd(date) {
  const d = date || new Date();
  const year = d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
  return `${year}-06-30`;
}

const buildEmptyForm = (date, teamId, recurring = false) => ({
  type: "entrenamiento",
  title: "",
  date: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
  time: "18:00",
  end_time: "19:30",
  end_date_multiday: "",
  end_time_multiday: "20:00",
  location: "",
  field_id: "",
  location_url: "",
  opponent: "",
  notes: "",
  teamId: teamId || "",
  recurring,
  frequency: "weekly",
  weekdays: [(date || new Date()).getDay()],
  series_from: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
  recurrence_until: defaultSeasonEnd(date),
  excluded: [],
  send_notification: false,
  notification_message: "",
});

/**
 * CreateEventDialog
 * Props:
 *   open, onOpenChange       — dialog visibility
 *   date                     — optional Date object (pre-selected date)
 *   teamId                   — pre-selected teamId (when called from MyTeam)
 *   teams                    — optional array of teams; when provided shows team selector (Calendar mode)
 *   startRecurring           — abre ya con "evento recurrente" activado (horario semanal)
 */
export default function CreateEventDialog({ open, onOpenChange, date, teamId, teams, startRecurring = false }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isCoordinator } = useTeamAccess();
  const [form, setForm] = useState(() => buildEmptyForm(date, teamId, startRecurring));

  // Reset form when dialog opens
  useEffect(() => {
    if (open) setForm(buildEmptyForm(date, teamId, startRecurring));
  }, [open, date, teamId, startRecurring]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const isMatch = MATCH_TYPES.includes(form.type);
  const isMultiday = MULTIDAY_TYPES.includes(form.type);
  const typeLabel = EVENT_TYPES.find(t => t.value === form.type)?.label || "";
  const showTeamSelector = !teamId && teams && teams.length > 0;
  // Coordinación puede crear el evento para todos los equipos a la vez (una copia en cada uno)
  const allTeams = showTeamSelector && isCoordinator && form.teamId === CLUB_ALL;

  // Parse current date for preview
  const parsedDate = form.date ? parseISO(form.date) : new Date();

  const allDates = form.recurring
    ? getOccurrenceDates(form.series_from, form.recurrence_until, form.weekdays, form.frequency)
    : [];
  const toggleWeekday = (dow) => setForm(prev => ({
    ...prev,
    weekdays: prev.weekdays.includes(dow) ? prev.weekdays.filter(x => x !== dow) : [...prev.weekdays, dow],
  }));
  const dKey = (d) => format(d, "yyyy-MM-dd");
  const excludedSet = new Set(form.excluded || []);
  const previewDates = allDates.filter(d => !excludedSet.has(dKey(d)));
  const toggleExcluded = (d) => {
    const k = dKey(d);
    setForm(prev => {
      const cur = new Set(prev.excluded || []);
      if (cur.has(k)) cur.delete(k); else cur.add(k);
      return { ...prev, excluded: [...cur] };
    });
  };

  // Aviso al móvil del equipo (notificación de la app). Antes iba por email, pero no hay servicio de email conectado.
  const sendNotifications = async (createdEvent) => {
    if (!createdEvent?.team_id) return;
    const team = teams?.find(t => t.id === createdEvent.team_id);
    const title = form.title?.trim() || (isMatch && form.opponent ? `vs ${form.opponent}` : typeLabel);
    try {
      const r = allTeams
        ? await notifyTeamsPush({
            teamIds: null,
            label: "Todo el club · aviso de evento",
            title: `📅 Evento del club: ${title}`,
            body: form.notification_message || buildDefaultNotificationMessage(form, teams),
          })
        : await notifyTeamPush({
            teamId: createdEvent.team_id,
            teamName: team?.name,
            title: `📅 Nuevo evento: ${title}`,
            body: form.notification_message || buildDefaultNotificationMessage(form, teams),
          });
      toast({ title: allTeams ? "Aviso enviado a todo el club" : "Aviso enviado al equipo", description: pushResultText(r) });
    } catch (e) {
      toast({ title: "El evento se ha creado, pero no se pudo enviar el aviso", description: e?.message || "Inténtalo desde Avisos.", variant: "destructive" });
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const seriesId = form.recurring && !allTeams ? crypto.randomUUID() : undefined;
      const occurrences = form.recurring && !allTeams
        ? getOccurrenceDates(form.series_from, form.recurrence_until, form.weekdays, form.frequency).filter(d => !(form.excluded || []).includes(format(d, "yyyy-MM-dd")))
        : [parsedDate];

      const dStr0 = format(occurrences[0], "yyyy-MM-dd");
      const endOf = (dStr) => (isMultiday && form.end_date_multiday
        ? `${form.end_date_multiday}T${form.end_time_multiday}:00`
        : (form.end_time ? `${dStr}T${form.end_time}:00` : undefined));
      // Todos los equipos: una copia por equipo, unidas por club_event_id
      if (allTeams) {
        const copies = clubEventCopies({ ...data, date: `${dStr0}T${form.time}:00`, end_date: endOf(dStr0) }, teams, crypto.randomUUID());
        const created = [];
        for (let i = 0; i < copies.length; i += 10) created.push(...(await Promise.all(copies.slice(i, i + 10).map((c) => base44.entities.Event.create(c)))));
        return created;
      }
      const makeOne = (occDate) => {
        const dStr = format(occDate, "yyyy-MM-dd");
        return base44.entities.Event.create({
          ...data,
          date: `${dStr}T${form.time}:00`,
          end_date: endOf(dStr),
          ...(seriesId ? { series_id: seriesId } : {}),
        });
      };
      const results = [];
      for (let i = 0; i < occurrences.length; i += 10) {
        results.push(...(await Promise.all(occurrences.slice(i, i + 10).map(makeOne))));
      }
      return results;
    },
    onSuccess: async (results) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onOpenChange(false);
      if (form.send_notification && results?.[0]) {
        sendNotifications(results[0]);
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const title = form.title.trim() || (isMatch && form.opponent ? `vs ${form.opponent}` : typeLabel);
    createMutation.mutate({
      title,
      type: form.type,
      team_id: allTeams ? undefined : (form.teamId || teamId),
      location: form.location || undefined,
      field_id: form.field_id || undefined,
      location_url: form.location_url.trim() || undefined,
      opponent: isMatch ? (form.opponent || undefined) : undefined,
      notes: form.notes || undefined,
    });
  };

  const dateLabel = form.date ? format(parseISO(form.date), "EEEE d 'de' MMMM", { locale: es }) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="mb-1">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold" style={{ fontFamily: "var(--font-display)" }}>Nuevo evento</p>
            <DialogTitle className="text-gray-900 font-black capitalize text-lg" style={{ fontFamily: "var(--font-display)" }}>
              {dateLabel}
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Team selector (Calendar mode) */}
          {showTeamSelector && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Equipo *</p>
              <Select value={form.teamId} onValueChange={v => setForm(prev => ({
                ...prev, teamId: v, recurring: v === CLUB_ALL ? false : prev.recurring,
                type: v === CLUB_ALL && prev.type === "entrenamiento" ? CLUB_EVENT_TYPE : prev.type,
              }))}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar equipo…" /></SelectTrigger>
                <SelectContent>
                  {isCoordinator && <SelectItem value={CLUB_ALL}>★ Todos los equipos del club</SelectItem>}
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {allTeams && <p className="text-[11px] text-gray-500 mt-1">Se creará en el calendario de los {teams.length} equipos. Después podrás editarlo o borrarlo en todos a la vez.</p>}
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
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Rival</p>
              <Input value={form.opponent} onChange={e => set("opponent", e.target.value)} placeholder="Nombre del rival…" className="border-gray-200" />
            </div>
          )}

          {/* Título */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
              Título <span className="font-normal text-gray-400">(opcional)</span>
            </p>
            <Input
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder={isMatch && form.opponent ? `vs ${form.opponent}` : typeLabel}
              className="border-gray-200"
            />
          </div>

          {/* Fecha y hora */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Fecha</p>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)} required
                className="w-full h-9 rounded-md border border-gray-200 bg-transparent text-sm shadow-sm px-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Inicio</p>
              <input type="time" value={form.time} onChange={e => set("time", e.target.value)}
                className="w-full h-9 rounded-md border border-gray-200 bg-transparent text-sm shadow-sm px-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            {!isMultiday && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Fin</p>
                <input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-200 bg-transparent text-sm shadow-sm px-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
            )}
          </div>

          {/* Fecha/hora fin para eventos multi-día */}
          {isMultiday && (
            <div className="grid grid-cols-2 gap-3 bg-orange-50 border border-orange-100 rounded-lg p-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Fecha fin</p>
                <Input
                  type="date"
                  value={form.end_date_multiday}
                  min={form.date}
                  onChange={e => set("end_date_multiday", e.target.value)}
                  className="border-gray-200 bg-white"
                />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Hora fin</p>
                <Input type="time" value={form.end_time_multiday} onChange={e => set("end_time_multiday", e.target.value)} className="border-gray-200 bg-white" />
              </div>
              {form.end_date_multiday && form.end_date_multiday > form.date && (
                <p className="col-span-2 text-[10px] text-orange-600 font-medium">
                  El evento aparecerá desde el {form.date ? format(parseISO(form.date), "d MMM", { locale: es }) : "—"} hasta el {format(parseISO(form.end_date_multiday), "d MMM", { locale: es })}.
                </p>
              )}
            </div>
          )}

          <EventPlaceFields form={form} set={set} />

          {/* Notas */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Notas</p>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="border-gray-200" placeholder="Observaciones…" />
          </div>

          {/* Notificación (solo Calendar mode) */}
          {showTeamSelector && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="send_notif"
                  checked={form.send_notification}
                  onCheckedChange={v => {
                    const msg = v ? buildDefaultNotificationMessage({ ...form }, teams) : "";
                    setForm(prev => ({ ...prev, send_notification: !!v, notification_message: msg }));
                  }}
                />
                <label htmlFor="send_notif" className="text-sm font-medium text-gray-700 cursor-pointer">
                  {allTeams ? "Avisar a todo el club en el móvil (notificación de la app)" : "Avisar al equipo en el móvil (notificación de la app)"}
                </label>
              </div>
              {form.send_notification && (
                <div className="pl-7 space-y-1">
                  <p className="text-xs text-gray-500">Mensaje del aviso</p>
                  <Textarea
                    value={form.notification_message}
                    onChange={e => set("notification_message", e.target.value)}
                    className="border-gray-200 text-sm"
                    rows={5}
                    placeholder="Escribe el mensaje…"
                  />
                  <p className="text-[10px] text-gray-400">Les llegará a quienes tengan activados los avisos en la app (máx. 600 caracteres).</p>
                </div>
              )}
            </div>
          )}

          {/* Recurrencia (no con «todos los equipos»: sería una copia por equipo y por fecha) */}
          {!allTeams && <div className="border border-gray-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-700">Evento recurrente</span>
              </div>
              <Switch checked={form.recurring} onCheckedChange={v => set("recurring", v)} />
            </div>

            {form.recurring && (
              <div className="space-y-3 pt-1">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Frecuencia</p>
                  <Select value={form.frequency} onValueChange={v => set("frequency", v)}>
                    <SelectTrigger className="border-gray-200 h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQ_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.frequency === "monthly" ? (
                  <p className="text-xs text-gray-600">
                    Se repetirá el <b>{ORDINALS[Math.floor((parseISO(form.series_from).getDate() - 1) / 7)]} {WEEKDAYS.find(w => w.dow === parseISO(form.series_from).getDay())?.name.toLowerCase()}</b> de cada mes, a partir de «Empieza el».
                  </p>
                ) : (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Se repite en</p>
                  <div className="flex gap-1">
                    {WEEKDAYS.map(w => {
                      const on = form.weekdays.includes(w.dow);
                      return (
                        <button type="button" key={w.dow} title={w.name} onClick={() => toggleWeekday(w.dow)}
                          className={`w-9 h-8 rounded-md border text-sm font-bold transition-colors ${on ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                          style={on ? { background: "var(--granate)" } : undefined}>
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Empieza el</p>
                    <input type="date" value={form.series_from} onChange={e => set("series_from", e.target.value)}
                      className="w-full h-8 rounded-md border border-gray-200 bg-transparent text-sm px-1.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Termina el</p>
                    <input type="date" min={form.series_from} value={form.recurrence_until} onChange={e => set("recurrence_until", e.target.value)}
                      className="w-full h-8 rounded-md border border-gray-200 bg-transparent text-sm px-1.5" />
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    Se crearán {previewDates.length} eventos · pulsa una fecha para quitarla (festivos…)
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {allDates.map((d, i) => {
                      const off = excludedSet.has(dKey(d));
                      return (
                        <button
                          type="button"
                          key={i}
                          onClick={() => toggleExcluded(d)}
                          title={off ? "Volver a incluir" : "Quitar esta fecha"}
                          className={`text-[10px] pl-1.5 pr-1 py-0.5 rounded border font-medium inline-flex items-center gap-1 transition-colors ${
                            off ? "bg-gray-100 border-dashed border-gray-300 text-gray-400 line-through" : "bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600"
                          }`}
                        >
                          {format(d, "d MMM", { locale: es })}
                          <span className="text-[11px] leading-none no-underline">{off ? "+" : "×"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
            <Button variant="club" type="submit" disabled={createMutation.isPending || (form.recurring && !allTeams && previewDates.length === 0) || (showTeamSelector && !form.teamId)} className="flex-1">
              {createMutation.isPending
                ? "Guardando…"
                : allTeams
                  ? `Crear en los ${teams.length} equipos`
                  : form.recurring
                  ? `Crear ${previewDates.length} eventos`
                  : "Crear evento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}