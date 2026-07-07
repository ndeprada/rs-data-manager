import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Users, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_CONFIG = {
  present: { label: "Asistió", color: "green", icon: CheckCircle2 },
  apart: { label: "Trabajo aparté", color: "blue", icon: AlertCircle },
  absent: { label: "Ausente", color: "red", icon: XCircle },
};

const ABSENCE_REASONS = [
  { value: "lesion", label: "Lesión" },
  { value: "enfermo", label: "Enfermo" },
  { value: "clase", label: "Clase" },
  { value: "examen", label: "Examen" },
  { value: "viaje", label: "Viaje" },
  { value: "familiar", label: "Asunto familiar" },
  { value: "permiso", label: "Permiso" },
  { value: "otro", label: "Otro" },
];

export default function Attendance() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTeamId, setSelectedTeamId] = useState("all");
  const [attendanceData, setAttendanceData] = useState({});
  const [absenceReasons, setAbsenceReasons] = useState({});

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance"],
    queryFn: () => base44.entities.TrainingAttendance.list(),
  });

  const createAttendanceMutation = useMutation({
    mutationFn: (data) => base44.entities.TrainingAttendance.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  const updateAttendanceMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TrainingAttendance.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  // Get players for selected team
  const teamPlayers = selectedTeamId === "all"
    ? players
    : players.filter((p) => p.team_id === selectedTeamId);

  // Get event for selected date
  const eventForDate = events.find((e) => e.date.split("T")[0] === selectedDate);

  // Get attendance records for this date
  const attendanceForDate = attendance.filter((a) => a.date === selectedDate);

  const handleStatusChange = (playerId, newStatus) => {
    setAttendanceData({
      ...attendanceData,
      [playerId]: newStatus,
    });
  };

  const handleReasonChange = (playerId, reason) => {
    setAbsenceReasons({
      ...absenceReasons,
      [playerId]: reason,
    });
  };

  const handleSaveAttendance = async () => {
    for (const [playerId, status] of Object.entries(attendanceData)) {
      const existingRecord = attendanceForDate.find((a) => a.player_id === playerId);
      const recordData = {
        player_id: playerId,
        date: selectedDate,
        status,
        ...(status === "absent" && absenceReasons[playerId] && {
          absence_reason: absenceReasons[playerId],
        }),
      };

      if (existingRecord) {
        updateAttendanceMutation.mutate({ id: existingRecord.id, data: recordData });
      } else {
        createAttendanceMutation.mutate(recordData);
      }
    }
    setAttendanceData({});
    setAbsenceReasons({});
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Gestión</p>
        <h1>Asistencia</h1>
        <p className="text-gray-400 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>Registra la asistencia a entrenamientos y partidos</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-gray-700">Fecha</Label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">Equipo</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="border-gray-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los equipos</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {eventForDate && (
          <div
            className="p-3 rounded-lg flex items-center gap-3"
            style={{ background: "var(--granate-pale)", color: "var(--granate)" }}
          >
            <Calendar className="w-5 h-5 shrink-0" />
            <div className="text-sm font-medium">{eventForDate.title}</div>
          </div>
        )}
      </div>

      {/* Attendance Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-gray-500">
                <th className="text-left font-medium px-5 py-3">Jugador</th>
                <th className="text-left font-medium px-5 py-3">Estado</th>
                <th className="text-left font-medium px-5 py-3">Motivo (si aplica)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teamPlayers.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-5 py-8 text-center text-gray-400">
                    Selecciona un equipo
                  </td>
                </tr>
              ) : (
                teamPlayers.map((player) => {
                  const existingRecord = attendanceForDate.find((a) => a.player_id === player.id);
                  const currentStatus = attendanceData[player.id] || existingRecord?.status || "";
                  const currentReason = absenceReasons[player.id] || existingRecord?.absence_reason || "";

                  return (
                    <tr key={player.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{ background: "var(--granate)" }}
                          >
                            {player.first_name?.[0]}{player.last_name?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {player.first_name} {player.last_name}
                            </p>
                            <p className="text-xs text-gray-400">{player.jersey_number ? `#${player.jersey_number}` : "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Select value={currentStatus} onValueChange={(v) => handleStatusChange(player.id, v)}>
                          <SelectTrigger className="w-40 border-gray-200">
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                              <SelectItem key={key} value={key}>
                                {config.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-5 py-4">
                        {currentStatus === "absent" ? (
                          <Select value={currentReason} onValueChange={(v) => handleReasonChange(player.id, v)}>
                            <SelectTrigger className="w-40 border-gray-200">
                              <SelectValue placeholder="Motivo" />
                            </SelectTrigger>
                            <SelectContent>
                              {ABSENCE_REASONS.map((reason) => (
                                <SelectItem key={reason.value} value={reason.value}>
                                  {reason.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {teamPlayers.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setAttendanceData({}); setAbsenceReasons({}); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveAttendance}
              disabled={Object.keys(attendanceData).length === 0}
              className="text-white"
              style={{ background: "var(--granate)" }}
            >
              {createAttendanceMutation.isPending || updateAttendanceMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar asistencia"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}