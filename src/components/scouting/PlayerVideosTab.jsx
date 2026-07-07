import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ExternalLink, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

function getYouTubeId(url) {
  const m = url?.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?/\s]+)/);
  return m ? m[1] : null;
}

function getVimeoId(url) {
  const m = url?.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

const EMPTY_FORM = {
  title: "", url: "", platform: "youtube",
  match_context: "", observation_date: "", notes: "", tags: [],
};

export default function PlayerVideosTab({ playerId }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: videos = [] } = useQuery({
    queryKey: ["scouting_videos", playerId],
    queryFn: () => base44.entities.ScoutingVideo.filter({ player_id: playerId }),
    enabled: !!playerId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ScoutingVideo.create({ ...data, player_id: playerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouting_videos", playerId] });
      setFormOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Vídeo añadido." });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScoutingVideo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouting_videos", playerId] });
      setDeleteId(null);
      toast({ title: "Vídeo eliminado." });
    },
  });

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
          {videos.length} vídeo{videos.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={() => setFormOpen(true)} className="text-white" style={{ background: "var(--granate)" }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Añadir vídeo
        </Button>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Play className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No hay vídeos registrados</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {videos.map(v => {
            const ytId = getYouTubeId(v.url);
            const vimeoId = getVimeoId(v.url);
            return (
              <div key={v.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {ytId && (
                  <div className="aspect-video bg-black">
                    <iframe
                      src={`https://www.youtube.com/embed/${ytId}`}
                      className="w-full h-full"
                      allowFullScreen
                      title={v.title}
                    />
                  </div>
                )}
                {vimeoId && !ytId && (
                  <div className="aspect-video bg-black">
                    <iframe
                      src={`https://player.vimeo.com/video/${vimeoId}`}
                      className="w-full h-full"
                      allowFullScreen
                      title={v.title}
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{v.title}</p>
                      {v.match_context && <p className="text-xs text-gray-500 mt-0.5">📋 {v.match_context}</p>}
                      {v.observation_date && <p className="text-xs text-gray-400">{new Date(v.observation_date).toLocaleDateString("es")}</p>}
                      {v.notes && <p className="text-sm text-gray-600 mt-2">{v.notes}</p>}
                      {v.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {v.tags.map(tag => (
                            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!ytId && !vimeoId && (
                        <a href={v.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button onClick={() => setDeleteId(v.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Añadir vídeo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">Título *</Label><Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Ej: Goles jornada 10" /></div>
            <div><Label className="text-xs">URL del vídeo *</Label><Input value={form.url} onChange={e => set("url", e.target.value)} placeholder="https://youtube.com/watch?v=..." /></div>
            <div>
              <Label className="text-xs">Plataforma</Label>
              <Select value={form.platform} onValueChange={v => set("platform", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="vimeo">Vimeo</SelectItem>
                  <SelectItem value="otros">Otros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Contexto del partido</Label><Input value={form.match_context} onChange={e => set("match_context", e.target.value)} placeholder="Ej: S14A vs Martinenc" /></div>
            <div><Label className="text-xs">Fecha</Label><Input type="date" value={form.observation_date} onChange={e => set("observation_date", e.target.value)} /></div>
            <div><Label className="text-xs">Notas</Label><Textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.title || !form.url || createMutation.isPending}
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
            <AlertDialogTitle>¿Eliminar vídeo?</AlertDialogTitle>
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