import { test } from "node:test";
import assert from "node:assert/strict";
import { createCamTracker, goodPoints, ransacH, camSample, camMatrixAt, camWarp, smoothCam, CAM_REF } from "../src/lib/videoCamera.js";
import { applyH, invertH } from "../src/lib/videoPitch.js";
import { smoothTrack } from "../src/lib/videoTimeline.js";

// Generador fijo (mismas imágenes en cada ejecución)
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// «Mundo»: césped con líneas, vallas y gradas con textura; se fotografía con una cámara que gira y hace zoom
function makeWorld() {
  const r = rng(7), blobs = [];
  for (let i = 0; i < 260; i++) blobs.push({ x: r() * 1600, y: r() * 900, s: 6 + r() * 26, a: (r() - 0.5) * 120 });
  const rects = []; for (let i = 0; i < 90; i++) rects.push({ x: r() * 1600, y: r() * 900, w: 8 + r() * 50, h: 6 + r() * 30, a: (r() - 0.5) * 90 });
  // textura fina (césped, gradas): ruido suave de unos 4 px
  const N = 420, grid = new Float32Array(N * N).map(() => r() * 50 - 25);
  const noise = (x, y) => { const u = x / 4, v = y / 4, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, at = (a, b) => grid[((b % N) + N) % N * N + (((a % N) + N) % N)];
    return at(i, j) * (1 - fu) * (1 - fv) + at(i + 1, j) * fu * (1 - fv) + at(i, j + 1) * (1 - fu) * fv + at(i + 1, j + 1) * fu * fv; };
  return (x, y) => {
    let v = 110 + 18 * Math.sin(x * 0.05) * Math.sin(y * 0.031) + noise(x, y);
    for (const b of blobs) { const d2 = (x - b.x) ** 2 + (y - b.y) ** 2; if (d2 < 9 * b.s * b.s) v += b.a * Math.exp(-d2 / (2 * b.s * b.s)); }
    for (const q of rects) if (x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h) v += q.a;
    if (Math.abs(((x + 0.3 * y) % 140) - 70) < 1.5) v += 70; // líneas del campo
    return v;
  };
}
// Rasteriza el mundo a una rejilla para muestrear rápido
function raster(world, W = 1600, H = 900) { const g = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = world(x, y); return { g, W, H }; }
function bil(R, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y); if (x0 < 0 || y0 < 0 || x0 >= R.W - 1 || y0 >= R.H - 1) return 0;
  const fx = x - x0, fy = y - y0, i = y0 * R.W + x0;
  return R.g[i] * (1 - fx) * (1 - fy) + R.g[i + 1] * fx * (1 - fy) + R.g[i + R.W] * (1 - fx) * fy + R.g[i + R.W + 1] * fx * fy;
}
// Cámara: centro (cx, cy) del mundo, zoom z y un poco de giro; V(p) = punto del mundo que se ve en el píxel p
const camV = (cx, cy, z, rot = 0) => { const c = Math.cos(rot) / z, s = Math.sin(rot) / z; return [[c, -s, cx - c * 320 + s * 180], [s, c, cy - s * 320 - c * 180], [0, 0, 1]]; };
function shoot(R, V, players = []) {
  const w = 640, h = 360, g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = applyH(V, { x, y }); g[y * w + x] = bil(R, p.x, p.y); }
  // jugadores (manchas que se mueven por su cuenta)
  for (const pl of players) for (let y = Math.max(0, pl.y - 14); y < Math.min(h, pl.y + 14); y++) for (let x = Math.max(0, pl.x - 6); x < Math.min(w, pl.x + 6); x++) g[y * w + x] = 230;
  return { g, w, h };
}

test("cámara: sigue un giro con zoom sin perderse y casi sin error, aunque haya jugadores moviéndose", () => {
  const R = raster(makeWorld());
  const path = (k) => ({ cx: 600 + k * 9, cy: 420 + k * 2.5, z: 1 + k * 0.012, rot: k * 0.0015 }); // 40 fotogramas
  const V = (k) => { const c = path(k); return camV(c.cx, c.cy, c.z, c.rot); };
  const players = (k) => Array.from({ length: 8 }, (_, i) => ({ x: Math.round(80 + i * 70 + k * (i % 2 ? 4 : -3)), y: Math.round(150 + (i % 3) * 60 + k * 1.5) }));
  const F0 = shoot(R, V(0), players(0));
  assert.ok(goodPoints(F0).length >= 40, "hay puntos de sobra");
  const tr = createCamTracker(F0, { rnd: rng(3) }); assert.ok(tr);
  let worst = 0;
  for (let k = 1; k <= 40; k++) {
    const r = tr.update(shoot(R, V(k), players(k))); assert.ok(r.ok, "fotograma " + k);
    const truth = (p) => applyH(invertH(V(k)), applyH(V(0), p));
    for (const p of [{ x: 100, y: 80 }, { x: 540, y: 80 }, { x: 320, y: 180 }, { x: 100, y: 300 }, { x: 540, y: 300 }]) {
      const a = applyH(r.C, p), b = truth(p); worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }
  assert.ok(worst < 3, `error máximo ${worst.toFixed(2)} px`);
});

test("cámara: RANSAC descarta los puntos que no se mueven con la imagen", () => {
  const H = [[1.05, 0.02, 12], [-0.01, 1.03, -7], [0.00002, 0.00001, 1]], r = rng(5);
  const src = [], dst = [];
  for (let i = 0; i < 60; i++) { const p = { x: r() * 640, y: r() * 360 }; src.push(p); const q = applyH(H, p); dst.push(i % 4 === 0 ? { x: q.x + 30 * r() + 5, y: q.y - 20 } : { x: q.x, y: q.y }); }
  const fit = ransacH(src, dst, { rnd: rng(9) });
  assert.equal(fit.inliers, 45);
  const q = applyH(fit.H, { x: 300, y: 200 }), t = applyH(H, { x: 300, y: 200 });
  assert.ok(Math.hypot(q.x - t.x, q.y - t.y) < 0.01);
});

test("cámara: guardar, interpolar y pasar de un momento a otro", () => {
  const C = (k) => [[1 + k * 0.01, 0, 10 * k], [0, 1 + k * 0.01, 3 * k], [0, 0, 1]];
  const samples = [0, 1, 2, 3].map((k) => camSample(5 + k * 0.04, C(k), 640, 360));
  const cam = { samples: smoothCam(samples, (s) => smoothTrack(s, 0.05)) };
  const M = camMatrixAt(cam, 5.04); const p = applyH(M, { x: 0.5, y: 0.5 });
  const t = applyH(C(1), { x: 320, y: 180 }); assert.ok(Math.abs(p.x - t.x / 640) < 1e-3 && Math.abs(p.y - t.y / 360) < 1e-3);
  assert.equal(camMatrixAt(cam, 9), null); // fuera de lo analizado
  // de 5.00 a 5.12: un punto quieto del campo se ve donde lo pone la cámara
  const W = camWarp(cam, 5, 5.12); const a = applyH(W, CAM_REF[0]); const b = applyH(C(3), { x: 0.2 * 640, y: 0.2 * 360 });
  assert.ok(Math.abs(a.x - b.x / 640) < 2e-3 && Math.abs(a.y - b.y / 360) < 2e-3);
});
