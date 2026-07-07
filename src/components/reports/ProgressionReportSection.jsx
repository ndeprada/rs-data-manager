import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Download, TrendingUp, Loader2, Search, User, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { downloadProgressionPDF } from "./progressionPdfGenerator";

const POSITION_LABELS = {
  portero: "POR", lateral: "LAT", central: "CEN", libre: "LIB",
  mediocentro: "MC", interior: "INT", delantero_centro: "DC", extremo: "EXT",
};

export default function ProgressionReportSection() {
  const [selectedTeamId, setSelectedTeamId] = useState("all");
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState(null);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: matchStats = [] } = useQuery({ queryKey: ["matchStats"], queryFn: () => base44.entities.MatchStats.list("-date", 1000) });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list("-date", 2000) });
  const { data: pdiAll = [] } = useQuery({ queryKey: ["pdiAll"], queryFn: () => base44.entities.PDI.list("-date", 500) });
  const { data: sessionReports = [] } = useQuery({ queryKey: ["sessionReports"], queryFn: () => base44.entities.SessionReport.list("-date", 500) });

  const filteredPlayers = players
    .filter(p => p.status !== "baja")
    .filter(p => selectedTeamId === "all" || p.team_id === selectedTeamId)
    .filter(p => {
      const q = search.toLowerCase();
      return !q || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q);
    })
    .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));

  const getPlayerSummary = (playerId) => {
    const stats = matchStats.filter(m => m.player_id === playerId);
    const att = attendance.filter(a => a.player_id === playerId);
    const pdi = pdiAll.filter(p => p.player_id === playerId);
    const minutes = stats.reduce((s, m) => s + (m.minutes_played || 0), 0);
    const present = att.filter(a => a.status === "present" || a.attended).length;
    const apart = att.filter(a => a.status === "apart").length;
    const rate = att.length > 0 ? Math.round(((present + apart) / att.length) * 100) : null;
    return { matchesPlayed: stats.length, minutes, attendanceRate: rate, pdiCount: pdi.length };
  };

  const handleDownload = async (player) => {
    setDownloading(player.id);
    const team = teams.find(t => t.id === player.team_id);
    const stats = matchStats.filter(m => m.player_id === player.id).sort((a, b) => new Date(b.date) - new Date(a.date));
    const att = attendance.filter(a => a.player_id === player.id).sort((a, b) => new Date(b.date) - new Date(a.date));
    const pdi = pdiAll.filter(p => p.player_id === player.id).sort((a, b) => new Date(b.date) - new Date(a.date));
    // Get session reports for this player's team
    const sessions = sessionReports.filter(r => r.team_id === player.team_id).sort((a, b) => new Date(b.date) - new Date(a.date));
    downloadProgressionPDF(player, team, stats, att, pdi, sessions);
    setDownloading(null);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-gray-200 p-5 shadow-sm space-y-4" style={{ borderRadius: "4px" }}>
        <div>
          <h3 style={{ color: "var(--naranja)" }}>Informe de Progresión Individual</h3>
          <p className="text-sm text-gray-500 mt-1">
            Genera un PDF completo con minutos jugados, asistencia a entrenamientos y notas tácticas del cuerpo técnico para cada jugador.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-gray-700 text-xs">Equipo</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="border-gray-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los equipos</SelectItem>
                {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-gray-700 text-xs">Buscar jugador</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre o apellido…" className="pl-9 border-gray-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Player list */}
      <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
        {filteredPlayers.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>No hay jugadores</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                <th className="text-left px-5 py-3 font-bold">Jugador</th>
                <th className="text-left px-3 py-3 font-bold hidden md:table-cell">Equipo</th>
                <th className="text-center px-3 py-3 font-bold">Partidos</th>
                <th className="text-center px-3 py-3 font-bold hidden sm:table-cell">Minutos</th>
                <th className="text-center px-3 py-3 font-bold hidden sm:table-cell">% Asistencia</th>
                <th className="text-center px-3 py-3 font-bold hidden lg:table-cell">Eval. PDI</th>
                <th className="text-right px-5 py-3 font-bold">PDF</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player, idx) => {
                const team = teams.find(t => t.id === player.team_id);
                const { matchesPlayed, minutes, attendanceRate, pdiCount } = getPlayerSummary(player.id);
                return (
                  <tr key={player.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden border border-gray-100"
                          style={{ background: player.photo_url ? "transparent" : "var(--granate)" }}>
                          {player.photo_url
                            ? <img src={player.photo_url} alt="" className="w-full h-full object-cover" />
                            : <>{player.first_name?.[0]}{player.last_name?.[0]}</>
                          }
                        </div>
                        <div>
                          <p className="font-bold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>{player.first_name} {player.last_name}</p>
                          <p className="text-xs text-gray-400">
                            {POSITION_LABELS[player.position] || "—"}
                            {player.jersey_number ? ` · #${player.jersey_number}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs hidden md:table-cell">{team?.name || "—"}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-bold text-gray-700" style={{ fontFamily: "var(--font-display)" }}>{matchesPlayed}</span>
                    </td>
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      <span className="font-bold text-gray-700" style={{ fontFamily: "var(--font-display)" }}>{minutes}'</span>
                    </td>
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      {attendanceRate !== null ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-sm ${attendanceRate >= 75 ? "bg-green-50 text-green-700" : attendanceRate >= 50 ? "bg-orange-50 text-orange-700" : "bg-red-50 text-red-600"}`}
                          style={{ fontFamily: "var(--font-display)" }}>
                          {attendanceRate}%
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center hidden lg:table-cell">
                      {pdiCount > 0 ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-sm" style={{ background: "#fdf2f4", color: "var(--granate)", fontFamily: "var(--font-display)" }}>
                          {pdiCount} eval.
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        size="sm"
                        onClick={() => handleDownload(player)}
                        disabled={downloading === player.id}
                        className="text-white text-xs"
                        style={{ background: "var(--granate)" }}
                      >
                        {downloading === player.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <><Download className="w-3.5 h-3.5 mr-1" />Generar</>
                        }
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}