import React, { useState } from "react";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn } from "lucide-react";

const BG_COLORS = [
  { label: "Blanco", value: "#ffffff" },
  { label: "Gris claro", value: "#f3f4f6" },
  { label: "Negro", value: "#000000" },
  { label: "Granate", value: "#6b1f28" },
  { label: "Azul marino", value: "#1e3a5f" },
  { label: "Transparente", value: "transparent" },
];

export default function ImageCropDialog({ open, onOpenChange, imageSrc, onConfirm, isLoading }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [bgColor, setBgColor] = useState("#ffffff");

  const onCropComplete = (croppedArea, cap) => {
    setCroppedAreaPixels(cap);
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels || !imageSrc) return;

    const image = new Image();
    image.src = imageSrc;
    await new Promise(resolve => { image.onload = resolve; });

    const canvas = document.createElement("canvas");
    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;
    const ctx = canvas.getContext("2d");

    // Fill background first
    if (bgColor !== "transparent") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );

    const mimeType = bgColor === "transparent" ? "image/png" : "image/jpeg";
    const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, 0.95));
    const ext = bgColor === "transparent" ? "png" : "jpg";
    const file = new File([blob], `photo.${ext}`, { type: mimeType });
    await onConfirm(file);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
            Ajustar foto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {imageSrc && (
            <div className="relative w-full h-72 rounded-lg overflow-hidden" style={{ background: bgColor === "transparent" ? "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0 0 / 16px 16px" : bgColor }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
          )}

          {/* Background color picker */}
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Fondo de la foto</p>
            <div className="flex flex-wrap gap-2">
              {BG_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setBgColor(c.value)}
                  title={c.label}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${bgColor === c.value ? "border-gray-800 scale-110" : "border-gray-200 hover:border-gray-400"}`}
                  style={{
                    background: c.value === "transparent"
                      ? "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0 0 / 10px 10px"
                      : c.value,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Zoom */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <ZoomIn className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Zoom</span>
            </div>
            <Slider
              value={[zoom]}
              onValueChange={(value) => setZoom(value[0])}
              min={1}
              max={3}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-gray-400 text-right">{zoom.toFixed(2)}x</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            style={{ background: "var(--granate)" }}
            className="text-white"
          >
            {isLoading ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}