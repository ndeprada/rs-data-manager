import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT, useFormat } from "@/i18n";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { TRAINING_TYPES } from "@/lib/trainingStatus";
import { isCancelled } from "@/lib/eventCancel";
import { SESSION_TYPES, sessionTypeInfo, stageOfTeamName, stageInfo, blockInfo, fmtMin } from "@/lib/sessionPlan";
import {
  OBS_SCALE, OBS_BLOCKS, NOT_OBSERVABLE, NOT_OBSERVABLE_LABEL, scaleInfo, emptyScores, emptyNotes, obsSummary, avgColor,
  sinceDate, coachIndicators,
} from "@/lib/coachMethod";

const FONT = { fontFamily: "var(--font-display)" };
const NONE = "__none";
const PERIODS = [
  { id: "season", label: "Toda la temporada" },
  { id: "30", label: "Últimos 30 días" },
  { id: "7", label: "Últimos 7 días" },
];

const dayOf = (v) => String(v || "").slice(0, 10);
const todayStr = () => format(new Date(), "yyyy-MM-dd");
const endedByNow = (ev) => {
  const end = ev.end_date ? new Date(ev.end_date) : new Date(new Date(ev.date).getTime() + 2 * 3600 * 1000);
  return end < new Date();
};

function Tile({ label, value, sub, color }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 truncate">{label}</p>
      <p className="text-xl font-black leading-tight" style={{ ...FONT, color: color || "var(--granate)" }}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 leading-snug">{sub}</p>}
    </div>
  );
}

// ── Datos de las sesiones que registra el entrenador ─────────────────────────
function SessionData({ ownerUserId, teamIds }) {
  const t = useT();
  const [teamId, setTeamId] = useState("");
  const [period, setPeriod] = useState("season");

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: allSessions = [], isLoading } = useQuery({
    queryKey: ["coach_sessions"], queryFn: () => base44.entities.CoachSession.list("-date", 1000), enabled: !!ownerUserId,
  });

  const today = todayStr();
  const from = sinceDate(period, today);
  const mine = useMemo(
    () => allSessions.filter((s) => s.owner_id === ownerUserId && s.held !== false && s.date <= today && (!s.season || s.season === CURRENT_SEASON)),
    [allSessions, ownerUserId, today]
  );
  const coachTeams = useMemo(() => teams.filter((x) => teamIds.includes(x.id)), [teams, teamIds]);
  const withSessions = useMemo(() => new Set(mine.map((s) => s.team_id)), [mine]);
  const team = coachTeams.find((x) => x.id === teamId) || coachTeams.find((x) => withSessions.has(x.id)) || coachTeams[0] || null;

  const stage = (team && stageOfTeamName(team.name)) || mine.find((s) => s.team_id === team?.id && s.stage)?.stage || null;
  const info = stageInfo(stage);
  const sessions = useMemo(() => mine.filter((s) => s.team_id === team?.id && (!from || s.date >= from)), [mine, team?.id, from]);
  const trainings = useMemo(
    () => events.filter((e) => e.team_id === team?.id && TRAINING_TYPES.includes(e.type) && !isCancelled(e) && e.date
      && dayOf(e.date) <= today && (!from || dayOf(e.date) >= from) && endedByNow(e)),
    [events, team?.id, from, today]
  );
  const ind = useMemo(() => coachIndicators({ sessions, trainings, stage }), [sessions, trainings, stage]);
  const nBlocks = ind.blocks.ok + ind.blocks.revisar + ind.blocks.alerta;
  const worst = ind.blocks.outside.slice(0, 2);
  const pctText = (p) => (p == null ? "—" : `${p} %`);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-black uppercase" style={{ ...FONT, color: "var(--granate)" }}>{t("Datos de sus sesiones")}</h3>
          <p className="text-xs text-gray-400">{t("Lo que el entrenador planifica y registra en la app. La observación recoge lo que hace en el campo.")}</p>
        </div>
        <div className="flex gap-2">
          {coachTeams.length > 1 && (
            <Select value={team?.id || ""} onValueChange={setTeamId}>
              <SelectTrigger className="w-44 h-8 text-xs border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>{coachTeams.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44 h-8 text-xs border-gray-200"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODS.map((p) => <SelectItem key={p.id} value={p.id}>{t(p.label)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {!ownerUserId ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-center text-sm text-gray-500">{t("Esta persona aún no tiene acceso a la app, así que no hay sesiones registradas.")}</div>
      ) : isLoading || !team ? (
        <p className="text-sm text-gray-400 py-4 text-center">{isLoading ? t("Cargando…") : t("Este entrenador no tiene equipos asignados.")}</p>
      ) : (
        <>
          <p className="text-[11px] text-gray-500">
            {info ? t("Etapa {stage} ({teams}).", { stage: info.label, teams: info.teams }) : <span className="text-amber-600 font-semibold">{t("No se reconoce la etapa de este equipo: no se compara con la referencia.")}</span>}
            {" "}{t("Cuentan las sesiones ya hechas y marcadas como realizadas.")}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Tile label={t("Sesiones registradas")} value={ind.trainings ? `${ind.withSession}/${ind.trainings}` : String(ind.sessions)}
              sub={ind.trainings ? t("{pct} de los entrenamientos", { pct: pctText(ind.pctSessions) }) : t("No hay entrenamientos celebrados en el periodo")} />
            <Tile label={t("Reparto por bloques")} value={nBlocks ? `${ind.blocks.ok}/${nBlocks}` : "—"}
              color={!nBlocks ? "#9ca3af" : ind.blocks.alerta ? "#dc2626" : ind.blocks.revisar ? "#d97706" : "#16a34a"}
              sub={!nBlocks ? t("Sin tiempo registrado con contenido") : worst.length
                ? worst.map((w) => `${blockInfo(w.block)?.short || w.block} ${w.diff > 0 ? "+" : "−"}${Math.abs(w.diff)}`).join(" · ")
                : t("Dentro del margen de la etapa")} />
            <Tile label={t("Jerarquía alta > media > baja")} value={!ind.hasData || !info ? "—" : ind.hierarchy ? String(ind.hierarchy) : t("Coherente")}
              color={!ind.hasData || !info ? "#9ca3af" : ind.hierarchy ? "#d97706" : "#16a34a"} sub={ind.hierarchy ? t("Avisos. Detalle en Metodología → Control de contenidos") : t("Detalle en Metodología → Control de contenidos")} />
            <Tile label={t("Tiempo registrado")} value={ind.hasData ? fmtMin(ind.minutes) : "—"} sub={t("Sesiones: {n} · Tareas: {m}", { n: ind.sessions, m: ind.tasks })} />
            <Tile label={t("Partido final")} value={ind.finalGame.sessions ? `${ind.finalGame.withFinal}/${ind.finalGame.sessions}` : "—"}
              sub={ind.finalGame.avgMin != null ? t("Media {min} ({pct} % de la sesión)", { min: fmtMin(ind.finalGame.avgMin), pct: ind.finalGame.avgPct }) : t("Sesiones con partido al final")} />
            <Tile label={t("Correcciones escritas")} value={pctText(ind.corrections.pct)}
              sub={ind.corrections.tasks ? t("Tareas: {n} de {m}", { n: ind.corrections.withText, m: ind.corrections.tasks }) : t("Tareas con correcciones")} />
            <Tile label={t("Parte inicial con técnica u hábitos")} value={pctText(ind.initial.pct)}
              sub={ind.initial.sessions ? t("Sesiones: {n} de {m}", { n: ind.initial.withTechHabits, m: ind.initial.sessions }) : t("Sesiones con parte inicial")} />
            <Tile label={t("Contenidos de la etapa")} value={pctText(ind.curriculum.pct)}
              sub={ind.curriculum.tasks ? (ind.curriculum.outside ? t("Tareas con contenido de otra etapa: {n}", { n: ind.curriculum.outside }) : t("Todo dentro del currículo")) : t("Tareas con contenido")} />
          </div>
          {!ind.hasData && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-center text-sm text-gray-500">{t("No hay sesiones registradas de este equipo en el periodo elegido.")}</div>
          )}
          <p className="text-[10px] text-gray-400">{t("Partido final = última tarea de la parte principal si es de tipo partido, minipartido o partido reducido.")}</p>
        </>
      )}
    </section>
  );
}

// ── Observación de sesión ────────────────────────────────────────────────────
function ScorePill({ value }) {
  const t = useT();
  if (value == null) return <span className="w-6 h-6 rounded-full border border-dashed border-gray-300 shrink-0" title={t("Sin valorar")} />;
  if (value === NOT_OBSERVABLE) return <span className="min-w-6 h-6 px-1 rounded-full bg-gray-100 text-gray-500 text-[9px] font-black flex items-center justify-center shrink-0" title={t(NOT_OBSERVABLE_LABEL)}>{t("N/O")}</span>;
  const s = scaleInfo(value);
  return <span className="w-6 h-6 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0" style={{ background: s.color }} title={`${value} · ${t(s.label)}`}>{value}</span>;
}

function ObsView({ obs, teamName }) {
  const t = useT();
  const { num, locale } = useFormat();
  const sum = obsSummary(obs.scores);
  const avg = (n) => (n == null ? "—" : num(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const type = sessionTypeInfo(obs.session_type);
  const lines = (obs.agreements || "").split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{t("Media")}</p>
          <p className="text-3xl font-black leading-none" style={{ ...FONT, color: avgColor(sum.overall) }}>{avg(sum.overall)}</p>
          <p className="text-[10px] text-gray-400">{t("sobre 4")}</p>
        </div>
        <div className="text-sm text-gray-600 space-y-0.5">
          <p>
            {teamName ? <span className="font-bold text-gray-800">{teamName}</span> : null}
            {obs.date ? ` · ${format(new Date(`${obs.date}T12:00:00`), "d MMM yyyy", { locale })}` : ""}
            {type ? ` · ${type.label} (${type.full})` : ""}
          </p>
          <p className="text-xs text-gray-400">
            {obs.author_name ? t("Por {name}", { name: obs.author_name }) + " · " : ""}
            {t("Criterios valorados: {n} de {m}", { n: sum.answered, m: sum.total - sum.notObservable })}
            {sum.notObservable ? " · " + t("No observables: {n}", { n: sum.notObservable }) : ""}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {OBS_BLOCKS.map((b) => {
          const note = (obs.notes?.[b.key] || "").trim();
          return (
            <div key={b.key} className="bg-white border border-gray-200 overflow-hidden" style={{ borderRadius: 2 }}>
              <div className="flex items-center justify-between text-white px-3 py-1.5" style={{ background: b.color }}>
                <span className="text-sm font-black uppercase" style={FONT}>{t(b.label)}</span>
                <span className="text-sm font-black tabular-nums">{avg(sum.blocks[b.key].avg)}</span>
              </div>
              <ul className="divide-y divide-gray-100">
                {b.criteria.map((c) => (
                  <li key={c.key} className="flex items-start justify-between gap-2 px-3 py-2">
                    <span className="text-sm text-gray-700 leading-snug">{t(c.label)}</span>
                    <ScorePill value={obs.scores?.[c.key] ?? null} />
                  </li>
                ))}
              </ul>
              {note && <p className="px-3 py-2 text-sm text-gray-500 italic border-t border-gray-100 bg-gray-50/60 whitespace-pre-line">{note}</p>}
            </div>
          );
        })}
        <div className="bg-white border border-gray-200 overflow-hidden" style={{ borderRadius: 2 }}>
          <div className="text-white px-3 py-1.5 bg-[var(--granate)]"><span className="text-sm font-black uppercase" style={FONT}>{t("Acuerdos de mejora")}</span></div>
          {lines.length === 0 ? <p className="px-3 py-3 text-xs text-gray-300">—</p> : (
            <ul className="px-3 py-2 space-y-1">
              {lines.map((l, i) => <li key={i} className="text-sm text-gray-700 leading-snug flex gap-1.5"><span style={{ color: "var(--naranja)" }}>•</span><span>{l}</span></li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ScaleLegend() {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
      {OBS_SCALE.map((s) => (
        <span key={s.value} className="inline-flex items-center gap-1" title={t(s.hint)}>
          <span className="w-4 h-4 rounded-full text-white text-[10px] font-black inline-flex items-center justify-center" style={{ background: s.color }}>{s.value}</span>{t(s.label)}
        </span>
      ))}
      <span className="inline-flex items-center gap-1"><span className="px-1 h-4 rounded-full bg-gray-100 text-gray-500 text-[9px] font-black inline-flex items-center">{t("N/O")}</span>{t(NOT_OBSERVABLE_LABEL)}</span>
    </div>
  );
}

const newForm = (teamId) => ({ date: todayStr(), team_id: teamId || "", session_type: "", scores: emptyScores(), notes: emptyNotes(), agreements: "" });

export default function CoachMethodSection({ staffId, ownerUserId, teamIds = [], canEvaluate, canSeeData, isOwnProfile, author }) {
  const t = useT();
  const { locale, num } = useFormat();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(newForm(""));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: all = [] } = useQuery({
    queryKey: ["coachSessionObs", staffId],
    queryFn: () => base44.entities.CoachSessionObs.filter({ staff_id: staffId }),
    enabled: !!staffId,
  });
  const teamName = (id) => teams.find((x) => x.id === id)?.name || "";

  const list = useMemo(
    () => all.filter((o) => canEvaluate || o.status === "publicada").sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [all, canEvaluate]
  );
  const current = list.find((o) => o.id === selectedId) || list[0] || null;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["coachSessionObs", staffId] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        staff_id: staffId, team_id: form.team_id || null, date: form.date || todayStr(), session_type: form.session_type || "",
        scores: form.scores, notes: form.notes, agreements: form.agreements,
        season: editing?.season || CURRENT_SEASON,
        author_id: editing?.author_id || author?.id || "", author_name: editing?.author_name || author?.name || "",
      };
      if (!editing) data.status = "borrador";
      return editing ? base44.entities.CoachSessionObs.update(editing.id, data) : base44.entities.CoachSessionObs.create(data);
    },
    onSuccess: (res) => { invalidate(); setSelectedId(res?.id || editing?.id); setOpen(false); setEditing(null); },
  });
  const publishMutation = useMutation({
    mutationFn: (o) => base44.entities.CoachSessionObs.update(o.id, o.status === "publicada" ? { status: "borrador", published_at: null } : { status: "publicada", published_at: new Date().toISOString() }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (o) => base44.entities.CoachSessionObs.delete(o.id),
    onSuccess: () => { invalidate(); setSelectedId(null); setOpen(false); setEditing(null); setConfirmDelete(false); },
  });

  const openCreate = () => { setEditing(null); setConfirmDelete(false); setForm(newForm(teamIds[0] || "")); setOpen(true); };
  const openEdit = (o) => {
    setEditing(o); setConfirmDelete(false);
    setForm({
      date: o.date || todayStr(), team_id: o.team_id || "", session_type: o.session_type || "",
      scores: { ...emptyScores(), ...(o.scores || {}) }, notes: { ...emptyNotes(), ...(o.notes || {}) }, agreements: o.agreements || "",
    });
    setOpen(true);
  };
  const setScore = (key, value) => setForm((f) => ({ ...f, scores: { ...f.scores, [key]: f.scores[key] === value ? null : value } }));
  const setNote = (key, text) => setForm((f) => ({ ...f, notes: { ...f.notes, [key]: text } }));
  const formSum = obsSummary(form.scores);
  const avgText = (n) => (n == null ? "—" : num(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-black uppercase" style={{ ...FONT, color: "var(--granate)" }}>{t("Metodología")}</h2>
          <p className="text-xs text-gray-400">{t("Cómo aplica el método del club en las sesiones: lo que registra y lo que se observa en el campo.")}</p>
        </div>
        {canEvaluate && (
          <Button variant="club" size="sm" onClick={openCreate} className="text-xs"><Plus className="w-3.5 h-3.5 mr-1" /> {t("Nueva observación")}</Button>
        )}
      </div>

      {canSeeData && <SessionData ownerUserId={ownerUserId} teamIds={teamIds} />}

      <section className="space-y-2">
        <h3 className="text-base font-black uppercase" style={{ ...FONT, color: "var(--granate)" }}>{t("Observaciones de sesión")}</h3>
        {list.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
            <p className="text-gray-400 text-sm">{canEvaluate ? t("Aún no hay observaciones de sesión de este entrenador") : isOwnProfile ? t("Todavía no hay observaciones publicadas") : t("No hay observaciones")}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {list.map((o) => {
                const avg = obsSummary(o.scores).overall;
                const active = current?.id === o.id;
                return (
                  <button key={o.id} onClick={() => setSelectedId(o.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${active ? "text-white border-transparent" : "text-gray-600 border-gray-200 bg-white hover:bg-gray-50"}`}
                    style={active ? { background: "var(--granate)" } : undefined}>
                    {o.date ? format(new Date(`${o.date}T12:00:00`), "d MMM", { locale }) : t("Observación")}
                    {o.team_id && teamIds.length > 1 ? ` · ${teamName(o.team_id)}` : ""}
                    {avg != null && <b className="ml-1.5">{avgText(avg)}</b>}
                    {canEvaluate && o.status !== "publicada" && " " + t("· borrador")}
                  </button>
                );
              })}
            </div>
            {current && (
              <>
                {canEvaluate && (
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => publishMutation.mutate(current)} className="text-xs">
                      {current.status === "publicada" ? <><EyeOff className="w-3.5 h-3.5 mr-1" /> {t("Ocultar al entrenador")}</> : <><Eye className="w-3.5 h-3.5 mr-1" /> {t("Publicar al entrenador")}</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(current)} className="text-xs"><Pencil className="w-3.5 h-3.5 mr-1" /> {t("Editar")}</Button>
                  </div>
                )}
                <ObsView obs={current} teamName={teamName(current.team_id)} />
              </>
            )}
          </>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white border-gray-200 max-h-[92vh] overflow-y-auto max-w-3xl">
          <DialogHeader><DialogTitle>{editing ? t("Editar observación") : t("Nueva observación de sesión")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <div className="w-40">
                <p className="text-xs text-gray-500 mb-1">{t("Fecha")}</p>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border-gray-200" />
              </div>
              {teamIds.length > 0 && (
                <div className="w-48">
                  <p className="text-xs text-gray-500 mb-1">{t("Equipo")}</p>
                  <Select value={form.team_id || NONE} onValueChange={(v) => setForm({ ...form, team_id: v === NONE ? "" : v })}>
                    <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t("— Sin equipo —")}</SelectItem>
                      {teamIds.map((id) => <SelectItem key={id} value={id}>{teamName(id)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="w-56">
                <p className="text-xs text-gray-500 mb-1">{t("Tipo de sesión")}</p>
                <Select value={form.session_type || NONE} onValueChange={(v) => setForm({ ...form, session_type: v === NONE ? "" : v })}>
                  <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("— Sin indicar —")}</SelectItem>
                    {SESSION_TYPES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label} · {s.full}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <ScaleLegend />
              <p className="text-xs text-gray-500 whitespace-nowrap">{t("Media")}: <b style={{ color: avgColor(formSum.overall) }}>{avgText(formSum.overall)}</b></p>
            </div>

            {OBS_BLOCKS.map((b) => (
              <div key={b.key} className="space-y-1.5">
                <p className="text-sm font-black uppercase text-white px-3 py-1" style={{ ...FONT, background: b.color, borderRadius: 2 }}>{t(b.label)}</p>
                {b.criteria.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-2 flex-wrap border border-gray-100 rounded px-2.5 py-1.5">
                    <p className="text-sm text-gray-700 leading-snug flex-1 min-w-[12rem]">{t(c.label)}</p>
                    <div className="flex gap-1">
                      {OBS_SCALE.map((s) => {
                        const on = form.scores[c.key] === s.value;
                        return (
                          <button key={s.value} type="button" aria-pressed={on} title={`${s.value} · ${t(s.label)}`} onClick={() => setScore(c.key, s.value)}
                            className={`w-9 h-8 rounded text-sm font-black border transition-colors ${on ? "text-white border-transparent" : "text-gray-400 border-gray-200 bg-white hover:bg-gray-50"}`}
                            style={on ? { background: s.color } : undefined}>{s.value}</button>
                        );
                      })}
                      <button type="button" aria-pressed={form.scores[c.key] === NOT_OBSERVABLE} title={t(NOT_OBSERVABLE_LABEL)} onClick={() => setScore(c.key, NOT_OBSERVABLE)}
                        className={`px-1.5 h-8 rounded text-[10px] font-black border transition-colors ${form.scores[c.key] === NOT_OBSERVABLE ? "bg-gray-500 text-white border-transparent" : "text-gray-400 border-gray-200 bg-white hover:bg-gray-50"}`}>{t("N/O")}</button>
                    </div>
                  </div>
                ))}
                <Textarea rows={2} value={form.notes[b.key]} onChange={(e) => setNote(b.key, e.target.value)} placeholder={t("Observación breve…")} className="border-gray-200 text-sm" />
              </div>
            ))}

            <div className="space-y-1.5">
              <p className="text-sm font-black uppercase text-white px-3 py-1 bg-[var(--granate)]" style={{ ...FONT, borderRadius: 2 }}>{t("Acuerdos de mejora")}</p>
              <Textarea rows={3} value={form.agreements} onChange={(e) => setForm({ ...form, agreements: e.target.value })} placeholder={t("Una idea por línea…")} className="border-gray-200 text-sm" />
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-100">
              {editing && (confirmDelete
                ? <Button variant="outline" onClick={() => deleteMutation.mutate(editing)} className="text-red-600 border-red-200">{t("Confirmar borrado")}</Button>
                : <Button variant="outline" size="icon" onClick={() => setConfirmDelete(true)}><Trash2 className="w-4 h-4 text-gray-400" /></Button>)}
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setOpen(false)}>{t("Cancelar")}</Button>
              <Button variant="club" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? t("Guardando…") : t("Guardar")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
