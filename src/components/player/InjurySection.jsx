import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, CheckCircle,
  Paperclip, Upload, X, FileText, Loader2, Stethoscope, Activity, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { C as clubColor } from "@/lib/brand";
import { useT, useFormat } from "@/i18n";
import { INJURY_TYPE_LABELS, BODY_PART_LABELS, SEVERITY_LABELS, labelOf } from "@/lib/injuryLabels";
import { daysUntil, phaseSteps, injurySummary } from "@/lib/profileTabs";
import { seasonStart as seasonStartOf } from "@/lib/playerProfile";
import { Cols, th, td } from "./ProfileParts";

const TYPE_LABELS = { muscular: "Muscular", osea: "Ósea", ligamento: "Ligamento", tendon: "Tendón", contusion: "Contusión", otro: "Otro" };
const PART_LABELS = { tobillo: "Tobillo", rodilla: "Rodilla", muslo: "Muslo", gemelo: "Gemelo", isquiotibial: "Isquiotibial", cadera: "Cadera", espalda: "Espalda", hombro: "Hombro", brazo: "Brazo", cabeza: "Cabeza", otro: "Otro" };
const SEVERITY_STYLES = {
  leve:     { label: "Leve",     bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  moderada: { label: "Moderada", bg: clubColor.accentSoft, color: "#ea580c", border: "#fed7aa" },
  grave:    { label: "Grave",    bg: clubColor.primarySoft, color: clubColor.primary, border: "#fecdd3" },
};
const DOC_TYPES = ["Prueba médica", "Informe médico", "Radiografía", "Resonancia", "Ecografía", "Parte médico", "Otro"];

const emptyForm = {
  type: "", body_part: "", severity: "", injury_date: "", expected_return: "",
  actual_return: "", status: "activa", diagnosis: "", description: "", treatment: "",
  responsible_doctor: "", medical_center: "", reported_by: "",
  recovery_phases: [], documents: []
};

const emptyPhase = { id: "", phase_name: "", description: "", start_date: "", end_date: "", status: "pendiente", notes: "" };

export default function InjurySection({ playerId, impactOf, readOnly = false, mobile = false }) {
  const t = useT();
  const fmt = useFormat();
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
    await base44.entities.Injury.update(inj.id, { status: "alta", actual_return: today });
    await base44.entities.Player.update(playerId, { status: "activo" });
    queryClient.invalidateQueries({ queryKey: ["injuries", playerId] });
    queryClient.invalidateQueries({ queryKey: ["players"] });
    setSendingAlert(null);
  };

  const active = injuries.filter(i => i.status !== "alta");
  const history = injuries.filter(i => i.status === "alta");

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const now = new Date();
  const imp = (inj) => impactOf?.(inj) || { matches: 0, trainings: 0, days: null };
  const d = (x, opts = { day: "numeric", month: "short", year: "numeric" }) => { try { return x ? new Date(x).toLocaleDateString(fmt.tag, opts) : "—"; } catch { return "—"; } };
  const typeName = (inj) => labelOf(INJURY_TYPE_LABELS, inj.type, t) || t("Lesión");
  const partName = (inj) => labelOf(BODY_PART_LABELS, inj.body_part, t);
  const sevChip = (inj) => {
    const sev = SEVERITY_STYLES[inj.severity];
    return sev ? <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>{labelOf(SEVERITY_LABELS, inj.severity, t)}</span> : null;
  };
  const head = (title, right) => (
    <div className="flex flex-wrap items-center" style={{ gap: 6, marginBottom: 8 }}>
      <h2 style={{ margin: 0, borderLeft: `3px solid ${clubColor.accent}`, paddingLeft: 7, lineHeight: 1 }}><span className="rs2-display" style={{ fontSize: 17, color: clubColor.primary }}>{title}</span></h2>
      {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
    </div>
  );
  const iconBtn = { padding: 5, borderRadius: 7, border: 0, background: "none", color: "#9C8E90" };

  const Detail = ({ inj }) => {
    const phases = inj.recovery_phases || [];
    return (
      <div className="space-y-3" style={{ fontSize: 12.5 }}>
        {inj.diagnosis && <p style={{ margin: 0 }}><b>{t("Diagnóstico:")}</b> {inj.diagnosis}</p>}
        {inj.treatment && <p style={{ margin: 0 }}><b>{t("Tratamiento:")}</b> {inj.treatment}</p>}
        {inj.description && <p style={{ margin: 0, color: "#4A3D3F" }}><b>{t("Notas:")}</b> {inj.description}</p>}
        {phases.length > 0 && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#6B5E60", margin: "0 0 4px" }}>{t("Fases")}</p>
            {phases.map((ph, i) => (
              <p key={i} style={{ margin: "2px 0" }}>{ph.status === "completada" ? "✓ " : ph.status === "en_curso" ? "▶ " : "· "}<b>{ph.phase_name}</b>{ph.start_date ? ` · ${d(ph.start_date, { day: "numeric", month: "short" })}` : ""}{ph.end_date ? ` – ${d(ph.end_date, { day: "numeric", month: "short" })}` : ""}{ph.notes ? ` · ${ph.notes}` : ""}</p>
            ))}
          </div>
        )}
        {inj.documents?.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {inj.documents.map((doc, i) => (
              <a key={i} href={doc.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center" style={{ gap: 4, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "#F1ECEC", color: "#4A3D3F" }}>
                <FileText className="w-3 h-3" />{doc.doc_type || doc.file_name}
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };

  const ActiveCard = ({ inj }) => {
    const im = imp(inj);
    const left = daysUntil(inj.expected_return, now);
    const steps = phaseSteps(inj.recovery_phases || []);
    const who = [inj.responsible_doctor, inj.medical_center].filter(Boolean).join(" · ");
    const fact = (k, v, testId) => (
      <div data-testid={testId}><div style={{ fontSize: 11, color: "#6B5E60" }}>{k}</div><b style={{ fontSize: 14 }}>{v}</b></div>
    );
    return (
      <section className="rs2-card" style={{ padding: "12px 14px", borderColor: "#FCA5A5", boxShadow: "inset 4px 0 0 #B91C1C" }} data-testid={`med-active-${inj.id}`}>
        <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
          <span className="rs2-display" style={{ fontSize: 18, color: "#B91C1C", lineHeight: 1 }}>{t("Lesión activa")}</span>
          {sevChip(inj)}
          <span style={{ fontSize: 13 }}><b>{typeName(inj)}</b>{partName(inj) ? ` · ${partName(inj).toLowerCase()}` : ""}</span>
          {!readOnly && <span className="flex" style={{ marginLeft: "auto", gap: 6 }}>
            <Button size="sm" variant="outline" onClick={() => openEdit(inj)} data-testid={`med-edit-${inj.id}`}><Pencil className="w-3.5 h-3.5 mr-1" />{t("Editar")}</Button>
            <Button size="sm" variant="club" onClick={() => handleMarkAlta(inj)} disabled={sendingAlert === inj.id} data-testid={`med-alta-${inj.id}`}><CheckCircle className="w-3.5 h-3.5 mr-1" />{sendingAlert === inj.id ? "…" : t("Dar el alta")}</Button>
          </span>}
        </div>
        <div className="flex flex-wrap" style={{ gap: 18, margin: "12px 0" }}>
          {fact(t("Desde"), d(inj.injury_date, { day: "numeric", month: "short" }))}
          {im.days != null && fact(t("Días de baja"), im.days, "med-days")}
          {inj.expected_return && fact(t("Vuelta prevista"), `${d(inj.expected_return, { day: "numeric", month: "short" })} · ${left > 0 ? t("en {n} días", { n: left }) : left === 0 ? t("hoy") : t("hace {n} días", { n: -left })}`)}
          {fact(t("Se ha perdido"), t("{p} partidos · {e} entrenos", { p: im.matches, e: im.trainings }), "med-missed")}
          {who && fact(t("Responsable"), who)}
        </div>
        {steps && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#6B5E60", margin: "0 0 6px" }}>{t("Recuperación por fases")}</p>
            <div className="flex" style={{ gap: 10 }} data-testid="med-phases">
              {steps.map((ph, i) => (
                <div key={i} className="flex flex-col" style={{ flex: 1, gap: 4, minWidth: 0 }}>
                  <div style={{ height: 6, borderRadius: 9, background: ph.state === "done" ? "#15803D" : ph.state === "now" ? clubColor.accent : "#D1D5DB" }} />
                  <b style={{ fontSize: 12, color: ph.state === "todo" ? "#6B5E60" : "#1E1416" }} className="truncate">{ph.state === "done" ? "✓ " : ""}{ph.phase_name || t("Fase {n}", { n: i + 1 })}</b>
                  <span style={{ fontSize: 11, color: "#6B5E60" }}>{ph.start_date ? d(ph.start_date, { day: "numeric", month: "short" }) : ""}{ph.end_date ? ` – ${d(ph.end_date, { day: "numeric", month: "short" })}` : ""}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {(inj.diagnosis || inj.treatment || inj.description || inj.documents?.length > 0) && <div style={{ marginTop: 12 }}><Detail inj={inj} /></div>}
      </section>
    );
  };

  const historyTable = history.length > 0 && (
    <section className="rs2-card" style={{ padding: "10px 14px" }} data-testid="med-history">
      {head(t("Historial de lesiones"), <span style={{ fontSize: 11, color: "#6B5E60" }}>{t("Toca una para ver el detalle")}</span>)}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>{[t("Fecha"), t("Lesión"), t("Zona"), t("Gravedad"), t("Baja"), t("Se perdió"), ""].map((h, i) => <th key={i} style={th()}>{h}</th>)}</tr></thead>
          <tbody>
            {history.map((inj) => {
              const im = imp(inj);
              const open = expandedId === inj.id;
              return (
                <React.Fragment key={inj.id}>
                  <tr style={{ cursor: "pointer" }} onClick={() => setExpandedId(open ? null : inj.id)} data-testid={`med-row-${inj.id}`}>
                    <td style={td({ color: "#6B5E60", whiteSpace: "nowrap" })}>{d(inj.injury_date)}</td>
                    <td style={td({ fontWeight: 700 })}>{typeName(inj)}</td>
                    <td style={td()}>{partName(inj)}</td>
                    <td style={td()}>{sevChip(inj)}</td>
                    <td style={td({ whiteSpace: "nowrap" })}>{im.days != null ? t("{n} días", { n: im.days }) : "—"}</td>
                    <td style={td({ whiteSpace: "nowrap" })}>{t("{n} partidos", { n: im.matches })}</td>
                    <td style={td({ textAlign: "right", whiteSpace: "nowrap" })} onClick={(e) => e.stopPropagation()}>
                      {!readOnly && <>
                        <button type="button" style={iconBtn} onClick={() => openEdit(inj)} title={t("Editar")}><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" style={iconBtn} onClick={() => setDeleteId(inj.id)} title={t("Eliminar")}><Trash2 className="w-3.5 h-3.5" /></button>
                      </>}
                      <button type="button" style={iconBtn} onClick={() => setExpandedId(open ? null : inj.id)}>{open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</button>
                    </td>
                  </tr>
                  {open && <tr><td colSpan={7} style={{ padding: "8px 10px 12px", background: "#FAF7F6" }}><Detail inj={inj} /></td></tr>}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

  const sum = injurySummary(injuries, { since: seasonStartOf(now), impactOf: imp });
  const summary = (
    <section className="rs2-card" style={{ padding: "10px 14px" }} data-testid="med-summary">
      {head(t("Resumen médico"))}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[[sum.n, t("lesiones esta temporada")], [sum.days, t("días de baja")], [sum.matches, t("partidos perdidos")]].map(([v, l], i) => (
          <div key={i}><div className="rs2-display tabular-nums" style={{ fontSize: 24, lineHeight: 1, color: clubColor.primary }}>{v}</div><div style={{ fontSize: 11, color: "#6B5E60" }}>{l}</div></div>
        ))}
        {sum.repeated && <div><div className="rs2-display tabular-nums" style={{ fontSize: 24, lineHeight: 1, color: "#B45309" }}>{sum.repeated.n}</div><div style={{ fontSize: 11, color: "#6B5E60" }}>{t("en {zona} (se repite)", { zona: labelOf(BODY_PART_LABELS, sum.repeated.zone, t).toLowerCase() })}</div></div>}
      </div>
    </section>
  );

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      {!readOnly && <div className="flex justify-end"><Button variant="club" size="sm" onClick={openNew} data-testid="med-new"><Plus className="w-3.5 h-3.5 mr-1" />{t("Registrar lesión")}</Button></div>}
      <Cols mobile={mobile} ratio="2.2fr 1fr"
        left={<>
          {active.map((inj) => <ActiveCard key={inj.id} inj={inj} />)}
          {active.length === 0 && <section className="rs2-card" style={{ padding: "12px 14px" }} data-testid="med-none"><b style={{ color: "#15803D", fontSize: 13 }}>✓ {t("Sin lesiones activas")}</b></section>}
          {historyTable}
          {history.length === 0 && active.length === 0 && <p style={{ fontSize: 12, color: "#9C8E90", margin: 0 }}>{t("Sin lesiones registradas.")}</p>}
        </>}
        right={summary} />

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
              <Button variant="club" type="submit">{editing ? "Guardar cambios" : "Reportar lesión"}</Button>
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