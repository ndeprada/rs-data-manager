import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Upload } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const EVENT_TYPES = [
  { value: "entrenamiento",        label: "Entrenamiento" },
  { value: "entrenamiento_fisico", label: "Físico" },
  { value: "sesion_teorica",       label: "Sesión teórica" },
  { value: "sesion_video",         label: "Sesión de vídeo" },
  { value: "partido_liga",         label: "Partido de liga" },
  { value: "partido_amistoso",     label: "Partido amistoso" },
  { value: "torneo",               label: "Torneo" },
  { value: "reunion_equipo",       label: "Reunión de equipo" },
  { value: "reunion_jugador",      label: "Reunión con jugador" },
  { value: "reunion_capitanes",    label: "Reunión de capitanes" },
  { value: "stage",                label: "Stage" },
  { value: "concentracion",        label: "Concentración" },
  { value: "cena_equipo",          label: "Cena de equipo" },
  { value: "comida_equipo",        label: "Comida de equipo" },
];

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];

export default function EditEventDialog({ open, onOpenChange, event }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [seriesConfirm, setSeriesConfirm] = useState(false);
  const [pendingData, setPendingData] = useState(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);

  const { data: fields = [] } = useQuery({
    queryKey: ["fields"],
    queryFn: () => base44.entities.Field.list(),
  });

  useEffect(() => {
    if (event) {
      const dateObj = new Date(event.date);
      const endDateObj = event.end_date ? new Date(event.end_date) : null;
      setForm({
        type: event.type || "entrenamiento",
        title: event.title || "",
        date: format(dateObj, "yyyy-MM-dd"),
        time: format(dateObj, "HH:mm"),
        end_time: endDateObj ? format(endDateObj, "HH:mm") : "",
        location: event.location || "",
        field_id: event.field_id || "",
        opponent: event.opponent || "",
        opponent_logo_url: event.opponent_logo_url || "",
        notes: event.notes || "",
      });
    }
  }, [event]);

  const handleOpponentLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set("opponent_logo_url", file_url);
    setUploadingLogo(false);
  };

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const isMatch = MATCH_TYPES.includes(form.type);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Event.update(event.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onOpenChange(false);
    },
  });

  const updateSeriesMutation = useMutation({
    mutationFn: async (data) => {
      const allEvents = await base44.entities.Event.filter({ series_id: event.series_id });
      await Promise.all(allEvents.map(e => {
        // Keep each event's own date, only update time from form
        const originalDate = new Date(e.date);
        const [hh, mm] = form.time.split(":");
        originalDate.setHours(Number(hh), Number(mm), 0);

        let endDate = undefined;
        if (form.end_time) {
          const originalEnd = e.end_date ? new Date(e.end_date) : new Date(e.date);
          const [ehh, emm] = form.end_time.split(":");
          originalEnd.setFullYear(originalDate.getFullYear(), originalDate.getMonth(), originalDate.getDate());
          originalEnd.setHours(Number(ehh), Number(emm), 0);
          endDate = originalEnd.toISOString();
        }

        return base44.entities.Event.update(e.id, {
          ...data,
          date: originalDate.toISOString(),
          end_date: endDate,
        });
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setSeriesConfirm(false);
      onOpenChange(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Event.delete(event.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setConfirmDelete(false);
      onOpenChange(false);
    },
  });

  const buildData = () => {
    const dateStr = form.date;
    const endDate = form.end_time ? `${dateStr}T${form.end_time}:00` : undefined;
    return {
      type: form.type,
      title: form.title || (isMatch && form.opponent ? `vs ${form.opponent}` : EVENT_TYPES.find(t => t.value === form.type)?.label || ""),
      date: `${dateStr}T${form.time}:00`,
      end_date: endDate,
      location: form.location || undefined,
      field_id: form.field_id || undefined,
      opponent: isMatch ? (form.opponent || undefined) : undefined,
      opponent_logo_url: isMatch ? (form.opponent_logo_url || undefined) : undefined,
      notes: form.notes || undefined,
    };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = buildData();
    if (event.series_id) {
      setPendingData(data);
      setSeriesConfirm(true);
    } else {
      updateMutation.mutate(data);
    }
  };

  if (!event) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white border-gray-200 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="mb-1">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold" style={{ fontFamily: "var(--font-display)" }}>Editar evento</p>
              <DialogTitle className="text-gray-900 font-black text-lg" style={{ fontFamily: "var(--font-display)" }}>
                {event.title}
              </DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tipo */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Tipo de evento</p>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Rival (solo partidos) */}
            {isMatch && (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Rival</p>
                  <Input value={form.opponent} onChange={e => set("opponent", e.target.value)} placeholder="Nombre del rival…" className="border-gray-200" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Escudo del rival</p>
                  <div className="flex items-center gap-3">
                    {form.opponent_logo_url && (
                      <img src={form.opponent_logo_url} alt="Escudo rival" className="w-10 h-10 object-contain rounded border border-gray-200 p-0.5" />
                    )}
                    <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingLogo ? "Subiendo…" : (form.opponent_logo_url ? "Cambiar escudo" : "Subir escudo")}
                      <input type="file" accept="image/*" className="hidden" onChange={handleOpponentLogoUpload} disabled={uploadingLogo} />
                    </label>
                    {form.opponent_logo_url && (
                      <button type="button" onClick={() => set("opponent_logo_url", "")} className="text-xs text-red-400 hover:text-red-600">Quitar</button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Título */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Título</p>
              <Input value={form.title} onChange={e => set("title", e.target.value)} className="border-gray-200" />
            </div>

            {/* Fecha y hora */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Fecha</p>
                <input type="date" value={form.date} onChange={e => set("date", e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-200 bg-transparent text-sm shadow-sm px-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Inicio</p>
                <input type="time" value={form.time} onChange={e => set("time", e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-200 bg-transparent text-sm shadow-sm px-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Fin</p>
                <input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-200 bg-transparent text-sm shadow-sm px-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
            </div>

            {/* Lugar y campo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Lugar</p>
                <Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="Dirección…" className="border-gray-200" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Campo registrado</p>
                <Select value={form.field_id || "none"} onValueChange={v => set("field_id", v === "none" ? "" : v)}>
                  <SelectTrigger className="border-gray-200"><SelectValue placeholder="Sin campo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin campo asignado</SelectItem>
                    {fields.filter(f => f.available !== false).map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notas */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Notas</p>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="border-gray-200" placeholder="Observaciones…" />
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" size="icon" onClick={() => setConfirmDelete(true)} className="text-red-400 hover:text-red-600 hover:bg-red-50 border-red-200">
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={updateMutation.isPending} className="flex-1 text-white" style={{ background: "var(--granate)" }}>
                {updateMutation.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-red-600 hover:bg-red-700 text-white">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={seriesConfirm} onOpenChange={open => { if (!open) setSeriesConfirm(false); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Evento recurrente</AlertDialogTitle>
            <AlertDialogDescription>
              Este evento forma parte de una serie. ¿A qué eventos quieres aplicar los cambios?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => { setSeriesConfirm(false); updateMutation.mutate(pendingData); }}
              disabled={updateMutation.isPending}
            >
              Solo este evento
            </Button>
            <Button
              onClick={() => updateSeriesMutation.mutate(pendingData)}
              disabled={updateSeriesMutation.isPending}
              className="text-white"
              style={{ background: "var(--granate)" }}
            >
              {updateSeriesMutation.isPending ? "Guardando…" : "Todos los eventos de la serie"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}