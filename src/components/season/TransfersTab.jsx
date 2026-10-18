import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, UserMinus, Check, Undo2, Loader2, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { sortTeams } from "@/lib/teamOrder";
import { birthYearOf } from "@/lib/birthYear";
import { playerFullName } from "@/lib/playerName";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/common/EmptyState";
import { useSeasonPlan } from "./useSeasonPlan";

const POS = { portero: "POR", lateral: "LAT", central: "CTR", libre: "LIB", mediocentro: "MC", interior: "INT", delantero_centro: "DC", extremo: "EXT" };
const POS_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "extremo", "delantero_centro"];

// Traspasos de fin de temporada: se eligen jugadores de un equipo y se decide, a bloques, adónde van el año que viene.
export default function TransfersTab({ season, closed }) {
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { moves, saving, error, setDestination, clear, isLoading } = useSeasonPlan(season);

  const sortedTeams = useMemo(() => sortTeams(teams), [teams]);
  const teamName = (id) => teams.find((t) => t.id === id)?.name || "Equipo eliminado";
  const squad = useMemo(() => players.filter((p) => p.team_id && p.status !== "baja"), [players]);
  const byTeam = useMemo(() => {
    const m = new Map();
    squad.forEach((p) => { if (!m.has(p.team_id)) m.set(p.team_id, []); m.get(p.team_id).push(p); });
    return m;
  }, [squad]);

  const valid = (mv) => mv && (mv.to === "baja" || mv.to === "stay" || teams.some((t) => t.id === mv.to));
  const decided = (p) => valid(moves[p.id]);

  const [teamId, setTeamId] = useState("");
  const [sel, setSel] = useState(new Set());
  const [dest, setDest] = useState("");
  useEffect(() => {
    if (!teamId && sortedTeams.length) setTeamId((sortedTeams.find((t) => byTeam.get(t.id)?.length) || sortedTeams[0]).id);
  }, [sortedTeams, byTeam, teamId]);
  useEffect(() => { setSel(new Set()); setDest(""); }, [teamId]);

  const roster = useMemo(() => (byTeam.get(teamId) || []).slice().sort((a, b) => {
    const pa = POS_ORDER.indexOf(a.position), pb = POS_ORDER.indexOf(b.position);
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || (a.jersey_number ?? 999) - (b.jersey_number ?? 999) || playerFullName(a).localeCompare(playerFullName(b), "es");
  }), [byTeam, teamId]);

  // Resumen de todo el club
  const totalDecided = squad.filter(decided).length;
  const tally = useMemo(() => {
    const t = new Map();
    squad.filter(decided).forEach((p) => t.set(moves[p.id].to, (t.get(moves[p.id].to) || 0) + 1));
    return t;
  }, [squad, moves, teams]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const ids = [...sel];
  const apply = (to) => { if (!ids.length) return; setDestination(ids, to); setSel(new Set()); };

  const badge = (p) => {
    const mv = moves[p.id];
    if (!valid(mv)) return <span className="text-[11px] text-gray-300">Sin decidir</span>;
    if (mv.to === "baja") return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">Baja</span>;
    if (mv.to === "stay") return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">Se queda</span>;
    return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border" style={{ background: "var(--granate-pale)", color: "var(--granate)", borderColor: "var(--granate)" }}>→ {teamName(mv.to)}</span>;
  };

  if (isLoading) return <p className="py-10 text-center text-sm text-gray-400">Cargando…</p>;

  return (
    <div className="space-y-3">
      {closed && (
        <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-sm text-gray-600" style={{ borderRadius: "6px", borderLeft: "4px solid var(--granate)" }}>
          <Lock className="w-4 h-4 shrink-0 text-gray-400" /> Esta temporada ya está cerrada: los traspasos se aplicaron. Para cambiarlos, reabre la temporada en la pestaña "Nueva temporada".
        </div>
      )}

      {/* Resumen del club */}
      <div className="bg-white border border-gray-200 shadow-sm px-4 py-3 space-y-2" style={{ borderRadius: "4px" }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-sm text-gray-700">
            <span className="text-2xl font-black align-middle mr-1" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{totalDecided}</span>
            de {squad.length} jugadores con destino decidido
          </p>
          <div className="flex-1 min-w-[120px] h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${squad.length ? (totalDecided / squad.length) * 100 : 0}%`, background: "var(--granate)" }} />
          </div>
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            {saving ? <><Loader2 className="w-3 h-3 animate-spin" /> Guardando…</> : <><Check className="w-3 h-3 text-green-600" /> Guardado</>}
          </span>
        </div>
        {tally.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...tally.entries()]
              .sort((a, b) => (a[0] === "baja") - (b[0] === "baja") || (a[0] === "stay") - (b[0] === "stay") || sortedTeams.findIndex((t) => t.id === a[0]) - sortedTeams.findIndex((t) => t.id === b[0]))
              .map(([to, n]) => (
                <span key={to} className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-50 border border-gray-200 text-gray-700">
                  {to === "baja" ? "Bajas" : to === "stay" ? "Se quedan en su equipo" : `→ ${teamName(to)}`} · <b>{n}</b>
                </span>
              ))}
          </div>
        )}
        <p className="text-[11px] text-gray-400">Los jugadores sin decidir se quedan en su equipo actual al cerrar la temporada. Nada se aplica hasta que pulses "Nueva temporada".</p>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-3 items-start">
        {/* Equipos */}
        <div className="bg-white border border-gray-200 shadow-sm p-1.5 flex flex-wrap lg:flex-col gap-1 lg:max-h-[70vh] overflow-y-auto" style={{ borderRadius: "4px" }}>
          {sortedTeams.filter((t) => byTeam.get(t.id)?.length).map((t) => {
            const list = byTeam.get(t.id);
            const done = list.filter(decided).length;
            const active = t.id === teamId;
            return (
              <button key={t.id} type="button" onClick={() => setTeamId(t.id)}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-left text-xs font-bold transition-colors ${active ? "text-white" : "text-gray-700 hover:bg-gray-100"}`}
                style={active ? { background: "var(--granate)" } : undefined}>
                <span className="truncate">{t.name}</span>
                <span className={`shrink-0 text-[10px] font-bold rounded-full px-1.5 py-0.5 ${active ? "bg-white/90 text-[var(--granate)]" : done === list.length ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{done}/{list.length}</span>
              </button>
            );
          })}
        </div>

        {/* Plantilla del equipo elegido */}
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
          <div className="px-4 py-2.5 border-b border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{teamName(teamId)} <span className="text-gray-400 font-bold">({roster.length})</span></h2>
            <div className="ml-auto flex items-center gap-3 text-[11px] font-semibold text-gray-500">
              <button type="button" className="hover:text-gray-900 hover:underline" onClick={() => setSel(new Set(roster.map((p) => p.id)))}>Todos</button>
              <button type="button" className="hover:text-gray-900 hover:underline" onClick={() => setSel(new Set(roster.filter((p) => !decided(p)).map((p) => p.id)))}>Sin decidir</button>
              <button type="button" className="hover:text-gray-900 hover:underline" onClick={() => setSel(new Set())}>Ninguno</button>
            </div>
          </div>

          {/* Acciones sobre los seleccionados */}
          <div className={`px-4 py-2 border-b border-gray-100 flex flex-wrap items-center gap-2 ${ids.length ? "bg-[var(--granate-pale)]" : "bg-gray-50"}`}>
            <span className="text-xs font-bold text-gray-700 mr-1">{ids.length ? `${ids.length} seleccionado${ids.length !== 1 ? "s" : ""}` : "Selecciona jugadores para decidir su destino"}</span>
            {ids.length > 0 && !closed && (
              <>
                <Select value={dest} onValueChange={setDest}>
                  <SelectTrigger className="h-8 w-44 text-xs bg-white"><SelectValue placeholder="Pasan al equipo…" /></SelectTrigger>
                  <SelectContent>{sortedTeams.filter((t) => t.id !== teamId).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="club" disabled={!dest} onClick={() => { apply(dest); setDest(""); }} className="gap-1"><ArrowRight className="w-3.5 h-3.5" /> Pasan</Button>
                <Button size="sm" variant="outline" onClick={() => apply("stay")} className="gap-1">Se quedan</Button>
                <Button size="sm" variant="outline" onClick={() => apply("baja")} className="gap-1 text-red-700 border-red-200 hover:bg-red-50"><UserMinus className="w-3.5 h-3.5" /> Baja</Button>
                <Button size="sm" variant="ghost" onClick={() => { clear(ids); setSel(new Set()); }} className="gap-1 text-gray-500"><Undo2 className="w-3.5 h-3.5" /> Quitar decisión</Button>
              </>
            )}
          </div>

          {roster.length === 0 ? <EmptyState title="Este equipo no tiene jugadores" /> : (
            <div className="divide-y divide-gray-100">
              {roster.map((p) => {
                const on = sel.has(p.id);
                return (
                  <label key={p.id} className={`flex items-center gap-3 px-4 py-1.5 cursor-pointer text-sm ${on ? "bg-[var(--granate-pale)]/60" : "hover:bg-gray-50"}`}>
                    <Checkbox checked={on} onCheckedChange={() => toggle(p.id)} disabled={closed} />
                    <span className="w-6 text-center text-[11px] font-bold text-gray-400">{p.jersey_number ?? ""}</span>
                    <span className="flex-1 min-w-0 truncate font-semibold text-gray-900">{playerFullName(p)}</span>
                    <span className="hidden sm:inline text-[11px] text-gray-400 w-10 text-center">{birthYearOf(p) || ""}</span>
                    <span className="hidden sm:inline text-[10px] font-bold text-gray-400 w-8 text-center">{POS[p.position] || ""}</span>
                    <span className="w-36 text-right">{badge(p)}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
