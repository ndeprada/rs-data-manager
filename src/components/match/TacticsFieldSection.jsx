import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Trash2 } from "lucide-react";

const FORMATIONS = {
  "4-4-2": { GK: 1, DEF: 4, MID: 4, ATT: 2 },
  "4-3-3": { GK: 1, DEF: 4, MID: 3, ATT: 3 },
  "3-5-2": { GK: 1, DEF: 3, MID: 5, ATT: 2 },
  "5-3-2": { GK: 1, DEF: 5, MID: 3, ATT: 2 }
};

const POSITION_LAYOUT = {
  "4-4-2": [
    { x: 50, y: 8, pos: "GK" },
    { x: 18, y: 22, pos: "DEF" },
    { x: 38, y: 22, pos: "DEF" },
    { x: 62, y: 22, pos: "DEF" },
    { x: 82, y: 22, pos: "DEF" },
    { x: 18, y: 45, pos: "MID" },
    { x: 38, y: 48, pos: "MID" },
    { x: 62, y: 48, pos: "MID" },
    { x: 82, y: 45, pos: "MID" },
    { x: 35, y: 72, pos: "ATT" },
    { x: 65, y: 72, pos: "ATT" }
  ],
  "4-3-3": [
    { x: 50, y: 8, pos: "GK" },
    { x: 18, y: 22, pos: "DEF" },
    { x: 38, y: 22, pos: "DEF" },
    { x: 62, y: 22, pos: "DEF" },
    { x: 82, y: 22, pos: "DEF" },
    { x: 30, y: 48, pos: "MID" },
    { x: 50, y: 45, pos: "MID" },
    { x: 70, y: 48, pos: "MID" },
    { x: 20, y: 72, pos: "ATT" },
    { x: 50, y: 78, pos: "ATT" },
    { x: 80, y: 72, pos: "ATT" }
  ],
  "3-5-2": [
    { x: 50, y: 8, pos: "GK" },
    { x: 30, y: 24, pos: "DEF" },
    { x: 50, y: 20, pos: "DEF" },
    { x: 70, y: 24, pos: "DEF" },
    { x: 15, y: 48, pos: "MID" },
    { x: 35, y: 45, pos: "MID" },
    { x: 50, y: 45, pos: "MID" },
    { x: 65, y: 45, pos: "MID" },
    { x: 85, y: 48, pos: "MID" },
    { x: 35, y: 72, pos: "ATT" },
    { x: 65, y: 72, pos: "ATT" }
  ],
  "5-3-2": [
    { x: 50, y: 8, pos: "GK" },
    { x: 15, y: 24, pos: "DEF" },
    { x: 35, y: 20, pos: "DEF" },
    { x: 50, y: 18, pos: "DEF" },
    { x: 65, y: 20, pos: "DEF" },
    { x: 85, y: 24, pos: "DEF" },
    { x: 30, y: 48, pos: "MID" },
    { x: 50, y: 45, pos: "MID" },
    { x: 70, y: 48, pos: "MID" },
    { x: 35, y: 72, pos: "ATT" },
    { x: 65, y: 72, pos: "ATT" }
  ]
};

export default function TacticsFieldSection({ eventId, teamId, players }) {
  const queryClient = useQueryClient();
  const [formation, setFormation] = useState("4-4-2");
  const [playerPositions, setPlayerPositions] = useState({});
  const [draggingPlayer, setDraggingPlayer] = useState(null);
  const [savingTactic, setSavingTactic] = useState(false);
  const [tacticName, setTacticName] = useState("");
  const fieldRef = useRef(null);

  const { data: tactics = [] } = useQuery({
    queryKey: ["tactics", teamId],
    queryFn: () => base44.entities.TacticsBoard.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const createTacticMutation = useMutation({
    mutationFn: (data) => base44.entities.TacticsBoard.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tactics", teamId] });
      setTacticName("");
      setSavingTactic(false);
    }
  });

  const deleteTacticMutation = useMutation({
    mutationFn: (id) => base44.entities.TacticsBoard.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tactics", teamId] });
    }
  });

  const handleSaveTactic = () => {
    if (!tacticName.trim()) {
      alert("Ingresa un nombre para la táctica");
      return;
    }
    createTacticMutation.mutate({
      team_id: teamId,
      formation: formation,
      name: tacticName,
      assignments: playerPositions
    });
  };

  const handleLoadTactic = (tactic) => {
    setFormation(tactic.formation);
    setPlayerPositions(tactic.assignments || {});
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    if (!draggingPlayer || !fieldRef.current) return;
    e.preventDefault();

    const rect = fieldRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setPlayerPositions({
      ...playerPositions,
      [draggingPlayer]: { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) }
    });
    setDraggingPlayer(null);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Controles */}
      <div className="flex gap-2 flex-wrap items-end">
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-semibold text-gray-600 block mb-1 uppercase">Formación</label>
          <Select value={formation} onValueChange={setFormation}>
            <SelectTrigger className="border-gray-300 text-sm h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(FORMATIONS).map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setPlayerPositions({})} variant="outline" size="sm" className="h-8">
          Limpiar
        </Button>
        <Button onClick={() => setSavingTactic(!savingTactic)} size="sm" className="h-8 text-white" style={{ background: "var(--granate)" }}>
          <Save className="w-3.5 h-3.5 mr-1" /> Guardar táctica
        </Button>
      </div>

      {/* Guardar táctica */}
      {savingTactic && (
        <div className="flex gap-2">
          <Input
            value={tacticName}
            onChange={(e) => setTacticName(e.target.value)}
            placeholder="Ej: Defensa 4-4-2"
            className="border-gray-300 h-8 text-sm"
          />
          <Button onClick={handleSaveTactic} size="sm" className="h-8 text-white" style={{ background: "var(--granate)" }}>
            Crear
          </Button>
          <Button onClick={() => setSavingTactic(false)} variant="outline" size="sm" className="h-8">
            Cancelar
          </Button>
        </div>
      )}

      {/* Tácticas guardadas */}
      {tactics.length > 0 && (
        <div className="bg-gray-50 rounded border border-gray-200 p-2">
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">Mis tácticas</p>
          <div className="flex gap-1 flex-wrap">
            {tactics.map(tactic => (
              <div key={tactic.id} className="flex gap-1 items-center">
                <button
                  onClick={() => handleLoadTactic(tactic)}
                  className="text-xs px-2 py-1 rounded bg-white border border-gray-300 hover:bg-gray-50 font-medium text-gray-700"
                >
                  {tactic.name} ({tactic.formation})
                </button>
                <button
                  onClick={() => deleteTacticMutation.mutate(tactic.id)}
                  className="p-0.5 text-gray-400 hover:text-red-500 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Lista jugadores */}
        <div className="w-32 bg-gray-50 rounded border border-gray-200 p-2 overflow-y-auto">
          <h4 className="text-xs font-bold text-gray-700 mb-2 uppercase">Plantilla</h4>
          <div className="space-y-1">
            {players.map(player => {
              const isAssigned = Object.keys(playerPositions).includes(player.id);
              return (
                <div
                  key={player.id}
                  draggable
                  onDragStart={() => setDraggingPlayer(player.id)}
                  onDragEnd={() => setDraggingPlayer(null)}
                  onClick={() => {
                    if (isAssigned) {
                      const { [player.id]: _, ...rest } = playerPositions;
                      setPlayerPositions(rest);
                    }
                  }}
                  className={`p-1.5 rounded text-xs font-medium cursor-move border transition-all ${
                    isAssigned
                      ? "bg-green-100 border-green-400 text-green-900"
                      : "bg-white border-gray-200 text-gray-900 hover:border-gray-400"
                  }`}
                >
                  <div className="font-bold">#{player.jersey_number || "—"}</div>
                  <div className="text-[10px] truncate">{player.first_name}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Campo de fútbol */}
        <div
          ref={fieldRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="flex-1 relative bg-gradient-to-b from-green-600 to-green-700 rounded border-4 border-white overflow-hidden cursor-move"
        >
          {/* SVG del campo */}
          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
            {/* Línea de medio campo */}
            <line x1="50%" y1="0" x2="50%" y2="100%" stroke="white" strokeWidth="1.5" />
            
            {/* Círculo central */}
            <circle cx="50%" cy="50%" r="10%" fill="none" stroke="white" strokeWidth="1.5" />
            <circle cx="50%" cy="50%" r="1%" fill="white" />

            {/* Área de portería inferior */}
            <rect x="30%" y="75%" width="40%" height="15%" fill="none" stroke="white" strokeWidth="1.5" />
            
            {/* Área chica inferior */}
            <rect x="38%" y="85%" width="24%" height="8%" fill="none" stroke="white" strokeWidth="1.5" />
            
            {/* Área de portería superior */}
            <rect x="30%" y="10%" width="40%" height="15%" fill="none" stroke="white" strokeWidth="1.5" />
            
            {/* Área chica superior */}
            <rect x="38%" y="2%" width="24%" height="8%" fill="none" stroke="white" strokeWidth="1.5" />
          </svg>

          {/* Fichas de jugadores */}
          {Object.entries(playerPositions).map(([playerId, pos]) => {
            const player = players.find(p => p.id === playerId);
            return (
              <div
                key={playerId}
                draggable
                onDragStart={() => setDraggingPlayer(playerId)}
                onDragEnd={() => setDraggingPlayer(null)}
                className="absolute w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white cursor-move select-none border border-white shadow-md hover:shadow-lg transition-shadow"
                style={{
                  background: "var(--granate)",
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%, -50%)"
                }}
                title={`${player?.first_name} ${player?.last_name}`}
              >
                {player?.jersey_number || "—"}
              </div>
            );
          })}

          {/* Posiciones sugeridas */}
          {POSITION_LAYOUT[formation].map((pos, idx) => (
            <div
              key={idx}
              className="absolute w-5 h-5 rounded-full border border-white border-dashed opacity-30"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: "translate(-50%, -50%)"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}