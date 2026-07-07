import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const POSITION_LABELS = {
  portero: "POR", lateral: "LAT", central: "CEN", libre: "LIB",
  mediocentro: "MC", interior: "INT", delantero_centro: "DC", extremo: "EXT",
};

const REASON_LABELS = {
  lesion: "Lesión",
  sancion: "Sanción",
  viaje: "Viaje",
  familiar: "Motivo familiar",
  decision_tecnica: "Decisión técnica",
  otro: "Otro",
};

const STATUS_GROUPS = [
  { key: "disponible", label: "Disponibles", color: "text-green-600", bg: "bg-green-50 border-green-200" },
  { key: "no_disponible", label: "No disponibles", color: "text-red-600", bg: "bg-red-50 border-red-200" },
];

export default function MatchAvailabilitySection({ eventId, teamId, players }) {
  const queryClient = useQueryClient();
  const [pendingReason, setPendingReason] = useState({});
  const [markingAll, setMarkingAll] = useState(false);

  const { data: availability = [] } = useQuery({
    queryKey: ["matchAvailability", eventId],
    queryFn: () => base44.entities.MatchAvailability.filter({ event_id: eventId }),
    enabled: !!eventId,
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ playerId, status, reason }) => {
      const existing = availability.find((a) => a.player_id === playerId);
      const data = { player_id: playerId, event_id: eventId, team_id: teamId, status, reason: reason || null };
      if (existing) {
        return base44.entities.MatchAvailability.update(existing.id, data);
      } else {
        return base44.entities.MatchAvailability.create(data);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["matchAvailability", eventId] }),
  });

  const getAvail = (playerId) => availability.find((a) => a.player_id === playerId);

  const handleToggle = (player) => {
    const current = getAvail(player.id);
    if (!current || current.status === "disponible") {
      upsertMutation.mutate({ playerId: player.id, status: "no_disponible", reason: pendingReason[player.id] });
    } else {
      upsertMutation.mutate({ playerId: player.id, status: "disponible", reason: null });
    }
  };

  const handleReason = (playerId, reason) => {
    upsertMutation.mutate({ playerId, status: "no_disponible", reason });
  };

  const handleMarkAllAvailable = async () => {
    setMarkingAll(true);
    await Promise.all(
      activePlayers.map((player) => {
        const existing = availability.find((a) => a.player_id === player.id);
        const data = { player_id: player.id, event_id: eventId, team_id: teamId, status: "disponible", reason: null };
        if (existing) return base44.entities.MatchAvailability.update(existing.id, data);
        return base44.entities.MatchAvailability.create(data);
      })
    );
    queryClient.invalidateQueries({ queryKey: ["matchAvailability", eventId] });
    setMarkingAll(false);
  };

  const activePlayers = players.filter((p) => p.status !== "baja").sort((a, b) =>
    `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
  );

  const disponibles = activePlayers.filter((p) => {
    const a = getAvail(p.id);
    return !a || a.status === "disponible";
  });
  const noDisponibles = activePlayers.filter((p) => getAvail(p.id)?.status === "no_disponible");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          Disponibilidad del equipo
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex gap-3 text-sm">
            <span className="text-green-600 font-medium">{disponibles.length} disponibles</span>
            <span className="text-red-500 font-medium">{noDisponibles.length} no disponibles</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkAllAvailable}
            disabled={markingAll}
            className="border-green-200 text-green-700 hover:bg-green-50 text-xs"
          >
            <Users className="w-3.5 h-3.5 mr-1" />
            {markingAll ? "Marcando…" : "Todos disponibles"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {activePlayers.map((player) => {
          const avail = getAvail(player.id);
          const isAvailable = !avail || avail.status === "disponible";
          return (
            <div
              key={player.id}
              className={`flex items-center gap-3 px-4 py-3 rounded border transition-colors ${
                isAvailable ? "bg-white border-gray-200" : "bg-red-50 border-red-200"
              }`}
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: isAvailable ? "var(--granate)" : "#9ca3af" }}
              >
                {player.first_name?.[0]}{player.last_name?.[0]}
              </div>

              {/* Name + position */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{player.first_name} {player.last_name}</p>
                <p className="text-xs text-gray-400">{POSITION_LABELS[player.position] || player.position || "—"}
                  {player.jersey_number ? ` · #${player.jersey_number}` : ""}
                  {player.status === "lesionado" ? " · ⚠️ Lesionado" : ""}
                </p>
              </div>

              {/* Reason selector (if not available) */}
              {!isAvailable && (
                <Select
                  value={avail?.reason || ""}
                  onValueChange={(v) => handleReason(player.id, v)}
                >
                  <SelectTrigger className="h-8 w-44 text-xs border-red-200 bg-white">
                    <SelectValue placeholder="Motivo…" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REASON_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Toggle button */}
              <button
                onClick={() => handleToggle(player)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  isAvailable
                    ? "bg-green-50 border-green-200 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                    : "bg-red-50 border-red-200 text-red-600 hover:bg-green-50 hover:border-green-200 hover:text-green-700"
                }`}
              >
                {isAvailable ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Disponible</>
                ) : (
                  <><XCircle className="w-3.5 h-3.5" /> No disponible</>
                )}
              </button>
            </div>
          );
        })}
        {activePlayers.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No hay jugadores en este equipo</p>
        )}
      </div>
    </div>
  );
}