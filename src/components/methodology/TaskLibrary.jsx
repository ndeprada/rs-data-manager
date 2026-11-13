// Metodología → Biblioteca de tareas (rediseño rs2 del 13/11/2026, maqueta aprobada por Nacho):
// filtros a la izquierda, tarjetas con el dibujo y cuántas veces se ha usado cada tarea, y vista rápida a la derecha.
import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RS } from "@/components/rs2/kit";
import BoardPlayer from "@/components/board/BoardPlayer";
import BoardDownloads from "@/components/board/BoardDownloads";
import { hasBoard } from "@/lib/board";
import { contentName, isBlankTask } from "@/lib/sessionPlan";
import { authorOf, libraryContents, libraryToSessionTask } from "@/lib/taskLibrary";
import {
  DURATION_RANGES, EMPTY_LIB_FILTERS, PLAYER_RANGES, activeLibFilters, addDays, countBy, libraryUses, matchesLibrary, sortLibrary,
} from "@/lib/methodologyView";
import TaskFormDialog from "./TaskFormDialog";
import { GAME_MOMENTS, SESSION_PHASES, getDifficulty, getGameMoment, getSessionPhase } from "./methodologyConfig";
import { Box, ContentTag, PillBtn, Seg, btnStyle, card } from "./MethParts";
import { todayStr, longDate } from "@/components/sessions/sessionHelpers";
import { useT, msg } from "@/i18n";

const FORMATS = [["f7", msg("F7")], ["f11", msg("F11")], ["ambos", msg("Los dos")]];
const PLAYER_LABELS = { le8: "≤ 8", "9to14": "9–14", ge15: "15+" };
const DURATION_LABELS = { le10: "≤ 10’", "11to20": "11–20’", gt20: "> 20’" };
const TASK_LIMIT = { initial: 3, main: 6 };
const lab = { fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: RS.muted };

function Group({ title, children }) {
  return (
    <div style={{ padding: "8px 12px", borderTop: "1px solid #F3EEEE" }}>
      <div style={lab}>{title}</div>
      <div className="flex flex-wrap" style={{ gap: 5, marginTop: 6 }}>{children}</div>
    </div>
  );
}

function Thumb({ task, height = 118 }) {
  if (hasBoard(task.board)) return <div style={{ height, background: "#fff", display: "flex", justifyContent: "center", overflow: "hidden" }}><BoardPlayer board={task.board} style={{ height: "100%", width: "auto", maxWidth: "100%" }} /></div>;
  if (task.diagram_url) return <div style={{ height, background: RS.head, overflow: "hidden" }}><img src={task.diagram_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
  return <div style={{ height: Math.round(height * 0.5), background: RS.head, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: RS.faint }}>—</div>;
}

// Añadir una tarea de la biblioteca a una de tus sesiones (la tarea de la biblioteca no se toca)
function AddToSessionDialog({ task, open, onOpenChange, sessions, teams, me }) {
  const t = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [part, setPart] = useState(task?.session_phase === "calentamiento" ? "initial" : "main");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setPart(task?.session_phase === "calentamiento" ? "initial" : "main"); }, [open, task]);
  const from = addDays(todayStr(), -14);
  const mine = sessions.filter((s) => s.owner_id === me && String(s.date) >= from).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);
  const teamName = (id) => teams.find((x) => x.id === id)?.name || "";
  const add = async (s) => {
    const cur = s[part]?.tasks || [];
    const blank = cur.find(isBlankTask);
    if (!blank && cur.length >= TASK_LIMIT[part]) { toast({ title: t("No queda hueco en esa parte de la sesión"), variant: "destructive" }); return; }
    const nt = libraryToSessionTask(task, part === "initial" ? "inicial" : "principal");
    const tasks = blank ? cur.map((x) => (x.id === blank.id ? nt : x)) : [...cur, nt];
    setBusy(true);
    try {
      await base44.entities.CoachSession.update(s.id, { [part]: { ...(s[part] || {}), tasks } });
      qc.invalidateQueries({ queryKey: ["coach_sessions"] });
      toast({ title: t("Añadida a la sesión del {fecha}", { fecha: longDate(s.date) }) });
      onOpenChange(false);
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-md" data-testid="lib-add-dialog">
        <DialogHeader>
          <DialogTitle><span className="rs2-display" style={{ color: RS.granate, fontSize: 22 }}>{t("Añadir a una sesión")}</span></DialogTitle>
          <DialogDescription className="text-xs">{t("Se copia «{n}» en la sesión. La tarea de la biblioteca no cambia.", { n: task?.name || "" })}</DialogDescription>
        </DialogHeader>
        <Seg options={[["initial", t("Parte inicial")], ["main", t("Parte principal")]]} value={part} onChange={setPart} testPrefix="lib-add-part" />
        <div style={{ maxHeight: 320, overflowY: "auto", border: `1px solid ${RS.line}`, borderRadius: 10 }}>
          {mine.length === 0 && <p style={{ padding: 14, fontSize: 12.5, color: RS.muted }}>{t("No tienes sesiones de las dos últimas semanas ni planificadas. Crea la sesión en «Sesiones» y vuelve.")}</p>}
          {mine.map((s) => (
            <button key={s.id} type="button" disabled={busy} onClick={() => add(s)} data-testid={`lib-add-${s.id}`}
              className="flex items-center w-full text-left" style={{ gap: 8, padding: "8px 12px", borderTop: "1px solid #F3EEEE", background: "#fff", border: 0, borderBottom: `1px solid ${RS.lineSoft}` }}>
              <b style={{ fontSize: 12.5, color: RS.granateDark, width: 120 }}>{longDate(s.date)}</b>
              <span style={{ flex: 1, fontSize: 12.5 }}>{teamName(s.team_id)}</span>
              <span style={{ fontSize: 11.5, color: RS.muted }}>{(s[part]?.tasks || []).filter((x) => !isBlankTask(x)).length}/{TASK_LIMIT[part]}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TaskLibrary({ teams = [], initialQuery = "" }) {
  const t = useT();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [f, setF] = useState(() => ({ ...EMPTY_LIB_FILTERS, q: initialQuery }));
  const [sortBy, setSortBy] = useState(() => { try { return localStorage.getItem("rs_lib_sort") || "recent"; } catch { return "recent"; } });
  const [selId, setSelId] = useState(null);
  const [addTask, setAddTask] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => { if (initialQuery) setF((x) => ({ ...x, q: initialQuery })); }, [initialQuery]);
  useEffect(() => { try { localStorage.setItem("rs_lib_sort", sortBy); } catch { /* sin almacenamiento */ } }, [sortBy]);

  const { data: tasks = [], isLoading } = useQuery({ queryKey: ["training_tasks"], queryFn: () => base44.entities.TrainingTask.list("-created_date", 500) });
  const { data: sessions = [] } = useQuery({ queryKey: ["coach_sessions"], queryFn: () => base44.entities.CoachSession.list("-date", 1000) });
  const uses = useMemo(() => libraryUses(sessions), [sessions]);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["training_tasks"] });
  const createMutation = useMutation({ mutationFn: (data) => base44.entities.TrainingTask.create(data), onSuccess: (r) => { invalidate(); if (r?.id) setSelId(r.id); toast({ title: t("Tarea creada") }); } });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.TrainingTask.update(id, data), onSuccess: () => { invalidate(); toast({ title: t("Tarea actualizada") }); } });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.TrainingTask.delete(id), onSuccess: () => { invalidate(); setSelId(null); toast({ title: t("Tarea eliminada") }); } });

  const handleSave = (form) => {
    if (editingTask) updateMutation.mutate({ id: editingTask.id, data: form });
    else createMutation.mutate({ ...form, ...authorOf(user) });
    setEditingTask(null);
  };
  const duplicate = (task) => {
    const { id: _i, created_date: _c, updated_date: _u, author_id: _a, author_name: _n, ...rest } = task;
    createMutation.mutate({ ...rest, name: `${task.name} (${t("copia")})`, ...authorOf(user) });
  };
  const remove = (task) => { if (window.confirm(t("¿Borrar «{n}» de la biblioteca? Las sesiones que ya la usan no cambian.", { n: task.name }))) deleteMutation.mutate(task.id); };

  const namesOf = (task) => { const c = libraryContents(task); return [...c.principal, ...c.secondary].map((id) => contentName(id, task)); };
  const opts = { me: user?.id, contentNames: namesOf };
  const filtered = useMemo(() => sortLibrary(tasks.filter((x) => matchesLibrary(x, f, opts)), sortBy, uses), [tasks, f, sortBy, uses, user?.id]);
  const base = useMemo(() => tasks.filter((x) => matchesLibrary(x, { ...f, phases: [], moments: [], formats: [] }, opts)), [tasks, f, user?.id]);
  const cPhase = countBy(base, "session_phase", "parte_principal"), cMoment = countBy(base, "game_moment", "ninguno"), cFormat = countBy(base, "football_format", "ambos");
  const mineCount = tasks.filter((x) => x.author_id && x.author_id === user?.id).length;
  const sel = tasks.find((x) => x.id === selId) || null;
  const toggle = (k, v) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  const nActive = activeLibFilters(f);
  const teamName = (id) => teams.find((x) => x.id === id)?.name || "";

  const filtersCard = (
    <section style={card} data-testid="lib-filters">
      <div style={{ padding: "10px 12px" }}>
        <span className="flex items-center" style={{ gap: 6, border: `1px solid ${RS.line}`, borderRadius: 8, padding: "6px 9px" }}>
          <Search className="w-3.5 h-3.5" style={{ color: RS.muted }} />
          <input value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} placeholder={t("Buscar por nombre o contenido")} style={{ border: 0, outline: 0, width: "100%", fontSize: 12.5 }} data-testid="lib-search" />
        </span>
      </div>
      <Group title={t("Tareas")}>
        <PillBtn on={f.owner === "all"} onClick={() => setF((x) => ({ ...x, owner: "all" }))} testId="lib-owner-all">{t("Todas")} <span style={{ opacity: 0.7 }}>{tasks.length}</span></PillBtn>
        <PillBtn on={f.owner === "mine"} onClick={() => setF((x) => ({ ...x, owner: "mine" }))} testId="lib-owner-mine">{t("Mías")} <span style={{ opacity: 0.7 }}>{mineCount}</span></PillBtn>
        <PillBtn on={f.owner === "club"} onClick={() => setF((x) => ({ ...x, owner: "club" }))} testId="lib-owner-club">{t("Del club")} <span style={{ opacity: 0.7 }}>{tasks.length - mineCount}</span></PillBtn>
      </Group>
      <Group title={t("Parte de la sesión")}>
        {SESSION_PHASES.map((p) => <PillBtn key={p.value} on={f.phases.includes(p.value)} onClick={() => toggle("phases", p.value)} testId={`lib-phase-${p.value}`}>{t(p.label)} <span style={{ opacity: 0.7 }}>{cPhase[p.value] || 0}</span></PillBtn>)}
      </Group>
      <Group title={t("Momento del juego")}>
        {GAME_MOMENTS.filter((m) => cMoment[m.value] || f.moments.includes(m.value)).map((m) => <PillBtn key={m.value} on={f.moments.includes(m.value)} onClick={() => toggle("moments", m.value)} testId={`lib-moment-${m.value}`}>{t(m.label)} <span style={{ opacity: 0.7 }}>{cMoment[m.value] || 0}</span></PillBtn>)}
      </Group>
      <Group title={t("Formato")}>
        {FORMATS.map(([k, l]) => <PillBtn key={k} on={f.formats.includes(k)} onClick={() => toggle("formats", k)} testId={`lib-format-${k}`}>{t(l)} <span style={{ opacity: 0.7 }}>{cFormat[k] || 0}</span></PillBtn>)}
      </Group>
      <Group title={t("Jugadores")}>
        {PLAYER_RANGES.map((r) => <PillBtn key={r.id} on={f.players.includes(r.id)} onClick={() => toggle("players", r.id)} testId={`lib-players-${r.id}`}>{PLAYER_LABELS[r.id]}</PillBtn>)}
      </Group>
      <Group title={t("Duración")}>
        {DURATION_RANGES.map((r) => <PillBtn key={r.id} on={f.durations.includes(r.id)} onClick={() => toggle("durations", r.id)} testId={`lib-dur-${r.id}`}>{DURATION_LABELS[r.id]}</PillBtn>)}
      </Group>
      {nActive > 0 && <div style={{ padding: "8px 12px", borderTop: "1px solid #F3EEEE" }}><button type="button" onClick={() => setF(EMPTY_LIB_FILTERS)} style={{ background: "none", border: 0, padding: 0, fontSize: 12, fontWeight: 700, color: RS.granate }} data-testid="lib-clear">{t("Limpiar filtros")}</button></div>}
    </section>
  );

  const tcard = (task) => {
    const phase = getSessionPhase(task.session_phase);
    const moment = getGameMoment(task.game_moment);
    const u = uses.get(task.id);
    const on = selId === task.id;
    return (
      <button key={task.id} type="button" onClick={() => setSelId(on ? null : task.id)} data-testid={`lib-card-${task.id}`}
        style={{ textAlign: "left", padding: 0, background: "#fff", border: on ? `2px solid ${RS.naranja}` : `1px solid ${RS.line}`, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 3, background: phase.color }} />
        <Thumb task={task} />
        <div style={{ padding: "8px 10px", borderTop: "1px solid #F3EEEE", display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
          <b style={{ fontSize: 13, color: RS.granate, lineHeight: 1.2 }}>{task.name}</b>
          <div style={{ fontSize: 10.5, letterSpacing: ".05em", textTransform: "uppercase", color: RS.muted }}>
            {[t(phase.label), task.duration_minutes ? `${task.duration_minutes}’` : "", task.players_count ? t("{n} jug.", { n: task.players_count }) : "", task.space].filter(Boolean).join(" · ")}
          </div>
          <div className="flex flex-wrap items-center" style={{ gap: 4, marginTop: "auto", paddingTop: 4 }}>
            {task.game_moment && task.game_moment !== "ninguno" && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: moment.bg, color: moment.color }}>{t(moment.label)}</span>}
            <span style={{ fontSize: 11, color: RS.muted, marginLeft: "auto" }}>{task.author_id && task.author_id === user?.id ? `${t("Tuya")} · ` : ""}<b style={{ color: RS.ink2 }}>{u?.count || 0}</b> {t("sesiones")}</span>
          </div>
        </div>
      </button>
    );
  };

  const quick = sel && (
    <Box title={sel.name} testId="lib-quick" right={<button type="button" onClick={() => setSelId(null)} aria-label={t("Cerrar")} style={{ background: "none", border: 0, color: RS.muted }}><X className="w-4 h-4" /></button>}>
      {hasBoard(sel.board) && <div style={{ position: "relative" }}><Thumb task={sel} height={210} /><BoardDownloads board={sel.board} filename={sel.name} compact className="absolute right-1.5 top-1.5 bg-white/90 rounded-md p-0.5" /></div>}
      {!hasBoard(sel.board) && sel.diagram_url && <Thumb task={sel} height={210} />}
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
        <div className="flex flex-wrap" style={{ gap: 5 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: "#FDF2F4", color: RS.granate }}>{t(getSessionPhase(sel.session_phase).label)}</span>
          {sel.game_moment && sel.game_moment !== "ninguno" && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: getGameMoment(sel.game_moment).bg, color: getGameMoment(sel.game_moment).color }}>{t(getGameMoment(sel.game_moment).label)}</span>}
          {sel.football_format && sel.football_format !== "ambos" && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: RS.soft, color: RS.ink2 }}>{sel.football_format.toUpperCase()}</span>}
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: `${getDifficulty(sel.difficulty).color}18`, color: getDifficulty(sel.difficulty).color }}>{t(getDifficulty(sel.difficulty).label)}</span>
        </div>
        <div style={{ color: RS.ink2 }}>{[sel.duration_minutes ? `${sel.duration_minutes}’` : "", sel.players_count ? t("{n} jugadores", { n: sel.players_count }) : "", sel.space].filter(Boolean).join(" · ")}</div>
        {sel.description && <div><div style={lab}>{t("Descripción")}</div><div style={{ color: RS.ink2, marginTop: 3, whiteSpace: "pre-line", maxHeight: 120, overflow: "hidden" }}>{sel.description}</div></div>}
        {(() => {
          const c = libraryContents(sel);
          if (!c.principal.length && !c.secondary.length) return null;
          return (
            <div><div style={lab}>{t("Contenidos que trabaja")}</div>
              <div className="flex flex-wrap" style={{ gap: 4, marginTop: 4 }}>
                {c.principal.map((id) => <ContentTag key={id} id={id} custom={c.custom_contents} />)}
                {c.secondary.map((id) => <ContentTag key={id} id={id} sec custom={c.custom_contents} />)}
              </div>
            </div>
          );
        })()}
        {(sel.principles || sel.sub_principles) && <div><div style={lab}>{t("Principios")}</div><div style={{ color: RS.ink2, marginTop: 3 }}>{[sel.principles, sel.sub_principles].filter(Boolean).join(" · ")}</div></div>}
        {sel.variants && <div><div style={lab}>{t("Variantes")}</div><div style={{ color: RS.ink2, marginTop: 3, whiteSpace: "pre-line" }}>{sel.variants}</div></div>}
        <div style={{ fontSize: 11.5, color: RS.muted }}>
          {uses.get(sel.id)?.count ? t("Usada en {n} sesiones · la última, {e} el {f}", { n: uses.get(sel.id).count, e: teamName(uses.get(sel.id).last.team_id), f: longDate(uses.get(sel.id).last.date) }) : t("Todavía no se ha usado en ninguna sesión")}
          {sel.author_name ? ` · ${t("creada por {n}", { n: sel.author_name })}` : ""}
        </div>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          <button type="button" style={btnStyle(true)} onClick={() => setAddTask(sel)} data-testid="lib-add-open"><Plus className="w-3.5 h-3.5" /> {t("Añadir a una sesión")}</button>
          <button type="button" style={btnStyle(false)} onClick={() => { setEditingTask(sel); setDialogOpen(true); }} data-testid="lib-edit">{t("Editar")}</button>
          <button type="button" style={btnStyle(false)} onClick={() => duplicate(sel)} data-testid="lib-dup">{t("Duplicar")}</button>
          <button type="button" style={btnStyle(false, { color: "#B91C1C" })} onClick={() => remove(sel)} data-testid="lib-del">{t("Borrar")}</button>
        </div>
      </div>
    </Box>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : sel ? "230px minmax(0,1fr) 340px" : "230px minmax(0,1fr)", gap: 12, alignItems: "start" }}>
        {isMobile ? (
          <div>
            <button type="button" style={btnStyle(false)} onClick={() => setShowFilters((v) => !v)} data-testid="lib-filters-toggle">{t("Filtros")}{nActive ? ` · ${nActive}` : ""}</button>
            {showFilters && <div style={{ marginTop: 8 }}>{filtersCard}</div>}
          </div>
        ) : filtersCard}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
            <b style={{ fontSize: 13 }} data-testid="lib-count">{t("{n} tareas", { n: filtered.length })}</b>
            <span style={{ marginLeft: "auto" }} className="flex items-center gap-2">
              <Seg options={[["recent", t("Recientes")], ["used", t("Más usadas")], ["az", t("A–Z")]]} value={sortBy} onChange={setSortBy} testPrefix="lib-sort" />
              <button type="button" style={btnStyle(true)} onClick={() => { setEditingTask(null); setDialogOpen(true); }} data-testid="lib-new"><Plus className="w-4 h-4" /> {t("Nueva tarea")}</button>
            </span>
          </div>
          {isMobile && quick}
          {isLoading ? <p style={{ padding: 20, textAlign: "center", color: RS.muted }}>{t("Cargando…")}</p> : filtered.length === 0 ? (
            <div style={{ ...card, padding: 28, textAlign: "center", fontSize: 13, color: RS.muted }}>
              {tasks.length ? t("Ninguna tarea con estos filtros.") : t("No hay tareas en la biblioteca. Crea la primera o guárdala desde una sesión («Guardar en la biblioteca»).")}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 150 : 200}px, 1fr))`, gap: 10 }}>{filtered.slice(0, 120).map(tcard)}</div>
          )}
          {filtered.length > 120 && <p style={{ fontSize: 11.5, color: RS.muted }}>{t("Se ven las 120 primeras: usa los filtros para encontrar el resto.")}</p>}
        </div>
        {!isMobile && quick}
      </div>

      <TaskFormDialog open={dialogOpen} onOpenChange={setDialogOpen} task={editingTask} onSave={handleSave} teams={teams} />
      <AddToSessionDialog task={addTask} open={!!addTask} onOpenChange={(o) => !o && setAddTask(null)} sessions={sessions} teams={teams} me={user?.id} />
    </div>
  );
}
