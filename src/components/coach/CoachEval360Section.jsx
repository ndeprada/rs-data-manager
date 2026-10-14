import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FONT = { fontFamily: "var(--font-display)" };

// Estructura basada en el documento de evaluación del Área de Metodología
export const EVAL_BLOCKS = [
  { key: "habitos", label: "Hábitos", color: "#36000D", sections: [
    { key: "puntualidad", label: "Puntualidad, control de vestuarios…" },
    { key: "material", label: "Material" },
    { key: "datos", label: "Control de datos" },
    { key: "segundo", label: "Observaciones para 2º entrenador/a" },
  ]},
  { key: "entrenamientos", label: "Entrenamientos", color: "#73000A", sections: [
    { key: "metodologia", label: "Metodología" },
    { key: "planificacion", label: "Planificación y diseño de sesiones" },
    { key: "direccion_entreno", label: "Dirección del entrenamiento" },
    { key: "correcciones", label: "Correcciones" },
  ]},
  { key: "partidos", label: "Partidos", color: "#FF6E00", sections: [
    { key: "preparacion", label: "Preparación" },
    { key: "direccion_partido", label: "Dirección de partido" },
    { key: "minutos", label: "Gestión de minutos" },
    { key: "sistema", label: "Sistema de juego" },
  ]},
];
const ALL_SECTIONS = EVAL_BLOCKS.flatMap((b) => b.sections);

const RATINGS = [
  { value: "mejorable", label: "Mejorable", cls: "bg-orange-100 text-orange-700", dot: "bg-orange-400" },
  { value: "correcto", label: "Correcto", cls: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  { value: "destacado", label: "Destacado", cls: "bg-green-100 text-green-700", dot: "bg-green-500" },
];

const emptySections = () => Object.fromEntries(ALL_SECTIONS.map((s) => [s.key, { rating: "", text: "" }]));

function EvalView({ ev }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {EVAL_BLOCKS.map((b) => (
        <div key={b.key} className="space-y-2">
          <div className="text-center text-white py-1.5 text-lg font-black uppercase" style={{ ...FONT, background: b.color, borderRadius: 2 }}>{b.label}</div>
          {b.sections.map((s) => {
            const d = ev.sections?.[s.key] || {};
            const r = RATINGS.find((x) => x.value === d.rating);
            const lines = (d.text || "").split("\n").map((l) => l.trim()).filter(Boolean);
            return (
              <div key={s.key} className="bg-white border border-gray-200 p-3 min-h-[84px]" style={{ borderRadius: 2 }}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-black uppercase leading-tight" style={FONT}>{s.label}</p>
                  {r && <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${r.cls}`}>{r.label}</span>}
                </div>
                {lines.length === 0 ? <p className="text-xs text-gray-300">—</p> : (
                  <ul className="space-y-0.5">
                    {lines.map((l, i) => (
                      <li key={i} className="text-sm text-gray-700 leading-snug flex gap-1.5"><span style={{ color: "var(--naranja)" }}>•</span><span>{l}</span></li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function CoachEval360Section({ staffId, teamIds = [], canEvaluate, isOwnProfile, author }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", team_id: "", kind: "evaluacion", sections: emptySections() });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: all = [] } = useQuery({
    queryKey: ["coachEval360", staffId],
    queryFn: () => base44.entities.CoachEval360.filter({ staff_id: staffId }),
    enabled: !!staffId,
  });
  const teamName = (id) => teams.find((t) => t.id === id)?.name || "";

  const list = useMemo(
    () => all
      .filter((e) => canEvaluate || e.status === "publicada" || (isOwnProfile && e.kind === "autoevaluacion"))
      .sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [all, canEvaluate, isOwnProfile]
  );
  const current = list.find((e) => e.id === selectedId) || list[0] || null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["coachEval360", staffId] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        staff_id: staffId, title: form.title || "Evaluación", team_id: form.team_id || null, kind: form.kind,
        sections: form.sections, date: editing?.date || format(new Date(), "yyyy-MM-dd"),
        author_id: editing?.author_id || author?.id || "", author_name: editing?.author_name || author?.name || "",
      };
      if (!editing) data.status = form.kind === "autoevaluacion" ? "publicada" : "borrador";
      return editing ? base44.entities.CoachEval360.update(editing.id, data) : base44.entities.CoachEval360.create(data);
    },
    onSuccess: (res) => { invalidate(); setSelectedId(res?.id || editing?.id); setOpen(false); setEditing(null); },
  });
  const publishMutation = useMutation({
    mutationFn: (e) => base44.entities.CoachEval360.update(e.id, e.status === "publicada" ? { status: "borrador", published_at: null } : { status: "publicada", published_at: new Date().toISOString() }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (e) => base44.entities.CoachEval360.delete(e.id),
    onSuccess: () => { invalidate(); setSelectedId(null); setOpen(false); setEditing(null); setConfirmDelete(false); },
  });

  const openCreate = (kind) => {
    setEditing(null); setConfirmDelete(false);
    setForm({
      title: kind === "autoevaluacion" ? `Autoevaluación ${format(new Date(), "MMMM yyyy", { locale: es })}` : `Evaluación ${format(new Date(), "MMMM yyyy", { locale: es })}`,
      team_id: teamIds[0] || "", kind, sections: emptySections(),
    });
    setOpen(true);
  };
  const openEdit = (e) => {
    setEditing(e); setConfirmDelete(false);
    setForm({ title: e.title || "", team_id: e.team_id || "", kind: e.kind || "evaluacion", sections: { ...emptySections(), ...(e.sections || {}) } });
    setOpen(true);
  };
  const setSec = (key, patch) => setForm((f) => ({ ...f, sections: { ...f.sections, [key]: { ...f.sections[key], ...patch } } }));

  const canEditCurrent = current && (canEvaluate || (isOwnProfile && current.kind === "autoevaluacion"));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-black uppercase" style={{ ...FONT, color: "var(--granate)" }}>Evaluación 360</h2>
          <p className="text-xs text-gray-400">Visión global del entrenador: hábitos, entrenamientos y partidos.</p>
        </div>
        <div className="flex gap-2">
          {isOwnProfile && (
            <Button size="sm" variant="outline" onClick={() => openCreate("autoevaluacion")} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Mi autoevaluación
            </Button>
          )}
          {canEvaluate && (
            <Button size="sm" onClick={() => openCreate("evaluacion")} className="text-white text-xs" style={{ background: "var(--granate)" }}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Nueva evaluación
            </Button>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
          <p className="text-gray-400 text-sm">{canEvaluate ? "Aún no hay evaluaciones de este entrenador" : "Todavía no hay evaluaciones publicadas"}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {list.map((e) => (
              <button key={e.id} onClick={() => setSelectedId(e.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${current?.id === e.id ? "text-white border-transparent" : "text-gray-600 border-gray-200 bg-white hover:bg-gray-50"}`}
                style={current?.id === e.id ? { background: "var(--granate)" } : undefined}>
                {e.title || "Evaluación"}
                {e.kind === "autoevaluacion" && " · auto"}
                {canEvaluate && e.status !== "publicada" && " · borrador"}
              </button>
            ))}
          </div>

          {current && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-gray-500">
                  {current.team_id ? <span className="font-bold text-gray-800">{teamName(current.team_id)}</span> : null}
                  {current.author_name ? ` · ${current.kind === "autoevaluacion" ? "Autoevaluación de" : "Por"} ${current.author_name}` : ""}
                  {current.date ? ` · ${format(new Date(current.date), "d MMM yyyy", { locale: es })}` : ""}
                </p>
                <div className="flex gap-1.5">
                  {canEvaluate && current.kind !== "autoevaluacion" && (
                    <Button size="sm" variant="outline" onClick={() => publishMutation.mutate(current)} className="text-xs">
                      {current.status === "publicada" ? <><EyeOff className="w-3.5 h-3.5 mr-1" /> Ocultar al entrenador</> : <><Eye className="w-3.5 h-3.5 mr-1" /> Publicar al entrenador</>}
                    </Button>
                  )}
                  {canEditCurrent && (
                    <Button size="sm" variant="outline" onClick={() => openEdit(current)} className="text-xs"><Pencil className="w-3.5 h-3.5 mr-1" /> Editar</Button>
                  )}
                </div>
              </div>
              <EvalView ev={current} />
            </>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto max-w-3xl">
          <DialogHeader><DialogTitle>{form.kind === "autoevaluacion" ? "Autoevaluación" : editing ? "Editar evaluación" : "Nueva evaluación"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="text-xs text-gray-500 mb-1">Título</p>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="border-gray-200" />
              </div>
              {teamIds.length > 0 && (
                <div className="w-48">
                  <p className="text-xs text-gray-500 mb-1">Equipo</p>
                  <Select value={form.team_id || "none"} onValueChange={(v) => setForm({ ...form, team_id: v === "none" ? "" : v })}>
                    <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sin equipo —</SelectItem>
                      {teamIds.map((id) => <SelectItem key={id} value={id}>{teamName(id)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {EVAL_BLOCKS.map((b) => (
              <div key={b.key} className="space-y-2">
                <p className="text-sm font-black uppercase text-white px-3 py-1" style={{ ...FONT, background: b.color, borderRadius: 2 }}>{b.label}</p>
                {b.sections.map((s) => (
                  <div key={s.key} className="border border-gray-100 rounded p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-xs font-black uppercase" style={FONT}>{s.label}</p>
                      <div className="flex gap-1">
                        {RATINGS.map((r) => (
                          <button key={r.value} type="button"
                            onClick={() => setSec(s.key, { rating: form.sections[s.key].rating === r.value ? "" : r.value })}
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${form.sections[s.key].rating === r.value ? `${r.cls} border-transparent` : "text-gray-400 border-gray-200"}`}>
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Textarea rows={2} value={form.sections[s.key].text} onChange={(e) => setSec(s.key, { text: e.target.value })}
                      placeholder="Una idea por línea…" className="border-gray-200 text-sm" />
                  </div>
                ))}
              </div>
            ))}
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              {editing && (confirmDelete
                ? <Button variant="outline" onClick={() => deleteMutation.mutate(editing)} className="text-red-600 border-red-200">Confirmar borrado</Button>
                : <Button variant="outline" size="icon" onClick={() => setConfirmDelete(true)}><Trash2 className="w-4 h-4 text-gray-400" /></Button>)}
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="text-white" style={{ background: "var(--granate)" }}>
                {saveMutation.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
