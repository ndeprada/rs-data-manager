// Figuras del TFM de un indicador del modelo de juego: botón «Ver imágenes», tira con sus pies y ampliación.
import React from "react";
import { ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/i18n";

export function ImagesToggle({ count, open, onClick }) {
  const t = useT();
  return (
    <button type="button" aria-expanded={open} onClick={onClick}
      className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--granate)] hover:underline">
      <ImageIcon className="w-3.5 h-3.5" />
      {open ? t("Ocultar imágenes") : t("Ver imágenes ({n})", { n: count })}
    </button>
  );
}

export function ImagesStrip({ images, label, onZoom }) {
  const t = useT();
  return (
    <div className="basis-full flex gap-2 overflow-x-auto pb-1" data-testid="model-images">
      {images.map((im) => (
        <figure key={im.id} className="shrink-0 m-0">
          <button type="button" onClick={() => onZoom(im)} title={t("Ampliar")} className="block rounded overflow-hidden border border-gray-200 bg-gray-50">
            <img src={im.src} alt={im.caption ? t(im.caption) : label} loading="lazy" draggable={false} className="h-36 w-auto block" />
          </button>
          {im.caption && <figcaption className="text-[10px] text-gray-500 leading-tight mt-0.5 max-w-[10rem]">{t(im.caption)}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

export function ImageZoom({ image, label, onClose }) {
  const t = useT();
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-white border-gray-200 max-w-3xl w-[96vw] p-3 sm:p-4">
        <DialogHeader><DialogTitle className="text-base">{label}{image.caption ? ` · ${t(image.caption)}` : ""}</DialogTitle></DialogHeader>
        <img src={image.src} alt={image.caption ? t(image.caption) : label} className="mx-auto max-h-[78vh] w-auto max-w-full rounded border border-gray-200" />
      </DialogContent>
    </Dialog>
  );
}
