import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

const ABSENCE_REASONS = {
  lesion: "Lesión",
  suspension: "Sanción",
  personal: "Razón personal",
  otros: "Otros"
};

export default function PlayerManagementSection({ eventId, teamId, players }) {
  const queryClient = useQueryClient();
  const [playerStats, setPlayerStats] = useState({});

  const { data: matchStats = [] } = useQuery({
    queryKey: ["matchStats", eventId],
    queryFn: () => base44.entities.MatchStats.filter({ event_id: eventId })
  });

  const createStatsMutation = useMutation({
    mutationFn: (data) => base44.entities.MatchStats.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matchStats", eventId] });
    }
  });

  const updateStatsMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MatchStats.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matchStats", eventId] });
    }
  });

  const deleteStatsMutation = useMutation({
    mutationFn: (id) => base44.entities.MatchStats.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matchStats", eventId] });
    }
  });

  const handlePlayerChange = (playerId, field, value) => {
    const existing = matchStats.find(s => s.player_id === playerId);
    const data = {
      player_id: playerId,
      event_id: eventId,
      date: new Date().toISOString().split('T')[0],
      ...existing,
      [field]: value
    };

    if (existing) {
      updateStatsMutation.mutate({ id: existing.id, data });
    } else {
      createStatsMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-4 max-h-[75vh] overflow-y-auto">
      {players.map((player) => {
        const stats = matchStats.find(s => s.player_id === player.id);
        const participated = !!stats;

        return (
          <div key={player.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              {/* Jugador */}
              <div>
                <p className="font-semibold text-gray-900">{player.first_name} {player.last_name}</p>
                <p className="text-sm text-gray-500">Dorsal {player.jersey_number || "—"}</p>
              </div>

              {/* Participación */}
              <div>
                <Label className="text-xs text-gray-600 font-medium mb-1 block">¿Jugó?</Label>
                <Select
                  value={participated ? "yes" : "no"}
                  onValueChange={(v) => {
                    if (v === "yes" && !stats) {
                      handlePlayerChange(player.id, "starter", true);
                    } else if (v === "no" && stats) {
                      deleteStatsMutation.mutate(stats.id);
                    }
                  }}
                >
                  <SelectTrigger className="border-gray-300 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Sí</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Si no jugó, motivo */}
              {!participated && (
                <div>
                  <Label className="text-xs text-gray-600 font-medium mb-1 block">Motivo</Label>
                  <Select defaultValue="">
                    <SelectTrigger className="border-gray-300 text-sm">
                      <SelectValue placeholder="Motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ABSENCE_REASONS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Si jugó, mostrar controles */}
              {participated && stats && (
                <>
                  <div>
                    <Label className="text-xs text-gray-600 font-medium mb-1 block">Minutos</Label>
                    <Input
                      type="number"
                      min="0"
                      max="120"
                      value={stats.minutes_played || 0}
                      onChange={(e) => handlePlayerChange(player.id, "minutes_played", parseInt(e.target.value) || 0)}
                      className="border-gray-300 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 font-medium mb-1 block">Goles</Label>
                    <Input
                      type="number"
                      min="0"
                      value={stats.goals || 0}
                      onChange={(e) => handlePlayerChange(player.id, "goals", parseInt(e.target.value) || 0)}
                      className="border-gray-300 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 font-medium mb-1 block">Asistencias</Label>
                    <Input
                      type="number"
                      min="0"
                      value={stats.assists || 0}
                      onChange={(e) => handlePlayerChange(player.id, "assists", parseInt(e.target.value) || 0)}
                      className="border-gray-300 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 font-medium mb-1 block">Tarjetas</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={stats.yellow_cards || 0}
                        onChange={(e) => handlePlayerChange(player.id, "yellow_cards", parseInt(e.target.value) || 0)}
                        className="border-gray-300 text-sm"
                        placeholder="Amarillas"
                        title="Amarillas"
                      />
                      <Input
                        type="number"
                        min="0"
                        value={stats.red_cards || 0}
                        onChange={(e) => handlePlayerChange(player.id, "red_cards", parseInt(e.target.value) || 0)}
                        className="border-gray-300 text-sm"
                        placeholder="Rojas"
                        title="Rojas"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 font-medium mb-1 block">Valoración</Label>
                    <Select value={stats.rating ? stats.rating.toString() : ""} onValueChange={(v) => handlePlayerChange(player.id, "rating", parseFloat(v))}>
                      <SelectTrigger className="border-gray-300 text-sm">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteStatsMutation.mutate(stats.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}