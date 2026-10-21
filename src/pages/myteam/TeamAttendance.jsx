import React, { useState, useRef, useMemo, useEffect } from "react";
import PlayerName from "@/components/common/PlayerName";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Pencil, X, UserPlus, Check, MessageSquarePlus, HeartPulse, Ban, RotateCcw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TeamPageHeader from "@/components/myteam/TeamPageHeader";
import { useSelectedTeam } from "@/lib/useSelectedTeam";
import EditEventDialog from "@/components/myteam/EditEventDialog";
import CreateEventDialog from "@/components/myteam/CreateEventDialog";
import GuestPlayerSelector from "@/components/common/GuestPlayerSelector";
import { birthYearOf } from "@/lib/birthYear";
import WeeklyCalendar from "@/components/myteam/WeeklyCalendar";
import { playerFullName } from "@/lib/playerName";
import QuickInjuryDialog from "@/components/myteam/QuickInjuryDialog";
import CancelEventDialog from "@/components/myteam/CancelEventDialog";
import BulkCancelButton from "@/components/myteam/BulkCancelButton";
import { isCancelled, cancelText } from "@/lib/eventCancel";

const STATUS_CONFIG = {
  present: { label: "Asiste", short: "Asiste", cls: "bg-green-600 text-white border-green-600" },
  apart: { label: "A parte", short: "A parte", cls: "bg-blue-600 text-white border-blue-600" },
  absent: { label: "No asiste", short: "No", cls: "bg-red-600 text-white border-red-600" },
};
const ABSENCE_REASONS = [
  { value: "lesion", label: "Lesión" }, { value: "enfermo", label: "Enfermo" },
  { value: "clase", label: "Clase" }, { value: "examen", label: "Examen" },
  { value: "viaje", label: "Viaje" }, { value: "familiar", label: "Familiar" },
  { value: "permiso", label: "Permiso" }, { value: "otro", label: "Otro" },
];
const REASON_LABEL = Object.fromEntries(ABSENCE_REASONS.map(r => [r.value, r.label]));
const TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico", "sesion_teorica", "sesion_video"];
const POSITION_LABELS = {
  portero: "Portero", lateral: "Lateral", central: "Central", libre: "Libre", mediocentro: "Mediocentro",
  interior: "Interior", extremo: "Extremo", delantero_centro: "Delantero",
};
const POSITION_ORDER = ["portero", "lateral", "central", "libre", "mediocentro", "interior", "extremo", "delantero_centro"];
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

export default function TeamAttendance() {
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const eventId = new URLSearchParams(location.search).get("eventId") || "";
  const urlTeamId = new URLSearchParams(location.search).get("teamId") || "";

  const { selectedTeamId, selectTeam, canSwitch, isCoordinator, teamIds: myTeamIds } = useSelectedTeam();
  // Un enlace a un entrenamiento de otro equipo (p. ej. desde el listado de pendientes de coordinación) abre ese equipo
  useEffect(() => { if (urlTeamId && canSwitch && urlTeamId !== selectedTeamId) selectTeam(urlTeamId); }, [urlTeamId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editingEvent, setEditingEvent] = useState(null);
  const [cancelFor, setCancelFor] = useState(null); // evento que se marca/restaura como cancelado
  const [createEventDate, setCreateEventDate] = useState(null);
  const [trialName, setTrialName] = useState("");
  const [showGuests, setShowGuests] = useState(false);
  const [showExternal, setShowExternal] = useState(true);
  const [injuryFor, setInjuryFor] = useState(null); // jugador para el que se registra una lesión
  const [noteOpen, setNoteOpen] = useState(() => new Set()); // filas con la nota desplegada
  const chain = useRef({}); // serializa guardados por jugador

  // Al pasar a otro entrenamiento empieza limpio: observaciones desplegadas, "convocar de otro equipo" y nombre a prueba a medias
  const [shownEventId, setShownEventId] = useState(eventId);
  if (shownEventId !== eventId) {
    setShownEventId(eventId);
    setNoteOpen(new Set());
    setShowGuests(false);
    setTrialName("");
  }

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: allAttendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries_open"], queryFn: () => base44.entities.Injury.list() });
  const openInjury = useMemo(() => new Map(injuries.filter(i => i.status !== "alta").map(i => [i.player_id, i])), [injuries]);

  const trainings = useMemo(
    () => events.filter(e => e.team_id === selectedTeamId && TRAINING_TYPES.includes(e.type)),
    [events, selectedTeamId]
  );
  const teamPlayers = useMemo(() => {
    const rank = (p) => { const i = POSITION_ORDER.indexOf(p.position); return i < 0 ? 99 : i; };
    return players
      .filter(p => p.team_id === selectedTeamId && p.status !== "baja")
      .sort((a, b) => rank(a) - rank(b) || (a.last_name || "").localeCompare(b.last_name || ""));
  }, [players, selectedTeamId]);

  const selectedEvent = trainings.find(e => e.id === eventId);
  const offSel = isCancelled(selectedEvent);
  const recordsOf = (ev) => allAttendance.filter(a =>
    a.event_id === ev.id || (!a.event_id && a.date === ev.date?.split("T")[0])
  );
  const eventRecords = selectedEvent ? recordsOf(selectedEvent) : [];

  // ── Guardado automático ──
  const save = (playerId, patch, extra = {}) => {
    const ev = selectedEvent;
    if (!ev) return;
    const prev = chain.current[playerId] || Promise.resolve();
    chain.current[playerId] = prev.then(async () => {
      const cached = qc.getQueryData(["attendance"]) || [];
      const existing = cached.find(a => a.player_id === playerId && (a.event_id === ev.id || (!a.event_id && a.date === ev.date?.split("T")[0])));
      if (existing) {
        const merged = { ...existing, ...patch, event_id: ev.id };
        qc.setQueryData(["attendance"], (old = []) => old.map(a => a.id === existing.id ? merged : a));
        await base44.entities.TrainingAttendance.update(existing.id, { ...patch, event_id: ev.id });
      } else {
        const payload = { player_id: playerId, event_id: ev.id, date: ev.date?.split("T")[0], ...extra, ...patch };
        const tempId = `tmp_${Math.random()}`;
        qc.setQueryData(["attendance"], (old = []) => [...old, { id: tempId, ...payload }]);
        const created = await base44.entities.TrainingAttendance.create(payload);
        qc.setQueryData(["attendance"], (old = []) => old.map(a => a.id === tempId ? { ...payload, ...created } : a));
      }
    }).catch(() => qc.invalidateQueries({ queryKey: ["attendance"] }));
  };

  const removeRecord = async (playerId) => {
    const recs = eventRecords.filter(a => a.player_id === playerId);
    qc.setQueryData(["attendance"], (old = []) => old.filter(a => !recs.some(r => r.id === a.id)));
    for (const r of recs) if (!String(r.id).startsWith("tmp_")) await base44.entities.TrainingAttendance.delete(r.id);
  };

  const setStatus = (pid, status) => {
    const patch = { status };
    if (status !== "absent") patch.absence_reason = null;
    save(pid, patch);
  };

  // Jugadores de la sesión: plantilla + invitados + a prueba (los dos últimos solo existen por sus registros)
  const rosterIds = new Set(teamPlayers.map(p => p.id));
  const guests = eventRecords
    .filter(r => !rosterIds.has(r.player_id) && !r.trial_name)
    .map(r => players.find(p => p.id === r.player_id)).filter(Boolean);
  const trials = eventRecords.filter(r => r.trial_name);
  const recFor = (pid) => eventRecords.find(a => a.player_id === pid) || {};
  const sessionCounts = (() => {
    const c = { present: 0, apart: 0, absent: 0, pending: 0 };
    teamPlayers.forEach(p => { const st = recFor(p.id).status; if (st && c[st] !== undefined) c[st]++; else c.pending++; });
    return c;
  })();

  const addTrial = () => {
    const name = trialName.trim();
    if (!name) return;
    save(`prueba_${Date.now()}`, {}, { trial_name: name });
    setTrialName("");
  };

  // ── Resumen por jugador ──
  const doneSessions = trainings.filter(e => !isCancelled(e) && recordsOf(e).some(r => r.status)); // sesiones con asistencia anotada (las canceladas no cuentan)
  const doneIds = new Set(doneSessions.map(e => e.id));
  const summary = teamPlayers.map(p => {
    const recs = allAttendance.filter(a => a.player_id === p.id && doneIds.has(a.event_id));
    const c = { present: 0, apart: 0, absent: 0, reasons: {} };
    recs.forEach(a => {
      if (a.status === "present") c.present++;
      else if (a.status === "apart") c.apart++;
      else if (a.status === "absent") { c.absent++; const k = a.absence_reason || "otro"; c.reasons[k] = (c.reasons[k] || 0) + 1; }
    });
    return { p, ...c };
  });
  const total = doneSessions.length;

  // Jugadores externos (otros equipos del club y a prueba) con asistencia anotada en sesiones de este equipo
  const external = (() => {
    const map = {};
    allAttendance.forEach(a => {
      if (!doneIds.has(a.event_id) || !a.status || rosterIds.has(a.player_id)) return;
      const isTrial = !!a.trial_name;
      const pl = isTrial ? null : players.find(p => p.id === a.player_id);
      if (!isTrial && !pl) return;
      const key = isTrial ? `t_${a.trial_name.trim().toLowerCase()}` : a.player_id;
      const e = map[key] || (map[key] = { key, isTrial, pl, name: isTrial ? a.trial_name : `${playerFullName(pl)}`, present: 0, apart: 0, absent: 0, reasons: {} });
      if (a.status === "present") e.present++;
      else if (a.status === "apart") e.apart++;
      else if (a.status === "absent") { e.absent++; const k = a.absence_reason || "otro"; e.reasons[k] = (e.reasons[k] || 0) + 1; }
    });
    return Object.values(map).sort((a, b) => Number(a.isTrial) - Number(b.isTrial) || (b.present + b.apart) - (a.present + a.apart));
  })();

  const toggleNote = (pid) => setNoteOpen(prev => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });

  // Una línea por jugador: nombre + tres botones. El motivo, la lesión y la nota aparecen solo cuando hacen falta.
  const renderRow = ({ pid, name, sub, tint, onRemove, player }) => {
    const att = recFor(pid);
    const injured = player && openInjury.get(player.id);
    const canInjure = player && !injured && (att.status === "apart" || (att.status === "absent" && att.absence_reason === "lesion"));
    const showNote = noteOpen.has(pid) || !!att.notes;
    return (
      <div key={pid} className="px-3 py-2 border-b border-gray-100 last:border-b-0" style={{ background: tint }}>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-[13px] leading-tight truncate" style={{ fontFamily: "var(--font-display)" }}>{pid.startsWith("prueba_") ? name : <PlayerName id={pid}>{name}</PlayerName>}</p>
            {(sub || injured) && (
              <p className="text-[10px] text-gray-400 truncate">
                {sub}{injured && <span className="text-orange-600 font-bold">{sub ? " · " : ""}🩹 Lesionado</span>}
              </p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
              <button key={k} onClick={() => setStatus(pid, k)}
                className={`h-9 min-w-[2.6rem] px-2.5 text-[11px] font-bold rounded-md border whitespace-nowrap ${att.status === k ? cfg.cls : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"}`}>
                {cfg.short}
              </button>
            ))}
          </div>
          <button onClick={() => toggleNote(pid)} title="Observaciones"
            className={`p-1.5 rounded shrink-0 ${att.notes ? "text-blue-600" : "text-gray-300 hover:text-gray-500"}`}>
            <MessageSquarePlus className="w-4 h-4" />
          </button>
          {onRemove && (
            <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-600 shrink-0" title="Quitar de la sesión"><X className="w-3.5 h-3.5" /></button>
          )}
        </div>
        {(att.status === "absent" || canInjure || showNote) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {att.status === "absent" && (
              <Select value={att.absence_reason || ""} onValueChange={v => save(pid, { absence_reason: v })}>
                <SelectTrigger className="h-8 w-32 text-[11px] border-gray-200 bg-white"><SelectValue placeholder="Motivo" /></SelectTrigger>
                <SelectContent>{ABSENCE_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {canInjure && (
              <button onClick={() => setInjuryFor(player)}
                className="h-8 px-2.5 inline-flex items-center gap-1 text-[11px] font-bold rounded-md border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100">
                <HeartPulse className="w-3.5 h-3.5" /> Registrar lesión
              </button>
            )}
            {showNote && (
              <Input
                key={`${selectedEvent?.id}-${pid}-${att.id ? "s" : "n"}`}
                defaultValue={att.notes || ""}
                onBlur={e => { if ((e.target.value || "") !== (att.notes || "")) save(pid, { notes: e.target.value }); }}
                placeholder="Observaciones…"
                className="h-8 text-[12px] border-gray-200 flex-1 min-w-[160px]"
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <TeamPageHeader title="Entrenamientos"><BulkCancelButton teamId={selectedTeamId} /></TeamPageHeader>

      {selectedEvent ? (
        /* ───────── SESIÓN ───────── */
        <div className="space-y-3">
          <button onClick={() => navigate("/MyTeam/Attendance")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium">
            <ArrowLeft className="w-4 h-4" /> Volver a entrenamientos
          </button>
          <div className="bg-white border border-gray-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-x-2 gap-y-2" style={{ borderRadius: "4px", borderLeft: `3px solid ${offSel ? "#9ca3af" : "var(--naranja)"}` }}>
            <div className="flex-1 min-w-[160px]">
              <h2 className={`font-black text-sm uppercase truncate ${offSel ? "line-through" : ""}`} style={{ fontFamily: "var(--font-display)", color: offSel ? "#6b7280" : "var(--naranja)" }}>{selectedEvent.title}</h2>
              <p className={`text-xs text-gray-400 capitalize ${offSel ? "line-through" : ""}`}>{format(new Date(selectedEvent.date), "EEEE d MMMM · HH:mm", { locale: es })}</p>
              {offSel ? (
                <p className="text-[11px] mt-0.5 font-black uppercase tracking-wide text-gray-600 inline-flex items-center gap-1"><Ban className="w-3 h-3" /> {cancelText(selectedEvent)}</p>
              ) : (
                <p className="text-[11px] mt-0.5">
                  <span className="font-bold text-green-700">{sessionCounts.present} asisten</span>
                  <span className="text-gray-300"> · </span><span className="font-bold text-blue-700">{sessionCounts.apart} a parte</span>
                  <span className="text-gray-300"> · </span><span className="font-bold text-red-600">{sessionCounts.absent} no</span>
                  {sessionCounts.pending > 0 && <><span className="text-gray-300"> · </span><span className="font-bold text-amber-600">{sessionCounts.pending} sin marcar</span></>}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!offSel && (
                <Button variant="outline" size="sm" className="text-xs h-7 border-green-200 text-green-700 hover:bg-green-50"
                  onClick={() => teamPlayers.forEach(p => { if (!recFor(p.id).status) save(p.id, { status: "present" }); })}>
                  <Check className="w-3 h-3 mr-1" /> Todos asisten
                </Button>
              )}
              {offSel ? (
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setCancelFor(selectedEvent)}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Restaurar
                </Button>
              ) : (
                <button onClick={() => setCancelFor(selectedEvent)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700" title="Marcar como cancelado (lluvia, festivo…)">
                  <Ban className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setEditingEvent(selectedEvent)} className="p-1.5 rounded hover:bg-orange-50 text-gray-400 hover:text-orange-600" title="Editar evento">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          </div>

          {offSel && (
            <div className="bg-gray-50 border border-gray-200 px-4 py-6 text-center text-sm text-gray-500" style={{ borderRadius: "4px" }}>
              Este entreno estaba previsto pero no se ha celebrado, así que no hay lista que pasar.
            </div>
          )}

          {!offSel && (<>
          <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
            {teamPlayers.map(p => renderRow({ pid: p.id, player: p, name: `${playerFullName(p)}`, sub: POSITION_LABELS[p.position] }))}
            {guests.map(p => renderRow({ pid: p.id, player: p, tint: "#eff6ff", name: `${playerFullName(p)}`,
              sub: `Convocado · ${teams.find(t => t.id === p.team_id)?.name || "Otro equipo"}`, onRemove: () => removeRecord(p.id) }))}
            {trials.map(r => renderRow({ pid: r.player_id, tint: "#fffbeb", name: r.trial_name, sub: "A prueba", onRemove: () => removeRecord(r.player_id) }))}
          </div>

          {/* Añadir a prueba / convocar de otro equipo */}
          <div className="bg-white border border-gray-200 shadow-sm p-3 space-y-3" style={{ borderRadius: "4px" }}>
            <button onClick={() => setShowGuests(s => !s)} className="text-xs font-bold text-blue-600 hover:underline">
              {showGuests ? "− Ocultar" : "+ Convocar jugador de otro equipo"}
            </button>
            {showGuests && (
              <GuestPlayerSelector
                teamId={selectedTeamId}
                selectedPlayers={guests.map(p => p.id)}
                onAdd={(player) => save(player.id, {})}
                onRemove={(pid) => removeRecord(pid)}
                type="training"
              />
            )}
            <div className="flex gap-2 items-center">
              <UserPlus className="w-4 h-4 text-amber-600 shrink-0" />
              <Input value={trialName} onChange={e => setTrialName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTrial()}
                placeholder="Jugador a prueba: escribe el nombre…" className="h-8 text-sm" />
              <Button variant="club" size="sm" className="h-8" onClick={addTrial} disabled={!trialName.trim()}>Añadir</Button>
            </div>
          </div>
          </>)}
        </div>
      ) : (
        /* ───────── LÍNEA TEMPORAL + RESUMEN ───────── */
        <>
          <WeeklyCalendar
            events={events.filter(e => e.team_id === selectedTeamId)}
            teamId={selectedTeamId}
            title="Entrenamientos de la semana"
            forceGrid
            onDayClick={(day) => setCreateEventDate(day)}
            onEventClick={(ev) => TRAINING_TYPES.includes(ev.type) ? navigate(`/MyTeam/Attendance?eventId=${ev.id}`) : setEditingEvent(ev)}
          />

          <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-baseline justify-between gap-2 flex-wrap">
              <h2 className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Resumen de asistencia</h2>
              <span className="text-xs text-gray-400">{total} {total === 1 ? "sesión realizada" : "sesiones realizadas"} por el equipo</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                    <th className="text-left px-3 py-2 font-bold">Jugador</th>
                    <th className="text-center px-2 py-2 font-bold">Año nac.</th>
                    <th className="text-left px-2 py-2 font-bold">Posición</th>
                    <th className="text-center px-2 py-2 font-bold text-green-600">Asiste</th>
                    <th className="text-center px-2 py-2 font-bold text-blue-600">A parte</th>
                    <th className="text-center px-2 py-2 font-bold text-red-600">No asiste</th>
                    <th className="text-left px-2 py-2 font-bold">Motivos</th>
                    <th className="text-center px-2 py-2 font-bold">% Asiste</th>
                    <th className="text-center px-2 py-2 font-bold">% Lesión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {summary.map(({ p, present, apart, absent, reasons }) => {
                    const pa = pct(present, total);
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-bold text-gray-900 whitespace-nowrap" style={{ fontFamily: "var(--font-display)" }}>{playerFullName(p)}</td>
                        <td className="px-2 py-2 text-center text-gray-500">{birthYearOf(p) ?? "—"}</td>
                        <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{POSITION_LABELS[p.position] || "—"}</td>
                        <td className="px-2 py-2 text-center font-black text-green-700">{present}</td>
                        <td className="px-2 py-2 text-center font-black text-blue-700">{apart}</td>
                        <td className="px-2 py-2 text-center font-black text-red-600">{absent}</td>
                        <td className="px-2 py-2 text-gray-500">
                          {Object.entries(reasons).map(([k, n]) => `${REASON_LABEL[k] || k} ${n}`).join(" · ") || "—"}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {total > 0 ? (
                            <span className={`font-bold px-2 py-0.5 rounded-sm border ${pa >= 80 ? "bg-green-50 text-green-700 border-green-200" : pa >= 60 ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-red-50 text-red-700 border-red-200"}`}>{pa}%</span>
                          ) : "—"}
                        </td>
                        <td className="px-2 py-2 text-center text-gray-500">{total > 0 ? `${pct(reasons.lesion || 0, total)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                  {summary.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-gray-400">Sin jugadores</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {external.length > 0 && (
            <div className="bg-white border border-blue-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
              <button onClick={() => setShowExternal(v => !v)} className="w-full px-4 py-3 flex items-center justify-between text-left" style={{ background: "#eff6ff" }}>
                <h2 className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)", color: "#2563eb" }}>
                  Jugadores de otros equipos y a prueba <span className="text-blue-400 font-normal">({external.length})</span>
                </h2>
                <span className="text-xs text-blue-500">{showExternal ? "Ocultar" : "Mostrar"}</span>
              </button>
              {showExternal && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                        <th className="text-left px-3 py-2 font-bold">Jugador</th>
                        <th className="text-left px-2 py-2 font-bold">Procedencia</th>
                        <th className="text-center px-2 py-2 font-bold">Año nac.</th>
                        <th className="text-center px-2 py-2 font-bold text-green-600">Asiste</th>
                        <th className="text-center px-2 py-2 font-bold text-blue-600">A parte</th>
                        <th className="text-center px-2 py-2 font-bold text-red-600">No asiste</th>
                        <th className="text-left px-2 py-2 font-bold">Motivos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {external.map(e => (
                        <tr key={e.key} style={{ background: e.isTrial ? "#fffbeb" : "#f8fbff" }}>
                          <td className="px-3 py-2 font-bold text-gray-900 whitespace-nowrap" style={{ fontFamily: "var(--font-display)" }}>{e.name}</td>
                          <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{e.isTrial ? "A prueba" : (teams.find(t => t.id === e.pl.team_id)?.name || "Otro equipo")}</td>
                          <td className="px-2 py-2 text-center text-gray-500">{e.pl ? (birthYearOf(e.pl) ?? "—") : "—"}</td>
                          <td className="px-2 py-2 text-center font-black text-green-700">{e.present}</td>
                          <td className="px-2 py-2 text-center font-black text-blue-700">{e.apart}</td>
                          <td className="px-2 py-2 text-center font-black text-red-600">{e.absent}</td>
                          <td className="px-2 py-2 text-gray-500">{Object.entries(e.reasons).map(([k, n]) => `${REASON_LABEL[k] || k} ${n}`).join(" · ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <QuickInjuryDialog
        open={!!injuryFor}
        onOpenChange={(open) => { if (!open) setInjuryFor(null); }}
        player={injuryFor}
        date={selectedEvent?.date?.split("T")[0]}
      />

      <EditEventDialog
        open={!!editingEvent}
        onOpenChange={(open) => { if (!open) setEditingEvent(null); }}
        event={editingEvent}
      />

      <CancelEventDialog
        open={!!cancelFor}
        onOpenChange={(open) => { if (!open) setCancelFor(null); }}
        event={cancelFor}
      />

      <CreateEventDialog
        open={!!createEventDate}
        onOpenChange={(open) => { if (!open) setCreateEventDate(null); }}
        date={createEventDate}
        teamId={selectedTeamId}
      />
    </div>
  );
}
