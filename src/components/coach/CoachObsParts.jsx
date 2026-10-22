// Piezas de la observación por áreas de la Evaluación 360: valoración 1–4, vista de una observación, resumen del trimestre y formulario.
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT, useFormat } from "@/i18n";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { SESSION_TYPES, sessionTypeInfo } from "@/lib/sessionPlan";
import { OBS_SCALE, NOT_OBSERVABLE, NOT_OBSERVABLE_LABEL, scaleInfo, avgColor } from "@/lib/coachMethod";
import { areaBlocks, emptyAreaScores, emptyAreaNotes, areaSummary } from "@/lib/coachAreaCriteria";
import { areaInfo } from "@/lib/coachAreas";

const FONT = { fontFamily: "var(--font-display)" };
const NONE = "__none";
const todayStr = () => format(new Date(), "yyyy-MM-dd");

const useAvg = () => {
  const { num } = useFormat();
  return (n) => (n == null ? "—" : num(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
};

export function ScorePill({ value }) {
  const t = useT();
  if (value == null) return <span className="w-6 h-6 rounded-full border border-dashed border-gray-300 shrink-0" title={t("Sin valorar")} />;
  if (value === NOT_OBSERVABLE) return <span className="min-w-6 h-6 px-1 rounded-full bg-gray-100 text-gray-500 text-[9px] font-black flex items-center justify-center shrink-0" title={t(NOT_OBSERVABLE_LABEL)}>{t("N/O")}</span>;
  const s = scaleInfo(value);
  return <span className="w-6 h-6 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0" style={{ background: s.color }} title={`${value} · ${t(s.label)}`}>{value}</span>;
}

// Media (con decimales) de un criterio a lo largo de varias observaciones
function AvgPill({ value }) {
  const t = useT();
  const avg = useAvg();
  if (value == null) return <span className="w-6 h-6 rounded-full border border-dashed border-gray-300 shrink-0" title={t("Sin valorar")} />;
  return <span className="min-w-6 h-6 px-1.5 rounded-full text-white text-[11px] font-black tabular-nums flex items-center justify-center shrink-0" style={{ background: avgColor(value) }}>{avg(value)}</span>;
}

export function ScaleLegend() {
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

const gridCols = (blocks) => (blocks.length > 1 ? "lg:grid-cols-3" : "lg:grid-cols-2");

function AgreementsCard({ lines }) {
  const t = useT();
  return (
    <div className="bg-white border border-gray-200 overflow-hidden" style={{ borderRadius: 2 }}>
      <div className="text-white px-3 py-1.5 bg-[var(--granate)]"><span className="text-sm font-black uppercase" style={FONT}>{t("Acuerdos de mejora")}</span></div>
      {lines.length === 0 ? <p className="px-3 py-3 text-xs text-gray-300">—</p> : (
        <ul className="px-3 py-2 space-y-1">
          {lines.map((l, i) => (
            <li key={i} className="text-sm text-gray-700 leading-snug flex gap-1.5">
              <span style={{ color: "var(--naranja)" }}>•</span>
              <span>{l.date && <span className="text-[11px] text-gray-400 mr-1">{l.date}</span>}{l.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Una observación concreta
export function ObsView({ obs, area, teamName }) {
  const t = useT();
  const { locale } = useFormat();
  const avg = useAvg();
  const blocks = areaBlocks(area);
  const sum = areaSummary(obs.scores, area);
  const type = sessionTypeInfo(obs.session_type);
  const lines = (obs.agreements || "").split("\n").map((l) => l.trim()).filter(Boolean).map((text) => ({ text }));
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
            {obs.date ? `${teamName ? " · " : ""}${format(new Date(`${obs.date}T12:00:00`), "d MMM yyyy", { locale })}` : ""}
            {type ? ` · ${type.label} (${type.full})` : ""}
          </p>
          <p className="text-xs text-gray-400">
            {obs.author_name ? t("Por {name}", { name: obs.author_name }) + " · " : ""}
            {t("Criterios valorados: {n} de {m}", { n: sum.answered, m: sum.total - sum.notObservable })}
            {sum.notObservable ? " · " + t("No observables: {n}", { n: sum.notObservable }) : ""}
          </p>
        </div>
      </div>
      <div className={`grid grid-cols-1 ${gridCols(blocks)} gap-3`}>
        {blocks.map((b) => {
          const note = (obs.notes?.[b.key] || "").trim();
          return (
            <div key={b.key} className="bg-white border border-gray-200 overflow-hidden" style={{ borderRadius: 2 }}>
              {blocks.length > 1 && (
                <div className="flex items-center justify-between text-white px-3 py-1.5" style={{ background: b.color }}>
                  <span className="text-sm font-black uppercase" style={FONT}>{t(b.label)}</span>
                  <span className="text-sm font-black tabular-nums">{avg(sum.blocks[b.key].avg)}</span>
                </div>
              )}
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
        <AgreementsCard lines={lines} />
      </div>
    </div>
  );
}

// Resumen de todas las observaciones de un área en el periodo: media por criterio y acuerdos de cada observación
export function SummaryView({ observations, area, agg }) {
  const t = useT();
  const { locale } = useFormat();
  const avg = useAvg();
  const blocks = areaBlocks(area);
  const lines = observations.flatMap((o) => (o.agreements || "").split("\n").map((l) => l.trim()).filter(Boolean).map((text) => ({
    text, date: o.date ? format(new Date(`${o.date}T12:00:00`), "d MMM", { locale }) : "",
  })));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{t("Media")}</p>
          <p className="text-3xl font-black leading-none" style={{ ...FONT, color: avgColor(agg.overall) }}>{avg(agg.overall)}</p>
          <p className="text-[10px] text-gray-400">{t("sobre 4")}</p>
        </div>
        <p className="text-xs text-gray-400">{t("Observaciones: {n}", { n: agg.count })} · {t("Media de cada criterio en el periodo")}</p>
      </div>
      <div className={`grid grid-cols-1 ${gridCols(blocks)} gap-3`}>
        {blocks.map((b) => (
          <div key={b.key} className="bg-white border border-gray-200 overflow-hidden" style={{ borderRadius: 2 }}>
            {blocks.length > 1 && (
              <div className="flex items-center justify-between text-white px-3 py-1.5" style={{ background: b.color }}>
                <span className="text-sm font-black uppercase" style={FONT}>{t(b.label)}</span>
                <span className="text-sm font-black tabular-nums">{avg(agg.blocks[b.key].avg)}</span>
              </div>
            )}
            <ul className="divide-y divide-gray-100">
              {b.criteria.map((c) => (
                <li key={c.key} className="flex items-start justify-between gap-2 px-3 py-2">
                  <span className="text-sm text-gray-700 leading-snug">{t(c.label)}</span>
                  <AvgPill value={agg.criteria[c.key].avg} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        <AgreementsCard lines={lines} />
      </div>
    </div>
  );
}

// Formulario de una observación (nueva o editada) de un área. Se monta solo mientras está abierto.
// autoPublishFrom: si el periodo abierto se comparte con el entrenador, las observaciones nuevas desde esa fecha se publican al guardarlas
export function AreaObsDialog({ area, editing, staffId, teamIds, teamName, author, autoPublishFrom = null, onClose, onSaved }) {
  const t = useT();
  const avg = useAvg();
  const qc = useQueryClient();
  const info = areaInfo(area);
  const blocks = areaBlocks(area);
  const isMethod = area === "metodologia";
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(() => (editing ? {
    date: editing.date || todayStr(), team_id: editing.team_id || "", session_type: editing.session_type || "",
    scores: { ...emptyAreaScores(area), ...(editing.scores || {}) }, notes: { ...emptyAreaNotes(area), ...(editing.notes || {}) }, agreements: editing.agreements || "",
  } : {
    date: todayStr(), team_id: teamIds[0] || "", session_type: "", scores: emptyAreaScores(area), notes: emptyAreaNotes(area), agreements: "",
  }));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["coachSessionObs", staffId] });
  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        staff_id: staffId, area, team_id: form.team_id || null, date: form.date || todayStr(), session_type: isMethod ? form.session_type || "" : "",
        scores: form.scores, notes: form.notes, agreements: form.agreements,
        season: editing?.season || CURRENT_SEASON,
        author_id: editing?.author_id || author?.id || "", author_name: editing?.author_name || author?.name || "",
      };
      if (!editing) {
        const live = !!autoPublishFrom && data.date >= autoPublishFrom;
        data.status = live ? "publicada" : "borrador";
        if (live) data.published_at = new Date().toISOString();
      }
      return editing ? base44.entities.CoachSessionObs.update(editing.id, data) : base44.entities.CoachSessionObs.create(data);
    },
    onSuccess: (res) => { invalidate(); onSaved?.(res?.id || editing?.id); onClose(); },
  });
  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.CoachSessionObs.delete(editing.id),
    onSuccess: () => { invalidate(); onSaved?.(null); onClose(); },
  });

  const setScore = (key, value) => setForm((f) => ({ ...f, scores: { ...f.scores, [key]: f.scores[key] === value ? null : value } }));
  const setNote = (key, text) => setForm((f) => ({ ...f, notes: { ...f.notes, [key]: text } }));
  const formSum = areaSummary(form.scores, area);

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-white border-gray-200 max-h-[92vh] overflow-y-auto max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {editing ? t("Editar observación") : t("Nueva observación")}
            <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full text-white" style={{ background: info.color }}>{t(info.label)}</span>
          </DialogTitle>
        </DialogHeader>
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
            {isMethod && (
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
            )}
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <ScaleLegend />
            <p className="text-xs text-gray-500 whitespace-nowrap">{t("Media")}: <b style={{ color: avgColor(formSum.overall) }}>{avg(formSum.overall)}</b></p>
          </div>

          {blocks.map((b) => (
            <div key={b.key} className="space-y-1.5">
              {blocks.length > 1 && <p className="text-sm font-black uppercase text-white px-3 py-1" style={{ ...FONT, background: b.color, borderRadius: 2 }}>{t(b.label)}</p>}
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
              <Textarea rows={2} value={form.notes[b.key] || ""} onChange={(e) => setNote(b.key, e.target.value)} placeholder={t("Observación breve…")} className="border-gray-200 text-sm" />
            </div>
          ))}

          <div className="space-y-1.5">
            <p className="text-sm font-black uppercase text-white px-3 py-1 bg-[var(--granate)]" style={{ ...FONT, borderRadius: 2 }}>{t("Acuerdos de mejora")}</p>
            <Textarea rows={3} value={form.agreements} onChange={(e) => setForm({ ...form, agreements: e.target.value })} placeholder={t("Una idea por línea…")} className="border-gray-200 text-sm" />
          </div>

          <div className="flex gap-2 pt-2 border-t border-gray-100">
            {editing && (confirmDelete
              ? <Button variant="outline" onClick={() => deleteMutation.mutate()} className="text-red-600 border-red-200">{t("Confirmar borrado")}</Button>
              : <Button variant="outline" size="icon" onClick={() => setConfirmDelete(true)}><Trash2 className="w-4 h-4 text-gray-400" /></Button>)}
            <div className="flex-1" />
            <Button variant="outline" onClick={onClose}>{t("Cancelar")}</Button>
            <Button variant="club" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t("Guardando…") : t("Guardar")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
