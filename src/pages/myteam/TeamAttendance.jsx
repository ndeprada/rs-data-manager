// Mi equipo → Entrenamientos. Rediseño del 13/11/2026 con el diseño «rs2» (maqueta «Maqueta Entrenamientos · RS Manager»,
// aprobada por Nacho: «ok», con mis siete propuestas). Dos vistas: el resumen (sin ?eventId) y «Pasar lista» de un entreno.
// Piezas en src/components/myteam/AttendanceParts.jsx; cálculos puros en src/lib/trainingAttendance.js.
import React, { useState, useRef, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isSameDay } from "date-fns";
import { Pencil, X, UserPlus, Check, MessageSquarePlus, HeartPulse, Ban, RotateCcw, ChevronLeft, ChevronRight, Shield, FileText, Plus } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TeamSelectTrigger } from "@/components/myteam/TeamPageHeader";
import { useSelectedTeam } from "@/lib/useSelectedTeam";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import EditEventDialog from "@/components/myteam/EditEventDialog";
import CreateEventDialog from "@/components/myteam/CreateEventDialog";
import GuestPlayerSelector from "@/components/common/GuestPlayerSelector";
import PlayerName from "@/components/common/PlayerName";
import QuickInjuryDialog from "@/components/myteam/QuickInjuryDialog";
import CancelEventDialog from "@/components/myteam/CancelEventDialog";
import BulkCancelButton from "@/components/myteam/BulkCancelButton";
import { TeamWeek } from "@/components/myteam/MyTeamCards";
import { Page, RS, Btn } from "@/components/rs2/kit";
import { Head, Label, WIN, LOSS } from "@/components/rs2/dashParts";
import { AttendanceKpis, SummaryTable, RecentTrainings, ReasonsCard, ExternalCard, PendingBanner, Dots, GroupHead, Seg, ABSENCE_REASONS, REASON_LABEL, POS_LABEL, APART, WARN } from "@/components/myteam/AttendanceParts";
import { isCancelled, cancelText } from "@/lib/eventCancel";
import { useTrainingStatus } from "@/lib/trainingStatus";
import { squadGroups, sortSquad } from "@/lib/myTeamStats";
import { TRAINING_TYPES, recordsOf, periodStart, pastTrainings, sessionCounts, sessionTotals, playerSummary, reasonTotals, rateOf, teamRates, neighbours, recentAbsences } from "@/lib/trainingAttendance";
import { playerFullName } from "@/lib/playerName";
import { useT, useDateLocale, msg } from "@/i18n";
import { absenceReasonFor } from "@/lib/attendanceDefaults";

const PILL_MAX = 4;
const PERIOD_LABEL = { temporada: msg("temporada"), "30": msg("30 días"), mes: msg("este mes") };
const STATUS = [["present", msg("Asiste"), WIN], ["apart", msg("A parte"), APART], ["absent", msg("No"), LOSS]];
const CODE = { present: "s", apart: "a", absent: "n" };
const lsGet = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

export default function TeamAttendance() {
  const t = useT();
  const dfl = useDateLocale();
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const eventId = params.get("eventId") || "";
  const urlTeamId = params.get("teamId") || "";

  const { selectedTeamId, selectTeam, canSwitch, isCoordinator, teamIds: myTeamIds } = useSelectedTeam();
  const { canManageTeam } = useTeamAccess();
  // Un enlace a un entrenamiento de otro equipo (p. ej. desde el listado de pendientes de coordinación) abre ese equipo
  useEffect(() => { if (urlTeamId && canSwitch && urlTeamId !== selectedTeamId) selectTeam(urlTeamId); }, [urlTeamId]);
  const [editingEvent, setEditingEvent] = useState(null);
  const [cancelFor, setCancelFor] = useState(null);
  const [createEventDate, setCreateEventDate] = useState(null);
  const [trialName, setTrialName] = useState("");
  const [injuryFor, setInjuryFor] = useState(null);
  const [noteOpen, setNoteOpen] = useState(() => new Set());
  const [period, setPeriodState] = useState(() => lsGet("rs_att_period", "temporada"));
  const [sort, setSortState] = useState(() => lsGet("rs_att_sort", "posicion"));
  const [listOrder, setListOrderState] = useState(() => lsGet("rs_att_list", "posicion"));
  const setPeriod = (v) => { setPeriodState(v); lsSet("rs_att_period", v); };
  const setSort = (v) => { setSortState(v); lsSet("rs_att_sort", v); };
  const setListOrder = (v) => { setListOrderState(v); lsSet("rs_att_list", v); };
  const chain = useRef({}); // serializa guardados por jugador

  // Al pasar a otro entrenamiento empieza limpio
  const [shownEventId, setShownEventId] = useState(eventId);
  if (shownEventId !== eventId) { setShownEventId(eventId); setNoteOpen(new Set()); setTrialName(""); }

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: allAttendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries_open"], queryFn: () => base44.entities.Injury.list() });
  const { pending: pendingTr } = useTrainingStatus();
  const openInjury = useMemo(() => new Map(injuries.filter((i) => i.status !== "alta").map((i) => [i.player_id, i])), [injuries]);

  const team = teams.find((x) => x.id === selectedTeamId);
  const canManage = !!selectedTeamId && canManageTeam(selectedTeamId);
  const teamPlayers = useMemo(() => players.filter((p) => p.team_id === selectedTeamId && p.status !== "baja"), [players, selectedTeamId]);
  const rosterIds = useMemo(() => teamPlayers.map((p) => p.id), [teamPlayers]);
  const now = useMemo(() => new Date(), [allAttendance, events]);
  const past = useMemo(() => pastTrainings(events, allAttendance, { teamId: selectedTeamId, now, cancelled: isCancelled }), [events, allAttendance, selectedTeamId, now]);

  const selectedEvent = events.find((e) => e.id === eventId && TRAINING_TYPES.includes(e.type));
  const offSel = isCancelled(selectedEvent);
  const eventRecords = selectedEvent ? recordsOf(allAttendance, selectedEvent) : [];
  const recFor = (pid) => eventRecords.find((a) => a.player_id === pid) || {};

  // ── Guardado automático ──
  const save = (playerId, patch, extra = {}) => {
    const ev = selectedEvent;
    if (!ev) return;
    const prev = chain.current[playerId] || Promise.resolve();
    chain.current[playerId] = prev.then(async () => {
      const cached = qc.getQueryData(["attendance"]) || [];
      const existing = cached.find((a) => a.player_id === playerId && (a.event_id === ev.id || (!a.event_id && a.date === ev.date?.split("T")[0])));
      if (existing) {
        const merged = { ...existing, ...patch, event_id: ev.id };
        qc.setQueryData(["attendance"], (old = []) => old.map((a) => (a.id === existing.id ? merged : a)));
        await base44.entities.TrainingAttendance.update(existing.id, { ...patch, event_id: ev.id });
      } else {
        const payload = { player_id: playerId, event_id: ev.id, date: ev.date?.split("T")[0], ...extra, ...patch };
        const tempId = `tmp_${Math.random()}`;
        qc.setQueryData(["attendance"], (old = []) => [...old, { id: tempId, ...payload }]);
        const created = await base44.entities.TrainingAttendance.create(payload);
        qc.setQueryData(["attendance"], (old = []) => old.map((a) => (a.id === tempId ? { ...payload, ...created } : a)));
      }
    }).catch(() => qc.invalidateQueries({ queryKey: ["attendance"] }));
  };
  const removeRecord = async (playerId) => {
    const recs = eventRecords.filter((a) => a.player_id === playerId);
    qc.setQueryData(["attendance"], (old = []) => old.filter((a) => !recs.some((r) => r.id === a.id)));
    for (const r of recs) if (!String(r.id).startsWith("tmp_")) await base44.entities.TrainingAttendance.delete(r.id);
  };
  const setStatus = (pid, status) => {
    const patch = { status };
    if (status !== "absent") patch.absence_reason = null;
    else {
      // con una lesión activa, el motivo sale ya como «Lesión» (se puede cambiar)
      const reason = absenceReasonFor(players.find((p) => p.id === pid), { current: recFor(pid).absence_reason, injuries });
      if (reason) patch.absence_reason = reason;
    }
    save(pid, patch);
  };
  const markRest = () => teamPlayers.forEach((p) => { if (!recFor(p.id).status) save(p.id, { status: "present" }); });
  const addTrial = () => { const name = trialName.trim(); if (!name) return; save(`prueba_${Date.now()}`, {}, { trial_name: name }); setTrialName(""); };
  const toggleNote = (pid) => setNoteOpen((prev) => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });

  // ── Resumen ──
  const since = periodStart(period, now);
  const summary = useMemo(() => playerSummary(teamPlayers, past, { since }), [teamPlayers, past, since.getTime()]);
  const inPeriod = past.filter((x) => new Date(x.ev.date) >= since);
  const doneN = inPeriod.filter((x) => x.state === "done").length;
  const offN = inPeriod.filter((x) => x.state === "off").length;
  const pendingList = past.filter((x) => x.state === "pending" && pendingTr.has(x.ev.id));
  const rates = teamRates(past, { since, now, rosterIds });
  const reasons = reasonTotals(summary);
  const absences = summary.reduce((s, r) => s + r.absent, 0);
  const low = summary.filter((r) => r.pct != null && r.pct < 70 && r.marked >= 3).sort((a, b) => a.pct - b.pct);
  const clubRate = useMemo(() => {
    const evById = new Map(events.map((e) => [e.id, e]));
    return rateOf(allAttendance.filter((a) => { const ev = evById.get(a.event_id); return ev && TRAINING_TYPES.includes(ev.type) && !isCancelled(ev) && new Date(ev.date) >= since && new Date(ev.date) <= now; }));
  }, [allAttendance, events, since.getTime(), now]);
  const recent = past.slice(-8).reverse().map((x) => ({ ...x, totals: sessionTotals(x.recs) }));
  const external = useMemo(() => {
    const ids = new Set(rosterIds);
    const map = {};
    for (const x of inPeriod) {
      if (x.state !== "done") continue;
      for (const a of x.recs) {
        if (!a.status || ids.has(a.player_id)) continue;
        const isTrial = !!a.trial_name;
        const pl = isTrial ? null : players.find((p) => p.id === a.player_id);
        if (!isTrial && !pl) continue;
        const key = isTrial ? `t_${a.trial_name.trim().toLowerCase()}` : a.player_id;
        const e = map[key] || (map[key] = { key, name: isTrial ? a.trial_name : playerFullName(pl), origin: isTrial ? t("A prueba") : (teams.find((tm) => tm.id === pl.team_id)?.name || t("Otro equipo")), present: 0, apart: 0, absent: 0 });
        e[a.status]++;
      }
    }
    return Object.values(map).sort((a, b) => (b.present + b.apart) - (a.present + a.apart));
  }, [inPeriod, rosterIds, players, teams]);

  // ── Cabecera ──
  const switchable = teams.filter((x) => isCoordinator || (myTeamIds || []).includes(x.id));
  const teamSwitch = canSwitch && switchable.length > 1 && (switchable.length <= PILL_MAX ? (
    <div className="flex" style={{ gap: 4, background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 999, padding: 3 }} role="group" aria-label={t("Equipo")} data-testid="team-switch">
      {switchable.map((x) => (
        <button key={x.id} type="button" onClick={() => selectTeam(x.id)} aria-pressed={x.id === selectedTeamId}
          style={{ fontSize: 12, fontWeight: x.id === selectedTeamId ? 700 : 400, padding: "5px 12px", borderRadius: 999, border: 0, background: x.id === selectedTeamId ? RS.granate : "none", color: x.id === selectedTeamId ? "#fff" : RS.ink2 }}>{x.name}</button>
      ))}
    </div>
  ) : (
    <Select value={selectedTeamId} onValueChange={(v) => v && selectTeam(v)}>
      <TeamSelectTrigger />
      <SelectContent>{switchable.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
    </Select>
  ));

  const dialogs = (
    <>
      <QuickInjuryDialog open={!!injuryFor} onOpenChange={(o) => { if (!o) setInjuryFor(null); }} player={injuryFor} date={selectedEvent?.date?.split("T")[0]} />
      <EditEventDialog open={!!editingEvent} onOpenChange={(o) => { if (!o) setEditingEvent(null); }} event={editingEvent} />
      <CancelEventDialog open={!!cancelFor} onOpenChange={(o) => { if (!o) setCancelFor(null); }} event={cancelFor} />
      <CreateEventDialog open={!!createEventDate} onOpenChange={(o) => { if (!o) setCreateEventDate(null); }} date={createEventDate} teamId={selectedTeamId} />
    </>
  );

  if (!selectedTeamId) {
    return (
      <Page testId="attendance">
        <div className="rs2-wrap flex flex-col" style={{ gap: 12, maxWidth: 1440 }}>
          <h1 style={{ margin: 0 }}><span className="rs2-display" style={{ fontSize: 34, color: RS.granate }}>{t("Entrenamientos")}</span></h1>
          <div className="rs2-card" style={{ padding: 32, textAlign: "center" }}>
            <Shield className="w-10 h-10 mx-auto mb-3" style={{ color: RS.faint }} />
            {isCoordinator ? (
              <>
                <p style={{ color: RS.muted, marginBottom: 16 }}>{t("Selecciona un equipo")}</p>
                <div className="flex justify-center"><Select value="" onValueChange={selectTeam}><TeamSelectTrigger /><SelectContent>{teams.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select></div>
              </>
            ) : <p style={{ color: RS.muted }}>{t("No tienes un equipo asignado. Contacta con el coordinador.")}</p>}
          </div>
        </div>
      </Page>
    );
  }

  // ═════════ PASAR LISTA ═════════
  if (selectedEvent) {
    return <SessionView {...{ t, dfl, team, selectedEvent, offSel, events, teamPlayers, players, teams, eventRecords, recFor, openInjury, past, noteOpen, toggleNote, setStatus, save, removeRecord, markRest, trialName, setTrialName, addTrial, setInjuryFor, setCancelFor, setEditingEvent, listOrder, setListOrder, navigate, dialogs, canManage }} />;
  }

  // ═════════ RESUMEN ═════════
  return (
    <Page testId="attendance">
      <div className="rs2-wrap flex flex-col" style={{ gap: 12, maxWidth: 1440 }}>
        {dialogs}
        <div className="flex flex-wrap items-end" style={{ gap: 12 }}>
          <div className="min-w-0">
            <p className="rs2-label truncate" style={{ letterSpacing: ".14em", textTransform: "uppercase" }}>{[t("Mi equipo"), team?.name].filter(Boolean).join(" · ")}</p>
            <h1 style={{ margin: "2px 0 0" }}><span className="rs2-display" style={{ fontSize: 34, color: RS.granate }}>{t("Entrenamientos")}</span></h1>
          </div>
          <div className="flex flex-wrap items-center" style={{ marginLeft: "auto", gap: 8 }}>
            {teamSwitch}
            <BulkCancelButton teamId={selectedTeamId} />
            {canManage && <Btn onClick={() => setCreateEventDate(new Date())} testId="att-new" style={{ height: 32, fontSize: 12, padding: "0 12px" }}><Plus className="w-3.5 h-3.5" /> {t("Nuevo entreno")}</Btn>}
          </div>
        </div>

        <PendingBanner pending={pendingList} />
        <AttendanceKpis periodLabel={PERIOD_LABEL[period]} rates={rates} clubRate={clubRate} done={doneN} off={offN} pending={pendingList.length} absences={absences} reasons={reasons} low={low} />
        <div className="flex">
          <TeamWeek events={events.filter((e) => e.team_id === selectedTeamId)} attendance={allAttendance} pendingTr={pendingTr} canManage={canManage} onCreate={setCreateEventDate} onEdit={setEditingEvent} />
        </div>

        <div className="flex flex-wrap items-start" style={{ gap: 12 }}>
          <SummaryTable rows={summary} period={period} onPeriod={setPeriod} sort={sort} onSort={setSort} total={doneN} injuredById={openInjury} />
          <div className="flex flex-col" style={{ flex: "1 1 300px", minWidth: 0, gap: 12 }}>
            <RecentTrainings list={recent} />
            <ReasonsCard reasons={reasons} />
            <ExternalCard list={external} />
          </div>
        </div>
      </div>
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function StatusButtons({ value, onSet, compact }) {
  const t = useT();
  return (
    <div className="flex shrink-0" style={{ gap: 3 }}>
      {STATUS.map(([k, l, c]) => {
        const on = value === k;
        return (
          <button key={k} type="button" onClick={() => onSet(k)} aria-pressed={on} data-testid={`att-set-${k}`}
            style={{ height: compact ? 30 : 26, padding: "0 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", border: `1px solid ${on ? c : "#D9CFD0"}`, background: on ? c : "#fff", color: on ? "#fff" : RS.ink2 }}>{t(l)}</button>
        );
      })}
    </div>
  );
}

function ReasonSelect({ value, onChange }) {
  const t = useT();
  return (
    <Select value={value || ""} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="h-[26px] w-auto min-w-[92px] px-2 text-[11px] gap-1" style={{ borderColor: value ? "#FCA5A5" : RS.line, background: value ? "#FEF2F2" : "#fff", color: value ? LOSS : RS.muted }} data-testid="att-reason">
        <SelectValue placeholder={t("Motivo")} />
      </SelectTrigger>
      <SelectContent>{ABSENCE_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{t(r.label)}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function SessionView({ t, dfl, team, selectedEvent: ev, offSel, events, teamPlayers, players, teams, eventRecords, recFor, openInjury, past, noteOpen, toggleNote, setStatus, save, removeRecord, markRest, trialName, setTrialName, addTrial, setInjuryFor, setCancelFor, setEditingEvent, listOrder, setListOrder, navigate, dialogs }) {
  const [showGuests, setShowGuests] = useState(false);
  const { prev, next } = neighbours(events, ev);
  const counts = sessionCounts(eventRecords, teamPlayers.map((p) => p.id));
  const evDate = new Date(ev.date);
  const isToday = isSameDay(evDate, new Date());
  const rosterSet = new Set(teamPlayers.map((p) => p.id));
  const guests = eventRecords.filter((r) => !rosterSet.has(r.player_id) && !r.trial_name).map((r) => players.find((p) => p.id === r.player_id)).filter(Boolean);
  const trials = eventRecords.filter((r) => r.trial_name);
  const before = past.filter((x) => new Date(x.ev.date) < evDate);
  const last3 = (pid) => before.filter((x) => x.state === "done").slice(-3).map((x) => CODE[x.recs.find((r) => r.player_id === pid)?.status] || "x");

  // Hoja de sesión del día (Metodología → Sesiones), si la hay
  const { data: sessions = [] } = useQuery({ queryKey: ["coach_sessions_team", ev.team_id], queryFn: () => base44.entities.CoachSession.filter({ team_id: ev.team_id }), enabled: !!ev.team_id });
  const day = String(ev.date).split("T")[0];
  const sheet = sessions.find((s) => s.event_id === ev.id) || sessions.find((s) => String(s.date || "").slice(0, 10) === day);

  const row = (p, { guest = false, trial = null } = {}) => {
    const pid = trial ? trial.player_id : p.id;
    const att = recFor(pid);
    const inj = p && openInjury.get(p.id);
    const canInjure = p && !inj && (att.status === "apart" || (att.status === "absent" && att.absence_reason === "lesion"));
    const showNote = noteOpen.has(pid);
    const name = trial ? trial.trial_name : playerFullName(p);
    const sub = trial ? t("A prueba") : guest ? `${teams.find((x) => x.id === p.team_id)?.name || t("Otro equipo")}${p.jersey_number != null ? ` · ${p.jersey_number}` : ""}` : (POS_LABEL[p.position] || "");
    const tint = att.status ? (guest || trial ? "#F8FBFF" : undefined) : "#FFFBEB";
    const extras = (
      <>
        {att.status === "absent" && <ReasonSelect value={att.absence_reason} onChange={(v) => save(pid, { absence_reason: v })} />}
        {canInjure && (
          <button type="button" onClick={() => setInjuryFor(p)} className="inline-flex items-center whitespace-nowrap" style={{ gap: 4, height: 26, padding: "0 8px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "1px solid #FDBA74", background: "#FFF7ED", color: "#C2410C" }} data-testid="att-injury">
            <HeartPulse className="w-3.5 h-3.5" /> {t("Registrar lesión")}
          </button>
        )}
        {att.notes && !showNote && <button type="button" onClick={() => toggleNote(pid)} className="truncate" style={{ fontSize: 11, color: APART, maxWidth: 200 }}>✎ {att.notes}</button>}
      </>
    );
    return (
      <div key={pid} style={{ borderTop: "1px solid #F3EEEE", background: tint }} data-testid={`att-player-${pid}`}>
        <div className="flex items-center" style={{ gap: 8, padding: "3px 10px", minHeight: 32 }}>
          <span className="rs2-display tabular-nums shrink-0" style={{ fontSize: 15, color: RS.granate, width: 22, textAlign: "right" }}>{!guest && !trial ? (p.jersey_number ?? "·") : ""}</span>
          <span className="min-w-0 flex-1 md:flex-none md:w-[190px]">
            <span className="block truncate" style={{ fontWeight: 700, fontSize: 13 }}>{trial ? name : <PlayerName id={pid}>{name}</PlayerName>}</span>
            <span className="block md:hidden truncate" style={{ fontSize: 10.5, color: RS.muted }}>{sub}{inj && <b style={{ color: LOSS }}> · {inj.expected_return ? t("vuelve {d}", { d: format(new Date(inj.expected_return), "d MMM", { locale: dfl }) }) : t("Lesionado")}</b>}</span>
          </span>
          <span className="hidden md:inline truncate" style={{ fontSize: 11, color: RS.muted, width: guest || trial ? 140 : 34 }}>{sub}</span>
          {!guest && !trial && <span className="hidden md:inline-flex" title={t("Últimos 3 entrenos")}><Dots codes={last3(pid)} size={8} /></span>}
          {inj && <span className="hidden md:inline whitespace-nowrap" style={{ fontSize: 11, fontWeight: 700, color: LOSS }}>{inj.expected_return ? t("Lesión · vuelve {d}", { d: format(new Date(inj.expected_return), "d MMM", { locale: dfl }) }) : t("Lesionado")}</span>}
          <span className="hidden md:flex items-center justify-end flex-1 min-w-0" style={{ gap: 6 }}>{extras}</span>
          <StatusButtons value={att.status} onSet={(k) => setStatus(pid, k)} />
          <button type="button" onClick={() => toggleNote(pid)} title={t("Observaciones")} aria-label={t("Observaciones")} className="shrink-0 inline-flex" style={{ padding: 3, color: att.notes ? APART : "#C9BEBF" }}><MessageSquarePlus className="w-4 h-4" /></button>
          {(guest || trial) && <button type="button" onClick={() => removeRecord(pid)} title={t("Quitar de la sesión")} aria-label={t("Quitar de la sesión")} className="shrink-0" style={{ padding: 3, color: "#C9BEBF" }}><X className="w-3.5 h-3.5" /></button>}
        </div>
        {(att.status === "absent" || canInjure || (att.notes && !showNote)) && (
          <div className="flex md:hidden flex-wrap items-center" style={{ gap: 6, padding: "0 10px 5px 40px" }}>{extras}</div>
        )}
        {showNote && (
          <div style={{ padding: "0 10px 6px 40px" }}>
            <input key={`${ev.id}-${pid}-${att.id ? "s" : "n"}`} defaultValue={att.notes || ""} autoFocus
              onBlur={(e) => { if ((e.target.value || "") !== (att.notes || "")) save(pid, { notes: e.target.value }); toggleNote(pid); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              placeholder={t("Observaciones…")} data-testid="att-note"
              style={{ width: "100%", height: 30, fontSize: 12, border: `1px solid ${RS.line}`, borderRadius: 6, padding: "0 8px" }} />
          </div>
        )}
      </div>
    );
  };

  const groups = listOrder === "dorsal"
    ? [{ key: "all", label: "", rows: sortSquad(teamPlayers.map((p) => ({ p })), "dorsal") }]
    : squadGroups(teamPlayers.map((p) => ({ p })), (r) => r.p.position);
  const okIn = (rows) => rows.filter((r) => ["present", "apart"].includes(recFor(r.p.id).status)).length;

  // «Hoy no están»: no asisten, a parte y sin marcar
  const outList = [
    ...teamPlayers.filter((p) => recFor(p.id).status === "absent").map((p) => ({ p, kind: "absent" })),
    ...teamPlayers.filter((p) => recFor(p.id).status === "apart").map((p) => ({ p, kind: "apart" })),
  ];
  const unmarked = teamPlayers.filter((p) => !recFor(p.id).status);
  const navBtn = { height: 28, padding: "0 10px", border: `1px solid ${RS.line}`, borderRadius: 8, background: "#fff", color: RS.ink2, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 };
  const go = (e) => navigate(`/MyTeam/Attendance?eventId=${e.id}`);

  return (
    <Page testId="attendance-session">
      <div className="rs2-wrap flex flex-col pb-20 md:pb-0" style={{ gap: 12, maxWidth: 1440 }}>
        {dialogs}
        <div className="flex items-center" style={{ gap: 8, fontSize: 12 }}>
          <Link to="/MyTeam/Attendance" style={{ color: RS.ink2, fontWeight: 600 }} data-testid="att-back">‹ {t("Entrenamientos")}</Link>
          <span className="flex" style={{ marginLeft: "auto", gap: 6 }}>
            {prev && <button type="button" onClick={() => go(prev)} style={navBtn} data-testid="att-prev"><ChevronLeft className="w-3.5 h-3.5" /><span className="hidden sm:inline capitalize">{format(new Date(prev.date), "EEE d MMM", { locale: dfl })}</span></button>}
            {next && <button type="button" onClick={() => go(next)} style={navBtn} data-testid="att-next"><span className="hidden sm:inline capitalize">{format(new Date(next.date), "EEE d MMM", { locale: dfl })}</span><ChevronRight className="w-3.5 h-3.5" /></button>}
          </span>
        </div>

        {/* Banda */}
        <section className="flex flex-wrap items-center" style={{ background: RS.granateDark, color: "#fff", borderRadius: 12, padding: "14px 18px", gap: 16 }} data-testid="att-band">
          <div className="min-w-0" style={{ flex: "1 1 340px" }}>
            <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.72)" }}>{t("Pasar lista")} · {team?.name}</span>
              {isToday && <span style={{ fontSize: 11, background: RS.naranja, padding: "1px 8px", borderRadius: 999, fontWeight: 700 }}>{t("Hoy")}</span>}
              {ev.title && <span style={{ fontSize: 11, background: "rgba(255,255,255,.12)", padding: "1px 8px", borderRadius: 999 }}>{ev.title}</span>}
            </div>
            <div className={`rs2-display ${offSel ? "line-through" : ""}`} style={{ fontSize: 28, marginTop: 6, lineHeight: 1.05, textTransform: "uppercase" }}>{format(evDate, "EEEE d MMM · HH:mm", { locale: dfl })}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.82)", marginTop: 4 }}>
              {[ev.location, ev.end_date ? t("{n} min", { n: Math.round((new Date(ev.end_date) - evDate) / 60000) }) : null].filter(Boolean).join(" · ")}
              {sheet && <> {ev.location ? "· " : ""}<Link to={`/Methodology?session=${sheet.id}`} style={{ color: "#fff", fontWeight: 700, textDecoration: "underline" }} data-testid="att-sheet"><FileText className="w-3 h-3 inline -mt-0.5" /> {t("Hoja de sesión")} ›</Link></>}
            </div>
            {offSel && <p style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "#FDBA74" }}><Ban className="w-3.5 h-3.5 inline -mt-0.5" /> {cancelText(ev, t)}</p>}
          </div>
          {!offSel && (
            <div className="flex" style={{ gap: 8 }} data-testid="att-counts">
              {[[counts.present, msg("Asisten"), "#86EFAC"], [counts.apart, msg("A parte"), "#93C5FD"], [counts.absent, msg("No"), "#FCA5A5"], [counts.pending, msg("Sin marcar"), "#FDBA74"]].map(([n, l, c]) => (
                <div key={l} style={{ background: "rgba(255,255,255,.08)", borderRadius: 10, padding: "7px 10px", textAlign: "center", minWidth: 58 }}>
                  <div className="rs2-display tabular-nums" style={{ fontSize: 24, color: c, lineHeight: 1 }}>{n}</div>
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.75)" }}>{t(l)}</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col" style={{ gap: 6 }}>
            {!offSel && counts.pending > 0 && <button type="button" onClick={markRest} className="hidden md:inline-flex items-center justify-center" style={{ gap: 6, height: 32, padding: "0 14px", borderRadius: 8, background: RS.naranja, color: "#fff", fontSize: 12, fontWeight: 700 }} data-testid="att-mark-rest"><Check className="w-3.5 h-3.5" /> {t("Los que faltan asisten")}</button>}
            <div className="flex" style={{ gap: 6 }}>
              <button type="button" onClick={() => setCancelFor(ev)} className="inline-flex items-center" style={{ gap: 5, height: 28, padding: "0 10px", borderRadius: 8, background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 11, fontWeight: 700 }} data-testid="att-cancel">
                {offSel ? <><RotateCcw className="w-3 h-3" /> {t("Restaurar")}</> : <><Ban className="w-3 h-3" /> {t("Cancelar entreno")}</>}
              </button>
              <button type="button" onClick={() => setEditingEvent(ev)} className="inline-flex items-center" style={{ gap: 5, height: 28, padding: "0 10px", borderRadius: 8, background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 11, fontWeight: 700 }} data-testid="att-edit"><Pencil className="w-3 h-3" /> {t("Editar")}</button>
            </div>
          </div>
        </section>

        {offSel ? (
          <div className="rs2-card" style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: RS.muted }}>{t("Este entreno estaba previsto pero no se ha celebrado, así que no hay lista que pasar.")}</div>
        ) : (
          <div className="flex flex-wrap items-start" style={{ gap: 12 }}>
            <section className="rs2-card" style={{ flex: "2 1 620px", minWidth: 0, overflow: "hidden" }} data-testid="att-list">
              <Head title={t("Plantilla · {n}", { n: teamPlayers.length + guests.length + trials.length })} right={<><span className="hidden lg:inline" style={{ fontSize: 11, color: RS.muted }}>{t("Se guarda al tocar · puntos = últimos 3 entrenos")}</span><Seg options={[["posicion", msg("Por posición")], ["dorsal", msg("Por dorsal")]]} value={listOrder} onChange={setListOrder} testPrefix="att-order" label={t("Orden")} /></>} />
              {groups.map((g) => (
                <div key={g.key}>
                  {g.label && <div style={{ padding: "8px 8px 2px" }}><GroupHead title={t(g.label)} right={t("{a} de {b}", { a: okIn(g.rows), b: g.rows.length })} /></div>}
                  {g.rows.map((r) => row(r.p))}
                </div>
              ))}
              {(guests.length > 0 || trials.length > 0) && (
                <div>
                  <div style={{ padding: "8px 8px 2px" }}><GroupHead title={t("De otros equipos y a prueba")} right={guests.length + trials.length} /></div>
                  {guests.map((p) => row(p, { guest: true }))}
                  {trials.map((r) => row(null, { trial: r }))}
                </div>
              )}
              <div style={{ height: 8 }} />
            </section>

            <div className="flex flex-col" style={{ flex: "1 1 290px", minWidth: 0, gap: 12 }}>
              <section className="rs2-card" data-testid="att-out">
                <Head title={isToday ? t("Hoy no están") : t("No están")} />
                {!outList.length && !unmarked.length && <p style={{ padding: "10px 14px", fontSize: 12, color: WIN, fontWeight: 600 }}>{t("Están todos")}</p>}
                {outList.map(({ p, kind }) => {
                  const att = recFor(p.id);
                  const inj = openInjury.get(p.id);
                  const ra = kind === "absent" ? recentAbsences(past.filter((x) => new Date(x.ev.date) <= evDate), p.id, 5) : null;
                  const chipSty = { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap" };
                  return (
                    <div key={p.id} className="flex items-center" style={{ gap: 8, padding: "6px 14px", borderTop: "1px solid #F3EEEE", fontSize: 12 }}>
                      <b className="truncate" style={{ flex: 1, minWidth: 0 }}>{playerFullName(p)}</b>
                      {kind === "absent" && <span style={{ ...chipSty, background: "#FEE2E2", color: LOSS }}>{att.absence_reason ? t(REASON_LABEL[att.absence_reason] || att.absence_reason) : t("No")}</span>}
                      {kind === "apart" && <span style={{ ...chipSty, background: "#DBEAFE", color: APART }}>{t("A parte")}</span>}
                      {kind === "pending" && <span style={{ ...chipSty, background: "#FFEDD5", color: WARN }}>{t("Sin marcar")}</span>}
                      {inj?.expected_return ? <span style={{ fontSize: 11, color: RS.muted, whiteSpace: "nowrap" }}>{t("vuelve {d}", { d: format(new Date(inj.expected_return), "d MMM", { locale: dfl }) })}</span>
                        : ra && ra.absent >= 2 ? <span style={{ fontSize: 11, color: RS.muted, whiteSpace: "nowrap" }}>{t("{a} faltas en {b} entrenos", { a: ra.absent, b: ra.of })}</span> : null}
                      {kind === "apart" && !inj && <button type="button" onClick={() => setInjuryFor(p)} style={{ fontSize: 11, fontWeight: 700, color: "#C2410C", whiteSpace: "nowrap" }}><HeartPulse className="w-3 h-3 inline -mt-0.5" /> {t("Registrar lesión")}</button>}
                    </div>
                  );
                })}
                {unmarked.length > 0 && (
                  <div className="flex items-center" style={{ gap: 8, padding: "6px 14px", borderTop: "1px solid #F3EEEE", fontSize: 12 }} data-testid="att-unmarked">
                    <span className="truncate" style={{ flex: 1, minWidth: 0, color: RS.ink2 }}>{unmarked.map((p) => playerFullName(p)).join(", ")}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap", background: "#FFEDD5", color: WARN }}>{t("{n} sin marcar", { n: unmarked.length })}</span>
                  </div>
                )}
                <div style={{ height: 6 }} />
              </section>

              <section className="rs2-card" data-testid="att-add">
                <Head title={t("Añadir a este entreno")} />
                <div className="flex flex-col" style={{ padding: "10px 14px 12px", gap: 8 }}>
                  <Label>{t("De otro equipo del club")}</Label>
                  {showGuests ? (
                    <GuestPlayerSelector teamId={ev.team_id} selectedPlayers={guests.map((p) => p.id)} onAdd={(player) => save(player.id, {})} onRemove={(pid) => removeRecord(pid)} type="training" />
                  ) : (
                    <button type="button" onClick={() => setShowGuests(true)} style={{ height: 32, borderRadius: 8, border: `1px dashed ${RS.input}`, fontSize: 12, fontWeight: 600, color: RS.granate }} data-testid="att-add-guest">+ {t("Buscar jugador de otro equipo")}</button>
                  )}
                  <Label style={{ marginTop: 4 }}>{t("Jugador a prueba")}</Label>
                  <div className="flex" style={{ gap: 6 }}>
                    <span className="flex items-center flex-1" style={{ gap: 6, border: `1px solid ${RS.input}`, borderRadius: 8, padding: "0 8px", height: 32 }}>
                      <UserPlus className="w-3.5 h-3.5 shrink-0" style={{ color: WARN }} aria-hidden="true" />
                      <input value={trialName} onChange={(e) => setTrialName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTrial()} placeholder={t("Nombre y apellido…")} aria-label={t("Jugador a prueba")} data-testid="att-trial"
                        style={{ flex: 1, minWidth: 0, border: 0, outline: 0, fontSize: 12, background: "none" }} />
                    </span>
                    <Btn onClick={addTrial} disabled={!trialName.trim()} style={{ height: 32, fontSize: 12, padding: "0 12px" }} testId="att-trial-add">{t("Añadir")}</Btn>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Móvil: barra fija abajo */}
        {!offSel && (
          <div className="md:hidden fixed left-0 right-0 bottom-0 z-30 flex items-center" style={{ gap: 10, padding: "9px 12px", background: "#fff", borderTop: `1px solid ${RS.line}`, boxShadow: "0 -4px 12px rgba(0,0,0,.06)" }} data-testid="att-mobile-bar">
            <span style={{ fontSize: 12, color: RS.ink2 }}>{t("{a} de {b} marcados", { a: counts.marked, b: teamPlayers.length })}</span>
            {counts.pending > 0 && <button type="button" onClick={markRest} className="inline-flex items-center" style={{ marginLeft: "auto", gap: 5, height: 34, padding: "0 12px", borderRadius: 8, background: RS.naranja, color: "#fff", fontSize: 12, fontWeight: 700 }}><Check className="w-3.5 h-3.5" /> {t("Los que faltan asisten")}</button>}
          </div>
        )}
      </div>
    </Page>
  );
}
