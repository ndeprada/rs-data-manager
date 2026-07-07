import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Image, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

const EMPTY_FORM = { image_url: "", caption: "", uploaded_date: new Date().toISOString().split("T")[0], match_context: "" };

export default function PlayerImageTab({ playerId }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState("url"); // "url" | "file"
  const [lightbox, setLightbox] = useState(null);

  const { data: images = [], isLoading } = useQuery({
    queryKey: ["scouting_images", playerId],
    queryFn: () => base44.entities.ScoutingImage.filter({ player_id: playerId }, "-created_date"),
    enabled: !!playerId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ScoutingImage.create({ ...data, player_id: playerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouting_images", playerId] });
      setFormOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Imagen añadida correctamente." });
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, image_url: file_url }));
    setUploading(false);
  };

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  if (isLoading) return <div className="flex justify-center p-8"><div className="w-6 h-6 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
          {images.length} imagen{images.length !== 1 ? "es" : ""}
        </p>
        <Button size="sm" onClick={() => setFormOpen(true)} className="text-white" style={{ background: "var(--granate)" }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Subir imagen
        </Button>
      </div>

      {images.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Image className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No hay imágenes registradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map(img => (
            <div key={img.id} className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div
                className="aspect-square cursor-pointer overflow-hidden bg-gray-100"
                onClick={() => setLightbox(img)}
              >
                <img src={img.image_url} alt={img.caption || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="p-2">
                {img.caption && <p className="text-xs text-gray-700 font-medium line-clamp-1">{img.caption}</p>}
                {img.match_context && <p className="text-[10px] text-gray-400">{img.match_context}</p>}
                {img.uploaded_date && <p className="text-[10px] text-gray-400">{new Date(img.uploaded_date).toLocaleDateString("es")}</p>}
              </div>
              <button
                onClick={() => setDeleteId(img.id)}
                className="absolute top-1.5 right-1.5 p-1 bg-white/80 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-3xl max-h-[90vh] text-center" onClick={e => e.stopPropagation()}>
            <img src={lightbox.image_url} alt={lightbox.caption} className="max-h-[80vh] max-w-full object-contain rounded-xl" />
            {lightbox.caption && <p className="text-white mt-3 text-sm">{lightbox.caption}</p>}
            {lightbox.match_context && <p className="text-gray-400 text-xs mt-1">{lightbox.match_context}</p>}
          </div>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Añadir imagen</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setUploadMode("url")}
                className={`flex-1 py-1.5 text-xs font-bold uppercase rounded-lg border transition-colors ${uploadMode === "url" ? "border-red-800 text-red-800 bg-red-50" : "border-gray-200 text-gray-400"}`}>
                URL
              </button>
              <button type="button" onClick={() => setUploadMode("file")}
                className={`flex-1 py-1.5 text-xs font-bold uppercase rounded-lg border transition-colors ${uploadMode === "file" ? "border-red-800 text-red-800 bg-red-50" : "border-gray-200 text-gray-400"}`}>
                Subir archivo
              </button>
            </div>

            {uploadMode === "url" ? (
              <div><Label className="text-xs">URL de imagen *</Label><Input value={form.image_url} onChange={e => set("image_url", e.target.value)} placeholder="https://..." required={uploadMode === "url"} /></div>
            ) : (
              <div>
                <Label className="text-xs">Seleccionar archivo</Label>
                <div className="mt-1">
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-400 transition-colors">
                    {uploading ? <Loader className="w-5 h-5 text-gray-400 animate-spin" /> : <Image className="w-5 h-5 text-gray-400" />}
                    <span className="text-sm text-gray-500">{form.image_url && !uploading ? "Imagen lista" : "Haz clic para subir"}</span>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                  </label>
                  {form.image_url && <img src={form.image_url} alt="" className="mt-2 w-full h-32 object-cover rounded-lg" />}
                </div>
              </div>
            )}

            <div><Label className="text-xs">Pie de foto</Label><Input value={form.caption} onChange={e => set("caption", e.target.value)} placeholder="Descripción de la imagen" /></div>
            <div><Label className="text-xs">Contexto del partido</Label><Input value={form.match_context} onChange={e => set("match_context", e.target.value)} /></div>
            <div><Label className="text-xs">Fecha</Label><Input type="date" value={form.uploaded_date} onChange={e => set("uploaded_date", e.target.value)} /></div>

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || uploading || !form.image_url} className="flex-1 text-white" style={{ background: "var(--granate)" }}>
                {createMutation.isPending ? "Guardando..." : "Añadir"}
              </Button>
            </div>
          </form>
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