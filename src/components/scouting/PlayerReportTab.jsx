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

function skillColor(value) {
  if (!value) return "#e5e7eb";
  if (value <= 3) return "#ef4444";
  if (value <= 5) return "#f97316";
  if (value <= 7) return "#eab308";
  return "#22c55e";
}

function StarDisplay({ value }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={`text-base ${i <= value ? "text-yellow-400" : "text-gray-200"}`}>★</span>
      ))}
    </span>
  );
}

function SkillBarSmall({ label, value }) {
  const color = skillColor(value);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className="h-1.5 rounded-full" style={{ width: `${(value || 0) * 10}%`, background: color }} />
      </div>
      <span className="text-xs font-bold w-6 text-right shrink-0" style={{ color }}>{value || 0}</span>
    </div>
  );
}

const EMPTY_FORM = {
  report_date: new Date().toISOString().split("T")[0], scout_name: "", season: "", match_observed: "",
  summary: "", strengths: "", weaknesses: "", recommendation: "seguir_viendo",
  skill_technical: "", skill_physical: "", skill_tactical: "", skill_mental: "", skill_attack: "", skill_defense: "", overall_rating: "",
};

const REC_LABELS = { fichar: "Fichar", seguir_viendo: "Seguir viendo", descartar: "Descartar" };
const REC_COLORS = { fichar: "bg-green-100 text-green-700", seguir_viendo: "bg-blue-100 text-blue-700", descartar: "bg-gray-100 text-gray-500" };

function generatePDF(report, player) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    // Fallback: open print dialog with formatted content
    const win = window.open("", "_blank");
    const skillBar = (label, value) => `
      <div style="margin:4px 0;display:flex;align-items:center;gap:8px;">
        <span style="width:100px;font-size:11px;color:#555;">${label}</span>
        <div style="flex:1;background:#eee;height:8px;border-radius:4px;overflow:hidden;">
          <div style="width:${(value||0)*10}%;height:8px;background:#6b1f28;border-radius:4px;"></div>
        </div>
        <span style="font-size:11px;font-weight:bold;color:#6b1f28;width:24px;text-align:right;">${value||0}</span>
      </div>`;
    const stars = (v) => [1,2,3,4,5].map(i => `<span style="color:${i<=(v||0)?'#f59e0b':'#e5e7eb'};font-size:18px;">★</span>`).join("");
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Informe Scouting</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;color:#111;}h1{color:#6b1f28;margin:0;}h2{color:#6b1f28;font-size:14px;margin:20px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px;}p{margin:4px 0;font-size:13px;color:#444;}.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:bold;background:#dbeafe;color:#1d4ed8;}</style>
      </head><body>
        <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;border-bottom:2px solid #6b1f28;padding-bottom:16px;">
          ${player?.photo_url ? `<img src="${player.photo_url}" style="width:80px;height:80px;object-fit:cover;border-radius:50%;">` : `<div style="width:80px;height:80px;border-radius:50%;background:#6b1f28;display:flex;align-items:center;justify-content:center;color:white;font-size:28px;font-weight:bold;">${player?.first_name?.[0]||""}${player?.last_name?.[0]||""}</div>`}
          <div>
            <h1>${player?.first_name || ""} ${player?.last_name || ""}</h1>
            <p>${player?.position || ""} · ${player?.current_club || ""}</p>
            <p style="font-size:12px;color:#888;">Informe: ${report.report_date} · Scout: ${report.scout_name}</p>
          </div>
        </div>
        <h2>Resumen ejecutivo</h2><p>${report.summary || "—"}</p>
        <h2>Valoración global</h2><div style="margin:8px 0;">${stars(report.overall_rating)}</div>
        <h2>Habilidades</h2>
        ${skillBar("Técnica", report.skill_technical)}
        ${skillBar("Física", report.skill_physical)}
        ${skillBar("Táctica", report.skill_tactical)}
        ${skillBar("Mental", report.skill_mental)}
        ${skillBar("Ataque", report.skill_attack)}
        ${skillBar("Defensa", report.skill_defense)}
        <h2>Puntos fuertes</h2><p>${report.strengths || "—"}</p>
        <h2>Áreas de mejora</h2><p>${report.weaknesses || "—"}</p>
        <h2>Recomendación final</h2><span class="badge">${REC_LABELS[report.recommendation] || report.recommendation}</span>
      </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
    return;
  }
}

export default function PlayerReportTab({ playerId, player }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["scouting_reports", playerId],
    queryFn: () => base44.entities.ScoutingReport.filter({ player_id: playerId }, "-report_date"),
    enabled: !!playerId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ScoutingReport.create({ ...data, player_id: playerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouting_reports", playerId] });
      closeForm();
      toast({ title: "Informe creado." });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScoutingReport.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouting_reports", playerId] });
      closeForm();
      toast({ title: "Informe actualizado." });
    },
    onError: (err) => toast({ title: "Error al guardar", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScoutingReport.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouting_reports", playerId] });
      setDeleteId(null);
      toast({ title: "Informe eliminado." });
    },
  });

  const openNew = () => { setForm(EMPTY_FORM); setEditingId(null); setFormOpen(true); };
  const openEdit = (r) => {
    setForm({
      report_date: r.report_date || "", scout_name: r.scout_name || "", season: r.season || "",
      match_observed: r.match_observed || "", summary: r.summary || "", strengths: r.strengths || "",
      weaknesses: r.weaknesses || "", recommendation: r.recommendation || "seguir_viendo",
      skill_technical: r.skill_technical ?? "", skill_physical: r.skill_physical ?? "",
      skill_tactical: r.skill_tactical ?? "", skill_mental: r.skill_mental ?? "",
      skill_attack: r.skill_attack ?? "", skill_defense: r.skill_defense ?? "", overall_rating: r.overall_rating ?? "",
    });
    setEditingId(r.id);
    setFormOpen(true);
  };
  const closeForm = () => { setFormOpen(false); setEditingId(null); setForm(EMPTY_FORM); };
  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const parseNum = (v) => v === "" || v == null ? null : Number(v);

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      skill_technical: parseNum(form.skill_technical), skill_physical: parseNum(form.skill_physical),
      skill_tactical: parseNum(form.skill_tactical), skill_mental: parseNum(form.skill_mental),
      skill_attack: parseNum(form.skill_attack), skill_defense: parseNum(form.skill_defense),
      overall_rating: parseNum(form.overall_rating),
    };
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  };

  if (isLoading) return <div className="flex justify-center p-8"><div className="w-6 h-6 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
          {reports.length} informe{reports.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={openNew} className="text-white" style={{ background: "var(--granate)" }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo informe
        </Button>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No hay informes registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => {
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-900 text-sm">{r.report_date ? new Date(r.report_date).toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</span>
                      {r.scout_name && <span className="text-xs text-gray-500">· {r.scout_name}</span>}
                      {r.season && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{r.season}</span>}
                      {r.recommendation && <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${REC_COLORS[r.recommendation]}`}>{REC_LABELS[r.recommendation]}</span>}
                    </div>
                    {r.match_observed && <p className="text-xs text-gray-500 mt-0.5">Partido: {r.match_observed}</p>}
                    {r.overall_rating && <div className="mt-1"><StarDisplay value={r.overall_rating} /></div>}
                    {r.summary && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{r.summary}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wide"
                      style={{ fontFamily: "var(--font-display)" }}>
                      {isExpanded ? "Menos" : "Ver"}
                    </button>
                    <button onClick={() => generatePDF(r, player)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700" title="Descargar PDF">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50">
                    {(r.skill_technical || r.skill_physical || r.skill_tactical || r.skill_mental || r.skill_attack || r.skill_defense) && (
                      <div className="space-y-1.5">
                        <SkillBarSmall label="Técnica" value={r.skill_technical} />
                        <SkillBarSmall label="Física" value={r.skill_physical} />
                        <SkillBarSmall label="Táctica" value={r.skill_tactical} />
                        <SkillBarSmall label="Mental" value={r.skill_mental} />
                        <SkillBarSmall label="Ataque" value={r.skill_attack} />
                        <SkillBarSmall label="Defensa" value={r.skill_defense} />
                      </div>
                    )}
                    {r.strengths && <div><p className="text-xs font-bold text-green-700 mb-0.5">✅ Puntos fuertes</p><p className="text-xs text-gray-600">{r.strengths}</p></div>}
                    {r.weaknesses && <div><p className="text-xs font-bold text-orange-600 mb-0.5">⚠️ Áreas de mejora</p><p className="text-xs text-gray-600">{r.weaknesses}</p></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
              {editingId ? "Editar informe" : "Nuevo informe de scouting"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Fecha *</Label><Input type="date" value={form.report_date} onChange={e => set("report_date", e.target.value)} required /></div>
              <div><Label className="text-xs">Scout *</Label><Input value={form.scout_name} onChange={e => set("scout_name", e.target.value)} required /></div>
              <div><Label className="text-xs">Temporada</Label><Input value={form.season} onChange={e => set("season", e.target.value)} placeholder="2024-2025" /></div>
              <div><Label className="text-xs">Partido observado</Label><Input value={form.match_observed} onChange={e => set("match_observed", e.target.value)} /></div>
              <div>
                <Label className="text-xs">Recomendación final</Label>
                <Select value={form.recommendation} onValueChange={v => set("recommendation", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fichar">Fichar</SelectItem>
                    <SelectItem value="seguir_viendo">Seguir viendo</SelectItem>
                    <SelectItem value="descartar">Descartar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Valoración global (1-5)</Label><Input type="number" min="1" max="5" value={form.overall_rating} onChange={e => set("overall_rating", e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">Resumen ejecutivo</Label><Textarea rows={3} value={form.summary} onChange={e => set("summary", e.target.value)} placeholder="Descripción general del jugador..." /></div>
            <div><Label className="text-xs">Puntos fuertes</Label><Textarea rows={2} value={form.strengths} onChange={e => set("strengths", e.target.value)} /></div>
            <div><Label className="text-xs">Áreas de mejora</Label><Textarea rows={2} value={form.weaknesses} onChange={e => set("weaknesses", e.target.value)} /></div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Habilidades (0-10)</p>
            <div className="grid grid-cols-2 gap-3">
              {[["skill_technical","Técnica"],["skill_physical","Física"],["skill_tactical","Táctica"],["skill_mental","Mental"],["skill_attack","Ataque"],["skill_defense","Defensa"]].map(([key, label]) => (
                <div key={key}><Label className="text-xs">{label}</Label><Input type="number" min="0" max="10" value={form[key]} onChange={e => set(key, e.target.value)} /></div>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={closeForm} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 text-white" style={{ background: "var(--granate)" }}>
                {createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar cambios" : "Crear informe"}
              </Button>
            </div>
          </form>
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