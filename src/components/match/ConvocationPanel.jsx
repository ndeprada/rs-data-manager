import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { X, Save, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConvocationPanel({ eventId, teamId, onClose }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(new Map());
  const [starters, setStarters] = useState(new Set());

  const { data: players = [] } = useQuery({
    queryKey: ["teamPlayers", teamId],
    queryFn: () => base44.entities.Player.filter({ team_id: teamId }),
    enabled: !!teamId,
  });

  const { data: convocatoria } = useQuery({
    queryKey: ["convocatoria", eventId],
    queryFn: async () => {
      const convs = await base44.entities.Convocatoria.filter({ event_id: eventId });
      return convs[0] || null;
    },
    enabled: !!eventId,
  });

  useEffect(() => {
    if (convocatoria) {
      const sel = new Map(convocatoria.player_ids?.map(id => [id, true]) || []);
      setSelected(sel);
      setStarters(new Set(convocatoria.starters || []));
    }
  }, [convocatoria]);

  const togglePlayer = (playerId) => {
    const newSelected = new Map(selected);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
      const newStarters = new Set(starters);
      newStarters.delete(playerId);
      setStarters(newStarters);
    } else {
      newSelected.set(playerId, true);
    }
    setSelected(newSelected);
  };

  const toggleStarter = (playerId) => {
    const newStarters = new Set(starters);
    if (newStarters.has(playerId)) {
      newStarters.delete(playerId);
    } else {
      newStarters.add(playerId);
    }
    setStarters(newStarters);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const playerIds = Array.from(selected.keys());
      if (convocatoria) {
        return base44.entities.Convocatoria.update(convocatoria.id, {
          player_ids: playerIds,
          starters: Array.from(starters),
        });
      } else {
        return base44.entities.Convocatoria.create({
          event_id: eventId,
          team_id: teamId,
          player_ids: playerIds,
          starters: Array.from(starters),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convocatoria", eventId] });
      queryClient.invalidateQueries({ queryKey: ["convocatorias"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-end">
      <div className="w-full sm:w-96 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-screen sm:max-h-96">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4" /> Convocatoria
            </h2>
            <p className="text-xs text-gray-400">{selected.size} convocados</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(player.id)}
                  onChange={() => togglePlayer(player.id)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {player.first_name} {player.last_name}
                  </p>
                </div>
                {selected.has(player.id) && (
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={starters.has(player.id)}
                      onChange={() => toggleStarter(player.id)}
                      className="w-3 h-3 rounded"
                    />
                    <span className="text-gray-600">Titular</span>
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex gap-2 shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex-1 text-white"
            style={{ background: "var(--granate)" }}
          >
            <Save className="w-4 h-4 mr-2" /> Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}