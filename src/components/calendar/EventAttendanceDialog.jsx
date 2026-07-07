import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Activity } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import GuestPlayerSelector from "@/components/common/GuestPlayerSelector";

const STATUS_CONFIG = {
  present: { label: "Presente",  icon: CheckCircle, iconClass: "text-green-500",  activeBorder: "border-green-400 bg-green-50" },
  apart:   { label: "A parte",   icon: Activity,    iconClass: "text-blue-500",   activeBorder: "border-blue-400 bg-blue-50" },
  absent:  { label: "Ausente",   icon: XCircle,     iconClass: "text-red-400",    activeBorder: "border-red-400 bg-red-50" },
};

const ABSENCE_REASONS = [
  { value: "lesion",   label: "Lesión" },
  { value: "enfermo",  label: "Enfermo/a" },
  { value: "clase",    label: "Clase" },
  { value: "examen",   label: "Examen" },
  { value: "viaje",    label: "Viaje" },
  { value: "familiar", label: "Motivo familiar" },
  { value: "permiso",  label: "Permiso" },
  { value: "otro",     label: "Otro" },
];

const POSITION_LABELS = {
  portero: "POR", lateral: "LAT", central: "CEN", libre: "LIB",
  mediocentro: "MED", interior: "INT", delantero_centro: "DEL", extremo: "EXT",
};

export default function EventAttendanceDialog({ event, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [pendingReason, setPendingReason] = useState({}); // playerId -> reason
  const [guestPlayers, setGuestPlayers] = useState([]); // Jugadores de otros equipos añadidos

  const eventDate = event ? format(new Date(event.date), "yyyy-MM-dd") : null;

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
    enabled: !!event,
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["attendance-event", event?.id],
    queryFn: () => base44.entities.TrainingAttendance.filter({ event_id: event.id }),
    enabled: !!event && open,
  });

  // Reconstruir jugadores invitados a partir de los registros de asistencia guardados
  useEffect(() => {
    if (!open || players.length === 0 || attendanceRecords.length === 0) return;
    const teamPlayers = players.filter(p => p.team_id === event?.team_id);
    const teamPlayerIds = new Set(teamPlayers.map(p => p.id));
    const guestIds = attendanceRecords
      .map(r => r.player_id)
      .filter(id => !teamPlayerIds.has(id));
    const guestObjects = guestIds
      .map(id => players.find(p => p.id === id))
      .filter(Boolean);
    setGuestPlayers(guestObjects);
  }, [open, attendanceRecords, players, event?.team_id]);

  const upsertMutation = useMutation({
    mutationFn: async ({ playerId, status, absence_reason }) => {
      const existing = attendanceRecords.find((r) => r.player_id === playerId);
      const data = {
        player_id: playerId,
        event_id: event.id,
        date: eventDate,
        status,
        attended: status !== "absent",
        ...(absence_reason ? { absence_reason } : {}),
      };
      if (existing) {
        return base44.entities.TrainingAttendance.update(existing.id, data);
      } else {
        return base44.entities.TrainingAttendance.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-event", event.id] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
    enabled: !!event,
  });

  const teamPlayers = players
    .filter((p) => p.team_id === event?.team_id && p.status !== "baja")
    .sort((a, b) => (a.position || "").localeCompare(b.position || ""));

  // Jugadores de otros equipos más los del equipo actual
  const allDisplayPlayers = [...teamPlayers, ...guestPlayers.filter(p => p.team_id !== event?.team_id)];

  const getRecord = (playerId) => attendanceRecords.find((r) => r.player_id === playerId);
  const getStatus = (playerId) => {
    const r = getRecord(playerId);
    if (!r) return null;
    return r.status || (r.attended === false ? "absent" : "present");
  };

  const handleStatusClick = (playerId, st) => {
    if (st === "absent") {
      upsertMutation.mutate({ playerId, status: "absent", absence_reason: pendingReason[playerId] || null });
    } else {
      setPendingReason((prev) => { const n = { ...prev }; delete n[playerId]; return n; });
      upsertMutation.mutate({ playerId, status: st });
    }
  };

  const handleReasonChange = (playerId, reason) => {
    setPendingReason((prev) => ({ ...prev, [playerId]: reason }));
    upsertMutation.mutate({ playerId, status: "absent", absence_reason: reason });
  };

  const counts = {
    present: allDisplayPlayers.filter((p) => getStatus(p.id) === "present").length,
    apart:   allDisplayPlayers.filter((p) => getStatus(p.id) === "apart").length,
    absent:  allDisplayPlayers.filter((p) => getStatus(p.id) === "absent").length,
    pending: allDisplayPlayers.filter((p) => !getStatus(p.id)).length,
  };

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-5 border-b border-gray-100 bg-gray-50 shrink-0">
          <DialogTitle className="text-gray-900">{event.title}</DialogTitle>
          <div className="flex flex-wrap gap-3 mt-1 text-xs">
            <span className="text-green-600 font-medium">{counts.present} presentes</span>
            <span className="text-blue-600 font-medium">{counts.apart} a parte</span>
            <span className="text-red-500 font-medium">{counts.absent} ausentes</span>
            {counts.pending > 0 && <span className="text-gray-400">{counts.pending} sin registrar</span>}
          </div>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          {teamPlayers.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No hay jugadores en este equipo</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Jugadores del equipo */}
              {teamPlayers.map((player) => {
                const currentStatus = getStatus(player.id);
                const record = getRecord(player.id);
                const isAbsent = currentStatus === "absent";

                return (
                  <div key={player.id} className={`px-4 py-3 ${!currentStatus ? "bg-amber-50/40" : ""}`}>
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: "var(--granate)" }}>
                        {player.first_name?.[0]}{player.last_name?.[0]}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {player.first_name} {player.last_name}
                          {player.status === "lesionado" && <span className="ml-2 text-xs text-orange-500">⚠ Lesionado</span>}
                        </p>
                        <p className="text-xs text-gray-400">
                          {POSITION_LABELS[player.position] || player.position || "—"}
                          {player.jersey_number ? ` · #${player.jersey_number}` : ""}
                        </p>
                      </div>

                      {/* Status buttons */}
                      <div className="flex gap-1 shrink-0">
                        {["present", "apart", "absent"].map((st) => {
                          const cfg = STATUS_CONFIG[st];
                          const Icon = cfg.icon;
                          const isActive = currentStatus === st;
                          return (
                            <button
                              key={st}
                              onClick={() => handleStatusClick(player.id, st)}
                              title={cfg.label}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isActive ? cfg.activeBorder : "border-gray-200 bg-white hover:bg-gray-50"
                              }`}
                            >
                              <Icon className={`w-4 h-4 ${isActive ? cfg.iconClass : "text-gray-300"}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Absence reason */}
                    {isAbsent && (
                      <div className="mt-2 ml-11">
                        <Select
                          value={record?.absence_reason || pendingReason[player.id] || ""}
                          onValueChange={(v) => handleReasonChange(player.id, v)}
                        >
                          <SelectTrigger className="h-7 text-xs border-red-200 bg-red-50 text-red-700 w-48">
                            <SelectValue placeholder="Motivo de ausencia..." />
                          </SelectTrigger>
                          <SelectContent>
                            {ABSENCE_REASONS.map((r) => (
                              <SelectItem key={r.value} value={r.value} className="text-sm">{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Separador para jugadores de otros equipos */}
              {guestPlayers.length > 0 && (
                <>
                  <div className="sticky px-4 py-2 bg-blue-50 border-t-2 border-blue-200">
                    <p className="text-xs font-semibold text-blue-700 uppercase">Jugadores de otros equipos</p>
                  </div>
                  {guestPlayers.filter(p => p.team_id !== event?.team_id).map((player) => {
                    const currentStatus = getStatus(player.id);
                    const record = getRecord(player.id);
                    const isAbsent = currentStatus === "absent";

                    return (
                      <div key={player.id} className={`px-4 py-3 bg-blue-50/30 ${!currentStatus ? "bg-blue-100/40" : ""}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#3b82f6" }}>
                            {player.first_name?.[0]}{player.last_name?.[0]}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {player.first_name} {player.last_name}
                            </p>
                            <p className="text-xs text-blue-500">
                              {teams.find(t => t.id === player.team_id)?.name || "Otro equipo"} · {POSITION_LABELS[player.position] || player.position || "—"}
                            </p>
                          </div>

                          <div className="flex gap-1 shrink-0">
                            {["present", "apart", "absent"].map((st) => {
                              const cfg = STATUS_CONFIG[st];
                              const Icon = cfg.icon;
                              const isActive = currentStatus === st;
                              return (
                                <button
                                  key={st}
                                  onClick={() => handleStatusClick(player.id, st)}
                                  title={cfg.label}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    isActive ? cfg.activeBorder : "border-gray-200 bg-white hover:bg-gray-50"
                                  }`}
                                >
                                  <Icon className={`w-4 h-4 ${isActive ? cfg.iconClass : "text-gray-300"}`} />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {isAbsent && (
                          <div className="mt-2 ml-11">
                            <Select
                              value={record?.absence_reason || pendingReason[player.id] || ""}
                              onValueChange={(v) => handleReasonChange(player.id, v)}
                            >
                              <SelectTrigger className="h-7 text-xs border-red-200 bg-red-50 text-red-700 w-48">
                                <SelectValue placeholder="Motivo de ausencia..." />
                              </SelectTrigger>
                              <SelectContent>
                                {ABSENCE_REASONS.map((r) => (
                                  <SelectItem key={r.value} value={r.value} className="text-sm">{r.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="mt-2">
                          <button
                            onClick={() => setGuestPlayers(prev => prev.filter(p => p.id !== player.id))}
                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Selector de jugadores de otros equipos */}
              <div className="p-3">
                <GuestPlayerSelector
                  teamId={event?.team_id}
                  selectedPlayers={guestPlayers.map(p => p.id)}
                  onAdd={(player) => {
                    if (!guestPlayers.find(p => p.id === player.id)) {
                      setGuestPlayers(prev => [...prev, player]);
                    }
                  }}
                  onRemove={(playerId) => {
                    setGuestPlayers(prev => prev.filter(p => p.id !== playerId));
                  }}
                  type="training"
                />
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        {teamPlayers.length > 0 && (
          <div className="p-3 border-t border-gray-100 bg-gray-50 flex gap-2 shrink-0">
            <button
              onClick={() => teamPlayers.forEach((p) => upsertMutation.mutate({ playerId: p.id, status: "present" }))}
              className="text-xs px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-medium"
            >
              ✓ Marcar todos presentes
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}