import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus, History } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { sortTeams } from "@/lib/teamOrder";
import { birthYearOf } from "@/lib/birthYear";
import { matchesPlayerSearch, playerFullName } from "@/lib/playerName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EmptyState from "@/components/common/EmptyState";

const short = (s) => { const [a, b] = String(s || "").split("-"); return b ? `${a.slice(2)}–${b.slice(2)}` : s || ""; };

// Histórico de jugadores: los que se fueron del club (bajas de un cierre de temporada o marcados como baja).
// Siguen en la base de datos con todo su historial; si vuelven, se reincorporan a un equipo.
export default function PlayerArchive({ players, teams }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("all");
  const [back, setBack] = useState(null); // jugador a reincorporar
  const [teamId, setTeamId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: archived = [], isLoading } = useQuery({ queryKey: ["players_archived"], queryFn: () => base44.entities.Player.archived({}, "only") });
  const { data: history = [] } = useQuery({ queryKey: ["player_season_history_all"], queryFn: () => base44.entities.PlayerSeasonHistory.list() });

  const sortedTeams = useMemo(() => sortTeams(teams), [teams]);
  const teamName = (id) => teams.find((t) => t.id === id)?.name || "";
  const list = useMemo(() => {
    const m = new Map();
    archived.forEach((p) => m.set(p.id, p));
    players.filter((p) => p.status === "baja").forEach((p) => { if (!m.has(p.id)) m.set(p.id, p); });
    return [...m.values()].sort((a, b) => playerFullName({ ...a, nickname: "" }).localeCompare(playerFullName({ ...b, nickname: "" }), "es"));
  }, [archived, players]);
  const years = useMemo(() => [...new Set(list.map(birthYearOf).filter(Boolean))].sort((a, b) => b - a), [list]);
  const seasonsOf = useMemo(() => {
    const m = new Map();
    history.forEach((h) => { if (!m.has(h.player_id)) m.set(h.player_id, []); m.get(h.player_id).push(h); });
    m.forEach((v) => v.sort((a, b) => String(b.season).localeCompare(String(a.season))));
    return m;
  }, [history]);

  const shown = list.filter((p) => (!search || matchesPlayerSearch(p, search)) && (year === "all" || String(birthYearOf(p)) === year));

  const reinstate = async () => {
    if (!back || !teamId) return;
    setSaving(true);
    try {
      await base44.entities.Player.update(back.id, { status: "activo", team_id: teamId, archived_season: "", last_team_id: null, prev_status: null });
      await Promise.all([qc.invalidateQueries({ queryKey: ["players"] }), qc.invalidateQueries({ queryKey: ["players_archived"] })]);
      setBack(null); setTeamId("");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Buscar en el histórico…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 border-gray-200 h-8" />
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[130px] border-gray-200 bg-white h-8 text-xs"><SelectValue placeholder="Año nac." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los años</SelectItem>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 ml-auto">{shown.length} jugador{shown.length !== 1 ? "es" : ""}</p>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-gray-400">Cargando…</p>
      ) : shown.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded">
          <EmptyState icon={History} title={list.length ? "Sin resultados" : "Todavía no hay jugadores en el histórico"}
            hint={list.length ? "" : 'Los jugadores que marques como baja al cerrar la temporada (o con estado "Baja") aparecerán aquí, con todo su historial.'} />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                  <th className="text-left px-4 py-2 font-bold">Jugador</th>
                  <th className="text-center px-3 py-2 font-bold hidden sm:table-cell">Año nac.</th>
                  <th className="text-left px-3 py-2 font-bold hidden md:table-cell">Último equipo</th>
                  <th className="text-left px-3 py-2 font-bold hidden lg:table-cell">Temporadas en el club</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {shown.map((p) => {
                  const hs = seasonsOf.get(p.id) || [];
                  const last = teamName(p.last_team_id) || hs[0]?.team_name || teamName(p.team_id) || "—";
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-1.5">
                        <Link to={`/PlayerProfile?id=${p.id}`} className="font-bold text-gray-900 hover:underline" style={{ fontFamily: "var(--font-display)" }}>{playerFullName(p)}</Link>
                        {p.archived_season && <span className="ml-2 text-[10px] font-semibold text-gray-400">baja {short(p.archived_season)}</span>}
                      </td>
                      <td className="px-3 py-1.5 text-center hidden sm:table-cell font-black text-gray-600" style={{ fontFamily: "var(--font-display)" }}>{birthYearOf(p) || "—"}</td>
                      <td className="px-3 py-1.5 hidden md:table-cell text-xs text-gray-500">{last}</td>
                      <td className="px-3 py-1.5 hidden lg:table-cell text-xs text-gray-500">
                        {hs.length ? hs.slice(0, 4).map((h) => `${short(h.season)} ${h.team_name || ""}`.trim()).join(" · ") + (hs.length > 4 ? " …" : "") : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Button size="sm" variant="clubOutline" className="gap-1" onClick={() => { setBack(p); setTeamId(""); }}><UserPlus className="w-3.5 h-3.5" /> Reincorporar</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!back} onOpenChange={(o) => { if (!o) setBack(null); }}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Reincorporar a {back ? playerFullName(back) : ""}</DialogTitle>
            <DialogDescription>Vuelve a la plantilla del equipo que elijas, con todo su historial.</DialogDescription>
          </DialogHeader>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="bg-white"><SelectValue placeholder="Elegir equipo…" /></SelectTrigger>
            <SelectContent>{sortedTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBack(null)}>Cancelar</Button>
            <Button variant="club" disabled={!teamId || saving} onClick={reinstate}>{saving ? "Guardando…" : "Reincorporar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
