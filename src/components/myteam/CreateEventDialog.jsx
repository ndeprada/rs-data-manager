import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, parseISO, differenceInCalendarDays, startOfWeek } from "date-fns";
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
import { CLUB_EVENT_TYPE, clubEventCopies, scopeLabel, scopeText } from "@/lib/clubEvent";
import { sortTeams } from "@/lib/teamOrder";
import EventTargetPicker from "@/components/myteam/EventTargetPicker";
import { useT, useDateLocale, useFormat, msg } from "@/i18n";

const EVENT_TYPES = [
  { value: "entrenamiento",        label: msg("Entrenamiento") },
  { value: "entrenamiento_fisico", label: msg("Físico") },
  { value: "sesion_teorica",       label: msg("Sesión teórica") },
  { value: "sesion_video",         label: msg("Sesión de vídeo") },
  { value: "partido_liga",         label: msg("Partido de liga") },
  { value: "partido_amistoso",     label: msg("Partido amistoso") },
  { value: "torneo",               label: msg("Torneo") },
  { value: "reunion_equipo",       label: msg("Reunión de equipo") },
  { value: "reunion_jugador",      label: msg("Reunión con jugador") },
  { value: "reunion_capitanes",    label: msg("Reunión de capitanes") },
  { value: "stage",                label: msg("Stage") },
  { value: "concentracion",        label: msg("Concentración") },
  { value: "cena_equipo",          label: msg("Cena de equipo") },
  { value: "comida_equipo",        label: msg("Comida de equipo") },
  { value: "evento_club",          label: msg("Evento del club") },
];

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const MULTIDAY_TYPES = ["torneo", "stage", "concentracion"];

const WEEKDAYS = [
  { dow: 1, label: "L" }, { dow: 2, label: "M" }, { dow: 3, label: "X" },
  { dow: 4, label: "J" }, { dow: 5, label: "V" }, { dow: 6, label: "S" }, { dow: 0, label: "D" },
];

// `scope`: a quién llega cuando el evento es para varios equipos («Todo el club», «Juvenil A, Cadet S16 A», «5 equipos»)
const buildDefaultNotificationMessage = (form, teams, scope = "") => {
  const team = form.multi ? null : teams?.find(t => t.id === form.teamId);
  const eventLabel = EVENT_TYPES.find(t => t.value === form.type)?.label || form.type;
  const dateStr = form.date ? `${form.date}T${form.time}:00` : "";
  const formattedDate = dateStr ? format(new Date(dateStr), "dd/MM/yyyy 'a las' HH:mm") : "";
  const title = form.title?.trim() || (MATCH_TYPES.includes(form.type) && form.opponent ? `vs ${form.opponent}` : eventLabel);
  return `Se ha añadido un nuevo evento al calendario:\n\n📌 ${title}\n🏷️ Tipo: ${eventLabel}\n📅 Fecha: ${formattedDate}${form.location ? `\n📍 Lugar: ${form.location}` : ""}${team ? `\n🛡️ Equipo: ${team.name}` : scope ? (scope === "Todo el club" ? "\n🛡️ Para todo el club" : `\n🛡️ Equipos: ${scope}`) : ""}${form.notes ? `\n📝 Notas: ${form.notes}` : ""}`;
};

const FREQ_OPTIONS = [
  { value: "weekly", label: msg("Cada semana") },
  { value: "biweekly", label: msg("Cada 2 semanas") },
  { value: "monthly", label: msg("Una vez al mes") },
];
const ORDINALS = [msg("primer"), msg("segundo"), msg("tercer"), msg("cuarto"), msg("quinto")];

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
  multi: false,      // coordinación: crear el evento en varios equipos a la vez
  teamIds: [],
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
  const t = useT();
  const dfl = useDateLocale();
  const { lang } = useFormat();
  // Nombre del día de la semana (0 = domingo) en el idioma de la app; en español las iniciales de siempre (L M X J V S D)
  const dayOf = (dow) => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), (dow + 6) % 7);
  const dayName = (dow) => format(dayOf(dow), "EEEE", { locale: dfl });
  const dayInitial = (w) => (lang === "es" ? w.label : format(dayOf(w.dow), "EEEEEE", { locale: dfl }).replace(/\.$/, "").replace(/^./, (c) => c.toUpperCase()));
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
  // Coordinación puede crear el evento en varios equipos a la vez (una copia en cada uno, unidas por club_event_id)
  const canMulti = showTeamSelector && isCoordinator;
  const picked = canMulti && form.multi ? sortTeams(teams).filter(t => form.teamIds.includes(t.id)) : [];
  const groupMode = picked.length > 1;
  const scope = groupMode ? scopeLabel(picked, teams) : "";
  const targetTeamId = form.multi ? picked[0]?.id : (form.teamId || teamId);
  const hasTarget = !showTeamSelector || (form.multi ? picked.length > 0 : !!form.teamId);
  // Con varios equipos no hay partidos (cada uno tiene su rival) ni repetición semanal
  const typeOptions = form.multi ? EVENT_TYPES.filter(t => !MATCH_TYPES.includes(t.value)) : EVENT_TYPES;
  const changeTarget = (patch) => setForm(prev => {
    const next = { ...prev, ...patch };
    if (patch.multi === true) {
      next.recurring = false;
      if (prev.type === "entrenamiento" || MATCH_TYPES.includes(prev.type)) next.type = CLUB_EVENT_TYPE;
    }
    return next;
  });

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
    const body = form.notification_message || buildDefaultNotificationMessage(form, teams, scope);
    try {
      const r = groupMode
        ? await notifyTeamsPush({
            teamIds: scope === "Todo el club" ? null : picked.map(t => t.id),
            label: `${scope} · aviso de evento`,
            title: `📅 Nuevo evento: ${title}`,
            body,
          })
        : await notifyTeamPush({ teamId: createdEvent.team_id, teamName: team?.name, title: `📅 Nuevo evento: ${title}`, body });
      toast({ title: groupMode ? t("Aviso enviado: {scope}", { scope: scopeText(scope, t) }) : t("Aviso enviado al equipo"), description: pushResultText(r, t) });
    } catch (e) {
      toast({ title: t("El evento se ha creado, pero no se pudo enviar el aviso"), description: e?.message || t("Inténtalo desde Avisos."), variant: "destructive" });
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const seriesId = form.recurring && !form.multi ? crypto.randomUUID() : undefined;
      const occurrences = form.recurring && !form.multi
        ? getOccurrenceDates(form.series_from, form.recurrence_until, form.weekdays, form.frequency).filter(d => !(form.excluded || []).includes(format(d, "yyyy-MM-dd")))
        : [parsedDate];

      const dStr0 = format(occurrences[0], "yyyy-MM-dd");
      const endOf = (dStr) => (isMultiday && form.end_date_multiday
        ? `${form.end_date_multiday}T${form.end_time_multiday}:00`
        : (form.end_time ? `${dStr}T${form.end_time}:00` : undefined));
      // Varios equipos: una copia por equipo, unidas por club_event_id
      if (groupMode) {
        const copies = clubEventCopies({ ...data, date: `${dStr0}T${form.time}:00`, end_date: endOf(dStr0) }, picked, crypto.randomUUID());
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
      team_id: groupMode ? undefined : targetTeamId,
      location: form.location || undefined,
      field_id: form.field_id || undefined,
      location_url: form.location_url.trim() || undefined,
      opponent: isMatch ? (form.opponent || undefined) : undefined,
      notes: form.notes || undefined,
    });
  };

  const dateLabel = form.date ? format(parseISO(form.date), "EEEE d 'de' MMMM", { locale: dfl }) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="mb-1">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold" style={{ fontFamily: "var(--font-display)" }}>{t("Nuevo evento")}</p>
            <DialogTitle className="text-gray-900 font-black capitalize text-lg" style={{ fontFamily: "var(--font-display)" }}>
              {dateLabel}
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Equipo o equipos (modo Calendario) */}
          {showTeamSelector && (
            <EventTargetPicker
              teams={teams}
              canMulti={canMulti}
              value={{ multi: form.multi, teamId: form.teamId, teamIds: form.teamIds }}
              onChange={changeTarget}
            />
          )}

          {/* Tipo */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t("Tipo de evento")}</p>
            <Select value={form.type} onValueChange={v => set("type", v)}>
              <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                {typeOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{t(opt.label)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Rival (solo partidos) */}
          {isMatch && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t("Rival")}</p>
              <Input value={form.opponent} onChange={e => set("opponent", e.target.value)} placeholder={t("Nombre del rival…")} className="border-gray-200" />
            </div>
          )}

          {/* Título */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
              {t("Título")} <span className="font-normal text-gray-400">{t("(opcional)")}</span>
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
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t("Fecha")}</p>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)} required
                className="w-full h-9 rounded-md border border-gray-200 bg-transparent text-sm shadow-sm px-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t("Inicio")}</p>
              <input type="time" value={form.time} onChange={e => set("time", e.target.value)}
                className="w-full h-9 rounded-md border border-gray-200 bg-transparent text-sm shadow-sm px-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            {!isMultiday && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t("Fin")}</p>
                <input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-200 bg-transparent text-sm shadow-sm px-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
            )}
          </div>

          {/* Fecha/hora fin para eventos multi-día */}
          {isMultiday && (
            <div className="grid grid-cols-2 gap-3 bg-orange-50 border border-orange-100 rounded-lg p-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t("Fecha fin")}</p>
                <Input
                  type="date"
                  value={form.end_date_multiday}
                  min={form.date}
                  onChange={e => set("end_date_multiday", e.target.value)}
                  className="border-gray-200 bg-white"
                />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t("Hora fin")}</p>
                <Input type="time" value={form.end_time_multiday} onChange={e => set("end_time_multiday", e.target.value)} className="border-gray-200 bg-white" />
              </div>
              {form.end_date_multiday && form.end_date_multiday > form.date && (
                <p className="col-span-2 text-[10px] text-orange-600 font-medium">
                  {t("El evento aparecerá desde el {v} hasta el {format}.", { v: form.date ? format(parseISO(form.date), "d MMM", { locale: dfl }) : "—", format: format(parseISO(form.end_date_multiday), "d MMM", { locale: dfl }) })}
                </p>
              )}
            </div>
          )}

          <EventPlaceFields form={form} set={set} />

          {/* Notas */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t("Notas")}</p>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="border-gray-200" placeholder={t("Observaciones…")} />
          </div>

          {/* Notificación (solo Calendar mode) */}
          {showTeamSelector && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="send_notif"
                  checked={form.send_notification}
                  onCheckedChange={v => {
                    const msg = v ? buildDefaultNotificationMessage({ ...form }, teams, scope) : "";
                    setForm(prev => ({ ...prev, send_notification: !!v, notification_message: msg }));
                  }}
                />
                <label htmlFor="send_notif" className="text-sm font-medium text-gray-700 cursor-pointer">
                  {groupMode ? t("Avisar en el móvil a: {scope} (notificación de la app)", { scope: scopeText(scope, t) }) : t("Avisar al equipo en el móvil (notificación de la app)")}
                </label>
              </div>
              {form.send_notification && (
                <div className="pl-7 space-y-1">
                  <p className="text-xs text-gray-500">{t("Mensaje del aviso")}</p>
                  <Textarea
                    value={form.notification_message}
                    onChange={e => set("notification_message", e.target.value)}
                    className="border-gray-200 text-sm"
                    rows={5}
                    placeholder={t("Escribe el mensaje…")}
                  />
                  <p className="text-[10px] text-gray-400">{t("Les llegará a quienes tengan activados los avisos en la app (máx. 600 caracteres).")}</p>
                </div>
              )}
            </div>
          )}

          {/* Recurrencia (no con varios equipos: sería una copia por equipo y por fecha) */}
          {!form.multi && <div className="border border-gray-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-700">{t("Evento recurrente")}</span>
              </div>
              <Switch checked={form.recurring} onCheckedChange={v => set("recurring", v)} />
            </div>

            {form.recurring && (
              <div className="space-y-3 pt-1">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t("Frecuencia")}</p>
                  <Select value={form.frequency} onValueChange={v => set("frequency", v)}>
                    <SelectTrigger className="border-gray-200 h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQ_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.frequency === "monthly" ? (
                  <p className="text-xs text-gray-600">
                    {t("Se repetirá el {ordinal} {day} de cada mes, a partir de «Empieza el».", {
                      ordinal: t(ORDINALS[Math.floor((parseISO(form.series_from).getDate() - 1) / 7)]),
                      day: dayName(parseISO(form.series_from).getDay()),
                    })}
                  </p>
                ) : (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t("Se repite en")}</p>
                  <div className="flex gap-1">
                    {WEEKDAYS.map(w => {
                      const on = form.weekdays.includes(w.dow);
                      return (
                        <button type="button" key={w.dow} title={dayName(w.dow)} onClick={() => toggleWeekday(w.dow)}
                          className={`w-9 h-8 rounded-md border text-sm font-bold transition-colors ${on ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                          style={on ? { background: "var(--granate)" } : undefined}>
                          {dayInitial(w)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t("Empieza el")}</p>
                    <input type="date" value={form.series_from} onChange={e => set("series_from", e.target.value)}
                      className="w-full h-8 rounded-md border border-gray-200 bg-transparent text-sm px-1.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t("Termina el")}</p>
                    <input type="date" min={form.series_from} value={form.recurrence_until} onChange={e => set("recurrence_until", e.target.value)}
                      className="w-full h-8 rounded-md border border-gray-200 bg-transparent text-sm px-1.5" />
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    {t("Se crearán {length} eventos · pulsa una fecha para quitarla (festivos…)", { length: previewDates.length })}
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {allDates.map((d, i) => {
                      const off = excludedSet.has(dKey(d));
                      return (
                        <button
                          type="button"
                          key={i}
                          onClick={() => toggleExcluded(d)}
                          title={off ? t("Volver a incluir") : t("Quitar esta fecha")}
                          className={`text-[10px] pl-1.5 pr-1 py-0.5 rounded border font-medium inline-flex items-center gap-1 transition-colors ${
                            off ? "bg-gray-100 border-dashed border-gray-300 text-gray-400 line-through" : "bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600"
                          }`}
                        >
                          {format(d, "d MMM", { locale: dfl })}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">{t("Cancelar")}</Button>
            <Button variant="club" type="submit" disabled={createMutation.isPending || (form.recurring && previewDates.length === 0) || !hasTarget} className="flex-1">
              {createMutation.isPending
                ? t("Guardando…")
                : groupMode
                  ? t("Crear en los {length} equipos", { length: picked.length })
                  : form.recurring
                  ? t("Crear {length} eventos", { length: previewDates.length })
                  : t("Crear evento")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}