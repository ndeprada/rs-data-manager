import React, { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { useAutosave } from "@/lib/useAutosave";
import SaveStatus from "@/components/common/SaveStatus";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CalendarCheck, CopyPlus, Download, Eye, Library, Lock, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Band, C, D, Field, Lab, Pill, SBtn, SCard, inputCls } from "./sessionUi";
import TaskEditor from "./TaskEditor";
import LibraryTaskPicker from "./LibraryTaskPicker";
import { useToast } from "@/components/ui/use-toast";
import { libraryToSessionTask } from "@/lib/taskLibrary";
import SessionPreview from "./SessionPreview";
import { fullDate, longDate, matchRefOf, playerFullName, posShort, sortRoster, todayStr } from "./sessionHelpers";
import CopySessionDialog from "./CopySessionDialog";
import { ATT_REASONS, pdiAreaOf, attendanceOf } from "./sessionAttendance";
import {
  BLOCKS, SESSION_TYPES, STAGES, compareWithStage, contentBlock, contentName, duplicateSessionContent, emptySession, emptyTask, fmtMin, fmtPct, isBlankTask,
  moveTaskToPart, normalizeSessionType, partClock, pctOf, registerSession, simulWith, sessionTypeInfo, sessionTypeName, stageOfTeamName,
} from "@/lib/sessionPlan";
import { MATCH_TYPES } from "@/lib/matchStatus";
import { isCancelled } from "@/lib/eventCancel";

const TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico"];
const META = ["id", "created_date", "updated_date", "owner_id", "owner_name", "season"];

const stripMeta = (s) => Object.fromEntries(Object.entries(s).filter(([k]) => !META.includes(k)));

// Base de una sesión nueva a partir de un equipo y una fecha
export function newSessionFor({ team, date = todayStr() }) {
  const stage = team ? stageOfTeamName(team.name) : null;
  return emptySession({ teamId: team?.id || "", date, stage, type: null });
}

// Lo que se trabaja en esta sesión, al instante: minutos y % de cada contenido (principal y secundario) y de cada bloque
function ContentLines({ list, total, kind, custom }) {
  return (
    <div className="flex flex-col gap-[7px] text-[13px]" style={{ color: kind === "principal" ? C.ink : C.soft }}>
      {list.map((c) => {
        const b = BLOCKS.find((x) => x.id === contentBlock(c.id, { custom_contents: custom }));
        const m = kind === "principal" ? c.principal : c.secondary;
        return (
          <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2" data-testid={`live-${kind}-${c.id}`}>
            <span className="truncate"><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: b?.color || "#999" }} />{contentName(c.id, { custom_contents: custom })}</span>
            <span className={`tabular-nums whitespace-nowrap ${kind === "principal" ? "font-bold" : ""}`}>{fmtMin(m)} · {fmtPct(pctOf(m, total))}</span>
          </div>
        );
      })}
    </div>
  );
}

function LiveSummary({ session, stage }) {
  const reg = useMemo(() => registerSession(session), [session]);
  const rows = useMemo(() => compareWithStage(reg, stage).filter((r) => r.minutes > 0), [reg, stage]);
  const contents = Object.values(reg.contents);
  const principals = contents.filter((c) => c.principal > 0).sort((a, b) => b.principal - a.principal);
  const seconds = contents.filter((c) => c.secondary > 0).sort((a, b) => b.secondary - a.secondary);
  // reloj de la sesión (las tareas simultáneas cuentan una vez) y tiempo trabajado (cada tarea, entera)
  const planned = reg.clock ?? reg.total;
  const worked = reg.total;
  const dur = Number(session.duration) || 0;
  const diff = dur ? Math.round((dur - planned) * 10) / 10 : 0;
  return (
    <>
      <SCard className="px-[18px] py-4 flex flex-col gap-3" data-testid="live-summary">
        <D size={18}>Lo que se trabaja hoy</D>
        <div className="flex items-baseline gap-2 flex-wrap">
          <D size={40} style={{ lineHeight: 1 }}>{fmtMin(planned)}</D>
          {dur > 0 && planned > 0 && diff < 0
            ? <span className="text-[13px] font-semibold text-amber-700 flex items-center gap-1" data-testid="live-over"><AlertTriangle className="w-3.5 h-3.5" /> de {dur}’ previstos · {fmtMin(-diff)} de más</span>
            : <span className="text-[13px]" style={{ color: C.muted }} data-testid="live-left">de {dur || "—"}’ previstos{dur > 0 && planned > 0 ? (diff > 0 ? ` · quedan ${fmtMin(diff)}` : " · justo") : ""}</span>}
        </div>
        {dur > 0 && <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0EAEA" }}><div className="h-full" style={{ width: `${Math.min(100, (planned / dur) * 100)}%`, background: diff < 0 ? "#d97706" : C.granate }} /></div>}
        {worked > planned && <p className="text-[11px] m-0" style={{ color: C.muted }} data-testid="live-simul">Con tareas a la vez: {fmtMin(worked)} de trabajo en {fmtMin(planned)} de sesión.</p>}
        {(reg.unclassified > 0 || reg.noCurriculum > 0) && (
          <p className="text-[11px] m-0" style={{ color: C.muted }}>
            {reg.unclassified > 0 && <span className="text-amber-700 font-semibold">Sin contenido principal: {fmtMin(reg.unclassified)}{reg.noCurriculum > 0 ? " · " : ""}</span>}
            {reg.noCurriculum > 0 && <span>Sin contenidos (PF, activación…): {fmtMin(reg.noCurriculum)}</span>}
          </p>
        )}
        {principals.length === 0 && seconds.length === 0 ? (
          <p className="text-xs m-0" style={{ color: C.muted }}>Cuando elijas contenidos en las tareas, aquí verás cuánto tiempo va a cada uno.</p>
        ) : (
          <>
            {principals.length > 0 && <><Lab style={{ marginTop: 4 }}>Contenidos principales</Lab><ContentLines list={principals} total={worked} kind="principal" custom={reg.custom} /></>}
            {seconds.length > 0 && <><Lab style={{ marginTop: 4 }}>Contenidos secundarios</Lab><ContentLines list={seconds} total={worked} kind="secondary" custom={reg.custom} /></>}
            <p className="text-[11px] m-0 leading-[1.45]" style={{ color: C.muted }}>% sobre los {fmtMin(worked)} {worked > planned ? "trabajados (las tareas simultáneas cuentan las dos)" : "de la sesión"}. Una tarea con dos principales suma su tiempo a los dos, por eso los % pueden sumar más de 100.</p>
          </>
        )}
      </SCard>
      {rows.length > 0 && (
        <SCard className="px-[18px] py-4 flex flex-col gap-2.5">
          <D size={18}>Por bloque frente a la etapa</D>
          <div className="grid grid-cols-[110px_minmax(0,1fr)_54px] gap-2 items-center text-xs">
            {rows.map((r) => {
              const b = BLOCKS.find((x) => x.id === r.block);
              return (
                <React.Fragment key={r.block}>
                  <span className="font-bold truncate" style={{ color: b.color }} title={b.label}>{b.short}</span>
                  <div className="h-2 rounded-full relative" style={{ background: "#F0EAEA" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.pct)}%`, background: b.color }} />
                    <div className="absolute" style={{ left: `${Math.min(100, r.target)}%`, top: -2, width: 2, height: 12, background: C.dark }} title={`Referencia de la etapa: ${r.target}%`} />
                  </div>
                  <b className="tabular-nums">{Math.round(r.pct)}%</b>
                </React.Fragment>
              );
            })}
          </div>
          <p className="text-[11px] m-0" style={{ color: C.muted }}>La raya oscura es el % de referencia de la etapa.</p>
        </SCard>
      )}
    </>
  );
}

// Disponible: Sí / Al margen / No, con el motivo
const ATT = {
  si: { icon: "✓", label: "Sí", color: "#15803D" },
  ad: { icon: "●", label: "Al margen", color: "#B45309" },
  no: { icon: "✕", label: "No", color: "#C81E1E" },
};
const attText = (e) => {
  if (!e.st) return "Sin marcar";
  if (e.st === "si") return "Sí";
  if (e.st === "ad") return e.obs ? `Al margen · ${e.obs}` : "Al margen";
  return e.obs ? e.obs.charAt(0).toUpperCase() + e.obs.slice(1) : "No";
};

function AttCell({ e, a, onSet }) {
  const [open, setOpen] = useState(false);
  const info = ATT[e.st];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="text-left font-semibold truncate rounded px-1 -mx-1 hover:bg-[#F5F2F1]" style={{ color: info?.color || "#9A8C8E" }} data-testid="att-cell">
          {info ? `${info.icon} ` : "○ "}{attText(e)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3 space-y-2.5 session-ui">
        <div className="flex gap-1.5">
          {Object.entries(ATT).map(([k, x]) => (
            <button key={k} type="button" onClick={() => { onSet({ st: k, ...(k === "si" ? { obs: "" } : {}) }); if (k === "si") setOpen(false); }} aria-pressed={e.st === k}
              className="flex-1 rounded-lg py-1.5 text-xs font-bold" style={e.st === k ? { background: x.color, color: "#fff", border: `1px solid ${x.color}` } : { background: "#fff", color: x.color, border: `1px solid ${C.field}` }}>{x.icon} {x.label}</button>
          ))}
        </div>
        {(e.st === "no" || e.st === "ad") && (
          <>
            <Lab>Motivo</Lab>
            <div className="flex flex-wrap gap-1">
              {ATT_REASONS.map((r) => <Pill key={r} on={(a.obs ?? e.obs) === r} className="!py-[3px] !text-[11px]" onClick={() => { onSet({ obs: r }); setOpen(false); }}>{r}</Pill>)}
            </div>
            <Input value={a.obs ?? e.obs ?? ""} onChange={(ev) => onSet({ obs: ev.target.value })} placeholder="Otro motivo" className={`${inputCls} h-8 text-xs`} />
          </>
        )}
        {a.st && <button type="button" className="text-[11px] underline" style={{ color: C.muted }} onClick={() => { onSet({ st: "", obs: "" }); setOpen(false); }}>Quitar la marca</button>}
      </PopoverContent>
    </Popover>
  );
}

const ROW = "grid grid-cols-[44px_34px_minmax(0,1fr)] sm:grid-cols-[44px_34px_minmax(0,1fr)_170px_minmax(0,1.1fr)] gap-x-2.5 gap-y-0.5 items-center px-3 sm:px-5 py-[7px] text-[13px]";

function AttendanceCard({ session, roster, onChange, events, prevSession, pdiGoals }) {
  const att = session.attendance || {};
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");
  const setPlayer = (id, patch) => onChange({ attendance: { ...att, [id]: { ...(att[id] || {}), ...patch } } });
  const day = (session.date || "").slice(0, 10);
  const trainings = events.filter((e) => e.team_id === session.team_id && String(e.date || "").slice(0, 10) === day && TRAINING_TYPES.includes(e.type) && !isCancelled(e));

  const importCalendar = async () => {
    setImporting(true); setMsg("");
    try {
      const lists = await Promise.all(trainings.map((e) => base44.entities.TrainingAttendance.filter({ event_id: e.id })));
      const map = { present: "si", apart: "ad", absent: "no" };
      const next = { ...att };
      let n = 0;
      for (const r of lists.flat()) {
        if (!roster.some((p) => p.id === r.player_id) || !map[r.status]) continue;
        next[r.player_id] = { ...(next[r.player_id] || {}), st: map[r.status], ...(r.absence_reason && !next[r.player_id]?.obs ? { obs: r.absence_reason } : {}) };
        n += 1;
      }
      onChange({ attendance: next });
      setMsg(n ? `Traída la asistencia de ${n} jugadores.` : "Ese entrenamiento aún no tiene asistencia pasada en el calendario.");
    } catch { setMsg("No se pudo leer la asistencia del calendario."); }
    setImporting(false);
  };
  const copyAreas = () => {
    const next = { ...att };
    for (const p of roster) {
      const a = prevSession?.attendance?.[p.id]?.areas;
      if (a) next[p.id] = { ...(next[p.id] || {}), areas: a };
    }
    onChange({ attendance: next });
  };
  const eff = roster.map((p) => attendanceOf(p, att[p.id]));
  const avail = eff.filter((a) => a.st === "si" || a.st === "ad" || !a.st).length;
  const notAvail = eff.filter((a) => a.st === "no").length;

  return (
    <SCard className="overflow-hidden" data-testid="session-players">
      <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5">
        <D size={18} style={{ flex: 1 }}>Jugadores · {roster.length}</D>
        <span className="text-xs" style={{ color: C.muted }}>Disponibles <b style={{ color: "#15803D" }}>{avail}</b> · No disponibles <b style={{ color: "#C81E1E" }}>{notAvail}</b></span>
        {trainings.length > 0 && <SBtn small onClick={importCalendar} disabled={importing}><CalendarCheck className="w-3.5 h-3.5" /> {importing ? "Trayendo…" : "Traer asistencia del calendario"}</SBtn>}
        {prevSession && <SBtn small onClick={copyAreas}>Áreas de la sesión anterior</SBtn>}
      </div>
      {msg && <p className="text-xs px-5 -mt-1.5 pb-2" style={{ color: C.muted }}>{msg}</p>}
      {roster.length ? (
        <>
          <div className={`${ROW} hidden sm:grid`} style={{ background: C.pale, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".05em", borderTop: "1px solid #F0EAEA" }}>
            <span>Pos.</span><span>Nº</span><span>Nombre y apellido</span><span>Disponible</span><span>Área del PDI que trabaja</span>
          </div>
          {roster.map((p, i) => {
            const a = att[p.id] || {};
            const e = eff[i];
            const pdi = pdiAreaOf(p.id, pdiGoals);
            const out = e.st === "no";
            return (
              <div key={p.id} className={ROW} style={{ borderTop: "1px solid #F0EAEA" }} data-testid={`att-row-${p.id}`}>
                <b style={{ color: C.granate }}>{posShort(p.position) || "—"}</b>
                <span className="tabular-nums">{p.jersey_number ?? ""}</span>
                <span className="truncate">{playerFullName(p)}</span>
                <div className="col-start-3 sm:col-start-auto min-w-0"><AttCell e={e} a={a} onSet={(patch) => setPlayer(p.id, patch)} /></div>
                <input value={a.areas || ""} onChange={(ev) => setPlayer(p.id, { areas: ev.target.value })} placeholder={out ? "—" : (pdi || "Escribe el área…")}
                  className={`col-start-3 sm:col-start-auto min-w-0 w-full text-[13px] bg-transparent rounded px-1 -mx-1 py-0.5 outline-none focus:bg-white focus:ring-1 focus:ring-[#DDD3D4] ${pdi && !out ? "placeholder:text-[#3A2E30]" : "placeholder:text-[#9A8C8E]"}`}
                  style={{ color: C.soft }} title={pdi && !a.areas ? `Del PDI: ${pdi}` : ""} aria-label={`Área del PDI de ${playerFullName(p)}`} />
              </div>
            );
          })}
        </>
      ) : <p className="text-sm px-5 pb-4" style={{ color: C.muted }}>Este equipo no tiene jugadores en la plantilla.</p>}
      <div className="flex items-center gap-2 px-5 py-2.5 text-xs" style={{ color: C.muted, borderTop: "1px solid #F0EAEA" }}>
        <span className="shrink-0">Otros / a prueba:</span>
        <input value={session.attendance_others || ""} onChange={(e) => onChange({ attendance_others: e.target.value })} placeholder="Ej: Martí (Infantil S13 A), Leo (prueba)"
          className="flex-1 min-w-0 bg-transparent rounded px-1 py-0.5 outline-none focus:bg-white focus:ring-1 focus:ring-[#DDD3D4]" style={{ color: C.soft }} />
      </div>
    </SCard>
  );
}

/**
 * Editor de una sesión. `session` es una sesión guardada (con id) o `draft` la base de una nueva.
 * Se guarda sola; una sesión nueva no se crea hasta que se cambia algo.
 */
export default function SessionEditor({ session, draft, teams, sessions = [], onClose }) {
  const { user } = useAuth();
  const { perms } = useTeamAccess();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [libPart, setLibPart] = useState(null);
  const [justLoaded, setJustLoaded] = useState(null);
  const idRef = useRef(session?.id || null);
  const [form, setForm] = useState(() => {
    const base = stripMeta(session || draft);
    return { ...base, session_type: normalizeSessionType(base.session_type) };
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  const isOwner = !session || session.owner_id === user?.id;
  const readOnly = !isOwner && !perms?.isAdmin;
  const team = teams.find((t) => t.id === form.team_id) || null;
  const stage = form.stage || (team ? stageOfTeamName(team.name) : null);

  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: staff = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.StaffMember.list() });
  const { data: pdiGoals = [] } = useQuery({ queryKey: ["pdi_goals_all"], queryFn: () => base44.entities.PDIGoal.list("-created_date", 2000) });
  const roster = useMemo(() => sortRoster(players.filter((p) => p.team_id === form.team_id && p.status !== "baja")), [players, form.team_id]);
  const staffNames = useMemo(() => [...new Set(staff.map((x) => `${x.first_name || ""} ${x.last_name || ""}`.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [staff]);

  const nextMatch = useMemo(() => {
    const day = (form.date || todayStr()).slice(0, 10);
    return events
      .filter((e) => e.team_id === form.team_id && MATCH_TYPES.includes(e.type) && !isCancelled(e) && String(e.date || "").slice(0, 10) >= day)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0] || null;
  }, [events, form.team_id, form.date]);

  const prevSession = useMemo(() => sessions
    .filter((s) => s.id !== idRef.current && s.team_id === form.team_id && s.owner_id === (session?.owner_id || user?.id) && s.date < form.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null, [sessions, form.team_id, form.date, session?.owner_id, user?.id]);
  // Sesiones que se pueden copiar: primero las del mismo equipo, las más recientes arriba
  const copyable = useMemo(() => sessions
    .filter((s) => s.id !== idRef.current)
    .sort((a, b) => Number(b.team_id === form.team_id) - Number(a.team_id === form.team_id) || String(b.date).localeCompare(String(a.date)))
    .slice(0, 40), [sessions, form.team_id]);

  const autosave = useAutosave({
    value: form,
    enabled: !readOnly,
    save: async (data) => {
      let saved;
      if (idRef.current) saved = await base44.entities.CoachSession.update(idRef.current, data);
      else {
        saved = await base44.entities.CoachSession.create({ ...data, owner_id: user.id, owner_name: user.full_name || user.email || "", season: CURRENT_SEASON });
        idRef.current = saved.id;
      }
      queryClient.invalidateQueries({ queryKey: ["coach_sessions"] });
    },
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setTasks = (part, fn) => setForm((f) => ({ ...f, [part]: { ...f[part], tasks: fn(f[part]?.tasks || []) } }));
  const patchTask = (part, id, patch) => setTasks(part, (ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const removeTask = (part, t) => {
    if (!isBlankTask(t) && !window.confirm("¿Quitar esta tarea de la sesión?")) return;
    setTasks(part, (ts) => ts.filter((x) => x.id !== t.id));
  };
  const moveTask = (part, i, dir) => setTasks(part, (ts) => { const a = [...ts]; const j = i + dir; if (j < 0 || j >= a.length) return ts; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const duplicateTask = (part, i) => setTasks(part, (ts) => { const a = [...ts]; a.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(ts[i])), id: emptyTask().id }); return a; });
  const addTask = (part) => setTasks(part, (ts) => [...ts, emptyTask(part === "initial" ? "inicial" : "principal")]);
  const changePart = (taskId, toPart) => { setForm((f) => moveTaskToPart(f, taskId, toPart)); setJustLoaded(taskId); };
  // Cargar una tarea de la biblioteca: va al primer hueco en blanco o, si no hay, se añade al final (hasta el máximo de la parte)
  const TASK_LIMIT = { initial: 3, main: 6 };
  const pickFromLibrary = (lib) => {
    const part = libPart;
    if (!part) return;
    const current = form[part]?.tasks || [];
    const blankId = current.find(isBlankTask)?.id;
    if (!blankId && current.length >= TASK_LIMIT[part]) {
      toast({ title: "No queda hueco para otra tarea", description: "Abre la tarea que quieras cambiar y pulsa «Cargar de la biblioteca» dentro de ella.", variant: "destructive" });
      return;
    }
    const t = libraryToSessionTask(lib, part === "initial" ? "inicial" : "principal");
    setTasks(part, (ts) => (blankId ? ts.map((x) => (x.id === blankId ? t : x)) : [...ts, t]));
    setJustLoaded(t.id);
  };
  const copyFrom = (src) => {
    const hasWork = [...(form.initial?.tasks || []), ...(form.main?.tasks || [])].some((t) => !isBlankTask(t));
    if (hasWork && !window.confirm("Se sustituirán las tareas, el tipo, los objetivos y las notas de esta sesión por los de la sesión elegida. La asistencia no se toca. ¿Continuar?")) return;
    const c = duplicateSessionContent(src);
    if (!c.initial.tasks.length) c.initial.tasks = [emptyTask("inicial")];
    if (!c.main.tasks.length) c.main.tasks = [emptyTask("principal")];
    set(c);
    setCopyOpen(false);
    toast({ title: "Sesión copiada", description: `Tareas y objetivos de la sesión del ${longDate(src.date)}.` });
  };

  const changeTeam = (teamId) => {
    const t = teams.find((x) => x.id === teamId);
    set({ team_id: teamId, stage: t ? stageOfTeamName(t.name) : null, attendance: {}, match_ref: "" });
  };
  const changeDate = (date) => set({ date });

  const goBack = async () => { await autosave.flush(); onClose(); };
  const type = sessionTypeInfo(form.session_type);
  const initialTasks = form.initial?.tasks || [];
  const mainTasks = form.main?.tasks || [];
  const sheetSession = { ...form, stage };
  const prevStaffOf = (list, i) => { for (let k = i - 1; k >= 0; k -= 1) if (list[k]?.staff_roles?.length) return list[k].staff_roles; return null; };
  const allList = [...initialTasks, ...mainTasks];

  const renderTasks = (part, list, label) => list.map((t, i) => (
    <TaskEditor key={t.id} task={t} index={i} label={label} stage={stage} roster={roster} part={part} simulNo={simulWith(list, i)}
      onChangePart={(to) => changePart(t.id, to)} staffNames={staffNames} prevStaff={prevStaffOf(allList, allList.indexOf(t))}
      onChange={(patch) => patchTask(part, t.id, patch)} onRemove={() => removeTask(part, t)}
      onMove={(d) => moveTask(part, i, d)} onDuplicate={() => duplicateTask(part, i)}
      canMoveUp={i > 0} canMoveDown={i < list.length - 1} defaultOpen={(i === 0 && isBlankTask(t)) || t.id === justLoaded} />
  ));

  const partMin = (list) => fmtMin(partClock(list));
  const PartCard = ({ part, list, label, title }) => (
    <SCard className="overflow-hidden" data-testid={`part-${part}`}>
      <Band title={title} minutes={partMin(list)} />
      {renderTasks(part, list, label)}
      <div className="flex flex-wrap gap-2 px-5 pb-4 pt-3" style={{ borderTop: list.length ? `1px solid ${C.paleLine}` : 0 }}>
        {list.length < TASK_LIMIT[part] && <SBtn onClick={() => addTask(part)}><Plus className="w-4 h-4" /> {part === "initial" ? "Añadir tarea inicial" : "Añadir tarea"}</SBtn>}
        <SBtn onClick={() => setLibPart(part)}><Library className="w-4 h-4" /> Cargar de la biblioteca</SBtn>
      </div>
    </SCard>
  );
  const fromCalendar = nextMatch && matchRefOf(nextMatch) === form.match_ref;

  return (
    <fieldset disabled={readOnly} className="session-ui min-w-0 border-0 m-0 -mx-2 sm:mx-0 rounded-xl px-2 py-3 sm:px-6 sm:py-5 flex flex-col gap-4" style={{ background: C.bg, color: C.ink }}>
      <div className="flex items-center gap-3.5 flex-wrap">
        <button type="button" onClick={goBack} className="text-[13px] font-semibold hover:underline shrink-0" style={{ color: C.granate }}>← Sesiones</button>
        <div className="flex-1 min-w-[220px]">
          <D size={28} className="truncate" style={{ lineHeight: 1 }}>{team?.name || "Sesión"} · {form.date ? fullDate(form.date, { year: false }) : "sin fecha"}</D>
          <div className="text-xs mt-1 flex flex-wrap items-center gap-x-1.5" style={{ color: C.muted }}>
            <select value={stage || ""} onChange={(e) => e.target.value && set({ stage: e.target.value })} className="bg-transparent outline-none cursor-pointer hover:underline" style={{ color: C.muted, fieldSizing: "content" }} title="Etapa: contenidos que se pueden elegir" data-testid="session-stage">
              {!stage && <option value="">Elige etapa</option>}
              {STAGES.map((st) => <option key={st.id} value={st.id}>{st.label} ({st.teams})</option>)}
            </select>
            <span>· Sesión de {session?.owner_name || user?.full_name || "—"}</span>
            {!readOnly && <span>·</span>}
            {!readOnly && <SaveStatus state={autosave.state} onRetry={autosave.flush} />}
          </div>
        </div>
        {!readOnly && <SBtn onClick={() => setCopyOpen(true)} data-testid="session-copy"><CopyPlus className="w-4 h-4" /> Copiar de otra sesión</SBtn>}
        <SBtn onClick={() => setPreviewOpen("view")} data-testid="session-sheet"><Eye className="w-4 h-4" /> Vista previa</SBtn>
        <SBtn primary onClick={() => setPreviewOpen("pdf")} data-testid="session-download"><Download className="w-4 h-4" /> Descargar PDF</SBtn>
      </div>

      {readOnly && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs px-3 py-2 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 shrink-0" /> Sesión de {session?.owner_name || "otro entrenador"}: solo la puedes consultar.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <SCard className="px-4 sm:px-5 py-[18px] flex flex-col gap-3.5" data-testid="session-data">
            <D size={18}>Datos de la sesión</D>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Equipo">
                <Select value={form.team_id || ""} onValueChange={changeTeam}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder="Elige equipo" /></SelectTrigger>
                  <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={form.date ? `Fecha · ${fullDate(form.date, { year: false }).split(" ")[0]}` : "Fecha"}>
                <Input type="date" value={form.date || ""} onChange={(e) => changeDate(e.target.value)} className={inputCls} data-testid="session-date" />
              </Field>
              <Field label="Hora y campo"><Input value={form.time_place || ""} onChange={(e) => set({ time_place: e.target.value })} placeholder="18:30 · Campo 2 (mitad)" className={inputCls} /></Field>
              <Field label="Duración">
                <div className="relative">
                  <Input type="number" inputMode="numeric" min={0} value={form.duration ?? ""} onChange={(e) => set({ duration: e.target.value === "" ? "" : Number(e.target.value) })} className={`${inputCls} pr-11`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: C.muted }}>min</span>
                </div>
              </Field>
            </div>
            {form.date && <span className="hidden" data-testid="session-weekday">{fullDate(form.date)}</span>}

            <div className="flex flex-col gap-1.5">
              <Lab>Tipo de sesión</Lab>
              <div className="flex flex-wrap gap-2" data-testid="session-types">
                {SESSION_TYPES.map((t) => (
                  <Pill key={t.id} on={form.session_type === t.id} color={t.color} onClick={() => set({ session_type: form.session_type === t.id ? null : t.id })}>{sessionTypeName(t)}</Pill>
                ))}
              </div>
              {type?.hint && <span className="text-[11px]" style={{ color: C.muted }}>{type.hint}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Lab>Próximo partido</Lab>
              <div className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm flex-wrap" style={{ background: C.pale, border: `1px solid ${C.paleLine}` }}>
                <input value={form.match_ref || ""} onChange={(e) => set({ match_ref: e.target.value })} placeholder="CE Europa B (Fuera) | Sáb. 7 | 11:30h"
                  className="flex-1 min-w-[200px] bg-transparent outline-none font-bold py-1" style={{ color: C.ink }} aria-label="Próximo partido" />
                {fromCalendar && <span className="text-xs font-semibold" style={{ color: C.muted }}>Del calendario</span>}
                {nextMatch && !fromCalendar && (
                  <button type="button" onClick={() => set({ match_ref: matchRefOf(nextMatch), event_id: nextMatch.id })} className="text-xs font-semibold hover:underline" style={{ color: C.granate }}>
                    Poner el del calendario: {matchRefOf(nextMatch)}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Objetivos ofensivos"><Textarea value={form.obj_atk || ""} onChange={(e) => set({ obj_atk: e.target.value })} rows={3} placeholder="Salir jugando desde atrás con apoyos de costado y encontrar al hombre libre entre líneas." className={`${inputCls} leading-[1.45] min-h-[58px]`} /></Field>
              <Field label="Objetivos defensivos"><Textarea value={form.obj_def || ""} onChange={(e) => set({ obj_def: e.target.value })} rows={3} placeholder="Reaccionar a la pérdida en menos de 5 segundos y cerrar el pase interior al rival." className={`${inputCls} leading-[1.45] min-h-[58px]`} /></Field>
            </div>

            <label className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
              <Switch checked={form.held !== false} onCheckedChange={(v) => set({ held: v })} />
              Sesión realizada (si no se llegó a hacer, desmárcalo y no cuenta en los porcentajes)
            </label>
          </SCard>

          <AttendanceCard session={form} roster={roster} onChange={set} events={events} prevSession={prevSession} pdiGoals={pdiGoals} />

          {PartCard({ part: "initial", list: initialTasks, label: "Tarea inicial", title: "Parte inicial" })}
          {PartCard({ part: "main", list: mainTasks, label: "Tarea", title: "Parte principal" })}
        </div>

        <aside className="xl:sticky xl:top-3 flex flex-col gap-4">
          <LiveSummary session={form} stage={stage} />
          <SCard className="px-[18px] py-3.5 flex flex-col gap-1.5">
            <Lab>Notas</Lab>
            <Textarea value={form.notes || ""} onChange={(e) => set({ notes: e.target.value })} placeholder="Material, sesión de vídeo, cosas a recordar…" rows={3} className={`${inputCls} text-[13px] leading-[1.45]`} />
          </SCard>
        </aside>
      </div>

      <LibraryTaskPicker key={libPart || "none"} open={!!libPart} onOpenChange={(o) => { if (!o) setLibPart(null); }} part={libPart === "initial" ? "inicial" : "principal"} onPick={pickFromLibrary} />
      <CopySessionDialog open={copyOpen} onOpenChange={setCopyOpen} sessions={copyable} teams={teams} onPick={copyFrom} />
      <SessionPreview open={!!previewOpen} startPdf={previewOpen === "pdf"} onOpenChange={(o) => setPreviewOpen(o ? "view" : false)} session={sheetSession} team={team} players={roster} matchRef={form.match_ref} pdiGoals={pdiGoals} ownerName={session?.owner_name || user?.full_name || ""} />
    </fieldset>
  );
}
