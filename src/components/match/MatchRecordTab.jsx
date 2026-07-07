import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CARD_COLORS = {
  yellow: "bg-yellow-100 border-yellow-300",
  red: "bg-red-100 border-red-300",
};

export default function MatchRecordTab({ eventId, teamId, event, players, onScoreUpdate }) {
  const queryClient = useQueryClient();
  const [score, setScore] = useState({ home: event?.score_home ?? "", away: event?.score_away ?? "" });
  const [goals, setGoals] = useState([]);
  const [yellows, setYellows] = useState([]);
  const [reds, setReds] = useState([]);

  const { data: matchStats = [] } = useQuery({
    queryKey: ["matchstats", eventId],
    queryFn: () => base44.entities.MatchStats.filter({ event_id: eventId }),
    enabled: !!eventId,
  });

  const saveScoreMutation = useMutation({
    mutationFn: (data) => base44.entities.Event.update(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      onScoreUpdate?.();
    },
  });

  const saveMatchStatsMutation = useMutation({
    mutationFn: async () => {
      const existingPlayerIds = new Set(matchStats.map(ms => ms.player_id));
      const newGoals = goals.filter(g => g.player_id && g.minute !== "");
      const newCards = [...yellows, ...reds].filter(c => c.player_id && c.minute !== "");

      for (const goal of newGoals) {
        if (!existingPlayerIds.has(goal.player_id)) {
          await base44.entities.MatchStats.create({
            player_id: goal.player_id,
            event_id: eventId,
            date: new Date(event.date).toISOString().split("T")[0],
            opponent: event.opponent || "",
            goals: 1,
          });
        } else {
          const existing = matchStats.find(ms => ms.player_id === goal.player_id);
          if (existing) {
            await base44.entities.MatchStats.update(existing.id, {
              goals: (existing.goals || 0) + 1,
            });
          }
        }
      }

      for (const card of newCards) {
        const existing = matchStats.find(ms => ms.player_id === card.player_id);
        if (card.type === "yellow") {
          if (existing) {
            await base44.entities.MatchStats.update(existing.id, {
              yellow_cards: (existing.yellow_cards || 0) + 1,
            });
          } else {
            await base44.entities.MatchStats.create({
              player_id: card.player_id,
              event_id: eventId,
              date: new Date(event.date).toISOString().split("T")[0],
              opponent: event.opponent || "",
              yellow_cards: 1,
            });
          }
        } else if (card.type === "red") {
          if (existing) {
            await base44.entities.MatchStats.update(existing.id, {
              red_cards: (existing.red_cards || 0) + 1,
            });
          } else {
            await base44.entities.MatchStats.create({
              player_id: card.player_id,
              event_id: eventId,
              date: new Date(event.date).toISOString().split("T")[0],
              opponent: event.opponent || "",
              red_cards: 1,
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matchstats", eventId] });
      setGoals([]);
      setYellows([]);
      setReds([]);
    },
  });

  const hasScore = score.home !== "" && score.away !== "";

  return (
    <div className="space-y-6">
      {/* Score section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="font-bold text-gray-900">Marcador Final</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-2">Local (nosotros)</label>
            <Input
              type="number"
              min="0"
              value={score.home}
              onChange={(e) => setScore({ ...score, home: e.target.value ? parseInt(e.target.value) : "" })}
              className="border-gray-200"
            />
          </div>
          <div className="text-2xl font-black text-gray-400">–</div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-2">Visitante</label>
            <Input
              type="number"
              min="0"
              value={score.away}
              onChange={(e) => setScore({ ...score, away: e.target.value ? parseInt(e.target.value) : "" })}
              className="border-gray-200"
            />
          </div>
          <Button
            onClick={() => saveScoreMutation.mutate({ score_home: score.home, score_away: score.away })}
            disabled={!hasScore || saveScoreMutation.isPending}
            className="text-white"
            style={{ background: "var(--granate)" }}
          >
            <Save className="w-4 h-4 mr-1" /> Guardar
          </Button>
        </div>
      </div>

      {!hasScore ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-sm text-blue-700">Introduce el marcador para registrar goles y tarjetas.</p>
        </div>
      ) : (
        <>
          {/* Goals section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">🎯 Goles</h3>
              <Button
                onClick={() => setGoals([...goals, { player_id: "", minute: "" }])}
                size="sm"
                variant="outline"
              >
                <Plus className="w-3 h-3 mr-1" /> Registrar gol
              </Button>
            </div>
            <div className="space-y-3">
              {goals.map((goal, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <Select value={goal.player_id} onValueChange={(val) => {
                    const newGoals = [...goals];
                    newGoals[idx].player_id = val;
                    setGoals(newGoals);
                  }}>
                    <SelectTrigger className="border-gray-200 flex-1"><SelectValue placeholder="Jugador" /></SelectTrigger>
                    <SelectContent>
                      {players.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    max="90"
                    placeholder="Min."
                    value={goal.minute}
                    onChange={(e) => {
                      const newGoals = [...goals];
                      newGoals[idx].minute = e.target.value;
                      setGoals(newGoals);
                    }}
                    className="border-gray-200 w-16"
                  />
                  <Button onClick={() => setGoals(goals.filter((_, i) => i !== idx))} variant="ghost" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Cards section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Yellow cards */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center gap-2"><span className={`w-4 h-4 ${CARD_COLORS.yellow} rounded border`} /> Amarillas</h3>
                <Button
                  onClick={() => setYellows([...yellows, { type: "yellow", player_id: "", minute: "" }])}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="space-y-2">
                {yellows.map((card, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <Select value={card.player_id} onValueChange={(val) => {
                      const newCards = [...yellows];
                      newCards[idx].player_id = val;
                      setYellows(newCards);
                    }}>
                      <SelectTrigger className="border-gray-200 flex-1"><SelectValue placeholder="Jugador" /></SelectTrigger>
                      <SelectContent>
                        {players.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      max="90"
                      placeholder="Min."
                      value={card.minute}
                      onChange={(e) => {
                        const newCards = [...yellows];
                        newCards[idx].minute = e.target.value;
                        setYellows(newCards);
                      }}
                      className="border-gray-200 w-16"
                    />
                    <Button onClick={() => setYellows(yellows.filter((_, i) => i !== idx))} variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Red cards */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center gap-2"><span className={`w-4 h-4 ${CARD_COLORS.red} rounded border`} /> Rojas</h3>
                <Button
                  onClick={() => setReds([...reds, { type: "red", player_id: "", minute: "" }])}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="space-y-2">
                {reds.map((card, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <Select value={card.player_id} onValueChange={(val) => {
                      const newCards = [...reds];
                      newCards[idx].player_id = val;
                      setReds(newCards);
                    }}>
                      <SelectTrigger className="border-gray-200 flex-1"><SelectValue placeholder="Jugador" /></SelectTrigger>
                      <SelectContent>
                        {players.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      max="90"
                      placeholder="Min."
                      value={card.minute}
                      onChange={(e) => {
                        const newCards = [...reds];
                        newCards[idx].minute = e.target.value;
                        setReds(newCards);
                      }}
                      className="border-gray-200 w-16"
                    />
                    <Button onClick={() => setReds(reds.filter((_, i) => i !== idx))} variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Save all button */}
          {(goals.length > 0 || yellows.length > 0 || reds.length > 0) && (
            <Button
              onClick={() => saveMatchStatsMutation.mutate()}
              disabled={saveMatchStatsMutation.isPending}
              className="w-full text-white"
              style={{ background: "var(--granate)" }}
            >
              <Save className="w-4 h-4 mr-2" /> Guardar acta
            </Button>
          )}
        </>
      )}
    </div>
  );
}