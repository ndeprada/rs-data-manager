import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Star } from "lucide-react";

function StarDisplay({ value, max = 5 }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < value ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="focus:outline-none"
        >
          <Star className={`w-6 h-6 transition-colors ${i <= (hover || value) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

function skillColor(v) {
  if (!v) return "#e5e7eb";
  if (v <= 3) return "#ef4444";
  if (v <= 5) return "#f97316";
  if (v <= 7) return "#eab308";
  return "#22c55e";
}

const SKILLS = [
  { key: "skill_technical", label: "Técnica" },
  { key: "skill_physical",  label: "Física" },
  { key: "skill_tactical",  label: "Táctica" },
  { key: "skill_mental",    label: "Mental" },
  { key: "skill_attack",    label: "Ataque" },
  { key: "skill_defense",   label: "Defensa" },
];

const EMPTY_FORM = {
  report_date: new Date().toISOString().split("T")[0],
  scout_name: "", season: "", match_observed: "",
  summary: "", strengths: "", weaknesses: "",
  recommendation: "seguir_viendo", overall_rating: 0,
  skill_technical: 0, skill_physical: 0, skill_tactical: 0,
  skill_mental: 0, skill_attack: 0, skill_defense: 0,
};

const REC_LABELS = { fichar: "Fichar", seguir_viendo: "Seguir viendo", descartar: "Descartar" };
const REC_COLORS = { fichar: "text-green-600", seguir_viendo: "text-blue-600", descartar: "text-gray-500" };

async function generatePDF(report, player) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const granate = [139, 26, 43];
  let y = 20;

  // Header
  doc.setFillColor(...granate);
  doc.rect(0, 0, 210, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("INFORME DE SCOUTING", 10, 8);
  doc.text(report.report_date || "", 190, 8, { align: "right" });

  y = 22;
  doc.setTextColor(0, 0, 0);

  // Player name
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.setTextColor(...granate);
  doc.text(`${player.first_name} ${player.last_name}`, 10, y + 10);

  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.setTextColor(80, 80, 80);
  const infos = [
    player.current_club && `Club: ${player.current_club}`,
    player.position && `Pos: ${player.position}`,
    player.birth_date && `Nacimiento: ${player.birth_date}`,
    player.modality && `Modalidad: ${player.modality === "futbol_7" ? "F7" : "F11"}`,
  ].filter(Boolean);
  doc.text(infos.join("  ·  "), 10, y + 18);
  y += 30;

  // Scout info
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Scout: ${report.scout_name}  |  Temporada: ${report.season || "—"}  |  Partido: ${report.match_observed || "—"}`, 10, y);
  y += 10;

  // Overall rating
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(10, y, 90, 18, 3, 3, "F");
  doc.setFontSize(10);
  doc.setTextColor(...granate);
  doc.setFont(undefined, "bold");
  doc.text(`Valoración global: ${report.overall_rating || 0}/5`, 15, y + 6);
  const stars = "★".repeat(report.overall_rating || 0) + "☆".repeat(5 - (report.overall_rating || 0));
  doc.setFontSize(14);
  doc.text(stars, 15, y + 14);

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(110, y, 90, 18, 3, 3, "F");
  doc.setFontSize(10);
  doc.setTextColor(...granate);
  doc.text(`Recomendación: ${REC_LABELS[report.recommendation] || "—"}`, 115, y + 11);
  y += 26;

  // Skills
  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...granate);
  doc.text("ATRIBUTOS", 10, y);
  y += 6;
  doc.setFont(undefined, "normal");
  doc.setFontSize(9);

  SKILLS.forEach((sk, i) => {
    const v = report[sk.key] || 0;
    const x = i % 2 === 0 ? 10 : 110;
    if (i % 2 === 0 && i > 0) y += 14;
    doc.setTextColor(80, 80, 80);
    doc.text(sk.label, x, y + 4);
    doc.setFillColor(220, 220, 220);
    doc.rect(x + 30, y, 60, 5, "F");
    const pct = (v / 10) * 60;
    const r = v <= 3 ? 239 : v <= 5 ? 249 : v <= 7 ? 234 : 34;
    const g = v <= 3 ? 68 : v <= 5 ? 115 : v <= 7 ? 179 : 197;
    const b = v <= 3 ? 68 : v <= 5 ? 22 : v <= 7 ? 8 : 94;
    doc.setFillColor(r, g, b);
    doc.rect(x + 30, y, pct, 5, "F");
    doc.setTextColor(...granate);
    doc.setFont(undefined, "bold");
    doc.text(`${v}/10`, x + 94, y + 4);
    doc.setFont(undefined, "normal");
  });
  if (SKILLS.length % 2 !== 0) y += 14; else y += 14;
  y += 6;

  // Text sections
  const sections = [
    { label: "RESUMEN", text: report.summary },
    { label: "PUNTOS FUERTES", text: report.strengths },
    { label: "ÁREAS DE MEJORA", text: report.weaknesses },
  ];

  sections.forEach(({ label, text }) => {
    if (!text) return;
    doc.setFont(undefined, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...granate);
    doc.text(label, 10, y);
    y += 5;
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(text, 190);
    doc.text(lines, 10, y);
    y += lines.length * 5 + 6;
    if (y > 270) { doc.addPage(); y = 20; }
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`Generado el ${new Date().toLocaleDateString("es")}`, 10, 290);

  doc.save(`informe_${player.first_name}_${player.last_name}_${report.report_date}.pdf`);
}

export default function PlayerReportsTab({ playerId, player }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pdfLoading, setPdfLoading] = useState(null);

  const { data: reports = [] } = useQuery({
    queryKey: ["scouting_reports", playerId],
    queryFn: () => base44.entities.ScoutingReport.filter({ player_id: playerId }),
    enabled: !!playerId,
  });

  const sorted = [...reports].sort((a, b) => (b.report_date || "").localeCompare(a.report_date || ""));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ScoutingReport.create({ ...data, player_id: playerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouting_reports", playerId] });
      setFormOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Informe creado." });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScoutingReport.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouting_reports", playerId] });
      setFormOpen(false);
      setEditing(null);
      toast({ title: "Informe actualizado." });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScoutingReport.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouting_reports", playerId] });
      setDeleteId(null);
      toast({ title: "Informe eliminado." });
    },
  });

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (r) => {
    setEditing(r.id);
    setForm({
      report_date: r.report_date || "", scout_name: r.scout_name || "",
      season: r.season || "", match_observed: r.match_observed || "",
      summary: r.summary || "", strengths: r.strengths || "",
      weaknesses: r.weaknesses || "", recommendation: r.recommendation || "seguir_viendo",
      overall_rating: r.overall_rating || 0,
      skill_technical: r.skill_technical || 0, skill_physical: r.skill_physical || 0,
      skill_tactical: r.skill_tactical || 0, skill_mental: r.skill_mental || 0,
      skill_attack: r.skill_attack || 0, skill_defense: r.skill_defense || 0,
    });
    setFormOpen(true);
  };

  const handleSave = () => {
    if (editing) updateMutation.mutate({ id: editing, data: form });
    else createMutation.mutate(form);
  };

  const handleDownloadPDF = async (report) => {
    setPdfLoading(report.id);
    try {
      await generatePDF(report, player);
    } catch (err) {
      toast({ title: "Error al generar PDF", description: err.message, variant: "destructive" });
    } finally {
      setPdfLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
          {reports.length} informe{reports.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={openNew} className="text-white" style={{ background: "var(--granate)" }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo informe
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No hay informes registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
                      {r.report_date ? new Date(r.report_date).toLocaleDateString("es") : "Sin fecha"}
                    </span>
                    {r.scout_name && <span className="text-xs text-gray-500">por {r.scout_name}</span>}
                    {r.season && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.season}</span>}
                    {r.recommendation && (
                      <span className={`text-xs font-semibold ${REC_COLORS[r.recommendation]}`}>● {REC_LABELS[r.recommendation]}</span>
                    )}
                  </div>
                  {r.overall_rating > 0 && <StarDisplay value={r.overall_rating} />}
                  {r.match_observed && <p className="text-xs text-gray-500 mt-1">📋 {r.match_observed}</p>}
                  {r.summary && <p className="text-sm text-gray-700 mt-2 line-clamp-2">{r.summary}</p>}
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                    {r.strengths && <span>✅ {r.strengths.substring(0, 60)}{r.strengths.length > 60 ? "..." : ""}</span>}
                    {r.weaknesses && <span>⚠️ {r.weaknesses.substring(0, 60)}{r.weaknesses.length > 60 ? "..." : ""}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleDownloadPDF(r)}
                    disabled={pdfLoading === r.id}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600"
                    title="Descargar PDF"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
              {editing ? "Editar informe" : "Nuevo informe"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Fecha *</Label><Input type="date" value={form.report_date} onChange={e => set("report_date", e.target.value)} /></div>
              <div><Label className="text-xs">Scout *</Label><Input value={form.scout_name} onChange={e => set("scout_name", e.target.value)} /></div>
              <div><Label className="text-xs">Temporada</Label><Input value={form.season} onChange={e => set("season", e.target.value)} placeholder="2024-2025" /></div>
              <div><Label className="text-xs">Partido observado</Label><Input value={form.match_observed} onChange={e => set("match_observed", e.target.value)} /></div>
            </div>
            <div>
              <Label className="text-xs">Valoración global</Label>
              <div className="mt-1"><StarPicker value={form.overall_rating} onChange={v => set("overall_rating", v)} /></div>
            </div>
            <div>
              <Label className="text-xs">Recomendación</Label>
              <Select value={form.recommendation} onValueChange={v => set("recommendation", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fichar">Fichar</SelectItem>
                  <SelectItem value="seguir_viendo">Seguir viendo</SelectItem>
                  <SelectItem value="descartar">Descartar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Habilidades (1-10)</p>
            <div className="grid grid-cols-2 gap-3">
              {SKILLS.map(sk => (
                <div key={sk.key}>
                  <Label className="text-xs">{sk.label}</Label>
                  <Input type="number" min="0" max="10" value={form[sk.key]} onChange={e => set(sk.key, Number(e.target.value))} />
                </div>
              ))}
            </div>
            <div><Label className="text-xs">Resumen</Label><Textarea rows={3} value={form.summary} onChange={e => set("summary", e.target.value)} /></div>
            <div><Label className="text-xs">Puntos fuertes</Label><Textarea rows={2} value={form.strengths} onChange={e => set("strengths", e.target.value)} /></div>
            <div><Label className="text-xs">Áreas de mejora</Label><Textarea rows={2} value={form.weaknesses} onChange={e => set("weaknesses", e.target.value)} /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => { setFormOpen(false); setEditing(null); }} className="flex-1">Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={!form.report_date || !form.scout_name || createMutation.isPending || updateMutation.isPending}
                className="flex-1 text-white" style={{ background: "var(--granate)" }}
              >
                {createMutation.isPending || updateMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar informe?</AlertDialogTitle>
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