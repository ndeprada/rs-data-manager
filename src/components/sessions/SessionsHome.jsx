// Metodología → Sesiones (rediseño rs2 del 13/11/2026, maqueta «Maqueta Metodología · RS Manager» aprobada por Nacho).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, ClipboardList, Copy, Plus, Printer, Search, Trash2 } from "lucide-react";
import { RS } from "@/components/rs2/kit";
import SessionEditor, { newSessionFor } from "./SessionEditor";
import SessionPreview from "./SessionPreview";
import CopySessionDialog from "./CopySessionDialog";
import { longDate, todayStr } from "./sessionHelpers";
import { SESSION_TYPES, allTasks, contentName, emptyTask, fmtMin, normalizeSessionType, registerSession, aggregateSessions, taskMinutes } from "@/lib/sessionPlan";
import {
  addDays, blockMix, missingInRange, countedSessions, dayOf, fmtHours, groupByWeek, sessionContents, topContents, trainingCoverage, trainingsWithoutSession, typeCounts,
} from "@/lib/methodologyView";
import { Box, ContentTag, IconBtn, Kpi, MixBar, PillBtn, TypeChip, BlockLegend, btnStyle, NO, WARN } from "@/components/methodology/MethParts";
import { useT, useFormat } from "@/i18n";

const ALL = "__all";
const MINE = "__mine";

function NewSessionDialog({ open, onOpenChange, teams, defaultTeamId, onCreate }) {
  const t = useT();
  const [teamId, setTeamId] = useState(defaultTeamId || teams[0]?.id || "");
  const [date, setDate] = useState(todayStr());
  useEffect(() => { if (open) { setTeamId((x) => (teams.some((y) => y.id === x) ? x : defaultTeamId || teams[0]?.id || "")); setDate(todayStr()); } }, [open]);
  const inp = { width: "100%", marginTop: 4, border: `1px solid ${RS.input}`, borderRadius: 8, padding: "7px 9px", fontSize: 13, background: "#fff" };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-sm" data-testid="new-session-dialog">
        <DialogHeader>
          <DialogTitle><span className="rs2-display" style={{ color: RS.granate, fontSize: 22 }}>{t("Nueva sesión")}</span></DialogTitle>
          <DialogDescription className="text-xs">{t("Elige el equipo y el día. El tipo de sesión (tensión, duración, velocidad…) lo eliges tú dentro de la sesión.")}</DialogDescription>
        </DialogHeader>
        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: RS.muted }}>{t("Equipo")}
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={inp} data-testid="new-session-team">
            {teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: RS.muted }}>{t("Fecha")}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} />
        </label>
        <button type="button" style={btnStyle(true, { justifyContent: "center", padding: "9px 12px" })} disabled={!teamId || !date}
          onClick={() => onCreate(teams.find((x) => x.id === teamId), date)} data-testid="new-session-create">{t("Crear sesión")}</button>
      </DialogContent>
    </Dialog>
  );
}

export default function SessionsHome({ teams, isCoordinator, defaultTeamId, onGoControl }) {
  const t = useT();
  const { locale } = useFormat();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { teamIds = [] } = useTeamAccess();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // { session } | { draft }
  const [newOpen, setNewOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const myTeams = useMemo(() => teams.filter((x) => teamIds.includes(x.id)), [teams, teamIds]);
  const [picked, setPicked] = useState(null);
  // Por defecto «Mis equipos» si la persona lleva alguno (los equipos llegan después del primer pintado)
  const teamSel = picked ?? (myTeams.length ? MINE : ALL);
  const setTeamSel = setPicked;
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [coachFilter, setCoachFilter] = useState(ALL);
  const [q, setQ] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const today = todayStr();

  const { data: sessions = [], isLoading } = useQuery({ queryKey: ["coach_sessions"], queryFn: () => base44.entities.CoachSession.list("-date", 1000) });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const since = addDays(today, -60);
  const { data: events = [] } = useQuery({
    queryKey: ["meth-trainings", since],
    queryFn: () => base44.entities.Event.pick(["id", "team_id", "date", "type", "cancelled", "location", "field_id"], { type: "entrenamiento" }, { gte: { date: since } }),
  });
  const { data: fields = [] } = useQuery({ queryKey: ["fields"], queryFn: () => base44.entities.Field.list() });
  const { data: palette = [] } = useQuery({ queryKey: ["session_contents"], queryFn: () => base44.entities.SessionContent.list("name", 500), enabled: isCoordinator });
  const proposed = palette.filter((p) => p.status === "propuesto").length;
  const teamName = (id) => teams.find((x) => x.id === id)?.name || t("Equipo");

  // Equipos en los que se mira: mis equipos, todos o uno
  const scopeIds = useMemo(() => (teamSel === MINE ? myTeams.map((x) => x.id) : teamSel === ALL ? teams.map((x) => x.id) : [teamSel]), [teamSel, myTeams, teams]);
  const inScope = useMemo(() => sessions.filter((s) => scopeIds.includes(s.team_id)), [sessions, scopeIds]);
  const teamCounts = useMemo(() => { const m = {}; sessions.forEach((s) => { m[s.team_id] = (m[s.team_id] || 0) + 1; }); return m; }, [sessions]);
  const pillTeams = useMemo(() => [...teams].filter((x) => teamCounts[x.id] || teamIds.includes(x.id)).sort((a, b) => (teamCounts[b.id] || 0) - (teamCounts[a.id] || 0)), [teams, teamCounts, teamIds]);
  const shownPills = isMobile ? [] : pillTeams.slice(0, 5);
  const restTeams = teams.filter((x) => !shownPills.includes(x));

  const coaches = useMemo(() => {
    const m = new Map();
    inScope.forEach((s) => s.owner_id && m.set(s.owner_id, s.owner_name || t("Entrenador")));
    return [...m.entries()];
  }, [inScope]);

  const matchesQ = (s) => {
    if (!q.trim()) return true;
    const words = q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).filter(Boolean);
    const hay = [teamName(s.team_id), s.owner_name, ...allTasks(s).flatMap((tk) => [tk.title, ...(tk.principal || []).map((id) => contentName(id, tk)), ...(tk.secondary || []).map((id) => contentName(id, tk))])]
      .join(" ").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return words.every((w) => hay.includes(w));
  };
  const shown = useMemo(() => inScope
    .filter((s) => (typeFilter === ALL || normalizeSessionType(s.session_type) === typeFilter) && (coachFilter === ALL || s.owner_id === coachFilter) && matchesQ(s)),
  [inScope, typeFilter, coachFilter, q]);
  const weekGroups = useMemo(() => groupByWeek(shown), [shown]);

  // Últimos 30 días
  const from30 = addDays(today, -30);
  const last30 = useMemo(() => countedSessions(inScope, { from: from30, today, season: CURRENT_SEASON }), [inScope, from30, today]);
  const agg30 = useMemo(() => aggregateSessions(last30), [last30]);
  const cov = useMemo(() => trainingCoverage({ events, sessions, teamIds: scopeIds, from: from30, today }), [events, sessions, scopeIds, from30, today]);
  const missing = useMemo(() => trainingsWithoutSession({ events, sessions, teamIds: scopeIds, today }), [events, sessions, scopeIds, today]);
  const types30 = useMemo(() => typeCounts(last30), [last30]);
  const top30 = useMemo(() => topContents(agg30, 5), [agg30]);
  const maxType = Math.max(1, ...SESSION_TYPES.map((x) => types30[x.id] || 0));

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["coach_sessions"] });
  // Enlace directo a una sesión (?session=<id>, p. ej. «Hoja de sesión» desde Pasar lista): se abre una vez
  const openedLink = useRef(false);
  useEffect(() => {
    if (openedLink.current || !sessions.length) return;
    const id = new URLSearchParams(window.location.search).get("session");
    const s = id && sessions.find((x) => x.id === id);
    if (s) { openedLink.current = true; setEditing({ session: s }); }
  }, [sessions]);

  const duplicate = async (s) => {
    setBusy(true);
    try {
      const copy = JSON.parse(JSON.stringify(s));
      ["id", "created_date", "updated_date"].forEach((k) => delete copy[k]);
      const fresh = (list) => ({ ...list, tasks: (list?.tasks || []).map((x) => ({ ...x, id: emptyTask().id })) });
      copy.initial = fresh(copy.initial); copy.main = fresh(copy.main);
      copy.date = todayStr(); copy.held = true; copy.event_id = null; copy.training_event_id = null; copy.match_ref = "";
      copy.attendance = Object.fromEntries(Object.entries(copy.attendance || {}).map(([id, a]) => [id, a.areas ? { areas: a.areas } : {}]).filter(([, a]) => a.areas));
      copy.attendance_others = "";
      const created = await base44.entities.CoachSession.create({ ...copy, owner_id: user.id, owner_name: user.full_name || user.email || "", season: CURRENT_SEASON });
      await refresh();
      setEditing({ session: created });
    } finally { setBusy(false); }
  };

  const remove = async (s) => {
    if (!window.confirm(t("¿Borrar la sesión del {fecha} de {equipo}? Dejará de contar en los porcentajes.", { fecha: longDate(s.date), equipo: teamName(s.team_id) }))) return;
    setBusy(true);
    try { await base44.entities.CoachSession.delete(s.id); await refresh(); } finally { setBusy(false); }
  };

  const placeOf = (e) => (e.field_id ? fields.find((f) => f.id === e.field_id)?.name : "") || e.location || "";
  const fromTraining = (e) => {
    const team = teams.find((x) => x.id === e.team_id);
    const draft = newSessionFor({ team, date: dayOf(e.date) });
    const hh = String(e.date).slice(11, 16);
    setEditing({ draft: { ...draft, training_event_id: e.id, time_place: [hh, placeOf(e)].filter(Boolean).join(" · ") } });
  };

  if (editing) {
    const key = editing.session?.id || "new";
    return (
      <SessionEditor key={key} session={editing.session} draft={editing.draft} teams={teams} sessions={sessions}
        onClose={() => { setEditing(null); refresh(); }} />
    );
  }

  const canWrite = (s) => s.owner_id === user?.id;
  const previewTeam = preview ? teams.find((x) => x.id === preview.team_id) : null;
  const sel = { fontSize: 12, border: `1px solid ${RS.line}`, background: "#fff", borderRadius: 8, padding: "5px 8px", color: RS.ink2, maxWidth: 190 };
  const dayLabel = (d) => format(new Date(`${dayOf(d)}T12:00:00`), "EEE d", { locale });
  const monLabel = (d) => format(new Date(`${dayOf(d)}T12:00:00`), "MMM", { locale });
  const wkLabel = (g) => `${format(new Date(`${g.start}T12:00:00`), "d", { locale })}–${format(new Date(`${g.end}T12:00:00`), "d MMM", { locale })}`;

  const list = (
    <Box testId="sessions-list">
      <div className="flex flex-wrap items-center" style={{ gap: 6, padding: "10px 14px" }}>
        {myTeams.length > 0 && <PillBtn on={teamSel === MINE} onClick={() => setTeamSel(MINE)} testId="sessions-team-mine">{t("Mis equipos")}</PillBtn>}
        {teams.length > 1 && (isCoordinator || !myTeams.length) && <PillBtn on={teamSel === ALL} onClick={() => setTeamSel(ALL)} testId="sessions-team-all">{t("Todos")}</PillBtn>}
        {shownPills.map((x) => (
          <PillBtn key={x.id} on={teamSel === x.id} onClick={() => setTeamSel(x.id)} testId={`sessions-team-${x.id}`}>
            {x.name} <span style={{ opacity: 0.7, fontWeight: 500 }}>{teamCounts[x.id] || 0}</span>
          </PillBtn>
        ))}
        {restTeams.length > 0 && (
          <select value={restTeams.some((x) => x.id === teamSel) ? teamSel : ""} onChange={(e) => e.target.value && setTeamSel(e.target.value)} style={sel} data-testid="sessions-team-more">
            <option value="">{shownPills.length ? t("Otro equipo…") : t("Equipo…")}</option>
            {restTeams.map((x) => <option key={x.id} value={x.id}>{x.name}{teamCounts[x.id] ? ` · ${teamCounts[x.id]}` : ""}</option>)}
          </select>
        )}
        <span className="flex flex-wrap items-center" style={{ marginLeft: "auto", gap: 6 }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={sel} data-testid="sessions-type">
            <option value={ALL}>{t("Todos los tipos")}</option>
            {SESSION_TYPES.map((x) => <option key={x.id} value={x.id}>{t(x.label)}</option>)}
          </select>
          {isCoordinator && coaches.length > 1 && (
            <select value={coachFilter} onChange={(e) => setCoachFilter(e.target.value)} style={sel} data-testid="sessions-coach">
              <option value={ALL}>{t("Todos los entrenadores")}</option>
              {coaches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
          <span className="inline-flex items-center" style={{ ...sel, gap: 5, width: isMobile ? "100%" : 200, maxWidth: "none" }}>
            <Search className="w-3.5 h-3.5" style={{ color: RS.muted }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Buscar contenido o tarea…")} style={{ border: 0, outline: 0, width: "100%", fontSize: 12, background: "transparent" }} data-testid="sessions-search" />
          </span>
        </span>
      </div>
      {isLoading ? <p style={{ padding: 20, textAlign: "center", fontSize: 13, color: RS.muted }}>{t("Cargando…")}</p> : weekGroups.length === 0 ? (
        <div style={{ padding: 28, textAlign: "center", borderTop: `1px solid ${RS.lineSoft}` }}>
          <ClipboardList className="w-8 h-8 mx-auto" style={{ color: "#C9BEBF" }} />
          <p style={{ fontWeight: 700, fontSize: 14, marginTop: 6 }}>{sessions.length ? t("No hay sesiones con estos filtros") : t("Todavía no hay sesiones")}</p>
          {!sessions.length && <p style={{ fontSize: 12, color: RS.muted, marginTop: 3 }}>{t("Crea la primera: eliges los contenidos de cada tarea y la app va sumando el tiempo trabajado de cada uno.")}</p>}
        </div>
      ) : (
        <>
          {weekGroups.slice(0, weeks).map((g) => {
            const noSheet = g.start > today || g.start < since ? 0 : missingInRange({ events, sessions, teamIds: scopeIds, from: g.start, to: g.end > today ? today : g.end });
            return (
              <div key={g.start} data-testid={`sessions-week-${g.start}`}>
                <div className="flex flex-wrap items-baseline" style={{ gap: 10, padding: "8px 14px", background: RS.head, borderTop: `1px solid ${RS.line}` }}>
                  <b style={{ fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: RS.granateDark }}>{t("Semana {s}", { s: wkLabel(g) })}</b>
                  <span style={{ fontSize: 11.5, color: RS.muted }}>
                    {t("{n} sesiones", { n: g.sessions.length })} · {fmtHours(g.minutes)}{noSheet > 0 ? ` · ${t("{n} entrenos sin hoja", { n: noSheet })}` : ""}
                  </span>
                </div>
                {g.sessions.map((s) => {
                  const reg = registerSession(s);
                  const n = allTasks(s).filter((x) => taskMinutes(x) > 0).length;
                  const c = sessionContents(reg, isMobile ? 2 : 3);
                  return (
                    <div key={s.id} data-testid={`session-row-${s.id}`}
                      style={{ display: "grid", gridTemplateColumns: isMobile ? "62px 1fr" : "92px minmax(0,1fr) 130px 104px", gap: isMobile ? 8 : 12, alignItems: "center", padding: "8px 14px", borderTop: "1px solid #F3EEEE" }}>
                      <button type="button" onClick={() => setEditing({ session: s })} style={{ textAlign: "left", background: "none", border: 0, padding: 0 }}>
                        <div className="rs2-display" style={{ fontSize: 18, color: RS.granate, textTransform: "capitalize", lineHeight: 1 }}>{dayLabel(s.date)}</div>
                        <div style={{ fontSize: 11, color: RS.muted }}>{monLabel(s.date)}{s.time_place ? ` · ${String(s.time_place).slice(0, 5)}` : ""}</div>
                      </button>
                      <button type="button" onClick={() => setEditing({ session: s })} style={{ textAlign: "left", background: "none", border: 0, padding: 0, minWidth: 0 }} data-testid={`session-open-${s.id}`}>
                        <div className="flex flex-wrap items-center" style={{ gap: 7 }}>
                          <b style={{ fontSize: 13 }}>{teamName(s.team_id)}</b>
                          <TypeChip type={s.session_type} />
                          {s.held === false && <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "1px 7px", background: RS.soft, color: RS.muted }}>{t("No realizada")}</span>}
                          <span style={{ fontSize: 11.5, color: RS.muted }}>{t("{n} tareas", { n })} · {fmtMin(reg.clock || reg.total)}{s.owner_name ? ` · ${s.owner_name}` : ""}</span>
                        </div>
                        {(c.principal.length > 0 || c.secondary.length > 0) && (
                          <div className="flex flex-wrap" style={{ gap: 4, marginTop: 4 }}>
                            {c.principal.map((id) => <ContentTag key={id} id={id} custom={reg.custom} />)}
                            {c.secondary.map((id) => <ContentTag key={id} id={id} sec custom={reg.custom} />)}
                            {c.more > 0 && <span style={{ fontSize: 10.5, color: RS.muted }}>+{c.more}</span>}
                          </div>
                        )}
                        {reg.unclassified > 0 && <div className="flex items-center" style={{ gap: 4, fontSize: 11, color: WARN, marginTop: 3 }}><AlertTriangle className="w-3 h-3" /> {t("{m} sin contenido elegido", { m: fmtMin(reg.unclassified) })}</div>}
                      </button>
                      {isMobile ? (
                        <div className="flex items-center" style={{ gridColumn: "1 / -1", gap: 6 }}>
                          <MixBar mix={blockMix(reg)} width={140} />
                          <span style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                            <IconBtn title={t("Ver ficha / imprimir")} onClick={() => setPreview(s)}><Printer className="w-3.5 h-3.5" /></IconBtn>
                            <IconBtn title={t("Duplicar como sesión nueva (hoy)")} disabled={busy} onClick={() => duplicate(s)}><Copy className="w-3.5 h-3.5" /></IconBtn>
                            {canWrite(s) && <IconBtn danger title={t("Borrar")} disabled={busy} onClick={() => remove(s)}><Trash2 className="w-3.5 h-3.5" /></IconBtn>}
                          </span>
                        </div>
                      ) : (
                        <>
                          <MixBar mix={blockMix(reg)} title={t("Reparto del tiempo por bloques")} />
                          <span className="flex justify-end" style={{ gap: 3 }}>
                            <IconBtn title={t("Ver ficha / imprimir")} onClick={() => setPreview(s)} testId={`session-print-${s.id}`}><Printer className="w-3.5 h-3.5" /></IconBtn>
                            <IconBtn title={t("Duplicar como sesión nueva (hoy)")} disabled={busy} onClick={() => duplicate(s)} testId={`session-dup-${s.id}`}><Copy className="w-3.5 h-3.5" /></IconBtn>
                            {canWrite(s) && <IconBtn danger title={t("Borrar")} disabled={busy} onClick={() => remove(s)} testId={`session-del-${s.id}`}><Trash2 className="w-3.5 h-3.5" /></IconBtn>}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center" style={{ gap: 10, padding: "8px 14px", borderTop: `1px solid ${RS.lineSoft}` }}>
            {weekGroups.length > weeks && <button type="button" style={btnStyle(false)} onClick={() => setWeeks((w) => w + 6)} data-testid="sessions-more">{t("Ver semanas anteriores · {n} más", { n: weekGroups.slice(weeks).reduce((a, g) => a + g.sessions.length, 0) })}</button>}
            <span style={{ marginLeft: "auto" }}><BlockLegend /></span>
          </div>
        </>
      )}
    </Box>
  );

  const missRow = (e, future) => (
    <div key={e.id} className="flex items-center" style={{ gap: 8, padding: "7px 14px", borderTop: "1px solid #F3EEEE", fontSize: 12.5 }} data-testid={`missing-${e.id}`}>
      <span style={{ width: 58, fontWeight: 700, color: RS.granateDark, textTransform: "capitalize" }}>{dayLabel(e.date)}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{teamName(e.team_id)} <span style={{ color: RS.muted, fontSize: 11.5 }}>· {String(e.date).slice(11, 16)}{placeOf(e) ? ` · ${placeOf(e)}` : ""}</span></span>
      <button type="button" style={btnStyle(!future)} onClick={() => fromTraining(e)} data-testid={`missing-create-${e.id}`}>{future ? t("Planificar") : t("Crear hoja")}</button>
    </div>
  );
  const missingCard = (
    <Box title={t("Entrenos sin hoja de sesión")} testId="sessions-missing">
      {missing.past.length + missing.next.length === 0 ? (
        <p style={{ padding: "10px 14px", fontSize: 12.5, color: RS.muted }}>{t("Todos los entrenos de los últimos 14 días tienen su hoja.")}</p>
      ) : (
        <>
          <p style={{ padding: "8px 14px", fontSize: 11.5, color: RS.muted }}>{t("Entrenos del calendario (últimos 14 días y próximos 7) que todavía no tienen sesión.")}</p>
          {missing.past.slice(0, 6).map((e) => missRow(e, false))}
          {missing.past.length > 6 && <p style={{ padding: "4px 14px", fontSize: 11.5, color: RS.muted }}>{t("… y {n} más", { n: missing.past.length - 6 })}</p>}
          {missing.next.slice(0, 3).map((e) => missRow(e, true))}
          <p style={{ padding: "7px 14px", borderTop: "1px solid #F3EEEE", fontSize: 11.5, color: RS.muted }}>{t("La hoja nace con el equipo, el día, la hora y el campo.")}</p>
        </>
      )}
    </Box>
  );
  const typesCard = (
    <Box title={t("Tipos de sesión · 30 días")} testId="sessions-types">
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
        {SESSION_TYPES.map((x) => (
          <div key={x.id} className="flex items-center" style={{ gap: 8 }}>
            <span style={{ width: 96 }}><TypeChip type={x.id} /></span>
            <span style={{ flex: 1, height: 6, background: "#F1ECEC", borderRadius: 9, overflow: "hidden" }}><span style={{ display: "block", width: `${((types30[x.id] || 0) / maxType) * 100}%`, height: "100%", background: x.color }} /></span>
            <b style={{ width: 20, textAlign: "right" }}>{types30[x.id] || 0}</b>
          </div>
        ))}
        {types30.none > 0 && <div style={{ fontSize: 11.5, color: RS.muted }}>{t("{n} sin tipo elegido", { n: types30.none })}</div>}
      </div>
    </Box>
  );
  const topCard = (
    <Box title={t("Lo más trabajado · 30 días")} testId="sessions-top">
      <div style={{ padding: "8px 14px", fontSize: 12.5, display: "flex", flexDirection: "column", gap: 5 }}>
        {top30.length === 0 && <span style={{ color: RS.muted }}>{t("Todavía no hay contenidos registrados en estos 30 días.")}</span>}
        {top30.map((c) => <div key={c.id} className="flex" style={{ gap: 8 }}><span style={{ flex: 1, minWidth: 0 }}><ContentTag id={c.id} custom={agg30.custom} /></span><span style={{ color: RS.muted }}>{fmtHours(c.principal)}</span></div>)}
        {onGoControl && <button type="button" onClick={onGoControl} style={{ background: "none", border: 0, padding: 0, textAlign: "left", fontSize: 12, fontWeight: 700, color: RS.granate, marginTop: 3 }}>{t("Ver el control de contenidos ›")}</button>}
      </div>
    </Box>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
        <div className="flex flex-wrap" style={{ gap: 8, flex: "1 1 600px" }}>
          <Kpi testId="sessions-kpi-coverage" n={cov.trainings ? `${cov.withSession}/${cov.trainings}` : "—"} label={t("entrenos con hoja")} sub={cov.trainings ? t("30 días · {p} %", { p: cov.pct }) : t("30 días")} color={cov.pct != null && cov.pct < 60 ? NO : cov.pct != null && cov.pct < 80 ? WARN : undefined} />
          <Kpi testId="sessions-kpi-time" n={fmtHours(agg30.total)} label={t("de trabajo registrado")} sub={t("30 días · {n} sesiones", { n: last30.length })} />
          <Kpi testId="sessions-kpi-content" n={agg30.total ? `${Math.round((agg30.withBlock / agg30.total) * 100)} %` : "—"} label={t("del tiempo con contenido")} sub={agg30.unclassified ? t("{m} sin elegir", { m: fmtMin(agg30.unclassified) }) : t("todo con contenido")} />
          <Kpi testId="sessions-kpi-missing" n={missing.past.length} label={t("entrenos sin hoja")} sub={t("últimos 14 días")} color={missing.past.length ? WARN : undefined} />
          {isCoordinator && proposed > 0 && <Kpi testId="sessions-kpi-proposed" n={proposed} label={t("contenidos propuestos")} sub={t("a la paleta del club · por aprobar")} color={RS.granate} />}
        </div>
        <span className="flex" style={{ gap: 6, marginLeft: "auto" }}>
          <button type="button" style={btnStyle(false)} onClick={() => setCopyOpen(true)} data-testid="sessions-copy">{t("Copiar de otra sesión")}</button>
          <button type="button" style={btnStyle(true)} onClick={() => setNewOpen(true)} data-testid="sessions-new"><Plus className="w-4 h-4" /> {t("Nueva sesión")}</button>
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: RS.muted }}>
        {isCoordinator ? t("Como coordinador ves las sesiones de todos los entrenadores (solo lectura); cada entrenador edita las suyas.") : t("Tus sesiones son personales: solo las ves tú y los coordinadores.")}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 320px", gap: 12, alignItems: "start" }}>
        {isMobile && missingCard}
        {list}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!isMobile && missingCard}
          {typesCard}
          {topCard}
        </div>
      </div>

      <NewSessionDialog open={newOpen} onOpenChange={setNewOpen} teams={teams} defaultTeamId={!([ALL, MINE].includes(teamSel)) ? teamSel : (myTeams[0]?.id || defaultTeamId)}
        onCreate={(team, date) => { setNewOpen(false); setEditing({ draft: newSessionFor({ team, date }) }); }} />
      <CopySessionDialog open={copyOpen} onOpenChange={setCopyOpen} sessions={sessions} teams={teams} onPick={(s) => { setCopyOpen(false); duplicate(s); }} />
      {preview && (
        <SessionPreview open onOpenChange={(o) => !o && setPreview(null)} session={{ ...preview, stage: preview.stage }} team={previewTeam}
          players={players.filter((p) => p.team_id === preview.team_id && p.status !== "baja")} matchRef={preview.match_ref} />
      )}
    </div>
  );
}
