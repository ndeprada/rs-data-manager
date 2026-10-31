import React from "react";
import Board, { styleOf } from "./BoardSvg";
import { animationDuration, elsAtTime, lookOf, normalizeBoard } from "@/lib/board";
import { boardSvgMarkup, loadSvgImage } from "./exportPng";
import { videoFrameSize } from "@/lib/videoSize";

// Vídeo de la animación de la pizarra.
// 1) Si el navegador tiene WebCodecs (Chrome, Edge, Safari 17+), se pinta fotograma a fotograma y se codifica en MP4 H.264
//    sin depender del reloj: sale con los fps exactos elegidos y admite hasta 4K / 60 fps, aunque pintar cada fotograma tarde.
// 2) Si no, se graba en tiempo real con MediaRecorder (como antes): MP4 si el navegador sabe, si no WebM.

// El MP4 sin códec indicado se deja para el final: según el navegador puede salir en un códec que muchos reproductores no abren
// (Safari, que no graba WebM, sí lo necesita y graba H.264).
const TYPES = [
  ["video/mp4;codecs=avc1.42E01E", "mp4"],
  ["video/mp4;codecs=avc1", "mp4"],
  ["video/webm;codecs=vp9", "webm"],
  ["video/webm;codecs=vp8", "webm"],
  ["video/webm", "webm"],
  ["video/mp4", "mp4"],
];

export function pickVideoType() {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined" || !HTMLCanvasElement.prototype.captureStream) return null;
  for (const [mime, ext] of TYPES) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return null;
}
const hasWebCodecs = () => typeof window !== "undefined" && typeof window.VideoEncoder === "function" && typeof window.VideoFrame === "function";
export const canRecordVideo = () => hasWebCodecs() || !!pickVideoType();

// H.264: perfiles de más a menos exigente; el nivel 5.1/5.2 hace falta para 4K
const AVC = ["avc1.640034", "avc1.640033", "avc1.4d0034", "avc1.4d0033", "avc1.640028", "avc1.4d0028", "avc1.42e028", "avc1.42001f"];
async function pickEncoder(width, height, fps, bitrate) {
  for (const codec of AVC) {
    const config = { codec, width, height, bitrate, framerate: fps, avc: { format: "avc" } };
    try {
      const r = await window.VideoEncoder.isConfigSupported(config);
      if (r?.supported) return r.config || config;
    } catch { /* se prueba el siguiente */ }
  }
  return null;
}

const bitrateOf = (w, h, fps) => Math.round(Math.min(60_000_000, Math.max(3_000_000, w * h * fps * 0.12)));

/**
 * board     dibujo guardado (formato nuevo o antiguo)
 * speed     ms que dura cada paso entre fotogramas
 * quality   altura de referencia: 720, 1080, 1440 (2K) o 2160 (4K)
 * fps       15, 25, 30 o 60
 * format    "fit" (el campo tal cual), "landscape" (16:9) o "portrait" (9:16)
 * onProgress(0..1)
 * Devuelve { blob, ext }.
 */
export async function boardToVideo(board, { speed = 1500, quality = 1080, fps = 30, format = "fit", onProgress } = {}) {
  const b = normalizeBoard(board);
  const total = animationDuration(b, { speed });
  if (!total) throw new Error("Para crear un vídeo hacen falta al menos dos fotogramas.");
  const probe = await boardSvgMarkup(<Board board={b} els={b.frames[0].els} />, 1000);
  const size = videoFrameSize({ format, quality, ratio: probe.width / probe.height });
  if (hasWebCodecs()) {
    const out = await encodeOffline(b, total, { speed, fps, size, onProgress });
    if (out) return out;
  }
  return recordRealtime(b, total, { speed, fps, size, onProgress });
}

// Pinta un instante de la animación en el canvas: el dibujo centrado, con el fondo del campo alrededor si sobra sitio.
function painter(b, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  const bg = styleOf(lookOf(b.look))?.surround || styleOf(lookOf(b.look))?.bg || "#ffffff";
  const draw = async (ms, speed) => {
    const { svg, width, height } = await boardSvgMarkup(<Board board={b} els={elsAtTime(b, ms, { speed })} />, size.inner.width);
    const img = await loadSvgImage(svg);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size.width, size.height);
    const k = Math.min(size.inner.width / width, size.inner.height / height);
    const w = width * k, h = height * k;
    ctx.drawImage(img, (size.width - w) / 2, (size.height - h) / 2, w, h);
  };
  return { canvas, draw };
}

async function encodeOffline(b, total, { speed, fps, size, onProgress }) {
  const bitrate = bitrateOf(size.width, size.height, fps);
  const config = await pickEncoder(size.width, size.height, fps, bitrate);
  if (!config) return null;
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: "avc", width: size.width, height: size.height, frameRate: fps }, fastStart: "in-memory" });
  let failure = null;
  const encoder = new window.VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failure = e; } });
  encoder.configure(config);
  const { canvas, draw } = painter(b, size);
  const count = Math.max(2, Math.round((total / 1000) * fps) + 1);
  const step = 1_000_000 / fps; // microsegundos
  for (let i = 0; i < count; i++) {
    if (failure) break;
    await draw(Math.min(total, (i * 1000) / fps), speed);
    const frame = new window.VideoFrame(canvas, { timestamp: Math.round(i * step), duration: Math.round(step) });
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    // no dejar que se acumulen fotogramas sin codificar (4K gasta mucha memoria)
    while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 5));
    onProgress?.(Math.min(0.99, (i + 1) / count));
  }
  if (!failure) await encoder.flush();
  try { encoder.close(); } catch { /* ya cerrado */ }
  if (failure) return null;
  muxer.finalize();
  onProgress?.(1);
  return { blob: new Blob([target.buffer], { type: "video/mp4" }), ext: "mp4" };
}

async function recordRealtime(b, total, { speed, fps, size, onProgress }) {
  const type = pickVideoType();
  if (!type) throw new Error("Este navegador no puede crear vídeos. Prueba con Chrome, Edge o Safari actualizados.");
  const { canvas, draw } = painter(b, size);
  await draw(0, speed);
  const probe = canvas.captureStream(0);
  const manual = typeof probe.getVideoTracks()[0]?.requestFrame === "function";
  probe.getTracks().forEach((t) => t.stop());
  const stream = canvas.captureStream(manual ? 0 : fps);
  const track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: bitrateOf(size.width, size.height, fps) });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((resolve) => { rec.onstop = resolve; });
  rec.start(250);
  const t0 = performance.now();
  let ms = 0;
  // El tiempo del vídeo es el tiempo real: si pintar tarda, salen menos fotogramas por segundo pero la duración es la correcta
  while (ms < total) {
    await draw(ms, speed);
    if (manual) track.requestFrame();
    ms = performance.now() - t0;
    onProgress?.(Math.min(0.99, ms / total));
  }
  await draw(total, speed);
  if (manual) track.requestFrame();
  await new Promise((r) => setTimeout(r, 250));
  rec.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  onProgress?.(1);
  return { blob: new Blob(chunks, { type: type.mime.split(";")[0] }), ext: type.ext };
}
