// Tamaño del vídeo de la pizarra (sin importaciones de la app para poder probarlo en Node).
// quality = el lado corto en píxeles (720, 1080, 1440 = 2K, 2160 = 4K), como en «1080p».
// format  = "fit" (el dibujo tal cual, sin bandas), "landscape" (16:9) o "portrait" (9:16).
// ratio   = ancho / alto del dibujo.
// H.264 necesita medidas pares; `inner` es el hueco donde va el dibujo (centrado, con el fondo del campo alrededor).

export const VIDEO_QUALITIES = [
  { id: 720, label: "720p" },
  { id: 1080, label: "1080p" },
  { id: 1440, label: "2K" },
  { id: 2160, label: "4K" },
];
export const VIDEO_FPS = [15, 25, 30, 60];
export const VIDEO_FORMATS = [
  { id: "fit", label: "Ajustado al campo" },
  { id: "landscape", label: "Horizontal 16:9" },
  { id: "portrait", label: "Vertical 9:16" },
];

const even = (n) => Math.max(2, Math.round(n / 2) * 2);

export function videoFrameSize({ format = "fit", quality = 1080, ratio = 1 } = {}) {
  const q = VIDEO_QUALITIES.some((v) => v.id === quality) ? quality : 1080;
  const r = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const long = Math.round((q * 16) / 9);
  if (format === "landscape" || format === "portrait") {
    const width = even(format === "landscape" ? long : q);
    const height = even(format === "landscape" ? q : long);
    // el dibujo ocupa todo lo que puede sin deformarse
    const k = Math.min(width / r, height);
    return { width, height, inner: { width: even(k * r), height: even(k) } };
  }
  // ajustado: el lado corto del dibujo = calidad, sin pasar de 16:9 por el lado largo
  let width = r >= 1 ? q * r : q;
  let height = r >= 1 ? q : q / r;
  const over = Math.max(width, height) / long;
  if (over > 1) { width /= over; height /= over; }
  width = even(width); height = even(height);
  return { width, height, inner: { width, height } };
}
