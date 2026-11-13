// Mi equipo → Partidos. Rediseño del 13/11/2026 con el diseño rs2 (maqueta «Maqueta Mi equipo · Partidos y Desarrollo»,
// aprobada por Nacho: «ok todo»). Cálculos puros en src/lib/teamPages.js; los pasos de cada partido, en src/lib/matchSteps.js.
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useSelectedTeam } from "@/lib/useSelectedTeam";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { useMatchStatus, reasonLabel } from "@/lib/matchStatus";
import { isCancelled } from "@/lib/eventCancel";
import { matchSteps } from "@/lib/matchSteps";
import { minPlayersOf } from "@/lib/matchFormat";
import { playedLeague, leagueForm, record, standingOf } from "@/lib/teamsOverview";
import { splitMatches, scorersText, teamEvalAvg, homeAway, goalsByMatch } from "@/lib/teamPages";
import { getCategoryLabel } from "@/components/fcfCategories";
import CreateEventDialog from "@/components/myteam/CreateEventDialog";
import MatchResultPill from "@/components/calendar/MatchResultPill";
import TeamTop, { NoTeam } from "@/components/myteam/TeamTop";
import { Page, RS } from "@/components/rs2/kit";
import { Head, Label, Big, FormChips, WIN, LOSS } from "@/components/rs2/dashParts";
import { C as clubColor } from "@/lib/brand";
import { useT, useFormat, msg } from "@/i18n";

const TYPES = [
  { k: "all", l: msg("Todos") },
  { k: "partido_liga", l: msg("Liga") },
  { k: "partido_amistoso", l: msg("Amistosos") },
  { k: "torneo", l: msg("Torneos") },
];
const STEP_LETTERS = { convocatoria: ["C", msg("Convocatoria")], tactica: ["P", msg("Preparación")], acta: ["A", msg("Acta")], postpartido: ["V", msg("Postpartido")] };
const WARN = "#B45309";
const PAGE = 12;

const fmt1 = (n) => (n == null ? "—" : String(Math.round(n * 10) / 10).replace(".", ","));

function Kpi({ value, label, sub, color = RS.granate, testId, children }) {
  return (
    <div className="rs2-card" style={{ flex: "1 1 160px", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10 }} data-testid={testId}>
      {children || <span style={{ whiteSpace: "nowrap" }}><Big size={24} color={color}>{value}</Big></span>}
      <span style={{ fontSize: 12, color: RS.ink2, lineHeight: 1.15 }}>{label}{sub && <span style={{ display: "block", fontSize: 11, color: RS.muted }}>{sub}</span>}</span>
    </div>
  );
}

function Seg({ options, value, onChange, testPrefix }) {
  const t = useT();
  return (
    <div className="flex" style={{ gap: 3, background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 999, padding: 2 }} role="group">
      {options.map((o) => (
        <button key={o.k} type="button" onClick={() => onChange(o.k)} aria-pressed={value === o.k} data-testid={`${testPrefix}-${o.k}`}
          style={{ fontSize: 12, padding: "4px 11px", whiteSpace: "nowrap", borderRadius: 999, border: 0, fontWeight: value === o.k ? 700 : 400, background: value === o.k ? RS.granate : "none", color: value === o.k ? "#fff" : RS.ink2 }}>{t(o.l)}</button>
      ))}
    </div>
  );
}

/** Cuatro cuadraditos C · P · A · V: verde = hecho, naranja = lo que falta ahora, gris = más adelante */
function Steps({ steps, eventId }) {
  const t = useT();
  return (
    <span className="inline-flex" style={{ gap: 3 }} data-testid={`match-steps-${eventId}`}>
      {steps.map((s) => {
        const [letter, name] = STEP_LETTERS[s.key];
        const sub = s.sub ? t(s.sub.key, s.sub.vars) : "";
        const st = s.state === "done" ? { background: WIN, color: "#fff" }
          : s.state === "now" ? { background: "#FFF7ED", color: "#9A3412", border: "1px solid #F5C2A0" }
          : { background: "#F3ECEB", color: "#B7AAAC" };
        return (
          <Link key={s.key} to={`/MatchDetail?id=${eventId}&tab=${s.key}`} title={`${t(name)} · ${sub}`} data-state={s.state}
            style={{ width: 18, height: 18, borderRadius: 5, fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", ...st }}>{letter}</Link>
        );
      })}
    </span>
  );
}

const chip = (text, ok) => (
  <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 999, background: ok ? "#DCFCE7" : "#F3ECEB", color: ok ? "#166534" : RS.muted, whiteSpace: "nowrap" }}>{text}</span>
);

export default function TeamMatches() {
  const t = useT();
  const { locale } = useFormat();
  const navigate = useNavigate();
  const { selectedTeamId } = useSelectedTeam();
  const { canManageTeam } = useTeamAccess();
  const [type, setType] = useState("all");
  const [more, setMore] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: convocs = [] } = useQuery({ queryKey: ["convocatorias_all"], queryFn: () => base44.entities.Convocatoria.list() });
  const { data: stats = [] } = useQuery({ queryKey: ["matchstats_all"], queryFn: () => base44.entities.MatchStats.list() });
  const { data: plans = [] } = useQuery({
    queryKey: ["matchplans-lite", selectedTeamId],
    queryFn: () => base44.entities.MatchPlan.pick(["event_id", "lineup", "formation"], { team_id: selectedTeamId }),
    enabled: !!selectedTeamId,
  });
  const { data: standing } = useQuery({
    queryKey: ["fcf-standing", selectedTeamId],
    queryFn: async () => {
      const r = await fetch(`/api/sync-fcf?standings=${selectedTeamId}`, { credentials: "include" });
      if (!r.ok) throw new Error("error");
      return r.json();
    },
    enabled: !!selectedTeamId, staleTime: 1000 * 60 * 30, retry: 1,
  });
  const { pending, soft } = useMatchStatus();

  const team = teams.find((x) => x.id === selectedTeamId);
  const canManage = !!selectedTeamId && canManageTeam(selectedTeamId);
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const convBy = useMemo(() => new Map(convocs.map((c) => [c.event_id, c])), [convocs]);
  const planBy = useMemo(() => new Map(plans.map((p) => [p.event_id, p])), [plans]);
  const statsBy = useMemo(() => {
    const m = new Map();
    for (const s of stats) { if (!m.has(s.event_id)) m.set(s.event_id, []); m.get(s.event_id).push(s); }
    return m;
  }, [stats]);

  const now = new Date();
  const live = events.filter((e) => !isCancelled(e));
  const { past, next } = splitMatches(live, selectedTeamId, { now, type });
  const league = playedLeague(events, selectedTeamId, now);
  const rec = record(league);
  const form = leagueForm(league);
  const st = standingOf(standing);
  const split = homeAway(past);
  const mirror = goalsByMatch(past, 8);
  const pendingList = past.filter((e) => pending.has(e.id));

  const stepsOf = (ev) => matchSteps({
    event: ev, conv: convBy.get(ev.id), plan: planBy.get(ev.id), stats: statsBy.get(ev.id) || [],
    pending: pending.get(ev.id) || soft.get(ev.id) || [], minPlayers: minPlayersOf(ev, team), now,
  });
  const shown = more ? past : past.slice(0, PAGE);
  const dayFmt = (d) => format(new Date(d), "EEE d MMM", { locale });
  const nextFmt = (d) => format(new Date(d), "EEE d · HH:mm", { locale });
  const maxGoals = Math.max(1, ...mirror.map((m) => Math.max(m.gf, m.ga)));

  if (!selectedTeamId) {
    return <Page testId="team-matches"><div className="rs2-wrap flex flex-col" style={{ gap: 12, maxWidth: 1440 }}><TeamTop kicker={t("Mi equipo")} title={t("Partidos")} teams={teams} /><NoTeam teams={teams} /></div></Page>;
  }

  const kicker = [t("Mi equipo"), team?.name, getCategoryLabel(team?.category) !== team?.name && getCategoryLabel(team?.category), standing?.competition && [standing.competition, standing.group].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  const firstPending = pendingList[pendingList.length - 1];

  return (
    <Page testId="team-matches">
      <div className="rs2-wrap flex flex-col" style={{ gap: 12, maxWidth: 1440 }}>
        <CreateEventDialog open={createOpen} onOpenChange={setCreateOpen} date={new Date()} teamId={selectedTeamId} />
        <TeamTop kicker={kicker} title={t("Partidos")} teams={teams}>
          {canManage && (
            <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center" data-testid="matches-new"
              style={{ gap: 5, fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: 0, background: RS.granate, color: "#fff" }}>
              <Plus className="w-4 h-4" /> {t("Nuevo partido")}
            </button>
          )}
        </TeamTop>

        {/* Cifras de la liga */}
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          <Kpi testId="matches-kpi-record" value={`${rec.w}-${rec.d}-${rec.l}`} label={t("de liga")}
            sub={rec.n ? t("{n} partidos · {p} % de victorias", { n: rec.n, p: Math.round((rec.w / rec.n) * 100) }) : t("Sin partidos jugados")} />
          <Kpi testId="matches-kpi-goals" value={`${rec.gf}-${rec.ga}`} label={t("goles")}
            sub={rec.n ? t("{a} a favor · {b} en contra por partido", { a: fmt1(rec.gf / rec.n), b: fmt1(rec.ga / rec.n) }) : ""} />
          {st && <Kpi testId="matches-kpi-pos" value={`${st.pos}.º`} label={t("en la clasificación")}
            sub={st.gap ? t("a {n} puntos del líder", { n: st.gap }) : t("Líder")} />}
          {form.length > 0 && <Kpi testId="matches-kpi-form" label={t("racha")}><FormChips form={form} size={16} /></Kpi>}
          <Kpi testId="matches-kpi-pending" value={pendingList.length} label={t(pendingList.length === 1 ? "partido por cerrar" : "partidos por cerrar")} color={pendingList.length ? WARN : WIN}
            sub={firstPending ? [firstPending.fcf_jornada ? `J${firstPending.fcf_jornada}` : dayFmt(firstPending.date), (pending.get(firstPending.id) || [])[0] && reasonLabel(pending.get(firstPending.id)[0], t)].filter(Boolean).join(" · ") : t("Todo cerrado")} />
        </div>

        <div className="flex flex-wrap items-start" style={{ gap: 12 }}>
          {/* Jugados */}
          <div className="rs2-card" style={{ flex: "999 1 640px", minWidth: 0, overflow: "hidden" }} data-testid="matches-played">
            <Head title={t("Jugados")} right={<span style={{ color: RS.muted }}>{past.length}</span>} />
            <div className="flex flex-wrap items-center" style={{ gap: 8, padding: "8px 14px" }}>
              <Seg options={TYPES} value={type} onChange={(k) => { setType(k); setMore(false); }} testPrefix="matches-type" />
              <span style={{ fontSize: 11.5, color: RS.muted, marginLeft: "auto" }}>
                {t("Pasos: C convocatoria · P preparación · A acta · V valoración")} · <b style={{ color: "#9A3412" }}>{t("naranja = falta")}</b>
              </span>
            </div>
            {past.length === 0 ? <p style={{ padding: "18px 14px", color: RS.muted, fontSize: 13 }}>{t("No hay partidos jugados.")}</p> : (
              <div className="overflow-x-auto">
                <table className="rs2-tbl rs2-left" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead><tr>
                    <th style={{ paddingLeft: 14 }}>{t("J.")}</th><th>{t("Fecha")}</th><th />
                    <th>{t("Rival")}</th><th>{t("Resultado")}</th><th>{t("Goleadores")}</th><th>{t("Pasos")}</th>
                    <th>{t("Jugador del partido")}</th><th style={{ textAlign: "right", paddingRight: 14 }}>{t("Equipo")}</th>
                  </tr></thead>
                  <tbody>
                    {shown.map((ev) => {
                      const mvp = playersById.get(ev.mvp_player_id);
                      const evAvg = teamEvalAvg(ev);
                      const goals = scorersText(ev, playersById, t("p.p."));
                      return (
                        <tr key={ev.id} style={{ borderTop: `1px solid ${RS.lineSoft}`, cursor: "pointer" }} onClick={(e) => { if (!e.target.closest("a")) navigate(`/MatchDetail?id=${ev.id}`); }} data-testid={`match-row-${ev.id}`}>
                          <td style={{ padding: "6px 8px 6px 14px", color: RS.muted, fontSize: 11.5 }}>{ev.type === "partido_liga" ? (ev.fcf_jornada ? `J${ev.fcf_jornada}` : "—") : ev.type === "torneo" ? "T" : "A"}</td>
                          <td style={{ fontWeight: 700, color: RS.granateDark, whiteSpace: "nowrap" }}>{dayFmt(ev.date)}</td>
                          <td style={{ fontSize: 11, color: RS.muted }}>{ev.is_home === false ? t("Fuera") : t("Casa")}</td>
                          <td style={{ fontWeight: 600 }}>{ev.opponent || ev.title || "—"}</td>
                          <td><MatchResultPill event={ev} size="sm" /></td>
                          <td style={{ fontSize: 11.5, color: RS.ink2, maxWidth: 200 }} className="truncate" title={goals}>{goals || <span style={{ color: RS.faint }}>—</span>}</td>
                          <td><Steps steps={stepsOf(ev)} eventId={ev.id} /></td>
                          <td style={{ fontSize: 11.5 }}>{mvp ? `🏅 ${[mvp.first_name, mvp.last_name].filter(Boolean).join(" ")}` : <span style={{ color: RS.faint }}>—</span>}</td>
                          <td style={{ textAlign: "right", paddingRight: 14, fontSize: 12, color: evAvg == null ? WARN : RS.ink }}>{evAvg == null ? t("sin valorar") : `★ ${fmt1(evAvg)}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap items-center" style={{ gap: 8, padding: "8px 14px", borderTop: `1px solid ${RS.lineSoft}`, fontSize: 11.5, color: RS.muted }}>
              {past.length > PAGE && (
                <button type="button" onClick={() => setMore((v) => !v)} style={{ fontWeight: 700, color: RS.granate, background: "none", border: 0, padding: 0 }} data-testid="matches-more">
                  {more ? t("Ver menos") : t("… {n} partidos más", { n: past.length - PAGE })}
                </button>
              )}
              <span style={{ marginLeft: "auto" }}>{t("Equipo = media de las notas del postpartido (1–3)")}</span>
            </div>
          </div>

          {/* Columna derecha */}
          <div className="flex flex-col" style={{ flex: "1 1 320px", maxWidth: 380, minWidth: 0, gap: 12 }}>
            <div className="rs2-card" style={{ overflow: "hidden" }} data-testid="matches-next">
              <Head title={t("Próximos")} />
              {next.length === 0 ? <p style={{ padding: "12px 14px", color: RS.muted, fontSize: 12.5 }}>{t("No hay partidos programados.")}</p>
                : next.slice(0, 3).map((ev, i) => {
                  const conv = convBy.get(ev.id);
                  const n = conv?.player_ids?.length || 0;
                  const plan = planBy.get(ev.id);
                  const line = (plan?.lineup || []).filter(Boolean).length;
                  const minP = minPlayersOf(ev, team);
                  return (
                    <Link key={ev.id} to={`/MatchDetail?id=${ev.id}`} className="block" data-testid={`next-${ev.id}`}
                      style={{ padding: "8px 14px", borderTop: `1px solid ${RS.lineSoft}`, background: i === 0 ? clubColor.primarySoft : "none" }}>
                      <div className="flex items-baseline" style={{ gap: 8 }}>
                        <b style={{ color: RS.granate, fontSize: 12.5, width: 96, flexShrink: 0 }}>{nextFmt(ev.date)}</b>
                        <span className="truncate" style={{ flex: 1, fontWeight: 600, fontSize: 12.5 }}>{ev.opponent || ev.title}</span>
                        <span style={{ fontSize: 11, color: RS.muted }}>{ev.is_home === false ? t("Fuera") : t("Casa")}</span>
                      </div>
                      <div className="flex flex-wrap" style={{ gap: 5, marginTop: 4, paddingLeft: 104 }}>
                        {chip(n ? (conv?.notified ? t("Convocatoria {n} · avisada", { n }) : t("Convocatoria {n} · sin avisar", { n })) : t("Sin convocatoria"), n >= minP && conv?.notified)}
                        {chip(line >= minP ? t("{f} listo", { f: plan?.formation || t("Alineación") }) : line ? t("Alineación {a}/{b}", { a: line, b: minP }) : t("Sin alineación"), line >= minP)}
                      </div>
                    </Link>
                  );
                })}
              {next[0] && canManage && (
                <div style={{ padding: "7px 14px", borderTop: `1px solid ${RS.lineSoft}` }}>
                  <Link to={`/MatchDetail?id=${next[0].id}`} style={{ fontSize: 12, fontWeight: 700, color: RS.granate }} data-testid="matches-prepare">{t("Preparar el próximo partido")} ›</Link>
                </div>
              )}
            </div>

            {mirror.length > 0 && (
              <div className="rs2-card" style={{ overflow: "hidden" }} data-testid="matches-mirror">
                <Head title={t("Partido a partido")} />
                <div className="flex flex-col" style={{ padding: "10px 14px", gap: 5 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", fontSize: 10, color: RS.muted, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>
                    <span style={{ textAlign: "right" }}>{t("Encajados")}</span><span /><span>{t("Marcados")}</span>
                  </div>
                  {mirror.map((m) => (
                    <Link key={m.id} to={`/MatchDetail?id=${m.id}`} style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 6, alignItems: "center", fontSize: 11 }}>
                      <span className="flex items-center justify-end" style={{ gap: 4 }}>
                        <span style={{ color: RS.muted }}>{m.ga}</span>
                        <span style={{ height: 9, width: `${(m.ga / maxGoals) * 100}%`, background: RS.naranja, borderRadius: 3 }} />
                      </span>
                      <span style={{ textAlign: "center", color: RS.muted }}>{m.label}</span>
                      <span className="flex items-center" style={{ gap: 4 }}>
                        <span style={{ height: 9, width: `${(m.gf / maxGoals) * 100}%`, background: RS.granate, borderRadius: 3 }} />
                        <b>{m.gf}</b>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {(split.home.n > 0 || split.away.n > 0) && (
              <div className="rs2-card" style={{ overflow: "hidden" }} data-testid="matches-homeaway">
                <Head title={t("En casa y fuera")} />
                <div style={{ padding: "10px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
                  {[["home", t("En casa")], ["away", t("Fuera")]].map(([k, l]) => (
                    <div key={k} style={{ border: `1px solid ${RS.line}`, borderRadius: 10, padding: "8px 10px" }}>
                      <Label>{l}</Label>
                      <div style={{ marginTop: 3 }}><Big size={22} color={split[k].w >= split[k].l ? RS.granate : LOSS}>{`${split[k].w}-${split[k].d}-${split[k].l}`}</Big></div>
                      <div style={{ color: RS.muted, fontSize: 11.5 }}>{t("{a} goles · {b} encajados", { a: split[k].gf, b: split[k].ga })}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
