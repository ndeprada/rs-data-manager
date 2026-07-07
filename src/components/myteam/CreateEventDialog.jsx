import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, addWeeks, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Repeat } from "lucide-react";

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
];

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const MULTIDAY_TYPES = ["torneo", "stage", "concentracion"];

const RECURRENCE_OPTIONS = [
  { value: "daily",     label: "Cada día" },
  { value: "weekly",    label: "Cada semana" },
  { value: "biweekly",  label: "Cada 2 semanas" },
];

const buildDefaultNotificationMessage = (form, teams) => {
  const team = teams?.find(t => t.id === form.teamId);
  const eventLabel = EVENT_TYPES.find(t => t.value === form.type)?.label || form.type;
  const dateStr = form.date ? `${form.date}T${form.time}:00` : "";
  const formattedDate = dateStr ? format(new Date(dateStr), "dd/MM/yyyy 'a las' HH:mm") : "";
  const title = form.title?.trim() || (MATCH_TYPES.includes(form.type) && form.opponent ? `vs ${form.opponent}` : eventLabel);
  return `Se ha añadido un nuevo evento al calendario:\n\n📌 ${title}\n🏷️ Tipo: ${eventLabel}\n📅 Fecha: ${formattedDate}${form.location ? `\n📍 Lugar: ${form.location}` : ""}${team ? `\n🛡️ Equipo: ${team.name}` : ""}${form.notes ? `\n📝 Notas: ${form.notes}` : ""}`;
};

function getOccurrenceDates(startDate, recurrence, count) {
  const dates = [startDate];
  for (let i = 1; i < count; i++) {
    let next;
    if (recurrence === "daily") next = addDays(dates[dates.length - 1], 1);
    else if (recurrence === "weekly") next = addWeeks(dates[dates.length - 1], 1);
    else if (recurrence === "biweekly") next = addWeeks(dates[dates.length - 1], 2);
    dates.push(next);
  }
  return dates;
}

const buildEmptyForm = (date, teamId) => ({
  type: "entrenamiento",
  title: "",
  date: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
  time: "18:00",
  end_time: "19:30",
  end_date_multiday: "",
  end_time_multiday: "20:00",
  location: "",
  opponent: "",
  notes: "",
  teamId: teamId || "",
  recurring: false,
  recurrence: "weekly",
  recurrence_count: 8,
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
 */
export default function CreateEventDialog({ open, onOpenChange, date, teamId, teams }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => buildEmptyForm(date, teamId));

  // Reset form when dialog opens
  useEffect(() => {
    if (open) setForm(buildEmptyForm(date, teamId));
  }, [open, date, teamId]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const isMatch = MATCH_TYPES.includes(form.type);
  const isMultiday = MULTIDAY_TYPES.includes(form.type);
  const typeLabel = EVENT_TYPES.find(t => t.value === form.type)?.label || "";
  const showTeamSelector = !teamId && teams && teams.length > 0;

  // Parse current date for preview
  const parsedDate = form.date ? parseISO(form.date) : new Date();

  const previewDates = form.recurring
    ? getOccurrenceDates(parsedDate, form.recurrence, Math.min(form.recurrence_count, 20))
    : [];

  const sendNotifications = async (createdEvent) => {
    if (!createdEvent?.team_id) return;
    const [players, staff] = await Promise.all([
      base44.entities.Player.filter({ team_id: createdEvent.team_id }),
      base44.entities.StaffMember.filter({ team_id: createdEvent.team_id }),
    ]);
    const recipients = [
      ...players.filter(p => p.email).map(p => ({ email: p.email, name: `${p.first_name} ${p.last_name}` })),
      ...staff.filter(s => s.email).map(s => ({ email: s.email, name: `${s.first_name} ${s.last_name}` })),
    ];
    const message = form.notification_message || buildDefaultNotificationMessage(form, teams);
    const title = form.title?.trim() || (isMatch && form.opponent ? `vs ${form.opponent}` : typeLabel);
    await Promise.all(recipients.map(r =>
      base44.integrations.Core.SendEmail({
        to: r.email,
        subject: `📅 Nuevo evento: ${title}`,
        body: `Hola ${r.name},\n\n${message}\n\nRS Data Manager`,
      }).catch(() => null)
    ));
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const seriesId = form.recurring ? crypto.randomUUID() : undefined;
      const occurrences = form.recurring
        ? getOccurrenceDates(parsedDate, form.recurrence, form.recurrence_count)
        : [parsedDate];

      const results = await Promise.all(occurrences.map(occDate => {
        const dStr = format(occDate, "yyyy-MM-dd");
        const endDate = isMultiday && form.end_date_multiday
          ? `${form.end_date_multiday}T${form.end_time_multiday}:00`
          : (form.end_time ? `${dStr}T${form.end_time}:00` : undefined);
        return base44.entities.Event.create({
          ...data,
          date: `${dStr}T${form.time}:00`,
          end_date: endDate,
          ...(seriesId ? { series_id: seriesId } : {}),
        });
      }));
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
      team_id: form.teamId || teamId,
      location: form.location || undefined,
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
              <Select value={form.teamId} onValueChange={v => set("teamId", v)}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar equipo…" /></SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Fecha (Calendar mode — editable) */}
          {showTeamSelector && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Fecha *</p>
              <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} className="border-gray-200" required />
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

          {/* Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Hora inicio</p>
              <Input type="time" value={form.time} onChange={e => set("time", e.target.value)} className="border-gray-200" />
            </div>
            {!isMultiday && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Hora fin</p>
                <Input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} className="border-gray-200" />
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

          {/* Lugar */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Lugar</p>
            <Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="Campo, sala…" className="border-gray-200" />
          </div>

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
                  Enviar notificación por email al equipo
                </label>
              </div>
              {form.send_notification && (
                <div className="pl-7 space-y-1">
                  <p className="text-xs text-gray-500">Mensaje del email</p>
                  <Textarea
                    value={form.notification_message}
                    onChange={e => set("notification_message", e.target.value)}
                    className="border-gray-200 text-sm"
                    rows={5}
                    placeholder="Escribe el mensaje…"
                  />
                  <p className="text-[10px] text-gray-400">El mensaje irá precedido de "Hola [nombre]," y finalizado con "RS Data Manager".</p>
                </div>
              )}
            </div>
          )}

          {/* Recurrencia */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-700">Evento recurrente</span>
              </div>
              <Switch checked={form.recurring} onCheckedChange={v => set("recurring", v)} />
            </div>

            {form.recurring && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Frecuencia</p>
                    <Select value={form.recurrence} onValueChange={v => set("recurrence", v)}>
                      <SelectTrigger className="border-gray-200 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RECURRENCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Nº de veces</p>
                    <Input
                      type="number" min={2} max={52}
                      value={form.recurrence_count}
                      onChange={e => set("recurrence_count", Math.max(2, Math.min(52, parseInt(e.target.value) || 2)))}
                      className="border-gray-200 h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    Se crearán {previewDates.length} eventos:
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {previewDates.map((d, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-600 font-medium">
                        {format(d, "d MMM", { locale: es })}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending} className="flex-1 text-white" style={{ background: "var(--granate)" }}>
              {createMutation.isPending
                ? "Guardando…"
                : form.recurring
                  ? `Crear ${form.recurrence_count} eventos`
                  : "Crear evento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}