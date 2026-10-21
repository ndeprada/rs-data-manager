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
import ProjectedSquad, { POS, POS_ORDER } from "./ProjectedSquad";
import { useT } from "@/i18n";


// Traspasos de fin de temporada: se eligen jugadores de un equipo y se decide, a bloques, adónde van el año que viene.
export default function TransfersTab({ season, closed }) {
  const t = useT();
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { moves, saving, error, setDestination, clear, isLoading } = useSeasonPlan(season);

  const sortedTeams = useMemo(() => sortTeams(teams), [teams]);
  const teamName = (id) => teams.find((tm) => tm.id === id)?.name || t("Equipo eliminado");
  const squad = useMemo(() => players.filter((p) => p.team_id && p.status !== "baja"), [players]);
  const byTeam = useMemo(() => {
    const m = new Map();
    squad.forEach((p) => { if (!m.has(p.team_id)) m.set(p.team_id, []); m.get(p.team_id).push(p); });
    return m;
  }, [squad]);

  const valid = (mv) => mv && (mv.to === "baja" || mv.to === "stay" || teams.some((t) => t.id === mv.to));
  const decided = (p) => valid(moves[p.id]);

  const [view, setView] = useState("decidir"); // decidir | prevista
  const showPlan = view === "prevista" && !closed;
  const nextLabel = `${Number(season.slice(0, 4)) + 1}–${Number(season.slice(0, 4)) + 2}`;
  // Plantilla prevista de cada equipo según los destinos ya decididos (los sin decidir continúan donde están)
  const projected = useMemo(() => {
    const m = new Map(teams.map((t) => [t.id, { stay: [], undecided: [], arrive: [], leave: [] }]));
    squad.forEach((p) => {
      const cur = m.get(p.team_id);
      if (!cur) return;
      const mv = valid(moves[p.id]) ? moves[p.id] : null;
      if (!mv) { cur.stay.push(p); cur.undecided.push(p); }
      else if (mv.to === "stay" || mv.to === p.team_id) cur.stay.push(p);
      else { cur.leave.push({ p, to: mv.to }); if (mv.to !== "baja") m.get(mv.to)?.arrive.push(p); }
    });
    return m;
  }, [squad, moves, teams]);
  const projSize = (id) => { const e = projected.get(id); return e ? e.stay.length + e.arrive.length : 0; };
  const projTouches = (id) => { const e = projected.get(id); return !!e && e.stay.length + e.arrive.length + e.leave.length > 0; };

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
    if (!valid(mv)) return <span className="text-[11px] text-gray-300">{t("Sin decidir")}</span>;
    if (mv.to === "baja") return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">{t("Baja")}</span>;
    if (mv.to === "stay") return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">{t("Se queda")}</span>;
    return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border" style={{ background: "var(--granate-pale)", color: "var(--granate)", borderColor: "var(--granate)" }}>→ {teamName(mv.to)}</span>;
  };

  if (isLoading) return <p className="py-10 text-center text-sm text-gray-400">{t("Cargando…")}</p>;

  return (
    <div className="space-y-3">
      {closed && (
        <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-sm text-gray-600" style={{ borderRadius: "6px", borderLeft: "4px solid var(--granate)" }}>
          <Lock className="w-4 h-4 shrink-0 text-gray-400" /> {t("Esta temporada ya está cerrada: los traspasos se aplicaron. Para cambiarlos, reabre la temporada en la pestaña \"Nueva temporada\".")}
        </div>
      )}

      {/* Resumen del club */}
      <div className="bg-white border border-gray-200 shadow-sm px-4 py-3 space-y-2" style={{ borderRadius: "4px" }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-sm text-gray-700">
            <span className="text-2xl font-black align-middle mr-1" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{totalDecided}</span>
            {t("de {length} jugadores con destino decidido", { length: squad.length })}
          </p>
          <div className="flex-1 min-w-[120px] h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${squad.length ? (totalDecided / squad.length) * 100 : 0}%`, background: "var(--granate)" }} />
          </div>
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            {saving ? <><Loader2 className="w-3 h-3 animate-spin" /> {t("Guardando…")}</> : <><Check className="w-3 h-3 text-green-600" /> {t("Guardado")}</>}
          </span>
        </div>
        {tally.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...tally.entries()]
              .sort((a, b) => (a[0] === "baja") - (b[0] === "baja") || (a[0] === "stay") - (b[0] === "stay") || sortedTeams.findIndex((t) => t.id === a[0]) - sortedTeams.findIndex((t) => t.id === b[0]))
              .map(([to, n]) => (
                <span key={to} className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-50 border border-gray-200 text-gray-700">
                  {to === "baja" ? t("Bajas") : to === "stay" ? t("Se quedan en su equipo") : `→ ${teamName(to)}`} · <b>{n}</b>
                </span>
              ))}
          </div>
        )}
        <p className="text-[11px] text-gray-400">{t("Los jugadores sin decidir se quedan en su equipo actual al cerrar la temporada. Nada se aplica hasta que pulses \"Nueva temporada\".")}</p>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      </div>

      {!closed && (
        <div className="inline-flex border border-gray-200 rounded p-0.5 bg-white">
          {[["decidir", t("Decidir destinos")], ["prevista", t("Plantilla prevista {nextLabel}", { nextLabel })]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${view === v ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-700"}`}>{l}</button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-3 items-start">
        {/* Equipos */}
        <div className="bg-white border border-gray-200 shadow-sm p-1.5 flex flex-wrap lg:flex-col gap-1 lg:max-h-[70vh] overflow-y-auto" style={{ borderRadius: "4px" }}>
          {sortedTeams.filter((t) => (showPlan ? projTouches(t.id) : byTeam.get(t.id)?.length)).map((t) => {
            const list = byTeam.get(t.id) || [];
            const done = list.filter(decided).length;
            const active = t.id === teamId;
            return (
              <button key={t.id} type="button" onClick={() => setTeamId(t.id)}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-left text-xs font-bold transition-colors ${active ? "text-white" : "text-gray-700 hover:bg-gray-100"}`}
                style={active ? { background: "var(--granate)" } : undefined}>
                <span className="truncate">{t.name}</span>
                <span className={`shrink-0 text-[10px] font-bold rounded-full px-1.5 py-0.5 ${active ? "bg-white/90 text-[var(--granate)]" : showPlan ? "bg-gray-100 text-gray-600" : done === list.length ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{showPlan ? `${list.length}→${projSize(t.id)}` : `${done}/${list.length}`}</span>
              </button>
            );
          })}
        </div>

        {showPlan && projected.get(teamId) && (
          <ProjectedSquad title={teamName(teamId)} nextLabel={nextLabel} entry={projected.get(teamId)} teamName={teamName} />
        )}

        {/* Plantilla del equipo elegido */}
        {!showPlan && <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
          <div className="px-4 py-2.5 border-b border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{teamName(teamId)} <span className="text-gray-400 font-bold">({roster.length})</span></h2>
            <div className="ml-auto flex items-center gap-3 text-[11px] font-semibold text-gray-500">
              <button type="button" className="hover:text-gray-900 hover:underline" onClick={() => setSel(new Set(roster.map((p) => p.id)))}>{t("Todos")}</button>
              <button type="button" className="hover:text-gray-900 hover:underline" onClick={() => setSel(new Set(roster.filter((p) => !decided(p)).map((p) => p.id)))}>{t("Sin decidir")}</button>
              <button type="button" className="hover:text-gray-900 hover:underline" onClick={() => setSel(new Set())}>{t("Ninguno")}</button>
            </div>
          </div>

          {/* Acciones sobre los seleccionados */}
          <div className={`px-4 py-2 border-b border-gray-100 flex flex-wrap items-center gap-2 ${ids.length ? "bg-[var(--granate-pale)]" : "bg-gray-50"}`}>
            <span className="text-xs font-bold text-gray-700 mr-1">{ids.length ? (ids.length === 1 ? t("{length} seleccionado", { length: 1 }) : t("{length} seleccionados", { length: ids.length })) : t("Selecciona jugadores para decidir su destino")}</span>
            {ids.length > 0 && !closed && (
              <>
                <Select value={dest} onValueChange={setDest}>
                  <SelectTrigger className="h-8 w-44 text-xs bg-white"><SelectValue placeholder={t("Pasan al equipo…")} /></SelectTrigger>
                  <SelectContent>{sortedTeams.filter((t) => t.id !== teamId).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="club" disabled={!dest} onClick={() => { apply(dest); setDest(""); }} className="gap-1"><ArrowRight className="w-3.5 h-3.5" /> {t("Pasan")}</Button>
                <Button size="sm" variant="outline" onClick={() => apply("stay")} className="gap-1">{t("Se quedan")}</Button>
                <Button size="sm" variant="outline" onClick={() => apply("baja")} className="gap-1 text-red-700 border-red-200 hover:bg-red-50"><UserMinus className="w-3.5 h-3.5" /> {t("Baja")}</Button>
                <Button size="sm" variant="ghost" onClick={() => { clear(ids); setSel(new Set()); }} className="gap-1 text-gray-500"><Undo2 className="w-3.5 h-3.5" /> {t("Quitar decisión")}</Button>
              </>
            )}
          </div>

          {roster.length === 0 ? <EmptyState title={t("Este equipo no tiene jugadores")} /> : (
            <div className="divide-y divide-gray-100">
              {roster.map((p) => {
                const on = sel.has(p.id);
                return (
                  <label key={p.id} className={`flex items-center gap-3 px-4 py-1.5 cursor-pointer text-sm ${on ? "bg-[var(--granate-pale)]/60" : "hover:bg-gray-50"}`}>
                    <Checkbox checked={on} onCheckedChange={() => toggle(p.id)} disabled={closed} />
                    <span className="w-6 text-center text-[11px] font-bold text-gray-400">{p.jersey_number ?? ""}</span>
                    <span className="flex-1 min-w-0 truncate font-semibold text-gray-900">{playerFullName(p)}</span>
                    <span className="hidden sm:inline text-[11px] text-gray-400 w-10 text-center">{birthYearOf(p) || ""}</span>
                    <span className="hidden sm:inline text-[10px] font-bold text-gray-400 w-8 text-center">{POS[p.position] ? t(POS[p.position]) : ""}</span>
                    <span className="w-36 text-right">{badge(p)}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}
