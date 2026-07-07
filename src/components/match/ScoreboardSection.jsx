import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const FOOTBALL_FORMATS = [
  { value: "f11", label: "Fútbol 11" },
  { value: "f7", label: "Fútbol 7" },
];

const MATCH_DURATIONS = [
  { value: "90", label: "90' — Juveniles (2×45')" },
  { value: "80", label: "80' — Cadetes (2×40')" },
  { value: "70", label: "70' — Infantiles (2×35')" },
  { value: "4x15", label: "4×15' — Alevines / Benjamines" },
  { value: "4x12", label: "4×12' — Prebenjamines / Escuela" },
];

export default function ScoreboardSection({ event, matchData, setMatchData, onSave }) {
  const homeGoals = matchData.team_goals ?? event?.score_home ?? 0;
  const awayGoals = matchData.opponent_goals ?? event?.score_away ?? 0;
  const diff = homeGoals - awayGoals;
  const resultLabel = diff > 0 ? "VICTORIA" : diff < 0 ? "DERROTA" : "EMPATE";
  const resultColor = diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-yellow-500";

  return (
    <div className="space-y-6">
      {/* Format + Duration */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Formato</Label>
          <Select
            value={matchData.football_format || event?.football_format || ""}
            onValueChange={(v) => setMatchData({ ...matchData, football_format: v })}
          >
            <SelectTrigger className="border-gray-200">
              <SelectValue placeholder="Seleccionar…" />
            </SelectTrigger>
            <SelectContent>
              {FOOTBALL_FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Duración</Label>
          <Select
            value={matchData.match_duration || event?.match_duration || ""}
            onValueChange={(v) => setMatchData({ ...matchData, match_duration: v })}
          >
            <SelectTrigger className="border-gray-200">
              <SelectValue placeholder="Seleccionar…" />
            </SelectTrigger>
            <SelectContent>
              {MATCH_DURATIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between gap-6">
          {/* Home */}
          <div className="flex-1 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-3">Nuestro equipo</p>
            <Input
              type="number"
              min="0"
              value={homeGoals}
              onChange={(e) => setMatchData({ ...matchData, team_goals: parseInt(e.target.value) || 0 })}
              className="text-center text-5xl font-bold h-24 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/30"
              style={{ fontFamily: "var(--font-display)" }}
            />
          </div>
          {/* Divider */}
          <div className="text-center shrink-0">
            <div className="text-4xl font-bold text-white/30 mb-2" style={{ fontFamily: "var(--font-display)" }}>–</div>
            {(homeGoals !== 0 || awayGoals !== 0) && (
              <div className={`text-xs font-bold uppercase tracking-widest ${resultColor}`} style={{ fontFamily: "var(--font-display)" }}>
                {resultLabel}
              </div>
            )}
          </div>
          {/* Away */}
          <div className="flex-1 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-3">
              {event?.opponent || "Rival"}
            </p>
            <Input
              type="number"
              min="0"
              value={awayGoals}
              onChange={(e) => setMatchData({ ...matchData, opponent_goals: parseInt(e.target.value) || 0 })}
              className="text-center text-5xl font-bold h-24 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/30"
              style={{ fontFamily: "var(--font-display)" }}
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Notas del partido</Label>
        <Textarea
          value={matchData.notes || ""}
          onChange={(e) => setMatchData({ ...matchData, notes: e.target.value })}
          rows={4}
          className="border-gray-200"
          placeholder="Observaciones, incidencias, aspectos a destacar…"
        />
      </div>
    </div>
  );
}