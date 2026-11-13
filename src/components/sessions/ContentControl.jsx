// Metodología → Control de contenidos (rediseño rs2 del 13/11/2026, maqueta aprobada por Nacho).
// Bloques en el orden que pidió Nacho: las tres áreas de ataque, las tres de defensa, técnica y hábitos y el balón parado.
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { useIsMobile } from "@/hooks/use-mobile";
import { RS } from "@/components/rs2/kit";
import { todayStr } from "./sessionHelpers";
import {
  BLOCK_GROUPS, PRIORITY, aggregateSessions, blockInfo, compareWithStage, contentBlock, contentName, fmtMin, fmtPct, hierarchyIssues, marginState, pctOf,
  stageContents, stageInfo, stageOfTeamName, sessionTypeInfo,
} from "@/lib/sessionPlan";
import {
  blocksToReview, countedSessions, fmtHours, mixByType, periodStart, sortOverview, teamsOverview, trainingCoverage, undoneHigh, weeklyMix,
} from "@/lib/methodologyView";
import { toCsv, exportFileName, downloadCsv } from "@/lib/staffExport";
import { Box, Kpi, MixBar, PillBtn, Seg, TypeChip, BlockLegend, btnStyle, TH, OK, WARN, NO } from "@/components/methodology/MethParts";
import { useT, msg } from "@/i18n";
import { sortTeams } from "@/lib/teamOrder";

const ALL = "__all";
const PERIODS = [["season", msg("Temporada")], ["30", msg("30 días")], ["7", msg("7 días")]];
const sign = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Math.round(n))}`;
const devColor = (d) => (Math.abs(d) <= 5 ? OK : Math.abs(d) <= 10 ? WARN : NO);

const teamStage = (team, sessions = []) => (team && stageOfTeamName(team.name)) || sessions.find((s) => s.team_id === team?.id && s.stage)?.stage || null;

function BlockRows({ agg, rows, contents, openBlock, setOpenBlock, isMobile }) {
  const t = useT();
  const max = Math.max(40, ...rows.map((r) => Math.max(r.pct, r.target))) * 1.05;
  return BLOCK_GROUPS.map((g) => {
    const gr = rows.filter((r) => blockInfo(r.block)?.group === g.id);
    const visible = gr.filter((r) => r.minutes > 0 || r.target > 0 || contents.some((c) => c.block === r.block));
    if (!visible.length) return null;
    const pct = gr.reduce((n, r) => n + r.pct, 0), target = gr.reduce((n, r) => n + r.target, 0), mins = gr.reduce((n, r) => n + r.minutes, 0);
    return (
      <div key={g.id} data-testid={`control-group-${g.id}`}>
        <div className="flex flex-wrap items-baseline" style={{ gap: 10, padding: "7px 14px", background: RS.head, borderTop: `1px solid ${RS.line}` }}>
          <b style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: RS.granateDark }}>{t(g.label)}</b>
          <span style={{ fontSize: 11.5, color: RS.muted, marginLeft: "auto" }}>
            <b style={{ color: RS.ink }}>{Math.round(pct)} %</b> / {target} %{agg.withBlock ? <b style={{ color: devColor(pct - target), marginLeft: 4 }}>{sign(pct - target)}</b> : null} · {fmtHours(mins)}
          </span>
        </div>
        {visible.map((r) => {
          const b = blockInfo(r.block);
          const own = contents.filter((c) => c.block === r.block);
          const ownIds = new Set(own.map((c) => c.id));
          const extra = Object.values(agg.contents)
            .filter((c) => !ownIds.has(c.id) && contentBlock(c.id, { custom_contents: agg.custom }) === r.block)
            .map((c) => ({ id: c.id, name: contentName(c.id, { custom_contents: agg.custom }), block: r.block, priority: null }));
          const list = [...own, ...extra];
          const open = openBlock === r.block;
          return (
            <div key={r.block}>
              <button type="button" onClick={() => setOpenBlock(open ? null : r.block)} data-testid={`control-block-${r.block}`}
                style={{ width: "100%", textAlign: "left", display: "grid", gridTemplateColumns: isMobile ? "14px 1fr" : "14px 168px minmax(0,1fr) 178px", gap: isMobile ? "4px 8px" : 10, alignItems: "center", padding: "7px 14px", border: 0, borderTop: "1px solid #F3EEEE", background: open ? RS.head : "#fff" }}>
                {open ? <ChevronDown className="w-3.5 h-3.5" style={{ color: RS.muted }} /> : <ChevronRight className="w-3.5 h-3.5" style={{ color: RS.muted }} />}
                <span className="flex items-center" style={{ gap: 6, fontSize: 12.5, fontWeight: 700, color: b.ink, minWidth: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: b.color, flex: "none" }} /><span className="truncate">{t(b.short)}</span>
                </span>
                <span style={{ position: "relative", height: 12, borderRadius: 9, background: "#F1ECEC", overflow: "hidden", gridColumn: isMobile ? "1 / -1" : undefined }}>
                  <span style={{ position: "absolute", inset: "0 auto 0 0", width: `${(r.pct / max) * 100}%`, background: b.color, borderRadius: 9 }} />
                  {r.target > 0 && <span title={t("Referencia: {p} %", { p: r.target })} style={{ position: "absolute", top: 0, bottom: 0, left: `${(r.target / max) * 100}%`, width: 2, background: RS.granateDark }} />}
                </span>
                <span style={{ fontSize: 12, textAlign: isMobile ? "left" : "right", whiteSpace: "nowrap", gridColumn: isMobile ? "1 / -1" : undefined }}>
                  <b>{Math.round(r.pct)} %</b> <span style={{ color: RS.muted }}>/ {r.target} %</span>{" "}
                  {agg.withBlock > 0 && <b style={{ color: devColor(r.diff) }} title={marginState(r.diff).label}>{sign(r.diff)}</b>} <span style={{ color: RS.muted }}>· {fmtHours(r.minutes)}</span>
                </span>
              </button>
              {open && (
                <div style={{ padding: isMobile ? "4px 8px 10px" : "4px 14px 10px 38px", background: RS.head }}>
                  {list.length === 0 ? <p style={{ fontSize: 12, color: RS.muted }}>{t("Esta etapa no tiene contenidos en este bloque.")}</p> : (
                    <div style={{ overflowX: "auto", background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 8 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 460 }}>
                        <thead><tr><th style={TH} /><th style={TH}>{t("Contenido")}</th><th style={{ ...TH, textAlign: "right" }}>{t("Principal")}</th><th style={{ ...TH, textAlign: "right" }}>{t("Secundario")}</th><th style={{ ...TH, textAlign: "right", paddingRight: 10 }}>{t("Tareas")}</th></tr></thead>
                        <tbody>
                          {list.map((c) => {
                            const a = agg.contents[c.id] || { principal: 0, secondary: 0, tasks: 0, secTasks: 0 };
                            const pr = c.priority ? PRIORITY[c.priority] : null;
                            const untouched = !a.principal && !a.secondary;
                            return (
                              <tr key={c.id} style={{ borderTop: "1px solid #F3EEEE" }} data-testid={`control-row-${c.id}`}>
                                <td style={{ padding: "4px 8px", width: 26 }}>
                                  {pr ? <span title={t("Prioridad {p}", { p: t(pr.label).toLowerCase() })} style={{ fontSize: 9.5, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: pr.bg, color: pr.color }}>{pr.short}</span>
                                    : <span title={t("De otra etapa o de la paleta del club")} style={{ fontSize: 9.5, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: "#FFEDD5", color: "#9A3412" }}>+</span>}
                                </td>
                                <td style={{ fontWeight: untouched ? (c.priority === "A" ? 700 : 400) : 600, color: untouched ? (c.priority === "A" ? NO : RS.faint) : RS.ink }}>
                                  {c.name}{untouched && c.priority === "A" ? ` · ${t("sin trabajar")}` : ""}{!a.principal && a.secondary > 0 ? <span style={{ fontSize: 10.5, fontWeight: 400, color: RS.muted }}> ({t("solo secundario")})</span> : null}
                                </td>
                                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{a.principal > 0 ? <><b style={{ color: RS.granate }}>{fmtHours(a.principal)}</b> · {fmtPct(pctOf(a.principal, agg.total))}</> : <span style={{ color: "#D6CDCE" }}>—</span>}</td>
                                <td style={{ textAlign: "right", whiteSpace: "nowrap", color: RS.muted }}>{a.secondary > 0 ? <>{fmtHours(a.secondary)} · {fmtPct(pctOf(a.secondary, agg.total))}</> : <span style={{ color: "#D6CDCE" }}>—</span>}</td>
                                <td style={{ textAlign: "right", paddingRight: 10, color: RS.muted }}>{(a.tasks || 0) + (a.secTasks || 0) || ""}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  });
}

function AllTeams({ rows, sortBy, setSortBy, onOpen }) {
  const t = useT();
  const sorted = sortOverview(rows, sortBy);
  return (
    <Box title={t("Todos los equipos")} testId="control-all" right={<Seg options={[["category", t("Por categoría")], ["low", t("Menos hojas primero")]]} value={sortBy} onChange={setSortBy} testPrefix="control-all-sort" />}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 760 }}>
          <thead><tr>
            <th style={{ ...TH, paddingLeft: 14 }}>{t("Equipo")}</th><th style={TH}>{t("Etapa")}</th><th style={TH}>{t("Entrenadores")}</th>
            <th style={{ ...TH, textAlign: "right" }}>{t("Entrenos con hoja")}</th><th style={{ ...TH, textAlign: "right" }}>{t("Tiempo")}</th><th style={{ ...TH, textAlign: "right" }}>{t("Con contenido")}</th>
            <th style={{ ...TH, textAlign: "right" }}>{t("Mayor desviación")}</th><th style={{ ...TH, textAlign: "center" }}>{t("Prior. alta sin trabajar")}</th><th style={TH} />
          </tr></thead>
          <tbody>
            {sorted.map((r) => {
              const pc = r.pct == null ? RS.muted : r.pct >= 80 ? OK : r.pct >= 60 ? WARN : NO;
              return (
                <tr key={r.team.id} style={{ borderTop: "1px solid #F3EEEE", cursor: "pointer" }} onClick={() => onOpen(r.team.id)} data-testid={`control-all-${r.team.id}`}>
                  <td style={{ padding: "6px 8px 6px 14px", fontWeight: 600 }}>{r.team.name}</td>
                  <td style={{ fontSize: 11.5, color: RS.muted }}>{t(stageInfo(r.stage)?.label || "—")}</td>
                  <td style={{ fontSize: 11.5 }}>{r.coaches.join(", ") || <span style={{ color: RS.faint }}>—</span>}</td>
                  <td style={{ textAlign: "right", color: pc, fontWeight: 700, whiteSpace: "nowrap" }}>{r.trainings ? `${r.withSession}/${r.trainings} · ${r.pct} %` : (r.sessions ? t("{n} sesiones", { n: r.sessions }) : "—")}</td>
                  <td style={{ textAlign: "right", color: RS.muted }}>{r.minutes ? fmtHours(r.minutes) : "—"}</td>
                  <td style={{ textAlign: "right" }}>{r.contentPct == null ? "—" : `${r.contentPct} %`}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: r.maxDev == null ? RS.muted : devColor(r.maxDev) }}>{r.maxDev == null ? "—" : `±${Math.round(r.maxDev)}`}</td>
                  <td style={{ textAlign: "center", fontWeight: 700, color: r.undone ? NO : RS.muted }}>{r.undone || "—"}</td>
                  <td style={{ textAlign: "right", paddingRight: 12, color: RS.granate, fontSize: 11.5, fontWeight: 700 }}>{t("Ver ›")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ padding: "8px 14px", fontSize: 11.5, color: RS.muted, borderTop: `1px solid ${RS.lineSoft}` }}>{t("Mayor desviación = el bloque más alejado del % de referencia de la etapa. Toca un equipo para ver su detalle.")}</p>
    </Box>
  );
}

export default function ContentControl({ teams, isCoordinator, defaultTeamId, onGoLibrary }) {
  const t = useT();
  const isMobile = useIsMobile();
  const [teamId, setTeamId] = useState(defaultTeamId || "");
  const [coachId, setCoachId] = useState(ALL);
  const [period, setPeriod] = useState("season");
  const [openBlock, setOpenBlock] = useState(null);
  const [allSort, setAllSort] = useState("category");
  const today = todayStr();
  const from = periodStart(period, today);

  const { data: sessions = [], isLoading } = useQuery({ queryKey: ["coach_sessions"], queryFn: () => base44.entities.CoachSession.list("-date", 1000) });
  const seasonFrom = periodStart("season", today);
  const { data: events = [] } = useQuery({
    queryKey: ["meth-trainings", seasonFrom],
    queryFn: () => base44.entities.Event.pick(["id", "team_id", "date", "type", "cancelled", "location", "field_id"], { type: "entrenamiento" }, { gte: { date: seasonFrom } }),
  });

  const withSessions = useMemo(() => new Set(sessions.map((s) => s.team_id)), [sessions]);
  const teamList = useMemo(() => [...teams].sort((a, b) => Number(withSessions.has(b.id)) - Number(withSessions.has(a.id))), [teams, withSessions]);
  const allView = isCoordinator && teams.length > 1 && teamId === ALL;
  const team = allView ? null : teams.find((x) => x.id === teamId) || teamList.find((x) => withSessions.has(x.id)) || teamList[0] || null;
  const pillTeams = isMobile ? [] : teamList.filter((x) => withSessions.has(x.id)).slice(0, 5);
  const restTeams = teamList.filter((x) => !pillTeams.includes(x));

  const coaches = useMemo(() => {
    const m = new Map();
    sessions.filter((s) => s.team_id === team?.id).forEach((s) => s.owner_id && m.set(s.owner_id, s.owner_name || t("Entrenador")));
    return [...m.entries()];
  }, [sessions, team?.id]);

  const counted = useMemo(() => countedSessions(sessions.filter((s) => s.team_id === team?.id && (coachId === ALL || s.owner_id === coachId)), { from, today, season: CURRENT_SEASON }),
    [sessions, team?.id, coachId, from, today]);
  const stage = teamStage(team, sessions);
  const agg = useMemo(() => aggregateSessions(counted), [counted]);
  const rows = useMemo(() => compareWithStage(agg, stage), [agg, stage]);
  const issues = useMemo(() => hierarchyIssues(agg, stage), [agg, stage]);
  const contents = useMemo(() => stageContents(stage), [stage]);
  const undone = useMemo(() => (stage && agg.withBlock ? undoneHigh(agg, stage) : []), [agg, stage]);
  const review = blocksToReview(rows, agg.withBlock);
  const cov = useMemo(() => trainingCoverage({ events, sessions: counted, teamIds: team ? [team.id] : [], from, today }), [events, counted, team, from, today]);
  const byType = useMemo(() => mixByType(counted), [counted]);
  const weekly = useMemo(() => weeklyMix(counted, today, period === "7" ? 4 : 8), [counted, today, period]);
  const overview = useMemo(() => (allView ? teamsOverview({ teams: sortTeams(teams), sessions, events, from, today, season: CURRENT_SEASON, stageOf: teamStage }) : []), [allView, teams, sessions, events, from, today]);
  const info = stageInfo(stage);

  const exportCsv = () => {
    if (allView) {
      downloadCsv(exportFileName("control-contenidos-equipos"), toCsv(["Equipo", "Etapa", "Entrenadores", "Entrenos", "Con hoja", "% con hoja", "Minutos", "% con contenido", "Mayor desviación", "Prioridad alta sin trabajar"],
        overview.map((r) => [r.team.name, stageInfo(r.stage)?.label || "", r.coaches.join(", "), r.trainings, r.withSession, r.pct ?? "", Math.round(r.minutes), r.contentPct ?? "", r.maxDev == null ? "" : Math.round(r.maxDev), r.undone ?? ""])));
      return;
    }
    const data = [];
    for (const r of rows) {
      const b = blockInfo(r.block);
      data.push([b.label, "", "", Math.round(r.minutes), Math.round(r.pct), r.target, Math.round(r.diff), ""]);
      for (const c of contents.filter((x) => x.block === r.block)) {
        const a = agg.contents[c.id] || {};
        data.push([b.label, c.name, c.priority, Math.round(a.principal || 0), "", "", "", Math.round(a.secondary || 0)]);
      }
    }
    downloadCsv(exportFileName(`control-contenidos-${team?.name || ""}`), toCsv(["Bloque", "Contenido", "Prioridad", "Minutos principal", "% del bloque", "% referencia", "Desviación", "Minutos secundario"], data));
  };

  const sel = { fontSize: 12, border: `1px solid ${RS.line}`, background: "#fff", borderRadius: 8, padding: "5px 8px", color: RS.ink2, maxWidth: 200 };
  const filters = (
    <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
      {isCoordinator && teams.length > 1 && <PillBtn on={allView} onClick={() => setTeamId(ALL)} testId="control-team-all">{t("Todos los equipos")}</PillBtn>}
      {pillTeams.map((x) => <PillBtn key={x.id} on={!allView && team?.id === x.id} onClick={() => { setTeamId(x.id); setCoachId(ALL); }} testId={`control-team-${x.id}`}>{x.name}</PillBtn>)}
      {restTeams.length > 0 && (
        <select value={!allView && restTeams.some((x) => x.id === team?.id) ? team.id : ""} onChange={(e) => { if (e.target.value) { setTeamId(e.target.value); setCoachId(ALL); } }} style={sel} data-testid="control-team-more">
          <option value="">{pillTeams.length ? t("Otro equipo…") : t("Equipo…")}</option>
          {restTeams.map((x) => <option key={x.id} value={x.id}>{x.name}{withSessions.has(x.id) ? "" : ` (${t("sin sesiones")})`}</option>)}
        </select>
      )}
      <span className="flex flex-wrap items-center" style={{ marginLeft: "auto", gap: 6 }}>
        <Seg options={PERIODS.map(([k, l]) => [k, t(l)])} value={period} onChange={setPeriod} testPrefix="control-period" />
        {!allView && isCoordinator && coaches.length > 1 && (
          <select value={coachId} onChange={(e) => setCoachId(e.target.value)} style={sel} data-testid="control-coach">
            <option value={ALL}>{t("Todos los entrenadores")}</option>
            {coaches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
        <button type="button" style={btnStyle(false)} onClick={exportCsv} data-testid="control-export">{t("Exportar Excel")}</button>
      </span>
    </div>
  );

  if (isLoading) return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{filters}<p style={{ padding: 20, textAlign: "center", color: RS.muted }}>{t("Cargando…")}</p></div>;

  if (allView) {
    const tot = overview.reduce((a, r) => ({ tr: a.tr + r.trainings, ws: a.ws + r.withSession, low: a.low + (r.pct != null && r.pct < 60 ? 1 : 0), und: a.und + (r.undone || 0), undT: a.undT + (r.undone ? 1 : 0) }), { tr: 0, ws: 0, low: 0, und: 0, undT: 0 });
    const aggAll = aggregateSessions(countedSessions(sessions, { from, today, season: CURRENT_SEASON }));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filters}
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          <Kpi testId="control-all-kpi-coverage" n={tot.tr ? `${Math.round((tot.ws / tot.tr) * 100)} %` : "—"} label={t("entrenos con hoja")} sub={t("{a} de {b}", { a: tot.ws, b: tot.tr })} />
          <Kpi n={aggAll.total ? `${Math.round((aggAll.withBlock / aggAll.total) * 100)} %` : "—"} label={t("del tiempo con contenido")} sub={fmtHours(aggAll.total)} />
          <Kpi testId="control-all-kpi-low" n={tot.low} label={t("equipos a revisar")} sub={t("menos del 60 % de entrenos con hoja")} color={tot.low ? NO : undefined} />
          <Kpi n={tot.und} label={t("prioridades altas sin trabajar")} sub={t("en {n} equipos", { n: tot.undT })} color={tot.und ? WARN : undefined} />
        </div>
        <AllTeams rows={overview} sortBy={allSort} setSortBy={setAllSort} onOpen={(id) => { setTeamId(id); setCoachId(ALL); }} />
      </div>
    );
  }

  const blocksCard = (
    <Box title={t("Tiempo por bloque frente a la referencia")} testId="control-blocks" right={<BlockLegend />}>
      {agg.sessions === 0 ? <p style={{ padding: 24, textAlign: "center", fontSize: 13, color: RS.muted }}>{t("No hay sesiones registradas de este equipo en el periodo elegido.")}</p> : (
        <>
          <BlockRows agg={agg} rows={rows} contents={contents} openBlock={openBlock} setOpenBlock={setOpenBlock} isMobile={isMobile} />
          <p style={{ padding: "8px 14px", borderTop: `1px solid ${RS.lineSoft}`, fontSize: 11, color: RS.muted }}>
            {t("Raya oscura = % de referencia de la etapa.")} {t("Desviación:")} <b style={{ color: OK }}>{t("±5 correcta")}</b> · <b style={{ color: WARN }}>{t("±5 a ±10 a justificar")}</b> · <b style={{ color: NO }}>{t("más de ±10 revisar")}</b>.{" "}
            {t("El % de cada bloque se calcula sobre el tiempo que tiene contenido; el de cada contenido, sobre todo el tiempo trabajado. El secundario se cuenta aparte y no suma al bloque.")}
          </p>
        </>
      )}
    </Box>
  );
  const side = agg.sessions > 0 && (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {undone.length > 0 && (
        <Box title={t("Prioridad alta sin trabajar")} testId="control-undone">
          <div style={{ padding: "8px 14px", fontSize: 12.5, display: "flex", flexDirection: "column", gap: 5 }}>
            {undone.slice(0, 8).map((c) => (
              <button key={c.id} type="button" onClick={() => onGoLibrary?.(c.name)} className="flex text-left" style={{ gap: 8, background: "none", border: 0, padding: 0 }} data-testid={`control-undone-${c.id}`}>
                <b style={{ flex: 1, color: NO }}>{c.name}</b><span style={{ fontSize: 11, color: RS.muted }}>{t(blockInfo(c.block)?.short)}</span>
              </button>
            ))}
            {undone.length > 8 && <span style={{ fontSize: 11.5, color: RS.muted }}>{t("… y {n} más", { n: undone.length - 8 })}</span>}
            {onGoLibrary && <span style={{ fontSize: 11.5, color: RS.muted }}>{t("Tócalos para ver tareas de la biblioteca que los trabajan.")}</span>}
          </div>
        </Box>
      )}
      {issues.length > 0 && (
        <div style={{ padding: "10px 14px", borderRadius: 12, background: "#FFF7ED", border: "1px solid #F5C2A0", fontSize: 12, color: "#9A3412" }} data-testid="control-hierarchy">
          <b>{t("Jerarquía de prioridades")}</b>
          <div style={{ marginTop: 3 }}>{t("Algún contenido de menos prioridad lleva tanto o más tiempo que otro de más prioridad en:")}</div>
          <div className="flex flex-wrap" style={{ gap: 4, marginTop: 5 }}>
            {[...new Set(issues.map((i) => i.block))].map((id) => <span key={id} style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: "#fff", border: "1px solid #F5C2A0" }}>{t(blockInfo(id)?.short || "")}</span>)}
          </div>
          <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>{t("La prioridad alta debería llevar siempre más tiempo que la media, y esta más que la baja, dentro de cada bloque.")}</div>
        </div>
      )}
      {byType.length > 0 && (
        <Box title={t("Por tipo de sesión")} testId="control-bytype">
          <div style={{ padding: "8px 14px", fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {byType.map((x) => (
              <div key={x.type} className="flex items-center" style={{ gap: 8 }}>
                <span style={{ width: 92 }}><TypeChip type={x.type} /></span>
                <MixBar mix={x.mix} width={isMobile ? 120 : 150} title={t(sessionTypeInfo(x.type)?.full || "")} />
                <span style={{ color: RS.muted, fontSize: 11.5 }}>{fmtHours(x.minutes)}</span>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: RS.muted }}>{t("Para ver si cada tipo de sesión trabaja lo que le toca.")}</div>
          </div>
        </Box>
      )}
      <Box title={t("Semana a semana")} testId="control-weekly">
        <div style={{ padding: "10px 14px" }}>
          {(() => {
            const max = Math.max(1, ...weekly.map((w) => w.total));
            return (
              <div className="flex items-end" style={{ gap: 6, height: 84 }}>
                {weekly.map((w) => (
                  <span key={w.start} title={`${w.start} · ${fmtHours(w.total)}`} style={{ flex: 1, display: "flex", flexDirection: "column-reverse", height: `${Math.max(4, (w.total / max) * 100)}%`, borderRadius: 4, overflow: "hidden", background: "#F1ECEC" }}>
                    {w.mix.map((x) => <span key={x.block} style={{ height: `${(x.minutes / (w.total || 1)) * 100}%`, background: blockInfo(x.block)?.color }} />)}
                  </span>
                ))}
              </div>
            );
          })()}
          <div className="flex justify-between" style={{ fontSize: 10.5, color: RS.muted, marginTop: 4 }}><span>{weekly[0]?.start.slice(5).split("-").reverse().join("/")}</span><span>{weekly[weekly.length - 1]?.start.slice(5).split("-").reverse().join("/")}</span></div>
          <div style={{ fontSize: 11.5, color: RS.muted, marginTop: 4 }}>{t("Cada barra, el tiempo de esa semana por bloques (de abajo arriba: ataque, defensa, técnica y hábitos, balón parado).")}</div>
        </div>
      </Box>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {filters}
      {team && (
        <p style={{ fontSize: 12, color: RS.muted }}>
          {team.name} · {info ? <>{t("etapa")} <b style={{ color: RS.ink }}>{t(info.label)}</b> ({info.teams})</> : <span style={{ color: WARN, fontWeight: 600 }}>{t("No se reconoce la etapa de este equipo: elígela en cada sesión.")}</span>}
          {" · "}{t("Cuentan las sesiones ya hechas (hasta hoy) y marcadas como realizadas.")}
        </p>
      )}
      <div className="flex flex-wrap" style={{ gap: 8 }}>
        <Kpi testId="control-kpi-sessions" n={agg.sessions} label={t("sesiones")} sub={cov.trainings ? t("de {n} entrenos · {p} %", { n: cov.trainings, p: cov.pct }) : t("{n} tareas", { n: agg.tasks })} />
        <Kpi testId="control-kpi-time" n={fmtHours(agg.total)} label={t("registradas")} sub={t("{n} tareas", { n: agg.tasks })} />
        <Kpi testId="control-kpi-content" n={agg.total ? `${Math.round((agg.withBlock / agg.total) * 100)} %` : "—"} label={t("con contenido")} sub={agg.unclassified ? t("{m} sin elegir", { m: fmtHours(agg.unclassified) }) : t("PF y activación: {m}", { m: fmtMin(agg.noCurriculum) })} />
        <Kpi testId="control-kpi-undone" n={undone.length} label={t("prioridad alta sin trabajar")} sub={t("en el periodo")} color={undone.length ? NO : undefined} />
        <Kpi testId="control-kpi-review" n={review.length} label={t("bloques a revisar")} sub={t("más de ±10 de la referencia")} color={review.length ? WARN : undefined} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 330px", gap: 12, alignItems: "start" }}>
        {blocksCard}
        {side}
      </div>
    </div>
  );
}
