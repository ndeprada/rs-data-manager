import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload, Image, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

const EMPTY_FORM = { image_url: "", caption: "", uploaded_date: "", match_context: "" };

export default function PlayerImagesTab({ playerId }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);

  const { data: images = [] } = useQuery({
    queryKey: ["scouting_images", playerId],
    queryFn: () => base44.entities.ScoutingImage.filter({ player_id: playerId }),
    enabled: !!playerId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ScoutingImage.create({ ...data, player_id: playerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouting_images", playerId] });
      setFormOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Imagen añadida." });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScoutingImage.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouting_images", playerId] });
      setDeleteId(null);
      toast({ title: "Imagen eliminada." });
    },
  });

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("image_url", file_url);
    } catch (err) {
      toast({ title: "Error al subir imagen", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
          {images.length} imagen{images.length !== 1 ? "es" : ""}
        </p>
        <Button size="sm" onClick={() => setFormOpen(true)} className="text-white" style={{ background: "var(--granate)" }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Añadir imagen
        </Button>
      </div>

      {images.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Image className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No hay imágenes registradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map(img => (
            <div key={img.id} className="group relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shadow-sm">
              <img src={img.image_url} alt={img.caption || ""} className="w-full aspect-square object-cover" />
              <div className="p-2">
                {img.caption && <p className="text-xs font-medium text-gray-700 truncate">{img.caption}</p>}
                {img.uploaded_date && <p className="text-xs text-gray-400">{new Date(img.uploaded_date).toLocaleDateString("es")}</p>}
                {img.match_context && <p className="text-xs text-gray-500 truncate">{img.match_context}</p>}
              </div>
              <button
                onClick={() => setDeleteId(img.id)}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Añadir imagen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Upload or URL */}
            <div className="space-y-2">
              <Label className="text-xs">Subir imagen</Label>
              <label className="flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-400 transition-colors">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                {uploading ? <Loader className="w-5 h-5 text-gray-400 animate-spin" /> : <Upload className="w-5 h-5 text-gray-400" />}
                <span className="text-sm text-gray-500">{uploading ? "Subiendo..." : "Haz clic para seleccionar"}</span>
              </label>
              {form.image_url && <img src={form.image_url} alt="" className="h-24 rounded-lg object-cover" />}
            </div>
            <div className="flex items-center gap-2 text-gray-400 text-xs"><div className="flex-1 h-px bg-gray-200" />o URL<div className="flex-1 h-px bg-gray-200" /></div>
            <div><Label className="text-xs">URL de imagen</Label><Input value={form.image_url} onChange={e => set("image_url", e.target.value)} placeholder="https://..." /></div>
            <div><Label className="text-xs">Pie de foto</Label><Input value={form.caption} onChange={e => set("caption", e.target.value)} placeholder="Descripción de la imagen" /></div>
            <div><Label className="text-xs">Contexto del partido</Label><Input value={form.match_context} onChange={e => set("match_context", e.target.value)} /></div>
            <div><Label className="text-xs">Fecha</Label><Input type="date" value={form.uploaded_date} onChange={e => set("uploaded_date", e.target.value)} /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.image_url || createMutation.isPending}
                className="flex-1 text-white" style={{ background: "var(--granate)" }}
              >
                {createMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar imagen?</AlertDialogTitle>
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