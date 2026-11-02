import React, { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { useAutosave } from "@/lib/useAutosave";
import SaveStatus from "@/components/common/SaveStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArrowLeft, CalendarCheck, ChevronDown, ChevronRight, CopyPlus, Eye, Library, Lock, Plus, Users } from "lucide-react";
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
  moveTaskToPart, normalizeSessionType, pctOf, registerSession, sessionTypeInfo, sessionTypeName, stageOfTeamName, taskMinutes,
} from "@/lib/sessionPlan";
import { MATCH_TYPES } from "@/lib/matchStatus";
import { isCancelled } from "@/lib/eventCancel";

const TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico"];
const META = ["id", "created_date", "updated_date", "owner_id", "owner_name", "season"];
const L = ({ children, className = "" }) => <Label className={`text-[11px] font-bold uppercase tracking-wider text-gray-500 ${className}`}>{children}</Label>;

const stripMeta = (s) => Object.fromEntries(Object.entries(s).filter(([k]) => !META.includes(k)));

// Base de una sesión nueva a partir de un equipo y una fecha
export function newSessionFor({ team, date = todayStr() }) {
  const stage = team ? stageOfTeamName(team.name) : null;
  return emptySession({ teamId: team?.id || "", date, stage, type: null });
}

function Card({ title, right, children, open = true, onToggle }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className={`flex items-center gap-2 px-3 py-2.5 ${onToggle ? "cursor-pointer" : ""} bg-gray-50/70`} onClick={onToggle}>
        {onToggle && (open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />)}
        <h2 className="text-sm font-black uppercase tracking-wide flex-1" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{title}</h2>
        {right}
      </div>
      {(!onToggle || open) && <div className="p-3">{children}</div>}
    </section>
  );
}

// Lo que se trabaja en esta sesión, al instante: minutos y % de cada contenido (principal y secundario) y de cada bloque
function ContentLines({ list, total, kind, custom }) {
  return (
    <div className="space-y-1">
      {list.map((c) => {
        const b = BLOCKS.find((x) => x.id === contentBlock(c.id, { custom_contents: custom }));
        const m = kind === "principal" ? c.principal : c.secondary;
        return (
          <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-xs" data-testid={`live-${kind}-${c.id}`}>
            <span className="truncate"><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: b?.color || "#999" }} />{contentName(c.id, { custom_contents: custom })}</span>
            <span className={`tabular-nums whitespace-nowrap ${kind === "principal" ? "font-bold" : "text-gray-600"}`}>{fmtMin(m)} · {fmtPct(pctOf(m, total))}</span>
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
  const planned = reg.total;
  const dur = Number(session.duration) || 0;
  const diff = dur ? Math.round((dur - planned) * 10) / 10 : 0;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{fmtMin(planned)}<span className="text-sm font-semibold text-gray-400"> de {dur || "—"}’</span></p>
        {dur > 0 && planned > 0 && (
          diff < 0
            ? <p className="text-xs font-semibold text-amber-700 flex items-center gap-1" data-testid="live-over"><AlertTriangle className="w-3.5 h-3.5" /> Las tareas suman {fmtMin(-diff)} más que la duración de la sesión</p>
            : <p className="text-xs text-gray-500" data-testid="live-left">{diff > 0 ? `Quedan ${fmtMin(diff)} sin tareas` : "Las tareas llenan justo la sesión"}</p>
        )}
        {dur > 0 && <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-1.5"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (planned / dur) * 100)}%`, background: diff < 0 ? "#d97706" : "var(--granate)" }} /></div>}
        <p className="text-[11px] text-gray-500 mt-1">
          {reg.unclassified > 0 && <span className="text-amber-600 font-semibold">Sin contenido principal: {fmtMin(reg.unclassified)} · </span>}
          {reg.noCurriculum > 0 && <span>Sin contenidos (PF, activación…): {fmtMin(reg.noCurriculum)}</span>}
        </p>
      </div>
      {principals.length === 0 && seconds.length === 0 ? (
        <p className="text-xs text-gray-400">Cuando elijas contenidos en las tareas, aquí verás cuánto tiempo va a cada uno.</p>
      ) : (
        <>
          {principals.length > 0 && <div><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Contenidos principales</p><ContentLines list={principals} total={planned} kind="principal" custom={reg.custom} /></div>}
          {seconds.length > 0 && <div><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Contenidos secundarios</p><ContentLines list={seconds} total={planned} kind="secondary" custom={reg.custom} /></div>}
          <p className="text-[10px] text-gray-400">% sobre el tiempo de las tareas de esta sesión. Una tarea con dos principales suma su tiempo a los dos.</p>
        </>
      )}
      {rows.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Por bloque frente a la etapa</p>
          {rows.map((r) => {
            const b = BLOCKS.find((x) => x.id === r.block);
            return (
              <div key={r.block} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-xs">
                <span className="font-bold truncate" style={{ color: b.color }}>{b.short}</span>
                <div className="relative h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, r.pct)}%`, background: b.color }} />
                  <div className="absolute inset-y-0 w-0.5 bg-gray-800/60" style={{ left: `${Math.min(100, r.target)}%` }} title={`Referencia de la etapa: ${r.target}%`} />
                </div>
                <span className="tabular-nums text-gray-600 whitespace-nowrap">{Math.round(r.pct)}% <span className="text-gray-400">(ref. {r.target}%)</span></span>
              </div>
            );
          })}
          <p className="text-[10px] text-gray-400">La raya oscura es el % de referencia de la etapa.</p>
        </div>
      )}
    </div>
  );
}

const ATT = [["si", "Sí", "#16a34a", "#fff"], ["ad", "Al margen", "#bde3c3", "#14532d"], ["no", "No", "#dc2626", "#fff"]];

function AttendanceBlock({ session, roster, onChange, events, prevSession, pdiGoals }) {
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
  const counts = ATT.map(([k]) => eff.filter((a) => a.st === k).length);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={importCalendar} disabled={importing || trainings.length === 0} title={trainings.length ? "" : "No hay un entrenamiento de este equipo ese día en el calendario"}>
          <CalendarCheck className="w-4 h-4 mr-1.5" /> {importing ? "Trayendo…" : "Traer asistencia del calendario"}
        </Button>
        {prevSession && <Button type="button" variant="outline" size="sm" onClick={copyAreas}>Copiar áreas de la sesión anterior</Button>}
        <span className="text-xs text-gray-500 ml-auto">Disponibles <b className="text-green-700">{counts[0]}</b> · al margen <b>{counts[1]}</b> · no <b className="text-red-600">{counts[2]}</b></span>
      </div>
      {msg && <p className="text-xs text-gray-500">{msg}</p>}
      <p className="text-[11px] text-gray-500">Los lesionados salen como «No · lesión» y el área sale del objetivo del PDI que el jugador tiene «en curso»; puedes cambiar las dos cosas.</p>
      <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
        {roster.map((p, i) => {
          const a = att[p.id] || {};
          const e = eff[i];
          const pdi = pdiAreaOf(p.id, pdiGoals);
          return (
            <div key={p.id} className="grid grid-cols-[2.2rem_1.6rem_minmax(0,1fr)] sm:grid-cols-[2.2rem_1.6rem_minmax(7rem,12rem)_auto_8rem_1fr] items-center gap-x-2 gap-y-1 px-2 py-1.5" data-testid={`att-row-${p.id}`}>
              <span className="text-[10px] font-black text-[var(--granate)]">{posShort(p.position)}</span>
              <span className="text-[11px] text-gray-500 tabular-nums">{p.jersey_number ?? ""}</span>
              <span className="text-sm font-semibold truncate">{playerFullName(p)}</span>
              <div className="flex gap-1 col-span-3 sm:col-span-1">
                {ATT.map(([k, label, bg, fg]) => (
                  <button key={k} type="button" onClick={() => setPlayer(p.id, { st: e.st === k && a.st ? "" : k })} aria-pressed={e.st === k}
                    className="h-7 px-2 rounded-md border text-[11px] font-bold whitespace-nowrap" style={e.st === k ? { background: bg, color: fg, borderColor: bg, opacity: a.st ? 1 : 0.75 } : { background: "#fff", color: "#9ca3af", borderColor: "#e5e7eb" }}>{label}</button>
                ))}
              </div>
              <div className="col-span-3 sm:col-span-1">
                {e.st === "no" || e.st === "ad" ? (
                  <Input value={a.obs ?? e.obs ?? ""} onChange={(ev) => setPlayer(p.id, { obs: ev.target.value })} placeholder="Motivo" list="att-reasons" className="h-7 text-xs" />
                ) : <span />}
              </div>
              <Input value={a.areas || ""} onChange={(ev) => setPlayer(p.id, { areas: ev.target.value })} placeholder={pdi || "Área del PDI que trabaja"} className={`h-7 text-xs col-span-3 sm:col-span-1 ${!a.areas && pdi ? "placeholder:text-gray-700" : ""}`} title={pdi && !a.areas ? `Del PDI: ${pdi}` : ""} />
            </div>
          );
        })}
      </div>
      <datalist id="att-reasons">{ATT_REASONS.map((r) => <option key={r} value={r} />)}</datalist>
      <div>
        <L>Otros jugadores / pruebas</L>
        <Input value={session.attendance_others || ""} onChange={(e) => onChange({ attendance_others: e.target.value })} placeholder="Ej: Marc (Cadet S16 B), Leo (prueba)" className="mt-1" />
      </div>
    </div>
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
  const [attOpen, setAttOpen] = useState(true);
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
    <TaskEditor key={t.id} task={t} index={i} label={label} stage={stage} roster={roster} part={part}
      onChangePart={(to) => changePart(t.id, to)} staffNames={staffNames} prevStaff={prevStaffOf(allList, allList.indexOf(t))}
      onChange={(patch) => patchTask(part, t.id, patch)} onRemove={() => removeTask(part, t)}
      onMove={(d) => moveTask(part, i, d)} onDuplicate={() => duplicateTask(part, i)}
      canMoveUp={i > 0} canMoveDown={i < list.length - 1} defaultOpen={(i === 0 && isBlankTask(t)) || t.id === justLoaded} />
  ));

  return (
    <fieldset disabled={readOnly} className="space-y-3 min-w-0 border-0 p-0 m-0">
      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" variant="ghost" size="sm" onClick={goBack} className="-ml-2"><ArrowLeft className="w-4 h-4 mr-1" /> Sesiones</Button>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black truncate" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
            {team?.name || "Sesión"} · {form.date ? fullDate(form.date, { year: false }) : "sin fecha"}
          </p>
        </div>
        {!readOnly && <SaveStatus state={autosave.state} onRetry={autosave.flush} />}
        {!readOnly && <Button type="button" variant="outline" size="sm" onClick={() => setCopyOpen(true)} data-testid="session-copy"><CopyPlus className="w-4 h-4 mr-1.5" /> Copiar de otra sesión</Button>}
        <Button type="button" variant="club" size="sm" onClick={() => setPreviewOpen(true)} data-testid="session-sheet"><Eye className="w-4 h-4 mr-1.5" /> Hoja / PDF</Button>
      </div>

      {readOnly && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs px-3 py-2 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 shrink-0" /> Sesión de {session?.owner_name || "otro entrenador"}: solo la puedes consultar.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem] gap-3 items-start">
        <div className="space-y-3 min-w-0">
          <Card title="Datos de la sesión">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <L>Equipo</L>
                <Select value={form.team_id || ""} onValueChange={changeTeam}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Elige equipo" /></SelectTrigger>
                  <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <L>Fecha</L>
                <Input type="date" value={form.date || ""} onChange={(e) => changeDate(e.target.value)} className="mt-1" />
                {form.date && <p className="text-[11px] text-gray-500 mt-0.5 first-letter:uppercase" data-testid="session-weekday">{fullDate(form.date)}</p>}
              </div>
              <div>
                <L>Duración (min)</L>
                <Input type="number" inputMode="numeric" min={0} value={form.duration ?? ""} onChange={(e) => set({ duration: e.target.value === "" ? "" : Number(e.target.value) })} className="mt-1" />
              </div>
            </div>

            <div className="mt-3">
              <L>Tipo de sesión</L>
              <div className="mt-1 flex flex-wrap gap-1.5" data-testid="session-types">
                {SESSION_TYPES.map((t) => (
                  <button key={t.id} type="button" onClick={() => set({ session_type: form.session_type === t.id ? null : t.id })} aria-pressed={form.session_type === t.id}
                    className="h-8 px-3 rounded-full border text-xs font-bold"
                    style={form.session_type === t.id ? { background: t.color, color: "#fff", borderColor: t.color } : { background: "#fff", color: t.color, borderColor: `${t.color}55` }}>{sessionTypeName(t)}</button>
                ))}
              </div>
              {type && <p className="text-[11px] text-gray-500 mt-1">{type.hint}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[14rem_1fr] gap-3 mt-3">
              <div>
                <L>Etapa (contenidos que se pueden elegir)</L>
                <Select value={stage || ""} onValueChange={(v) => v && set({ stage: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Elige etapa" /></SelectTrigger>
                  <SelectContent>{STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label} · {s.teams}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <L>Próximo partido</L>
                <Input value={form.match_ref || ""} onChange={(e) => set({ match_ref: e.target.value })} placeholder="Congrès (Casa) | Sáb. 24 | 16:30h" className="mt-1" />
                {nextMatch && matchRefOf(nextMatch) !== form.match_ref && (
                  <button type="button" onClick={() => set({ match_ref: matchRefOf(nextMatch), event_id: nextMatch.id })} className="text-[11px] text-[var(--granate)] font-semibold mt-1 hover:underline">
                    Poner el del calendario: {matchRefOf(nextMatch)}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div><L>Objetivos ofensivos</L><Textarea value={form.obj_atk || ""} onChange={(e) => set({ obj_atk: e.target.value })} rows={3} placeholder="Ej: Salir jugando desde atrás con apoyos de costado y encontrar al hombre libre entre líneas." className="mt-1 text-sm" /></div>
              <div><L>Objetivos defensivos</L><Textarea value={form.obj_def || ""} onChange={(e) => set({ obj_def: e.target.value })} rows={3} placeholder="Ej: Reaccionar a la pérdida en menos de 5 segundos y cerrar el pase interior." className="mt-1 text-sm" /></div>
            </div>

            <label className="flex items-center gap-2 mt-3 text-sm">
              <Switch checked={form.held !== false} onCheckedChange={(v) => set({ held: v })} />
              <span>Sesión realizada <span className="text-xs text-gray-400">— si no se llegó a hacer, desmárcalo y no cuenta en los porcentajes</span></span>
            </label>
          </Card>

          <Card title={`Jugadores · ${roster.length}`} open={attOpen} onToggle={() => setAttOpen((o) => !o)}
            right={<Users className="w-4 h-4 text-gray-400" />}>
            {roster.length ? (
              <AttendanceBlock session={form} roster={roster} onChange={set} events={events} prevSession={prevSession} pdiGoals={pdiGoals} />
            ) : <p className="text-sm text-gray-400">Este equipo no tiene jugadores en la plantilla.</p>}
          </Card>

          <Card title="Parte inicial" right={<span className="text-xs font-bold text-gray-500">{fmtMin(initialTasks.reduce((s, t) => s + taskMinutes(t), 0))}</span>}>
            <div className="space-y-2">
              {renderTasks("initial", initialTasks, "Tarea inicial")}
              <div className="flex flex-wrap gap-2">
                {initialTasks.length < TASK_LIMIT.initial && <Button type="button" variant="outline" size="sm" onClick={() => addTask("initial")}><Plus className="w-4 h-4 mr-1" /> Añadir tarea inicial</Button>}
                <Button type="button" variant="outline" size="sm" onClick={() => setLibPart("initial")}><Library className="w-4 h-4 mr-1" /> Cargar de la biblioteca</Button>
              </div>
            </div>
          </Card>

          <Card title="Parte principal" right={<span className="text-xs font-bold text-gray-500">{fmtMin(mainTasks.reduce((s, t) => s + taskMinutes(t), 0))}</span>}>
            <div className="space-y-2">
              {renderTasks("main", mainTasks, "Tarea")}
              <div className="flex flex-wrap gap-2">
                {mainTasks.length < TASK_LIMIT.main && <Button type="button" variant="outline" size="sm" onClick={() => addTask("main")}><Plus className="w-4 h-4 mr-1" /> Añadir tarea</Button>}
                <Button type="button" variant="outline" size="sm" onClick={() => setLibPart("main")}><Library className="w-4 h-4 mr-1" /> Cargar de la biblioteca</Button>
              </div>
            </div>
          </Card>

          <Card title="Notas">
            <Textarea value={form.notes || ""} onChange={(e) => set({ notes: e.target.value })} placeholder="Material, sesión de vídeo, cosas a recordar…" rows={3} />
          </Card>
        </div>

        <div className="xl:sticky xl:top-3 space-y-3">
          <Card title="Lo que se trabaja hoy">
            <LiveSummary session={form} stage={stage} />
          </Card>
        </div>
      </div>

      <LibraryTaskPicker key={libPart || "none"} open={!!libPart} onOpenChange={(o) => { if (!o) setLibPart(null); }} part={libPart === "initial" ? "inicial" : "principal"} onPick={pickFromLibrary} />
      <CopySessionDialog open={copyOpen} onOpenChange={setCopyOpen} sessions={copyable} teams={teams} onPick={copyFrom} />
      <SessionPreview open={previewOpen} onOpenChange={setPreviewOpen} session={sheetSession} team={team} players={roster} matchRef={form.match_ref} pdiGoals={pdiGoals} ownerName={session?.owner_name || user?.full_name || ""} />
    </fieldset>
  );
}
