// Iconos cuadrados a partir de cualquier escudo (14/11/2026, Nacho: «en la pestaña del navegador, el logo de la app
// sale deformado»). El escudo subido en Configuración mide 997 × 1280: el navegador, el móvil y la app instalada
// lo estiraban para hacerlo cuadrado. Aquí se centra sin deformar en un cuadrado (con margen y fondo si se pide)
// y se reduce al tamaño pedido. Solo PNG; sin importaciones de la app (se prueba en Node).
import { decode, encode } from 'fast-png';

// Cualquier PNG (gris, gris+alfa, RGB, RGBA, paleta, 1–16 bits) → RGBA de 8 bits
export function toRgba(img) {
  const { width: w, height: h, depth = 8, channels = 4, palette } = img;
  const src = img.data;
  const out = new Uint8ClampedArray(w * h * 4);
  if (palette) {
    const rowBytes = Math.ceil((w * depth) / 8);
    const packed = depth < 8 && src.length < w * h;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let idx;
        if (packed) {
          const bit = x * depth;
          const byte = src[y * rowBytes + (bit >> 3)];
          idx = (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
        } else idx = src[y * w + x];
        const c = palette[idx] || [0, 0, 0, 0];
        const o = (y * w + x) * 4;
        out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = c.length > 3 ? c[3] : 255;
      }
    }
    return { width: w, height: h, data: out };
  }
  const max = (1 << depth) - 1;
  const k = 255 / max;
  for (let i = 0; i < w * h; i += 1) {
    const v = (n) => Math.round(src[i * channels + n] * k);
    const o = i * 4;
    if (channels >= 3) { out[o] = v(0); out[o + 1] = v(1); out[o + 2] = v(2); }
    else { out[o] = out[o + 1] = out[o + 2] = v(0); }
    out[o + 3] = channels === 4 ? v(3) : channels === 2 ? v(1) : 255;
  }
  return { width: w, height: h, data: out };
}

// Centra la imagen en un cuadrado de `size` px sin deformarla. `pad` = margen por cada lado (fracción del lado);
// `bg` = [r, g, b] para un fondo opaco (sin él, transparente). Reduce con media por zonas (alfa premultiplicado).
export function squareIcon(rgba, size, { pad = 0, bg = null } = {}) {
  const { width: w, height: h, data } = rgba;
  const S = Math.max(1, Math.round(size));
  const out = new Uint8ClampedArray(S * S * 4);
  if (bg) for (let i = 0; i < S * S; i += 1) { out[i * 4] = bg[0]; out[i * 4 + 1] = bg[1]; out[i * 4 + 2] = bg[2]; out[i * 4 + 3] = 255; }
  const inner = S * (1 - 2 * pad);
  const scale = inner / Math.max(w, h);
  const cw = w * scale, ch = h * scale;
  const ox = (S - cw) / 2, oy = (S - ch) / 2;
  const x0 = Math.max(0, Math.floor(ox)), x1 = Math.min(S, Math.ceil(ox + cw));
  const y0 = Math.max(0, Math.floor(oy)), y1 = Math.min(S, Math.ceil(oy + ch));
  for (let ty = y0; ty < y1; ty += 1) {
    const sy0 = (ty - oy) / scale, sy1 = (ty + 1 - oy) / scale;
    const a0 = Math.max(0, Math.floor(sy0)), a1 = Math.min(h, Math.max(a0 + 1, Math.ceil(sy1)));
    for (let tx = x0; tx < x1; tx += 1) {
      const sx0 = (tx - ox) / scale, sx1 = (tx + 1 - ox) / scale;
      const b0 = Math.max(0, Math.floor(sx0)), b1 = Math.min(w, Math.max(b0 + 1, Math.ceil(sx1)));
      // Cuánto de este píxel cae dentro de la imagen (bordes del escudo con media cobertura)
      const part = (lo, hi, max) => Math.max(0, Math.min(1, (Math.min(hi, max) - Math.max(lo, 0)) / (hi - lo)));
      const cover = part(sx0, sx1, w) * part(sy0, sy1, h);
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = a0; sy < a1; sy += 1) {
        for (let sx = b0; sx < b1; sx += 1) {
          const i = (sy * w + sx) * 4;
          const al = data[i + 3];
          r += data[i] * al; g += data[i + 1] * al; b += data[i + 2] * al; a += al; n += 1;
        }
      }
      if (!n) continue;
      const alpha = (a / n) * Math.min(1, cover);
      const o = (ty * S + tx) * 4;
      if (a === 0 || alpha <= 0) continue;
      const cr = r / a, cg = g / a, cb = b / a;
      if (bg) {
        const f = alpha / 255;
        out[o] = Math.round(cr * f + out[o] * (1 - f));
        out[o + 1] = Math.round(cg * f + out[o + 1] * (1 - f));
        out[o + 2] = Math.round(cb * f + out[o + 2] * (1 - f));
      } else {
        out[o] = Math.round(cr); out[o + 1] = Math.round(cg); out[o + 2] = Math.round(cb); out[o + 3] = Math.round(alpha);
      }
    }
  }
  return { width: S, height: S, data: out };
}

// PNG (bytes) → PNG cuadrado (bytes). Lanza si no es un PNG.
export function squarePng(bytes, size, opts) {
  const img = toRgba(decode(bytes));
  // Un icono ya cuadrado y sin transparencia (p. ej. escudo sobre fondo de color) se reduce tal cual: sin margen ni fondo
  const opaque = img.data.every((v, i) => (i & 3) !== 3 || v === 255);
  const sq = squareIcon(img, size, opaque && img.width === img.height ? {} : opts);
  return Buffer.from(encode({ width: sq.width, height: sq.height, data: new Uint8Array(sq.data.buffer), channels: 4, depth: 8 }));
}

export const isPng = (buf) => buf && buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
