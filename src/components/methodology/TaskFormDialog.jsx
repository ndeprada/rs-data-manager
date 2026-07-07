import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { GAME_MOMENTS, TACTICAL_ASPECTS, SESSION_PHASES, DIFFICULTY_LEVELS } from "./methodologyConfig";
import { useToast } from "@/components/ui/use-toast";
import FieldDrawingBoard from "./FieldDrawingBoard";

const TASK_TYPES = [
  { value: "parejas", label: "Parejas" },
  { value: "analitico", label: "Analítico" },
  { value: "finalizaciones", label: "Finalizaciones" },
  { value: "figura_pases", label: "Figura de pases" },
  { value: "rondo", label: "Rondo" },
  { value: "juego_posicion", label: "Juego de Posición" },
  { value: "juego_aplicacion", label: "Juego de Aplicación" },
  { value: "juego_posesion", label: "Juego de Posesión" },
  { value: "juego_situacion", label: "Juego de Situación" },
  { value: "partido", label: "Partido" },
  { value: "partido_reducido", label: "Partido reducido" },
  { value: "abp", label: "ABP" },
  { value: "preparacion_partido", label: "Preparación de Partido" },
  { value: "juego", label: "Juego" },
  { value: "activacion_sin_balon", label: "Activación sin balón" },
];

const EMPTY_TASK = {
  name: "", description: "", duration_minutes: 15,
  session_phase: "parte_principal", difficulty: "media",
  task_type: "",
  game_moment: "ninguno", tactical_aspect: "ninguno",
  notes: "", diagram_url: "", media_files: [],
  football_format: "ambos", players_count: "", space: "", tags: [],
  principles: "", sub_principles: "", corrections: "", scoring: "", variants: "",
  coaching_points_1e: "", coaching_points_ea_m: "", coaching_points_ea_i: ""
};

export { TASK_TYPES };

export default function TaskFormDialog({ open, onOpenChange, task, onSave, teams = [] }) {
  const [form, setForm] = useState(EMPTY_TASK);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (task) setForm({ ...EMPTY_TASK, ...task });
    else setForm(EMPTY_TASK);
  }, [task, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleUploadDiagram = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set("diagram_url", file_url);
    setUploading(false);
    toast({ title: "Diagrama subido correctamente" });
  };

  const handleUploadMedia = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const uploaded = await Promise.all(files.map(async f => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      const isVideo = f.type.startsWith("video/") || f.name.match(/\.(mp4|mov|avi|mkv)$/i);
      return { url: file_url, type: isVideo ? "video" : "image", name: f.name };
    }));
    set("media_files", [...(form.media_files || []), ...uploaded]);
    setUploading(false);
    toast({ title: `${uploaded.length} archivo(s) subido(s)` });
  };

  const removeMedia = (idx) => {
    set("media_files", form.media_files.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast({ title: "El nombre es obligatorio", variant: "destructive" }); return; }
    onSave({ ...form, duration_minutes: Number(form.duration_minutes) || 0 });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
            {task ? "Editar Tarea" : "Nueva Tarea"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nombre */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Nombre *</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Rondo 4v2 con comodines" className="mt-1" />
          </div>

          {/* Tipo de tarea */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Tipo de tarea</Label>
            <Select value={form.task_type || ""} onValueChange={v => set("task_type", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Descripción */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Descripción</Label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Describe el ejercicio, organización, reglas, variantes..." rows={3} className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Duración */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Duración (min)</Label>
              <Input type="number" min={1} max={120} value={form.duration_minutes}
                onChange={e => set("duration_minutes", e.target.value)} className="mt-1" />
            </div>

            {/* Fase */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Fase de sesión</Label>
              <Select value={form.session_phase} onValueChange={v => set("session_phase", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SESSION_PHASES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Momento del juego */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Momento del juego</Label>
              <Select value={form.game_moment} onValueChange={v => set("game_moment", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GAME_MOMENTS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Aspecto táctico */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Aspecto específico</Label>
              <Select value={form.tactical_aspect} onValueChange={v => set("tactical_aspect", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TACTICAL_ASPECTS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Dificultad */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Dificultad</Label>
              <Select value={form.difficulty} onValueChange={v => set("difficulty", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_LEVELS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Formato */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Formato</Label>
              <Select value={form.football_format} onValueChange={v => set("football_format", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="f7">Fútbol 7</SelectItem>
                  <SelectItem value="f11">Fútbol 11</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Jugadores */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Nº jugadores</Label>
              <Input type="number" min={1} value={form.players_count || ""}
                onChange={e => set("players_count", e.target.value)} placeholder="Ej: 12" className="mt-1" />
            </div>

            {/* Espacio */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Espacio / Dimensiones</Label>
              <Input value={form.space || ""} onChange={e => set("space", e.target.value)}
                placeholder="Ej: 20x30m" className="mt-1" />
            </div>
          </div>

          {/* Principios y subprincipios */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Principios</Label>
              <Textarea value={form.principles || ""} onChange={e => set("principles", e.target.value)}
                placeholder="Principios del juego que se trabajan..." rows={3} className="mt-1 text-xs" />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Subprincipios</Label>
              <Textarea value={form.sub_principles || ""} onChange={e => set("sub_principles", e.target.value)}
                placeholder="Subprincipios específicos..." rows={3} className="mt-1 text-xs" />
            </div>
          </div>

          {/* Correcciones */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Correcciones habituales</Label>
            <Textarea value={form.corrections || ""} onChange={e => set("corrections", e.target.value)}
              placeholder="Correcciones a realizar durante el ejercicio..." rows={2} className="mt-1 text-xs" />
          </div>

          {/* Puntuación */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Sistema de puntuación</Label>
            <Textarea value={form.scoring || ""} onChange={e => set("scoring", e.target.value)}
              placeholder="ATQ: gol = 1p, DEF: robo = 1p..." rows={2} className="mt-1 text-xs" />
          </div>

          {/* Puntos de entrenamiento */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Puntos de entrenamiento</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px] font-bold uppercase text-gray-400" style={{ color: "var(--granate)" }}>1E N</Label>
                <Textarea value={form.coaching_points_1e || ""} onChange={e => set("coaching_points_1e", e.target.value)}
                  rows={2} className="mt-0.5 text-xs" placeholder="Primer entrenador..." />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase" style={{ color: "var(--naranja)" }}>EA M</Label>
                <Textarea value={form.coaching_points_ea_m || ""} onChange={e => set("coaching_points_ea_m", e.target.value)}
                  rows={2} className="mt-0.5 text-xs" placeholder="EA Medio..." />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase text-blue-600">EA I</Label>
                <Textarea value={form.coaching_points_ea_i || ""} onChange={e => set("coaching_points_ea_i", e.target.value)}
                  rows={2} className="mt-0.5 text-xs" placeholder="EA Inicial..." />
              </div>
            </div>
          </div>

          {/* Variantes */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Variantes</Label>
            <Textarea value={form.variants || ""} onChange={e => set("variants", e.target.value)}
              placeholder="Variantes del ejercicio..." rows={2} className="mt-1 text-xs" />
          </div>

          {/* Notas */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Notas del entrenador</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Puntos de atención adicionales..." rows={2} className="mt-1" />
          </div>

          {/* Diagrama - Tablero de dibujo */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Diagrama / Dibujo sobre campo</Label>
            <div className="mt-2">
              <FieldDrawingBoard
                value={form.diagram_url}
                onChange={(dataUrl) => set("diagram_url", dataUrl)}
              />
            </div>
            {/* También permite subir imagen externa */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-gray-400">o sube una imagen:</span>
              <label className="flex items-center gap-1.5 px-2 py-1 border border-dashed border-gray-300 rounded cursor-pointer hover:border-gray-400 transition-colors text-[10px] text-gray-500">
                <Upload className="w-3 h-3" />
                {uploading ? "Subiendo..." : "Subir imagen"}
                <input type="file" accept="image/*" onChange={handleUploadDiagram} className="hidden" disabled={uploading} />
              </label>
              {form.diagram_url && form.diagram_url.startsWith("http") && (
                <div className="relative w-16 h-10 rounded border overflow-hidden bg-gray-50">
                  <img src={form.diagram_url} alt="diagrama" className="w-full h-full object-cover" />
                  <button onClick={() => set("diagram_url", "")} className="absolute top-0.5 right-0.5 bg-black/50 rounded-full p-0.5">
                    <X className="w-2 h-2 text-white" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Media */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Imágenes / Vídeos</Label>
            <div className="mt-1 space-y-2">
              {(form.media_files || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.media_files.map((m, i) => (
                    <div key={i} className="relative group w-20 h-14 rounded border bg-gray-50 overflow-hidden">
                      {m.type === "image"
                        ? <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[10px] text-gray-500 text-center px-1">{m.name}</div>
                      }
                      <button onClick={() => removeMedia(i)}
                        className="absolute top-0.5 right-0.5 bg-black/50 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors text-xs text-gray-500">
                {uploading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Añadir imágenes o vídeos
                <input type="file" multiple accept="image/*,video/*" onChange={handleUploadMedia} className="hidden" disabled={uploading} />
              </label>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
            <Button onClick={handleSave} className="flex-1 text-white" style={{ background: "var(--granate)" }} disabled={uploading}>
              {task ? "Guardar cambios" : "Crear tarea"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}