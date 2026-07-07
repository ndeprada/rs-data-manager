import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, Plus, User, ChevronUp, ChevronDown, ChevronsUpDown, ArrowLeft } from "lucide-react";
import { useSelectedTeam } from "@/lib/useSelectedTeam";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import AddPlayerDialog from "@/components/team/AddPlayerDialog";

const POSITION_LABELS = {
  portero: "POR", lateral: "LAT", central: "CTR", libre: "LIB",
  mediocentro: "MCC", interior: "INT", delantero_centro: "DC", extremo: "EXT",
};

export default function Squad() {
  const { selectedTeamId, selectTeam, isCoordinator, canSwitch } = useSelectedTeam();
  const [filterPos, setFilterPos] = useState("all");
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [sortKey, setSortKey] = useState("last_name");
  const [sortDir, setSortDir] = useState("asc");

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 inline opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 ml-1 inline" /> : <ChevronDown className="w-3 h-3 ml-1 inline" />;
  };

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: matchStats = [] } = useQuery({ queryKey: ["matchStats"], queryFn: () => base44.entities.MatchStats.list("-date", 500) });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date", 500) });
  const { data: convocatorias = [] } = useQuery({ queryKey: ["convocatorias"], queryFn: () => base44.entities.Convocatoria.list() });
  const { data: matchAvailability = [] } = useQuery({ queryKey: ["matchAvailability"], queryFn: () => base44.entities.MatchAvailability.list() });

  const teamPlayers = players.filter(p => p.team_id === selectedTeamId && p.status !== "baja");

  const filtered = teamPlayers.filter(p => filterPos === "all" || p.position === filterPos);

  // Match events for the team
  const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
  const teamMatchEvents = events.filter(e => e.team_id === selectedTeamId && MATCH_TYPES.includes(e.type));

  // Total possible minutes: sum of match durations for team
  const getMatchMinutes = (ev) => {
    const dur = ev.match_duration;
    if (!dur) return 90;
    if (dur === "4x15") return 60;
    if (dur === "4x12") return 48;
    return parseInt(dur) || 90;
  };
  const totalTeamMinutes = teamMatchEvents.reduce((acc, ev) => acc + getMatchMinutes(ev), 0);

  const playerStats = filtered.map(p => {
    const stats = matchStats.filter(s => s.player_id === p.id);
    const att = attendance.filter(a => a.player_id === p.id);
    const goals = stats.reduce((acc, s) => acc + (s.goals || 0), 0);
    const assists = stats.reduce((acc, s) => acc + (s.assists || 0), 0);
    const yellow = stats.reduce((acc, s) => acc + (s.yellow_cards || 0), 0);
    const red = stats.reduce((acc, s) => acc + (s.red_cards || 0), 0);
    const mins = stats.reduce((acc, s) => acc + (s.minutes_played || 0), 0);
    const present = att.filter(a => a.status === "present" || a.status === "apart").length;
    const total = att.length;

    // "Minutos disponibles": partidos en los que estuvo convocado O fue no-convocado por decisión técnica
    // Excluye: lesión, viaje, estudios, enfermo, etc.
    const availableMatchMinutes = teamMatchEvents.reduce((acc, ev) => {
      // Check if convocado
      const convoc = convocatorias.find(c => c.event_id === ev.id);
      const wasConvocado = convoc?.player_ids?.includes(p.id);
      if (wasConvocado) return acc + getMatchMinutes(ev);
      // Check MatchAvailability: not available but reason is decision_tecnica → still counts
      const avail = matchAvailability.find(a => a.event_id === ev.id && a.player_id === p.id);
      if (avail?.reason === "decision_tecnica") return acc + getMatchMinutes(ev);
      // Not convocado and no availability record → treated as available (no record means no exclusion)
      if (!avail && !wasConvocado) return acc + getMatchMinutes(ev);
      return acc;
    }, 0);

    return { ...p, goals, assists, yellow, red, mins, present, total, matches: stats.length, totalTeamMinutes, availableMatchMinutes };
  });

  const positions = [...new Set(teamPlayers.map(p => p.position).filter(Boolean))];

  const sortedStats = [...playerStats].sort((a, b) => {
    let aVal, bVal;
    if (sortKey === "name") { aVal = `${a.last_name} ${a.first_name}`.toLowerCase(); bVal = `${b.last_name} ${b.first_name}`.toLowerCase(); }
    else if (sortKey === "position") {
      const POS_ORDER = ["portero","central","libre","lateral","mediocentro","interior","extremo","delantero_centro"];
      aVal = POS_ORDER.indexOf(a.position) === -1 ? 99 : POS_ORDER.indexOf(a.position);
      bVal = POS_ORDER.indexOf(b.position) === -1 ? 99 : POS_ORDER.indexOf(b.position);
    }
    else if (sortKey === "jersey_number") { aVal = a.jersey_number || 999; bVal = b.jersey_number || 999; }
    else if (sortKey === "goals") { aVal = a.goals; bVal = b.goals; }
    else if (sortKey === "assists") { aVal = a.assists; bVal = b.assists; }
    else if (sortKey === "matches") { aVal = a.matches; bVal = b.matches; }
    else if (sortKey === "status") { aVal = a.status || ""; bVal = b.status || ""; }
    else { aVal = `${a.last_name} ${a.first_name}`.toLowerCase(); bVal = `${b.last_name} ${b.first_name}`.toLowerCase(); }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6">
      <Link to="/MyTeam" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" /> Volver a Mi Equipo
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1" style={{ fontFamily: "var(--font-display)" }}>Mi Equipo</p>
          <h1 className="text-3xl font-black uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Plantilla</h1>
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          {canSwitch && (
            <Select value={selectedTeamId} onValueChange={selectTeam}>
              <SelectTrigger className="w-48 border-gray-200 bg-white"><SelectValue placeholder="Seleccionar equipo" /></SelectTrigger>
              <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={filterPos} onValueChange={setFilterPos}>
            <SelectTrigger className="w-36 border-gray-200 bg-white"><SelectValue placeholder="Posición" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {positions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedTeamId && (
            <Button onClick={() => setAddPlayerOpen(true)} className="text-white" style={{ background: "var(--granate)" }}>
              <Plus className="w-4 h-4 mr-1" /> Jugador
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
        {playerStats.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
              {selectedTeamId ? "Sin jugadores" : "Selecciona un equipo"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-400 uppercase tracking-wider select-none" style={{ fontFamily: "var(--font-display)" }}>
                    <th className="text-left px-3 py-3 font-bold cursor-pointer hover:text-gray-700" onClick={() => handleSort("name")}>Jugador<SortIcon col="name" /></th>
                    <th className="text-center px-3 py-3 font-bold cursor-pointer hover:text-gray-700" onClick={() => handleSort("position")}>Pos.<SortIcon col="position" /></th>
                    <th className="text-center px-3 py-3 font-bold cursor-pointer hover:text-gray-700" onClick={() => handleSort("matches")}>PJ<SortIcon col="matches" /></th>
                    <th className="text-center px-3 py-3 font-bold cursor-pointer hover:text-gray-700" onClick={() => handleSort("goals")}>Goles<SortIcon col="goals" /></th>
                    <th className="text-center px-3 py-3 font-bold hidden sm:table-cell cursor-pointer hover:text-gray-700" onClick={() => handleSort("assists")}>Asist.<SortIcon col="assists" /></th>
                    <th className="text-center px-3 py-3 font-bold hidden md:table-cell whitespace-nowrap">Min. totales</th>
                    <th className="text-center px-3 py-3 font-bold hidden lg:table-cell whitespace-nowrap">Min. disponibles</th>
                    <th className="text-center px-3 py-3 font-bold hidden md:table-cell">TA</th>
                    <th className="text-center px-3 py-3 font-bold hidden md:table-cell">TR</th>
                    <th className="text-center px-3 py-3 font-bold hidden lg:table-cell">Asist. Ent.</th>
                    <th className="text-center px-3 py-3 font-bold cursor-pointer hover:text-gray-700" onClick={() => handleSort("status")}>Estado<SortIcon col="status" /></th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedStats.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3">
                      <Link to={`/PlayerProfile?id=${p.id}`} className="flex items-center gap-2 group">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden border border-gray-200" style={{ background: "var(--granate-pale)" }}>
                            {p.photo_url ? (
                              <img src={p.photo_url} alt={p.first_name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          {p.jersey_number && (
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center text-[9px] font-black leading-none" style={{ background: "var(--granate)", fontFamily: "var(--font-display)" }}>
                              {p.jersey_number}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 group-hover:underline" style={{ fontFamily: "var(--font-display)" }}>{p.first_name} {p.last_name}</p>
                          <p className="text-[10px] text-gray-400">{p.birth_date ? format(new Date(p.birth_date), "dd/MM/yyyy") : "—"}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-sm" style={{ background: "var(--granate-pale)", color: "var(--granate)", fontFamily: "var(--font-display)" }}>
                        {POSITION_LABELS[p.position] || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center font-black" style={{ fontFamily: "var(--font-display)" }}>{p.matches}</td>
                    <td className="px-3 py-3 text-center font-black" style={{ fontFamily: "var(--font-display)", color: p.goals > 0 ? "var(--granate)" : "inherit" }}>{p.goals}</td>
                    <td className="px-3 py-3 text-center hidden sm:table-cell font-bold">{p.assists}</td>
                    <td className="px-3 py-3 text-center hidden md:table-cell">
                      <div className="text-xs font-bold text-gray-700">{p.mins}'<span className="text-gray-400 font-normal"> / {p.totalTeamMinutes}'</span></div>
                      {p.totalTeamMinutes > 0 && (
                        <div className="text-[10px] font-bold" style={{ color: "var(--granate)" }}>{Math.round(p.mins / p.totalTeamMinutes * 100)}%</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center hidden lg:table-cell">
                      <div className="text-xs font-bold text-gray-700">{p.mins}'<span className="text-gray-400 font-normal"> / {p.availableMatchMinutes}'</span></div>
                      {p.availableMatchMinutes > 0 && (
                        <div className="text-[10px] font-bold" style={{ color: "var(--naranja)" }}>{Math.round(p.mins / p.availableMatchMinutes * 100)}%</div>
                      )}
                      {p.availableMatchMinutes === 0 && <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center hidden md:table-cell">
                      {p.yellow > 0 ? <span className="inline-block w-4 h-5 rounded-sm bg-yellow-400 text-[9px] font-bold text-yellow-900 flex items-center justify-center">{p.yellow}</span> : "—"}
                    </td>
                    <td className="px-3 py-3 text-center hidden md:table-cell">
                      {p.red > 0 ? <span className="inline-block w-4 h-5 rounded-sm bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">{p.red}</span> : "—"}
                    </td>
                    <td className="px-3 py-3 text-center hidden lg:table-cell text-xs text-gray-600">
                      {p.total > 0 ? `${p.present}/${p.total}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border ${
                        p.status === "activo" ? "bg-green-50 text-green-700 border-green-200" :
                        p.status === "lesionado" ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-gray-100 text-gray-400 border-gray-200"
                      }`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <AddPlayerDialog
        open={addPlayerOpen}
        onOpenChange={setAddPlayerOpen}
        teamId={selectedTeamId}
      />
    </div>
  );
}