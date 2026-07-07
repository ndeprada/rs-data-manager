import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, ArrowLeft } from "lucide-react";
import { useSelectedTeam } from "@/lib/useSelectedTeam";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function Development() {
  const { selectedTeamId, selectTeam, isCoordinator } = useSelectedTeam();
  const [search, setSearch] = useState("");

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: pdis = [] } = useQuery({ queryKey: ["pdis"], queryFn: () => base44.entities.PDI.list("-date", 500) });
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries"], queryFn: () => base44.entities.Injury.list() });
  const { data: matchStats = [] } = useQuery({ queryKey: ["matchStats"], queryFn: () => base44.entities.MatchStats.list("-date", 500) });

  const teamPlayers = players.filter(p =>
    p.team_id === selectedTeamId && p.status !== "baja" &&
    (search === "" || `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()))
  );

  const playerData = teamPlayers.map(p => {
    const lastPdi = pdis.filter(d => d.player_id === p.id).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const activeInjury = injuries.find(i => i.player_id === p.id && i.status !== "alta");
    const stats = matchStats.filter(s => s.player_id === p.id);
    const goals = stats.reduce((acc, s) => acc + (s.goals || 0), 0);
    const assists = stats.reduce((acc, s) => acc + (s.assists || 0), 0);
    return { ...p, lastPdi, activeInjury, goals, assists, matches: stats.length };
  });

  return (
    <div className="space-y-6">
      <Link to="/MyTeam" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" /> Volver a Mi Equipo
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1" style={{ fontFamily: "var(--font-display)" }}>Mi Equipo</p>
          <h1 className="text-3xl font-black uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Desarrollo</h1>
        </div>
        <div className="flex gap-3 flex-wrap">
          {isCoordinator && (
            <Select value={selectedTeamId} onValueChange={selectTeam}>
              <SelectTrigger className="w-48 border-gray-200 bg-white"><SelectValue placeholder="Equipo" /></SelectTrigger>
              <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar jugador..."
            className="h-9 px-3 text-sm border border-gray-200 rounded bg-white w-48" />
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
        {playerData.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
              {selectedTeamId ? "Sin jugadores" : "Selecciona un equipo"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {playerData.map(p => (
              <Link key={p.id} to={`/PlayerProfile?id=${p.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group">
                {/* Avatar */}
                {p.photo_url ? (
                  <img src={p.photo_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: "var(--granate)" }}>
                    {p.first_name?.[0]}{p.last_name?.[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 group-hover:underline truncate" style={{ fontFamily: "var(--font-display)" }}>
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="text-xs text-gray-400 capitalize">{p.position} · #{p.jersey_number || "—"}</p>
                </div>
                {/* Stats */}
                <div className="hidden sm:flex items-center gap-6 shrink-0 text-center">
                  <div>
                    <p className="text-lg font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{p.goals}</p>
                    <p className="text-[10px] text-gray-400 uppercase" style={{ fontFamily: "var(--font-display)" }}>Goles</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-gray-700" style={{ fontFamily: "var(--font-display)" }}>{p.assists}</p>
                    <p className="text-[10px] text-gray-400 uppercase" style={{ fontFamily: "var(--font-display)" }}>Asist.</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-gray-700" style={{ fontFamily: "var(--font-display)" }}>{p.matches}</p>
                    <p className="text-[10px] text-gray-400 uppercase" style={{ fontFamily: "var(--font-display)" }}>PJ</p>
                  </div>
                </div>
                {/* PDI */}
                <div className="hidden md:block shrink-0 text-center">
                  {p.lastPdi ? (
                    <div>
                      <p className="text-lg font-black" style={{ fontFamily: "var(--font-display)", color: p.lastPdi.overall_rating >= 7 ? "#16a34a" : p.lastPdi.overall_rating >= 5 ? "#b45309" : "#dc2626" }}>
                        {p.lastPdi.overall_rating}/10
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase" style={{ fontFamily: "var(--font-display)" }}>PDI</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-300">—</p>
                      <p className="text-[10px] text-gray-400 uppercase" style={{ fontFamily: "var(--font-display)" }}>PDI</p>
                    </div>
                  )}
                </div>
                {/* Injury */}
                <div className="shrink-0">
                  {p.activeInjury ? (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border bg-red-50 text-red-700 border-red-200">Lesionado</span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border bg-green-50 text-green-700 border-green-200">OK</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}