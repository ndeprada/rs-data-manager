import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ClipboardList, Copy, Plus, Printer, Trash2 } from "lucide-react";
import SessionEditor, { newSessionFor } from "./SessionEditor";
import SessionPreview from "./SessionPreview";
import { longDate, todayStr } from "./sessionHelpers";
import { allTasks, fmtMin, registerSession, sessionTypeInfo, emptyTask, taskMinutes } from "@/lib/sessionPlan";

const ALL = "__all";

function NewSessionDialog({ open, onOpenChange, teams, defaultTeamId, onCreate }) {
  const [teamId, setTeamId] = useState(defaultTeamId || teams[0]?.id || "");
  const [date, setDate] = useState(todayStr());
  React.useEffect(() => { if (open) { setTeamId((t) => (teams.some((x) => x.id === t) ? t : defaultTeamId || teams[0]?.id || "")); setDate(todayStr()); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Nueva sesión</DialogTitle>
          <DialogDescription className="text-xs">Elige el equipo y el día. El tipo de sesión se propone según el día de la semana y lo puedes cambiar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Equipo</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Elige equipo" /></SelectTrigger>
              <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <Button variant="club" className="w-full" disabled={!teamId || !date} onClick={() => onCreate(teams.find((t) => t.id === teamId), date)}>Crear sesión</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SessionsHome({ teams, isCoordinator, defaultTeamId }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // { session } | { draft }
  const [newOpen, setNewOpen] = useState(false);
  const [teamFilter, setTeamFilter] = useState(ALL);
  const [coachFilter, setCoachFilter] = useState(ALL);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data: sessions = [], isLoading } = useQuery({ queryKey: ["coach_sessions"], queryFn: () => base44.entities.CoachSession.list("-date", 1000) });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const teamName = (id) => teams.find((t) => t.id === id)?.name || "Equipo";

  const coaches = useMemo(() => {
    const m = new Map();
    sessions.forEach((s) => s.owner_id && m.set(s.owner_id, s.owner_name || "Entrenador"));
    return [...m.entries()];
  }, [sessions]);

  const shown = useMemo(() => sessions
    .filter((s) => (teamFilter === ALL || s.team_id === teamFilter) && (coachFilter === ALL || s.owner_id === coachFilter))
    .sort((a, b) => String(b.date).localeCompare(String(a.date))), [sessions, teamFilter, coachFilter]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["coach_sessions"] });

  const duplicate = async (s) => {
    setBusy(true);
    try {
      const copy = JSON.parse(JSON.stringify(s));
      ["id", "created_date", "updated_date"].forEach((k) => delete copy[k]);
      const fresh = (list) => ({ ...list, tasks: (list?.tasks || []).map((t) => ({ ...t, id: emptyTask().id })) });
      copy.initial = fresh(copy.initial); copy.main = fresh(copy.main);
      copy.date = todayStr(); copy.held = true; copy.event_id = null; copy.match_ref = "";
      copy.attendance = Object.fromEntries(Object.entries(copy.attendance || {}).map(([id, a]) => [id, a.areas ? { areas: a.areas } : {}]).filter(([, a]) => a.areas));
      copy.attendance_others = "";
      const created = await base44.entities.CoachSession.create({ ...copy, owner_id: user.id, owner_name: user.full_name || user.email || "", season: CURRENT_SEASON });
      await refresh();
      setEditing({ session: created });
    } finally { setBusy(false); }
  };

  const remove = async (s) => {
    if (!window.confirm(`¿Borrar la sesión del ${longDate(s.date)} de ${teamName(s.team_id)}? Dejará de contar en los porcentajes.`)) return;
    setBusy(true);
    try { await base44.entities.CoachSession.delete(s.id); await refresh(); } finally { setBusy(false); }
  };

  if (editing) {
    const key = editing.session?.id || "new";
    return (
      <SessionEditor key={key} session={editing.session} draft={editing.draft} teams={teams} sessions={sessions}
        onClose={() => { setEditing(null); refresh(); }} />
    );
  }

  const canWrite = (s) => s.owner_id === user?.id;
  const previewTeam = preview ? teams.find((t) => t.id === preview.team_id) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los equipos</SelectItem>
            {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {isCoordinator && coaches.length > 0 && (
          <Select value={coachFilter} onValueChange={setCoachFilter}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los entrenadores</SelectItem>
              {coaches.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex-1" />
        <Button variant="club" size="sm" onClick={() => setNewOpen(true)}><Plus className="w-4 h-4 mr-1.5" /> Nueva sesión</Button>
      </div>

      {isCoordinator
        ? <p className="text-[11px] text-gray-400">Como coordinador ves las sesiones de todos los entrenadores (solo lectura); cada entrenador edita las suyas.</p>
        : <p className="text-[11px] text-gray-400">Tus sesiones son personales: solo las ves tú y los coordinadores.</p>}

      {isLoading ? <p className="text-sm text-gray-400 py-6 text-center">Cargando…</p> : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <ClipboardList className="w-8 h-8 mx-auto text-gray-300" />
          <p className="text-sm font-bold mt-2">Todavía no hay sesiones</p>
          <p className="text-xs text-gray-500 mt-1">Crea la primera: eliges los contenidos de cada tarea y la app va sumando el tiempo trabajado de cada uno.</p>
          <Button variant="club" size="sm" className="mt-3" onClick={() => setNewOpen(true)}><Plus className="w-4 h-4 mr-1.5" /> Nueva sesión</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((s) => {
            const type = sessionTypeInfo(s.session_type);
            const reg = registerSession(s);
            const n = allTasks(s).filter((t) => taskMinutes(t) > 0).length;
            return (
              <div key={s.id} className="rounded-xl border border-gray-200 bg-white flex items-stretch overflow-hidden">
                <button type="button" onClick={() => setEditing({ session: s })} className="flex-1 min-w-0 text-left px-3 py-2.5 hover:bg-gray-50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{longDate(s.date)}</span>
                    <span className="text-sm font-semibold text-gray-700">{teamName(s.team_id)}</span>
                    {type && <span className="text-[10px] font-black uppercase tracking-wide text-white rounded-full px-2 py-0.5" style={{ background: type.color }}>{type.label}</span>}
                    {s.held === false && <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-gray-200 text-gray-600">No realizada</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {n} tareas · {fmtMin(reg.total)}{s.match_ref ? ` · ${s.match_ref}` : ""}{isCoordinator && s.owner_name ? ` · ${s.owner_name}` : ""}
                  </p>
                  {reg.unclassified > 0 && <p className="text-[11px] text-amber-600 mt-0.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {fmtMin(reg.unclassified)} sin contenido elegido</p>}
                </button>
                <div className="flex items-center gap-0.5 pr-1.5">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Ver ficha / imprimir" onClick={() => setPreview(s)}><Printer className="w-4 h-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Duplicar como sesión nueva (hoy)" disabled={busy} onClick={() => duplicate(s)}><Copy className="w-4 h-4" /></Button>
                  {canWrite(s) && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Borrar" disabled={busy} onClick={() => remove(s)}><Trash2 className="w-4 h-4" /></Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewSessionDialog open={newOpen} onOpenChange={setNewOpen} teams={teams} defaultTeamId={teamFilter !== ALL ? teamFilter : defaultTeamId}
        onCreate={(team, date) => { setNewOpen(false); setEditing({ draft: newSessionFor({ team, date }) }); }} />

      {preview && (
        <SessionPreview open onOpenChange={(o) => !o && setPreview(null)} session={{ ...preview, stage: preview.stage }} team={previewTeam}
          players={players.filter((p) => p.team_id === preview.team_id && p.status !== "baja")} matchRef={preview.match_ref} />
      )}
    </div>
  );
}
