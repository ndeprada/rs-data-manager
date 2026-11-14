import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, Trash2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";
import { useT, useDateLocale } from "@/i18n";
import { BRAND, C as clubColor, REQUIRED_DOC_TYPES, brandDiff, fullBrand } from "@/lib/brand";
import { storeBrand } from "@/lib/brandBoot";
import { DOCUMENT_TYPE_LABELS } from "@/lib/injuryLabels";
import { docRows } from "@/lib/profileTabs";
import { Cols, th, td } from "./ProfileParts";

const DOCUMENT_TYPES = [
  { value: "examen_medico", label: "Examen Médico" },
  { value: "autorizacion_legal", label: "Autorización Legal" },
  { value: "copia_identificacion", label: "Copia de Identificación" },
  { value: "seguro", label: "Seguro" },
  { value: "consentimiento_padres", label: "Consentimiento de Padres" },
  { value: "otro", label: "Otro" },
];


export default function DocumentsSection({ playerId, minor = false, readOnly = false, canConfigure = false, mobile = false }) {
  const t = useT();
  const dfl = useDateLocale();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ document_type: "", title: "", file: null, expiry_date: "", notes: "" });
  const fileInputRef = useRef(null);

  const { data: documents = [] } = useQuery({
    queryKey: ["playerDocuments", playerId],
    queryFn: () => base44.entities.PlayerDocument.filter({ player_id: playerId }),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => base44.entities.PlayerDocument.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerDocuments", playerId] });
      setDialogOpen(false);
      setForm({ document_type: "", title: "", file: null, expiry_date: "", notes: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PlayerDocument.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerDocuments", playerId] });
      setDeleteId(null);
    },
  });

  const handleFileChange = (e) => {
    setForm({ ...form, file: e.target.files?.[0] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.file || !form.document_type || !form.title) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: form.file });
      await createMutation.mutateAsync({
        player_id: playerId,
        document_type: form.document_type,
        title: form.title,
        file_url,
        upload_date: new Date().toISOString().split("T")[0],
        expiry_date: form.expiry_date || null,
        notes: form.notes || null,
      });
    } finally {
      setUploading(false);
    }
  };

  const now = new Date();
  const [req, setReq] = useState(() => BRAND.requiredDocs || []);
  const [savingReq, setSavingReq] = useState(false);
  const { rows, rest, counts } = docRows(documents, req, { now, minor });
  const d = (x) => { try { return x ? format(parseISO(x), "d MMM yyyy", { locale: dfl }) : "—"; } catch { return "—"; } };
  const openUpload = (type) => { setForm({ document_type: type || "", title: type ? t(DOCUMENT_TYPE_LABELS[type] || "") : "", file: null, expiry_date: "", notes: "" }); setDialogOpen(true); };
  const toggleReq = async (k) => {
    const next = req.includes(k) ? req.filter((x) => x !== k) : [...req, k];
    setReq(next);
    setSavingReq(true);
    try {
      const { brand: saved = {} } = await base44.club.brand();
      const { brand } = await base44.club.saveBrand(brandDiff({ ...fullBrand(saved), requiredDocs: next }));
      storeBrand(brand);
      BRAND.requiredDocs = brand.requiredDocs || [];
    } catch { setReq(req); } finally { setSavingReq(false); }
  };
  const stateChip = (r) => {
    const map = { missing: [t("Falta"), "#FEE2E2", "#B91C1C"], expired: [t("Caducado"), "#FEE2E2", "#B91C1C"], soon: [t("Caduca en {n} días", { n: r.days }), "#FEF3C7", "#92400E"], ok: [t("En regla"), "#DCFCE7", "#15803D"] };
    const [label, bg, fg] = map[r.state];
    return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{label}</span>;
  };
  const head = (title, right) => (
    <div className="flex flex-wrap items-center" style={{ gap: 6, marginBottom: 8 }}>
      <h2 style={{ margin: 0, borderLeft: `3px solid ${clubColor.accent}`, paddingLeft: 7, lineHeight: 1 }}><span className="rs2-display" style={{ fontSize: 17, color: clubColor.primary }}>{title}</span></h2>
      {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
    </div>
  );
  const smallBtn = (label, onClick, primary, testId) => (
    <button type="button" onClick={onClick} data-testid={testId} style={{ font: "inherit", fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 8, border: `1px solid ${primary ? clubColor.primary : "#E6DEDD"}`, background: primary ? clubColor.primary : "#fff", color: primary ? "#fff" : clubColor.primary, whiteSpace: "nowrap" }}>{label}</button>
  );
  const row = (r, i) => (
    <tr key={r.doc?.id || r.type + i} data-testid={`doc-row-${r.type}`}>
      <td style={td({ fontWeight: 700 })}>{t(DOCUMENT_TYPE_LABELS[r.type] || DOCUMENT_TYPE_LABELS.otro)}</td>
      <td style={td({ color: r.doc ? "#4A3D3F" : "#9C8E90", maxWidth: 220 })}><span className="line-clamp-2">{r.doc?.title || "—"}{r.doc?.notes ? <span style={{ color: "#9C8E90" }}> · {r.doc.notes}</span> : null}</span></td>
      <td style={td({ whiteSpace: "nowrap", color: "#6B5E60" })}>{r.doc ? d(r.doc.upload_date) : "—"}</td>
      <td style={td({ whiteSpace: "nowrap", color: "#6B5E60" })}>{r.doc?.expiry_date ? d(r.doc.expiry_date) : "—"}</td>
      <td style={td()}>{stateChip(r)}</td>
      <td style={td({ textAlign: "right", whiteSpace: "nowrap" })}>
        {r.doc ? (
          <span className="inline-flex items-center" style={{ gap: 4 }}>
            <a href={r.doc.file_url} target="_blank" rel="noopener noreferrer" title={t("Ver")} style={{ padding: 4, color: "#6B5E60" }}><Download className="w-4 h-4" /></a>
            {!readOnly && (r.state === "soon" || r.state === "expired") && smallBtn(t("Renovar"), () => openUpload(r.type), false, `doc-renew-${r.type}`)}
            {!readOnly && <button type="button" onClick={() => setDeleteId(r.doc.id)} title={t("Eliminar")} style={{ padding: 4, border: 0, background: "none", color: "#9C8E90" }}><Trash2 className="w-4 h-4" /></button>}
          </span>
        ) : !readOnly && smallBtn(t("Subir"), () => openUpload(r.type), true, `doc-upload-${r.type}`)}
      </td>
    </tr>
  );
  const table = (list) => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr>{[t("Tipo"), t("Documento"), t("Subido"), t("Caduca"), t("Estado"), ""].map((h, i) => <th key={i} style={th()}>{h}</th>)}</tr></thead>
        <tbody>{list.map(row)}</tbody>
      </table>
    </div>
  );

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <Cols mobile={mobile} ratio="2.2fr 1fr"
        left={<>
          <section className="rs2-card" style={{ padding: "10px 14px" }} data-testid="docs-card">
            {head(t("Documentos del jugador"), !readOnly && <Button variant="club" size="sm" onClick={() => openUpload("")} data-testid="docs-upload"><FileUp className="w-3.5 h-3.5 mr-1" />{t("Subir documento")}</Button>)}
            {(rows.length + rest.length) > 0 && (
              <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 8 }}>
                {counts.missing > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#FEE2E2", color: "#B91C1C" }}>{t("{n} falta(n)", { n: counts.missing })}</span>}
                {counts.expired > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#FEE2E2", color: "#B91C1C" }}>{t("{n} caducado(s)", { n: counts.expired })}</span>}
                {counts.soon > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#FEF3C7", color: "#92400E" }}>{t("{n} caduca(n) pronto", { n: counts.soon })}</span>}
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#DCFCE7", color: "#15803D" }}>{t("{n} en regla", { n: counts.ok })}</span>
              </div>
            )}
            {rows.length + rest.length === 0 ? <p style={{ fontSize: 12, color: "#9C8E90", margin: 0 }}>{t("Sin documentos.")}</p> : table([...rows, ...rest])}
          </section>
        </>}
        right={
          <section className="rs2-card" style={{ padding: "10px 14px" }} data-testid="docs-required">
            {head(t("Lo que pide el club"))}
            <p style={{ fontSize: 12, color: "#4A3D3F", margin: "0 0 8px" }}>{t("Documentos que debe tener cada jugador. Los que faltan salen en rojo en la ficha de cada jugador.")}</p>
            <div className="flex flex-col" style={{ gap: 4 }}>
              {REQUIRED_DOC_TYPES.map((k) => (
                <label key={k} className="inline-flex items-center" style={{ gap: 6, fontSize: 12.5, cursor: canConfigure ? "pointer" : "default" }}>
                  <input type="checkbox" checked={req.includes(k)} disabled={!canConfigure || savingReq} onChange={() => toggleReq(k)} data-testid={`docs-req-${k}`} />
                  {t(DOCUMENT_TYPE_LABELS[k])}{k === "consentimiento_padres" && <span style={{ color: "#9C8E90" }}> ({t("menores")})</span>}
                </label>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#6B5E60", margin: "8px 0 0" }}>{canConfigure ? t("Vale para todo el club. Lo cambia la dirección.") : t("Lo elige la dirección para todo el club.")}</p>
          </section>
        } />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Subir Documento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700">Tipo de documento *</Label>
              <Select
                value={form.document_type}
                onValueChange={(v) => setForm({ ...form, document_type: v })}
              >
                <SelectTrigger className="border-gray-200">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ej: Examen médico 2026"
                className="border-gray-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Archivo *</Label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <FileUp className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">
                  {form.file ? form.file.name : "Selecciona un archivo"}
                </p>
                <p className="text-xs text-gray-500 mt-1">PDF, DOC, JPG, PNG</p>
              </button>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Fecha de expiración</Label>
              <Input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                className="border-gray-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Notas</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Observaciones adicionales..."
                className="border-gray-200"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button variant="club"
                type="submit"
                disabled={uploading || !form.file || !form.document_type || !form.title}
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo...</>
                ) : (
                  <>Subir Documento</>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}