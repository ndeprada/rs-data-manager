import { birthYearOf } from "@/lib/birthYear";
import { Flag, countryOf, isForeign } from "@/lib/countries";
import PlayerName from "@/components/common/PlayerName";
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Pencil, Trash2, Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AddPlayerDialog from "@/components/team/AddPlayerDialog";
import PlayerArchive from "@/components/players/PlayerArchive";
import TabBar from "@/components/common/TabBar";
import { playerSearchName } from "@/lib/playerName";
import { useTeamAccess } from "@/lib/TeamAccessContext";

import { PageTitle } from "@/components/common/PageHeader";
import { useT, useFormat, msg } from "@/i18n";
const POSITIONS = [
  { value: "portero", label: msg("Portero") },
  { value: "lateral", label: msg("Lateral") },
  { value: "central", label: msg("Central") },
  { value: "mediocentro", label: msg("Mediocentro") },
  { value: "interior", label: msg("Interior") },
  { value: "mediapunta", label: msg("Mediapunta") },
  { value: "delantero_centro", label: msg("Del. Centro") },
  { value: "extremo", label: msg("Extremo") },
];

const POSITION_LABELS = {
  portero: msg("POR"), lateral: msg("LAT"), central: msg("CTR"), libre: msg("LIB"),
  mediocentro: msg("MCC"), interior: msg("INT"), mediapunta: msg("MP"), delantero_centro: msg("DC"), extremo: msg("EXT"),
};

const POSITION_PILLS = [
  { value: "portero", label: msg("POR") },
  { value: "delantero_centro", label: msg("DC") },
  { value: "lateral", label: msg("LAT") },
  { value: "central", label: msg("CTR") },
  { value: "interior", label: msg("INT") },
  { value: "mediapunta", label: msg("MP") },
  { value: "extremo", label: msg("EXT") },
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
  { value: "diestro", label: msg("Diestro") },
  { value: "zurdo", label: msg("Zurdo") },
  { value: "ambidiestro", label: msg("Ambidiestro") },
];

export default function Players() {
  const t = useT();
  const fmt = useFormat();
  const queryClient = useQueryClient();
  const { perms } = useTeamAccess();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterLaterality, setFilterLaterality] = useState("all");
  const [filterPosition, setFilterPosition] = useState(new Set());
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterNat, setFilterNat] = useState("all");
  const [sortKey, setSortKey] = useState("last_name");
  const [sortDir, setSortDir] = useState("asc");
  const [view, setView] = useState("current"); // current | history

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

  const { data: archivedPlayers = [] } = useQuery({
    queryKey: ["players_archived"],
    queryFn: () => base44.entities.Player.archived({}, "only"),
  });
  const historyCount = new Set([...archivedPlayers.map((p) => p.id), ...players.filter((p) => p.status === "baja").map((p) => p.id)]).size;

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["players"] }); setDeleteId(null); },
  });

  const birthYears = [...new Set(
    players.map(p => birthYearOf(p)).filter(Boolean)
  )].sort((a, b) => b - a);

  const natList = [...new Map(players.filter(isForeign).map((p) => [countryOf(p).a3, countryOf(p)])).values()].sort((a, b) => fmt.country(a.a2, a.name).localeCompare(fmt.country(b.a2, b.name), fmt.lang));

  const filtered = players.filter((p) => {
    const matchSearch = `${playerSearchName(p)}`.toLowerCase().includes(search.toLowerCase());
    const matchTeam = filterTeam === "all" || p.team_id === filterTeam;
    const matchYear = filterYear === "all" || (birthYearOf(p) && birthYearOf(p).toString() === filterYear);
    const matchLaterality = filterLaterality === "all" || p.laterality === filterLaterality;
    const matchPosition = filterPosition.size === 0 || filterPosition.has(p.position);
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    const matchNat = filterNat === "all" || (filterNat === "foreign" ? isForeign(p) : filterNat === "ESP" ? countryOf(p)?.a3 === "ESP" : countryOf(p)?.a3 === filterNat);
    return matchNat && matchSearch && matchTeam && matchYear && matchLaterality && matchPosition && matchStatus;
  });

  const hasFilters = search || filterTeam !== "all" || filterYear !== "all" || filterLaterality !== "all" || filterPosition.size > 0 || filterStatus !== "all" || filterNat !== "all";

  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal;
    if (sortKey === "name") { aVal = `${a.last_name} ${a.first_name}`.toLowerCase(); bVal = `${b.last_name} ${b.first_name}`.toLowerCase(); }
    else if (sortKey === "position") {
      const POS_ORDER = ["portero","central","libre","lateral","mediocentro","interior","mediapunta","extremo","delantero_centro"];
      aVal = POS_ORDER.indexOf(a.position) === -1 ? 99 : POS_ORDER.indexOf(a.position);
      bVal = POS_ORDER.indexOf(b.position) === -1 ? 99 : POS_ORDER.indexOf(b.position);
    }
    else if (sortKey === "jersey_number") { aVal = a.jersey_number || 999; bVal = b.jersey_number || 999; }
    else if (sortKey === "birth_date") { aVal = birthYearOf(a) || 0; bVal = birthYearOf(b) || 0; }
    else if (sortKey === "laterality") { aVal = a.laterality || "z"; bVal = b.laterality || "z"; }
    else if (sortKey === "nat") { const k = (p) => (isForeign(p) ? `1${countryOf(p)?.a3 || ""}` : countryOf(p) ? "0" : "2"); aVal = k(a); bVal = k(b); }
    else if (sortKey === "status") { aVal = a.status || ""; bVal = b.status || ""; }
    else if (sortKey === "team") { aVal = teams.find(t => t.id === a.team_id)?.name || ""; bVal = teams.find(t => t.id === b.team_id)?.name || ""; }
    else { aVal = `${a.last_name} ${a.first_name}`.toLowerCase(); bVal = `${b.last_name} ${b.first_name}`.toLowerCase(); }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // Los entrenadores trabajan con la plantilla de su equipo (Mi Equipo); el listado del club es para quien ve a todos
  if (perms.players !== "all") {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-400">{t("No tienes acceso a esta sección.")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageTitle kicker={t("Directorio")} title={t("Jugadores")} subtitle={<>{t("Racing Sarrià · {length} jugadores registrados", { length: players.length })}</>} />
        {perms.editPlayers && (
          <Button variant="club" onClick={() => { setEditingPlayer(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> {t("Nuevo Jugador")}
          </Button>
        )}
      </div>

      <TabBar
        value={view}
        onChange={setView}
        items={[{ value: "current", label: msg("Plantilla actual") }, ...(perms.editPlayers ? [{ value: "history", label: msg("Histórico"), badge: historyCount }] : [])]}
      />
      {view === "history" && <PlayerArchive players={players} teams={teams} />}

      {view === "current" && (<>
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        {[[msg("Jugadores"), players.length], [msg("Activos"), players.filter(p => (p.status || "activo") === "activo").length], [msg("Lesionados"), players.filter(p => p.status === "lesionado").length]].map(([l, v]) => (
          <div key={l} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">{t(l)}</p>
            <p className="text-2xl font-black leading-none mt-1" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Barra de búsqueda y filtros (sticky) */}
      <div className="sticky top-[56px] lg:top-0 z-20 bg-white border border-gray-200 rounded-xl shadow-sm p-3 space-y-2.5">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder={t("Buscar por nombre…")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 border-gray-200 h-8" />
          </div>
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-[170px] border-gray-200 bg-white h-8 text-xs"><SelectValue placeholder={t("Equipo")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todos los equipos")}</SelectItem>
              {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[130px] border-gray-200 bg-white h-8 text-xs"><SelectValue placeholder={t("Año nac.")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todos los años")}</SelectItem>
              {birthYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterNat} onValueChange={setFilterNat}>
            <SelectTrigger className="w-[150px] border-gray-200 bg-white h-8 text-xs"><SelectValue placeholder={t("Nacionalidad")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Toda nacionalidad")}</SelectItem>
              <SelectItem value="ESP">{t("Españoles ({n})", { n: players.filter((p) => countryOf(p)?.a3 === "ESP").length })}</SelectItem>
              <SelectItem value="foreign">{t("Extranjeros ({length})", { length: players.filter(isForeign).length })}</SelectItem>
              {natList.map((c) => <SelectItem key={c.a3} value={c.a3}>{fmt.country(c.a2, c.name)} ({players.filter((p) => countryOf(p)?.a3 === c.a3).length})</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterLaterality} onValueChange={setFilterLaterality}>
            <SelectTrigger className="w-[140px] border-gray-200 bg-white h-8 text-xs"><SelectValue placeholder={t("Lateralidad")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Toda lateralidad")}</SelectItem>
              {LATERALITY.map(l => <SelectItem key={l.value} value={l.value}>{t(l.label)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px] border-gray-200 bg-white h-8 text-xs"><SelectValue placeholder={t("Estado")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todos")}</SelectItem>
              <SelectItem value="activo">{t("Activo")}</SelectItem>
              <SelectItem value="lesionado">{t("Lesionado")}</SelectItem>
              <SelectItem value="baja">{t("Baja")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mr-1">{t("Posición")}</span>
            {POSITION_PILLS.map(pos => (
              <button
                key={pos.value}
                onClick={() => togglePositionFilter(pos.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                  filterPosition.has(pos.value) ? "text-white" : "text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
                style={filterPosition.has(pos.value) ? { background: "var(--granate)", borderColor: "var(--granate)" } : {}}
              >
                {t(pos.label)}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <p className="text-xs text-gray-500">{filtered.length === 1 ? t("{n} resultado", { n: 1 }) : t("{n} resultados", { n: filtered.length })}</p>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setFilterTeam("all"); setFilterYear("all"); setFilterLaterality("all"); setFilterPosition(new Set()); setFilterStatus("all"); setFilterNat("all"); }}
                className="text-xs font-semibold underline" style={{ color: "var(--granate)" }}
              >
                {t("Limpiar filtros")}
              </button>
            )}
          </div>
        </div>
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
            {hasFilters ? t("Sin resultados con estos filtros") : t("No hay jugadores registrados")}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-400 uppercase tracking-wider select-none" style={{ fontFamily: "var(--font-display)" }}>
                   <th className="text-left px-4 py-2 font-bold cursor-pointer hover:text-gray-700" onClick={() => handleSort("name")}>{t("Jugador")}<SortIcon col="name" /></th>
                   <th className="text-center px-3 py-2 font-bold hidden sm:table-cell cursor-pointer hover:text-gray-700" onClick={() => handleSort("birth_date")}>{t("Año nac.")}<SortIcon col="birth_date" /></th>
                   <th className="text-center px-3 py-2 font-bold hidden md:table-cell cursor-pointer hover:text-gray-700" onClick={() => handleSort("nat")}>{t("Nac.")}<SortIcon col="nat" /></th>
                   <th className="text-left px-3 py-2 font-bold hidden md:table-cell cursor-pointer hover:text-gray-700" onClick={() => handleSort("team")}>{t("Equipo")}<SortIcon col="team" /></th>
                   <th className="text-center px-3 py-2 font-bold cursor-pointer hover:text-gray-700" onClick={() => handleSort("position")}>{t("Pos.")}<SortIcon col="position" /></th>
                   <th className="text-center px-3 py-2 font-bold hidden lg:table-cell cursor-pointer hover:text-gray-700" onClick={() => handleSort("laterality")}>{t("Lateralidad")}<SortIcon col="laterality" /></th>
                   <th className="text-center px-3 py-2 font-bold hidden sm:table-cell cursor-pointer hover:text-gray-700" onClick={() => handleSort("jersey_number")}>{t("Dorsal")}<SortIcon col="jersey_number" /></th>
                   <th className="text-center px-3 py-2 font-bold cursor-pointer hover:text-gray-700" onClick={() => handleSort("status")}>{t("Estado")}<SortIcon col="status" /></th>
                   <th className="px-3 py-2"></th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map(player => {
                  const team = teams.find(t => t.id === player.team_id);
                  const birthYear = birthYearOf(player);
                  return (
                    <tr key={player.id} className="hover:bg-gray-50 transition-colors">
                       <td className="px-4 py-1.5">
                         <div className="flex items-center gap-2">
                           <div className="w-8 h-8 shrink-0 rounded flex items-center justify-center overflow-hidden border border-gray-200" style={{ background: "var(--granate)" }}>
                             <PlayerAvatar player={player} />
                           </div>
                           <p className="font-bold text-gray-900 leading-tight" style={{ fontFamily: "var(--font-display)" }}><PlayerName player={player} /></p>
                         </div>
                       </td>
                      <td className="px-3 py-1.5 text-center hidden sm:table-cell font-black text-gray-600 text-sm" style={{ fontFamily: "var(--font-display)" }}>{birthYear || "—"}</td>
                      <td className="px-3 py-1.5 text-center hidden md:table-cell"><Flag player={player} /></td>
                      <td className="px-3 py-1.5 hidden md:table-cell text-xs text-gray-500">{team?.name || "—"}</td>
                      <td className="px-3 py-1.5 text-center">
                        {player.position ? (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full" style={{ background: "var(--granate-pale)", color: "var(--granate)", fontFamily: "var(--font-display)" }}>
                            {t(POSITION_LABELS[player.position] || player.position)}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-1.5 text-center hidden lg:table-cell text-xs text-gray-500 capitalize">{player.laterality || "—"}</td>
                      <td className="px-3 py-1.5 text-center hidden sm:table-cell font-black text-gray-600" style={{ fontFamily: "var(--font-display)" }}>{player.jersey_number || "—"}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          player.status === "activo" ? "bg-green-50 text-green-700 border-green-200" :
                          player.status === "lesionado" ? "bg-red-50 text-red-700 border-red-200" :
                          "bg-gray-100 text-gray-400 border-gray-200"
                        }`} style={{ fontFamily: "var(--font-display)" }}>{player.status || "activo"}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {perms.editPlayers && (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => { setEditingPlayer(player); setDialogOpen(true); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteId(player.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </>)}

      <AddPlayerDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingPlayer(null); }}
        teamId={editingPlayer?.team_id || ""}
        editingPlayer={editingPlayer}
      />

      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("¿Eliminar jugador?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Esta acción no se puede deshacer.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">{t("Eliminar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}