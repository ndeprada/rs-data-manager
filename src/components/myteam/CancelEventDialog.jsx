import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Ban, RotateCcw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CANCEL_REASONS, cancelPatch, restorePatch, cancelWord, isCancelled, cancelText } from "@/lib/eventCancel";

/**
 * Marca un evento como cancelado/suspendido (con motivo) o lo restaura.
 * El evento sigue en el calendario, pero ya no cuenta como pendiente de pasar lista, convocar, etc.
 */
export default function CancelEventDialog({ open, onOpenChange, event, onDone }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("lluvia");
  const cancelled = isCancelled(event);
  useEffect(() => { if (open) setReason(event?.cancel_reason || "lluvia"); }, [open, event?.id, event?.cancel_reason]);

  const save = useMutation({
    mutationFn: (patch) => base44.entities.Event.update(event.id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      onDone?.();
      onOpenChange(false);
    },
  });

  if (!event) return null;
  const word = cancelWord(event).toLowerCase(); // «cancelado» o «suspendido»

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-gray-900 font-black text-base" style={{ fontFamily: "var(--font-display)" }}>
            {cancelled ? `Evento ${word}` : `Marcar como ${word}`}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{event.title}</span>
            {event.date && <> · <span className="capitalize">{format(new Date(event.date), "EEE d MMM · HH:mm", { locale: es })}</span></>}
          </DialogDescription>
        </DialogHeader>

        {cancelled ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 flex items-center gap-2"><Ban className="w-4 h-4 text-gray-500" /> {cancelText(event)}</p>
            <p className="text-xs text-gray-500">Si lo restauras vuelve a ser un evento normal y volverá a contar como pendiente si nadie lo gestiona.</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cerrar</Button>
              <Button type="button" variant="club" className="flex-1" disabled={save.isPending} onClick={() => save.mutate(restorePatch())}>
                <RotateCcw className="w-4 h-4 mr-1.5" /> {save.isPending ? "Restaurando…" : "Restaurar"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Motivo</p>
              <div className="flex flex-wrap gap-1.5">
                {CANCEL_REASONS.map((r) => (
                  <button key={r.value} type="button" onClick={() => setReason(r.value)}
                    className={`h-8 px-3 text-xs font-bold rounded-md border ${reason === r.value ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500">Seguirá en el calendario marcado como {word}, y no saldrá como pendiente de pasar lista o gestionar.</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Volver</Button>
              <Button type="button" variant="club" className="flex-1" disabled={save.isPending} onClick={() => save.mutate(cancelPatch(reason))}>
                <Ban className="w-4 h-4 mr-1.5" /> {save.isPending ? "Guardando…" : `Marcar ${word}`}
              </Button>
            </div>
          </div>
        )}
        {save.isError && <p className="text-xs text-red-600">No se ha podido guardar. Inténtalo de nuevo.</p>}
      </DialogContent>
    </Dialog>
  );
}
