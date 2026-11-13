// Mi equipo → Desarrollo. Rediseño del 13/11/2026 con el diseño rs2 (maqueta «Maqueta Mi equipo · Partidos y Desarrollo»,
// aprobada por Nacho: «ok todo»). Por jugador: última Evaluación 360, plan (PDI), valoración del postpartido, minutos,
// entrenos y cuándo se revisó por última vez. Cálculos puros en src/lib/teamPages.js.
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useSelectedTeam } from "@/lib/useSelectedTeam";
import { useSquadRows } from "@/lib/useSquadRows";
import { squadGroups } from "@/lib/myTeamStats";
import { AREAS, areasFor, computeAverages, scoreColor } from "@/lib/eval360";
import { pdiSummary, last360, ratingSummary, lastReview, daysSince, REVIEW_DAYS, workedOn, recentImproved, sortDev } from "@/lib/teamPages";
import { playerFullName, playerSearchName } from "@/lib/playerName";
import { birthYearOf } from "@/lib/birthYear";
import { juvenilYear } from "@/lib/juvenilYear";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { toCsv, exportFileName, downloadCsv } from "@/lib/staffExport";
import { getCategoryLabel } from "@/components/fcfCategories";
import { POS_LABEL } from "@/components/myteam/MyTeamCards";
import TeamTop, { NoTeam } from "@/components/myteam/TeamTop";
import { Page, RS, YearBadge, SearchBox } from "@/components/rs2/kit";
import { Head, Big, WIN, LOSS } from "@/components/rs2/dashParts";
import { useT, useFormat, msg } from "@/i18n";

const SORTS = [{ k: "pos", l: msg("Por posición") }, { k: "review", l: msg("Sin revisar primero") }, { k: "low360", l: msg("360 más bajo") }];
const WARN = "#B45309";
const PDI_CHIPS = [
  ["trabajando", msg("{n} trabajando"), "#DBEAFE", "#1E40AF"],
  ["a_mejorar", msg("{n} a mejorar"), "#FFF7ED", "#9A3412"],
  ["mejorado", msg("{n} mejorado"), "#DCFCE7", "#166534"],
];
const fmt1 = (n) => (n == null ? "—" : String(Math.round(n * 10) / 10).replace(".", ","));

function Kpi({ value, label, sub, color = RS.granate, testId }) {
  return (
    <div className="rs2-card" style={{ flex: "1 1 160px", display: "flex", alignItems: "baseline", gap: 8, padding: "8px 12px", borderRadius: 10 }} data-testid={testId}>
      <span style={{ whiteSpace: "nowrap" }}><Big size={24} color={color}>{value}</Big></span>
      <span style={{ fontSize: 12, color: RS.ink2, lineHeight: 1.15 }}>{label}{sub && <span style={{ display: "block", fontSize: 11, color: RS.muted }}>{sub}</span>}</span>
    </div>
  );
}

/** Media de la 360 y una barrita por área (técnica, táctica, física, mental) */
function Bars360({ e }) {
  const t = useT();
  if (!e || e.overall == null) return <span style={{ fontSize: 11.5, color: WARN }}>{t("sin 360")}</span>;
  return (
    <span className="inline-flex items-center" style={{ gap: 6 }} title={AREAS.map((a) => `${t(a.label)}: ${fmt1(e.areas[a.key])}`).join(" · ")}>
      <b style={{ color: scoreColor(e.overall), fontSize: 13, minWidth: 24 }}>{fmt1(e.overall)}</b>
      <span className="inline-flex items-end" style={{ gap: 2, height: 16 }}>
        {AREAS.map((a) => {
          const v = e.areas[a.key];
          return <span key={a.key} style={{ width: 6, height: v == null ? 2 : Math.max(2, (v / 10) * 16), background: v == null ? RS.lineSoft : scoreColor(v), borderRadius: 2 }} />;
        })}
      </span>
    </span>
  );
}

export default function Development() {
  const t = useT();
  const { locale } = useFormat();
  const { selectedTeamId } = useSelectedTeam();
  const [sort, setSort] = useState("pos");
  const [q, setQ] = useState("");

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: allStats = [] } = useQuery({ queryKey: ["matchstats_all"], queryFn: () => base44.entities.MatchStats.list() });
  const { data: goals = [] } = useQuery({ queryKey: ["pdi_goals_all"], queryFn: () => base44.entities.PDIGoal.list("-created_date", 2000) });
  const { data: evals = [] } = useQuery({
    queryKey: ["eval360_lite"],
    queryFn: () => base44.entities.Evaluation360.pick(["player_id", "scores", "date", "created_date"]),
  });
  const { rows } = useSquadRows(selectedTeamId);

  const team = teams.find((x) => x.id === selectedTeamId);
  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const now = new Date();

  const data = useMemo(() => rows.map((r) => {
    const pid = r.p.id;
    const g = goals.filter((x) => x.player_id === pid);
    const ev = evals.filter((x) => x.player_id === pid);
    const e360 = last360(ev, (x) => computeAverages(x.scores || {}, areasFor(r.p.position)));
    const rated = allStats
      .filter((s) => s.player_id === pid && eventsById.get(s.event_id)?.team_id === selectedTeamId)
      .map((s) => ({ rating: s.rating, date: eventsById.get(s.event_id)?.date }));
    const rev = lastReview({ evals: ev, goals: g });
    return { ...r, id: pid, goals: g, pdi: pdiSummary(g), e360, rate: ratingSummary(rated), rev, days: daysSince(rev, now) };
  }), [rows, goals, evals, allStats, eventsById, selectedTeamId]);

  const filtered = q ? data.filter((r) => playerSearchName(r.p).toLowerCase().includes(q.toLowerCase())) : data;
  const groups = sort === "pos" ? squadGroups(filtered) : [{ key: "all", label: null, rows: sortDev(filtered, sort) }];

  const withPlan = data.filter((r) => r.pdi.total > 0).length;
  const working = data.reduce((a, r) => a + r.pdi.trabajando, 0);
  const toImprove = data.reduce((a, r) => a + r.pdi.a_mejorar, 0);
  const teamGoals = data.flatMap((r) => r.goals);
  const improved = teamGoals.filter((g) => g.status === "mejorado" && String(g.improved_date || "").slice(0, 10) >= `${CURRENT_SEASON.slice(0, 4)}-08-01`).length;
  const with360 = data.filter((r) => r.e360?.overall != null).length;
  const toReview = data.filter((r) => r.days == null || r.days > REVIEW_DAYS).sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999));
  const topWorked = workedOn(teamGoals, (g) => t(g.competency_text || "") || g.objective).slice(0, 6);
  const maxWorked = Math.max(1, ...topWorked.map((w) => w.n));
  const latestImproved = recentImproved(teamGoals, 4);
  const nameOf = (pid) => playerFullName(data.find((r) => r.id === pid)?.p || {});

  const revText = (r) => (r.days == null ? t("nunca") : r.days === 0 ? t("hoy") : t("hace {n} días", { n: r.days }));

  const exportXls = () => {
    const header = ["Dorsal", "Jugador", "Año", "Posición", "360", "Técnica", "Táctica", "Física", "Mental", "Objetivo actual", "Trabajando", "A mejorar", "Mejorados", "Valoración partidos", "% minutos", "% entrenos", "Última revisión"];
    const out = data.map((r) => [
      r.p.jersey_number ?? "", playerFullName(r.p), r.year ?? "", r.p.position || "",
      r.e360?.overall ?? "", r.e360?.areas.tecnica ?? "", r.e360?.areas.tactica ?? "", r.e360?.areas.fisica ?? "", r.e360?.areas.mental ?? "",
      r.pdi.current ? (r.pdi.current.competency_text || r.pdi.current.objective || "") : "", r.pdi.trabajando, r.pdi.a_mejorar, r.pdi.mejorado,
      r.rate?.avg ?? "", r.pctMin ?? "", r.attPct ?? "", r.rev || "",
    ]);
    downloadCsv(exportFileName(`desarrollo-${team?.name || "equipo"}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")), toCsv(header, out));
  };

  if (!selectedTeamId) {
    return <Page testId="team-dev"><div className="rs2-wrap flex flex-col" style={{ gap: 12, maxWidth: 1440 }}><TeamTop kicker={t("Mi equipo")} title={t("Desarrollo")} teams={teams} /><NoTeam teams={teams} /></div></Page>;
  }

  const kicker = [t("Mi equipo"), team?.name, getCategoryLabel(team?.category) !== team?.name && getCategoryLabel(team?.category)].filter(Boolean).join(" · ");
  const th = { textAlign: "left" };

  return (
    <Page testId="team-dev">
      <div className="rs2-wrap flex flex-col" style={{ gap: 12, maxWidth: 1440 }}>
        <TeamTop kicker={kicker} title={t("Desarrollo")} teams={teams}>
          <button type="button" onClick={exportXls} className="inline-flex items-center" data-testid="dev-export"
            style={{ gap: 5, fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink2 }}>
            <Download className="w-4 h-4" /> {t("Exportar Excel")}
          </button>
        </TeamTop>

        <div className="flex flex-wrap" style={{ gap: 8 }}>
          <Kpi testId="dev-kpi-plan" value={`${withPlan}/${data.length}`} label={t("con plan (PDI)")} sub={data.length - withPlan ? t("{n} sin objetivos", { n: data.length - withPlan }) : t("Todos con objetivos")} />
          <Kpi testId="dev-kpi-working" value={working} label={t("objetivos trabajando")} sub={t("{n} a mejorar", { n: toImprove })} />
          <Kpi testId="dev-kpi-improved" value={improved} label={t("mejorados")} sub={t("esta temporada")} color={WIN} />
          <Kpi testId="dev-kpi-360" value={`${with360}/${data.length}`} label={t("con 360")} />
          <Kpi testId="dev-kpi-review" value={toReview.length} label={t("por revisar")} sub={t("más de {n} días", { n: REVIEW_DAYS })} color={toReview.length ? LOSS : WIN} />
        </div>

        <div className="flex flex-wrap items-start" style={{ gap: 12 }}>
          <div className="rs2-card" style={{ flex: "999 1 640px", minWidth: 0, overflow: "hidden" }} data-testid="dev-table">
            <Head title={t("{e} · {n} jugadores", { e: team?.name || "", n: data.length })} />
            <div className="flex flex-wrap items-center" style={{ gap: 8, padding: "8px 14px" }}>
              <div className="flex" style={{ gap: 3, background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 999, padding: 2 }} role="group">
                {SORTS.map((o) => (
                  <button key={o.k} type="button" onClick={() => setSort(o.k)} aria-pressed={sort === o.k} data-testid={`dev-sort-${o.k}`}
                    style={{ fontSize: 12, padding: "4px 11px", whiteSpace: "nowrap", borderRadius: 999, border: 0, fontWeight: sort === o.k ? 700 : 400, background: sort === o.k ? RS.granate : "none", color: sort === o.k ? "#fff" : RS.ink2 }}>{t(o.l)}</button>
                ))}
              </div>
              <div style={{ marginLeft: "auto", width: 210 }}><SearchBox value={q} onChange={setQ} placeholder={t("Buscar jugador")} testId="dev-search" /></div>
            </div>
            <div className="overflow-x-auto">
              <table className="rs2-tbl rs2-left" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr>
                  <th style={{ paddingLeft: 14 }}>{t("Nº")}</th><th style={th}>{t("Jugador")}</th><th style={th}>{t("Año")}</th><th style={th}>{t("Pos.")}</th>
                  <th style={th}>{t("360")}</th><th style={th}>{t("Plan (PDI)")}</th><th style={th}>{t("Partidos")}</th>
                  <th style={{ textAlign: "right" }}>{t("Min.")}</th><th style={{ textAlign: "right" }}>{t("Entr.")}</th>
                  <th style={{ textAlign: "right", paddingRight: 14 }}>{t("Revisado")}</th>
                </tr></thead>
                <tbody>
                  {groups.map((g) => (
                    <React.Fragment key={g.key}>
                      {g.label && (
                        <tr><td colSpan={10} style={{ padding: "6px 14px", background: RS.head, borderTop: `1px solid ${RS.line}`, fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: RS.granateDark }}>
                          {t(g.label)} <span style={{ color: RS.muted, fontWeight: 500, letterSpacing: 0 }}>{g.rows.length}</span>
                        </td></tr>
                      )}
                      {g.rows.map((r) => {
                        const y = birthYearOf(r.p);
                        const cur = r.pdi.current;
                        const late = r.days == null || r.days > REVIEW_DAYS;
                        return (
                          <tr key={r.id} style={{ borderTop: `1px solid ${RS.lineSoft}` }} data-testid={`dev-row-${r.id}`}>
                            <td style={{ padding: "6px 8px 6px 14px", textAlign: "center", fontWeight: 700, color: RS.granate }}>{r.p.jersey_number ?? "—"}</td>
                            <td style={{ fontWeight: 600 }}>
                              <Link to={`/PlayerProfile?id=${r.id}`} style={{ color: RS.ink }}>{playerFullName(r.p)}</Link>
                              {r.injury && <span style={{ fontSize: 10.5, color: LOSS, fontWeight: 700, marginLeft: 6 }}>{r.injury.expected_return ? t("Lesión · vuelve {d}", { d: format(new Date(r.injury.expected_return), "dd/MM") }) : t("Lesión")}</span>}
                            </td>
                            <td>{juvenilYear(y, CURRENT_SEASON) ? <YearBadge year={y} sm /> : <span style={{ color: RS.muted }}>{y ?? "—"}</span>}</td>
                            <td style={{ fontSize: 11, color: RS.muted, fontWeight: 700 }}>{t(POS_LABEL[r.p.position] || "—")}</td>
                            <td><Link to={`/PlayerProfile?id=${r.id}&tab=pdi`}><Bars360 e={r.e360} /></Link></td>
                            <td style={{ maxWidth: 260 }}>
                              <div className="truncate" style={{ fontSize: 12, color: cur ? RS.ink : WARN }} title={cur ? [t(cur.competency_text || ""), cur.objective].filter(Boolean).join(" · ") : ""}>
                                {cur ? (t(cur.competency_text || "") || cur.objective) : t("Sin objetivos")}
                              </div>
                              {r.pdi.total > 0 && (
                                <div className="flex flex-wrap" style={{ gap: 3, marginTop: 2 }}>
                                  {PDI_CHIPS.filter(([k]) => r.pdi[k]).map(([k, l, bg, fg]) => (
                                    <span key={k} style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{t(l, { n: r.pdi[k] })}</span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                              {r.rate ? <>★ {fmt1(r.rate.avg)} <span style={{ color: r.rate.trend === "up" ? WIN : r.rate.trend === "down" ? LOSS : RS.muted }}>{r.rate.trend === "up" ? "▲" : r.rate.trend === "down" ? "▼" : "="}</span></> : <span style={{ color: RS.faint }}>—</span>}
                            </td>
                            <td style={{ textAlign: "right", color: r.level === "alert" ? LOSS : r.level === "warn" ? WARN : RS.ink }}>{r.pctMin == null ? "—" : `${Math.round(r.pctMin)} %`}</td>
                            <td style={{ textAlign: "right", color: r.attPct != null && r.attPct < 70 ? LOSS : RS.ink }}>{r.attPct == null ? "—" : `${r.attPct} %`}</td>
                            <td style={{ textAlign: "right", paddingRight: 14, fontSize: 11.5, color: late ? LOSS : RS.muted, whiteSpace: "nowrap" }}>{revText(r)}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ padding: "8px 14px", borderTop: `1px solid ${RS.lineSoft}`, fontSize: 11.5, color: RS.muted, margin: 0 }}>
              {t("360 = media de la última evaluación (1–10) y sus 4 áreas: técnica, táctica, física y mental · Partidos = media de la valoración del postpartido (1–3) y tendencia de los 3 últimos · Revisado = último cambio en su 360 o en su plan; en rojo, más de 60 días.")}
            </p>
          </div>

          <div className="flex flex-col" style={{ flex: "1 1 300px", maxWidth: 360, minWidth: 0, gap: 12 }}>
            <div className="rs2-card" style={{ overflow: "hidden" }} data-testid="dev-review">
              <Head title={t("Por revisar")} right={<span style={{ color: RS.muted }}>{toReview.length}</span>} />
              <div className="flex flex-col" style={{ padding: "8px 14px", gap: 5, fontSize: 12.5 }}>
                {toReview.length === 0 ? <span style={{ color: WIN, fontWeight: 600 }}>{t("Todos revisados en los últimos 60 días")}</span>
                  : toReview.slice(0, 6).map((r) => (
                    <Link key={r.id} to={`/PlayerProfile?id=${r.id}&tab=pdi`}>
                      <b style={{ color: LOSS }}>{playerFullName(r.p)}</b>{" "}
                      <span style={{ color: RS.muted, fontSize: 11.5 }}>· {r.days == null ? t("sin objetivos ni 360") : t("{n} días sin revisar", { n: r.days })}</span>
                    </Link>
                  ))}
                {toReview.length > 6 && <span style={{ fontSize: 11.5, color: RS.muted }}>{t("y {n} más", { n: toReview.length - 6 })}</span>}
              </div>
            </div>

            <div className="rs2-card" style={{ overflow: "hidden" }} data-testid="dev-worked">
              <Head title={t("Lo que más se trabaja")} />
              <div className="flex flex-col" style={{ padding: "8px 14px", gap: 6, fontSize: 12.5 }}>
                {topWorked.length === 0 ? <span style={{ color: RS.muted }}>{t("Ningún objetivo en «trabajando».")}</span> : topWorked.map((w) => (
                  <div key={w.label} className="flex items-center" style={{ gap: 8 }}>
                    <span className="truncate" style={{ flex: 1 }} title={w.label}>{w.label}</span>
                    <span style={{ width: 80, height: 6, background: RS.lineSoft, borderRadius: 9, overflow: "hidden", flexShrink: 0 }}><span style={{ display: "block", width: `${(w.n / maxWorked) * 100}%`, height: "100%", background: RS.granate }} /></span>
                    <b style={{ width: 18, textAlign: "right" }}>{w.n}</b>
                  </div>
                ))}
                <span style={{ fontSize: 11.5, color: RS.muted }}>{t("Objetivos «trabajando» de la plantilla. Sirve para elegir contenidos de las sesiones.")}</span>
              </div>
            </div>

            <div className="rs2-card" style={{ overflow: "hidden" }} data-testid="dev-improved">
              <Head title={t("Mejorados últimamente")} />
              <div className="flex flex-col" style={{ padding: "8px 14px", gap: 6, fontSize: 12.5 }}>
                {latestImproved.length === 0 ? <span style={{ color: RS.muted }}>{t("Todavía ninguno.")}</span> : latestImproved.map((g) => (
                  <div key={g.id}>
                    <b>{nameOf(g.player_id)}</b>
                    {g.improved_date && <span style={{ color: RS.muted, fontSize: 11.5 }}> · {format(new Date(g.improved_date), "d MMM", { locale })}</span>}
                    <div style={{ fontSize: 12, color: RS.ink2 }}>{t(g.competency_text || "") || g.objective}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
