// Equipos (rediseño del 13/11/2026, maqueta «Maqueta Equipos · RS Manager» aprobada por Nacho): resumen del club,
// equipos separados en Fútbol 11 y Fútbol 7 con competición, cuerpo técnico, clasificación, racha, balance, entrenos de 30 días
// y próximo partido; tabla o tarjetas (en el móvil, tarjetas). Cálculos puros en src/lib/teamsOverview.js.
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, RefreshCw, Pencil, Trash2, Home, Plane, Shield } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import TeamStaffSection from "@/components/team/TeamStaffSection";
import FcfSyncLine from "@/components/teams/FcfSyncLine";
import FcfRelayDialog from "@/components/teams/FcfRelayDialog";
import { Page, RS } from "@/components/rs2/kit";
import { FormChips, WIN, LOSS } from "@/components/rs2/dashParts";
import { sortTeams } from "@/lib/teamOrder";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { FCF_CATEGORY_GROUPS, getCategoryLabel } from "@/components/fcfCategories";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { staffFullName } from "@/lib/staffLink";
import { useMatchStatus } from "@/lib/matchStatus";
import { attendanceSummary } from "@/lib/dashboardStats";
import { playedLeague, leagueForm, record, nextMatch, teamAttendance, coachOf, standingOf, sortOverview, overviewKpis, matchesSearch } from "@/lib/teamsOverview";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT, useDateLocale, msg } from "@/i18n";

const emptyForm = { name: "", category: "", coach_id: "", season: "", fcf_group_url: "" };
const LOW_ATT = 80;   // entrenos de 30 días por debajo de este % = en rojo (confirmado por Nacho el 13/11/2026)
const VIEW_KEY = "rs_teams_view";
const SORTS = [["categoria", msg("Por categoría")], ["clasificacion", msg("Clasificación")], ["entrenos", msg("Entrenos")]];
const chip = (bg, fg) => ({ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap", display: "inline-block" });
const seasonLabel = (s) => String(s || "").replace(/^(\d{4})-\d{2}(\d{2})$/, "$1–$2");
const fetchStanding = async (teamId) => {
  const r = await fetch(`/api/sync-fcf?standings=${teamId}`, { credentials: "include" });
  if (!r.ok) throw new Error("error");
  return r.json();
};

function Segmented({ options, value, onChange, testPrefix, label }) {
  const t = useT();
  return (
    <div role="group" aria-label={label} className="flex flex-wrap" style={{ gap: 3, background: RS.soft, borderRadius: 999, padding: 3 }}>
      {options.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k} data-testid={`${testPrefix}-${k}`}
          style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, border: 0, fontWeight: value === k ? 700 : 400, background: value === k ? "#fff" : "none", color: value === k ? RS.granate : RS.ink2, boxShadow: value === k ? "0 1px 2px rgba(0,0,0,.08)" : "none", whiteSpace: "nowrap" }}>{t(l)}</button>
      ))}
    </div>
  );
}

function AttBar({ att, w = 40 }) {
  if (!att) return <span style={{ color: RS.faint }}>—</span>;
  const low = att.rate < LOW_ATT;
  return (
    <span className="tabular-nums" style={{ whiteSpace: "nowrap" }}>
      <span style={{ display: "inline-block", width: w, height: 5, background: RS.lineSoft, borderRadius: 9, verticalAlign: "middle", marginRight: 5, overflow: "hidden" }}><span style={{ display: "block", width: `${att.rate}%`, height: "100%", background: low ? LOSS : RS.granate }} /></span>
      <span style={low ? { color: LOSS, fontWeight: 700 } : undefined}>{att.rate} %</span>
    </span>
  );
}

export default function Teams() {
  const t = useT();
  const dfl = useDateLocale();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [dialogOpen, setDialogOpen] = useState(false);
  // La FCF ya no deja leer al servidor: los datos se traen desde el navegador (FcfRelayDialog, 07/11/2026)
  const [relayOpen, setRelayOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [stage, setStage] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("categoria");
  const [view, setViewState] = useState(() => { try { return localStorage.getItem(VIEW_KEY) || "tabla"; } catch { return "tabla"; } });
  const setView = (v) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* sin almacenamiento */ } };

  const { data: teams = [], isLoading } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: staff = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.StaffMember.list() });
  const { data: allAssignments = [] } = useQuery({ queryKey: ["team_staff_assignments"], queryFn: () => base44.entities.TeamStaffAssignment.filter({ active: true }) });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance_all"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries_all"], queryFn: () => base44.entities.Injury.list(), retry: false });
  const { pending } = useMatchStatus();
  const ordered = useMemo(() => sortTeams(teams), [teams]);
  const standings = useQueries({
    queries: ordered.map((tm) => ({ queryKey: ["fcf-standing", tm.id], queryFn: () => fetchStanding(tm.id), staleTime: 1000 * 60 * 30, retry: 1 })),
  });
  const standingKey = standings.map((s) => s.dataUpdatedAt).join(",");

  const rows = useMemo(() => {
    const now = new Date();
    const evById = new Map(events.map((e) => [e.id, e]));
    const att = teamAttendance(attendance, evById, { now });
    const staffName = new Map(staff.map((s) => [s.id, staffFullName(s)]));
    const injured = new Set(injuries.filter((i) => i.status !== "alta").map((i) => i.player_id));
    return ordered.map((team, i) => {
      const squad = players.filter((p) => p.team_id === team.id && p.status !== "baja");
      const played = playedLeague(events, team.id, now);
      const pend = events.filter((e) => e.team_id === team.id && pending.has(e.id)).sort((a, b) => new Date(a.date) - new Date(b.date));
      return {
        team, f7: teamPlaysF7(team),
        players: squad.length,
        injured: squad.filter((p) => p.status === "lesionado" || injured.has(p.id)).length,
        coach: coachOf(allAssignments.filter((a) => a.team_id === team.id), (id) => staffName.get(id), team),
        standing: standingOf(standings[i]?.data),
        competition: [standings[i]?.data?.competition, standings[i]?.data?.group].filter(Boolean).join(" · "),
        form: leagueForm(played),
        rec: record(played),
        att: att.get(team.id) || null,
        next: nextMatch(events, team.id, now),
        pending: pend.length, firstPending: pend[0] || null,
      };
    });
  }, [ordered, players, events, staff, allAssignments, attendance, injuries, pending, standingKey]);

  const kpi = useMemo(() => overviewKpis(rows), [rows]);
  const club = useMemo(() => {
    const evById = new Map(events.map((e) => [e.id, e]));
    const skip = new Set(events.filter((e) => e.cancelled === true).map((e) => e.id));
    return attendanceSummary(attendance, evById, { skip });
  }, [attendance, events]);
  const visible = useMemo(() => sortOverview(rows.filter((r) => (stage === "all" || (stage === "f7") === r.f7) && matchesSearch(r, q)), sort), [rows, stage, q, sort]);
  const groups = [
    { key: "f11", title: t("FÚTBOL 11"), rows: visible.filter((r) => !r.f7) },
    { key: "f7", title: t("FÚTBOL 7"), rows: visible.filter((r) => r.f7) },
  ].filter((g) => g.rows.length);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Team.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["teams"] }); closeDialog(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Team.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["teams"] }); closeDialog(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Team.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["teams"] }); setDeleteId(null); },
  });
  const closeDialog = () => { setDialogOpen(false); setEditingTeam(null); setForm(emptyForm); };
  const openEdit = (team) => {
    setEditingTeam(team);
    setForm({ name: team.name, category: team.category, coach_id: team.coach_id || "", season: team.season || "", fcf_group_url: team.fcf_group_url || "" });
    setDialogOpen(true);
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTeam) updateMutation.mutate({ id: editingTeam.id, data: form });
    else createMutation.mutate(form);
  };

  const groupSub = (g) => {
    const r = g.rows.reduce((a, x) => ({ w: a.w + x.rec.w, d: a.d + x.rec.d, l: a.l + x.rec.l, p: a.p + x.players }), { w: 0, d: 0, l: 0, p: 0 });
    return [g.rows.length === 1 ? t("1 equipo") : t("{n} equipos", { n: g.rows.length }), t("{n} jugadores", { n: r.p }), `${r.w}-${r.d}-${r.l}`].join(" · ");
  };
  const nextText = (e) => `${format(new Date(e.date), "EEE d", { locale: dfl })}`;
  const NextCell = ({ r }) => (
    <span className="inline-flex items-center" style={{ gap: 6, whiteSpace: "nowrap" }}>
      {r.next ? (<>
        {r.next.is_home === false ? <Plane width={13} height={13} color={RS.muted} aria-label={t("Fuera")} /> : <Home width={13} height={13} color={RS.muted} aria-label={t("En casa")} />}
        <Link to={`/MatchDetail?id=${r.next.id}&teamId=${r.team.id}`} className="hover:underline" style={{ color: RS.ink }}>
          <b style={{ textTransform: "capitalize" }}>{nextText(r.next)}</b> {format(new Date(r.next.date), "HH:mm")} · {r.next.opponent || r.next.title || "—"}
        </Link>
      </>) : <span style={{ color: RS.faint }}>{t("Sin próximo partido")}</span>}
      {r.pending > 0 && r.firstPending && (
        <Link to={`/MatchDetail?id=${r.firstPending.id}&teamId=${r.team.id}`} style={chip("#FEF3C7", "#92400E")} title={t("Partidos jugados a los que les falta el acta o los minutos")} data-testid={`team-pending-${r.team.id}`}>
          {t("{n} por cerrar", { n: r.pending })}
        </Link>
      )}
    </span>
  );
  const coachCell = (r) => (r.coach.none
    ? <span style={chip("#FEE2E2", LOSS)}>{t("Sin entrenador")}</span>
    : <span>{r.coach.name}{r.coach.extra > 0 && <span style={{ color: RS.muted, fontSize: 11 }}> +{r.coach.extra}</span>}</span>);
  const standingCell = (r) => (r.standing
    ? <span style={{ whiteSpace: "nowrap" }}><span className="rs2-display tabular-nums" style={{ fontSize: 16, color: RS.granate }}>{r.standing.pos}.º</span> <span style={{ fontSize: 11, color: RS.muted }}>{t("{n} pts", { n: r.standing.pts })} · {r.standing.gap === 0 ? t("líder") : t("a {n}", { n: r.standing.gap })}</span></span>
    : <span style={{ color: RS.faint }}>—</span>);
  const recCell = (r) => (r.rec.n
    ? <span className="tabular-nums" style={{ whiteSpace: "nowrap" }}><b style={{ color: WIN }}>{r.rec.w}</b>-{r.rec.d}-<b style={{ color: LOSS }}>{r.rec.l}</b></span>
    : <span style={{ color: RS.faint }}>—</span>);
  const actions = (r) => (
    <span className="inline-flex" style={{ gap: 2 }}>
      <button type="button" onClick={() => openEdit(r.team)} title={t("Editar")} aria-label={t("Editar")} data-testid={`team-edit-${r.team.id}`} className="p-1 rounded hover:bg-gray-100" style={{ color: "#B8ACAD" }}><Pencil className="w-3.5 h-3.5" /></button>
      <button type="button" onClick={() => setDeleteId(r.team.id)} title={t("Eliminar")} aria-label={t("Eliminar")} className="p-1 rounded hover:bg-red-50" style={{ color: "#B8ACAD" }}><Trash2 className="w-3.5 h-3.5" /></button>
    </span>
  );
  const teamName = (r) => (
    <Link to={`/TeamDetail?id=${r.team.id}`} className="inline-flex items-center hover:underline" style={{ gap: 8, color: RS.ink }}>
      <Shield width={18} height={18} color={RS.granate} aria-hidden="true" />
      <span><b>{r.team.name}</b>{getCategoryLabel(r.team.category) && getCategoryLabel(r.team.category) !== r.team.name && <span style={{ display: "block", fontSize: 11, color: RS.muted, fontWeight: 400 }}>{getCategoryLabel(r.team.category)}</span>}</span>
    </Link>
  );

  const kpis = [
    { k: "teams", n: kpi.teams, label: t("equipos"), sub: t("{a} F11 · {b} F7", { a: kpi.f11, b: kpi.f7 }), color: RS.granate },
    { k: "players", n: kpi.players, label: t("jugadores"), sub: kpi.injured === 1 ? t("1 lesionado") : t("{n} lesionados", { n: kpi.injured }), color: RS.ink2 },
    { k: "record", n: `${kpi.w}·${kpi.d}·${kpi.l}`, label: t("V · E · D"), sub: kpi.winPct == null ? t("sin partidos de liga") : t("{n} % victorias", { n: kpi.winPct }), color: WIN },
    { k: "att", n: club.rate == null ? "—" : `${club.rate} %`, label: t("entrenos 30 días"), sub: club.trend == null ? "" : club.trend >= 0 ? t("↑ {n} pts", { n: club.trend }) : t("↓ {n} pts", { n: -club.trend }), color: club.rate != null && club.rate < LOW_ATT ? LOSS : RS.ink2 },
    { k: "pending", n: kpi.pending, label: t("partidos por cerrar"), sub: t("acta o minutos"), color: kpi.pending ? "#B45309" : RS.ink2 },
    { k: "nocoach", n: kpi.noCoach, label: t("sin entrenador"), sub: kpi.noCoach ? t("asignar en Editar") : t("todos asignados"), color: kpi.noCoach ? LOSS : RS.ink2 },
  ];

  const th = (h, right) => <th key={h} style={{ textAlign: right ? "right" : "left", padding: "6px 8px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: RS.muted, fontWeight: 700, borderBottom: `1px solid ${RS.line}`, whiteSpace: "nowrap" }}>{h}</th>;
  const td = { padding: "5px 8px", borderTop: `1px solid ${RS.lineSoft}`, verticalAlign: "middle" };
  const COLS = 11;
  const tableView = (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: RS.ink }} data-testid="teams-table">
        <thead><tr>
          {th(t("Equipo"))}{th(t("Competición"))}{th(t("Cuerpo técnico"))}{th(t("Jug."), true)}{th(t("Clasif."))}{th(t("Racha"))}{th(t("V-E-D"), true)}{th(t("Goles"), true)}{th(t("Entrenos 30 d"), true)}{th(t("Próximo partido"))}{th("")}
        </tr></thead>
        <tbody>
          {groups.map((g) => (
            <React.Fragment key={g.key}>
              <tr><td colSpan={COLS} style={{ padding: "12px 8px 4px" }}>
                <span className="rs2-display" style={{ fontSize: 17, color: RS.granate }}>{g.title}</span>
                <span style={{ fontSize: 11, color: RS.muted, marginLeft: 10 }}>{groupSub(g)}</span>
              </td></tr>
              {g.rows.map((r) => (
                <tr key={r.team.id} data-testid={`team-row-${r.team.id}`}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{teamName(r)}</td>
                  <td style={{ ...td, fontSize: 11, color: RS.ink2, whiteSpace: "nowrap" }}>{r.competition || <span style={{ color: RS.faint }}>—</span>}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{coachCell(r)}</td>
                  <td className="tabular-nums" style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}><b>{r.players}</b>{r.injured > 0 && <span style={{ display: "block", color: LOSS, fontSize: 10, fontWeight: 700 }}>{t("{n} les.", { n: r.injured })}</span>}</td>
                  <td style={td}>{standingCell(r)}</td>
                  <td style={td}>{r.form.length ? <FormChips form={r.form} /> : <span style={{ color: RS.faint }}>—</span>}</td>
                  <td style={{ ...td, textAlign: "right" }}>{recCell(r)}</td>
                  <td className="tabular-nums" style={{ ...td, textAlign: "right", color: RS.ink2 }}>{r.rec.n ? `${r.rec.gf}:${r.rec.ga}` : "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}><AttBar att={r.att} /></td>
                  <td style={td}><NextCell r={r} /></td>
                  <td style={{ ...td, textAlign: "right" }}>{actions(r)}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
  const cardsView = (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }} data-testid="teams-cards">
      {groups.map((g) => (
        <div key={g.key}>
          <div style={{ marginBottom: 6 }}><span className="rs2-display" style={{ fontSize: 17, color: RS.granate }}>{g.title}</span><span style={{ fontSize: 11, color: RS.muted, marginLeft: 10 }}>{groupSub(g)}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 10 }}>
            {g.rows.map((r) => (
              <div key={r.team.id} className="rs2-card" style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7 }} data-testid={`team-card-${r.team.id}`}>
                <div className="flex items-start" style={{ gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{teamName(r)}</span>
                  {r.standing && <span className="rs2-display tabular-nums" style={{ fontSize: 20, color: RS.granate }} title={t("{n} pts", { n: r.standing.pts })}>{r.standing.pos}.º</span>}
                  {actions(r)}
                </div>
                <div style={{ fontSize: 11, color: RS.muted }}>{[r.competition, r.coach.none ? null : r.coach.name].filter(Boolean).join(" · ")}{r.coach.none && <span style={{ ...chip("#FEE2E2", LOSS), marginLeft: 6 }}>{t("Sin entrenador")}</span>}</div>
                <div className="flex flex-wrap items-center" style={{ gap: 10, fontSize: 12 }}>
                  {r.form.length > 0 && <FormChips form={r.form} size={14} />}
                  {recCell(r)}
                  <span><b>{r.players}</b> {t("jug.")}{r.injured > 0 && <span style={{ color: LOSS, fontWeight: 700 }}> · {t("{n} les.", { n: r.injured })}</span>}</span>
                  <span>{t("Entrenos")} <AttBar att={r.att} w={30} /></span>
                </div>
                <div style={{ borderTop: `1px solid ${RS.lineSoft}`, paddingTop: 6, fontSize: 12 }}><NextCell r={r} /></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
  const showCards = isMobile || view === "tarjetas";

  return (
    <Page testId="teams">
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: isMobile ? "12px 10px 24px" : "18px 22px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="flex flex-wrap items-end" style={{ gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".16em", color: RS.muted, textTransform: "uppercase" }}>{t("Administración · Temporada {s}", { s: seasonLabel(CURRENT_SEASON) })}</div>
            <h1 style={{ margin: "2px 0 0", lineHeight: 1 }}><span className="rs2-display" style={{ fontSize: isMobile ? 30 : 36, color: RS.granate }}>{t("EQUIPOS")}</span></h1>
          </div>
          <div className="flex" style={{ marginLeft: "auto", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setRelayOpen(true)} data-testid="fcf-relay-open"
              style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink2, display: "flex", gap: 6, alignItems: "center" }}>
              <RefreshCw width={14} height={14} aria-hidden="true" /> {t("Actualizar desde la FCF")}
            </button>
            <button type="button" onClick={() => { setEditingTeam(null); setForm(emptyForm); setDialogOpen(true); }} data-testid="teams-new"
              style={{ fontSize: 13, fontWeight: 700, padding: "7px 14px", borderRadius: 8, border: 0, background: RS.granate, color: "#fff" }}>+ {t("Nuevo equipo")}</button>
          </div>
        </div>
        <div style={{ marginTop: 6 }}><FcfSyncLine /></div>
        <FcfRelayDialog open={relayOpen} onOpenChange={setRelayOpen} />

        <div className="flex flex-wrap" style={{ gap: 8 }} data-testid="teams-kpis">
          {kpis.map((k) => (
            <div key={k.k} data-testid={`teams-kpi-${k.k}`} style={{ flex: isMobile ? "1 1 140px" : "1 1 150px", display: "flex", alignItems: "baseline", gap: 8, padding: "8px 12px", background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 10 }}>
              <span className="rs2-display tabular-nums" style={{ fontSize: 24, color: k.color }}>{k.n}</span>
              <span style={{ fontSize: 12, color: RS.ink2, lineHeight: 1.15 }}>{k.label}{k.sub && <span style={{ display: "block", fontSize: 11, color: RS.muted }}>{k.sub}</span>}</span>
            </div>
          ))}
        </div>

        <section className="rs2-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="flex flex-wrap items-center" style={{ gap: 10, padding: "9px 14px", borderBottom: `1px solid ${RS.line}` }}>
            <Segmented options={[["all", `${t("Todos")} · ${kpi.teams}`], ["f11", `${t("Fútbol 11")} · ${kpi.f11}`], ["f7", `${t("Fútbol 7")} · ${kpi.f7}`]]} value={stage} onChange={setStage} testPrefix="teams-stage" label={t("Etapa")} />
            <label className="flex items-center" style={{ gap: 7, border: `1px solid ${RS.line}`, borderRadius: 8, padding: "4px 9px", flex: "0 1 220px", minWidth: 160 }}>
              <Search width={13} height={13} color={RS.muted} aria-hidden="true" />
              <span className="sr-only">{t("Buscar equipo o entrenador…")}</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Buscar equipo o entrenador…")} data-testid="teams-search" style={{ fontSize: 12, border: 0, outline: 0, flex: 1, minWidth: 0, background: "none", color: RS.ink }} />
            </label>
            <div className="flex flex-wrap items-center" style={{ marginLeft: "auto", gap: 6 }}>
              <span style={{ fontSize: 11, color: RS.muted }}>{t("Ordenar")}</span>
              <Segmented options={SORTS} value={sort} onChange={setSort} testPrefix="teams-sort" label={t("Ordenar")} />
              {!isMobile && <Segmented options={[["tabla", msg("Tabla")], ["tarjetas", msg("Tarjetas")]]} value={view} onChange={setView} testPrefix="teams-view" label={t("Vista")} />}
            </div>
          </div>
          {isLoading ? (
            <div style={{ padding: 14 }} className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-9 rounded animate-pulse" style={{ background: RS.soft }} />)}</div>
          ) : teams.length === 0 ? (
            <div style={{ padding: "40px 14px", textAlign: "center", color: RS.muted }}>
              <p style={{ fontWeight: 600 }}>{t("No hay equipos registrados")}</p>
              <p style={{ fontSize: 13 }}>{t("Crea tu primer equipo para empezar")}</p>
            </div>
          ) : visible.length === 0 ? (
            <p style={{ padding: "40px 14px", textAlign: "center", color: RS.muted, fontSize: 13 }}>{t("Ningún equipo con esta búsqueda")}</p>
          ) : showCards ? cardsView : tableView}
          <div style={{ padding: "8px 14px 10px", fontSize: 11, color: RS.muted, borderTop: `1px solid ${RS.lineSoft}` }}>
            {t("Racha = últimos 5 partidos de liga. Entrenos 30 d en rojo por debajo del 80 %. «Por cerrar» = partidos jugados a los que les falta el acta o los minutos. El equipo lleva a su ficha.")}
          </div>
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900">{editingTeam ? t("Editar Equipo") : t("Nuevo Equipo")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700">{t("Nombre del equipo *")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="border-gray-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">{t("Categoria FCF *")}</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder={t("Seleccionar categoria")} /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {Object.entries(FCF_CATEGORY_GROUPS).map(([group, cats]) => (
                    <React.Fragment key={group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">{group}</div>
                      {cats.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">{t("Temporada")}</Label>
              <Input value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} placeholder={CURRENT_SEASON} className="border-gray-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">{t("Enlace grup FCF (resultats / classificació)")}</Label>
              <Input value={form.fcf_group_url} onChange={(e) => setForm({ ...form, fcf_group_url: e.target.value })} placeholder={t("https://www.fcf.cat/competicio/...")} className="border-gray-200" />
              <p className="text-xs text-gray-400">{t("Pega aquí el enlace al grupo de tu equipo en fcf.cat")}</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>{t("Cancelar")}</Button>
              <Button variant="club" type="submit">
                {editingTeam ? t("Guardar datos") : t("Crear")}
              </Button>
            </div>
          </form>

          {/* Cuerpo técnico — solo visible al editar un equipo existente */}
          {editingTeam && (
            <div className="border-t border-gray-100 pt-4 mt-2">
              <TeamStaffSection teamId={editingTeam.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("¿Eliminar equipo?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Esta acción no se puede deshacer.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">{t("Eliminar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
