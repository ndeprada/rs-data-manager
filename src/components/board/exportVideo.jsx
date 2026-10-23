import React from "react";
import Board from "./BoardSvg";
import { animationDuration, elsAtTime, normalizeBoard } from "@/lib/board";
import { boardSvgMarkup, loadSvgImage } from "./exportPng";

// Vídeo de la animación de la pizarra: se pinta fotograma a fotograma en un canvas y se graba con MediaRecorder.
// Formato: MP4 si el navegador sabe grabarlo (se abre en cualquier móvil); si no, WebM.

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
export const canRecordVideo = () => !!pickVideoType();

/**
 * board     dibujo guardado (formato nuevo o antiguo)
 * speed     ms que dura cada paso entre fotogramas
 * onProgress(0..1)
 * Devuelve { blob, ext }.
 */
export async function boardToVideo(board, { speed = 1500, width = 960, fps = 30, onProgress } = {}) {
  const type = pickVideoType();
  if (!type) throw new Error("Este navegador no puede crear vídeos. Prueba con Chrome, Edge o Safari actualizados.");
  const b = normalizeBoard(board);
  const total = animationDuration(b, { speed });
  if (!total) throw new Error("Para crear un vídeo hacen falta al menos dos fotogramas.");
  const frameSvg = (els) => boardSvgMarkup(<Board board={b} els={els} />, width);
  const first = await frameSvg(b.frames[0].els);
  const canvas = document.createElement("canvas");
  canvas.width = first.width;
  canvas.height = first.height;
  const ctx = canvas.getContext("2d");
  const draw = async (ms) => {
    const { svg } = await frameSvg(elsAtTime(b, ms, { speed }));
    const img = await loadSvgImage(svg);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  await draw(0);
  const probe = canvas.captureStream(0);
  const manual = typeof probe.getVideoTracks()[0]?.requestFrame === "function";
  probe.getTracks().forEach((t) => t.stop());
  const stream = canvas.captureStream(manual ? 0 : fps);
  const track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 4_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((resolve) => { rec.onstop = resolve; });
  rec.start(250);
  const t0 = performance.now();
  let ms = 0;
  // El tiempo del vídeo es el tiempo real: si pintar tarda, salen menos fotogramas por segundo pero la duración es la correcta
  while (ms < total) {
    await draw(ms);
    if (manual) track.requestFrame();
    ms = performance.now() - t0;
    onProgress?.(Math.min(0.99, ms / total));
  }
  await draw(total);
  if (manual) track.requestFrame();
  await new Promise((r) => setTimeout(r, 250));
  rec.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  onProgress?.(1);
  return { blob: new Blob(chunks, { type: type.mime.split(";")[0] }), ext: type.ext };
}
