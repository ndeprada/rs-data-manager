// Análisis de vídeo · seguimiento automático de un jugador fotograma a fotograma.
// Lógica pura (trabaja sobre {data, width, height} RGBA, como ImageData), probada en tests/videoTracker.test.mjs.
//
// Cómo funciona: al empezar se guarda la «foto» del jugador (un recuadro de su cuerpo, de pies a cabeza) y en cada
// fotograma se busca alrededor de donde debería estar (posición anterior + su velocidad) el recuadro que más se le
// parece (correlación normalizada en color). La foto se va actualizando poco a poco para seguir los cambios de postura,
// sin olvidar la original. Si el parecido cae mucho varias veces seguidas, se da por perdido.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const BODY_RATIO = 0.42; // ancho del recuadro del cuerpo / alto

// Recuadro del cuerpo (en píxeles) con los pies en (fx, fy) y una altura h
export function bodyBox(fx, fy, h) {
  const w = Math.max(6, h * BODY_RATIO);
  return { x: fx - w / 2, y: fy - h, w, h };
}

function makeGrid(h) {
  const w = Math.max(6, h * BODY_RATIO);
  const step = Math.max(1, Math.round(w / 11));
  const pts = [];
  for (let dy = -Math.round(h); dy <= 0; dy += step) for (let dx = -Math.round(w / 2); dx <= Math.round(w / 2); dx += step) pts.push([dx, dy]);
  return { pts, step, w };
}

// Valores RGB del recuadro con los pies en (fx, fy); null si se sale de la imagen
function sample(img, grid, fx, fy) {
  const { data, width, height } = img; const n = grid.pts.length; const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = Math.round(fx + grid.pts[i][0]), y = Math.round(fy + grid.pts[i][1]);
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    const o = (y * width + x) * 4; out[i * 3] = data[o]; out[i * 3 + 1] = data[o + 1]; out[i * 3 + 2] = data[o + 2];
  }
  return out;
}

function normalize(v) {
  let m = 0; for (let i = 0; i < v.length; i++) m += v[i]; m /= v.length;
  let s = 0; const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) { out[i] = v[i] - m; s += out[i] * out[i]; }
  const nrm = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) out[i] /= nrm;
  return out;
}

// Correlación de un recuadro candidato con dos plantillas ya normalizadas, sin crear arrays
function score(img, grid, fx, fy, T0, Ta) {
  const { data, width, height } = img; const P = grid.pts; const n = P.length;
  let m = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.round(fx + P[i][0]), y = Math.round(fy + P[i][1]);
    if (x < 0 || y < 0 || x >= width || y >= height) return -2;
    const o = (y * width + x) * 4; m += data[o] + data[o + 1] + data[o + 2];
  }
  m /= n * 3;
  let s = 0, a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const o = ((Math.round(fy + P[i][1])) * width + Math.round(fx + P[i][0])) * 4;
    for (let c = 0; c < 3; c++) { const v = data[o + c] - m; s += v * v; a += v * T0[i * 3 + c]; b += v * Ta[i * 3 + c]; }
  }
  if (s < 1e-6) return 0;
  const nrm = Math.sqrt(s);
  return 0.5 * (a / nrm) + 0.5 * (b / nrm);
}

export function createTracker(img, fx, fy, h, opts = {}) {
  const grid = makeGrid(h);
  const raw = sample(img, grid, clamp(fx, grid.w / 2, img.width - 1 - grid.w / 2), clamp(fy, h, img.height - 1));
  if (!raw) return null;
  const T0 = normalize(raw); let Ta = Float32Array.from(T0);
  let x = fx, y = fy, vx = 0, vy = 0, misses = 0;
  const minScore = opts.minScore ?? 0.3, maxMisses = opts.maxMisses ?? 4;

  function update(frame, gap = 1) {
    const px = x + vx * gap, py = y + vy * gap;
    const R = Math.max(grid.w * 0.9, 10) * Math.min(3, Math.max(1, gap));
    const g = Math.max(1, grid.step);
    let best = -3, bx = px, by = py;
    const consider = (cx, cy) => {
      const s = score(frame, grid, cx, cy, T0, Ta);
      if (s < -1) return;
      const d = Math.hypot(cx - px, cy - py) / R;
      const e = s - 0.15 * d * d; // los que están más cerca de donde debería estar, ganan en caso de duda
      if (e > best) { best = e; bx = cx; by = cy; }
    };
    for (let dy = -R; dy <= R; dy += g) for (let dx = -R; dx <= R; dx += g) consider(px + dx, py + dy);
    const cx0 = bx, cy0 = by;
    for (let dy = -g; dy <= g; dy++) for (let dx = -g; dx <= g; dx++) if (dx || dy) consider(cx0 + dx, cy0 + dy);
    const raw = score(frame, grid, bx, by, T0, Ta);
    // ajuste por debajo del píxel: parábola por el mejor punto y sus vecinos (quita el «salto» de píxel en píxel)
    if (raw >= minScore) {
      const para = (sm, s0, sp) => { const den = sm - 2 * s0 + sp; return den < -1e-6 ? clamp((0.5 * (sm - sp)) / den, -0.5, 0.5) : 0; };
      const sxm = score(frame, grid, bx - 1, by, T0, Ta), sxp = score(frame, grid, bx + 1, by, T0, Ta);
      const sym = score(frame, grid, bx, by - 1, T0, Ta), syp = score(frame, grid, bx, by + 1, T0, Ta);
      if (sxm > -1 && sxp > -1) bx += para(sxm, raw, sxp);
      if (sym > -1 && syp > -1) by += para(sym, raw, syp);
    }
    if (raw < minScore) {
      misses++;
      // sin buena coincidencia: se sigue la inercia un momento, más despacio
      x = px; y = py; vx *= 0.5; vy *= 0.5;
      return { x, y, score: raw, lost: misses >= maxMisses };
    }
    misses = 0;
    const nvx = (bx - x) / gap, nvy = (by - y) / gap;
    vx = 0.6 * vx + 0.4 * nvx; vy = 0.6 * vy + 0.4 * nvy;
    x = bx; y = by;
    if (raw > 0.55) { const cur = sample(frame, grid, x, y); if (cur) { const cn = normalize(cur); for (let i = 0; i < Ta.length; i++) Ta[i] = 0.85 * Ta[i] + 0.15 * cn[i]; Ta = normalize(Ta); } }
    return { x, y, score: raw, lost: false };
  }

  return { update, get x() { return x; }, get y() { return y; }, box: () => bodyBox(x, y, h) };
}
