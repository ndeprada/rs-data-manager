import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, MapPin, Users, ClipboardList, FileText, List } from "lucide-react";
import EventAttendanceDialog from "@/components/calendar/EventAttendanceDialog";
import ConvocatoriaDialog from "@/components/calendar/ConvocatoriaDialog";
import SessionReportDialog from "@/components/calendar/SessionReportDialog";
import SessionReportPanel from "@/components/calendar/SessionReportPanel";
import EventListWithDragDrop from "@/components/calendar/EventListWithDragDrop";
import WeeklyCalendar from "@/components/calendar/WeeklyCalendar";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const EVENT_TYPES = [
  { value: "partido_amistoso", label: "Partido amistoso", isMatch: true },
  { value: "partido_liga", label: "Partido de liga", isMatch: true },
  { value: "torneo", label: "Torneo", isMatch: true },
  { value: "entrenamiento_fisico", label: "Entrenamiento físico", isMatch: false },
  { value: "entrenamiento", label: "Entrenamiento", isMatch: false },
  { value: "sesion_teorica", label: "Sesión teórica", isMatch: false },
  { value: "sesion_video", label: "Sesión de vídeo", isMatch: false },
  { value: "reunion_equipo", label: "Reunión de equipo", isMatch: false },
  { value: "reunion_jugador", label: "Reunión jugador", isMatch: false },
  { value: "reunion_capitanes", label: "Reunión de capitanes", isMatch: false },
  { value: "stage", label: "Stage", isMatch: false },
  { value: "concentracion", label: "Concentración", isMatch: false },
  { value: "cena_equipo", label: "Cena de equipo", isMatch: false },
  { value: "comida_equipo", label: "Comida de equipo", isMatch: false },
];

const isMatchType = (type) => EVENT_TYPES.find(t => t.value === type)?.isMatch;
const getEventLabel = (type) => EVENT_TYPES.find(t => t.value === type)?.label || type;

const emptyForm = { title: "", type: "entrenamiento", team_id: "", date: "", end_date: "", location: "", field_id: "", opponent: "", notes: "", is_recurring: false, recurrence_until: "", send_notification: false, notification_message: "" };

// Tipos que pueden tener fecha fin multi-día
const MULTIDAY_TYPES = ["torneo", "stage", "concentracion"];

export default function Calendar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteSeriesId, setDeleteSeriesId] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedDay, setSelectedDay] = useState(null);
  const [filterTeam, setFilterTeam] = useState("all");
  const [convocatoriaEvent, setConvocatoriaEvent] = useState(null);
  const [attendanceEvent, setAttendanceEvent] = useState(null);
  const [sessionReportEvent, setSessionReportEvent] = useState(null);
  const [coachName, setCoachName] = useState("");
  const [viewMode, setViewMode] = useState("calendar"); // 'calendar', 'week', or 'list'

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date", 200),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: fields = [] } = useQuery({
    queryKey: ["fields"],
    queryFn: () => base44.entities.Field.list(),
  });

  const buildDefaultNotificationMessage = (event) => {
    const team = teams.find(t => t.id === event.team_id);
    const eventDate = event.date ? format(new Date(event.date), "dd/MM/yyyy 'a las' HH:mm") : "";
    const eventLabel = getEventLabel(event.type);
    return `Se ha añadido un nuevo evento al calendario:\n\n📌 ${event.title}\n🏷️ Tipo: ${eventLabel}\n📅 Fecha: ${eventDate}${event.location ? `\n📍 Lugar: ${event.location}` : ""}${team ? `\n🛡️ Equipo: ${team.name}` : ""}${event.notes ? `\n📝 Notas: ${event.notes}` : ""}`;
  };

  const sendEventNotifications = async (event, customMessage) => {
    if (!event.team_id) return;
    const [players, staff] = await Promise.all([
      base44.entities.Player.filter({ team_id: event.team_id }),
      base44.entities.StaffMember.filter({ team_id: event.team_id }),
    ]);
    const message = customMessage || buildDefaultNotificationMessage(event);
    const recipients = [
      ...players.filter(p => p.email).map(p => ({ email: p.email, name: `${p.first_name} ${p.last_name}` })),
      ...staff.filter(s => s.email).map(s => ({ email: s.email, name: `${s.first_name} ${s.last_name}` })),
    ];
    await Promise.all(recipients.map(r =>
      base44.integrations.Core.SendEmail({
        to: r.email,
        subject: `📅 Nuevo evento: ${event.title}`,
        body: `Hola ${r.name},\n\n${message}\n\nRS Data Manager`,
      }).catch(() => null)
    ));
  };

  const createRecurringEvents = async (baseData) => {
    const { is_recurring, recurrence_until, ...eventData } = baseData;
    const baseDate = new Date(eventData.date);
    const untilDate = new Date(recurrence_until);
    untilDate.setHours(23, 59, 59);
    const seriesId = `series_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const promises = [];
    let current = new Date(baseDate);
    while (current <= untilDate) {
      promises.push(base44.entities.Event.create({ ...eventData, date: new Date(current).toISOString(), series_id: seriesId }));
      current.setDate(current.getDate() + 7);
    }
    return Promise.all(promises);
  };

  const createMutation = useMutation({
    mutationFn: (data) => {
      if (data.is_recurring) return createRecurringEvents(data);
      const { is_recurring, recurrence_until, ...eventData } = data;
      return base44.entities.Event.create(eventData);
    },
    onSuccess: async (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      const notifMessage = variables.notification_message;
      const doSend = variables.send_notification;
      closeDialog();
      const createdEvent = Array.isArray(result) ? result[0] : result;
      if (createdEvent && doSend) {
        sendEventNotifications({ ...createdEvent }, notifMessage || null);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Event.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["events"] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Event.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["events"] }); setDeleteId(null); },
    onError: () => { queryClient.invalidateQueries({ queryKey: ["events"] }); setDeleteId(null); },
  });

  const deleteSeriesMutation = useMutation({
    mutationFn: async (seriesId) => {
      const seriesEvents = events.filter(e => e.series_id === seriesId);
      return Promise.all(seriesEvents.map(e => base44.entities.Event.delete(e.id)));
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["events"] }); setDeleteSeriesId(null); },
  });

  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const sourceDate = source.droppableId;
    const destDate = destination.droppableId;

    if (sourceDate !== destDate) {
      const event = events.find(e => e.id === draggableId);
      if (event) {
        const [year, month, day] = destDate.split('-');
        const currentTime = new Date(event.date);
        const newDate = new Date(year, parseInt(month) - 1, parseInt(day), currentTime.getHours(), currentTime.getMinutes());
        
        updateMutation.mutate({
          id: event.id,
          data: { ...event, date: newDate.toISOString() }
        });
      }
    }
  };

  const closeDialog = () => { setDialogOpen(false); setEditingEvent(null); setForm(emptyForm); };

  const openNewEvent = (day) => {
    const dateStr = format(day, "yyyy-MM-dd") + "T18:00";
    setForm({ ...emptyForm, date: dateStr, send_notification: false, notification_message: "" });
    setDialogOpen(true);
  };

  // Genera el mensaje de notificación por defecto cuando cambian campos relevantes
  const refreshDefaultMessage = (updatedForm) => {
    if (!updatedForm.send_notification) return updatedForm;
    const fakeEvent = {
      title: updatedForm.title || "(sin título)",
      type: updatedForm.type,
      date: updatedForm.date,
      location: updatedForm.location,
      notes: updatedForm.notes,
      team_id: updatedForm.team_id,
    };
    const msg = buildDefaultNotificationMessage(fakeEvent);
    return { ...updatedForm, notification_message: msg };
  };

  const openEdit = (event) => {
    setEditingEvent(event);
    const dateStr = event.date ? format(new Date(event.date), "yyyy-MM-dd'T'HH:mm") : "";
    const endDateStr = event.end_date ? format(new Date(event.end_date), "yyyy-MM-dd'T'HH:mm") : "";
    setForm({
      title: event.title || "", type: event.type || "entrenamiento",
      team_id: event.team_id || "", date: dateStr, end_date: endDateStr,
      location: event.location || "", field_id: event.field_id || "", opponent: event.opponent || "", notes: event.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const filteredEvents = filterTeam === "all" ? events : events.filter((e) => e.team_id === filterTeam);
  const getEventsForDay = (day) => filteredEvents.filter((e) => {
    const start = new Date(e.date);
    const end = e.end_date ? new Date(e.end_date) : start;
    const dayStart = startOfDay(day);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000 - 1);
    return start <= dayEnd && end >= dayStart;
  });
  const today = new Date();
  const dayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Administración</p>
          <h1>Calendario</h1>
          <p className="text-gray-400 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>Entrenamientos y partidos</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-40 h-8 text-sm border-gray-200 bg-white"><SelectValue placeholder="Equipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex border border-gray-200 rounded p-0.5 bg-white">
            <button onClick={() => setViewMode("calendar")} className={`px-2.5 py-1.5 text-xs font-bold rounded transition-colors ${viewMode === "calendar" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-700"}`} title="Mes">Mes</button>
            <button onClick={() => setViewMode("week")} className={`px-2.5 py-1.5 text-xs font-bold rounded transition-colors ${viewMode === "week" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-700"}`} title="Semana">Semana</button>
            <button onClick={() => setViewMode("list")} className={`px-2.5 py-1.5 text-xs font-bold rounded transition-colors ${viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-700"}`} title="Lista">Lista</button>
          </div>
          <Button size="sm" onClick={() => openNewEvent(today)} className="text-white h-8 text-xs" style={{ background: "var(--granate)" }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo
          </Button>
        </div>
      </div>

      {/* List View with Drag-Drop */}
      {viewMode === "list" && (
        <EventListWithDragDrop
          events={events}
          teams={teams}
          onDragEnd={handleDragEnd}
          onEdit={openEdit}
          onDelete={(id) => setDeleteId(id)}
          onDeleteSeries={(sid) => setDeleteSeriesId(sid)}
          onOpenAttendance={setAttendanceEvent}
          onOpenSession={setSessionReportEvent}
          onOpenConvocation={setConvocatoriaEvent}
          onNavigateMatch={(id, teamId) => navigate(`/MatchDetail?id=${id}&teamId=${teamId}`)}
          filterTeam={filterTeam}
        />
      )}

      {/* Weekly View */}
      {viewMode === "week" && (
        <div className="space-y-6">
          <WeeklyCalendar
            events={filteredEvents}
            teams={teams}
            filterTeam={filterTeam}
            onEventClick={(event) => {
              if (isMatchType(event.type)) {
                navigate(`/MatchDetail?id=${event.id}&teamId=${event.team_id}`);
              }
            }}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />

          {/* Selected Day Events */}
          {selectedDay && (
            <div className="bg-white border border-gray-200 overflow-hidden shadow-sm" style={{ borderRadius: "4px" }}>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="font-bold text-sm text-gray-800 capitalize" style={{ fontFamily: "var(--font-display)" }}>
                  {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
                </p>
                <Button size="sm" onClick={() => openNewEvent(selectedDay)} className="text-white h-7 text-xs" style={{ background: "var(--granate)" }}>
                  <Plus className="w-3 h-3 mr-1" /> Añadir
                </Button>
              </div>
              {dayEvents.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-300">Sin eventos</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {dayEvents.map((event) => {
                    const team = teams.find((t) => t.id === event.team_id);
                    const isMatch = isMatchType(event.type);
                    const showAttendance = attendanceEvent?.id === event.id;
                    return (
                      <div key={event.id}>
                        <div className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => { if (isMatch) navigate(`/MatchDetail?id=${event.id}&teamId=${event.team_id}`); }}>
                          <div className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-black text-white shrink-0"
                            style={{ background: isMatch ? "var(--granate)" : "var(--naranja)", fontFamily: "var(--font-display)" }}>
                            {getEventLabel(event.type).slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{event.title}</p>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                              <span>{getEventLabel(event.type)}</span>
                              {team && <span>· {team.name}</span>}
                              {event.opponent && <span>· vs {event.opponent}</span>}
                              {(event.location || event.field_id) && (
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="w-2.5 h-2.5" />
                                  {event.field_id ? fields.find(f => f.id === event.field_id)?.name || event.location : event.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-bold text-gray-500 shrink-0">{format(new Date(event.date), "HH:mm")}</span>
                          <div className="flex gap-0.5 shrink-0">
                            <button onClick={e => { e.stopPropagation(); setAttendanceEvent(showAttendance ? null : event); }}
                              className={`p-1 rounded transition-colors ${showAttendance ? "bg-green-100 text-green-700" : "hover:bg-green-50 text-gray-300 hover:text-green-600"}`} title="Asistencia">
                              <ClipboardList className="w-3.5 h-3.5" />
                            </button>
                            {!isMatch && <button onClick={e => { e.stopPropagation(); setSessionReportEvent(event); }} className="p-1 rounded hover:bg-purple-50 text-gray-300 hover:text-purple-600" title="Informe"><FileText className="w-3.5 h-3.5" /></button>}
                            {isMatch && <button onClick={e => { e.stopPropagation(); setConvocatoriaEvent(event); }} className="p-1 rounded hover:bg-blue-50 text-gray-300 hover:text-blue-600" title="Convocatoria"><Users className="w-3.5 h-3.5" /></button>}
                            <button onClick={e => { e.stopPropagation(); openEdit(event); }} className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={e => { e.stopPropagation(); setDeleteId(event.id); }} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            {event.series_id && <button onClick={e => { e.stopPropagation(); setDeleteSeriesId(event.series_id); }} className="p-1 rounded hover:bg-red-100 text-gray-300 hover:text-red-600 text-[9px] font-black" style={{ fontFamily: "var(--font-display)" }}>SERIE</button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 overflow-hidden shadow-sm rounded-xl">
            {/* Month nav */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-200 text-gray-500 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <p className="text-base font-black capitalize tracking-wide" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
                {format(currentMonth, "MMMM yyyy", { locale: es })}
              </p>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-200 text-gray-500 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 text-center border-b border-gray-100">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                <div key={d} className="py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
              {days.map((day, i) => {
                const dayEvts = getEventsForDay(day);
                const isToday = isSameDay(day, today);
                const inMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <button key={i} onClick={() => setSelectedDay(day)}
                    className={`p-1 text-left transition-colors min-h-[56px] flex flex-col gap-0.5 ${!inMonth ? "opacity-30" : ""} ${isSelected ? "bg-red-50" : isWeekend && inMonth ? "hover:bg-orange-50/60" : "hover:bg-gray-50"}`}
                    style={!isSelected && isWeekend && inMonth ? { background: "#fff8f0" } : {}}>
                    <span className={`text-[10px] font-bold inline-flex items-center justify-center w-5 h-5 rounded-full mb-0.5 ${isToday ? "text-white" : isSelected ? "text-white" : "text-gray-600"}`}
                      style={isToday ? { background: "var(--granate)" } : isSelected ? { background: "var(--granate)", opacity: 0.7 } : {}}>
                      {format(day, "d")}
                    </span>
                    {dayEvts.slice(0, 2).map((evt) => {
                      const isMatch = isMatchType(evt.type);
                      const eventColor = isMatch ? "var(--granate)" : "var(--naranja)";
                      return (
                        <div key={evt.id}
                          onClick={(e) => { e.stopPropagation(); isMatch ? navigate(`/MatchDetail?id=${evt.id}&teamId=${evt.team_id}`) : navigate(`/MyTeam/Attendance?eventId=${evt.id}`); }}
                          className="text-[9px] truncate px-1.5 py-0.5 rounded-full font-bold text-white hover:opacity-80 transition-opacity cursor-pointer leading-tight w-full"
                          style={{ background: eventColor }}>
                          {evt.title}
                        </div>
                      );
                    })}
                    {dayEvts.length > 2 && <p className="text-[9px] text-gray-400 px-0.5 font-medium">+{dayEvts.length - 2}</p>}
                  </button>
                );
              })}
            </div>

            {/* Legend inline */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-5 bg-gray-50/60">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--granate)" }} /><span className="text-[10px] text-gray-500 font-medium">Partido</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--naranja)" }} /><span className="text-[10px] text-gray-500 font-medium">Entrenamiento / Evento</span></div>
              <div className="ml-auto text-[10px] text-gray-400">{filteredEvents.length} evento{filteredEvents.length !== 1 ? "s" : ""}</div>
            </div>
          </div>

          {/* Selected Day Events */}
          {selectedDay && (
            <div className="bg-white border border-gray-200 overflow-hidden shadow-sm" style={{ borderRadius: "4px" }}>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="font-bold text-sm text-gray-800 capitalize" style={{ fontFamily: "var(--font-display)" }}>
                  {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
                </p>
                <Button size="sm" onClick={() => openNewEvent(selectedDay)} className="text-white h-7 text-xs" style={{ background: "var(--granate)" }}>
                  <Plus className="w-3 h-3 mr-1" /> Añadir
                </Button>
              </div>
              {dayEvents.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-300">Sin eventos</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {dayEvents.map((event) => {
                    const team = teams.find((t) => t.id === event.team_id);
                    const isMatch = isMatchType(event.type);
                    const showAttendance = attendanceEvent?.id === event.id;
                    return (
                      <div key={event.id}>
                        <div className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => { if (isMatch) navigate(`/MatchDetail?id=${event.id}&teamId=${event.team_id}`); }}>
                          <div className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-black text-white shrink-0"
                            style={{ background: isMatch ? "var(--granate)" : "var(--naranja)", fontFamily: "var(--font-display)" }}>
                            {getEventLabel(event.type).slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{event.title}</p>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                              <span>{getEventLabel(event.type)}</span>
                              {team && <span>· {team.name}</span>}
                              {event.opponent && <span>· vs {event.opponent}</span>}
                              {(event.location || event.field_id) && (
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="w-2.5 h-2.5" />
                                  {event.field_id ? fields.find(f => f.id === event.field_id)?.name || event.location : event.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-bold text-gray-500 shrink-0">{format(new Date(event.date), "HH:mm")}</span>
                          <div className="flex gap-0.5 shrink-0">
                            <button onClick={e => { e.stopPropagation(); setAttendanceEvent(showAttendance ? null : event); }}
                              className={`p-1 rounded transition-colors ${showAttendance ? "bg-green-100 text-green-700" : "hover:bg-green-50 text-gray-300 hover:text-green-600"}`} title="Asistencia">
                              <ClipboardList className="w-3.5 h-3.5" />
                            </button>
                            {!isMatch && <button onClick={e => { e.stopPropagation(); setSessionReportEvent(event); }} className="p-1 rounded hover:bg-purple-50 text-gray-300 hover:text-purple-600" title="Informe"><FileText className="w-3.5 h-3.5" /></button>}
                            {isMatch && <button onClick={e => { e.stopPropagation(); setConvocatoriaEvent(event); }} className="p-1 rounded hover:bg-blue-50 text-gray-300 hover:text-blue-600" title="Convocatoria"><Users className="w-3.5 h-3.5" /></button>}
                            <button onClick={e => { e.stopPropagation(); openEdit(event); }} className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={e => { e.stopPropagation(); setDeleteId(event.id); }} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            {event.series_id && <button onClick={e => { e.stopPropagation(); setDeleteSeriesId(event.series_id); }} className="p-1 rounded hover:bg-red-100 text-gray-300 hover:text-red-600 text-[9px] font-black" style={{ fontFamily: "var(--font-display)" }}>SERIE</button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">{editingEvent ? "Editar Evento" : "Nuevo Evento"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700">Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="border-gray-200" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700">Tipo *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Equipo *</Label>
                <Select value={form.team_id} onValueChange={(v) => setForm({ ...form, team_id: v })}>
                  <SelectTrigger className="border-gray-200"><SelectValue placeholder="Equipo" /></SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700">Fecha y hora inicio *</Label>
                <Input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="border-gray-200" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Hora fin</Label>
                <Input
                  type={MULTIDAY_TYPES.includes(form.type) ? "datetime-local" : "time"}
                  value={
                    MULTIDAY_TYPES.includes(form.type)
                      ? form.end_date
                      : form.end_date
                        ? form.end_date.includes("T") ? form.end_date.split("T")[1].slice(0, 5) : form.end_date
                        : ""
                  }
                  onChange={(e) => {
                    if (MULTIDAY_TYPES.includes(form.type)) {
                      setForm({ ...form, end_date: e.target.value });
                    } else {
                      // Construye end_date con la misma fecha que date pero hora distinta
                      const baseDate = form.date ? form.date.slice(0, 10) : "";
                      setForm({ ...form, end_date: baseDate ? `${baseDate}T${e.target.value}` : e.target.value });
                    }
                  }}
                  className="border-gray-200"
                  placeholder={MULTIDAY_TYPES.includes(form.type) ? "" : "HH:mm"}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700">Lugar / dirección</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="border-gray-200" placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Campo registrado</Label>
                <Select value={form.field_id || "none"} onValueChange={v => setForm({ ...form, field_id: v === "none" ? "" : v })}>
                  <SelectTrigger className="border-gray-200"><SelectValue placeholder="Sin campo asignado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin campo asignado</SelectItem>
                    {fields.filter(f => f.available !== false).map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isMatchType(form.type) && (
              <div className="space-y-2">
                <Label className="text-gray-700">Rival</Label>
                <Input value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} className="border-gray-200" />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-gray-700">Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-gray-200" rows={3} />
            </div>

            {/* Notificación — solo en creación */}
            {!editingEvent && (
              <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="send_notification"
                    checked={form.send_notification}
                    onCheckedChange={(v) => {
                      const updated = { ...form, send_notification: !!v };
                      if (!!v && !form.notification_message) {
                        const fakeEvent = {
                          title: form.title || "(sin título)",
                          type: form.type,
                          date: form.date,
                          location: form.location,
                          notes: form.notes,
                          team_id: form.team_id,
                        };
                        updated.notification_message = buildDefaultNotificationMessage(fakeEvent);
                      }
                      setForm(updated);
                    }}
                  />
                  <Label htmlFor="send_notification" className="text-gray-700 cursor-pointer font-medium">
                    Enviar notificación por email al equipo
                  </Label>
                </div>
                {form.send_notification && (
                  <div className="space-y-2 pl-7">
                    <Label className="text-gray-600 text-sm">Mensaje del email</Label>
                    <Textarea
                      value={form.notification_message}
                      onChange={(e) => setForm({ ...form, notification_message: e.target.value })}
                      className="border-gray-200 text-sm"
                      rows={5}
                      placeholder="Escribe el mensaje que recibirán los miembros del equipo..."
                    />
                    <p className="text-xs text-gray-400">El mensaje irá precedido de "Hola [nombre]," y finalizado con "RS Data Manager".</p>
                  </div>
                )}
              </div>
            )}

            {/* Recurrencia — solo en creación */}
            {!editingEvent && (
              <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="recurring"
                    checked={form.is_recurring}
                    onCheckedChange={(v) => setForm({ ...form, is_recurring: !!v })}
                  />
                  <Label htmlFor="recurring" className="text-gray-700 cursor-pointer font-medium">
                    Evento recurrente (semanal)
                  </Label>
                </div>
                {form.is_recurring && (
                  <div className="space-y-3 pl-7">
                    <div className="space-y-1">
                      <Label className="text-gray-600 text-sm">Repetir cada semana hasta</Label>
                      <Input
                        type="date"
                        value={form.recurrence_until}
                        min={form.date ? form.date.slice(0, 10) : undefined}
                        onChange={(e) => setForm({ ...form, recurrence_until: e.target.value })}
                        required={form.is_recurring}
                        className="border-gray-200"
                      />
                    </div>
                    {form.date && form.recurrence_until && (
                      <p className="text-xs text-gray-400">
                        {(() => {
                          const base = new Date(form.date);
                          const until = new Date(form.recurrence_until);
                          const weeks = Math.floor((until - base) / (7 * 24 * 3600 * 1000)) + 1;
                          const dayName = format(base, "EEEE", { locale: es });
                          return `Se crearán ${weeks} eventos, cada ${dayName}, desde el ${format(base, "d MMM", { locale: es })} hasta el ${format(until, "d MMM yyyy", { locale: es })}.`;
                        })()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" className="text-white" style={{ background: "var(--granate)" }}>{editingEvent ? "Guardar" : "Crear"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <EventAttendanceDialog
        event={attendanceEvent}
        open={!!attendanceEvent}
        onOpenChange={(o) => { if (!o) setAttendanceEvent(null); }}
      />

      <ConvocatoriaDialog
        open={!!convocatoriaEvent}
        onOpenChange={(o) => { if (!o) setConvocatoriaEvent(null); }}
        event={convocatoriaEvent}
        teamId={convocatoriaEvent?.team_id}
      />

      <SessionReportDialog
        open={!!sessionReportEvent}
        onOpenChange={(o) => { if (!o) setSessionReportEvent(null); }}
        event={sessionReportEvent}
        teamId={sessionReportEvent?.team_id}
        coachName={coachName}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSeriesId} onOpenChange={(open) => { if (!open) setDeleteSeriesId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar toda la serie?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán <strong>todos los eventos de esta serie recurrente</strong> ({events.filter(e => e.series_id === deleteSeriesId).length} eventos). Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteSeriesMutation.mutate(deleteSeriesId)} className="bg-red-600 hover:bg-red-700 text-white">
              {deleteSeriesMutation.isPending ? "Eliminando..." : "Eliminar toda la serie"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}