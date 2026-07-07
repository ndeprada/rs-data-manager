import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Download, BookOpen, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { downloadPDIPDF } from "./pdiPdfGenerator";

const POSITION_LABELS = {
  portero: "POR", lateral: "LAT", central: "CEN", libre: "LIB",
  mediocentro: "MC", interior: "INT", delantero_centro: "DC", extremo: "EXT",
};

export default function PDIReportSection() {
  const [selectedTeamId, setSelectedTeamId] = useState("all");
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState(null);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: pdiAll = [] } = useQuery({ queryKey: ["pdiAll"], queryFn: () => base44.entities.PDI.list("-date", 500) });

  const filteredPlayers = players
    .filter(p => p.status !== "baja")
    .filter(p => selectedTeamId === "all" || p.team_id === selectedTeamId)
    .filter(p => {
      const q = search.toLowerCase();
      return !q || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q);
    })
    .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));

  const handleDownload = async (player) => {
    setDownloading(player.id);
    const pdiRecords = pdiAll.filter(p => p.player_id === player.id).sort((a, b) => new Date(b.date) - new Date(a.date));
    const team = teams.find(t => t.id === player.team_id);
    downloadPDIPDF(player, team, pdiRecords);
    setDownloading(null);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">Informes PDI por jugador</h2>
        <p className="text-sm text-gray-500">Genera un PDF con todas las evaluaciones del Plan de Desarrollo Individual de cada jugador.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-gray-700 text-xs">Equipo</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="border-gray-200 bg-white">
                <SelectValue />
              </SelectTrigger>
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
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {filteredPlayers.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No hay jugadores</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-semibold">Jugador</th>
                <th className="text-left px-3 py-3 font-semibold">Equipo</th>
                <th className="px-3 py-3 font-semibold text-center">Evaluaciones PDI</th>
                <th className="px-5 py-3 font-semibold text-right">Descargar</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player, idx) => {
                const team = teams.find(t => t.id === player.team_id);
                const pdiCount = pdiAll.filter(p => p.player_id === player.id).length;
                return (
                  <tr key={player.id} className={`border-b border-gray-100 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"} hover:bg-gray-50 transition-colors`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: "var(--granate)" }}>
                          {player.first_name?.[0]}{player.last_name?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{player.first_name} {player.last_name}</p>
                          <p className="text-xs text-gray-400">
                            {POSITION_LABELS[player.position] || "—"}
                            {player.jersey_number ? ` · #${player.jersey_number}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{team?.name || "—"}</td>
                    <td className="px-3 py-3 text-center">
                      {pdiCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: "#fdf2f4", color: "var(--granate)" }}>
                          <BookOpen className="w-3 h-3" /> {pdiCount}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Sin evaluaciones</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(player)}
                        disabled={downloading === player.id}
                        className="text-xs border-gray-200"
                      >
                        {downloading === player.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <><Download className="w-3.5 h-3.5 mr-1" />PDF PDI</>
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