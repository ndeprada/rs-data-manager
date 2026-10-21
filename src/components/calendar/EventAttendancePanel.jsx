import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Activity, X } from "lucide-react";
import { format } from "date-fns";
import { playerFullName } from "@/lib/playerName";
import { useT, msg } from "@/i18n";

const STATUS_CONFIG = {
  present: { label: msg("Presente"),        icon: CheckCircle, iconClass: "text-green-500",  badge: "bg-green-100 text-green-700 border-green-200", activeBorder: "border-green-400 bg-green-50" },
  apart:   { label: msg("A parte"),         icon: Activity,    iconClass: "text-blue-500",   badge: "bg-blue-100 text-blue-700 border-blue-200",   activeBorder: "border-blue-400 bg-blue-50" },
  absent:  { label: msg("Ausente"),         icon: XCircle,     iconClass: "text-red-400",    badge: "bg-red-100 text-red-600 border-red-200",     activeBorder: "border-red-400 bg-red-50" },
};

const POSITION_LABELS = {
  portero: msg("POR"), lateral: msg("LAT"), central: msg("CEN"), libre: msg("LIB"),
  mediocentro: msg("MED"), interior: msg("INT"), mediapunta: msg("MP"), delantero_centro: msg("DEL"), extremo: msg("EXT"),
};

export default function EventAttendancePanel({ event, onClose }) {
  const t = useT();
  const queryClient = useQueryClient();

  const eventDate = format(new Date(event.date), "yyyy-MM-dd");

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["attendance-event", event.id],
    queryFn: () => base44.entities.TrainingAttendance.filter({ event_id: event.id }),
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ playerId, status }) => {
      const existing = attendanceRecords.find((r) => r.player_id === playerId);
      const data = {
        player_id: playerId,
        event_id: event.id,
        date: eventDate,
        status,
        attended: status !== "absent",
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

  const teamPlayers = players
    .filter((p) => p.team_id === event.team_id && p.status !== "baja")
    .sort((a, b) => (a.position || "").localeCompare(b.position || ""));

  const getRecord = (playerId) => attendanceRecords.find((r) => r.player_id === playerId);
  const getStatus = (playerId) => {
    const r = getRecord(playerId);
    if (!r) return null;
    if (r.status) return r.status;
    return r.attended === false ? "absent" : "present";
  };

  const counts = {
    present: teamPlayers.filter((p) => getStatus(p.id) === "present").length,
    apart:   teamPlayers.filter((p) => getStatus(p.id) === "apart").length,
    absent:  teamPlayers.filter((p) => getStatus(p.id) === "absent").length,
    pending: teamPlayers.filter((p) => !getStatus(p.id)).length,
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div>
          <p className="font-semibold text-gray-900">{t("Asistencia — {title}", { title: event.title })}</p>
          <div className="flex gap-3 mt-1 text-xs text-gray-500">
            <span className="text-green-600 font-medium">{t("{present} presentes", { present: counts.present })}</span>
            <span className="text-blue-600 font-medium">{t("{apart} a parte", { apart: counts.apart })}</span>
            <span className="text-red-500 font-medium">{t("{absent} ausentes", { absent: counts.absent })}</span>
            {counts.pending > 0 && <span className="text-gray-400">{t("{pending} sin registrar", { pending: counts.pending })}</span>}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {teamPlayers.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">{t("No hay jugadores en este equipo")}</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {teamPlayers.map((player) => {
            const currentStatus = getStatus(player.id);
            const isPending = !currentStatus;
            return (
              <div key={player.id} className={`px-4 py-3 flex items-center gap-3 ${isPending ? "bg-amber-50/30" : ""}`}>
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: "var(--granate)" }}>
                  {player.first_name?.[0]}{player.last_name?.[0]}
                </div>

                {/* Name + position */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {playerFullName(player)}
                    {player.status === "lesionado" && (
                      <span className="ml-2 text-xs text-orange-500">{t("⚠ Lesionado")}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {t(POSITION_LABELS[player.position] || player.position || "—")}
                    {player.jersey_number ? ` · #${player.jersey_number}` : ""}
                  </p>
                </div>

                {/* Status buttons */}
                <div className="flex gap-1 shrink-0">
                  {(["present", "apart", "absent"]).map((st) => {
                    const cfg = STATUS_CONFIG[st];
                    const Icon = cfg.icon;
                    const isActive = currentStatus === st;
                    return (
                      <button
                        key={st}
                        onClick={() => upsertMutation.mutate({ playerId: player.id, status: st })}
                        title={t(cfg.label)}
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
            );
          })}
        </div>
      )}

      {/* Quick actions */}
      {teamPlayers.length > 0 && (
        <div className="p-3 border-t border-gray-100 bg-gray-50 flex gap-2 flex-wrap">
          <button
            onClick={() => teamPlayers.forEach((p) => upsertMutation.mutate({ playerId: p.id, status: "present" }))}
            className="text-xs px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-medium"
          >
            {t("✓ Marcar todos presentes")}
          </button>
        </div>
      )}
    </div>
  );
}