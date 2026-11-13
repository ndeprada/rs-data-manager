import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Lock, AlertTriangle, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { sortTeams } from "@/lib/teamOrder";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { birthYearOf } from "@/lib/birthYear";
import { playerFullName } from "@/lib/playerName";
import { usePlayerRows } from "@/lib/usePlayerRows";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import { buildPassSummary } from "@/lib/squadPlan";
import { RS, YearBadge } from "@/components/rs2/kit";
import { Head } from "@/components/rs2/dashParts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  proposalsFor, projectTeam, lineCounts, yearCounts, squadWarnings, moveFlows, transferKpis, planToMoves,
  validMove, nextSeasonOf, shortSeason, LINES,
} from "@/lib/seasonView";
import { useSeasonPlan } from "./useSeasonPlan";
import { useT, msg } from "@/i18n";

export const POS = { portero: "POR", lateral: "LAT", central: "CTR", libre: "LIB", mediocentro: "MC", interior: "INT", mediapunta: "MP", delantero_centro: "DC", extremo: "EXT" };
const POS_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "mediapunta", "extremo", "delantero_centro"];
const posRank = (p) => { const i = POS_ORDER.indexOf(p.position); return i < 0 ? 99 : i; };
const byPos = (a, b) => posRank(a) - posRank(b) || (a.jersey_number ?? 999) - (b.jersey_number ?? 999) || playerFullName(a).localeCompare(playerFullName(b), "es");
const OK = "#15803D", WARN = "#B45309", NO = "#B91C1C";
const btn = (primary, extra = {}) => ({
  border: primary ? "none" : `1px solid ${RS.input}`, background: primary ? RS.granate : "#fff", color: primary ? "#fff" : RS.ink2,
  borderRadius: 8, padding: "5px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", ...extra,
});
const chip = (bg, fg) => ({ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap", display: "inline-block" });
const card = { background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 12 };
const TH = { fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: RS.muted, padding: "6px 8px", textAlign: "left" };
const LINE_LABEL = { POR: msg("POR"), DEF: msg("DEF"), MED: msg("MED"), DEL: msg("DEL") };

function Kpi({ n, label, sub, color, testId }) {
  return (
    <div data-testid={testId} style={{ flex: "1 1 150px", display: "flex", alignItems: "baseline", gap: 8, padding: "8px 12px", ...card, borderRadius: 10 }}>
      <span className="rs2-display tabular-nums" style={{ fontSize: 24, color: color || RS.granateDark, whiteSpace: "nowrap" }}>{n}</span>
      <span style={{ fontSize: 12, color: RS.ink2, lineHeight: 1.15 }}>{label}{sub && <span style={{ display: "block", fontSize: 11, color: RS.muted }}>{sub}</span>}</span>
    </div>
  );
}

function Banner({ title, text, action, accent, testId }) {
  return (
    <div data-testid={testId} style={{ flex: "1 1 420px", display: "flex", gap: 10, alignItems: "center", padding: "9px 14px", ...card, borderLeft: `4px solid ${accent}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 13, color: RS.ink }}>{title}</b>
        <div style={{ fontSize: 12, color: RS.muted }}>{text}</div>
      </div>
      {action}
    </div>
  );
}

// Ventana para confirmar un cambio de muchos destinos a la vez (propuesta por año o lo de Planificación)
function ConfirmMany({ open, title, lines, note, okLabel, onOk, onClose, testId }) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-white max-w-lg max-h-[85vh] overflow-y-auto" data-testid={testId}>
        <DialogHeader><DialogTitle style={{ color: RS.ink }}>{title}</DialogTitle></DialogHeader>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 13 }}>
          {lines.map((l) => (
            <li key={l.key} className="flex" style={{ gap: 8, padding: "4px 0", borderBottom: `1px solid ${RS.lineSoft}` }}>
              <span style={{ flex: 1 }}>{l.label}</span><b className="tabular-nums">{l.n}</b>
            </li>
          ))}
        </ul>
        {note && <p style={{ margin: 0, fontSize: 12, color: RS.muted }}>{note}</p>}
        <div className="flex justify-end" style={{ gap: 8 }}>
          <button type="button" onClick={onClose} style={btn(false)}>{t("Cancelar")}</button>
          <button type="button" onClick={() => { onOk(); onClose(); }} style={btn(true)} data-testid={`${testId}-ok`}>{okLabel}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Traspasos de fin de temporada: a qué equipo va cada jugador el año que viene. Nada se aplica hasta cerrar la temporada.
export default function TransfersTab({ season, closed }) {
  const t = useT();
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const next = nextSeasonOf(season);
  const { data: planEntries = [] } = useQuery({ queryKey: ["squad-plan-season", next], queryFn: () => base44.entities.SquadPlanEntry.filter({ season: next }), enabled: !closed });
  const { moves, saving, error, setDestination, setMany, clear, isLoading } = useSeasonPlan(season);
  const rows = usePlayerRows(players, teams, null);
  const statsBy = useMemo(() => new Map(rows.map((r) => [r.p.id, r])), [rows]);

  const sortedTeams = useMemo(() => sortTeams(teams), [teams]);
  const teamIds = useMemo(() => new Set(teams.map((x) => x.id)), [teams]);
  const teamName = (id) => teams.find((x) => x.id === id)?.name || t("Equipo eliminado");
  const squad = useMemo(() => players.filter((p) => p.team_id && p.status !== "baja"), [players]);
  const byTeam = useMemo(() => {
    const m = new Map();
    squad.forEach((p) => { if (!m.has(p.team_id)) m.set(p.team_id, []); m.get(p.team_id).push(p); });
    return m;
  }, [squad]);
  const decided = (p) => validMove(moves[p.id], teamIds);
  const proposals = useMemo(() => proposalsFor(squad, sortedTeams), [squad, sortedTeams]);
  const kpis = useMemo(() => transferKpis(squad, moves, teamIds), [squad, moves, teamIds]);
  const flows = useMemo(() => moveFlows(squad, moves, teamIds), [squad, moves, teamIds]);
  const fromPlan = useMemo(() => planToMoves(planEntries, players, moves, teamIds), [planEntries, players, moves, teamIds]);

  const [teamId, setTeamId] = useState("");
  const [sel, setSel] = useState(new Set());
  const [dest, setDest] = useState("");
  const [view, setView] = useState("decide"); // decide | projected
  const [confirm, setConfirm] = useState(null); // "proposals" | "plan"
  const [flowsOpen, setFlowsOpen] = useState(false);
  useEffect(() => {
    if (!teamId && sortedTeams.length) setTeamId((sortedTeams.find((x) => byTeam.get(x.id)?.length) || sortedTeams[0]).id);
  }, [sortedTeams, byTeam, teamId]);
  useEffect(() => { setSel(new Set()); setDest(""); }, [teamId]);

  const roster = useMemo(() => (byTeam.get(teamId) || []).slice().sort(byPos), [byTeam, teamId]);
  const proj = useMemo(() => projectTeam(teamId, squad, moves, teamIds), [teamId, squad, moves, teamIds]);
  const projList = useMemo(() => [...proj.stay, ...proj.arrive].sort(byPos), [proj]);
  const team = teams.find((x) => x.id === teamId);
  const warnings = squadWarnings(projList, { f7: teamPlaysF7(team) });
  const lines = lineCounts(projList);
  const years = yearCounts(projList);
  const arriveFrom = useMemo(() => {
    const m = new Map();
    proj.arrive.forEach((p) => m.set(p.team_id, (m.get(p.team_id) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [proj]);

  // Propuestas por año pendientes (solo de los que no tienen destino)
  const pendingProposals = useMemo(() => squad.filter((p) => !decided(p) && proposals.has(p.id)), [squad, proposals, moves, teamIds]);
  const groupBy = (list, toOf) => {
    const m = new Map();
    list.forEach((p) => { const to = toOf(p); if (!m.has(to)) m.set(to, []); m.get(to).push(p.id); });
    return m;
  };
  const destLabel = (to) => (to === "stay" ? t("Se quedan en su equipo") : to === "baja" ? t("Bajas") : `→ ${teamName(to)}`);
  const applyGroups = (groups) => setMany([...groups.entries()].map(([to, ids]) => [ids, to]));

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const ids = [...sel];
  const apply = (to) => { if (!ids.length) return; setDestination(ids, to); setSel(new Set()); };
  const acceptSelected = () => {
    applyGroups(groupBy(roster.filter((p) => sel.has(p.id) && proposals.has(p.id)), (p) => proposals.get(p.id)));
    setSel(new Set());
  };

  const destChip = (p) => {
    const mv = moves[p.id];
    if (!validMove(mv, teamIds)) return <span style={{ fontSize: 11, color: "#C9BEBF" }}>{t("Sin decidir")}</span>;
    if (mv.to === "baja") return <span style={chip("#FEE2E2", "#991B1B")}>{t("Baja")}</span>;
    if (mv.to === "stay" || mv.to === p.team_id) return <span style={chip(RS.soft, RS.ink2)}>{t("Se queda")}</span>;
    return <span style={chip("#FDF2F4", RS.granate)}>→ {teamName(mv.to)}</span>;
  };
  const proposalText = (p) => {
    const to = proposals.get(p.id);
    if (!to) return "—";
    if (to === "stay") return t("Sigue en {team}", { team: teamName(p.team_id) });
    return t("Sube a {team}", { team: teamName(to) });
  };
  const pct = (v, warn, bad) => (v == null ? <span style={{ color: RS.faint }}>—</span> : <span style={{ color: v < bad ? NO : v < warn ? WARN : RS.ink, fontWeight: v < warn ? 700 : 400 }}>{v} %</span>);

  const downloadFlows = async () => {
    const entries = squad.filter((p) => { const mv = moves[p.id]; return validMove(mv, teamIds) && mv.to !== "stay" && mv.to !== "baja" && mv.to !== p.team_id; })
      .map((p) => ({ kind: "player", ref_id: p.id, team_id: p.team_id, to_team_id: moves[p.id].to, status: "continua" }));
    const summary = buildPassSummary({ entries, players, teams: sortedTeams });
    const { downloadClubPassesPDF } = await import("@/lib/squadPassesPdf");
    await downloadClubPassesPDF({ season: shortSeason(next), summary, logoUrl: CLUB_LOGO_URL, kicker: "TRASPASOS DE FIN DE TEMPORADA", title: "Movimientos del club", file: "Movimientos_del_club" });
  };

  if (isLoading) return <p style={{ padding: 40, textAlign: "center", fontSize: 13, color: RS.faint }}>{t("Cargando…")}</p>;

  const groups = [
    { key: "f11", label: t("Fútbol 11"), list: sortedTeams.filter((x) => !teamPlaysF7(x) && byTeam.get(x.id)?.length) },
    { key: "f7", label: t("Fútbol 7"), list: sortedTeams.filter((x) => teamPlaysF7(x) && byTeam.get(x.id)?.length) },
  ].filter((g) => g.list.length);

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      {closed && (
        <div className="flex items-center" style={{ gap: 8, padding: "9px 14px", ...card, borderLeft: `4px solid ${RS.granate}`, fontSize: 13, color: RS.ink2 }}>
          <Lock className="w-4 h-4" style={{ color: RS.faint }} /> {t("Esta temporada ya está cerrada: los traspasos ya se aplicaron. Para cambiarlos, reábrela en «Cierre de temporada».")}
        </div>
      )}

      <div className="flex flex-wrap" style={{ gap: 8 }} data-testid="season-kpis">
        <Kpi testId="season-kpi-decided" n={`${kpis.decided}/${kpis.total}`} label={t("con destino")}
          sub={<>{kpis.total ? Math.round((kpis.decided / kpis.total) * 100) : 0} % · {saving ? <><Loader2 className="inline w-3 h-3 animate-spin" /> {t("Guardando…")}</> : <><Check className="inline w-3 h-3" style={{ color: OK }} /> {t("Guardado")}</>}</>} />
        <Kpi testId="season-kpi-stay" n={kpis.stay} label={t("se quedan")} sub={t("en su equipo")} />
        <Kpi testId="season-kpi-change" n={kpis.change} label={t("cambian de equipo")} sub={flows.length ? t("{n} movimientos entre equipos", { n: flows.length }) : null} />
        <Kpi testId="season-kpi-baja" n={kpis.baja} label={t("bajas")} color={kpis.baja ? NO : undefined} />
        <Kpi testId="season-kpi-undecided" n={kpis.undecided} label={t("sin decidir")} sub={t("se quedarían donde están")} color={kpis.undecided ? WARN : undefined} />
      </div>
      {error && <p style={{ margin: 0, fontSize: 12.5, color: NO, fontWeight: 600 }}>{error}</p>}

      {!closed && (pendingProposals.length > 0 || fromPlan.passes + fromPlan.bajas > 0) && (
        <div className="flex flex-wrap" style={{ gap: 10 }}>
          {pendingProposals.length > 0 && (
            <Banner testId="season-proposals" accent={RS.naranja} title={t("Propuesta por año de nacimiento")}
              text={t("Cada jugador va al equipo que el año que viene es de su categoría. {n} propuestas para jugadores sin decidir.", { n: pendingProposals.length })}
              action={<button type="button" onClick={() => setConfirm("proposals")} style={btn(true)} data-testid="season-proposals-open">{t("Ver y aceptar")}</button>} />
          )}
          {fromPlan.passes + fromPlan.bajas > 0 && (
            <Banner testId="season-plan" accent={RS.granate} title={t("Traer lo decidido en Planificación {s}", { s: shortSeason(next) })}
              text={t("{p} pases y {b} bajas anotados en los campogramas para jugadores sin decidir.", { p: fromPlan.passes, b: fromPlan.bajas })}
              action={<button type="button" onClick={() => setConfirm("plan")} style={btn(false)} data-testid="season-plan-open">{t("Traer al plan")}</button>} />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)_290px] items-start" style={{ gap: 12 }}>
        {/* Equipos */}
        <section style={{ ...card, padding: "8px 6px" }} data-testid="season-teams">
          {groups.map((g) => (
            <div key={g.key}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: RS.muted, padding: "6px 10px 2px", textTransform: "uppercase" }}>{g.label}</div>
              {g.list.map((x) => {
                const list = byTeam.get(x.id) || [];
                const done = list.filter(decided).length;
                const p = list.length ? Math.round((done / list.length) * 100) : 0;
                const c = done === list.length ? OK : p >= 50 ? WARN : "#C9BEBF";
                const pr = projectTeam(x.id, squad, moves, teamIds);
                const nx = pr.stay.length + pr.arrive.length;
                const on = x.id === teamId;
                return (
                  <button key={x.id} type="button" onClick={() => setTeamId(x.id)} data-testid={`season-team-${x.id}`}
                    className="w-full flex items-center text-left" style={{ gap: 8, padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer", background: on ? RS.granate : "transparent", color: on ? "#fff" : RS.ink }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.name}</span>
                    <span style={{ width: 32, height: 4, borderRadius: 9, background: on ? "rgba(255,255,255,.3)" : "#F1ECEC", overflow: "hidden", flex: "none" }}>
                      <span style={{ display: "block", width: `${p}%`, height: "100%", background: on ? "#fff" : c }} />
                    </span>
                    <span className="tabular-nums" style={{ fontSize: 11, width: 36, textAlign: "right", color: on ? "#fff" : RS.muted }}>{done}/{list.length}</span>
                    <span className="tabular-nums" style={{ fontSize: 11, width: 44, textAlign: "right", fontWeight: 700, color: on ? "#fff" : RS.ink2 }} title={t("Jugadores ahora → previstos en {s}", { s: shortSeason(next) })}>{list.length}→{nx}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <div style={{ padding: "6px 10px", fontSize: 10.5, color: RS.muted }}>{t("decididos · ahora→{s}", { s: shortSeason(next) })}</div>
        </section>

        {/* Plantilla del equipo elegido */}
        <section style={{ ...card, overflow: "hidden" }} data-testid="season-roster">
          <Head title={`${team?.name || ""} · ${view === "projected" ? t("previsto {s}", { s: shortSeason(next) }) : t("{n} jugadores", { n: roster.length })}`}
            right={<span className="inline-flex" style={{ gap: 4, background: RS.soft, borderRadius: 999, padding: 3 }}>
              {[["decide", t("Decidir destinos")], ["projected", t("Plantilla prevista")]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setView(k)} data-testid={`season-view-${k}`}
                  style={{ border: "none", borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: view === k ? 700 : 500, background: view === k ? "#fff" : "transparent", color: view === k ? RS.granate : RS.ink2 }}>{l}</button>
              ))}
            </span>} />

          {view === "decide" ? (
            <>
              {!closed && (
                <div className="flex flex-wrap items-center" style={{ gap: 8, padding: "8px 12px", background: ids.length ? "#FDF2F4" : "#FBF8F8", borderBottom: `1px solid ${RS.line}` }} data-testid="season-actions">
                  <b style={{ fontSize: 12.5 }}>{ids.length ? (ids.length === 1 ? t("{length} seleccionado", { length: 1 }) : t("{length} seleccionados", { length: ids.length })) : t("Selecciona jugadores para decidir su destino")}</b>
                  {ids.length > 0 && (
                    <>
                      <select value={dest} onChange={(e) => setDest(e.target.value)} data-testid="season-dest" aria-label={t("Pasan al equipo…")}
                        style={{ fontSize: 12.5, padding: "5px 8px", borderRadius: 8, border: `1px solid ${RS.input}`, background: "#fff", maxWidth: 180 }}>
                        <option value="">{t("Pasan al equipo…")}</option>
                        {sortedTeams.filter((x) => x.id !== teamId).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                      <button type="button" disabled={!dest} onClick={() => { apply(dest); setDest(""); }} style={btn(true, { opacity: dest ? 1 : 0.45 })} data-testid="season-apply-dest"><ArrowRight className="inline w-3.5 h-3.5" /> {t("Pasan")}</button>
                      <button type="button" onClick={() => apply("stay")} style={btn(false)} data-testid="season-apply-stay">{t("Se quedan")}</button>
                      <button type="button" onClick={() => apply("baja")} style={btn(false, { color: NO })} data-testid="season-apply-baja">{t("Baja")}</button>
                      {roster.some((p) => sel.has(p.id) && proposals.has(p.id)) && <button type="button" onClick={acceptSelected} style={btn(false)} data-testid="season-apply-proposal">{t("Aceptar la propuesta")}</button>}
                      <button type="button" onClick={() => { clear(ids); setSel(new Set()); }} style={btn(false, { color: RS.muted, fontWeight: 500 })} data-testid="season-apply-clear">{t("Quitar decisión")}</button>
                    </>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 11.5, color: RS.muted, gap: 4 }} className="inline-flex items-center">
                    <button type="button" onClick={() => setSel(new Set(roster.map((p) => p.id)))} style={{ background: "none", border: "none", color: RS.granate, fontWeight: 600 }} data-testid="season-sel-all">{t("Todos")}</button>·
                    <button type="button" onClick={() => setSel(new Set(roster.filter((p) => !decided(p)).map((p) => p.id)))} style={{ background: "none", border: "none", color: RS.granate, fontWeight: 600 }} data-testid="season-sel-undecided">{t("Sin decidir")}</button>·
                    <button type="button" onClick={() => setSel(new Set())} style={{ background: "none", border: "none", color: RS.granate, fontWeight: 600 }}>{t("Ninguno")}</button>
                  </span>
                </div>
              )}
              {roster.length === 0 ? <p style={{ padding: 14, margin: 0, fontSize: 13, color: RS.faint }}>{t("Este equipo no tiene jugadores")}</p> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead><tr>
                      <th style={TH} />
                      <th style={TH}>{t("Nº")}</th><th style={TH}>{t("Jugador")}</th><th style={TH}>{t("Año")}</th><th style={TH}>{t("Pos")}</th>
                      <th style={{ ...TH, textAlign: "right" }} title={t("% de minutos de liga sobre los disponibles")}>{t("Min.")}</th>
                      <th style={{ ...TH, textAlign: "right" }} title={t("% de entrenos")}>{t("Entr.")}</th>
                      <th style={{ ...TH, paddingLeft: 12 }}>{t("Propuesta")}</th>
                      <th style={{ ...TH, textAlign: "right", paddingRight: 12 }}>{t("Destino {s}", { s: shortSeason(next) })}</th>
                    </tr></thead>
                    <tbody>
                      {roster.map((p) => {
                        const on = sel.has(p.id);
                        const st = statsBy.get(p.id);
                        return (
                          <tr key={p.id} style={{ borderTop: `1px solid ${RS.lineSoft}`, background: on ? "#FDF2F4" : undefined, cursor: closed ? "default" : "pointer" }}
                            onClick={() => !closed && toggle(p.id)} data-testid={`season-row-${p.id}`}>
                            <td style={{ padding: "5px 8px" }}>
                              <input type="checkbox" checked={on} disabled={closed} onChange={() => toggle(p.id)} onClick={(e) => e.stopPropagation()} aria-label={playerFullName(p)} style={{ accentColor: RS.granate, width: 14, height: 14 }} />
                            </td>
                            <td style={{ textAlign: "center", fontWeight: 700, color: RS.granate }}>{p.jersey_number ?? ""}</td>
                            <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{playerFullName(p)}</td>
                            <td><YearBadge year={birthYearOf(p)} season={season} sm /></td>
                            <td style={{ fontSize: 11, fontWeight: 700, color: RS.muted }}>{POS[p.position] ? t(POS[p.position]) : ""}</td>
                            <td className="tabular-nums" style={{ textAlign: "right" }}>{pct(st?.pctMin, 50, 35)}</td>
                            <td className="tabular-nums" style={{ textAlign: "right" }}>{pct(st?.attPct, 80, 70)}</td>
                            <td style={{ paddingLeft: 12, fontSize: 11.5, color: RS.muted, whiteSpace: "nowrap" }}>{proposalText(p)}</td>
                            <td style={{ textAlign: "right", paddingRight: 12 }}>{destChip(p)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p style={{ margin: 0, padding: "8px 12px", fontSize: 11.5, color: RS.muted }}>{t("Min. = % de minutos de liga sobre los disponibles · Entr. = % de entrenos. Los jugadores sin decidir se quedan en su equipo al cerrar la temporada; nada se aplica hasta entonces.")}</p>
            </>
          ) : (
            <ProjectedList proj={proj} list={projList} teamName={teamName} season={season} t={t} />
          )}
        </section>

        {/* Prevista y movimientos */}
        <div className="flex flex-col lg:col-span-2 xl:col-span-1" style={{ gap: 12 }}>
          <section style={{ ...card, overflow: "hidden" }} data-testid="season-projected">
            <Head title={`${team?.name || ""} · ${shortSeason(next)}`} />
            <div className="flex flex-col" style={{ padding: "10px 14px", gap: 9 }}>
              <div className="flex items-center" style={{ gap: 12 }}>
                <span className="rs2-display tabular-nums" style={{ fontSize: 30, color: RS.granate }}>{projList.length}</span>
                <span style={{ fontSize: 12, color: RS.ink2, lineHeight: 1.35 }}>{t("jugadores previstos")}<br /><span style={{ color: RS.muted }}>{t("hoy {n}", { n: roster.length })}</span></span>
              </div>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                <span style={chip(RS.soft, RS.ink2)}>{t("Continúan {n}", { n: proj.stay.length })}</span>
                <span style={chip("#DCFCE7", "#166534")}>{t("Llegan {n}", { n: proj.arrive.length })}</span>
                <span style={chip("#FEE2E2", "#991B1B")}>{t("Salen {n}", { n: proj.leave.length })}</span>
              </div>
              {arriveFrom.length > 0 && <div style={{ fontSize: 12, color: RS.ink2 }}>{t("Llegan de")} {arriveFrom.map(([id, n], i) => <span key={id}>{i ? " · " : ""}<b>{teamName(id)}</b> {n}</span>)}</div>}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: RS.muted, textTransform: "uppercase", marginBottom: 5 }}>{t("Por línea")}</div>
                <div className="flex flex-wrap" style={{ gap: 5 }}>
                  {LINES.map((l) => {
                    const warn = (l === "POR" && lines.POR < 2) || lines[l] === 0;
                    return <span key={l} style={{ fontSize: 11.5, padding: "3px 8px", borderRadius: 999, border: `1px solid ${warn ? "#F5C2A0" : RS.line}`, background: warn ? "#FFF7ED" : "#fff", color: warn ? "#9A3412" : RS.ink2 }}><b>{t(LINE_LABEL[l])}</b> {lines[l]}</span>;
                  })}
                  {lines.none > 0 && <span style={{ fontSize: 11.5, padding: "3px 8px", borderRadius: 999, border: `1px solid ${RS.line}`, color: RS.muted }}>{t("Sin posición")} {lines.none}</span>}
                </div>
              </div>
              {years.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: RS.muted, textTransform: "uppercase", marginBottom: 5 }}>{t("Por año")}</div>
                  <div className="flex flex-wrap" style={{ gap: 5 }}>{years.map(([y, n]) => <span key={y} style={{ fontSize: 11.5, padding: "3px 8px", borderRadius: 999, border: `1px solid ${RS.line}`, color: RS.ink2 }}><b>{y === "s/a" ? t("Sin año") : y}</b> {n}</span>)}</div>
                </div>
              )}
              {warnings.length > 0 && (
                <div style={{ fontSize: 12, padding: "7px 9px", borderRadius: 8, background: "#FFF7ED", color: "#9A3412" }} data-testid="season-warnings">
                  <AlertTriangle className="inline w-3.5 h-3.5" /> {warnings.map((w) => (w.key === "gk" ? (w.n === 1 ? t("Solo 1 portero previsto") : t("{n} porteros previstos", { n: w.n }))
                    : w.key === "line" ? t("Nadie en {line}", { line: t(LINE_LABEL[w.line]) }) : t("Solo {n} jugadores (menos de {min})", { n: w.n, min: w.min }))).join(" · ")}
                </div>
              )}
              {proj.undecided.length > 0 && <div style={{ fontSize: 11.5, color: RS.muted }}>{t("{length} sin decidir: se cuentan como que continúan en este equipo.", { length: proj.undecided.length })}</div>}
              {view === "decide" && <button type="button" onClick={() => setView("projected")} style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontSize: 12, fontWeight: 700, color: RS.granate }} data-testid="season-see-projected">{t("Ver la plantilla prevista completa ›")}</button>}
            </div>
          </section>

          <section style={{ ...card, overflow: "hidden" }} data-testid="season-flows">
            <Head title={t("Movimientos del club")} />
            <div className="flex flex-col" style={{ padding: "8px 14px", gap: 5, fontSize: 12.5 }}>
              {flows.length === 0 ? <span style={{ color: RS.faint }}>{t("Todavía no hay jugadores que cambien de equipo.")}</span>
                : flows.slice(0, 6).map((f) => (
                  <div key={`${f.from}>${f.to}`} className="flex" style={{ gap: 8 }}><span style={{ flex: 1 }}>{teamName(f.from)} <span style={{ color: RS.muted }}>→</span> {teamName(f.to)}</span><b className="tabular-nums">{f.n}</b></div>
                ))}
              {flows.length > 0 && <button type="button" onClick={() => setFlowsOpen(true)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontSize: 12, fontWeight: 700, color: RS.granate }} data-testid="season-flows-open">{t("Ver todos y PDF ›")}</button>}
            </div>
          </section>
        </div>
      </div>

      <ConfirmMany testId="season-confirm-proposals" open={confirm === "proposals"} onClose={() => setConfirm(null)}
        title={t("Aceptar la propuesta por año de nacimiento")}
        lines={[...groupBy(pendingProposals, (p) => proposals.get(p.id)).entries()].map(([to, list]) => ({ key: to, label: destLabel(to), n: list.length }))}
        note={t("Solo para los jugadores sin decidir. Después puedes cambiar a quien quieras; nada se aplica hasta cerrar la temporada.")}
        okLabel={t("Aceptar {n} propuestas", { n: pendingProposals.length })}
        onOk={() => applyGroups(groupBy(pendingProposals, (p) => proposals.get(p.id)))} />
      <ConfirmMany testId="season-confirm-plan" open={confirm === "plan"} onClose={() => setConfirm(null)}
        title={t("Traer lo decidido en Planificación {s}", { s: shortSeason(next) })}
        lines={[...groupBy(Object.keys(fromPlan.moves).map((id) => ({ id })), (x) => fromPlan.moves[x.id].to).entries()].map(([to, list]) => ({ key: to, label: destLabel(to), n: list.length }))}
        note={fromPlan.already ? t("{n} jugadores ya tienen destino aquí y no se tocan.", { n: fromPlan.already }) : null}
        okLabel={t("Traer {n} destinos", { n: fromPlan.passes + fromPlan.bajas })}
        onOk={() => applyGroups(groupBy(Object.keys(fromPlan.moves).map((id) => ({ id })), (x) => fromPlan.moves[x.id].to))} />

      <Dialog open={flowsOpen} onOpenChange={setFlowsOpen}>
        <DialogContent className="bg-white max-w-lg max-h-[85vh] overflow-y-auto" data-testid="season-flows-dialog">
          <DialogHeader><DialogTitle style={{ color: RS.ink }}>{t("Movimientos del club · {s}", { s: shortSeason(next) })}</DialogTitle></DialogHeader>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 13 }}>
            {flows.map((f) => (
              <li key={`${f.from}>${f.to}`} className="flex" style={{ gap: 8, padding: "4px 0", borderBottom: `1px solid ${RS.lineSoft}` }}>
                <span style={{ flex: 1 }}>{teamName(f.from)} <span style={{ color: RS.muted }}>→</span> {teamName(f.to)}</span><b className="tabular-nums">{f.n}</b>
              </li>
            ))}
          </ul>
          <div className="flex justify-end"><button type="button" onClick={downloadFlows} style={btn(true)} data-testid="season-flows-pdf">{t("Descargar PDF")}</button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectedList({ proj, list, teamName, season, t }) {
  const arrived = new Set(proj.arrive.map((p) => p.id));
  const undecided = new Set(proj.undecided.map((p) => p.id));
  return (
    <div data-testid="season-projected-list">
      {list.length === 0 ? <p style={{ padding: 14, margin: 0, fontSize: 13, color: RS.faint }}>{t("Este equipo se queda sin jugadores según los traspasos decididos")}</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} style={{ borderTop: `1px solid ${RS.lineSoft}` }}>
                <td style={{ padding: "5px 10px", width: 28, textAlign: "center", fontWeight: 700, color: RS.granate }}>{p.jersey_number ?? ""}</td>
                <td style={{ fontWeight: 600 }}>{playerFullName(p)}</td>
                <td><YearBadge year={birthYearOf(p)} season={season} sm /></td>
                <td style={{ fontSize: 11, fontWeight: 700, color: RS.muted }}>{POS[p.position] ? t(POS[p.position]) : ""}</td>
                <td style={{ textAlign: "right", paddingRight: 12 }}>
                  {arrived.has(p.id) ? <span style={chip("#DCFCE7", "#166534")}>← {teamName(p.team_id)}</span>
                    : undecided.has(p.id) ? <span style={{ fontSize: 11, color: "#C9BEBF" }}>{t("Sin decidir")}</span>
                      : <span style={{ fontSize: 11, color: RS.muted }}>{t("Continúa")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {proj.leave.length > 0 && (
        <>
          <div style={{ padding: "6px 12px", background: "#FBF8F8", borderTop: `1px solid ${RS.line}`, fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: RS.muted }}>{t("Salen de este equipo ({length})", { length: proj.leave.length })}</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, color: RS.muted }}>
            <tbody>
              {proj.leave.slice().sort((a, b) => byPos(a.p, b.p)).map(({ p, to }) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${RS.lineSoft}` }}>
                  <td style={{ padding: "5px 10px", width: 28 }} />
                  <td>{playerFullName(p)}</td>
                  <td>{birthYearOf(p) || ""}</td>
                  <td style={{ textAlign: "right", paddingRight: 12, fontSize: 11.5, fontWeight: 600 }}>{to === "baja" ? <span style={{ color: NO }}>{t("Baja")}</span> : `→ ${teamName(to)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
