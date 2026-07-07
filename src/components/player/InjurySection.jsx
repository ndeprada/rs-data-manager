import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Plus, Pencil, Trash2, CheckCircle, Bell,
  Paperclip, Upload, X, FileText, Loader2, Stethoscope,
  ClipboardList, Activity, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

const TYPE_LABELS = { muscular: "Muscular", osea: "Ósea", ligamento: "Ligamento", tendon: "Tendón", contusion: "Contusión", otro: "Otro" };
const PART_LABELS = { tobillo: "Tobillo", rodilla: "Rodilla", muslo: "Muslo", gemelo: "Gemelo", isquiotibial: "Isquiotibial", cadera: "Cadera", espalda: "Espalda", hombro: "Hombro", brazo: "Brazo", cabeza: "Cabeza", otro: "Otro" };
const SEVERITY_STYLES = {
  leve:     { label: "Leve",     bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  moderada: { label: "Moderada", bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  grave:    { label: "Grave",    bg: "#fdf2f4", color: "#8B1A2B", border: "#fecdd3" },
};
const STATUS_STYLES = {
  activa:       { label: "Activa",       bg: "#fdf2f4", color: "#8B1A2B", border: "#fecdd3" },
  recuperacion: { label: "Recuperación", bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  alta:         { label: "Alta",         bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
};
const PHASE_STATUS = {
  pendiente:  { label: "Pendiente",  cls: "bg-gray-100 text-gray-500 border-gray-200" },
  en_curso:   { label: "En curso",   cls: "bg-orange-50 text-orange-700 border-orange-200" },
  completada: { label: "Completada", cls: "bg-green-50 text-green-700 border-green-200" },
};
const DOC_TYPES = ["Prueba médica", "Informe médico", "Radiografía", "Resonancia", "Ecografía", "Parte médico", "Otro"];

const emptyForm = {
  type: "", body_part: "", severity: "", injury_date: "", expected_return: "",
  actual_return: "", status: "activa", diagnosis: "", description: "", treatment: "",
  responsible_doctor: "", medical_center: "", reported_by: "",
  recovery_phases: [], documents: []
};

const emptyPhase = { id: "", phase_name: "", description: "", start_date: "", end_date: "", status: "pendiente", notes: "" };

export default function InjurySection({ playerId, playerName, playerEmail, staffEmails }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState(null);
  const [sendingAlert, setSendingAlert] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const { data: injuries = [] } = useQuery({
    queryKey: ["injuries", playerId],
    queryFn: () => base44.entities.Injury.filter({ player_id: playerId }, "-injury_date"),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Injury.create({ ...d, player_id: playerId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["injuries", playerId] }); closeDialog(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Injury.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["injuries", playerId] }); closeDialog(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Injury.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["injuries", playerId] }); setDeleteId(null); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };

  const openEdit = (inj) => {
    setEditing(inj);
    setForm({
      type: inj.type || "", body_part: inj.body_part || "", severity: inj.severity || "",
      injury_date: inj.injury_date || "", expected_return: inj.expected_return || "",
      actual_return: inj.actual_return || "", status: inj.status || "activa",
      diagnosis: inj.diagnosis || "", description: inj.description || "",
      treatment: inj.treatment || "", responsible_doctor: inj.responsible_doctor || "",
      medical_center: inj.medical_center || "", reported_by: inj.reported_by || "",
      recovery_phases: inj.recovery_phases || [], documents: inj.documents || []
    });
    setDialogOpen(true);
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((prev) => ({
      ...prev,
      documents: [...(prev.documents || []), { file_url, file_name: file.name, doc_type: "Otro", uploaded_at: new Date().toISOString() }]
    }));
    setUploadingDoc(false);
    e.target.value = "";
  };

  const removeDoc = (idx) => setForm((prev) => ({ ...prev, documents: prev.documents.filter((_, i) => i !== idx) }));

  const addPhase = () => {
    const newPhase = { ...emptyPhase, id: crypto.randomUUID() };
    setForm(prev => ({ ...prev, recovery_phases: [...(prev.recovery_phases || []), newPhase] }));
  };
  const updatePhase = (idx, field, value) => {
    setForm(prev => {
      const phases = [...prev.recovery_phases];
      phases[idx] = { ...phases[idx], [field]: value };
      return { ...prev, recovery_phases: phases };
    });
  };
  const removePhase = (idx) => setForm(prev => ({ ...prev, recovery_phases: prev.recovery_phases.filter((_, i) => i !== idx) }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const handleMarkAlta = async (inj) => {
    setSendingAlert(inj.id);
    const today = format(new Date(), "yyyy-MM-dd");
    await base44.entities.Injury.update(inj.id, { status: "alta", actual_return: today, staff_notified: true });
    await base44.entities.Player.update(playerId, { status: "activo" });
    if (staffEmails?.length > 0) {
      for (const email of staffEmails) {
        await base44.integrations.Core.SendEmail({
          to: email,
          subject: `✅ Alta médica: ${playerName} regresa a la actividad`,
          body: `Hola,\n\nEl jugador ${playerName} ha recibido el alta médica el ${format(new Date(), "d MMMM yyyy", { locale: es })} y puede reincorporarse a los entrenamientos.\n\nLesión: ${TYPE_LABELS[inj.type] || inj.type} en ${PART_LABELS[inj.body_part] || inj.body_part} (${inj.severity})\nFecha lesión: ${inj.injury_date}\n\nRS Data Manager`
        });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["injuries", playerId] });
    queryClient.invalidateQueries({ queryKey: ["players"] });
    setSendingAlert(null);
  };

  const active = injuries.filter(i => i.status !== "alta");
  const history = injuries.filter(i => i.status === "alta");

  const InjuryCard = ({ inj, isHistory }) => {
    const sev = SEVERITY_STYLES[inj.severity] || SEVERITY_STYLES.leve;
    const sta = STATUS_STYLES[inj.status] || STATUS_STYLES.activa;
    const days = inj.injury_date ? differenceInDays(new Date(), new Date(inj.injury_date)) : null;
    const recDays = (inj.injury_date && inj.actual_return)
      ? differenceInDays(new Date(inj.actual_return), new Date(inj.injury_date)) : null;
    const isExpanded = expandedId === inj.id;
    const phases = inj.recovery_phases || [];
    const completedPhases = phases.filter(p => p.status === "completada").length;

    return (
      <div className="border-b border-gray-100 last:border-0">
        <div className={`p-5 transition-colors ${isHistory ? "hover:bg-gray-50" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Title row */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-semibold text-gray-900">{TYPE_LABELS[inj.type]} — {PART_LABELS[inj.body_part]}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border" style={{ background: sev.bg, color: sev.color, borderColor: sev.border }}>{sev.label}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border" style={{ background: sta.bg, color: sta.color, borderColor: sta.border }}>{sta.label}</span>
              </div>

              {/* Dates row */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span>Lesión: {inj.injury_date ? format(new Date(inj.injury_date), "d MMM yyyy", { locale: es }) : "—"}</span>
                {!isHistory && days !== null && <span className="text-orange-500 font-medium">{days} días</span>}
                {inj.expected_return && !isHistory && <span>Regreso est.: {format(new Date(inj.expected_return), "d MMM yyyy", { locale: es })}</span>}
                {inj.actual_return && <span className="text-green-600">Alta: {format(new Date(inj.actual_return), "d MMM yyyy", { locale: es })}</span>}
                {recDays !== null && <span className="text-green-600 font-medium">{recDays} días de recuperación</span>}
              </div>

              {/* Diagnosis preview */}
              {inj.diagnosis && <p className="text-sm text-gray-700 mt-2 font-medium">Dx: {inj.diagnosis}</p>}

              {/* Recovery phases mini progress */}
              {phases.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1">
                    {phases.map((p, i) => (
                      <div key={i} className={`w-4 h-1.5 rounded-full ${p.status === "completada" ? "bg-green-400" : p.status === "en_curso" ? "bg-orange-400" : "bg-gray-200"}`} />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">{completedPhases}/{phases.length} fases</span>
                </div>
              )}

              {/* Medical info */}
              {(inj.responsible_doctor || inj.medical_center) && (
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                  {inj.responsible_doctor && <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3" /> {inj.responsible_doctor}</span>}
                  {inj.medical_center && <span>🏥 {inj.medical_center}</span>}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-1 shrink-0 flex-col items-end">
              {!isHistory && (
                <Button size="sm" variant="outline" onClick={() => handleMarkAlta(inj)} disabled={sendingAlert === inj.id}
                  className="text-green-600 border-green-200 hover:bg-green-50 text-xs">
                  <Bell className="w-3 h-3 mr-1" />
                  {sendingAlert === inj.id ? "..." : "Dar Alta"}
                </Button>
              )}
              <div className="flex gap-1">
                <button onClick={() => setExpandedId(isExpanded ? null : inj.id)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => openEdit(inj)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => setDeleteId(inj.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Expanded medical detail */}
        {isExpanded && (
          <div className="bg-gray-50 border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
            {/* Treatment */}
            {inj.treatment && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1">
                  <ClipboardList className="w-3.5 h-3.5" /> Tratamiento prescrito
                </p>
                <p className="text-sm text-gray-700 bg-white border border-gray-200 rounded p-3">{inj.treatment}</p>
              </div>
            )}
            {inj.description && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Notas médicas</p>
                <p className="text-sm text-gray-600 italic bg-white border border-gray-200 rounded p-3">{inj.description}</p>
              </div>
            )}

            {/* Recovery Phases Timeline */}
            {phases.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" /> Plan de recuperación
                </p>
                <div className="relative pl-6 space-y-3">
                  {phases.map((phase, idx) => {
                    const ps = PHASE_STATUS[phase.status] || PHASE_STATUS.pendiente;
                    return (
                      <div key={idx} className="relative">
                        {/* Timeline connector */}
                        {idx < phases.length - 1 && (
                          <div className="absolute left-[-17px] top-5 w-px h-full bg-gray-200" />
                        )}
                        <div className={`absolute left-[-21px] top-1.5 w-3 h-3 rounded-full border-2 ${phase.status === "completada" ? "bg-green-400 border-green-400" : phase.status === "en_curso" ? "bg-orange-400 border-orange-400" : "bg-white border-gray-300"}`} />
                        <div className="bg-white border border-gray-200 rounded p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-sm text-gray-800">{phase.phase_name}</span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${ps.cls}`}>{ps.label}</span>
                          </div>
                          {phase.description && <p className="text-xs text-gray-500 mb-1">{phase.description}</p>}
                          <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                            {phase.start_date && <span>Inicio: {format(new Date(phase.start_date), "d MMM yyyy", { locale: es })}</span>}
                            {phase.end_date && <span>Fin est.: {format(new Date(phase.end_date), "d MMM yyyy", { locale: es })}</span>}
                          </div>
                          {phase.notes && <p className="text-xs text-gray-400 mt-1 italic">{phase.notes}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Documents */}
            {inj.documents?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5" /> Documentos ({inj.documents.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {inj.documents.map((doc, i) => (
                    <a key={i} href={doc.file_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100 transition-colors">
                      <FileText className="w-3 h-3 text-gray-400" />
                      {doc.doc_type || doc.file_name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Active injuries */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <h2 className="font-semibold text-lg text-gray-900">Lesiones Activas</h2>
            {active.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white bg-red-500">{active.length}</span>
            )}
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setForm(emptyForm); setDialogOpen(true); }} className="text-white" style={{ background: "var(--granate)" }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Reportar Lesión
          </Button>
        </div>

        {active.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-300" />
            <p>Sin lesiones activas</p>
          </div>
        ) : (
          <div>{active.map(inj => <InjuryCard key={inj.id} inj={inj} isHistory={false} />)}</div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h2 className="font-semibold text-lg text-gray-900">Historial Médico</h2>
            <span className="text-sm text-gray-400">({history.length} lesiones)</span>
          </div>
          <div>{history.map(inj => <InjuryCard key={inj.id} inj={inj} isHistory={true} />)}</div>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Historial Médico" : "Reportar Lesión"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tipo de lesión *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Zona afectada *</Label>
                <Select value={form.body_part} onValueChange={(v) => setForm({ ...form, body_part: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{Object.entries(PART_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Gravedad *</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leve">Leve</SelectItem>
                    <SelectItem value="moderada">Moderada</SelectItem>
                    <SelectItem value="grave">Grave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activa">Activa</SelectItem>
                    <SelectItem value="recuperacion">Recuperación</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Fecha lesión *</Label>
                <Input type="date" value={form.injury_date} onChange={(e) => setForm({ ...form, injury_date: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Regreso estimado</Label>
                <Input type="date" value={form.expected_return} onChange={(e) => setForm({ ...form, expected_return: e.target.value })} />
              </div>
            </div>

            {form.status === "alta" && (
              <div className="space-y-1">
                <Label>Fecha alta real</Label>
                <Input type="date" value={form.actual_return} onChange={(e) => setForm({ ...form, actual_return: e.target.value })} />
              </div>
            )}

            {/* Medical info */}
            <div className="border border-gray-100 rounded-lg p-4 space-y-4 bg-gray-50">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5" /> Información médica
              </p>
              <div className="space-y-1">
                <Label>Diagnóstico médico</Label>
                <Textarea value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                  placeholder="Diagnóstico clínico detallado..." className="h-20 bg-white" />
              </div>
              <div className="space-y-1">
                <Label>Tratamiento prescrito</Label>
                <Textarea value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })}
                  placeholder="Medicación, fisioterapia, reposo, ejercicios..." className="h-20 bg-white" />
              </div>
              <div className="space-y-1">
                <Label>Notas adicionales</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Observaciones, evolución..." className="h-16 bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Médico / Fisioterapeuta</Label>
                  <Input value={form.responsible_doctor} onChange={(e) => setForm({ ...form, responsible_doctor: e.target.value })}
                    placeholder="Dr. García..." className="bg-white" />
                </div>
                <div className="space-y-1">
                  <Label>Centro médico</Label>
                  <Input value={form.medical_center} onChange={(e) => setForm({ ...form, medical_center: e.target.value })}
                    placeholder="Clínica, hospital..." className="bg-white" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Reportado por</Label>
                <Input value={form.reported_by} onChange={(e) => setForm({ ...form, reported_by: e.target.value })}
                  placeholder="Nombre del entrenador" className="bg-white" />
              </div>
            </div>

            {/* Recovery Phases */}
            <div className="border border-gray-100 rounded-lg p-4 space-y-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" /> Plan de recuperación
                </p>
                <Button type="button" size="sm" variant="outline" onClick={addPhase} className="text-xs h-7">
                  <Plus className="w-3 h-3 mr-1" /> Añadir fase
                </Button>
              </div>
              {(form.recovery_phases || []).map((phase, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Input value={phase.phase_name} onChange={(e) => updatePhase(idx, "phase_name", e.target.value)}
                      placeholder="Nombre de la fase (ej: Reposo, Fisioterapia...)" className="h-8 text-sm" />
                    <button type="button" onClick={() => removePhase(idx)} className="p-1 text-gray-300 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Textarea value={phase.description} onChange={(e) => updatePhase(idx, "description", e.target.value)}
                    placeholder="Descripción de la fase..." className="h-14 text-sm" />
                  <div className="grid grid-cols-3 gap-2">
                    <Input type="date" value={phase.start_date} onChange={(e) => updatePhase(idx, "start_date", e.target.value)} className="h-8 text-xs" />
                    <Input type="date" value={phase.end_date} onChange={(e) => updatePhase(idx, "end_date", e.target.value)} className="h-8 text-xs" />
                    <Select value={phase.status} onValueChange={(v) => updatePhase(idx, "status", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="en_curso">En curso</SelectItem>
                        <SelectItem value="completada">Completada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              {form.recovery_phases?.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No hay fases definidas</p>
              )}
            </div>

            {/* Documents */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Documentos adjuntos</Label>
              <div className="border border-dashed border-gray-300 rounded-lg p-3 space-y-2 bg-gray-50">
                {(form.documents || []).map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{doc.file_name}</p>
                      <select value={doc.doc_type}
                        onChange={(e) => {
                          const docs = [...form.documents];
                          docs[idx] = { ...docs[idx], doc_type: e.target.value };
                          setForm({ ...form, documents: docs });
                        }}
                        className="text-xs text-gray-400 bg-transparent border-none outline-none mt-0.5 cursor-pointer">
                        {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline shrink-0">Ver</a>
                    <button type="button" onClick={() => removeDoc(idx)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <label className="flex items-center justify-center gap-2 py-2 cursor-pointer text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  {uploadingDoc ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</> : <><Upload className="w-4 h-4" /> Adjuntar documento</>}
                  <input type="file" className="hidden" onChange={handleDocUpload} disabled={uploadingDoc} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" className="text-white" style={{ background: "var(--granate)" }}>{editing ? "Guardar cambios" : "Reportar lesión"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lesión?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}