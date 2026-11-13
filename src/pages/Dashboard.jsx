// Panel de control. Rediseño del 12/11/2026 con el diseño «rs2» (maqueta «Maqueta Panel · RS Manager», aprobada por Nacho:
// «ok me parece bien», con la Agenda del fin de semana como primera pestaña de abajo). Cálculos puros en src/lib/dashboardStats.js.
import { sortTeams, compareTeams, isF7Team } from "@/lib/teamOrder";
import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { UserCog, Trophy, ClipboardCheck, Users, Target } from "lucide-react";
import { format, startOfDay, addDays, isSameDay, startOfWeek, endOfDay, subDays } from "date-fns";
import { Link } from "react-router-dom";
import FCFClassificationsPanel from "../components/dashboard/FCFClassificationsPanel";
import WeekendAgenda from "../components/dashboard/WeekendAgenda";
import EditEventDialog from "@/components/myteam/EditEventDialog";
import EventWeather from "@/components/EventWeather";
import MatchResultPill from "@/components/calendar/MatchResultPill";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { playerFullName } from "@/lib/playerName";
import { useCountedStats } from "@/lib/matchStatus";
import { convocatoriaAlert } from "@/lib/matchTiming";
import { isCancelled, cancelText } from "@/lib/eventCancel";
import { groupPendingByTeam } from "@/lib/pendingByTeam";
import PendingByTeamDialog from "@/components/dashboard/PendingByTeamDialog";
import { useTrainingStatus } from "@/lib/trainingStatus";
import { usePendingUsersCount } from "@/lib/pendingUsers";
import { fromStored } from "@/lib/goalTypes";
import { scoreText, scoreTitle, playsAway, matchResult } from "@/lib/matchScore";
import { seasonRecord, attendanceSummary, topBy, returningSoon, wdl } from "@/lib/dashboardStats";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { Page, RS } from "@/components/rs2/kit";
import { Label, Big, Head, MoreLink, Countdown, FormChips, PendingCards, WIN, LOSS, DRAW } from "@/components/rs2/dashParts";
import { useT, useDateLocale, msg } from "@/i18n";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const isMatch = (t) => MATCH_TYPES.includes(t);
const TYPE_LABEL = { partido_liga: msg("Liga"), partido_amistoso: msg("Amistoso"), torneo: msg("Torneo") };
const SCOPE_KEY = "rs_dash_scope";

function groupOf(team) {
  const n = (team.name || "").toLowerCase();
  if (n.includes("primer")) return "Primer equipo";
  if (n.includes("juvenil")) return "Juvenil";
  if (n.includes("cadet")) return "Cadete";
  if (n.includes("infantil")) return "Infantil";
  return "Fútbol 7";
}
const GROUPS = [["Todos", msg("Todos")], ["Primer equipo", msg("Primer equipo")], ["Juvenil", msg("Juvenil")], ["Cadete", msg("Cadete")], ["Infantil", msg("Infantil")], ["Fútbol 7", msg("Fútbol 7")]];

function TeamCard({ team, count }) {
  const t = useT();
  const { data } = useQuery({
    queryKey: ["fcf-standing", team.id],
    queryFn: async () => {
      const r = await fetch(`/api/sync-fcf?standings=${team.id}`, { credentials: "include" });
      if (!r.ok) throw new Error("error");
      return r.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
  const rows = data?.rows || [];
  const me = rows.find((r) => r.teamId === data?.ourTeamId);
  const form = (me?.form || []).slice().reverse().slice(-5);
  return (
    <Link to={`/TeamDetail?id=${team.id}`} className="rs2-card flex flex-col min-w-0 hover:shadow-md transition-shadow" style={{ padding: "8px 10px", gap: 3, borderRadius: 9 }} data-testid={`dash-team-${team.id}`}>
      <div className="flex items-baseline min-w-0" style={{ gap: 6 }}>
        <span className="rs2-display truncate" style={{ fontSize: 13, color: RS.ink }}>{team.name}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: RS.faint, whiteSpace: "nowrap" }}>{t("{count} jug.", { count })}</span>
      </div>
      {data?.competition && <div className="truncate" style={{ fontSize: 10, color: RS.muted }}>{[data.competition, data.group].filter(Boolean).join(" · ")}</div>}
      <div className="flex items-center" style={{ gap: 6 }}>
        <Big size={20}>{me ? `${me.pos}º` : "—"}</Big>
        <span style={{ fontSize: 11, color: RS.muted }}>{me ? t("{pts} pts", { pts: me.pts }) : ""}</span>
        <span style={{ marginLeft: "auto" }}><FormChips form={form} /></span>
      </div>
    </Link>
  );
}

// Una línea de líderes (los 3 primeros) por dato
function LeaderCol({ label, rows, value, teamShort }) {
  return (
    <div className="min-w-0">
      <Label style={{ marginBottom: 3 }}>{label}</Label>
      {rows.length === 0 && <p style={{ fontSize: 12, color: RS.faint }}>—</p>}
      {rows.map((r, i) => (
        <div key={r.player.id} className="flex items-center" style={{ gap: 6, padding: "2px 0" }}>
          <span style={{ width: 14, fontSize: 11, color: RS.faint, fontWeight: 700 }}>{i + 1}</span>
          <Link to={`/PlayerProfile?id=${r.player.id}`} className="truncate hover:underline" style={{ flex: 1, minWidth: 0, fontSize: 12, color: RS.ink, fontWeight: i === 0 ? 700 : 500 }}>{playerFullName(r.player)}</Link>
          <span className="truncate" style={{ fontSize: 10, color: RS.faint, maxWidth: 70 }}>{teamShort(r.player.team_id)}</span>
          <span className="rs2-display tabular-nums" style={{ fontSize: 14, color: RS.granate, minWidth: 30, textAlign: "right" }}>{value(r)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const t = useT();
  const dfl = useDateLocale();
  const { isCoordinator, coachTeamIds, canManageTeam } = useTeamAccess();
  const pendingUsersCount = usePendingUsersCount(isCoordinator);
  const [tab, setTab] = useState("agenda");
  const [group, setGroup] = useState("Todos");

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: fields = [] } = useQuery({ queryKey: ["fields"], queryFn: () => base44.entities.Field.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: rawStats = [] } = useQuery({ queryKey: ["matchstats"], queryFn: () => base44.entities.MatchStats.list() });
  const { data: convocs = [] } = useQuery({ queryKey: ["convocatorias_all"], queryFn: () => base44.entities.Convocatoria.list() });
  // Lesiones: solo para «vuelven esta semana»; quien no puede leerlas no ve ese dato
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries"], queryFn: () => base44.entities.Injury.list().catch(() => []), retry: false });
  const matchStats = useCountedStats(rawStats);
  const { pending: pendingTrainings } = useTrainingStatus();

  const myIds = useMemo(() => new Set(coachTeamIds || []), [coachTeamIds]);
  const hasMine = myIds.size > 0;
  // «Todo el club / Mis equipos»: quien entrena elige (se recuerda); coordinación empieza por todo el club y el resto por sus equipos
  const [scopePick, setScopePick] = useState(() => { try { return localStorage.getItem(SCOPE_KEY) || ""; } catch { return ""; } });
  const scope = hasMine ? (scopePick === "mine" || scopePick === "club" ? scopePick : isCoordinator ? "club" : "mine") : "club";
  const pickScope = (s) => { setScopePick(s); try { localStorage.setItem(SCOPE_KEY, s); } catch { /* sin almacenamiento */ } };
  const mineMode = scope === "mine";
  const inScope = (teamId) => !mineMode || myIds.has(teamId);

  const teamName = (id) => teams.find((x) => x.id === id)?.name || "";
  const teamShort = teamName;
  const now = new Date();
  const today = startOfDay(now);
  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const cancelledIds = useMemo(() => new Set(events.filter(isCancelled).map((e) => e.id)), [events]);

  // Próximo partido (del ámbito elegido) y los siguientes
  const upcoming = events.filter((e) => new Date(e.date) >= now && !isCancelled(e) && isMatch(e.type) && inScope(e.team_id)).sort((a, b) => new Date(a.date) - new Date(b.date));
  const next = upcoming[0];
  const after = upcoming.slice(1, 4);
  const nextMine = hasMine && !mineMode ? upcoming.find((e) => myIds.has(e.team_id)) : null;
  const convOf = (e) => convocs.find((c) => c.event_id === e?.id);
  const nextConv = convOf(next);

  // Temporada
  const played = events.filter((e) => isMatch(e.type) && e.score_home != null && e.score_away != null && inScope(e.team_id));
  const rec = seasonRecord(played);

  // Asistencia de los últimos 30 días
  const att = useMemo(() => attendanceSummary(attendance, eventsById, { now, skip: cancelledIds, inScope }),
    [attendance, eventsById, cancelledIds, mineMode, myIds]);
  const attColor = att.rate == null ? RS.faint : att.rate >= 80 ? WIN : att.rate >= 60 ? "#B45309" : LOSS;

  // Datos del club
  const scopeTeams = teams.filter((x) => inScope(x.id));
  const scopePlayers = players.filter((p) => inScope(p.team_id));
  const f7Count = scopeTeams.filter(isF7Team).length;
  const activePlayers = scopePlayers.filter((p) => p.status === "activo").length;
  const injured = scopePlayers.filter((p) => p.status === "lesionado").length;
  const scopePlayerIds = new Set(scopePlayers.map((p) => p.id));
  const back = returningSoon(injuries.filter((i) => scopePlayerIds.has(i.player_id)), { now }).length;

  // Pendientes
  const [seasonYear] = CURRENT_SEASON.split("-");
  const seasonStart = new Date(Number(seasonYear), 7, 1);
  const matchLink = (e, tb) => `/MatchDetail?id=${e.id}&teamId=${e.team_id}${tb ? `&tab=${tb}` : ""}`;
  const withConv = new Set(convocs.filter((c) => (c.player_ids || []).length > 0).map((c) => c.event_id));
  // Los amistosos sin gestionar no generan alerta (en la lista de partidos sí aparecen marcados como pendientes)
  const pendingMatchLists = (teamOk) => {
    const pendMatch = (e) => isMatch(e.type) && e.type !== "partido_amistoso" && !isCancelled(e) && teamOk(e.team_id);
    // Convocatoria: se avisa solo cuando faltan 24 h o menos, o si el partido ya se jugó sin convocar
    const convAlert = (e) => (pendMatch(e) ? convocatoriaAlert(e, withConv.has(e.id), now) : null);
    const byDate = (a, b) => new Date(a.date) - new Date(b.date);
    const playedOver = events.filter((e) => pendMatch(e) && new Date(e.date) >= seasonStart && new Date(e.date).getTime() < now.getTime() - 2 * 3600 * 1000);
    return {
      soon: events.filter((e) => convAlert(e) === "soon").sort(byDate),
      played: events.filter((e) => new Date(e.date) >= seasonStart && convAlert(e) === "played").sort(byDate),
      result: playedOver.filter((e) => e.score_home == null || e.score_away == null),
      goals: playedOver.filter((e) => (e.goal_events || []).some((g) => !fromStored(g).phase)),
    };
  };
  const { soon: noConv, played: noConvPlayed, result: noResult, goals: noClass } = pendingMatchLists(inScope);
  const myPendingTr = [...pendingTrainings.values()].filter((e) => inScope(e.team_id)).sort((a, b) => new Date(b.date) - new Date(a.date));

  // Coordinación: al pulsar una alerta se abre el listado por equipos de todo el club (los avisos no cambian)
  const [pendingList, setPendingList] = useState(null); // null (cerrado) | "all" | "trainings" | "matches"
  const [editEvent, setEditEvent] = useState(null); // evento de la planificación semanal que se está editando
  const openList = (kind) => (isCoordinator ? () => setPendingList(kind) : undefined);
  const pendingRows = pendingList
    ? groupPendingByTeam({ trainings: [...pendingTrainings.values()], matches: pendingMatchLists(() => true), teams, compare: compareTeams })
    : [];
  const pendingItems = [
    { key: "att", icon: ClipboardCheck, count: myPendingTr.length, label: myPendingTr.length === 1 ? t("entreno sin asistencia") : t("entrenos sin asistencia"), cta: msg("Pasar lista"), onClick: openList("trainings"), to: myPendingTr[0] ? `/MyTeam/Attendance?eventId=${myPendingTr[0].id}` : "/MyTeam/Attendance", tone: "#B45309" },
    { key: "conv", icon: Users, count: noConv.length, label: noConv.length === 1 ? t("partido en 24 h sin convocatoria") : t("partidos en 24 h sin convocatoria"), cta: msg("Convocar"), onClick: openList("matches"), to: noConv[0] ? matchLink(noConv[0], "convocatoria") : "/Calendar", tone: RS.granate },
    { key: "convPlayed", icon: Users, count: noConvPlayed.length, label: noConvPlayed.length === 1 ? t("partido jugado sin convocatoria") : t("partidos jugados sin convocatoria"), cta: msg("Revisar"), onClick: openList("matches"), to: noConvPlayed[0] ? matchLink(noConvPlayed[0], "convocatoria") : "/Calendar" },
    { key: "res", icon: Trophy, count: noResult.length, label: noResult.length === 1 ? t("partido jugado sin resultado") : t("partidos jugados sin resultado"), cta: msg("Revisar"), onClick: openList("matches"), to: noResult[0] ? matchLink(noResult[noResult.length - 1]) : "/Calendar" },
    { key: "goals", icon: Target, count: noClass.length, label: noClass.length === 1 ? t("partido con goles sin clasificar") : t("partidos con goles sin clasificar"), cta: msg("Clasificar"), onClick: openList("matches"), to: noClass[0] ? matchLink(noClass[0], "acta") : "/Calendar", tone: RS.granate },
    isCoordinator && { key: "users", icon: UserCog, count: pendingUsersCount, label: pendingUsersCount === 1 ? t("usuario por aprobar") : t("usuarios por aprobar"), cta: msg("Revisar"), to: "/Accesos" },
  ].filter((i) => i && i.count > 0);

  // Resultados del último fin de semana (viernes a domingo ya jugados)
  const lastSunday = (() => { const d = startOfDay(now), w = d.getDay(); return w === 0 ? d : w === 6 ? addDays(d, 1) : subDays(d, w); })();
  const weekendStart = subDays(lastSunday, 2); // viernes
  const recent = events
    .filter((e) => isMatch(e.type) && e.score_home != null && e.score_away != null && inScope(e.team_id)
      && new Date(e.date) >= weekendStart && new Date(e.date) <= endOfDay(lastSunday))
    .sort((a, b) => compareTeams(teams.find((x) => x.id === a.team_id) || {}, teams.find((x) => x.id === b.team_id) || {}) || new Date(a.date) - new Date(b.date));
  const isF7 = (e) => { const tm = teams.find((x) => x.id === e.team_id); return tm ? isF7Team(tm) : (e.football_format === "f7" || e.football_format === "f5"); };
  const weekendLabel = `${format(subDays(lastSunday, 1), "d", { locale: dfl })}–${format(lastSunday, "d MMM", { locale: dfl })}`;
  const recentWdl = wdl(recent);

  // Semana actual completa (lunes a domingo)
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEvents = events.filter((e) => inScope(e.team_id) && new Date(e.date) >= weekStart && new Date(e.date) < addDays(weekStart, 7)).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Líderes por modalidad (F7 / F11), los 3 primeros
  const formatByEvent = useMemo(() => new Map(events.map((e) => [e.id, isF7(e) ? "f7" : "f11"])), [events, teams]);
  const leadersFor = (fmt) => {
    const acc = new Map();
    matchStats.forEach((ms) => {
      if ((formatByEvent.get(ms.event_id) || "f11") !== fmt) return;
      const a = acc.get(ms.player_id) || { goals: 0, assists: 0, minutes: 0 };
      a.goals += ms.goals || 0; a.assists += ms.assists || 0; a.minutes += ms.minutes_played || 0;
      acc.set(ms.player_id, a);
    });
    const rows = [...acc.entries()].map(([id, v]) => ({ ...v, player: players.find((p) => p.id === id) })).filter((r) => r.player && inScope(r.player.team_id));
    return { goals: topBy(rows, "goals"), assists: topBy(rows, "assists"), minutes: topBy(rows, "minutes") };
  };
  // Un bloque por formato si hay datos o algún equipo de ese formato en el ámbito
  const leaderBlocks = [["f11", msg("Fútbol 11")], ["f7", msg("Fútbol 7")]].map(([k, l]) => ({ k, l, d: leadersFor(k) }))
    .filter((b) => b.d.goals.length + b.d.assists.length + b.d.minutes.length > 0 || scopeTeams.some((x) => isF7Team(x) === (b.k === "f7")));

  const sortedTeams = useMemo(() => sortTeams(teams), [teams]);
  const shownTeams = sortedTeams.filter((x) => inScope(x.id) && (group === "Todos" || groupOf(x) === group));
  const weekendEvents = events.filter((e) => inScope(e.team_id));

  const evTitle = (e) => (isMatch(e.type) ? (e.opponent ? `${teamName(e.team_id)} – ${e.opponent}` : e.title) : (e.title || t("Entrenamiento")));
  const TYPE_STYLE = { match: ["#FDF2F4", "#F1C9CF", RS.granate], training: [RS.head, RS.line, RS.ink2], other: ["#FFF7ED", "#FAD7B5", "#8A3A00"] };
  const kindOf = (e) => (isMatch(e.type) ? "match" : /entrenamiento|sesion/.test(e.type || "") ? "training" : "other");

  return (
    <Page testId="dashboard">
      <div className="rs2-wrap flex flex-col" style={{ gap: 12, maxWidth: 1440 }}>
        <EditEventDialog open={!!editEvent} onOpenChange={(o) => { if (!o) setEditEvent(null); }} event={editEvent} />
        {isCoordinator && <PendingByTeamDialog open={!!pendingList} onOpenChange={(o) => { if (!o) setPendingList(null); }} rows={pendingRows} kind={pendingList || "all"} />}

        {/* Cabecera */}
        <div className="flex flex-wrap items-end" style={{ gap: 12 }}>
          <div>
            <p className="rs2-label" style={{ letterSpacing: ".16em", textTransform: "uppercase" }}>
              {t("Temporada {replace}", { replace: CURRENT_SEASON.replace("-", "–") })} · <span className="capitalize">{format(now, "EEEE d MMMM", { locale: dfl })}</span>
            </p>
            <h1 style={{ margin: "2px 0 0" }}><span className="rs2-display" style={{ fontSize: 34, color: RS.granate }}>{t("Panel de control")}</span></h1>
          </div>
          {hasMine && (
            <div className="flex" style={{ marginLeft: "auto", gap: 4, background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 999, padding: 3 }} role="group" aria-label={t("Ver")} data-testid="dash-scope">
              {[["club", t("Todo el club")], ["mine", t("Mis equipos")]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => pickScope(k)} aria-pressed={scope === k} data-testid={`dash-scope-${k}`}
                  style={{ fontSize: 12, fontWeight: scope === k ? 700 : 400, padding: "5px 12px", borderRadius: 999, border: 0, background: scope === k ? RS.granate : "none", color: scope === k ? "#fff" : RS.ink2 }}>{l}</button>
              ))}
            </div>
          )}
        </div>

        {/* Pendientes */}
        <PendingCards items={pendingItems} />

        {/* Próximo partido + temporada y asistencia + datos del club */}
        <div className="flex flex-wrap" style={{ gap: 12 }}>
          {next ? (
            <section className="rs2-band flex flex-col" style={{ flex: "1 1 420px", minWidth: 0, padding: "14px 18px", gap: 9, borderRadius: 12 }} data-testid="dash-next">
              <div className="flex items-center" style={{ gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.72)" }}>
                  {mineMode ? t("Próximo partido · mis equipos") : t("Próximo partido del club")}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 11, background: "rgba(255,255,255,.12)", padding: "2px 8px", borderRadius: 999 }}>
                  {t(TYPE_LABEL[next.type] || "")}{next.fcf_jornada ? ` · ${t("Jornada {n}", { n: next.fcf_jornada })}` : ""}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline" style={{ gap: 10 }}>
                <span className="rs2-display" style={{ fontSize: 28, color: "#fff" }}>{teamName(next.team_id) || next.title}</span>
                {next.opponent && <><span style={{ fontSize: 14, color: "rgba(255,255,255,.7)" }}>vs</span><span className="rs2-display" style={{ fontSize: 28, color: "#fff" }}>{next.opponent}</span></>}
              </div>
              <div className="flex flex-wrap" style={{ gap: "4px 16px", fontSize: 12, color: "rgba(255,255,255,.85)" }}>
                <span className="capitalize" style={{ fontWeight: 700 }}>{format(new Date(next.date), "EEE d MMM · HH:mm", { locale: dfl })}</span>
                {nextConv?.callup_time && <span>{t("Convocatoria {time}", { time: nextConv.callup_time })}</span>}
                {next.opponent && <span>{next.is_home === false ? t("Fuera") : t("En casa")}{next.location ? ` · ${next.location}` : ""}</span>}
                {!next.opponent && next.location && <span>{next.location}</span>}
              </div>
              <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
                <Countdown date={next.date} />
                {nextConv && (nextConv.player_ids || []).length > 0 && <span style={{ fontSize: 11, color: "rgba(255,255,255,.75)" }}>{t("{n} convocados", { n: nextConv.player_ids.length })}</span>}
                <div className="flex flex-wrap" style={{ marginLeft: "auto", gap: 8 }}>
                  {canManageTeam(next.team_id) ? (
                    <>
                      <Link to={matchLink(next, "tactica")} style={{ background: RS.naranja, color: "#fff", fontWeight: 700, fontSize: 13, padding: "7px 14px", borderRadius: 8 }}>{t("Preparar partido")}</Link>
                      <Link to={matchLink(next, "convocatoria")} style={{ color: "#fff", fontWeight: 600, fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.35)" }}>{t("Convocatoria")}</Link>
                    </>
                  ) : <Link to={matchLink(next)} style={{ color: "#fff", fontWeight: 600, fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.35)" }}>{t("Ver partido")}</Link>}
                </div>
              </div>
              {(after.length > 0 || (nextMine && nextMine.id !== next.id)) && (
                <div className="flex flex-wrap" style={{ borderTop: "1px solid rgba(255,255,255,.14)", paddingTop: 8, gap: "4px 14px", fontSize: 11, color: "rgba(255,255,255,.78)" }}>
                  {nextMine && nextMine.id !== next.id && (
                    <Link to={matchLink(nextMine)} style={{ color: "#fff", fontWeight: 700 }} data-testid="dash-next-mine">
                      {t("Tu próximo: {when} · {title}", { when: format(new Date(nextMine.date), "EEE HH:mm", { locale: dfl }), title: evTitle(nextMine) })}
                    </Link>
                  )}
                  {after.length > 0 && <span style={{ fontWeight: 700, color: "#fff" }}>{t("Después:")}</span>}
                  {after.map((e) => (
                    <Link key={e.id} to={matchLink(e)} className="hover:underline capitalize" style={{ color: "rgba(255,255,255,.82)" }}>{format(new Date(e.date), "EEE HH:mm", { locale: dfl })} · {evTitle(e)}</Link>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="rs2-card flex items-center" style={{ flex: "1 1 420px", minWidth: 0, padding: 18, fontSize: 13, color: RS.faint }} data-testid="dash-next-none">{t("Sin partidos programados.")}</section>
          )}

          <section className="grid" style={{ flex: "1 1 380px", minWidth: 0, gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <div className="rs2-card" style={{ padding: "11px 14px" }} data-testid="dash-season">
              <Label>{mineMode ? t("Temporada · mis equipos") : t("Temporada · todo el club")}</Label>
              <div className="flex items-baseline" style={{ gap: 6, marginTop: 6 }}>
                <Big color={WIN}>{rec.w}</Big><span style={{ fontSize: 10, color: RS.muted }}>{t("V")}</span>
                <Big color={RS.muted}>{rec.d}</Big><span style={{ fontSize: 10, color: RS.muted }}>{t("E")}</span>
                <Big color={LOSS}>{rec.l}</Big><span style={{ fontSize: 10, color: RS.muted }}>{t("D")}</span>
              </div>
              {rec.n > 0 && (
                <>
                  <div className="flex" style={{ height: 6, borderRadius: 3, overflow: "hidden", marginTop: 8 }} aria-hidden="true">
                    <span style={{ flex: rec.w, background: WIN }} /><span style={{ flex: rec.d, background: "#C9BFC0" }} /><span style={{ flex: rec.l, background: LOSS }} />
                  </div>
                  <p style={{ fontSize: 11, color: RS.muted, marginTop: 5 }}>{t("{pct} % victorias · {gf} goles a favor · {ga} en contra", { pct: rec.winPct, gf: rec.gf, ga: rec.ga })}</p>
                </>
              )}
            </div>
            <div className="rs2-card" style={{ padding: "11px 14px" }} data-testid="dash-attendance">
              <Label>{t("Asistencia · últimos 30 días")}</Label>
              <div className="flex items-baseline" style={{ gap: 6, marginTop: 6 }}>
                <Big color={att.rate == null ? RS.faint : RS.ink}>{att.rate == null ? "—" : `${att.rate} %`}</Big>
                {att.trend != null && att.trend !== 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: att.trend > 0 ? WIN : LOSS }}>{att.trend > 0 ? "▲" : "▼"} {t("{n} pts", { n: Math.abs(att.trend) })}</span>
                )}
              </div>
              <div style={{ height: 6, borderRadius: 3, background: RS.lineSoft, marginTop: 8 }}><div style={{ width: `${att.rate || 0}%`, height: 6, borderRadius: 3, background: attColor }} /></div>
              {att.lowest && <p className="truncate" style={{ fontSize: 11, color: RS.muted, marginTop: 5 }}>{t("Más baja: {team} ({rate} %)", { team: teamName(att.lowest.teamId), rate: att.lowest.rate })}</p>}
            </div>
            <div className="rs2-card grid" style={{ gridColumn: "span 2", padding: "10px 14px", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }} data-testid="dash-club">
              {[
                [t("Equipos"), scopeTeams.length, RS.granate, t("{f7} F7 · {f11} F11", { f7: f7Count, f11: scopeTeams.length - f7Count })],
                [t("Jugadores"), scopePlayers.length, RS.granate, ""],
                [t("Activos"), activePlayers, RS.granate, scopePlayers.length - activePlayers > 0 ? t("{n} no activos", { n: scopePlayers.length - activePlayers }) : ""],
                [t("Lesionados"), injured, injured ? "#B45309" : RS.granate, back ? (back === 1 ? t("1 vuelve esta semana") : t("{n} vuelven esta semana", { n: back })) : ""],
              ].map(([l, v, c, s]) => (
                <div key={l} className="min-w-0">
                  <Label>{l}</Label>
                  <div><Big size={26} color={c}>{v}</Big></div>
                  {s && <p className="truncate" style={{ fontSize: 10, color: RS.faint }}>{s}</p>}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Planificación semanal */}
        <section className="rs2-card" data-testid="dash-week">
          <Head
            title={`${t("Planificación semanal")} · ${format(weekDays[0], "d", { locale: dfl })}–${format(weekDays[6], "d MMM", { locale: dfl })}`}
            right={(
              <>
                <span className="hidden sm:flex items-center" style={{ gap: 4, color: RS.muted }}>
                  {[["training", t("Entreno")], ["match", t("Partido")], ["other", t("Otro")]].map(([k, l]) => (
                    <span key={k} className="flex items-center" style={{ gap: 4, marginLeft: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_STYLE[k][1] }} />{l}</span>
                  ))}
                </span>
                <MoreLink to="/Calendar">{t("Calendario →")}</MoreLink>
              </>
            )}
          />
          <div style={{ overflowX: "auto" }}>
            <div className="grid" style={{ gridTemplateColumns: "repeat(7, minmax(112px, 1fr))", gap: 4, padding: 8 }}>
              {weekDays.map((d) => {
                const k = format(d, "yyyy-MM-dd");
                const evs = weekEvents.filter((e) => format(new Date(e.date), "yyyy-MM-dd") === k);
                const isToday = isSameDay(d, today);
                return (
                  <div key={k} className="flex flex-col min-w-0" style={{ gap: 5, padding: 7, borderRadius: 9, ...(isToday ? { background: "#FFF7ED", outline: `1.5px solid ${RS.naranja}` } : {}) }} data-testid={isToday ? "dash-week-today" : undefined}>
                    <p className="capitalize" style={{ fontSize: 11, fontWeight: 700, color: isToday ? RS.naranja : RS.muted, letterSpacing: ".04em" }}>
                      {isToday ? `${t("Hoy")} · ` : ""}{format(d, "EEE d", { locale: dfl })}
                    </p>
                    {evs.length === 0 && <p style={{ fontSize: 11, color: RS.faint }}>—</p>}
                    {evs.slice(0, 4).map((e) => {
                      const m = isMatch(e.type);
                      const off = isCancelled(e);
                      const [bg, bd, fc] = TYPE_STYLE[kindOf(e)];
                      const content = (
                        <div style={{ background: off ? RS.soft : bg, border: `1px solid ${off ? RS.line : bd}`, borderRadius: 7, padding: "4px 7px", opacity: off ? 0.65 : 1 }}>
                          <div className="flex flex-wrap items-center" style={{ gap: 5 }}>
                            <span className={off ? "line-through" : ""} style={{ fontSize: 10, fontWeight: 700, color: RS.naranja }}>{format(new Date(e.date), "HH:mm")}</span>
                            <MatchResultPill event={e} size="xs" />
                            <span style={{ marginLeft: "auto" }}><EventWeather event={e} size="xs" /></span>
                          </div>
                          <p className={`line-clamp-2 break-words ${off ? "line-through" : ""}`} style={{ fontSize: 11, fontWeight: 600, color: fc, lineHeight: 1.2 }}>{evTitle(e)}</p>
                          {!m && <p className="truncate" style={{ fontSize: 10, color: RS.faint, lineHeight: 1.2 }}>{teamName(e.team_id)}</p>}
                          {off && <p className="break-words" style={{ fontSize: 10, fontWeight: 700, color: RS.muted, lineHeight: 1.2 }} title={cancelText(e, t)}>{cancelText(e, t)}</p>}
                        </div>
                      );
                      // Partidos → su ficha; el resto (entrenamientos, reuniones…) se edita aquí mismo (pedido por Nacho el 28/10/2026)
                      return m ? <Link key={e.id} to={matchLink(e)} className="block hover:brightness-95">{content}</Link>
                        : <button key={e.id} type="button" onClick={() => setEditEvent(e)} title={t("Editar")} data-testid={`week-event-${e.id}`} className="block w-full text-left hover:brightness-95">{content}</button>;
                    })}
                    {evs.length > 4 && <Link to="/Calendar" style={{ fontSize: 11, fontWeight: 700, color: RS.granate }}>{t("+{v} más", { v: evs.length - 4 })}</Link>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Resultados del fin de semana + líderes */}
        <div className="flex flex-wrap items-start" style={{ gap: 12 }}>
          <section className="rs2-card" style={{ flex: "1 1 380px", minWidth: 0 }} data-testid="dash-results">
            <Head
              title={t("Resultados del fin de semana · {weekendLabel}", { weekendLabel })}
              right={recent.length > 0 && (
                <span style={{ color: RS.muted }}>
                  <b style={{ color: WIN }}>{recentWdl.w}{t("V")}</b> · <b style={{ color: DRAW }}>{recentWdl.d}{t("E")}</b> · <b style={{ color: LOSS }}>{recentWdl.l}{t("D")}</b>
                </span>
              )}
            />
            {recent.length === 0 ? <p style={{ padding: "10px 14px", fontSize: 13, color: RS.faint }}>{t("Todavía no hay resultados de ese fin de semana.")}</p> : (
              [[msg("Fútbol 11"), recent.filter((m) => !isF7(m))], [msg("Fútbol 7"), recent.filter(isF7)]].filter(([, l]) => l.length).map(([label, list]) => (
                <div key={label} style={{ paddingBottom: 6 }}>
                  <Label style={{ padding: "8px 14px 2px" }}>{t(label)}</Label>
                  {list.map((m) => {
                    const r = matchResult(m);
                    const c = r === "victoria" ? WIN : r === "derrota" ? LOSS : DRAW;
                    return (
                      <Link key={m.id} to={matchLink(m)} className="grid items-center hover:bg-gray-50" style={{ gridTemplateColumns: "minmax(90px, 120px) minmax(0, 1fr) auto", gap: 8, padding: "4px 14px", borderTop: `1px solid ${RS.lineSoft}` }}>
                        <span className="truncate" style={{ fontSize: 12, fontWeight: 700, color: RS.ink }}>{teamName(m.team_id)}</span>
                        <span className="truncate" style={{ fontSize: 12, color: RS.muted }}>{playsAway(m) ? t("en {v}", { v: m.opponent || "—" }) : t("vs {v}", { v: m.opponent || "—" })}</span>
                        <span className="tabular-nums" style={{ fontSize: 12, fontWeight: 700, color: c, whiteSpace: "nowrap" }} title={scoreTitle(m, teamName(m.team_id), t)}>
                          {r === "victoria" ? "✓" : r === "derrota" ? "✕" : "–"} {scoreText(m)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ))
            )}
          </section>

          <section className="rs2-card" style={{ flex: "1.4 1 520px", minWidth: 0 }} data-testid="dash-leaders">
            <Head title={t("Líderes de la temporada")} right={<MoreLink to="/Stats">{t("Estadísticas →")}</MoreLink>} />
            {leaderBlocks.map((b, i) => (
              <div key={b.k} className="grid" style={{ padding: "9px 14px", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", borderTop: i ? `1px solid ${RS.lineSoft}` : 0 }} data-testid={`dash-leaders-${b.k}`}>
                <p style={{ gridColumn: "1 / -1", fontSize: 11, fontWeight: 700, color: RS.granate, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: -6 }}>{t(b.l)}</p>
                <LeaderCol label={t("Goleadores")} rows={b.d.goals} value={(r) => r.goals} teamShort={teamShort} />
                <LeaderCol label={t("Asistencias")} rows={b.d.assists} value={(r) => r.assists} teamShort={teamShort} />
                <LeaderCol label={t("Minutos")} rows={b.d.minutes} value={(r) => `${r.minutes}'`} teamShort={teamShort} />
              </div>
            ))}
          </section>
        </div>

        {/* Agenda del fin de semana / equipos y clasificación / clasificaciones completas */}
        <section className="rs2-card" style={{ overflow: "hidden" }} data-testid="dash-tabs">
          <div className="flex flex-wrap items-center" style={{ padding: "0 14px", borderBottom: `1px solid ${RS.lineSoft}` }} role="tablist">
            {[["agenda", t("Agenda del fin de semana")], ["equipos", t("Equipos y clasificación · {n}", { n: shownTeams.length })], ["fcf", t("Clasificaciones completas")]].map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`dash-tab-${k}`}
                style={{ fontSize: 13, fontWeight: tab === k ? 700 : 500, padding: "9px 2px", marginRight: 18, border: 0, borderBottom: `2px solid ${tab === k ? RS.granate : "transparent"}`, background: "none", color: tab === k ? RS.granate : RS.muted }}>{l}</button>
            ))}
            <div style={{ marginLeft: "auto" }}><MoreLink to="/Teams">{t("Gestionar equipos →")}</MoreLink></div>
          </div>
          {tab === "agenda" && <div style={{ padding: 12 }}><WeekendAgenda events={weekendEvents} teams={teams} fields={fields} /></div>}
          {tab === "equipos" && (
            <div style={{ padding: "10px 14px 14px" }} className="flex flex-col">
              <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 10 }}>
                {GROUPS.map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setGroup(k)} aria-pressed={group === k}
                    style={{ fontSize: 12, padding: "4px 11px", borderRadius: 999, border: `1px solid ${group === k ? RS.granate : RS.line}`, background: group === k ? RS.granate : "#fff", color: group === k ? "#fff" : RS.ink2 }}>{t(l)}</button>
                ))}
              </div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8 }}>
                {shownTeams.map((x) => <TeamCard key={x.id} team={x} count={players.filter((p) => p.team_id === x.id).length} />)}
              </div>
            </div>
          )}
          {tab === "fcf" && <div style={{ padding: 12 }}><FCFClassificationsPanel teams={sortedTeams.filter((x) => inScope(x.id))} /></div>}
        </section>
      </div>
    </Page>
  );
}
