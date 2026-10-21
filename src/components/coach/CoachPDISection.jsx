import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useT, msg, useDateLocale } from "@/i18n";

// Áreas con valoración por estrellas (1-3)
const RATED_FIELDS = [
  { key: "tactical_knowledge", label: msg("Conocimiento Técnico/Táctico"), placeholder: msg("Conocimiento sobre nuestro modelo de juego, principios y fundamentos...") },
  { key: "methodology", label: msg("Metodología"), placeholder: msg("Planificación, diseño y dirección de sesiones, progresión de contenidos...") },
  { key: "communication", label: msg("Habilidades comunicativas"), placeholder: msg("Comunicación con jugadores, familias, cuerpo técnico...") },
  { key: "leadership", label: msg("Liderazgo y gestión humana"), placeholder: msg("Gestión del vestuario, autoridad, motivación, empatía...") },
  { key: "habits", label: msg("Hábitos de entrenador"), placeholder: msg("Gestión del material, puntualidad, transmisión de valores, actitud...") },
];

const TEXT_FIELDS = [
  { key: "strengths", label: msg("Puntos fuertes"), placeholder: msg("Aspectos destacados del entrenador...") },
  { key: "areas_to_improve", label: msg("Áreas de mejora"), placeholder: msg("Aspectos a desarrollar...") },
  { key: "objectives", label: msg("Objetivos próximo período"), placeholder: msg("Metas concretas a trabajar en el siguiente período...") },
];

const STAR_CONFIG = {
  1: { label: msg("Mejorar"), color: "#ef4444", bg: "#fef2f2", border: "#fca5a5" },
  2: { label: msg("Correcto"), color: "#eab308", bg: "#fefce8", border: "#fde047" },
  3: { label: msg("Destacado"), color: "#22c55e", bg: "#f0fdf4", border: "#86efac" },
};

function StarRating({ value, onChange, readonly }) {
  const t = useT();
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3].map(n => {
        const cfg = STAR_CONFIG[n];
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => !readonly && onChange(active ? null : n)}
            disabled={readonly}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${readonly ? "cursor-default" : "cursor-pointer hover:opacity-80"}`}
            style={{
              background: active ? cfg.bg : "#f9fafb",
              borderColor: active ? cfg.border : "#e5e7eb",
              color: active ? cfg.color : "#9ca3af",
            }}
          >
            {"★".repeat(n)} <span className="hidden sm:inline">{t(cfg.label)}</span>
          </button>
        );
      })}
    </div>
  );
}

function StarBadge({ value }) {
  const t = useT();
  if (!value) return null;
  const cfg = STAR_CONFIG[value];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border"
      style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.color }}>
      {"★".repeat(value)} {t(cfg.label)}
    </span>
  );
}

const ratingKey = (fieldKey) => `${fieldKey}_rating`;

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  evaluator: "",
  period: "",
  visibility: "borrador",
  tactical_knowledge: "", tactical_knowledge_rating: null,
  methodology: "", methodology_rating: null,
  communication: "", communication_rating: null,
  leadership: "", leadership_rating: null,
  habits: "", habits_rating: null,
  strengths: "",
  areas_to_improve: "",
  objectives: "",
};

export default function CoachPDISection({ staffId, canEvaluate, canView, isOwnProfile }) {
  const t = useT();
  const dfl = useDateLocale();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [feedbackId, setFeedbackId] = useState(null);
  const [feedbackText, setFeedbackText] = useState("");

  const { data: pdis = [] } = useQuery({
    queryKey: ["coachPDI", staffId],
    queryFn: () => base44.entities.CoachPDI.filter({ staff_id: staffId }),
    enabled: !!staffId,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.CoachPDI.update(editing.id, data)
      : base44.entities.CoachPDI.create({ ...data, staff_id: staffId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coachPDI", staffId] }); setOpen(false); setEditing(null); },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ id, visibility }) => base44.entities.CoachPDI.update(id, { visibility }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coachPDI", staffId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CoachPDI.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coachPDI", staffId] }); setDeleteId(null); },
  });

  const feedbackMutation = useMutation({
    mutationFn: ({ id, text }) => base44.entities.CoachPDI.update(id, {
      coach_feedback: text,
      coach_feedback_date: new Date().toISOString().split("T")[0],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coachPDI", staffId] }); setFeedbackId(null); setFeedbackText(""); },
  });

  const openCreate = () => { setForm(emptyForm); setEditing(null); setOpen(true); };
  const openEdit = (pdi) => { setForm({ ...emptyForm, ...pdi }); setEditing(pdi); setOpen(true); };
  const openFeedback = (pdi) => { setFeedbackId(pdi.id); setFeedbackText(pdi.coach_feedback || ""); };

  // Entrenador solo ve los publicados; coordinadores ven todos
  const visiblePdis = [...pdis]
    .filter(p => canEvaluate || p.visibility === "publicado")
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!canView && !isOwnProfile) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
        <p className="text-gray-400 text-sm">{t("No tienes acceso a ver las evaluaciones PDI.")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{t("PDI – Plan de Desarrollo Individual")}</h2>
        {canEvaluate && (
          <Button variant="club" size="sm" onClick={openCreate} className="text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> {t("Nueva evaluación")}
          </Button>
        )}
      </div>

      {/* Info para el entrenador */}
      {isOwnProfile && !canEvaluate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
          {t("Aquí puedes ver las evaluaciones que tu coordinador ha compartido contigo. Puedes dejar tu feedback en cada una.")}
        </div>
      )}

      {visiblePdis.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
          <p className="text-gray-400 text-sm">
            {isOwnProfile && !canEvaluate ? t("Aún no tienes evaluaciones compartidas.") : t("Sin evaluaciones registradas")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visiblePdis.map(pdi => {
            const expanded = expandedId === pdi.id;
            const ratedValues = RATED_FIELDS.map(f => pdi[ratingKey(f.key)]).filter(Boolean);
            const avgStars = ratedValues.length > 0 ? (ratedValues.reduce((a, b) => a + b, 0) / ratedValues.length) : null;
            const isPublished = pdi.visibility === "publicado";

            return (
              <div key={pdi.id} className={`bg-white border shadow-sm overflow-hidden ${isPublished ? "border-gray-200" : "border-dashed border-gray-300"}`} style={{ borderRadius: "4px" }}>
                <div className="px-5 py-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpandedId(expanded ? null : pdi.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-gray-900 text-sm" style={{ fontFamily: "var(--font-display)" }}>
                        {pdi.period || format(new Date(pdi.date), "MMMM yyyy", { locale: dfl })}
                      </span>
                      <span className="text-xs text-gray-400">{format(new Date(pdi.date), "dd/MM/yyyy")}</span>
                      {avgStars !== null && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ background: avgStars >= 2.5 ? "#22c55e" : avgStars >= 1.5 ? "#eab308" : "#ef4444" }}>
                          {"★".repeat(Math.round(avgStars))} {avgStars.toFixed(1)}
                        </span>
                      )}
                      {pdi.evaluator && <span className="text-xs text-gray-400">— {pdi.evaluator}</span>}
                      {/* Visibility badge — only for coordinators */}
                      {canEvaluate && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isPublished ? "bg-green-50 border-green-200 text-green-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                          {isPublished ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {isPublished ? t("Publicado") : t("Borrador")}
                        </span>
                      )}
                      {/* Feedback indicator */}
                      {pdi.coach_feedback && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-50 border-purple-200 text-purple-700">
                          <MessageSquare className="w-3 h-3" /> {t("Feedback")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Toggle visibility (coordinators only) */}
                    {canEvaluate && (
                      <button
                        onClick={e => { e.stopPropagation(); toggleVisibilityMutation.mutate({ id: pdi.id, visibility: isPublished ? "borrador" : "publicado" }); }}
                        title={isPublished ? t("Convertir en borrador") : t("Publicar para el entrenador")}
                        className={`p-1.5 rounded transition-colors ${isPublished ? "text-green-600 hover:bg-green-50" : "text-amber-500 hover:bg-amber-50"}`}
                      >
                        {isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {canEvaluate && (
                      <button onClick={e => { e.stopPropagation(); openEdit(pdi); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canEvaluate && (
                      <button onClick={e => { e.stopPropagation(); setDeleteId(pdi.id); }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {/* Feedback button for the coach */}
                    {isOwnProfile && !canEvaluate && isPublished && (
                      <button
                        onClick={e => { e.stopPropagation(); openFeedback(pdi); }}
                        title={t("Dejar mi feedback")}
                        className="p-1.5 rounded hover:bg-purple-50 text-purple-400 hover:text-purple-600"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {expanded && (
                  <div className="px-5 pb-5 border-t border-gray-100 space-y-4 pt-4">
                    {/* Valoración por áreas */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400" style={{ fontFamily: "var(--font-display)" }}>{t("Valoración por áreas")}</p>
                      <div className="grid grid-cols-1 gap-3">
                        {RATED_FIELDS.map(f => {
                          const starVal = pdi[ratingKey(f.key)];
                          const textVal = pdi[f.key];
                          return (
                            <div key={f.key} className="flex flex-col gap-1.5 p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <p className="text-xs font-bold text-gray-700">{t(f.label)}</p>
                                <StarBadge value={starVal} />
                              </div>
                              {textVal && <p className="text-sm text-gray-600 leading-relaxed">{textVal}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Texto libre */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                      {TEXT_FIELDS.map(f => pdi[f.key] ? (
                        <div key={f.key}>
                          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1" style={{ fontFamily: "var(--font-display)" }}>{t(f.label)}</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{pdi[f.key]}</p>
                        </div>
                      ) : null)}
                    </div>

                    {/* Feedback del entrenador */}
                    {pdi.coach_feedback && (
                      <div className="pt-3 border-t border-purple-100">
                        <p className="text-[10px] font-black uppercase tracking-wider text-purple-500 mb-2" style={{ fontFamily: "var(--font-display)" }}>
                          {t("💬 Feedback del entrenador {v}", { v: pdi.coach_feedback_date ? `· ${format(new Date(pdi.coach_feedback_date), "dd/MM/yyyy")}` : "" })}
                        </p>
                        <div className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-3">
                          <p className="text-sm text-purple-800 leading-relaxed">{pdi.coach_feedback}</p>
                        </div>
                        {/* Coach can edit their own feedback */}
                        {isOwnProfile && !canEvaluate && (
                          <button onClick={() => openFeedback(pdi)} className="mt-2 text-xs text-purple-500 hover:text-purple-700 underline">
                            {t("Editar mi feedback")}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Invite coach to leave feedback if not yet done */}
                    {isOwnProfile && !canEvaluate && isPublished && !pdi.coach_feedback && (
                      <div className="pt-3 border-t border-gray-100">
                        <Button size="sm" onClick={() => openFeedback(pdi)} variant="outline" className="text-purple-600 border-purple-200 hover:bg-purple-50 text-xs gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" /> {t("Dejar mi feedback")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog (coordinadores) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
              {editing ? t("Editar evaluación PDI") : t("Nueva evaluación PDI")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1 font-medium">{t("Fecha *")}</p>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="border-gray-200" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1 font-medium">{t("Período")}</p>
                <Input placeholder={t("Oct-Dic 2025")} value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} className="border-gray-200" />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">{t("Evaluador")}</p>
              <Input placeholder={t("Nombre del coordinador")} value={form.evaluator} onChange={e => setForm({ ...form, evaluator: e.target.value })} className="border-gray-200" />
            </div>

            {/* Visibilidad */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-700">{t("Visibilidad")}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {form.visibility === "publicado"
                    ? t("✅ El entrenador podrá ver esta evaluación y dejar feedback.")
                    : t("🔒 Solo visible para coordinadores. Actívalo cuando esté listo.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, visibility: form.visibility === "publicado" ? "borrador" : "publicado" })}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${form.visibility === "publicado" ? "bg-green-50 border-green-300 text-green-700" : "bg-amber-50 border-amber-300 text-amber-700"}`}
              >
                {form.visibility === "publicado" ? <><Eye className="w-3.5 h-3.5" /> {t("Publicado")}</> : <><EyeOff className="w-3.5 h-3.5" /> {t("Borrador")}</>}
              </button>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-4">
              <p className="text-xs font-black uppercase tracking-wider text-gray-400" style={{ fontFamily: "var(--font-display)" }}>{t("Valoración por áreas")}</p>
              {RATED_FIELDS.map(f => (
                <div key={f.key} className="space-y-2 p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                  <p className="text-xs font-bold text-gray-700">{t(f.label)}</p>
                  <StarRating
                    value={form[ratingKey(f.key)]}
                    onChange={v => setForm({ ...form, [ratingKey(f.key)]: v })}
                  />
                  <Textarea
                    placeholder={t(f.placeholder)}
                    value={form[f.key] || ""}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="border-gray-200 text-sm"
                    rows={2}
                  />
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-4">
              <p className="text-xs font-black uppercase tracking-wider text-gray-400" style={{ fontFamily: "var(--font-display)" }}>{t("Resumen")}</p>
              {TEXT_FIELDS.map(f => (
                <div key={f.key}>
                  <p className="text-xs text-gray-500 mb-1 font-medium">{t(f.label)}</p>
                  <Textarea
                    placeholder={t(f.placeholder)}
                    value={form[f.key] || ""}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="border-gray-200 text-sm"
                    rows={2}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">{t("Cancelar")}</Button>
              <Button variant="club" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}
                className="flex-1">
                {saveMutation.isPending ? "Guardando..." : t("Guardar")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog (entrenador) */}
      <Dialog open={!!feedbackId} onOpenChange={o => { if (!o) { setFeedbackId(null); setFeedbackText(""); } }}>
        <DialogContent className="bg-white border-gray-200 max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "#7c3aed" }}>{t("Mi feedback sobre esta evaluación")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-gray-500">{t("Comparte tu valoración sobre los puntos evaluados. Será visible para tu coordinador.")}</p>
            <Textarea
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              rows={5}
              placeholder={t("Escribe aquí tu valoración, comentarios o cualquier punto que quieras destacar sobre esta evaluación...")}
              className="border-gray-200 text-sm"
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setFeedbackId(null); setFeedbackText(""); }} className="flex-1">{t("Cancelar")}</Button>
              <Button
                onClick={() => feedbackMutation.mutate({ id: feedbackId, text: feedbackText })}
                disabled={feedbackMutation.isPending || !feedbackText.trim()}
                className="flex-1 text-white gap-2"
                style={{ background: "#7c3aed" }}
              >
                <Send className="w-3.5 h-3.5" />
                {feedbackMutation.isPending ? "Enviando..." : t("Enviar feedback")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("¿Eliminar evaluación?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Esta acción no se puede deshacer.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 text-white">{t("Eliminar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}