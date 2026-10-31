import React, { useMemo, useState } from "react";
import { Download, Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { boardSpeed, isAnimation, normalizeBoard } from "@/lib/board";
import { VIDEO_FORMATS, VIDEO_FPS, VIDEO_QUALITIES } from "@/lib/videoSize";
import Board from "./BoardSvg";
import { boardToPngBlob, downloadBlob } from "./exportPng";
import { canRecordVideo } from "./exportVideo";

const slug = (s) => (s || "tarea").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tarea";

// Lo último elegido para el vídeo se recuerda en este navegador
const PREF_KEY = "rs_board_video";
const PREF0 = { quality: 1080, fps: 30, format: "fit" };
const readPref = () => {
  try { return { ...PREF0, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}") }; } catch { return PREF0; }
};
const savePref = (p) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* sin almacenamiento */ } };

function Choice({ label, options, value, onPick }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onPick(o.id)}
            className={`h-7 px-2 rounded-md border text-xs font-semibold ${value === o.id ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Botones para descargar el dibujo: imagen (PNG) del fotograma indicado y, si es una animación, vídeo (calidad, fps y formato).
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
  const [open, setOpen] = useState(false);
  const [pref, setPref] = useState(readPref);
  const base = slug(filename);
  const idx = Math.min(frame, b.frames.length - 1);
  const pick = (patch) => setPref((p) => { const n = { ...p, ...patch }; savePref(n); return n; });

  const png = async () => {
    setBusy("png");
    setError("");
    try {
      const blob = await boardToPngBlob(<Board board={b} els={b.frames[idx].els} />, { width: 2400 });
      downloadBlob(blob, `${base}${anim ? `-${idx + 1}` : ""}.png`);
    } catch (err) {
      setError(err?.message || "No se pudo descargar la imagen");
    } finally {
      setBusy(null);
    }
  };
  const video = async () => {
    setOpen(false);
    setBusy("video");
    setProgress(0);
    setError("");
    try {
      const { boardToVideo } = await import("./exportVideo");
      const { blob, ext } = await boardToVideo(b, { speed: boardSpeed(b), quality: pref.quality, fps: pref.fps, format: pref.format, onProgress: setProgress });
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
        <Popover open={open} onOpenChange={(o) => !busy && setOpen(o)}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline" className={btn} disabled={!!busy || !videoOk} title={videoOk ? "Descargar la animación como vídeo" : "Este navegador no puede crear vídeos"} aria-label="Descargar vídeo">
              {busy === "video" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Film className="w-3.5 h-3.5" />}
              {!compact && <span>{busy === "video" ? `Creando… ${Math.round(progress * 100)}%` : "Vídeo"}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2.5 p-3" align="end" data-testid="video-options">
            <Choice label="Calidad" options={VIDEO_QUALITIES} value={pref.quality} onPick={(quality) => pick({ quality })} />
            <Choice label="Fotogramas por segundo" options={VIDEO_FPS.map((f) => ({ id: f, label: String(f) }))} value={pref.fps} onPick={(fps) => pick({ fps })} />
            <Choice label="Formato" options={VIDEO_FORMATS} value={pref.format} onPick={(format) => pick({ format })} />
            {pref.quality >= 1440 && <p className="text-[11px] text-gray-500">2K y 4K tardan más en crearse y pesan más.</p>}
            <Button type="button" size="sm" className="w-full h-8 gap-1 text-xs" onClick={video} data-testid="video-create"><Film className="w-3.5 h-3.5" /> Crear vídeo</Button>
          </PopoverContent>
        </Popover>
      )}
      {error && <span className="text-[11px] text-red-600 basis-full" role="alert">{error}</span>}
    </div>
  );
}
