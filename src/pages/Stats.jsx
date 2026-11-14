// Herramientas → Estadísticas. Rediseño del 13/11/2026 con el diseño «rs2» (maqueta «Maqueta Estadísticas · RS Manager»,
// aprobada por Nacho; gráficos de goles en espejo, estilo B). Pestañas Resumen · Jugadores · Goles · Asistencia;
// Liga / Torneos / Amistosos y «Todo el club» o un equipo. Piezas en src/components/stats/StatsParts.jsx,
// cálculos en src/lib/statsOverview.js.
import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Download } from "lucide-react";
import GoalStatsPanel from "@/components/stats/GoalStatsPanel";
import { Page, RS } from "@/components/rs2/kit";
import { Seg, SummaryTable, PctBar } from "@/components/myteam/AttendanceParts";
import { Head } from "@/components/rs2/dashParts";
import { Kpi, VedBar, recordSmall, CompareTable, LeadersCard, RecentResults, PlayerStatsTable, commaNum, POS_LABEL } from "@/components/stats/StatsParts";
import { useCountedStats, STAT_SCOPES } from "@/lib/matchStatus";
import { statTeamResolver, statsOfTeam } from "@/lib/teamStats";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { useParticipationContext, useMinutesRules } from "@/lib/useParticipation";
import MinutesRuleDialog from "@/components/stats/MinutesRuleDialog";
import { goalsFor, playerGoals, goalsBehind, seasonPace, GOAL_LABEL } from "@/lib/participationGoals";
import { participationOf, minutesAlerts, reasonShort, ruleFor, isAjeno } from "@/lib/participation";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { sortTeams } from "@/lib/teamOrder";
import { standingOf } from "@/lib/teamsOverview";
import { isPrimerEquipo } from "@/lib/primerEquipo";
import { isCancelled } from "@/lib/eventCancel";
import { playedMatches, recordOf, formOf, perMatch, playerTotals, leaders, cycleWarning, attendanceByTeam, sortCompare, sortPlayers, CARD_CYCLE } from "@/lib/statsOverview";
import { pastTrainings, playerSummary, periodStart, rateOf, teamRates, TRAINING_TYPES } from "@/lib/trainingAttendance";
import { toCsv, downloadCsv, exportFileName } from "@/lib/staffExport";
import { playerFullName } from "@/lib/playerName";
import { birthYearOf } from "@/lib/birthYear";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { useT, msg } from "@/i18n";

const TABS = [["resumen", msg("Resumen")], ["jugadores", msg("Jugadores")], ["goles", msg("Goles")], ["asistencia", msg("Asistencia")]];
const SCOPES = STAT_SCOPES.map((s) => [s.value, s.label]);
const lsGet = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const seasonLabel = (s) => String(s || "").replace(/^(\d{4})-\d{2}(\d{2})$/, "$1–$2");
const fetchStanding = async (teamId) => {
  const r = await fetch(`/api/sync-fcf?standings=${teamId}`, { credentials: "include" });
  if (!r.ok) throw new Error("error");
  return r.json();
};

export default function Stats() {
  const t = useT();
  const { perms, teamIds } = useTeamAccess();
  const [scope, setScope] = useState("liga");
  const [pickedTeam, setPickedTeam] = useState(() => lsGet("rs_stats_team", "all"));
  const [tab, setTabState] = useState(() => lsGet("rs_stats_tab", "resumen"));
  const [compareSort, setCompareSort] = useState("categoria");
  const [playerSort, setPlayerSortState] = useState(() => lsGet("rs_stats_psort", "pos"));
  const [leadFmt, setLeadFmt] = useState("f11");
  const [attPeriod, setAttPeriod] = useState("temporada");
  const [attSort, setAttSort] = useState("posicion");
  const setTab = (v) => { setTabState(v); lsSet("rs_stats_tab", v); };
  const setPlayerSort = (v) => { setPlayerSortState(v); lsSet("rs_stats_psort", v); };

  const { data: allTeams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: rawStats = [] } = useQuery({ queryKey: ["matchStats"], queryFn: () => base44.entities.MatchStats.list("-date", 2000) });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries_open"], queryFn: () => base44.entities.Injury.list(), enabled: perms.stats !== "none" });
  const matchStats = useCountedStats(rawStats, scope);
  const ctxAll = useParticipationContext(scope);
  const { doc: ruleDoc, rules, goals } = useMinutesRules();
  const [ruleOpen, setRuleOpen] = useState(false);

  // Un entrenador ve las estadísticas de sus equipos; quien trabaja con todo el club, las de todos
  const limited = perms.stats === "team";
  const teams = useMemo(() => sortTeams(limited ? allTeams.filter((x) => (teamIds || []).includes(x.id)) : allTeams), [allTeams, limited, teamIds]);
  const teamId = limited ? (teams.some((x) => x.id === pickedTeam) ? pickedTeam : (teams[0]?.id || "none")) : (pickedTeam === "all" || teams.some((x) => x.id === pickedTeam) ? pickedTeam : "all");
  const pickTeam = (id) => { setPickedTeam(id); lsSet("rs_stats_team", id); };
  const team = teams.find((x) => x.id === teamId) || null;
  const isAll = teamId === "all";
  const teamsById = useMemo(() => new Map(allTeams.map((x) => [x.id, x])), [allTeams]);
  const types = (STAT_SCOPES.find((x) => x.value === scope) || STAT_SCOPES[0]).types;
  const now = useMemo(() => new Date(), [events, attendance]);
  const seasonFrom = periodStart("temporada", now);
  const evById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const visibleIds = useMemo(() => new Set(teams.map((x) => x.id)), [teams]);

  // ── Partidos y estadísticas del alcance ──
  const played = useMemo(() => playedMatches(events, { types, teamId: isAll ? null : teamId, now }).filter((e) => visibleIds.has(e.team_id)), [events, types, isAll, teamId, now, visibleIds]);
  const rec = recordOf(played);
  const teamStats = useMemo(() => (isAll ? matchStats : statsOfTeam(matchStats, teamId, statTeamResolver(events, players))), [isAll, matchStats, teamId, events, players]);
  const totals = useMemo(() => playerTotals(teamStats), [teamStats]);
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // Pocos minutos y objetivos de temporada por detrás del ritmo, por equipo (los objetivos solo cuentan en liga)
  const { lowByTeam, behindByTeam } = useMemo(() => {
    const low = new Map(), behind = new Map();
    const paceOf = new Map(), goalsOfTeam = new Map();
    for (const tm of allTeams) {
      goalsOfTeam.set(tm.id, scope === "liga" ? goalsFor(tm, goals) : null);
      paceOf.set(tm.id, seasonPace(events, tm.id, now));
    }
    for (const p of players) {
      if (p.status === "baja" || !visibleIds.has(p.team_id)) continue;
      const ctx = { ...ctxAll, events: ctxAll.events.filter((e) => e.team_id === p.team_id) };
      const part = participationOf(p, ctx);
      if (minutesAlerts(part).length) low.set(p.team_id, (low.get(p.team_id) || 0) + 1);
      const g = goalsOfTeam.get(p.team_id);
      if (g && goalsBehind(playerGoals(part.all, g, { played: part.all.availMatches, remaining: paceOf.get(p.team_id).remaining }))) behind.set(p.team_id, (behind.get(p.team_id) || 0) + 1);
    }
    return { lowByTeam: low, behindByTeam: behind };
  }, [players, ctxAll, visibleIds, allTeams, goals, scope, events, now]);
  const lowCount = isAll ? [...lowByTeam.values()].reduce((a, b) => a + b, 0) : (lowByTeam.get(teamId) || 0);

  // Entrenos
  const attByTeam = useMemo(() => attendanceByTeam(attendance, evById, { since: seasonFrom, now }), [attendance, evById, seasonFrom.getTime(), now]);
  const attScope = useMemo(() => attendance.filter((a) => { const ev = evById.get(a.event_id); return ev && TRAINING_TYPES.includes(ev.type) && !isCancelled(ev) && (isAll ? visibleIds.has(ev.team_id) : ev.team_id === teamId); }), [attendance, evById, isAll, teamId, visibleIds]);
  const attPast = useMemo(() => pastTrainings(events, attendance, { teamId, now, cancelled: isCancelled }), [events, attendance, teamId, now]);
  const attRates = useMemo(() => {
    if (!isAll) return teamRates(attPast, { since: seasonFrom, now });
    const day = 86400000, tt = now.getTime();
    const inRange = (a, b) => rateOf(attScope.filter((x) => { const d = new Date(evById.get(x.event_id).date).getTime(); return d >= a && d <= b; }));
    const cur = inRange(tt - 30 * day, tt), prev = inRange(tt - 60 * day, tt - 30 * day - 1);
    return { period: inRange(seasonFrom.getTime(), tt), last30: cur, trend: cur != null && prev != null ? cur - prev : null };
  }, [isAll, attPast, attScope, evById, seasonFrom.getTime(), now]);

  // ── Clasificaciones (solo para la comparativa) ──
  const standings = useQueries({ queries: (isAll && tab === "resumen" ? teams : []).map((tm) => ({ queryKey: ["fcf-standing", tm.id], queryFn: () => fetchStanding(tm.id), staleTime: 1000 * 60 * 30, retry: 1 })) });
  const standKey = standings.map((s) => s.dataUpdatedAt).join(",");
  const compare = useMemo(() => {
    const rows = teams.map((tm, i) => {
      const pl = playedMatches(events, { types, teamId: tm.id, now });
      const st = standings[i]?.data;
      return { team: tm, f7: teamPlaysF7(tm), rec: recordOf(pl), form: formOf(pl), att: attByTeam.get(tm.id)?.rate ?? null, low: lowByTeam.get(tm.id) || 0, behind: scope === "liga" && goalsFor(tm, goals) ? (behindByTeam.get(tm.id) || 0) : null, pos: scope === "liga" ? standingOf(st)?.pos : null, comp: [st?.competition, st?.group].filter(Boolean).join(" · ") };
    }).filter((r) => r.rec.n || r.att != null);
    return sortCompare(rows, compareSort);
  }, [teams, events, types, now, attByTeam, lowByTeam, behindByTeam, goals, standKey, compareSort, scope]);

  // ── Líderes ──
  const leaderItems = (key) => {
    const rows = leaders(new Map([...totals].filter(([pid]) => {
      const p = playersById.get(pid);
      if (!p) return false;
      if (!isAll) return true;
      const tm = teamsById.get(p.team_id);
      return tm && visibleIds.has(tm.id) && (leadFmt === "f7") === teamPlaysF7(tm);
    })), key, 5);
    return rows.map((r) => { const p = playersById.get(r.player_id); return { id: p.id, name: playerFullName(p), sub: teamsById.get(p.team_id)?.name || "", value: r[key] }; });
  };

  // ── Jugadores (un equipo) ──
  const fmt = team && teamPlaysF7(team) ? "f7" : "f11";
  const openInjury = useMemo(() => new Map(injuries.filter((i) => i.status !== "alta").map((i) => [i.player_id, i])), [injuries]);
  const withCycle = !isAll && isPrimerEquipo(team) && scope === "liga";
  const teamGoals = !isAll && team && scope === "liga" ? goalsFor(team, goals) : null;
  const pace = useMemo(() => (team ? seasonPace(events, team.id, now) : { played: 0, remaining: 0 }), [team, events, now]);
  const playerRows = useMemo(() => {
    if (isAll || !team) return [];
    const ctx = { ...ctxAll, events: ctxAll.events.filter((e) => e.team_id === team.id) };
    return players.filter((p) => p.team_id === team.id && p.status !== "baja").map((p) => {
      const part = participationOf(p, ctx);
      const tt = totals.get(p.id) || { goals: 0, assists: 0, minutes: 0, yellow: 0, red: 0, games: 0 };
      return { p, b: part.all, perf: part.perf, rule: part.rules[fmt], goals: teamGoals ? playerGoals(part.all, teamGoals, { played: part.all.availMatches, remaining: pace.remaining }) : [], t: tt, inj: openInjury.get(p.id), warn: withCycle ? cycleWarning(tt.yellow) : null };
    });
  }, [isAll, team, ctxAll, players, totals, openInjury, withCycle, fmt, teamGoals, pace]);
  const behindRows = playerRows.filter((r) => goalsBehind(r.goals));
  const teamRule = team ? ruleFor(fmt, team, rules) : null;
  // Fútbol 7: cuántas veces los convocados jugaron 0, 1, 2, 3 o 4 cuartos (para valorar el reparto de minutos del entrenador)
  const quarterMix = useMemo(() => {
    const q = [0, 0, 0, 0, 0];
    for (const r of playerRows) (r.b.quarters || []).forEach((n, k) => { q[k] += n; });
    const total = q.reduce((a, b) => a + b, 0);
    return { q, total };
  }, [playerRows]);
  const guests = useMemo(() => (isAll || !team ? [] : [...totals.values()].map((r) => ({ p: playersById.get(r.player_id), t: r })).filter((x) => x.p && x.p.team_id !== team.id && x.t.games > 0).map((x) => ({ ...x, team: teamsById.get(x.p.team_id)?.name || "" }))), [isAll, team, totals, playersById, teamsById]);
  const usedOwn = playerRows.filter((r) => r.b.played > 0).length;
  const yellowsAll = [...totals.values()].reduce((s, r) => s + r.yellow, 0), redsAll = [...totals.values()].reduce((s, r) => s + r.red, 0);
  const warned = playerRows.filter((r) => r.warn);

  // ── Asistencia (un equipo) ──
  const attSince = periodStart(attPeriod, now);
  const attRows = useMemo(() => (isAll || !team ? [] : playerSummary(players.filter((p) => p.team_id === team.id && p.status !== "baja"), attPast, { since: attSince })), [isAll, team, players, attPast, attSince.getTime()]);

  if (perms.stats === "none") {
    return <Page testId="stats"><div className="rs2-card" style={{ padding: 48, textAlign: "center", color: RS.muted }}>{t("No tienes acceso a esta sección.")}</div></Page>;
  }

  // ── Exportar ──
  const exportCsv = () => {
    const name = isAll ? "club" : (team?.name || "equipo");
    if (tab === "resumen" && isAll) {
      const header = ["Equipo", "Formato", "Competición", "Puesto", "PJ", "V", "E", "D", "GF", "GC", "% entrenos", "Pocos minutos"];
      downloadCsv(exportFileName(`estadisticas-equipos`), toCsv(header, compare.map((r) => [r.team.name, r.f7 ? "F7" : "F11", r.comp, r.pos ?? "", r.rec.n, r.rec.w, r.rec.d, r.rec.l, r.rec.gf, r.rec.ga, r.att ?? "", r.low])));
    } else if (tab === "asistencia" && !isAll) {
      const header = ["Dorsal", "Jugador", "Año", "Posición", "Asiste", "A parte", "No", "% asistencia"];
      downloadCsv(exportFileName(`asistencia-${name}`), toCsv(header, attRows.map((r) => [r.p.jersey_number ?? "", playerFullName(r.p), birthYearOf(r.p) ?? "", POS_LABEL[r.p.position] || "", r.present, r.apart, r.absent, r.pct ?? ""])));
    } else if (!isAll) {
      const f7 = fmt === "f7";
      const header = ["Dorsal", "Jugador", "Año", "Posición", "Convocado", "PJ", "Titular", "Suplente", "Suplente sin jugar", "Fuera (decisión del entrenador)", "No disponible", ...(f7 ? ["1 cuarto", "2 cuartos", "3 cuartos", "4 cuartos"] : []), "Minutos", "% minutos disponibles", "Mínimo %", "Partidos por debajo del mínimo por partido", ...(playerRows[0]?.goals || []).map((g) => `Objetivo: ${{ starts: "titular", full: "completos", q3: "3 cuartos o más" }[g.key] || g.key}`), "Goles", "Asistencias", "Amarillas", "Rojas", "Motivos de no convocatoria"];
      downloadCsv(exportFileName(`estadisticas-${name}`), toCsv(header, sortPlayers(playerRows, playerSort).map(({ p, b, t: x, rule, goals: gl }) => [p.jersey_number ?? "", playerFullName(p), birthYearOf(p) ?? "", POS_LABEL[p.position] || "", b.conv, b.played, b.titular, b.suplente, b.suplenteSin, b.benched, b.unavailable, ...(f7 ? [1, 2, 3, 4].map((k) => b.quarters?.[k] || 0) : []), b.mins, b.pctAvail ?? "", rule?.alert ?? "", b.belowMin || 0, ...(gl || []).map((g) => `${g.value} de ${g.target}${g.state === "done" ? " (cumplido)" : g.state === "behind" ? " (por detrás)" : g.state === "impossible" ? " (ya no llega)" : ""}`), x.goals, x.assists, x.yellow, x.red, Object.entries(b.reasons || {}).map(([k, n]) => `${reasonShort(k)}${isAjeno(k) ? " (no disponible)" : ""} ${n}`).join(" · ")])));
    }
  };
  const canExport = (tab === "resumen" && isAll) || (!isAll && (tab === "jugadores" || tab === "asistencia"));

  const head = (
    <>
      <div className="flex flex-wrap items-end" style={{ gap: 12 }}>
        <div>
          <p className="rs2-label" style={{ letterSpacing: ".14em", textTransform: "uppercase" }}>{t("Herramientas")} · {t("Temporada {s}", { s: seasonLabel(CURRENT_SEASON) })}</p>
          <h1 style={{ margin: "2px 0 0" }}><span className="rs2-display" style={{ fontSize: 34, color: RS.granate }}>{t("Estadísticas")}</span></h1>
        </div>
        <div className="flex flex-wrap items-center" style={{ marginLeft: "auto", gap: 8 }}>
          <Seg options={SCOPES} value={scope} onChange={setScope} testPrefix="stats-scope" label={t("Competición")} />
          {canExport && (
            <button type="button" onClick={exportCsv} className="inline-flex items-center" style={{ gap: 6, height: 32, padding: "0 12px", borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", fontSize: 12, fontWeight: 700, color: RS.ink2 }} data-testid="stats-export">
              <Download className="w-3.5 h-3.5" /> {t("Exportar Excel")}
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
        <div className="flex flex-wrap" style={{ gap: 2, background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 18, padding: 3, maxWidth: "100%" }} role="group" aria-label={t("Equipo")} data-testid="stats-teams">
          {[...(limited ? [] : [{ id: "all", name: t("Todo el club") }]), ...teams].map((x) => {
            const on = x.id === teamId;
            return (
              <button key={x.id} type="button" onClick={() => pickTeam(x.id)} aria-pressed={on} data-testid={`stats-team-${x.id}`}
                style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap", fontWeight: on ? 700 : 400, background: on ? RS.granateDark : "none", color: on ? "#fff" : RS.ink2 }}>{x.name}</button>
            );
          })}
        </div>
        <div className="flex flex-wrap" style={{ marginLeft: "auto", gap: 6 }} role="tablist">
          {TABS.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`stats-tab-${k}`}
              style={{ fontSize: 12.5, padding: "6px 14px", borderRadius: 999, fontWeight: tab === k ? 700 : 400, background: tab === k ? RS.granate : "#fff", color: tab === k ? "#fff" : RS.ink2, border: tab === k ? 0 : `1px solid ${RS.line}` }}>{t(l)}</button>
          ))}
        </div>
      </div>
    </>
  );

  const scopeName = t((STAT_SCOPES.find((x) => x.value === scope) || STAT_SCOPES[0]).label).toLowerCase();
  const chooseTeam = <div className="rs2-card" style={{ padding: 32, textAlign: "center", fontSize: 13, color: RS.muted }} data-testid="stats-choose">{t("Elige un equipo arriba para ver sus jugadores.")}</div>;

  return (
    <Page testId="stats">
      <div className="rs2-wrap flex flex-col" style={{ gap: 12, maxWidth: 1440 }}>
        {head}

        {/* Cifras de arriba (Resumen y Jugadores) */}
        {(tab === "resumen" || tab === "jugadores") && (
          <div className="flex flex-wrap" style={{ gap: 12 }} data-testid="stats-kpis">
            <Kpi title={isAll ? t("Partidos · {s}", { s: scopeName }) : `${team?.name || ""} · ${scopeName}`} big={rec.n} small={recordSmall(rec, t)}
              foot={rec.n ? (isAll ? t("{p} % de victorias · {n} equipos", { p: rec.winPct, n: compare.filter((r) => r.rec.n).length }) : t("{p} % de victorias", { p: rec.winPct })) : null} testId="stats-kpi-matches">
              <VedBar w={rec.w} d={rec.d} l={rec.l} width={180} />
            </Kpi>
            <Kpi title={t("Goles")} big={rec.gf} small={t("a favor · {n} en contra", { n: rec.ga })} foot={rec.n ? t("{a} por partido · encajamos {b}", { a: commaNum(perMatch(rec.gf, rec.n)), b: commaNum(perMatch(rec.ga, rec.n)) }) : null} testId="stats-kpi-goals" />
            {tab === "jugadores" && teamGoals ? (
              <Kpi title={t("Objetivos de temporada")} big={behindRows.length} color={behindRows.length ? "#B45309" : undefined}
                small={behindRows.length === 1 ? t("jugador por detrás del ritmo") : t("jugadores por detrás del ritmo")} testId="stats-kpi-goals-season"
                foot={`${["starts", "full", "q3"].filter((k) => teamGoals[k]).map((k) => `${t(GOAL_LABEL[k])} ${teamGoals[k]}`).join(" · ")} · ${t("quedan {n} partidos", { n: pace.remaining })}`} />
            ) : <Kpi title={t("Porterías a cero")} big={rec.clean} small={rec.clean === 1 ? t("partido") : t("partidos")} foot={rec.n ? t("{n} % de los partidos", { n: Math.round((rec.clean / rec.n) * 100) }) : null} testId="stats-kpi-clean" />}
            {tab === "resumen" ? (
              <Kpi title={t("Entrenos · temporada")} big={attRates.period != null ? `${attRates.period} %` : "—"}
                small={attRates.last30 != null ? <>{t("30 días:")} <b style={{ color: attRates.trend > 0 ? "#15803D" : attRates.trend < 0 ? "#B91C1C" : RS.muted }}>{attRates.last30} %{attRates.trend ? ` ${attRates.trend > 0 ? "▲" : "▼"} ${Math.abs(attRates.trend)}` : ""}</b></> : null} testId="stats-kpi-att" />
            ) : (
              <Kpi title={t("Jugadores usados")} big={usedOwn} small={t("de {n}", { n: playerRows.length }) + (guests.length ? ` · ${guests.length === 1 ? t("1 de otro equipo") : t("{n} de otros equipos", { n: guests.length })}` : "")} testId="stats-kpi-used" />
            )}
            <Kpi title={t("Pocos minutos")} big={lowCount} color={lowCount ? "#B91C1C" : undefined} small={lowCount === 1 ? t("jugador") : t("jugadores")} foot={t("por debajo de su mínimo de minutos")} testId="stats-kpi-low" />
            {tab === "jugadores" && !isAll && !(fmt === "f7" && quarterMix.total > 0) && (
              <Kpi title={t("Tarjetas")} big={yellowsAll} small={<>{t("amarillas")} · <b style={{ color: "#B91C1C" }}>{redsAll}</b> {redsAll === 1 ? t("roja") : t("rojas")}</>}
                foot={warned.length ? warned.map((r) => playerFullName(r.p)).join(", ") + " · " + t("a 1 de sanción") : null} testId="stats-kpi-cards" />
            )}
            {tab === "jugadores" && !isAll && fmt === "f7" && quarterMix.total > 0 && (
              <Kpi title={t("Cuartos por convocatoria")} big={`${Math.round(((quarterMix.q[2] + quarterMix.q[3] + quarterMix.q[4]) / quarterMix.total) * 100)} %`}
                small={t("juegan 2 cuartos o más")} testId="stats-kpi-quarters"
                foot={[0, 1, 2, 3, 4].map((k) => `${k}C ${quarterMix.q[k]}`).join(" · ")}>
                <span className="flex" style={{ width: 180, height: 7, borderRadius: 9, overflow: "hidden", background: "#F1ECEC", marginTop: 6 }}>
                  {[0, 1, 2, 3, 4].map((k) => quarterMix.q[k] ? <span key={k} title={`${k}C · ${quarterMix.q[k]}`} style={{ width: `${(quarterMix.q[k] / quarterMix.total) * 100}%`, background: ["#B91C1C", "#F59E0B", "#D6B4B8", "#A3474F", "#73000A"][k] }} /> : null)}
                </span>
              </Kpi>
            )}
          </div>
        )}

        {tab === "resumen" && (
          isAll ? (
            <div className="flex flex-wrap items-start" style={{ gap: 12 }}>
              <CompareTable rows={compare} sort={compareSort} onSort={setCompareSort} onPick={(id) => { pickTeam(id); setTab("jugadores"); }} />
              <div className="flex flex-col" style={{ flex: "1 1 320px", minWidth: 0, gap: 12 }}>
                <LeadersCard title={leadFmt === "f7" ? t("Líderes · fútbol 7") : t("Líderes · fútbol 11")} goals={leaderItems("goals")} assists={leaderItems("assists")} minutes={leaderItems("minutes")} showTeam
                  formatSeg={<Seg options={[["f11", "F11"], ["f7", "F7"]]} value={leadFmt} onChange={setLeadFmt} testPrefix="stats-lead" label={t("Formato")} />} />
                <RecentResults list={played.slice(-8).reverse()} teamsById={teamsById} showTeam />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-start" style={{ gap: 12 }}>
              <div style={{ flex: "2 1 600px", minWidth: 0 }}>
                <LeadersCard title={t("Líderes del equipo")} goals={leaderItems("goals")} assists={leaderItems("assists")} minutes={leaderItems("minutes")} />
              </div>
              <div style={{ flex: "1 1 320px", minWidth: 0 }}><RecentResults list={played.slice(-8).reverse()} teamsById={teamsById} /></div>
            </div>
          )
        )}

        {tab === "jugadores" && (isAll ? chooseTeam : <PlayerStatsTable rows={playerRows} guests={guests} sort={playerSort} onSort={setPlayerSort} fmt={fmt} cycle={withCycle ? CARD_CYCLE : null}
          rule={teamRule} ruleOwn={!!(team && rules.teams[team.id])} goals={teamGoals} pace={pace} goalsOff={scope === "liga" && !!team && goals.teams[team.id]?.off} onEditRule={perms.administration ? () => setRuleOpen(true) : null} />)}
        {perms.administration && <MinutesRuleDialog open={ruleOpen} onOpenChange={setRuleOpen} doc={ruleDoc} team={isAll ? null : team} teams={allTeams} />}

        {tab === "goles" && <GoalStatsPanel events={played} players={players} teams={allTeams} />}

        {tab === "asistencia" && (
          isAll ? (
            <section className="rs2-card" style={{ overflow: "hidden" }} data-testid="stats-att-club">
              <Head title={t("Asistencia a entrenos por equipo")} right={<span style={{ fontSize: 11, fontWeight: 400, color: RS.muted }}>{t("Desde el 1 de agosto · «A parte» cuenta como asistencia")}</span>} />
              {teams.map((tm) => {
                const a = attByTeam.get(tm.id);
                return (
                  <button key={tm.id} type="button" onClick={() => pickTeam(tm.id)} className="flex items-center w-full hover:bg-[#FBF8F8]" style={{ gap: 10, padding: "7px 14px", borderTop: "1px solid #F3EEEE", fontSize: 12, textAlign: "left" }}>
                    <b style={{ width: 160 }} className="truncate">{tm.name}</b>
                    <span style={{ flex: 1 }}><PctBar pct={a?.rate ?? null} w={220} /></span>
                    <span style={{ fontSize: 11, color: RS.muted }}>{a ? t("{n} registros", { n: a.n }) : ""}</span>
                  </button>
                );
              })}
            </section>
          ) : (
            <SummaryTable rows={attRows} period={attPeriod} onPeriod={setAttPeriod} sort={attSort} onSort={setAttSort} total={attPast.filter((x) => x.state === "done" && new Date(x.ev.date) >= attSince).length} injuredById={openInjury} />
          )
        )}
      </div>
    </Page>
  );
}
