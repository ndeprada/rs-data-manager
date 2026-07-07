import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, getISOWeek } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, XCircle, AlertCircle, ChevronRight, ArrowLeft, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSelectedTeam } from "@/lib/useSelectedTeam";
import { useLocation } from "react-router-dom";
import EditEventDialog from "@/components/myteam/EditEventDialog";
import GuestPlayerSelector from "@/components/common/GuestPlayerSelector";

const STATUS_CONFIG = {
  present: { label: "Asistió", cls: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  apart: { label: "A parte", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: AlertCircle },
  absent: { label: "Ausente", cls: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
};
const ABSENCE_REASONS = [
  { value: "lesion", label: "Lesión" }, { value: "enfermo", label: "Enfermo" },
  { value: "clase", label: "Clase" }, { value: "examen", label: "Examen" },
  { value: "viaje", label: "Viaje" }, { value: "familiar", label: "Familiar" },
  { value: "permiso", label: "Permiso" }, { value: "otro", label: "Otro" },
];
const TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico", "sesion_teorica", "sesion_video", "torneo"];

const POSITION_GROUP = {
  portero: "Porteros",
  lateral: "Defensas", central: "Defensas", libre: "Defensas",
  mediocentro: "Medios", interior: "Medios",
  extremo: "Delanteros", delantero_centro: "Delanteros",
};
const GROUP_ORDER = ["Porteros", "Defensas", "Medios", "Delanteros", "Sin posición"];

export default function TeamAttendance() {
  const qc = useQueryClient();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const preselectedEventId = urlParams.get("eventId") || "";

  const { selectedTeamId, selectTeam, isCoordinator, canSwitch } = useSelectedTeam();
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId);
  const [pendingChanges, setPendingChanges] = useState({});
  const [editingEvent, setEditingEvent] = useState(null);
  const [guestPlayers, setGuestPlayers] = useState([]);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date", 200) });
  const { data: allAttendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });

  const now = new Date();
  const allTeamTrainings = events.filter(e => e.team_id === selectedTeamId && TRAINING_TYPES.includes(e.type));
  const upcoming = allTeamTrainings.filter(e => new Date(e.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = allTeamTrainings.filter(e => new Date(e.date) < now).sort((a, b) => new Date(b.date) - new Date(a.date));
  const teamEvents = [...upcoming, ...past];

  const teamPlayers = players.filter(p => p.team_id === selectedTeamId && p.status !== "baja");

  const selectedEvent = teamEvents.find(e => e.id === selectedEventId);

  const eventAttendance = allAttendance.filter(a =>
    a.event_id === selectedEventId || (selectedEvent && a.date === selectedEvent.date?.split("T")[0])
  );

  // Reconstruir jugadores invitados a partir de los registros guardados del evento
  useEffect(() => {
    if (!selectedEventId || players.length === 0 || eventAttendance.length === 0) {
      setGuestPlayers([]);
      return;
    }
    const teamPlayerIds = new Set(teamPlayers.map(p => p.id));
    const guestIds = eventAttendance.map(r => r.player_id).filter(id => !teamPlayerIds.has(id));
    const guestObjects = guestIds.map(id => players.find(p => p.id === id)).filter(Boolean);
    setGuestPlayers(guestObjects);
  }, [selectedEventId, eventAttendance.length, players.length]);

  const saveMutation = useMutation({
    mutationFn: async (changes) => {
      for (const [playerId, data] of Object.entries(changes)) {
        const existing = eventAttendance.find(a => a.player_id === playerId);
        const payload = {
          player_id: playerId,
          event_id: selectedEventId,
          date: selectedEvent?.date?.split("T")[0],
          ...data,
        };
        if (existing) await base44.entities.TrainingAttendance.update(existing.id, payload);
        else await base44.entities.TrainingAttendance.create(payload);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); setPendingChanges({}); },
  });

  const setPlayerStatus = (playerId, status) => {
    setPendingChanges(prev => ({ ...prev, [playerId]: { ...prev[playerId], status } }));
  };
  const setPlayerReason = (playerId, absence_reason) => {
    setPendingChanges(prev => ({ ...prev, [playerId]: { ...prev[playerId], absence_reason } }));
  };
  const setPlayerNotes = (playerId, notes) => {
    setPendingChanges(prev => ({ ...prev, [playerId]: { ...prev[playerId], notes } }));
  };

  const getPlayerAttendance = (playerId) => {
    const pending = pendingChanges[playerId];
    const saved = eventAttendance.find(a => a.player_id === playerId);
    return pending || (saved ? { status: saved.status, absence_reason: saved.absence_reason, notes: saved.notes } : {});
  };

  const allSessionPlayers = [...teamPlayers, ...guestPlayers.filter(p => p.team_id !== selectedTeamId)];

  // Resumen de la sesión seleccionada (incluye invitados)
  const sessionSummary = allSessionPlayers.reduce((acc, p) => {
    const att = getPlayerAttendance(p.id);
    if (att.status === "present") acc.present++;
    else if (att.status === "apart") acc.apart++;
    else if (att.status === "absent") acc.absent++;
    else acc.pending++;
    return acc;
  }, { present: 0, apart: 0, absent: 0, pending: 0 });

  // Jugadores agrupados por grupo de posición
  const playersByGroup = teamPlayers.reduce((acc, p) => {
    const group = POSITION_GROUP[p.position] || "Sin posición";
    if (!acc[group]) acc[group] = [];
    acc[group].push(p);
    return acc;
  }, {});
  const sortedPositionKeys = GROUP_ORDER.filter(g => playersByGroup[g]);

  // Stats per player across all training events
  const playerSessionStats = teamPlayers.map(p => {
    const records = allAttendance.filter(a => a.player_id === p.id);
    const present = records.filter(a => a.status === "present").length;
    const apart = records.filter(a => a.status === "apart").length;
    const absent = records.filter(a => a.status === "absent").length;
    return { ...p, present, apart, absent, total: records.length };
  });

  return (
    <div className="space-y-6">
      <Link to="/MyTeam" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" /> Volver a Mi Equipo
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1" style={{ fontFamily: "var(--font-display)" }}>Mi Equipo</p>
          <h1 className="text-3xl font-black uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Entrenamientos</h1>
        </div>
        {canSwitch && (
          <Select value={selectedTeamId} onValueChange={selectTeam}>
            <SelectTrigger className="w-48 border-gray-200 bg-white"><SelectValue placeholder="Equipo" /></SelectTrigger>
            <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {/* Event list */}
        <div className="bg-white border border-gray-200 shadow-sm" style={{ borderRadius: "4px" }}>
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Sesiones</h2>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {teamEvents.length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">Sin entrenamientos</p>
            ) : (() => {
              // Group by ISO week key
              const groups = {};
              teamEvents.forEach(ev => {
                const d = new Date(ev.date);
                const weekKey = `${d.getFullYear()}-W${String(getISOWeek(d)).padStart(2, "0")}`;
                if (!groups[weekKey]) groups[weekKey] = { weekKey, events: [], date: d };
                groups[weekKey].events.push(ev);
              });
              return Object.values(groups).map(({ weekKey, events: wevs, date }) => {
                const wStart = startOfWeek(date, { weekStartsOn: 1 });
                const wEnd = endOfWeek(date, { weekStartsOn: 1 });
                const isCurrentWeek = new Date() >= wStart && new Date() <= wEnd;
                return (
                  <div key={weekKey}>
                    <div className="px-4 py-1.5 flex items-center gap-2 sticky top-0 z-10" style={{ background: "#f9fafb", borderBottom: "1px solid #f3f4f6", borderTop: "1px solid #f3f4f6" }}>
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ fontFamily: "var(--font-display)", color: isCurrentWeek ? "var(--naranja)" : "#9ca3af" }}>
                        Sem. {getISOWeek(date)}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {format(wStart, "d MMM", { locale: es })} – {format(wEnd, "d MMM", { locale: es })}
                      </span>
                      {isCurrentWeek && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full" style={{ background: "var(--naranja)", color: "white", fontFamily: "var(--font-display)" }}>Esta semana</span>}
                    </div>
                    {wevs.map(ev => {
                      const isPast = new Date(ev.date) < now;
                      const hasRecords = allAttendance.some(a => a.event_id === ev.id || a.date === ev.date?.split("T")[0]);
                      const managed = isPast && hasRecords;
                      const pendingMgmt = isPast && !hasRecords;
                      return (
                        <button key={ev.id} onClick={() => setSelectedEventId(ev.id)}
                          className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${selectedEventId === ev.id ? "bg-gray-50" : "hover:bg-gray-50"}`}>
                          <div className="w-px h-8 shrink-0 rounded" style={{ background: selectedEventId === ev.id ? "var(--naranja)" : "#e5e7eb" }} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 truncate text-sm" style={{ fontFamily: "var(--font-display)" }}>{ev.title}</p>
                            <p className="text-[10px] text-gray-400">{format(new Date(ev.date), "EEE d MMM · HH:mm", { locale: es })}</p>
                            {managed && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200" style={{ fontFamily: "var(--font-display)" }}>✓ Gestionado</span>
                            )}
                            {pendingMgmt && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" style={{ fontFamily: "var(--font-display)" }}>⚠ Pendiente</span>
                            )}
                          </div>
                          {selectedEventId === ev.id && <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--naranja)" }} />}
                        </button>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Attendance sheet */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedEvent ? (
            <div className="bg-white border border-gray-200 p-12 text-center shadow-sm" style={{ borderRadius: "4px" }}>
              <p className="text-gray-400 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>Selecciona una sesión</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header + resumen */}
              <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px", borderLeft: "3px solid var(--naranja)" }}>
                {/* Título y fecha */}
                <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-black text-sm uppercase truncate" style={{ fontFamily: "var(--font-display)", color: "var(--naranja)" }}>{selectedEvent.title}</h2>
                    <p className="text-xs text-gray-400">{format(new Date(selectedEvent.date), "EEEE d MMMM · HH:mm", { locale: es })}</p>
                  </div>
                  <button onClick={() => setEditingEvent(selectedEvent)} className="p-1.5 rounded hover:bg-orange-50 text-gray-400 hover:text-orange-600 transition-colors shrink-0" title="Editar evento">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                {/* Resumen de la sesión — fila única con scroll si no cabe */}
                <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border bg-green-50 border-green-200 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs font-black text-green-700" style={{ fontFamily: "var(--font-display)" }}>{sessionSummary.present}</span>
                    <span className="text-[10px] text-green-600 uppercase tracking-wide">Presentes</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border bg-blue-50 border-blue-200 shrink-0">
                    <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs font-black text-blue-700" style={{ fontFamily: "var(--font-display)" }}>{sessionSummary.apart}</span>
                    <span className="text-[10px] text-blue-600 uppercase tracking-wide">A parte</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border bg-red-50 border-red-200 shrink-0">
                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                    <span className="text-xs font-black text-red-700" style={{ fontFamily: "var(--font-display)" }}>{sessionSummary.absent}</span>
                    <span className="text-[10px] text-red-600 uppercase tracking-wide">Ausentes</span>
                  </div>
                  {sessionSummary.pending > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border bg-gray-50 border-gray-200 shrink-0">
                      <span className="text-xs font-black text-gray-500" style={{ fontFamily: "var(--font-display)" }}>{sessionSummary.pending}</span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">Sin marcar</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <Button variant="outline" size="sm" className="text-xs h-7 border-green-200 text-green-700 hover:bg-green-50 whitespace-nowrap"
                     onClick={() => {
                       const changes = {};
                       allSessionPlayers.forEach(p => { changes[p.id] = { status: "present", absence_reason: undefined, notes: getPlayerAttendance(p.id).notes || "" }; });
                       setPendingChanges(prev => ({ ...prev, ...changes }));
                     }}>
                     ✓ Marcar todos
                    </Button>
                    <Button onClick={() => saveMutation.mutate(pendingChanges)} disabled={Object.keys(pendingChanges).length === 0 || saveMutation.isPending}
                      size="sm" className="text-white text-xs h-7 whitespace-nowrap" style={{ background: "var(--granate)" }}>
                      {saveMutation.isPending ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tabla agrupada por posición */}
              <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ fontSize: "12px" }}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                        <th className="text-left px-3 py-2 font-bold w-44">Jugador</th>
                        <th className="text-center px-2 py-2 font-bold">Asistencia</th>
                        <th className="text-left px-2 py-2 font-bold w-24 hidden sm:table-cell">Motivo</th>
                        <th className="text-left px-2 py-2 font-bold hidden lg:table-cell">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPositionKeys.map(group => (
                        <React.Fragment key={group}>
                          <tr>
                            <td colSpan={4} className="px-3 py-1.5 sticky top-0" style={{ background: "#f3f4f6", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
                              <span className="text-[10px] font-black uppercase tracking-widest" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
                                {group}
                                <span className="ml-1.5 text-gray-400 font-normal">({playersByGroup[group].length})</span>
                              </span>
                            </td>
                          </tr>
                          {playersByGroup[group].map(p => {
                           const att = getPlayerAttendance(p.id);
                           return (
                             <tr key={p.id} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                               <td className="px-3 py-2">
                                 <div className="flex items-center gap-1.5">
                                   <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: "var(--granate)" }}>
                                     {p.first_name?.[0]}{p.last_name?.[0]}
                                   </div>
                                   <div className="min-w-0">
                                     <span className="font-bold text-gray-900 truncate block" style={{ fontFamily: "var(--font-display)", fontSize: "11px" }}>{p.first_name} {p.last_name}</span>
                                     {p.jersey_number && <span className="text-[9px] text-gray-400">#{p.jersey_number} · </span>}
                                     <span className="text-[9px] text-gray-400 capitalize">{p.position || ""}</span>
                                   </div>
                                 </div>
                               </td>
                                <td className="px-2 py-2">
                                  <div className="flex items-center justify-center gap-1">
                                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                      <button key={key} onClick={() => setPlayerStatus(p.id, key)}
                                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border transition-colors whitespace-nowrap ${att.status === key ? cfg.cls : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"}`}>
                                        {cfg.label}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-2 py-2 hidden sm:table-cell">
                                  {att.status === "absent" ? (
                                    <Select value={att.absence_reason || ""} onValueChange={v => setPlayerReason(p.id, v)}>
                                      <SelectTrigger className="h-6 text-[10px] border-gray-200 bg-white w-24"><SelectValue placeholder="Motivo" /></SelectTrigger>
                                      <SelectContent>{ABSENCE_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                  ) : <span className="text-gray-300 text-[10px]">—</span>}
                                </td>
                                <td className="px-2 py-2 hidden lg:table-cell">
                                  <Input
                                    value={att.notes || ""}
                                    onChange={e => setPlayerNotes(p.id, e.target.value)}
                                    placeholder="Observaciones..."
                                    className="h-6 text-[10px] border-gray-200"
                                    style={{ minWidth: 0 }}
                                  />
                                </td>
                                </tr>
                                );
                                })}
                                </React.Fragment>
                                ))}
                                {/* Jugadores de otros equipos */}
                                {guestPlayers.filter(p => p.team_id !== selectedTeamId).length > 0 && (
                                <React.Fragment>
                                <tr>
                                <td colSpan={4} className="px-3 py-1.5" style={{ background: "#eff6ff", borderTop: "1px solid #bfdbfe", borderBottom: "1px solid #bfdbfe" }}>
                                <span className="text-[10px] font-black uppercase tracking-widest" style={{ fontFamily: "var(--font-display)", color: "#2563eb" }}>
                                Jugadores de otros equipos
                                <span className="ml-1.5 text-blue-400 font-normal">({guestPlayers.filter(p => p.team_id !== selectedTeamId).length})</span>
                                </span>
                                </td>
                                </tr>
                                {guestPlayers.filter(p => p.team_id !== selectedTeamId).map(p => {
                                const att = getPlayerAttendance(p.id);
                                const guestTeam = teams.find(t => t.id === p.team_id);
                                return (
                                <tr key={p.id} className="hover:bg-blue-50/40 transition-colors border-b border-blue-50 bg-blue-50/20">
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: "#3b82f6" }}>
                                      {p.first_name?.[0]}{p.last_name?.[0]}
                                    </div>
                                    <div className="min-w-0">
                                      <span className="font-bold text-gray-900 truncate block" style={{ fontFamily: "var(--font-display)", fontSize: "11px" }}>{p.first_name} {p.last_name}</span>
                                      <span className="text-[9px] text-blue-500">{guestTeam?.name || "Otro equipo"}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex items-center justify-center gap-1">
                                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                      <button key={key} onClick={() => setPlayerStatus(p.id, key)}
                                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border transition-colors whitespace-nowrap ${att.status === key ? cfg.cls : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"}`}>
                                        {cfg.label}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-2 py-2 hidden sm:table-cell">
                                  {att.status === "absent" ? (
                                    <Select value={att.absence_reason || ""} onValueChange={v => setPlayerReason(p.id, v)}>
                                      <SelectTrigger className="h-6 text-[10px] border-gray-200 bg-white w-24"><SelectValue placeholder="Motivo" /></SelectTrigger>
                                      <SelectContent>{ABSENCE_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                  ) : <span className="text-gray-300 text-[10px]">—</span>}
                                </td>
                                <td className="px-2 py-2 hidden lg:table-cell">
                                  <Input
                                    value={att.notes || ""}
                                    onChange={e => setPlayerNotes(p.id, e.target.value)}
                                    placeholder="Observaciones..."
                                    className="h-6 text-[10px] border-gray-200"
                                    style={{ minWidth: 0 }}
                                  />
                                </td>
                                </tr>
                                );
                                })}
                                </React.Fragment>
                                )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Selector de jugadores de otros equipos */}
              <div>
                <GuestPlayerSelector
                  teamId={selectedTeamId}
                  selectedPlayers={guestPlayers.map(p => p.id)}
                  onAdd={(player) => {
                    if (!guestPlayers.find(p => p.id === player.id)) {
                      setGuestPlayers(prev => [...prev, player]);
                    }
                  }}
                  onRemove={(playerId) => {
                    setGuestPlayers(prev => prev.filter(p => p.id !== playerId));
                    setPendingChanges(prev => { const n = { ...prev }; delete n[playerId]; return n; });
                  }}
                  type="training"
                />
              </div>
            </div>
          )}

          {/* Attendance summary table */}
          <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Resumen de asistencia</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                    <th className="text-left px-5 py-2.5 font-bold">Jugador</th>
                    <th className="text-center px-3 py-2.5 font-bold text-green-600">Asiste</th>
                    <th className="text-center px-3 py-2.5 font-bold text-blue-600 hidden sm:table-cell">A parte</th>
                    <th className="text-center px-3 py-2.5 font-bold text-red-600">Ausente</th>
                    <th className="text-center px-3 py-2.5 font-bold hidden sm:table-cell">Total</th>
                    <th className="text-center px-3 py-2.5 font-bold">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {playerSessionStats.map(p => {
                    const effective = p.present + p.apart;
                    return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5 font-bold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>{p.first_name} {p.last_name}</td>
                      <td className="px-3 py-2.5 text-center font-black text-green-700" style={{ fontFamily: "var(--font-display)" }}>{p.present}</td>
                      <td className="px-3 py-2.5 text-center font-black text-blue-700 hidden sm:table-cell" style={{ fontFamily: "var(--font-display)" }}>{p.apart}</td>
                      <td className="px-3 py-2.5 text-center font-black text-red-600" style={{ fontFamily: "var(--font-display)" }}>{p.absent}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500 hidden sm:table-cell">{p.total}</td>
                      <td className="px-3 py-2.5 text-center">
                        {p.total > 0 ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${
                            (effective / p.total) >= 0.8 ? "bg-green-50 text-green-700 border-green-200" :
                            (effective / p.total) >= 0.6 ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                            "bg-red-50 text-red-700 border-red-200"
                          }`}>{Math.round((effective / p.total) * 100)}%</span>
                        ) : "—"}
                      </td>
                    </tr>
                  );})}  
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    <EditEventDialog
        open={!!editingEvent}
        onOpenChange={(open) => { if (!open) setEditingEvent(null); }}
        event={editingEvent}
      />
    </div>
  );
}