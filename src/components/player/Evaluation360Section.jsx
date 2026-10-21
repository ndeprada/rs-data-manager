import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AREAS, areasFor, computeAverages, scoreColor } from "@/lib/eval360";
import { playerFirstName } from "@/lib/playerName";
import { VisibilityField, VisibilityBadge } from "@/components/player/VisibilityToggle";
import { usePlayerMode } from "@/lib/playerMode";
import F7PositionGuide from "@/components/player/F7PositionGuide";
import { stageOf, f7Info } from "@/lib/f7Positions";
import { getPositionList } from "@/lib/playerPositions";
import { isF7Team } from "@/lib/teamOrder";

function currentQuarter() {
  const d = new Date();
  return `${d.getFullYear()} T${Math.floor(d.getMonth() / 3) + 1}`;
}
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ visible: null, date: today(), period: currentQuarter(), evaluator: "", scores: {}, strengths: "", improve: "", notes: "" });

function AreaBars({ avg }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {AREAS.map((a) => (
        <div key={a.key}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs text-gray-500">{a.label}</span>
            <span className="text-sm font-black" style={{ color: scoreColor(avg[a.key]) }}>{avg[a.key] ?? "—"}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(avg[a.key] || 0) * 10}%`, background: scoreColor(avg[a.key]) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ScoreRow({ label, hint, value, onChange }) {
  return (
    <div className="py-2 border-b border-gray-100 last:border-b-0">
      <p className="text-sm text-gray-800">{label}</p>
      {hint && <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{hint}</p>}
      <div className="mb-1.5" />
      <div className="flex gap-1 flex-wrap">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(active ? null : n)}
              className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors ${active ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
              style={active ? { background: scoreColor(n) } : {}}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EvalCard({ ev, areas, onEdit, onDelete, onToggleVisible, readOnly }) {
  const [open, setOpen] = useState(false);
  const avg = computeAverages(ev.scores, areas);
  // Notas de criterios que ya no existen para este puesto (se conservan, pero no cuentan en la media)
  const legacy = areas.some((a) => Object.keys(ev.scores?.[a.key] || {}).some((id) => !a.items.some((it) => it.id === id)));
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50" onClick={() => setOpen(!open)}>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{ev.period || "Evaluación"}</p>
          <p className="text-xs text-gray-400">
            {ev.date ? new Date(ev.date).toLocaleDateString("es-ES") : ""}{ev.evaluator ? ` · ${ev.evaluator}` : ""}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          {AREAS.map((a) => (
            <span key={a.key} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100" style={{ color: scoreColor(avg[a.key]) }} title={a.label}>
              {a.label.slice(0, 3)} {avg[a.key] ?? "—"}
            </span>
          ))}
        </div>
        <span className="text-sm font-black px-2.5 py-1 rounded-full text-white" style={{ background: scoreColor(avg.overall) }}>{avg.overall ?? "—"}</span>
        {!readOnly && <VisibilityBadge value={ev.visible_to_player} onToggle={(v) => onToggleVisible(ev, v)} />}
        {!readOnly && <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onEdit(ev)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => onDelete(ev.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>}
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </div>
      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {areas.map((a) => {
              const rated = a.items.filter((it) => ev.scores?.[a.key]?.[it.id]);
              if (!rated.length) return null;
              return (
                <div key={a.key}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{a.label} · {avg[a.key]}{a.pendingReview && <span className="ml-1.5 normal-case tracking-normal text-orange-600">(en revisión)</span>}</p>
                  <div className="space-y-1">
                    {rated.map((it) => {
                      const v = ev.scores[a.key][it.id];
                      return (
                        <div key={it.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-gray-700">{it.label}</span>
                          <span className="font-bold shrink-0 w-6 text-center rounded text-white" style={{ background: scoreColor(v) }}>{v}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {legacy && <p className="text-[11px] text-gray-400">Evaluación hecha con criterios anteriores de este puesto: las notas que ya no existen se conservan, pero no cuentan en las medias.</p>}
          {[["Puntos fuertes", ev.strengths], ["A mejorar", ev.improve], ["Observaciones", ev.notes]].map(([t, v]) => v ? (
            <div key={t}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{t}</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{v}</p>
            </div>
          ) : null)}
        </div>
      )}
    </div>
  );
}

export default function Evaluation360Section({ player, playerId, team }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [tab, setTab] = useState("tecnica");
  const [visError, setVisError] = useState(false);
  const playerMode = usePlayerMode();
  const areas = areasFor(player.position);
  // En fútbol 7 se muestran las cualidades y los contenidos de sus posiciones mientras se valora
  const isF7 = stageOf(player, team ? isF7Team(team) : false) === "f7";
  const hasF7Position = getPositionList(player).some((x) => f7Info(x.position));

  const { data: evals = [], isLoading } = useQuery({
    queryKey: ["eval360", playerId],
    queryFn: () => base44.entities.Evaluation360.filter({ player_id: playerId }, "-date"),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["eval360", playerId] });

  const save = useMutation({
    mutationFn: (data) => (editing ? base44.entities.Evaluation360.update(editing.id, data) : base44.entities.Evaluation360.create({ ...data, player_id: playerId })),
    onSuccess: () => { refresh(); close(); },
  });
  const toggleVisible = useMutation({
    mutationFn: ({ id, v }) => base44.entities.Evaluation360.update(id, { visible_to_player: v }),
    onSuccess: refresh,
  });
  const del = useMutation({
    mutationFn: (id) => base44.entities.Evaluation360.delete(id),
    onSuccess: () => { refresh(); setDeleteId(null); },
  });

  const close = () => { setVisError(false); setOpen(false); setEditing(null); setForm(emptyForm()); setTab("tecnica"); };
  const openNew = () => { setEditing(null); setForm(emptyForm()); setTab("tecnica"); setOpen(true); };
  const openEdit = (ev) => {
    setEditing(ev);
    setForm({ visible: ev.visible_to_player ?? null, date: ev.date || today(), period: ev.period || "", evaluator: ev.evaluator || "", scores: ev.scores || {}, strengths: ev.strengths || "", improve: ev.improve || "", notes: ev.notes || "" });
    setTab("tecnica");
    setOpen(true);
  };

  const setScore = (area, id, v) => {
    setForm((f) => {
      const area_scores = { ...(f.scores[area] || {}) };
      if (v == null) delete area_scores[id]; else area_scores[id] = v;
      return { ...f, scores: { ...f.scores, [area]: area_scores } };
    });
  };

  const submit = (e) => {
    e.preventDefault();
    if (form.visible == null) { setVisError(true); setTab("cierre"); return; }
    const avg = computeAverages(form.scores, areas);
    save.mutate({
      visible_to_player: form.visible,
      date: form.date, period: form.period, evaluator: form.evaluator, scores: form.scores,
      strengths: form.strengths, improve: form.improve, notes: form.notes,
      avg_tecnica: avg.tecnica, avg_tactica: avg.tactica, avg_fisica: avg.fisica, avg_mental: avg.mental, overall: avg.overall,
    });
  };

  const live = computeAverages(form.scores, areas);
  const latest = evals[0];
  const latestAvg = latest ? computeAverages(latest.scores, areas) : null;
  const tabs = [...areas.map((a) => ({ key: a.key, label: a.label, pending: !!a.pendingReview })), { key: "cierre", label: "Cierre" }];
  const curArea = areas.find((a) => a.key === tab);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--granate-pale, #fdf2f4)" }}>
            <Radar className="w-5 h-5" style={{ color: "var(--granate)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900">Evaluación 360</h3>
            <p className="text-sm text-gray-500">Perfil general de <strong>{playerFirstName(player)}</strong>: técnica, táctica, física y mental (1-10). Es el punto de partida; el trabajo concreto se planifica en el plan de desarrollo.</p>
          </div>
          </div>
          {!playerMode && <Button variant="club" onClick={openNew} className="shrink-0 w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" /> Nueva evaluación
          </Button>}
        </div>
        {latestAvg && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Última evaluación · {latest.period || ""}</p>
              <span className="text-sm font-black px-2.5 py-1 rounded-full text-white" style={{ background: scoreColor(latestAvg.overall) }}>Media {latestAvg.overall ?? "—"}</span>
            </div>
            <AreaBars avg={latestAvg} />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-gray-400">Cargando...</div>
      ) : evals.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
          <p className="text-gray-500 font-medium">Aún no hay evaluaciones 360</p>
          <p className="text-gray-400 text-sm mt-1">Crea la primera para tener el perfil básico del jugador.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {evals.map((ev) => <EvalCard key={ev.id} ev={ev} areas={areas} onEdit={openEdit} onDelete={setDeleteId} readOnly={playerMode} onToggleVisible={(e, v) => toggleVisible.mutate({ id: e.id, v })} />)}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="bg-white border-gray-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-gray-900">{editing ? "Editar evaluación 360" : "Nueva evaluación 360"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700">Fecha *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="border-gray-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-700">Periodo</Label>
                <Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="border-gray-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-700">Evaluador</Label>
                <Input value={form.evaluator} onChange={(e) => setForm({ ...form, evaluator: e.target.value })} className="border-gray-200" />
              </div>
            </div>

            <VisibilityField value={form.visible} onChange={(v) => setForm({ ...form, visible: v })} error={visError} />

            {isF7 && (hasF7Position
              ? <F7PositionGuide player={player} className="rounded-xl border border-gray-100 p-3" />
              : <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">Aún no tiene posición de fútbol 7. En «Editar» del perfil puedes elegirla (portero, lateral, central, mediapunta o extremo) y aquí verás sus cualidades y los contenidos a trabajar.</p>)}

            <div className="flex gap-1 border-b border-gray-100 overflow-x-auto">
              {tabs.map((t) => {
                const v = t.key === "cierre" ? null : live[t.key];
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`px-3 py-2 text-sm font-semibold border-b-2 whitespace-nowrap ${tab === t.key ? "border-[#73000A] text-[#73000A]" : "border-transparent text-gray-500"}`}
                  >
                    {t.label}{t.pending ? <span className="ml-1 text-[10px] font-semibold text-orange-600" title="Ítems pendientes de revisión">· en revisión</span> : null}{v != null ? <span className="ml-1.5 text-xs font-black" style={{ color: scoreColor(v) }}>{v}</span> : null}
                  </button>
                );
              })}
            </div>

            {curArea && (
              <div>
                <p className="text-xs text-gray-400 mb-1">{curArea.hint}. Toca una nota; vuelve a tocarla para quitarla.</p>
                {curArea.pendingReview && (
                  <p className="text-[11px] text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 my-2">
                    Ítems pendientes de revisión: lista provisional basada en las competencias del portero. Pueden cambiar.
                  </p>
                )}
                {curArea.items.map((it) => (
                  <ScoreRow key={it.id} label={it.label} hint={it.competency} value={form.scores[curArea.key]?.[it.id] ?? null} onChange={(v) => setScore(curArea.key, it.id, v)} />
                ))}
              </div>
            )}

            {tab === "cierre" && (
              <div className="space-y-3">
                <div className="rounded-xl bg-gray-50 p-3"><AreaBars avg={live} /><p className="text-sm text-gray-600 mt-3">Media global: <strong style={{ color: scoreColor(live.overall) }}>{live.overall ?? "—"}</strong></p></div>
                <div className="space-y-1.5">
                  <Label className="text-gray-700">Puntos fuertes (al menos tres)</Label>
                  <Textarea rows={3} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} className="border-gray-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-700">Áreas de mejora (dos o tres)</Label>
                  <Textarea rows={3} value={form.improve} onChange={(e) => setForm({ ...form, improve: e.target.value })} className="border-gray-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-700">Observaciones</Label>
                  <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-gray-200" />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
              <Button variant="club" type="submit" disabled={save.isPending}>{editing ? "Guardar" : "Crear evaluación"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evaluación?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
