import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, File, Trash2, Calendar, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const DOCUMENT_TYPES = [
  { value: "examen_medico", label: "Examen Médico" },
  { value: "autorizacion_legal", label: "Autorización Legal" },
  { value: "copia_identificacion", label: "Copia de Identificación" },
  { value: "seguro", label: "Seguro" },
  { value: "consentimiento_padres", label: "Consentimiento de Padres" },
  { value: "otro", label: "Otro" },
];

const TYPE_COLORS = {
  examen_medico: { bg: "#f0fdf4", text: "#16a34a", icon: "🏥" },
  autorizacion_legal: { bg: "#f3f4f6", text: "#4b5563", icon: "⚖️" },
  copia_identificacion: { bg: "#fef3c7", text: "#b45309", icon: "🪪" },
  seguro: { bg: "#dbeafe", text: "#0284c7", icon: "🛡️" },
  consentimiento_padres: { bg: "#ede9fe", text: "#7c3aed", icon: "👨‍👩‍👧" },
  otro: { bg: "#f5f5f5", text: "#6b7280", icon: "📄" },
};

export default function DocumentsSection({ playerId }) {
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

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    const expiry = parseISO(expiryDate);
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiry <= thirtyDaysLater && expiry > today;
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return parseISO(expiryDate) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Documentos</h3>
          <p className="text-sm text-gray-500 mt-1">Gestiona exámenes médicos y documentación legal</p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="text-white"
          style={{ background: "var(--granate)" }}
        >
          <FileUp className="w-4 h-4 mr-2" /> Subir
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <File className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Sin documentos</p>
          <p className="text-gray-400 text-sm mt-1">Sube documentación importante del jugador</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const typeInfo = TYPE_COLORS[doc.document_type] || TYPE_COLORS.otro;
            const expired = isExpired(doc.expiry_date);
            const expiringSoon = isExpiringSoon(doc.expiry_date);

            return (
              <div
                key={doc.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                style={{ borderTop: `3px solid ${typeInfo.text}` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center text-lg shrink-0"
                      style={{ background: typeInfo.bg }}
                    >
                      {typeInfo.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{doc.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {DOCUMENT_TYPES.find((t) => t.value === doc.document_type)?.label}
                      </p>
                      {doc.upload_date && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Subido: {format(parseISO(doc.upload_date), "d MMM yyyy", { locale: es })}
                        </p>
                      )}
                      {doc.expiry_date && (
                        <div
                          className="text-xs mt-1 flex items-center gap-1"
                          style={{
                            color: expired ? "#dc2626" : expiringSoon ? "#ea580c" : "#16a34a",
                          }}
                        >
                          <Calendar className="w-3 h-3" />
                          {expired && "Expirado"}
                          {expiringSoon && !expired && "Vence pronto"}
                          {!expired && !expiringSoon && "Vigente"}
                          : {format(parseISO(doc.expiry_date), "d MMM yyyy", { locale: es })}
                        </div>
                      )}
                      {doc.notes && <p className="text-xs text-gray-600 mt-2">{doc.notes}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => setDeleteId(doc.id)}
                      className="p-2 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
              <Button
                type="submit"
                disabled={uploading || !form.file || !form.document_type || !form.title}
                className="text-white"
                style={{ background: "var(--granate)" }}
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