// Análisis de vídeo · movimiento de la cámara (calibración con el vídeo en marcha).
// Lógica pura (sin DOM), probada en tests/videoCamera.test.mjs.
//
// La cámara de Veo (y la de casi todas las grabaciones de fútbol) gira y hace zoom desde un sitio fijo: de un
// fotograma a otro la imagen entera cambia con una homografía. Se buscan puntos con textura (líneas, gradas,
// vallas…) en un fotograma de referencia, se encuentran en cada fotograma nuevo y con los que se mueven igual
// (RANSAC: los jugadores, que se mueven por su cuenta, se descartan solos) se calcula esa homografía.
// Para no acumular error, se compara siempre con el fotograma de referencia y solo se cambia de referencia
// cuando la imagen ha cambiado bastante (zoom, giro o puntos que se salen).

import { homography, applyH, invertH } from "./videoPitch.js";

export const CAM_W = 640; // ancho de trabajo (px)
const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const norm = (H) => { const k = H[2][2] || 1; return H.map((r) => r.map((v) => v / k)); };

// ImageData (o {data, width, height} RGBA) → gris en Float32Array
export function toGray(img) {
  const { data, width: w, height: h } = img; const g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114;
  return { g, w, h };
}

// Puntos con textura en las dos direcciones (esquinas, cruces de líneas, bordes de gradas…), repartidos por una
// rejilla para que haya en toda la imagen. `avoid(x, y)` permite saltarse zonas (marcador sobreimpreso, etc.).
export function goodPoints(F, { cols = 12, rows = 8, half = 6, margin = 22, avoid } = {}) {
  const { g, w, h } = F;
  // gradientes y suma por ventana (7×7) del tensor de estructura con imágenes integrales
  const W1 = w + 1, Sxx = new Float64Array(W1 * (h + 1)), Syy = new Float64Array(W1 * (h + 1)), Sxy = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let rx = 0, ry = 0, rxy = 0;
    for (let x = 0; x < w; x++) {
      let ix = 0, iy = 0;
      if (x > 0 && x < w - 1 && y > 0 && y < h - 1) { const i = y * w + x; ix = (g[i + 1] - g[i - 1]) / 2; iy = (g[i + w] - g[i - w]) / 2; }
      rx += ix * ix; ry += iy * iy; rxy += ix * iy;
      const o = (y + 1) * W1 + x + 1;
      Sxx[o] = Sxx[o - W1] + rx; Syy[o] = Syy[o - W1] + ry; Sxy[o] = Sxy[o - W1] + rxy;
    }
  }
  const box = (S, x0, y0, x1, y1) => S[(y1 + 1) * W1 + x1 + 1] - S[y0 * W1 + x1 + 1] - S[(y1 + 1) * W1 + x0] + S[y0 * W1 + x0];
  const r = 3, score = (x, y) => {
    const a = box(Sxx, x - r, y - r, x + r, y + r), b = box(Syy, x - r, y - r, x + r, y + r), c = box(Sxy, x - r, y - r, x + r, y + r);
    return (a + b) / 2 - Math.sqrt(((a - b) / 2) ** 2 + c * c); // menor valor propio
  };
  const m = Math.max(margin, half + r + 2), cw = (w - 2 * m) / cols, ch = (h - 2 * m) / rows;
  const cand = [];
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let best = null;
    for (let y = Math.round(m + cy * ch); y < m + (cy + 1) * ch; y += 2) for (let x = Math.round(m + cx * cw); x < m + (cx + 1) * cw; x += 2) {
      if (avoid && avoid(x / w, y / h)) continue;
      const s = score(x, y); if (!best || s > best.s) best = { x, y, s };
    }
    if (best) cand.push(best);
  }
  if (!cand.length) return [];
  const top = [...cand].sort((a, b) => b.s - a.s)[Math.floor(cand.length * 0.2)]?.s || 0;
  const minS = Math.max(49 * 25, top * 0.06); // ventana de 49 px con un gradiente medio de 5 niveles de gris
  return cand.filter((p) => p.s >= minS).map((p) => ({ x: p.x, y: p.y }));
}

// Plantilla de un punto (ya centrada y normalizada para la correlación)
function makeTemplate(F, p, half) {
  const { g, w } = F; const n = (2 * half + 1) ** 2; const t = new Float32Array(n); let s = 0, k = 0;
  for (let oy = -half; oy <= half; oy++) for (let ox = -half; ox <= half; ox++) { const v = g[(p.y + oy) * w + p.x + ox]; t[k++] = v; s += v; }
  const mean = s / n; let q = 0; for (let i = 0; i < n; i++) { t[i] -= mean; q += t[i] * t[i]; }
  if (q < n * 9) return null; // plantilla casi lisa
  const sd = Math.sqrt(q); for (let i = 0; i < n; i++) t[i] /= sd;
  return t;
}
const para = (a, b, c) => { const d = a - 2 * b + c; return d < 0 ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * d))) : 0; };

// Busca cada punto `p` de la referencia en el fotograma F alrededor de donde lo pone la homografía Gp.
// Devuelve [{i, x, y, s}] (s = correlación). La plantilla se deforma con el zoom/giro local de Gp.
export function matchPoints(F, pts, temps, Gp, { half = 6, R = 12, minScore = 0.72, uniq = 0.05 } = {}) {
  const { g, w, h } = F; const out = []; const n = (2 * half + 1) ** 2;
  const offs = new Int32Array(n);
  pts.forEach((p, i) => {
    const t = temps[i]; if (!t) return;
    const q = applyH(Gp, p), qx1 = applyH(Gp, { x: p.x + 1, y: p.y }), qy1 = applyH(Gp, { x: p.x, y: p.y + 1 });
    const J = [qx1.x - q.x, qy1.x - q.x, qx1.y - q.y, qy1.y - q.y];
    const ext = half * Math.max(Math.abs(J[0]) + Math.abs(J[1]), Math.abs(J[2]) + Math.abs(J[3])) + R + 2;
    if (!(q.x - ext >= 0 && q.y - ext >= 0 && q.x + ext < w && q.y + ext < h)) return;
    const cx = Math.round(q.x), cy = Math.round(q.y);
    let k = 0; for (let oy = -half; oy <= half; oy++) for (let ox = -half; ox <= half; ox++) offs[k++] = Math.round(J[2] * ox + J[3] * oy) * w + Math.round(J[0] * ox + J[1] * oy);
    const S = R * 2 + 1, sc = new Float32Array(S * S); let best = -2, bx = 0, by = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const base = (cy + dy) * w + cx + dx; let sf = 0, sff = 0, stf = 0;
      for (let j = 0; j < n; j++) { const v = g[base + offs[j]]; sf += v; sff += v * v; stf += t[j] * v; }
      const vr = sff - (sf * sf) / n; const s = vr > n ? stf / Math.sqrt(vr) : -1;
      sc[(dy + R) * S + dx + R] = s; if (s > best) { best = s; bx = dx; by = dy; }
    }
    if (best < minScore || Math.abs(bx) === R || Math.abs(by) === R) return; // flojo o en el borde de la búsqueda
    const at = (dx, dy) => sc[(dy + R) * S + dx + R];
    // único: si a más de 2 px hay otro sitio casi igual de bueno (una línea, un dibujo que se repite), no vale
    let second = -2;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (Math.max(Math.abs(dx - bx), Math.abs(dy - by)) > 2) { const v = at(dx, dy); if (v > second) second = v; }
    if (second > best - uniq) return;
    const fx = para(at(bx - 1, by), best, at(bx + 1, by)), fy = para(at(bx, by - 1), best, at(bx, by + 1));
    out.push({ i, x: cx + bx + fx, y: cy + by + fy, s: best });
  });
  return out;
}

// Homografía robusta (RANSAC con 4 puntos + ajuste final con todos los buenos). `rnd` para repetir en las pruebas.
export function ransacH(src, dst, { thr = 1.8, iters = 220, rnd = Math.random } = {}) {
  const n = src.length; if (n < 6) return null;
  let bestIn = null;
  const inliersOf = (H) => { const r = []; for (let k = 0; k < n; k++) { const q = applyH(H, src[k]); if (q.w > 0 && Math.hypot(q.x - dst[k].x, q.y - dst[k].y) < thr) r.push(k); } return r; };
  for (let it = 0; it < iters; it++) {
    const ids = new Set(); while (ids.size < 4) ids.add(Math.floor(rnd() * n));
    const a = [...ids]; const H = homography(a.map((k) => src[k]), a.map((k) => dst[k])); if (!H) continue;
    const inl = inliersOf(H); if (!bestIn || inl.length > bestIn.length) { bestIn = inl; if (inl.length > n * 0.9) break; }
  }
  if (!bestIn || bestIn.length < 6) return null;
  let H = homography(bestIn.map((k) => src[k]), bestIn.map((k) => dst[k])); if (!H) return null;
  const inl = inliersOf(H); if (inl.length >= bestIn.length) { const H2 = homography(inl.map((k) => src[k]), inl.map((k) => dst[k])); if (H2) { H = H2; bestIn = inl; } }
  return { H: norm(H), inliers: bestIn.length, n };
}

// Zoom aproximado de una homografía alrededor de un punto (raíz del determinante del jacobiano)
function scaleAt(H, p) {
  const q = applyH(H, p), a = applyH(H, { x: p.x + 1, y: p.y }), b = applyH(H, { x: p.x, y: p.y + 1 });
  return Math.sqrt(Math.abs((a.x - q.x) * (b.y - q.y) - (a.y - q.y) * (b.x - q.x)));
}

// Sigue la cámara desde el primer fotograma. update(F) → { ok, C } con C = primer fotograma → fotograma actual (px).
export function createCamTracker(F0, opts = {}) {
  const half = opts.half ?? 6, rnd = opts.rnd || Math.random;
  let key, pts, temps, G = I3(), prevG = I3(), T = I3(), lost = 0, base = 0;
  const setKey = (F) => {
    key = F; base = 0; pts = goodPoints(F, { half, avoid: opts.avoid }); temps = pts.map((p) => makeTemplate(F, p, half));
    const keep = temps.map((t, i) => (t ? i : -1)).filter((i) => i >= 0); pts = keep.map((i) => pts[i]); temps = keep.map((i) => temps[i]);
  };
  setKey(F0);
  if (pts.length < 8) return null;
  const n0 = () => pts.length;
  return {
    get points() { return pts.length; },
    update(F) {
      // predicción: mismo movimiento que en el paso anterior
      const step = invertH(prevG) ? mul(G, mul(invertH(prevG), G)) : G;
      let pred = norm(step), mm = matchPoints(F, pts, temps, pred, { half, R: 12 });
      if (mm.length < Math.max(8, n0() * 0.35)) { pred = G; mm = matchPoints(F, pts, temps, pred, { half, R: 26 }); }
      const fit = mm.length >= 6 ? ransacH(mm.map((m) => pts[m.i]), mm.map((m) => ({ x: m.x, y: m.y })), { rnd }) : null;
      if (!fit || fit.inliers < Math.max(8, (base || n0() * 0.5) * 0.35)) { lost++; return { ok: false, C: mul(G, T), inliers: fit?.inliers || 0, n: n0(), lost }; }
      lost = 0; const Gold = G; prevG = Gold; G = fit.H; if (!base) base = fit.inliers;
      const C = norm(mul(G, T));
      // nueva referencia cuando ya se parece poco: zoom/giro grande o pocos puntos todavía a la vista
      const Gi = invertH(G); const z = Gi ? scaleAt(G, applyH(Gi, { x: F.w / 2, y: F.h / 2 })) : 1;
      if (z < 0.85 || z > 1.18 || fit.inliers < Math.max(12, base * 0.6)) {
        // el fotograma anterior visto desde la referencia nueva (para seguir prediciendo el movimiento)
        prevG = Gi ? norm(mul(Gold, Gi)) : I3(); T = C; G = I3(); setKey(F);
        if (pts.length < 8) return { ok: false, C, inliers: 0, n: 0, lost: ++lost };
      }
      return { ok: true, C, inliers: fit.inliers, n: n0() };
    },
  };
}

// ---- guardar y leer el movimiento de la cámara de un corte ----
// Se guarda dónde acaban 4 puntos fijos de la imagen del primer fotograma (en fracciones 0..1): así se puede
// suavizar e interpolar como cualquier recorrido y la homografía se rehace con esos 4 puntos.
export const CAM_REF = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }];
export function camSample(vt, C, w, h) {
  const q = CAM_REF.map((r) => applyH(C, { x: r.x * w, y: r.y * h }));
  return { vt: +vt.toFixed(4), q: q.flatMap((p) => [+(p.x / w).toFixed(5), +(p.y / h).toFixed(5)]) };
}
// Homografía (fracciones) del primer fotograma al fotograma de `vt`; null fuera de lo analizado
export function camMatrixAt(cam, vt, tol = 0.25) {
  const s = cam?.samples; if (!s || s.length < 2) return null;
  if (vt < s[0].vt - tol || vt > s[s.length - 1].vt + tol) return null;
  let q;
  if (vt <= s[0].vt) q = s[0].q; else if (vt >= s[s.length - 1].vt) q = s[s.length - 1].q;
  else {
    let lo = 0, hi = s.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m].vt <= vt) lo = m; else hi = m; }
    const a = s[lo], b = s[hi], u = (vt - a.vt) / ((b.vt - a.vt) || 1); q = a.q.map((v, i) => v + (b.q[i] - v) * u);
  }
  const H = homography(CAM_REF, [0, 1, 2, 3].map((i) => ({ x: q[2 * i], y: q[2 * i + 1] })));
  return H ? norm(H) : null;
}
// Lo que se ve en el instante `from` → dónde se ve en `to` (fracciones). null si falta algún dato.
export function camWarp(cam, from, to) {
  const A = camMatrixAt(cam, from), B = camMatrixAt(cam, to); if (!A || !B) return null;
  const Ai = invertH(A); return Ai ? norm(mul(B, Ai)) : null;
}
// Suaviza el recorrido de los 4 puntos (temblor de medio píxel de un fotograma a otro)
export function smoothCam(samples, smooth) {
  if (samples.length < 3) return samples;
  const tracks = [0, 1, 2, 3].map((i) => smooth(samples.map((s) => ({ vt: s.vt, x: s.q[2 * i], y: s.q[2 * i + 1] }))));
  return samples.map((s, k) => ({ vt: s.vt, q: tracks.flatMap((t) => [+t[k].x.toFixed(5), +t[k].y.toFixed(5)]) }));
}
export { mul as mulH };
