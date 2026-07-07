import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Pencil, Trash2, Search, ChevronUp, ChevronDown, ChevronsUpDown, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AddPlayerDialog from "@/components/team/AddPlayerDialog";
import { format } from "date-fns";

const POSITIONS = [
  { value: "portero", label: "Portero" },
  { value: "lateral", label: "Lateral" },
  { value: "central", label: "Central" },
  { value: "libre", label: "Libre" },
  { value: "mediocentro", label: "Mediocentro" },
  { value: "interior", label: "Interior" },
  { value: "delantero_centro", label: "Del. Centro" },
  { value: "extremo", label: "Extremo" },
];

const POSITION_LABELS = {
  portero: "POR", lateral: "LAT", central: "CTR", libre: "LIB",
  mediocentro: "MCC", interior: "INT", delantero_centro: "DC", extremo: "EXT",
};

const POSITION_PILLS = [
  { value: "portero", label: "POR" },
  { value: "delantero_centro", label: "DC" },
  { value: "lateral", label: "LAT" },
  { value: "central", label: "CTR" },
  { value: "interior", label: "INT" },
  { value: "extremo", label: "EXT" },
  { value: "libre", label: "LIB" },
];

function PlayerAvatar({ player }) {
  if (player.photo_url) {
    return <img src={player.photo_url} alt={player.first_name} className="w-full h-full object-cover" />;
  }
  const initials = `${player.first_name?.[0] || ""}${player.last_name?.[0] || ""}`.toUpperCase();
  return (
    <span className="text-xs font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
      {initials || "?"}
    </span>
  );
}

const LATERALITY = [
  { value: "diestro", label: "Diestro" },
  { value: "zurdo", label: "Zurdo" },
  { value: "ambidiestro", label: "Ambidiestro" },
];

export default function Players() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterLaterality, setFilterLaterality] = useState("all");
  const [filterPosition, setFilterPosition] = useState(new Set());
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortKey, setSortKey] = useState("last_name");
  const [sortDir, setSortDir] = useState("asc");

  const togglePositionFilter = (pos) => {
    const newSet = new Set(filterPosition);
    if (newSet.has(pos)) {
      newSet.delete(pos);
    } else {
      newSet.add(pos);
    }
    setFilterPosition(newSet);
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 inline opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 ml-1 inline" /> : <ChevronDown className="w-3 h-3 ml-1 inline" />;
  };

  const { data: players = [], isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["players"] }); setDeleteId(null); },
  });

  const birthYears = [...new Set(
    players.map(p => p.birth_date ? new Date(p.birth_date).getFullYear() : null).filter(Boolean)
  )].sort((a, b) => b - a);

  const filtered = players.filter((p) => {
    const matchSearch = `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase());
    const matchTeam = filterTeam === "all" || p.team_id === filterTeam;
    const matchYear = filterYear === "all" || (p.birth_date && new Date(p.birth_date).getFullYear().toString() === filterYear);
    const matchLaterality = filterLaterality === "all" || p.laterality === filterLaterality;
    const matchPosition = filterPosition.size === 0 || filterPosition.has(p.position);
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchTeam && matchYear && matchLaterality && matchPosition && matchStatus;
  });

  const hasFilters = search || filterTeam !== "all" || filterYear !== "all" || filterLaterality !== "all" || filterPosition.size > 0 || filterStatus !== "all";

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal;
    if (sortKey === "name") { aVal = `${a.last_name} ${a.first_name}`.toLowerCase(); bVal = `${b.last_name} ${b.first_name}`.toLowerCase(); }
    else if (sortKey === "position") {
      const POS_ORDER = ["portero","central","libre","lateral","mediocentro","interior","extremo","delantero_centro"];
      aVal = POS_ORDER.indexOf(a.position) === -1 ? 99 : POS_ORDER.indexOf(a.position);
      bVal = POS_ORDER.indexOf(b.position) === -1 ? 99 : POS_ORDER.indexOf(b.position);
    }
    else if (sortKey === "jersey_number") { aVal = a.jersey_number || 999; bVal = b.jersey_number || 999; }
    else if (sortKey === "birth_date") { aVal = a.birth_date || ""; bVal = b.birth_date || ""; }
    else if (sortKey === "status") { aVal = a.status || ""; bVal = b.status || ""; }
    else if (sortKey === "team") { aVal = teams.find(t => t.id === a.team_id)?.name || ""; bVal = teams.find(t => t.id === b.team_id)?.name || ""; }
    else { aVal = `${a.last_name} ${a.first_name}`.toLowerCase(); bVal = `${b.last_name} ${b.first_name}`.toLowerCase(); }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Directorio</p>
          <h1>Jugadores</h1>
          <p className="text-xs text-gray-400">{players.length} jugadores registrados en el club</p>
        </div>
        <Button onClick={() => { setEditingPlayer(null); setDialogOpen(true); }} className="text-white" style={{ background: "var(--granate)" }}>
          <Plus className="w-4 h-4 mr-1" /> Nuevo Jugador
        </Button>
      </div>

      {/* Sticky Filter Bar */}
      <div className="sticky top-[56px] lg:top-0 z-20 bg-white border border-gray-200 rounded-sm shadow-sm p-3 space-y-2">
        <div className="flex flex-col lg:flex-row gap-2 items-start lg:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Buscar por nombre…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 border-gray-200 h-8" />
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Select value={filterTeam} onValueChange={setFilterTeam}>
              <SelectTrigger className="w-full sm:w-40 border-gray-200 bg-white h-8 text-xs"><SelectValue placeholder="Equipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los equipos</SelectItem>
                {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-full sm:w-32 border-gray-200 bg-white h-8 text-xs"><SelectValue placeholder="Año nac." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los años</SelectItem>
                {birthYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterLaterality} onValueChange={setFilterLaterality}>
              <SelectTrigger className="w-full sm:w-32 border-gray-200 bg-white h-8 text-xs"><SelectValue placeholder="Lateralidad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda lateralidad</SelectItem>
                {LATERALITY.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-28 border-gray-200 bg-white h-8 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="lesionado">Lesionado</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setFilterTeam("all"); setFilterYear("all"); setFilterLaterality("all"); setFilterPosition(new Set()); setFilterStatus("all"); }}
                className="text-xs text-gray-400 hover:text-gray-700 underline px-2 h-8 flex items-center shrink-0"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Position pills */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Posición:</span>
            {POSITION_PILLS.map(pos => (
              <button
                key={pos.value}
                onClick={() => togglePositionFilter(pos.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  filterPosition.has(pos.value)
                    ? "text-white border-2"
                    : "text-gray-500 border-2 border-gray-200 hover:border-gray-300"
                }`}
                style={filterPosition.has(pos.value) ? { background: "var(--granate)", borderColor: "var(--granate)" } : {}}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-500">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="bg-white border border-gray-200 h-14 rounded animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded p-12 text-center">
          <Users className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
            {hasFilters ? "Sin resultados con estos filtros" : "No hay jugadores registrados"}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-400 uppercase tracking-wider select-none" style={{ fontFamily: "var(--font-display)" }}>
                   <th className="text-left px-4 py-2 font-bold cursor-pointer hover:text-gray-700" onClick={() => handleSort("name")}>Jugador<SortIcon col="name" /></th>
                   <th className="text-left px-3 py-2 font-bold hidden md:table-cell cursor-pointer hover:text-gray-700" onClick={() => handleSort("team")}>Equipo<SortIcon col="team" /></th>
                   <th className="text-center px-3 py-2 font-bold cursor-pointer hover:text-gray-700" onClick={() => handleSort("position")}>Pos.<SortIcon col="position" /></th>
                   <th className="text-center px-3 py-2 font-bold hidden sm:table-cell cursor-pointer hover:text-gray-700" onClick={() => handleSort("birth_date")}>Año nac.<SortIcon col="birth_date" /></th>
                   <th className="text-center px-3 py-2 font-bold hidden lg:table-cell">Lateral.</th>
                   <th className="text-center px-3 py-2 font-bold hidden lg:table-cell cursor-pointer hover:text-gray-700" onClick={() => handleSort("jersey_number")}>#<SortIcon col="jersey_number" /></th>
                   <th className="text-center px-3 py-2 font-bold cursor-pointer hover:text-gray-700" onClick={() => handleSort("status")}>Estado<SortIcon col="status" /></th>
                   <th className="px-3 py-2"></th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map(player => {
                  const team = teams.find(t => t.id === player.team_id);
                  const birthYear = player.birth_date ? new Date(player.birth_date).getFullYear() : null;
                  return (
                    <tr key={player.id} className="hover:bg-gray-50 transition-colors">
                       <td className="px-4 py-1.5">
                         <div className="flex items-center gap-2">
                           <div className="relative shrink-0">
                             <div className="w-8 h-8 rounded flex items-center justify-center overflow-hidden border border-gray-200" style={{ background: "var(--granate)" }}>
                               <PlayerAvatar player={player} />
                             </div>
                             {player.jersey_number && (
                               <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center text-[9px] font-black leading-none border border-white" style={{ background: "var(--naranja)", fontFamily: "var(--font-display)" }}>
                                 {player.jersey_number}
                               </span>
                             )}
                           </div>
                           <div>
                             <p className="font-bold text-gray-900 leading-tight" style={{ fontFamily: "var(--font-display)" }}>{player.first_name} {player.last_name}</p>
                           </div>
                         </div>
                       </td>
                      <td className="px-3 py-1.5 hidden md:table-cell text-xs text-gray-500">{team?.name || "—"}</td>
                      <td className="px-3 py-1.5 text-center">
                        {player.position ? (
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-sm" style={{ background: "var(--granate-pale)", color: "var(--granate)", fontFamily: "var(--font-display)" }}>
                            {POSITION_LABELS[player.position] || player.position}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-1.5 text-center hidden sm:table-cell font-black text-gray-600 text-sm" style={{ fontFamily: "var(--font-display)" }}>
                        {birthYear || "—"}
                      </td>
                      <td className="px-3 py-1.5 text-center hidden lg:table-cell text-xs text-gray-400 capitalize">{player.laterality || "—"}</td>
                      <td className="px-3 py-1.5 text-center hidden lg:table-cell font-black text-gray-400" style={{ fontFamily: "var(--font-display)" }}>{player.jersey_number || "—"}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border ${
                          player.status === "activo" ? "bg-green-50 text-green-700 border-green-200" :
                          player.status === "lesionado" ? "bg-red-50 text-red-700 border-red-200" :
                          "bg-gray-100 text-gray-400 border-gray-200"
                        }`} style={{ fontFamily: "var(--font-display)" }}>{player.status || "activo"}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Link to={`/PlayerProfile?id=${player.id}`} className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors" title="Ver perfil">
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          <button onClick={() => { setEditingPlayer(player); setDialogOpen(true); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteId(player.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddPlayerDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingPlayer(null); }}
        teamId={editingPlayer?.team_id || ""}
        editingPlayer={editingPlayer}
      />

      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar jugador?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}