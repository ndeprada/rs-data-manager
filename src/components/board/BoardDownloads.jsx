import React, { useMemo, useState } from "react";
import { Download, Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { boardSpeed, isAnimation, normalizeBoard } from "@/lib/board";
import Board from "./BoardSvg";
import { boardToPngBlob, downloadBlob } from "./exportPng";
import { canRecordVideo } from "./exportVideo";

const slug = (s) => (s || "tarea").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tarea";

/**
 * Botones para descargar el dibujo: imagen (PNG) del fotograma indicado y, si es una animación, vídeo.
 * board      dibujo guardado
 * frame      fotograma que se descarga como imagen
 * filename   nombre base del archivo
 * compact    solo iconos (para tarjetas)
 */
export default function BoardDownloads({ board, frame = 0, filename = "tarea", compact = false, className = "" }) {
  const b = useMemo(() => normalizeBoard(board), [board]);
  const anim = isAnimation(b);
  const [busy, setBusy] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const base = slug(filename);
  const idx = Math.min(frame, b.frames.length - 1);

  const png = async () => {
    setBusy("png");
    setError("");
    try {
      const blob = await boardToPngBlob(<Board board={b} els={b.frames[idx].els} />);
      downloadBlob(blob, `${base}${anim ? `-${idx + 1}` : ""}.png`);
    } catch (err) {
      setError(err?.message || "No se pudo descargar la imagen");
    } finally {
      setBusy(null);
    }
  };
  const video = async () => {
    setBusy("video");
    setProgress(0);
    setError("");
    try {
      const { boardToVideo } = await import("./exportVideo");
      const { blob, ext } = await boardToVideo(b, { speed: boardSpeed(b), onProgress: setProgress });
      downloadBlob(blob, `${base}.${ext}`);
    } catch (err) {
      setError(err?.message || "No se pudo crear el vídeo");
    } finally {
      setBusy(null);
    }
  };

  const videoOk = anim && canRecordVideo();
  const btn = compact ? "h-7 w-7 p-0" : "h-8 px-2 gap-1 text-xs";
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      <Button type="button" size="sm" variant="outline" className={btn} onClick={png} disabled={!!busy} title={anim ? "Descargar este fotograma como imagen" : "Descargar como imagen"} aria-label="Descargar imagen">
        {busy === "png" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {!compact && <span>Imagen</span>}
      </Button>
      {anim && (
        <Button type="button" size="sm" variant="outline" className={btn} onClick={video} disabled={!!busy || !videoOk} title={videoOk ? "Descargar la animación como vídeo" : "Este navegador no puede crear vídeos"} aria-label="Descargar vídeo">
          {busy === "video" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Film className="w-3.5 h-3.5" />}
          {!compact && <span>{busy === "video" ? `Creando… ${Math.round(progress * 100)}%` : "Vídeo"}</span>}
        </Button>
      )}
      {error && <span className="text-[11px] text-red-600 basis-full" role="alert">{error}</span>}
    </div>
  );
}
