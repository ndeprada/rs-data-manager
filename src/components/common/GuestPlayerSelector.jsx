import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const POSITION_LABELS = {
  portero: "Portero",
  lateral: "Lateral",
  central: "Central",
  libre: "Libre",
  mediocentro: "Mediocentro",
  interior: "Interior",
  delantero_centro: "Del. Centro",
  extremo: "Extremo",
};

export default function GuestPlayerSelector({ teamId, selectedPlayers, onAdd, onRemove, type = "training" }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  // Otros equipos (excluyendo el actual)
  const otherTeams = teams.filter((t) => t.id !== teamId);

  // Jugadores de otros equipos
  const otherTeamsPlayers = allPlayers.filter((p) => {
    if (p.team_id === teamId) return false; // Excluir jugadores del equipo actual
    if (p.status === "baja") return false; // Excluir bajas
    if (selectedTeamId && p.team_id !== selectedTeamId) return false; // Filtrar por equipo si está seleccionado
    if (selectedPlayers.includes(p.id)) return false; // Excluir ya seleccionados
    if (searchTerm && !`${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Añadir jugadores de otros equipos</h4>
        <div className="space-y-2">
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger className="h-8 text-sm border-gray-200">
              <SelectValue placeholder="Filtrar por equipo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Todos los equipos</SelectItem>
              {otherTeams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Buscar jugador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-sm border-gray-200"
          />
        </div>
      </div>

      {otherTeamsPlayers.length > 0 ? (
        <div className="max-h-48 overflow-y-auto space-y-1">
          {otherTeamsPlayers.map((player) => (
            <button
              key={player.id}
              onClick={() => onAdd(player)}
              className="w-full flex items-center justify-between p-2 rounded text-left hover:bg-white transition-colors border border-transparent hover:border-blue-200"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {player.first_name} {player.last_name}
                </p>
                <p className="text-[10px] text-gray-500">
                  {POSITION_LABELS[player.position] || player.position || "—"} · {teams.find((t) => t.id === player.team_id)?.name}
                </p>
              </div>
              <Plus className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 text-center py-2">No hay jugadores disponibles</p>
      )}

      {/* Lista de jugadores añadidos de otros equipos */}
      {selectedPlayers.length > 0 && (
        <div className="pt-2 border-t border-blue-200 space-y-1">
          <p className="text-xs font-semibold text-gray-700">Jugadores añadidos:</p>
          <div className="space-y-1">
            {selectedPlayers.map((playerId) => {
              const player = allPlayers.find((p) => p.id === playerId);
              if (!player || player.team_id === teamId) return null; // Solo mostrar los de otros equipos
              return (
                <div
                  key={playerId}
                  className="flex items-center justify-between p-2 bg-white rounded border border-blue-200"
                >
                  <div className="text-xs">
                    <p className="font-medium text-gray-900">
                      {player.first_name} {player.last_name}
                    </p>
                    <p className="text-gray-500">{teams.find((t) => t.id === player.team_id)?.name}</p>
                  </div>
                  <button
                    onClick={() => onRemove(playerId)}
                    className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}