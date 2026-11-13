// Calendario del club (rediseño del 13/11/2026, maqueta «Maqueta Calendario · RS Manager» aprobada por Nacho):
// resumen de la semana, filtros en una franja (qué se ve, etapa, campo y varios equipos), mes con cada partido a la vista,
// panel del día a la derecha y, en el móvil, la semana por días. Cálculos puros en src/lib/calendarView.js.
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addDays, addWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, Pencil, Trash2, MapPin, Users, ClipboardList, FileText, Home as HomeIcon, Plane as PlaneIcon, ChevronDown, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import EventAttendanceDialog from "@/components/calendar/EventAttendanceDialog";
import ConvocatoriaDialog from "@/components/calendar/ConvocatoriaDialog";
import EditEventDialog from "@/components/myteam/EditEventDialog";
import CreateEventDialog from "@/components/myteam/CreateEventDialog";
import BulkCancelButton from "@/components/myteam/BulkCancelButton";
import SessionReportDialog from "@/components/calendar/SessionReportDialog";
import EventListWithDragDrop from "@/components/calendar/EventListWithDragDrop";
import WeeklyCalendar from "@/components/calendar/WeeklyCalendar";
import CalendarSubscribe from "@/components/calendar/CalendarSubscribe";
import EventWeather from "@/components/EventWeather";
import MatchResultPill, { resultOf } from "@/components/calendar/MatchResultPill";
import { Page, RS } from "@/components/rs2/kit";
import { WIN, LOSS } from "@/components/rs2/dashParts";
import { sortTeams } from "@/lib/teamOrder";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { isCancelled, cancelText } from "@/lib/eventCancel";
import { useMatchStatus } from "@/lib/matchStatus";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { eventKind, eventsOnDay, matchesCalFilters, EMPTY_CAL_FILTERS, KINDS, dayItems, weekSummary, fieldUse, placeOptions } from "@/lib/calendarView";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT, useDateLocale, msg } from "@/i18n";

const EVENT_LABELS = {
  partido_amistoso: msg("Partido amistoso"), partido_liga: msg("Partido de liga"), torneo: msg("Torneo"),
  entrenamiento_fisico: msg("Entrenamiento físico"), entrenamiento: msg("Entrenamiento"), sesion_teorica: msg("Sesión teórica"), sesion_video: msg("Sesión de vídeo"),
  reunion_equipo: msg("Reunión de equipo"), reunion_jugador: msg("Reunión jugador"), reunion_capitanes: msg("Reunión de capitanes"), stage: msg("Stage"),
  concentracion: msg("Concentración"), cena_equipo: msg("Cena de equipo"), comida_equipo: msg("Comida de equipo"), evento_club: msg("Evento del club"),
};
const KIND_STYLE = {
  match: { bg: "#FBEFEF", fg: RS.ink, bar: RS.granate },
  training: { bg: "#FFF1E6", fg: "#8A3A00", bar: RS.naranja },
  other: { bg: "#EEF2FF", fg: "#3730A3", bar: "#6366F1" },
};
const KIND_LABEL = { match: msg("Partidos"), training: msg("Entrenos"), other: msg("Otros") };
const VIEW_KEY = "rs_cal_view";
const FILTER_KEY = "rs_cal_filters";
const chip = (bg, fg) => ({ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap", display: "inline-block" });
const seasonLabel = (s) => String(s || "").replace(/^(\d{4})-\d{2}(\d{2})$/, "$1–$2");
const hhmm = (d) => format(new Date(d), "HH:mm");
const readFilters = () => {
  try {
    const f = JSON.parse(localStorage.getItem(FILTER_KEY) || "null");
    if (!f) return EMPTY_CAL_FILTERS;
    const kinds = Array.isArray(f.kinds) ? f.kinds.filter((k) => KINDS.includes(k)) : KINDS;
    return { kinds: kinds.length ? kinds : KINDS, stage: ["all", "f7", "f11"].includes(f.stage) ? f.stage : "all", place: typeof f.place === "string" ? f.place : "all", teams: Array.isArray(f.teams) ? f.teams : [] };
  } catch { return EMPTY_CAL_FILTERS; }
};

function Pill({ on, onClick, children, testId, title }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} data-testid={testId} title={title}
      style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, border: "1px solid", background: on ? RS.granate : "#fff", color: on ? "#fff" : RS.ink2, borderColor: on ? RS.granate : RS.line, fontWeight: on ? 700 : 500, whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}
function Segmented({ options, value, onChange, testPrefix, label }) {
  const t = useT();
  return (
    <div role="group" aria-label={label} className="flex" style={{ gap: 3, background: RS.soft, borderRadius: 999, padding: 3 }}>
      {options.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k} data-testid={`${testPrefix}-${k}`}
          style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, border: 0, fontWeight: value === k ? 700 : 400, background: value === k ? "#fff" : "none", color: value === k ? RS.granate : RS.ink2, boxShadow: value === k ? "0 1px 2px rgba(0,0,0,.08)" : "none", whiteSpace: "nowrap" }}>{t(l)}</button>
      ))}
    </div>
  );
}
const FilterLabel = ({ children }) => <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: RS.muted }}>{children}</span>;

export default function Calendar() {
  const t = useT();
  const dfl = useDateLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { teamIds: myTeamIds = [] } = useTeamAccess();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [weekRef, setWeekRef] = useState(new Date());
  const [deleteId, setDeleteId] = useState(null);
  const [deleteSeriesId, setDeleteSeriesId] = useState(null);
  const [editDialogEvent, setEditDialogEvent] = useState(null);
  const [createDay, setCreateDay] = useState(null);
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [convocatoriaEvent, setConvocatoriaEvent] = useState(null);
  const [attendanceEvent, setAttendanceEvent] = useState(null);
  const [sessionReportEvent, setSessionReportEvent] = useState(null);
  const coachName = "";
  const [viewMode, setViewModeState] = useState(() => { try { return localStorage.getItem(VIEW_KEY) || "calendar"; } catch { return "calendar"; } });
  const setViewMode = (v) => { setViewModeState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* sin almacenamiento */ } };
  const [f, setF] = useState(readFilters);
  useEffect(() => { try { localStorage.setItem(FILTER_KEY, JSON.stringify(f)); } catch { /* sin almacenamiento */ } }, [f]);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: teamsRaw = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: fields = [] } = useQuery({ queryKey: ["fields"], queryFn: () => base44.entities.Field.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance_all"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: convocs = [] } = useQuery({ queryKey: ["convocatorias_all"], queryFn: () => base44.entities.Convocatoria.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries_all"], queryFn: () => base44.entities.Injury.list(), retry: false });
  const { pending } = useMatchStatus();

  const teams = useMemo(() => sortTeams(teamsRaw), [teamsRaw]);
  const teamById = useMemo(() => new Map(teams.map((tm) => [tm.id, tm])), [teams]);
  const fieldName = (id) => fields.find((x) => x.id === id)?.name || "";
  const isF7 = (id) => { const tm = teamById.get(id); return tm ? teamPlaysF7(tm) : false; };
  const attCount = useMemo(() => { const m = new Map(); for (const a of attendance) if (a.status) m.set(a.event_id, (m.get(a.event_id) || 0) + 1); return m; }, [attendance]);
  const convBy = useMemo(() => new Map(convocs.map((c) => [c.event_id, c])), [convocs]);
  const injuredByTeam = useMemo(() => {
    const out = new Set(injuries.filter((i) => i.status !== "alta").map((i) => i.player_id));
    const m = new Map();
    for (const p of players) if (p.status !== "baja" && (p.status === "lesionado" || out.has(p.id))) m.set(p.team_id, (m.get(p.team_id) || 0) + 1);
    return m;
  }, [players, injuries]);

  const filtered = useMemo(() => events.filter((e) => matchesCalFilters(e, f, { isF7 })), [events, f, teamById]);  
  const week = useMemo(() => weekSummary(filtered, { withAttendance: new Set(attCount.keys()), convByEvent: convBy, pending }), [filtered, attCount, convBy, pending]);

  const monthStart = startOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }) });
  const monthEvents = useMemo(() => events.filter((e) => isSameMonth(new Date(e.date), currentMonth) && matchesCalFilters(e, { ...f, place: "all" }, { isF7 })), [events, currentMonth, f, teamById]);  
  const places = placeOptions(monthEvents, fieldName);
  const today = new Date();
  const singleTeam = f.teams.length === 1 ? f.teams[0] : null;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Event.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Event.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["events"] }); setDeleteId(null); },
    onError: () => { queryClient.invalidateQueries({ queryKey: ["events"] }); setDeleteId(null); },
  });
  const deleteSeriesMutation = useMutation({
    mutationFn: async (seriesId) => Promise.all(events.filter((e) => e.series_id === seriesId).map((e) => base44.entities.Event.delete(e.id))),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["events"] }); setDeleteSeriesId(null); },
  });
  const handleDragEnd = ({ destination, source, draggableId }) => {
    if (!destination || source.droppableId === destination.droppableId) return;
    const event = events.find((e) => e.id === draggableId);
    if (!event) return;
    const [y, m, d] = destination.droppableId.split("-");
    const cur = new Date(event.date);
    const nd = new Date(y, parseInt(m) - 1, parseInt(d), cur.getHours(), cur.getMinutes());
    updateMutation.mutate({ id: event.id, data: { date: format(nd, "yyyy-MM-dd'T'HH:mm") } });
  };
  const openMatch = (e) => navigate(`/MatchDetail?id=${e.id}&teamId=${e.team_id}`);
  const teamShort = (e) => teamById.get(e.team_id)?.name || t("Club");

  // ── Una línea del mes ─────────────────────────────────────────
  const monthItem = (it, i) => {
    if (it.group) {
      return (
        <button key={`g${i}`} type="button" onClick={(ev) => { ev.stopPropagation(); setSelectedDay(new Date(it.date)); }}
          style={{ ...line, background: KIND_STYLE.training.bg, color: KIND_STYLE.training.fg }} data-testid="cal-group">
          <b>{hhmm(it.date)}</b> {t("{n} entrenos", { n: it.n })}
        </button>
      );
    }
    const e = it.event, kind = eventKind(e), st = KIND_STYLE[kind];
    const { rs, result } = resultOf(e);
    const cancelled = isCancelled(e);
    return (
      <button key={e.id} type="button" title={[teamShort(e), e.opponent ? t("vs {v}", { v: e.opponent }) : e.title, cancelled ? cancelText(e, t) : ""].filter(Boolean).join(" · ")}
        onClick={(ev) => { ev.stopPropagation(); if (kind === "match") openMatch(e); else setSelectedDay(new Date(e.date)); }}
        data-testid={`cal-item-${e.id}`}
        style={{ ...line, background: cancelled ? RS.lineSoft : st.bg, color: cancelled ? RS.faint : st.fg, borderLeft: kind === "match" ? `3px solid ${cancelled ? RS.faint : st.bar}` : 0, textDecoration: cancelled ? "line-through" : "none" }}>
        <b>{hhmm(e.date)}</b>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0, textAlign: "left" }}>{kind === "match" ? teamShort(e) : (e.team_id && kind === "training" ? teamShort(e) : e.title)}</span>
        {rs && <span style={{ color: rs.solid, fontWeight: 800 }} aria-hidden="true">{result === "victoria" ? "✓" : result === "derrota" ? "✕" : "–"}</span>}
      </button>
    );
  };
  const line = { display: "flex", alignItems: "center", gap: 4, width: "100%", fontSize: 10, padding: "2px 5px", borderRadius: 5, whiteSpace: "nowrap", overflow: "hidden", border: 0, lineHeight: 1.35 };

  // ── Una fila del panel del día ────────────────────────────────
  const statusChips = (e) => {
    const kind = eventKind(e);
    const past = new Date(e.date) < today;
    const out = [];
    if (isCancelled(e)) return [<span key="c" style={chip(RS.lineSoft, RS.ink2)}>{cancelText(e, t)}</span>];
    if (kind === "match") {
      if (pending.has(e.id)) out.push(<button key="p" type="button" onClick={() => openMatch(e)} style={{ ...chip("#FEF3C7", "#92400E"), border: 0 }}>{t("Por cerrar")}</button>);
      if (!past) {
        const n = convBy.get(e.id)?.player_ids?.length || 0;
        out.push(n
          ? <button key="cv" type="button" onClick={() => setConvocatoriaEvent(e)} style={{ ...chip("#DCFCE7", WIN), border: 0 }}>{t("Convocatoria · {n}", { n })}</button>
          : <button key="cv" type="button" onClick={() => setConvocatoriaEvent(e)} style={{ ...chip("#FEF3C7", "#92400E"), border: 0 }} data-testid={`cal-noconv-${e.id}`}>{t("Sin convocatoria")}</button>);
        const inj = injuredByTeam.get(e.team_id) || 0;
        if (inj) out.push(<span key="i" style={chip("#FEE2E2", LOSS)}>{inj === 1 ? t("1 lesionado") : t("{n} lesionados", { n: inj })}</span>);
      }
    } else if (kind === "training" && past) {
      const n = attCount.get(e.id) || 0;
      out.push(n
        ? <button key="a" type="button" onClick={() => setAttendanceEvent(e)} style={{ ...chip("#DCFCE7", WIN), border: 0 }}>{t("Lista pasada · {n}", { n })}</button>
        : <button key="a" type="button" onClick={() => setAttendanceEvent(e)} style={{ ...chip("#FEF3C7", "#92400E"), border: 0 }} data-testid={`cal-nolist-${e.id}`}>{t("Pasar lista")}</button>);
    }
    return out;
  };
  const iconBtn = { padding: 4, borderRadius: 6, color: "#B8ACAD", background: "none", border: 0 };
  const dayRow = (e) => {
    const kind = eventKind(e), isMatch = kind === "match";
    const place = e.field_id ? fieldName(e.field_id) || e.location : e.location;
    return (
      <div key={e.id} className="flex" style={{ gap: 10, padding: "8px 0", borderTop: `1px solid ${RS.lineSoft}` }} data-testid={`cal-day-row-${e.id}`}>
        <span className="rs2-display tabular-nums" style={{ fontSize: 16, color: KIND_STYLE[kind].bar, width: 44, flex: "none" }}>{hhmm(e.date)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <button type="button" onClick={() => (isMatch ? openMatch(e) : setEditDialogEvent(e))} className="hover:underline" style={{ fontWeight: 700, fontSize: 13, color: isCancelled(e) ? RS.faint : RS.ink, textDecoration: isCancelled(e) ? "line-through" : undefined, background: "none", border: 0, padding: 0, textAlign: "left" }}>
            {e.team_id ? teamShort(e) : e.title}
          </button>
          <span style={{ display: "block", fontSize: 12, color: RS.ink2 }}>
            {isMatch && e.opponent ? `${t("vs {v}", { v: e.opponent })} · ` : e.team_id && !isMatch && e.title && e.title.toLowerCase() !== t(EVENT_LABELS[e.type] || e.type).toLowerCase() ? `${e.title} · ` : ""}{t(EVENT_LABELS[e.type] || e.type)}{e.fcf_jornada ? ` · ${t("J{n}", { n: e.fcf_jornada })}` : ""}
          </span>
          {place && (
            <span className="flex items-center" style={{ gap: 5, fontSize: 11, color: RS.muted, marginTop: 2 }}>
              {isMatch ? (e.is_home === false ? <PlaneIcon width={12} height={12} aria-label={t("Fuera")} /> : <HomeIcon width={12} height={12} aria-label={t("En casa")} />) : <MapPin width={12} height={12} aria-hidden="true" />}{place}
            </span>
          )}
          <span className="flex flex-wrap items-center" style={{ gap: 4, marginTop: 4 }}>
            <MatchResultPill event={e} size="sm" />
            {statusChips(e)}
            <EventWeather event={e} rain size="sm" />
          </span>
        </span>
        <span className="flex flex-col" style={{ gap: 0, flex: "none" }}>
          <span className="flex">
            <button type="button" onClick={() => setAttendanceEvent(e)} title={t("Asistencia")} aria-label={t("Asistencia")} style={iconBtn}><ClipboardList className="w-3.5 h-3.5" /></button>
            {isMatch
              ? <button type="button" onClick={() => setConvocatoriaEvent(e)} title={t("Convocatoria")} aria-label={t("Convocatoria")} style={iconBtn}><Users className="w-3.5 h-3.5" /></button>
              : <button type="button" onClick={() => setSessionReportEvent(e)} title={t("Informe")} aria-label={t("Informe")} style={iconBtn}><FileText className="w-3.5 h-3.5" /></button>}
          </span>
          <span className="flex">
            <button type="button" onClick={() => setEditDialogEvent(e)} title={t("Editar")} aria-label={t("Editar")} style={iconBtn} data-testid={`cal-edit-${e.id}`}><Pencil className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => setDeleteId(e.id)} title={t("Eliminar")} aria-label={t("Eliminar")} style={iconBtn}><Trash2 className="w-3.5 h-3.5" /></button>
          </span>
          {e.series_id && <button type="button" onClick={() => setDeleteSeriesId(e.series_id)} title={t("Eliminar toda la serie")} style={{ ...iconBtn, fontSize: 9, fontWeight: 800 }}>{t("SERIE")}</button>}
        </span>
      </div>
    );
  };
  const dayPanel = (day, { compact = false } = {}) => {
    const evs = eventsOnDay(filtered, day);
    const nm = evs.filter((e) => eventKind(e) === "match" && !isCancelled(e)).length;
    const nt = evs.filter((e) => eventKind(e) === "training" && !isCancelled(e)).length;
    const use = fieldUse(evs, fieldName);
    return (
      <div data-testid="cal-day">
        <div className="flex flex-wrap items-baseline" style={{ gap: 8 }}>
          <span className="rs2-display" style={{ fontSize: compact ? 16 : 20, color: RS.granate, textTransform: "uppercase" }}>{format(day, "EEEE d", { locale: dfl })}</span>
          <span style={{ fontSize: 12, color: RS.muted }}>{[nm ? (nm === 1 ? t("1 partido") : t("{n} partidos", { n: nm })) : null, nt ? (nt === 1 ? t("1 entreno") : t("{n} entrenos", { n: nt })) : null].filter(Boolean).join(" · ") || t("Sin eventos")}</span>
        </div>
        {use.length > 0 && <div style={{ fontSize: 11, color: RS.muted, margin: "4px 0 2px" }} data-testid="cal-field-use">{use.map((u) => `${u.name}: ${u.n} (${u.times.join(" · ")})`).join(" — ")}</div>}
        {evs.map(dayRow)}
        <button type="button" onClick={() => setCreateDay(day)} data-testid="cal-add-day"
          style={{ width: "100%", marginTop: 8, fontSize: 12, fontWeight: 700, padding: 7, borderRadius: 8, border: `1px dashed ${RS.line}`, background: "#fff", color: RS.granate }}>
          + {t("Añadir evento el {d}", { d: format(day, "EEEE d", { locale: dfl }) })}
        </button>
      </div>
    );
  };

  // ── Resumen de la semana ──────────────────────────────────────
  const kpis = [
    { k: "matches", n: week.matches, label: t("partidos esta semana"), sub: t("{a} en casa · {b} fuera", { a: week.home, b: week.away }), color: RS.granate },
    { k: "trainings", n: week.trainings, label: t("entrenos esta semana"), sub: week.cancelled ? (week.cancelled === 1 ? t("1 suspendido") : t("{n} suspendidos", { n: week.cancelled })) : "", color: RS.ink2 },
    { k: "lists", n: week.listsDue, label: t("listas por pasar"), sub: t("entrenos ya hechos"), color: week.listsDue ? "#B45309" : RS.ink2 },
    { k: "conv", n: week.convDue, label: t("convocatorias por hacer"), sub: t("partidos de esta semana"), color: week.convDue ? "#B45309" : RS.ink2 },
    { k: "close", n: week.toClose, label: t("partidos por cerrar"), sub: t("acta o minutos"), color: week.toClose ? LOSS : RS.ink2 },
  ];

  // ── Filtros ───────────────────────────────────────────────────
  const toggleKind = (k) => setF((x) => { const has = x.kinds.includes(k); const kinds = has ? x.kinds.filter((y) => y !== k) : [...x.kinds, k]; return { ...x, kinds: kinds.length ? kinds : x.kinds }; });
  const toggleTeam = (id) => setF((x) => ({ ...x, teams: x.teams.includes(id) ? x.teams.filter((y) => y !== id) : [...x.teams, id] }));
  const mine = myTeamIds.filter((id) => teamById.has(id));
  const isMine = mine.length > 0 && f.teams.length === mine.length && mine.every((id) => f.teams.includes(id));
  const teamLabel = f.teams.length === 0 ? t("Todos ({n})", { n: teams.length }) : f.teams.length === 1 ? (teamById.get(f.teams[0])?.name || "1") : t("{n} equipos", { n: f.teams.length });
  const filterBar = (
    <div className="rs2-card flex flex-wrap items-center" style={{ gap: "8px 14px", padding: "8px 14px" }} data-testid="cal-filters">
      <span className="flex flex-wrap items-center" style={{ gap: 6 }}><FilterLabel>{t("Ver")}</FilterLabel>{KINDS.map((k) => <Pill key={k} on={f.kinds.includes(k)} onClick={() => toggleKind(k)} testId={`cal-kind-${k}`}>{t(KIND_LABEL[k])}</Pill>)}</span>
      <span className="flex flex-wrap items-center" style={{ gap: 6 }}><FilterLabel>{t("Etapa")}</FilterLabel>{[["all", t("Todos")], ["f11", t("Fútbol 11")], ["f7", t("Fútbol 7")]].map(([k, l]) => <Pill key={k} on={f.stage === k} onClick={() => set({ stage: k })} testId={`cal-stage-${k}`}>{l}</Pill>)}</span>
      {(places.fields.length > 0 || places.away > 0 || f.place !== "all") && (
        <span className="flex flex-wrap items-center" style={{ gap: 6 }}><FilterLabel>{t("Campo")}</FilterLabel>
          <Pill on={f.place === "all"} onClick={() => set({ place: "all" })} testId="cal-place-all">{t("Todos")}</Pill>
          {places.fields.map((p) => <Pill key={p.id} on={f.place === p.id} onClick={() => set({ place: p.id })} testId={`cal-place-${p.id}`}>{p.name} <span style={{ opacity: 0.6 }}>{p.n}</span></Pill>)}
          {places.away > 0 && <Pill on={f.place === "away"} onClick={() => set({ place: "away" })} testId="cal-place-away">{t("Fuera")} <span style={{ opacity: 0.6 }}>{places.away}</span></Pill>}
        </span>
      )}
      <span className="flex flex-wrap items-center" style={{ gap: 6 }}><FilterLabel>{t("Equipos")}</FilterLabel>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" data-testid="cal-teams" style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink, display: "inline-flex", alignItems: "center", gap: 4 }}>{teamLabel}<ChevronDown width={13} height={13} aria-hidden="true" /></button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-3" data-testid="cal-teams-list">
            <div className="flex" style={{ gap: 12, fontSize: 11, marginBottom: 6 }}>
              <button type="button" onClick={() => set({ teams: [] })} style={{ fontWeight: 700, color: RS.granate }} data-testid="cal-teams-all">{t("Todos")}</button>
              {mine.length > 0 && <button type="button" onClick={() => set({ teams: mine })} style={{ fontWeight: 700, color: RS.granate }}>{t("Mis equipos")}</button>}
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {teams.map((tm) => (
                <label key={tm.id} className="flex items-center" style={{ gap: 7, fontSize: 12, padding: "3px 0", color: RS.ink, cursor: "pointer" }}>
                  <input type="checkbox" checked={f.teams.length === 0 || f.teams.includes(tm.id)} onChange={() => (f.teams.length === 0 ? set({ teams: teams.filter((x) => x.id !== tm.id).map((x) => x.id) }) : toggleTeam(tm.id))} style={{ accentColor: RS.granate }} data-testid={`cal-team-${tm.id}`} />
                  <span style={{ flex: 1, minWidth: 0 }} className="truncate">{tm.name}</span>
                  <span style={{ fontSize: 10, color: RS.muted }}>{teamPlaysF7(tm) ? "F7" : "F11"}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {mine.length > 0 && <Pill on={isMine} onClick={() => set({ teams: isMine ? [] : mine })} testId="cal-mine">{t("Mis equipos")}</Pill>}
      </span>
    </div>
  );

  // ── Mes (ordenador) ───────────────────────────────────────────
  const MAX_LINES = 4;
  const monthView = (
    <section className="rs2-card" style={{ flex: "1 1 560px", minWidth: 0, overflow: "hidden", padding: 0 }} data-testid="cal-month">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
        {Array.from({ length: 7 }, (_, i) => format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), "EEE", { locale: dfl }).replace(/\.$/, "")).map((d) => (
          <div key={d} style={{ padding: "6px 8px", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: RS.muted, textTransform: "uppercase", borderBottom: `1px solid ${RS.line}` }}>{d}</div>
        ))}
        {days.map((day) => {
          const items = dayItems(eventsOnDay(filtered, day));
          const inMonth = isSameMonth(day, currentMonth);
          const sel = isSameDay(day, selectedDay);
          const isToday = isSameDay(day, today);
          const weekend = day.getDay() === 0 || day.getDay() === 6;
          const more = items.length - MAX_LINES;
          return (
            <div key={day.toISOString()} role="button" tabIndex={0} onClick={() => setSelectedDay(day)} onKeyDown={(ev) => { if (ev.key === "Enter") setSelectedDay(day); }}
              aria-label={format(day, "EEEE d MMMM", { locale: dfl })} aria-pressed={sel} data-testid={`cal-cell-${format(day, "yyyy-MM-dd")}`}
              style={{ minHeight: 104, padding: "4px 5px", borderRight: `1px solid ${RS.lineSoft}`, borderBottom: `1px solid ${RS.lineSoft}`, background: sel ? "#FFF7F0" : weekend ? "#FCFAF9" : "#fff", boxShadow: sel ? `inset 0 0 0 2px ${RS.naranja}` : "none", display: "flex", flexDirection: "column", gap: 2, cursor: "pointer", opacity: inMonth ? 1 : 0.45, minWidth: 0 }}>
              <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: 99, alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: isToday ? 700 : 500, background: isToday ? RS.granate : "none", color: isToday ? "#fff" : RS.ink }}>{format(day, "d")}</span>
              {items.slice(0, more > 0 ? MAX_LINES - 1 : MAX_LINES).map(monthItem)}
              {more > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: RS.muted, textDecoration: "underline" }}>{t("+{n} más", { n: more + 1 })}</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: 14, padding: "8px 14px", fontSize: 11, color: RS.muted, borderTop: `1px solid ${RS.lineSoft}` }}>
        {["match", "training", "other"].map((k) => <span key={k} className="inline-flex items-center" style={{ gap: 4 }}><span style={{ width: 10, height: 10, background: KIND_STYLE[k].bg, borderLeft: k === "match" ? `3px solid ${KIND_STYLE.match.bar}` : 0 }} />{t(KIND_LABEL[k])}</span>)}
        <span><b style={{ color: WIN }}>✓</b> {t("ganado")} · <b style={{ color: LOSS }}>✕</b> {t("perdido")} · <b style={{ color: "#B45309" }}>–</b> {t("empate")}</span>
        <span style={{ marginLeft: "auto" }}>{t("{n} eventos este mes", { n: filtered.filter((e) => isSameMonth(new Date(e.date), currentMonth)).length })}</span>
      </div>
    </section>
  );

  // ── Móvil: la semana por días ─────────────────────────────────
  const weekStart = startOfWeek(weekRef, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const mobileWeek = (
    <div className="flex flex-col" style={{ gap: 10 }} data-testid="cal-mobile-week">
      <div className="flex items-center" style={{ gap: 8 }}>
        <button type="button" onClick={() => setWeekRef(addWeeks(weekRef, -1))} aria-label={t("Semana anterior")} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff" }}><ChevronLeft className="w-4 h-4 mx-auto" /></button>
        <span className="rs2-display" style={{ fontSize: 18, flex: 1, textAlign: "center", textTransform: "uppercase" }}>{format(weekStart, "d", { locale: dfl })} – {format(addDays(weekStart, 6), "d MMM", { locale: dfl })}</span>
        <button type="button" onClick={() => setWeekRef(addWeeks(weekRef, 1))} aria-label={t("Semana siguiente")} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff" }}><ChevronRight className="w-4 h-4 mx-auto" /></button>
      </div>
      <div className="flex" style={{ gap: 5 }}>
        {weekDays.map((d) => {
          const evs = eventsOnDay(filtered, d).filter((e) => !isCancelled(e));
          const hasMatch = evs.some((e) => eventKind(e) === "match");
          const isToday = isSameDay(d, today), sel = isSameDay(d, selectedDay);
          return (
            <button key={d.toISOString()} type="button" onClick={() => { setSelectedDay(d); document.getElementById(`cal-m-${format(d, "yyyy-MM-dd")}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              style={{ flex: 1, padding: "6px 0", borderRadius: 10, border: `1px solid ${sel ? RS.naranja : RS.line}`, background: isToday ? RS.granate : "#fff", color: isToday ? "#fff" : RS.ink, fontSize: 11, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ opacity: 0.7, textTransform: "uppercase" }}>{format(d, "EEEEE", { locale: dfl })}</span>
              <b style={{ fontSize: 14 }}>{format(d, "d")}</b>
              <span style={{ width: 5, height: 5, borderRadius: 9, background: evs.length ? (hasMatch ? (isToday ? "#fff" : RS.granate) : RS.naranja) : "transparent" }} />
            </button>
          );
        })}
      </div>
      {weekDays.map((d) => (eventsOnDay(filtered, d).length > 0 || isSameDay(d, selectedDay)) && (
        <div key={d.toISOString()} id={`cal-m-${format(d, "yyyy-MM-dd")}`} className="rs2-card" style={{ padding: "10px 12px" }}>{dayPanel(d, { compact: true })}</div>
      ))}
    </div>
  );

  return (
    <Page testId="calendar">
      <CreateEventDialog open={!!createDay} onOpenChange={(o) => { if (!o) setCreateDay(null); }} date={createDay} teams={teams} />
      <EditEventDialog open={!!editDialogEvent} onOpenChange={(o) => { if (!o) setEditDialogEvent(null); }} event={editDialogEvent} />
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: isMobile ? "12px 10px 24px" : "18px 22px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="flex flex-wrap items-end" style={{ gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".16em", color: RS.muted, textTransform: "uppercase" }}>{t("Club · Temporada {s}", { s: seasonLabel(CURRENT_SEASON) })}</div>
            <h1 style={{ margin: "2px 0 0", lineHeight: 1 }}><span className="rs2-display" style={{ fontSize: isMobile ? 30 : 36, color: RS.granate }}>{t("CALENDARIO")}</span></h1>
          </div>
          {!isMobile && viewMode === "calendar" && (
            <div className="flex items-center" style={{ gap: 8, marginLeft: 18, paddingBottom: 2 }}>
              <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label={t("Mes anterior")} data-testid="cal-prev" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff" }}><ChevronLeft className="w-4 h-4 mx-auto" /></button>
              <span className="rs2-display" style={{ fontSize: 22, color: RS.ink, textTransform: "uppercase", minWidth: 190, textAlign: "center" }} data-testid="cal-month-label">{format(currentMonth, "MMMM yyyy", { locale: dfl })}</span>
              <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label={t("Mes siguiente")} data-testid="cal-next" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff" }}><ChevronRight className="w-4 h-4 mx-auto" /></button>
              <button type="button" onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()); }} data-testid="cal-today" style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink2 }}>{t("Hoy")}</button>
            </div>
          )}
          <div className="flex flex-wrap items-center" style={{ marginLeft: "auto", gap: 8 }}>
            {!isMobile && <Segmented options={[["calendar", msg("Mes")], ["week", msg("Semana")], ["list", msg("Lista")]]} value={viewMode} onChange={setViewMode} testPrefix="cal-view" label={t("Vista")} />}
            {singleTeam && <CalendarSubscribe teamId={singleTeam} teamName={teamById.get(singleTeam)?.name} />}
            <BulkCancelButton teamId={singleTeam || undefined} />
            <button type="button" onClick={() => setCreateDay(selectedDay || today)} data-testid="cal-new"
              style={{ fontSize: 13, fontWeight: 700, padding: "7px 14px", borderRadius: 8, border: 0, background: RS.granate, color: "#fff", display: "inline-flex", alignItems: "center", gap: 4 }}><Plus width={14} height={14} aria-hidden="true" />{t("Nuevo")}</button>
          </div>
        </div>

        <div className="flex flex-wrap" style={{ gap: 8 }} data-testid="cal-kpis">
          {kpis.map((k) => (
            <div key={k.k} data-testid={`cal-kpi-${k.k}`} style={{ flex: isMobile ? "1 1 140px" : "1 1 150px", display: "flex", alignItems: "baseline", gap: 8, padding: "8px 12px", background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 10 }}>
              <span className="rs2-display tabular-nums" style={{ fontSize: 24, color: k.color }}>{k.n}</span>
              <span style={{ fontSize: 12, color: RS.ink2, lineHeight: 1.15 }}>{k.label}{k.sub && <span style={{ display: "block", fontSize: 11, color: RS.muted }}>{k.sub}</span>}</span>
            </div>
          ))}
        </div>

        {filterBar}

        {isMobile ? mobileWeek : viewMode === "calendar" ? (
          <div className="flex flex-wrap items-start" style={{ gap: 12 }}>
            {monthView}
            <aside className="rs2-card" style={{ flex: "0 0 300px", padding: "12px 14px", alignSelf: "flex-start" }}>{dayPanel(selectedDay)}</aside>
          </div>
        ) : viewMode === "week" ? (
          <div className="flex flex-col" style={{ gap: 12 }}>
            <WeeklyCalendar events={filtered} teams={teams} filterTeam="all" onEventClick={(e) => { if (eventKind(e) === "match") openMatch(e); else setSelectedDay(new Date(e.date)); }} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
            <div className="rs2-card" style={{ padding: "12px 14px" }}>{dayPanel(selectedDay)}</div>
          </div>
        ) : (
          <EventListWithDragDrop events={filtered} teams={teams} onDragEnd={handleDragEnd} onEdit={setEditDialogEvent} onDelete={(id) => setDeleteId(id)} onDeleteSeries={(sid) => setDeleteSeriesId(sid)}
            onOpenAttendance={setAttendanceEvent} onOpenSession={setSessionReportEvent} onOpenConvocation={setConvocatoriaEvent} onNavigateMatch={(id, teamId) => navigate(`/MatchDetail?id=${id}&teamId=${teamId}`)} filterTeam="all" />
        )}
      </div>

      <EventAttendanceDialog
        event={attendanceEvent}
        open={!!attendanceEvent}
        onOpenChange={(o) => { if (!o) setAttendanceEvent(null); }}
      />

      <ConvocatoriaDialog
        open={!!convocatoriaEvent}
        onOpenChange={(o) => { if (!o) setConvocatoriaEvent(null); }}
        event={convocatoriaEvent}
        teamId={convocatoriaEvent?.team_id}
      />

      <SessionReportDialog
        open={!!sessionReportEvent}
        onOpenChange={(o) => { if (!o) setSessionReportEvent(null); }}
        event={sessionReportEvent}
        teamId={sessionReportEvent?.team_id}
        coachName={coachName}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("¿Eliminar evento?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Esta acción no se puede deshacer.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">{t("Eliminar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSeriesId} onOpenChange={(open) => { if (!open) setDeleteSeriesId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("¿Eliminar toda la serie?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Se eliminarán")} <strong>{t("todos los eventos de esta serie recurrente")}</strong> {t("({n} eventos). Esta acción no se puede deshacer.", { n: events.filter(e => e.series_id === deleteSeriesId).length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteSeriesMutation.mutate(deleteSeriesId)} className="bg-red-600 hover:bg-red-700 text-white">
              {deleteSeriesMutation.isPending ? "Eliminando..." : t("Eliminar toda la serie")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
