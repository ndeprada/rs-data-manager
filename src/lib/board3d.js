// Vista 3D de la pizarra (como el estadio de FmStadio): un estadio de verdad con three.js. Se carga solo cuando hace falta
// (import dinámico desde Board3D.jsx y las exportaciones). El campo y lo pintado en el suelo (zonas, flechas, conectores)
// salen del dibujo 2D de siempre convertido en textura; las fichas, el balón, el material, las porterías, las gradas y las
// vallas son objetos 3D con luz y sombra.
//
// Encuadre: igual que en 2D. `boardView` da el recuadro completo (`fullVb`) y lo que se ve (`vb`: cámara del fotograma,
// zoom guardado o proporción del vídeo); aquí el recuadro completo es lo que la cámara 3D ve del suelo del dibujo (campo +
// margen) y `vb` se toma como la misma fracción de ese recuadro (setViewOffset), así que la cámara de la pizarra funciona igual.
//
// Un solo renderizador WebGL para toda la app (los navegadores limitan los contextos): cada vista copia el resultado a su
// propio canvas 2D.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ballR, boardView, chipOf, fieldKind, contrastColor, faceOf, fieldOf, fromView, groundRegion, hasAds, hasStands, isCutField, isGroundEl, isPersp,
  isStadium, lookOf, materialOf, PERSP, orientAngle, orientOf, tokenR, ballStyle,
} from "@/lib/board";
import { AD_LOGOS } from "@/lib/adLogos";
import { ChipTopSvg, GroundMarksSvg, GroundSvg, STAND, chipPaint, darken, roundRect, standHeight, stadiumParts, styleOf } from "@/components/board/BoardSvg";

// ── Geometría de la vista ────────────────────────────────────────────────────────────────────────────────────────────
// Mundo: X = x del campo, Z = y del campo (la portería a atacar en y = 0), Y = altura (m).
// «Arriba» y «derecha» de la pantalla en metros del campo para cada orientación
const SCREEN = {
  v: { up: [0, -1], right: [1, 0] },
  vi: { up: [0, 1], right: [-1, 0] },
  h: { up: [1, 0], right: [0, 1] },
  hi: { up: [-1, 0], right: [0, -1] },
};
// Inclinación de la cámara en perspectiva (grados sobre el horizonte) y apertura
// (como el vídeo de ejemplo de FmStadio que pasó Nacho el 01/11/2026: casi desde arriba, con un poco de inclinación)
// Inclinación de la cámara en perspectiva (grados sobre el suelo): en el editor, la vista previa y la imagen, parecida a la
// perspectiva del 2D, para que se note que es 3D; en el vídeo, casi desde arriba, como el ejemplo de FmStadio (01/11/2026, Nacho).
export const TILT_VIEW = 42;
export const TILT_VIDEO = 74;
const FOV = 30;
const W0 = 10000; // imagen virtual completa (px) para setViewOffset

const FIELD_SPEC = {
  f11: { goalW: 7.32, goalH: 2.44, goalD: 2.0 },
  f7: { goalW: 6, goalH: 2, goalD: 1.5 },
  futsal: { goalW: 3, goalH: 2, goalD: 1 },
  f4: { goalW: 3, goalH: 1.5, goalD: 1 },
};

// ── Utilidades ───────────────────────────────────────────────────────────────────────────────────────────────────────
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hexOf = (c, fb = "#888888") => (/^#[0-9a-f]{6}$/i.test(String(c || "")) ? c : fb);
const mixHex = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(hexOf(h).slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};
const loadImage = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("img " + String(src).slice(0, 60))); i.src = src; });

async function svgCanvas(node, maxSide) {
  const markup = renderToStaticMarkup(node);
  const vb = /viewBox="([^"]+)"/.exec(markup)?.[1].split(/\s+/).map(Number) || [0, 0, 1, 1];
  const ar = vb[2] / vb[3];
  const w = Math.round(ar >= 1 ? maxSide : maxSide * ar), h = Math.round(ar >= 1 ? maxSide / ar : maxSide);
  const svg = markup.replace(/ preserveAspectRatio="[^"]*"/, "").replace("<svg ", `<svg width="${w}" height="${h}" preserveAspectRatio="none" `);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await loadImage(url).catch((e) => {
      const err = new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("parsererror");
      if (err) console.warn("SVG 3D no válido:", err.textContent.slice(0, 300), svg.slice(0, 200));
      throw e;
    });
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

// ── Renderizador compartido ──────────────────────────────────────────────────────────────────────────────────────────
let SHARED = null;
function shared() {
  if (SHARED) return SHARED;
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  SHARED = { canvas, renderer, statics: new Map(), tex: new Map(), marks: new Map(), views: new WeakMap(), mats: new Map(), geos: {} };
  return SHARED;
}
const maxAniso = () => shared().renderer.capabilities.getMaxAnisotropy();
function canvasTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso();
  return t;
}

// Texturas que tardan (SVG → imagen): se piden una vez y mientras tanto se dibuja sin ellas. Devuelve la textura o null.
function asyncTexture(key, make, pending, limit = 400, store = shared().tex) {
  const S = { tex: store };
  const hit = S.tex.get(key);
  if (hit) { if (hit.texture) return hit.texture; pending.push(hit.promise); return null; }
  const entry = { texture: null, promise: null };
  entry.promise = make().then((c) => { entry.texture = canvasTexture(c); }).catch((err) => { console.warn("Textura 3D", key.slice(0, 40), err?.message); entry.texture = canvasTexture(document.createElement("canvas")); });
  S.tex.set(key, entry);
  if (S.tex.size > limit) {
    const first = S.tex.keys().next().value;
    S.tex.get(first)?.texture?.dispose();
    S.tex.delete(first);
  }
  pending.push(entry.promise);
  return null;
}
function lambert(color, extra = {}) {
  const S = shared();
  const key = `l${color}${JSON.stringify(extra)}`;
  if (!S.mats.has(key)) S.mats.set(key, new THREE.MeshLambertMaterial({ color: new THREE.Color(color), ...extra }));
  return S.mats.get(key);
}
function geo(name, make) {
  const S = shared();
  if (!S.geos[name]) S.geos[name] = make();
  return S.geos[name];
}

// ── Estadio: gradas con escalones, cubierta, foso y vallas ──────────────────────────────────────────────────────────
// Anillo a d m de las líneas, con los lados rectos partidos en trozos (para que los asientos tengan tonos distintos)
function ringPts(field, d) {
  const base = roundRect(field, d);
  const nTop = Math.max(8, Math.round(field.w / 0.6)), nSide = Math.max(8, Math.round(field.h / 0.6));
  const out = [];
  for (let i = 0; i < base.length; i++) {
    const p = base[i], q = base[(i + 1) % base.length];
    out.push({ ...p, side: false });
    if (i % 10 === 9) {
      const n = i === 9 || i === 29 ? nSide : nTop;
      for (let k = 1; k < n; k++) out.push({ x: p.x + ((q.x - p.x) * k) / n, y: p.y + ((q.y - p.y) * k) / n, side: true, t: k / n, len: Math.hypot(q.x - p.x, q.y - p.y) });
    }
  }
  return out;
}
// Medidas del estadio 3D (m desde las líneas). Más grande que el dibujo 2D (pedido por Nacho el 01/11/2026: «gradas
// bastante más grandes, con cubierta»): grada baja, pasillo, grada alta, muro de atrás y cubierta volada hacia el campo.
// Las gradas van a doble tamaño (filas de 1,6 m y asientos de 1 m): como en FmStadio, que no van a escala; así, en un vídeo
// 16:9 con el campo en vertical, llenan los lados de la imagen (vídeo de ejemplo de Nacho del 01/11/2026).
const SK = 2;
const ST3 = { ads: 4.0, track: 5.5, row: 0.8 * SK, lowRows: 12, lowRise: 0.42 * SK, lowFront: 1.1 * SK, aisle: 1.6 * SK, upFront: 1.2 * SK, upRows: 13, upRise: 0.6 * SK, back: 0.5 * SK, wallTop: 19 * SK, roofIn: 0, roofLow: 17.6 * SK };
const S3 = (() => {
  const lowTop = ST3.track + ST3.lowRows * ST3.row;
  const upStart = lowTop + ST3.aisle;
  const upTop = upStart + ST3.upRows * ST3.row;
  return { ...ST3, lowTop, upStart, upTop, outer: upTop + ST3.back, roofIn: upTop - 9 * SK };
})();
// Perfil de la grada (distancia d, altura h): escalones de la grada baja, pasillo, grada alta y muro exterior
function standProfile() {
  const S = S3;
  const segs = [];
  let h = 0;
  const step = (d0, d1, hTread, kind, rowT) => { if (hTread !== h) segs.push({ d0, d1: d0, h0: h, h1: hTread, kind: kind === "seat" ? "riser" : "wall" }); segs.push({ d0, d1, h0: hTread, h1: hTread, kind, rowT }); h = hTread; };
  for (let i = 0; i < S.lowRows; i++) step(S.track + i * S.row, S.track + (i + 1) * S.row, S.lowFront + i * S.lowRise, "seat", i / (S.lowRows - 1) * 0.55);
  const hA = h + 0.3;
  step(S.lowTop, S.upStart, hA, "aisle");
  for (let j = 0; j < S.upRows; j++) step(S.upStart + j * S.row, S.upStart + (j + 1) * S.row, hA + S.upFront + j * S.upRise, "seat", 0.45 + (0.55 * j) / (S.upRows - 1));
  step(S.upTop, S.outer, S.wallTop, "top");
  segs.push({ d0: S.outer, d1: S.outer, h0: S.wallTop, h1: 0, kind: "outer" });
  return segs;
}
function buildStands(field, st) {
  const S = S3;
  const segs = standProfile();
  const rings = new Map();
  const ring = (d) => { if (!rings.has(d)) rings.set(d, ringPts(field, d)); return rings.get(d); };
  // escaleras: cada ~13 m en los lados rectos
  const ref = ring(S.lowTop);
  const stair = ref.map((p) => {
    if (!p.side) return false;
    const n = Math.max(2, Math.round(p.len / (11 * SK)));
    for (let k = 1; k < n; k++) if (Math.abs(p.t - k / n) * p.len < 0.6 * SK) return true;
    return false;
  });
  const pos = [], col = [];
  const c = new THREE.Color();
  const push = (pts, color) => {
    c.set(color).convertSRGBToLinear();
    for (const p of pts) { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); }
  };
  const loft = (sg, si, colorOf) => {
    const A = ring(sg.d0), B = ring(sg.d1);
    const n = A.length;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      push([[A[k].x, sg.h0, A[k].y], [A[k2].x, sg.h0, A[k2].y], [B[k2].x, sg.h1, B[k2].y], [A[k].x, sg.h0, A[k].y], [B[k2].x, sg.h1, B[k2].y], [B[k].x, sg.h1, B[k].y]], colorOf(k, si));
    }
  };
  segs.forEach((sg, si) => loft(sg, si, (k) => {
    if (sg.kind === "seat") {
      // el escalón (hormigón); los asientos van encima, como objetos
      if (stair[k]) return mixHex(hexOf(st.concrete || "#6a706e"), "#ffffff", 0.12);
      return mixHex(hexOf(st.concrete || "#5f6563"), "#000000", 0.08 * hash(k + si * 13));
    }
    if (sg.kind === "riser") return mixHex(hexOf(st.concrete || "#5f6563"), "#000000", 0.3);
    if (sg.kind === "aisle") return hexOf(st.concourse);
    if (sg.kind === "top") return hexOf(st.concourse);
    if (sg.kind === "outer") return mixHex(hexOf(st.outer), hexOf(st.roof), 0.6);
    return mixHex(hexOf(st.riser), "#000000", 0.05);
  }));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // cubierta volada: del muro de atrás hacia el campo, algo inclinada, con el canto delantero más claro
  pos.length = 0; col.length = 0;
  // cubierta gris clara con paneles (franjas alternas) y canto blanco
  const roofC = mixHex(hexOf(st.roofLine || st.roof), "#ffffff", 0.32);
  loft({ d0: S.outer, d1: S.roofIn, h0: S.wallTop + 0.6, h1: S.roofLow }, 0, (k) => (Math.floor(k / 3) % 2 ? roofC : mixHex(roofC, "#000000", 0.08)));
  loft({ d0: S.roofIn, d1: S.roofIn, h0: S.roofLow, h1: S.roofLow - 0.7 }, 1, () => mixHex(roofC, "#ffffff", 0.55));
  loft({ d0: S.outer, d1: S.outer, h0: S.wallTop, h1: S.wallTop + 0.6 }, 2, () => mixHex(roofC, "#000000", 0.3));
  const rg = new THREE.BufferGeometry();
  rg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  rg.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  rg.computeVertexNormals();
  const roof = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  roof.castShadow = true;
  roof.receiveShadow = true;
  // asientos de verdad (un asiento con respaldo cada 0,55 m), mirando al campo, con tonos mezclados como en FmStadio
  const seatsMesh = buildSeats(field, segs, stair, st);
  // foso entre las vallas y la grada
  const track = flatRing(field, S.ads, S.track, hexOf(st.track));
  const group = new THREE.Group();
  group.add(mesh, roof, track);
  if (seatsMesh) group.add(seatsMesh);
  return group;
}
// Asientos: un InstancedMesh (respaldo + asiento) a lo largo de cada fila, saltando las escaleras
function buildSeats(field, segs, stair, st) {
  const pan = new THREE.BoxGeometry(0.46 * SK, 0.07 * SK, 0.36 * SK).translate(0, 0.38 * SK, -0.02 * SK);
  const back = new THREE.BoxGeometry(0.46 * SK, 0.42 * SK, 0.06 * SK).translate(0, 0.6 * SK, 0.17 * SK);
  const geo1 = mergeGeometries([pan, back]);
  const seats = (st.seats || []).map((x) => hexOf(x));
  const dark = hexOf(st.seat3d?.[0] || st.seatDark || "#1f7a4f"), light = hexOf(st.seat3d?.[1] || st.seatLight || "#8fd3a9");
  const rows = segs.filter((sg) => sg.kind === "seat");
  const items = [];
  rows.forEach((sg, ri) => {
    const ring = ringPts(field, sg.d0 + (sg.d1 - sg.d0) * 0.42);
    const n = ring.length;
    let carry = 0;
    for (let k = 0; k < n; k++) {
      const a = ring[k], b = ring[(k + 1) % n];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (stair[k] || len < 1e-6) { carry = 0; continue; }
      const tx = (b.x - a.x) / len, ty = (b.y - a.y) / len;
      // hacia fuera del campo
      let nx = ty, ny = -tx;
      const mx = (a.x + b.x) / 2 - field.w / 2, my = (a.y + b.y) / 2 - field.h / 2;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      let t = carry;
      for (; t < len; t += 0.55 * SK) items.push({ x: a.x + tx * t, y: a.y + ty * t, h: sg.h0, yaw: Math.atan2(nx, ny), ri, rowT: sg.rowT });
      carry = t - len;
    }
  });
  if (!items.length) return null;
  const mesh = new THREE.InstancedMesh(geo1, new THREE.MeshLambertMaterial({ color: 0xffffff }), items.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), at = new THREE.Vector3();
  items.forEach((it, i) => {
    q.setFromAxisAngle(up, it.yaw);
    m.compose(at.set(it.x, it.h, it.y), q, one);
    mesh.setMatrixAt(i, m);
    const r = hash(i * 7.13 + it.ri);
    let col = mixHex(dark, light, Math.min(1, Math.max(0, 0.5 + 0.35 * it.rowT + (r - 0.5) * 0.3)));
    if (!st.seat3d && seats.length) col = mixHex(col, seats[Math.floor(hash(i * 3.7) * seats.length) % seats.length], 0.3);
    if (r > 0.97) col = mixHex(col, "#ffffff", 0.25);
    mesh.setColorAt(i, c.set(col).convertSRGBToLinear());
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function flatRing(field, d0, d1, color) {
  const A = ringPts(field, d0), B = ringPts(field, d1);
  const pos = [];
  for (let k = 0; k < A.length; k++) {
    const k2 = (k + 1) % A.length;
    pos.push(A[k].x, 0.02, A[k].y, A[k2].x, 0.02, A[k2].y, B[k2].x, 0.02, B[k2].y, A[k].x, 0.02, A[k].y, B[k2].x, 0.02, B[k2].y, B[k].x, 0.02, B[k].y);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide }));
  m.receiveShadow = true;
  return m;
}
// Valla publicitaria: un panel inclinado hacia el campo (se lee desde arriba y desde la grada de enfrente)
async function adCanvas(pn) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 160;
  const g = c.getContext("2d");
  g.fillStyle = pn.bg; g.fillRect(0, 0, c.width, c.height);
  const grd = g.createLinearGradient(0, 0, 0, c.height);
  grd.addColorStop(0, "rgba(255,255,255,0.12)"); grd.addColorStop(0.5, "rgba(255,255,255,0)"); grd.addColorStop(1, "rgba(0,0,0,0.18)");
  g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
  const L = pn.logo && AD_LOGOS[pn.logo];
  if (L) {
    const img = await loadImage(pn.ink === "#ffffff" ? L.w : L.o).catch(() => null);
    if (img) {
      const h = Math.min(c.height * 0.78, (c.width * 0.8) / L.ar), w = h * L.ar;
      g.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
      return c;
    }
  }
  g.fillStyle = pn.ink;
  g.font = `900 ${Math.round(c.height * 0.56)}px Arial, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(pn.text, c.width / 2, c.height * 0.54);
  return c;
}
function buildAds(field, board, pending) {
  const group = new THREE.Group();
  for (const pn of stadiumParts(field, { stands: hasStands(board), ads: true }).panels) {
    const tex = asyncTexture(`ad:${pn.text}:${pn.logo || ""}:${pn.ink}:${pn.bg}`, () => adCanvas(pn), pending);
    // pts: 0-1 borde del lado del campo (d = apron), 3-2 borde de fuera (d = ads), en el sentido de lectura
    const [p0, p1, p2, p3] = pn.pts;
    const H = 1.05;
    const pos = [p0.x, 0.05, p0.y, p1.x, 0.05, p1.y, p2.x, H, p2.y, p0.x, 0.05, p0.y, p2.x, H, p2.y, p3.x, H, p3.y];
    const uv = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    // la cara de los anuncios mira al campo; por detrás, lisa (si no, desde la grada se leerían al revés)
    const a = new THREE.Vector3(p0.x, 0.05, p0.y), n = new THREE.Vector3().subVectors(new THREE.Vector3(p1.x, 0.05, p1.y), a).cross(new THREE.Vector3().subVectors(new THREE.Vector3(p2.x, H, p2.y), a));
    const toField = new THREE.Vector3(field.w / 2 - p0.x, 0, field.h / 2 - p0.y);
    const front = n.dot(toField) > 0 ? THREE.FrontSide : THREE.BackSide;
    const m = new THREE.Mesh(g, tex ? new THREE.MeshBasicMaterial({ map: tex, side: front }) : new THREE.MeshBasicMaterial({ color: new THREE.Color(pn.bg), side: front }));
    m.castShadow = true;
    group.add(m);
    group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color("#3a0710"), side: front === THREE.FrontSide ? THREE.BackSide : THREE.FrontSide })));
  }
  return group;
}

// ── Porterías ────────────────────────────────────────────────────────────────────────────────────────────────────────
let NET_CANVAS = null;
function netTexture() {
  if (!NET_CANVAS) {
    NET_CANVAS = document.createElement("canvas");
    NET_CANVAS.width = NET_CANVAS.height = 64;
    const g = NET_CANVAS.getContext("2d");
    // un velo blanco muy suave (para que la red se lea como superficie) y los hilos más gruesos
    g.fillStyle = "rgba(255,255,255,0.16)"; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = "rgba(255,255,255,1)"; g.lineWidth = 9;
    g.strokeRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(NET_CANVAS);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// Portería con la boca en z = 0 mirando a +z y la red hacia −z
function makeGoal(w, h, depth, color = "#ffffff") {
  const group = new THREE.Group();
  // postes y larguero algo más gruesos que los reales (12 cm) para que se vean desde lejos
  const r = Math.max(0.06, Math.min(0.13, w * 0.017));
  const post = lambert(hexOf(color, "#ffffff"));
  const cyl = (len) => new THREE.CylinderGeometry(r, r, len, 10);
  const bar = (a, b, rr = r) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const m = new THREE.Mesh(rr === r ? cyl(len) : new THREE.CylinderGeometry(rr, rr, len, 8), post);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    m.castShadow = true;
    group.add(m);
  };
  const x = w / 2, hb = h * 0.62;
  bar([-x, 0, 0], [-x, h, 0]); bar([x, 0, 0], [x, h, 0]); bar([-x - r, h, 0], [x + r, h, 0]);
  const thin = r * 0.5;
  bar([-x, 0, -depth], [x, 0, -depth], thin); bar([-x, 0, 0], [-x, 0, -depth], thin); bar([x, 0, 0], [x, 0, -depth], thin);
  bar([-x, 0, -depth], [-x, hb, -depth], thin); bar([x, 0, -depth], [x, hb, -depth], thin);
  // barras de arriba: del larguero al fondo y la de atrás
  bar([-x, h, 0], [-x, hb, -depth], thin); bar([x, h, 0], [x, hb, -depth], thin); bar([-x, hb, -depth], [x, hb, -depth], thin);
  // red: techo (del larguero al fondo), fondo y laterales
  const quads = [
    [[-x, h, 0], [x, h, 0], [x, hb, -depth], [-x, hb, -depth]],
    [[-x, hb, -depth], [x, hb, -depth], [x, 0, -depth], [-x, 0, -depth]],
    [[-x, h, 0], [-x, hb, -depth], [-x, 0, -depth], [-x, 0, 0]],
    [[x, h, 0], [x, hb, -depth], [x, 0, -depth], [x, 0, 0]],
  ];
  const pos = [], uv = [];
  const cell = 0.22;
  for (const q of quads) {
    const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const U = len(q[0], q[1]) / cell, V = len(q[1], q[2]) / cell;
    const t = [[0, 0], [U, 0], [U, V], [0, V]];
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...q[i]); uv.push(...t[i]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  const net = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: netTexture(), color: new THREE.Color(hexOf(color, "#ffffff")), transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
  net.renderOrder = 2;
  group.add(net);
  return group;
}

// ── Escena fija de un dibujo (suelo, estadio, porterías del campo) ──────────────────────────────────────────────────
function staticKey(board) {
  return JSON.stringify([board.field, lookOf(board.look), board.stands !== false, board.ads !== false, board.grass || "", board.marks || "", board.teams ? 1 : 0]);
}
function buildStatic(board, pending) {
  const look = lookOf(board.look);
  const s = styleOf(look);
  const cut = isCutField(board.field);
  const field = fieldOf(board.field);
  const full = cut ? fieldOf("full") : field;
  const region = groundRegion(board);
  const group = new THREE.Group();
  const bg = hexOf(isStadium(look) ? s.surround : s.margin || s.bg, "#ffffff");
  // suelo grande de fondo (por si la cámara ve más allá del recuadro)
  const base = new THREE.Mesh(new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(bg) }));
  base.position.set(full.w / 2, -0.06, full.h / 2);
  group.add(base);
  // el campo pintado en 2D como textura del suelo
  const rw = region[2] - region[0], rh = region[3] - region[1];
  const tex = asyncTexture(`ground:${staticKey(board)}:${region.join(",")}`, () => svgCanvas(React.createElement(GroundSvg, { board, region }), Math.min(4096, shared().renderer.capabilities.maxTextureSize)), pending, 400);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(rw, rh).rotateX(-Math.PI / 2), tex ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshBasicMaterial({ color: new THREE.Color(hexOf(s.bg, "#ffffff")) }));
  ground.position.set(region[0] + rw / 2, 0, region[1] + rh / 2);
  group.add(ground);
  // sombras sobre el suelo (capa transparente que solo pinta sombra)
  if ((s.shadow || 0) > 0) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(rw + 60, rh + 60).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: Math.min(0.42, s.shadow + 0.06) }));
    sh.position.set(region[0] + rw / 2, 0.01, region[1] + rh / 2);
    sh.receiveShadow = true;
    group.add(sh);
  }
  if (isStadium(look)) {
    if (hasStands(board)) {
      // asientos de color vivo sobre hormigón gris (como en FmStadio)
      const st = s.stadium;
      const seat3d = st.seat3d || (look === "estadio-noche" ? ["#3346b8", "#7d92f0"] : ["#17a878", "#45e0aa"]);
      const concrete = st.concrete3d || (look === "estadio-noche" ? "#6a7090" : "#9aa09e");
      group.add(buildStands(full, { ...st, seat3d, concrete, concourse: st.concrete3d || (look === "estadio-noche" ? "#5a6080" : "#8a908e") }));
      // por fuera de la grada (las esquinas son redondas), el color de alrededor del estadio
      group.add(flatRing(full, S3.outer - 0.05, 160, bg));
    }
    if (hasAds(board)) group.add(buildAds(full, board, pending));
  }
  // porterías del campo
  const sp = FIELD_SPEC[fieldKind(field)];
  if (sp) {
    const ink = look === "bn" ? "#111111" : "#ffffff";
    const top = makeGoal(sp.goalW, sp.goalH, sp.goalD, ink);
    top.position.set(full.w / 2, 0, 0);
    // makeGoal deja la boca en z = 0 mirando a +z y la red hacia −z: la de arriba (línea de meta en y = 0) ya mira al campo
    // con la red por fuera; la de abajo se gira media vuelta (antes estaban al revés, con la red dentro del campo)
    group.add(top);
    const bot = makeGoal(sp.goalW, sp.goalH, sp.goalD, ink);
    bot.position.set(full.w / 2, 0, full.h);
    bot.rotation.y = Math.PI;
    group.add(bot);
  }
  return { group, background: bg, region, complete: pending.length === 0 };
}

// ── Objetos que se mueven ───────────────────────────────────────────────────────────────────────────────────────────
// Lo que va pintado en el suelo (textura transparente encima del campo)
const isFlatMark = (el) => isGroundEl(el) || el.k === "ladder" || (el.k === "cone" && el.shape === "flat");

function labelCanvas(text, { fill = "#ffffff", stroke = "#000000", bg = null, bgAlpha = 1, size = 64, bold = true, font = "Arial, sans-serif" } = {}) {
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  const f = `${bold ? 700 : 400} ${size}px ${font}`;
  g.font = f;
  const tw = Math.ceil(g.measureText(text).width);
  const padX = bg ? size * 0.38 : size * 0.18, padY = bg ? size * 0.2 : size * 0.14;
  c.width = tw + padX * 2;
  c.height = Math.ceil(size * 1.25 + padY * 2);
  g.font = f;
  g.textAlign = "center"; g.textBaseline = "middle";
  if (bg) {
    g.globalAlpha = bgAlpha;
    g.fillStyle = bg;
    const r = c.height * 0.28;
    g.beginPath(); g.roundRect(1, 1, c.width - 2, c.height - 2, r); g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = "rgba(0,0,0,0.14)"; g.lineWidth = 2; g.stroke();
  } else if (stroke) {
    g.lineJoin = "round"; g.lineWidth = size * 0.2; g.strokeStyle = stroke;
    g.strokeText(text, c.width / 2, c.height / 2 + size * 0.04);
  }
  g.fillStyle = fill;
  g.fillText(text, c.width / 2, c.height / 2 + size * 0.04);
  return c;
}
function labelSprite(key, text, opts, heightM) {
  const S = shared();
  let entry = S.tex.get(key);
  if (!entry) { entry = { texture: canvasTexture(labelCanvas(text, opts)), promise: null }; S.tex.set(key, entry); }
  const tex = entry.texture;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
  const sp = new THREE.Sprite(mat);
  const ar = tex.image.width / tex.image.height;
  sp.scale.set(heightM * ar, heightM, 1);
  sp.renderOrder = 10;
  return sp;
}

// Texturas del balón (equirectangular, 512 × 256), píxel a píxel para que los dibujos salgan bien en toda la esfera (también en
// los polos). Clásico y entreno = balón de 32 paneles (12 pentágonos en los vértices de un icosaedro, girado para que ningún panel
// caiga en un polo) con sus costuras; moderno y hélice = paneles curvos en espiral; punto = 12 manchas; franja = el ecuador.
const BALL_CENTERS = (() => {
  const t = (1 + Math.sqrt(5)) / 2, out = [];
  for (const [a, b] of [[1, t], [-1, t], [1, -t], [-1, -t]]) out.push([0, a, b], [a, b, 0], [b, 0, a]);
  // giro fijo (para que no haya un pentágono justo en el polo de la textura)
  const rx = 0.42, rz = 0.31;
  return out.map(([x, y, z]) => {
    const n = Math.hypot(x, y, z); x /= n; y /= n; z /= n;
    const y1 = y * Math.cos(rx) - z * Math.sin(rx), z1 = y * Math.sin(rx) + z * Math.cos(rx);
    return [x * Math.cos(rz) - y1 * Math.sin(rz), x * Math.sin(rz) + y1 * Math.cos(rz), z1];
  });
})();
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a) => { const n = Math.hypot(...a) || 1; return a.map((v) => v / n); };
// vecinos de cada pentágono (los 5 vértices del icosaedro más cercanos) y un eje de referencia para medir el ángulo alrededor del centro
const BALL_NB = BALL_CENTERS.map((c) => BALL_CENTERS.map((o, j) => [dot3(c, o), j]).filter(([d]) => d < 0.999).sort((a, b) => b[0] - a[0]).slice(0, 5).map(([, j]) => j));
const PENT_R = 0.36; // radio angular del pentágono (rad)
function ballPixel(pattern, v) {
  // 0 = color del balón, 1 = dibujo, 2 = costura
  if (pattern === "plain") return 0;
  if (pattern === "stripe") return Math.abs(v[1]) < 0.22 ? 1 : 0;
  let best = -2, bi = 0, second = -2, si = 0;
  for (let i = 0; i < 12; i++) { const d = dot3(v, BALL_CENTERS[i]); if (d > best) { second = best; si = bi; best = d; bi = i; } else if (d > second) { second = d; si = i; } }
  const th = Math.acos(Math.min(1, best));
  if (pattern === "dot") return th < 0.22 ? 1 : 0;
  if (pattern === "modern" || pattern === "helix") {
    const lat = Math.asin(Math.max(-1, Math.min(1, v[1]))), lon = Math.atan2(v[2], v[0]);
    const f = pattern === "modern" ? Math.sin(2 * lon + 2.6 * Math.sin(2 * lat)) : Math.sin(3 * lon + 3.8 * lat);
    const cut = pattern === "modern" ? 0.5 : 0.25;
    if (Math.abs(f - cut) < 0.07) return 2;
    return f > cut ? 1 : 0;
  }
  // clásico / entreno: pentágono con los vértices hacia los vecinos
  const c = BALL_CENTERS[bi], nb = BALL_CENTERS[BALL_NB[bi][0]];
  const e1 = norm3(cross3(cross3(c, nb), c)), e2 = cross3(c, e1);
  const phi = Math.atan2(dot3(v, e2), dot3(v, e1));
  const seg = (2 * Math.PI) / 5, m = ((phi % seg) + seg) % seg - seg / 2;
  const rEdge = (PENT_R * Math.cos(Math.PI / 5)) / Math.cos(m);
  const w = 0.022;
  if (Math.abs(th - rEdge) < w) return 2;
  if (th < rEdge) return pattern === "classic" ? 1 : 0;
  // costura entre hexágonos: el arco entre dos pentágonos vecinos, fuera de los pentágonos
  if (BALL_NB[bi].includes(si)) {
    const n = norm3(cross3(c, BALL_CENTERS[si]));
    if (Math.abs(dot3(v, n)) < w) return 2;
  }
  return 0;
}
function ballTexture(bs) {
  const key = `ball:${bs.pattern}:${bs.color}:${bs.color2}`;
  const S = shared();
  if (S.tex.has(key)) return S.tex.get(key).texture;
  const W = 512, H = 256;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const img = g.createImageData(W, H);
  // el lienzo va en sRGB: se leen los colores tal cual (THREE.Color los pasaría a lineal y saldrían más oscuros)
  const rgb = (h) => { const x = hexOf(h, "#ffffff"); return [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)); };
  const base = rgb(bs.color), ink = rgb(bs.color2);
  const seam = base.map((b, i) => Math.round(ink[i] * 0.6 + b * 0.4));
  const cols = [base, ink, seam];
  for (let y = 0; y < H; y++) {
    const lat = Math.PI / 2 - ((y + 0.5) / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * 2 * Math.PI - Math.PI;
      const v = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
      const col = cols[ballPixel(bs.pattern, v)];
      const o = (y * W + x) * 4;
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = canvasTexture(cv);
  S.tex.set(key, { texture: t, promise: null });
  return t;
}

// Ficha: disco con grosor (canto del color oscurecido) y cara de arriba con su diseño; pies y textos
function buildToken(board, el, look, chip, scr, pending) {
  const group = new THREE.Group();
  // en perspectiva las fichas se ven algo más grandes (como en 2D)
  const r = tokenR(chip, el) * (isPersp(board) ? PERSP.chip : 1) * 0.92;
  const hgt = Math.max(0.28, r * 0.34);
  const paint = chipPaint(board, el, look);
  const bn = look === "bn";
  const sideColor = bn ? "#ffffff" : darken(hexOf(paint.color, "#73000a"), 0.35);
  const side = new THREE.Mesh(geo("chipSide", () => new THREE.CylinderGeometry(1, 1, 1, 40, 1, true)), lambert(sideColor, { side: THREE.DoubleSide }));
  side.scale.set(r, hgt, r);
  side.position.y = hgt / 2;
  side.castShadow = true;
  group.add(side);
  const ang = faceOf(el) + scr.angle;
  const topKey = `chip:${JSON.stringify([paint, el.inner || "", el.bib || "", el.bib ? Math.round(ang) : 0, bn])}`;
  const tex = asyncTexture(topKey, () => svgCanvas(React.createElement(ChipTopSvg, { board, el, look, ang }), 256), pending);
  const top = new THREE.Mesh(geo("chipTop", () => new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2)), tex ? new THREE.MeshLambertMaterial({ map: tex }) : lambert(hexOf(paint.color, "#73000a")));
  top.scale.set(r, 1, r);
  top.position.y = hgt;
  top.rotation.y = scr.texRot;
  top.castShadow = true;
  group.add(top);
  if (el.feet) {
    const a = (faceOf(el) * Math.PI) / 180;
    const fwd = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)), lat = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(geo("foot", () => new THREE.SphereGeometry(1, 16, 10)), lambert(bn ? "#ffffff" : hexOf(styleOf(look).foot?.fill, "#111827")));
      f.scale.set(r * 0.24, 0.12, r * 0.45);
      f.rotation.y = -a;
      f.position.copy(fwd.clone().multiplyScalar(r * 0.98)).add(lat.clone().multiplyScalar(sx * r * 0.5));
      f.position.y = 0.1;
      f.castShadow = true;
      group.add(f);
    }
  }
  const s = styleOf(look);
  const fs = Math.max(1.8, r * 1.25) * 1.05;
  const lab = (text, below) => {
    const bg = el.labelBg || null;
    const opts = bg ? { bg, bgAlpha: el.labelBgOpacity ?? 1, fill: bn ? "#111111" : contrastColor(bg), stroke: null } : { fill: s.label.fill, stroke: s.label.stroke };
    const sp = labelSprite(`lab:${text}:${JSON.stringify(opts)}`, text, opts, fs * 1.35);
    sp.position.set(0, hgt, 0);
    const gap = (r * 1.15) / sp.scale.y;
    sp.center.set(0.5, below ? 1 + gap : -gap * 0.55);
    group.add(sp);
  };
  if (el.label) lab(String(el.label), true);
  if (el.labelTop) lab(String(el.labelTop), false);
  group.position.set(el.x, 0, el.y);
  return group;
}

function buildPiece(board, el, look, chip, scr, pending) {
  const s = styleOf(look);
  const bn = look === "bn";
  const k = Number(el.size) || 1;
  const rotY = -((el.rot || 0) * Math.PI) / 180;
  const at = (obj) => { obj.position.set(el.x, obj.position.y, el.y); return obj; };
  if (el.k === "token") return buildToken(board, el, look, chip, scr, pending);
  if (el.k === "ball") {
    const rb = ballR(chip) * k * 0.75;
    const bs = ballStyle(el);
    const m = new THREE.Mesh(geo("ball", () => new THREE.SphereGeometry(1, 32, 20)), new THREE.MeshLambertMaterial({ map: ballTexture(bn ? { ...bs, color: "#ffffff", color2: "#111111" } : bs) }));
    m.scale.setScalar(rb);
    m.position.y = rb;
    m.rotation.set(0.5, 0.8, 0.2);
    m.castShadow = true;
    return at(m);
  }
  if (el.k === "cone") {
    const col = bn ? s.cone : el.color || s.cone;
    const m = new THREE.Mesh(geo("cone", () => new THREE.ConeGeometry(1, 1, 24)), lambert(hexOf(col, "#f97316")));
    m.scale.set(0.75 * k, 1.5 * k, 0.75 * k);
    m.position.y = 0.75 * k;
    m.castShadow = true;
    const g = new THREE.Group();
    g.add(m);
    const ring = new THREE.Mesh(geo("coneBase", () => new THREE.CylinderGeometry(1, 1, 1, 24)), lambert(hexOf(col, "#f97316")));
    ring.scale.set(0.95 * k, 0.08, 0.95 * k);
    ring.position.y = 0.04;
    ring.castShadow = true;
    g.add(ring);
    return at(g);
  }
  if (el.k === "goal") {
    const w = Number(el.w) || 7.32;
    const h = w >= 7 ? 2.44 : w >= 2.9 ? 2 : Math.max(0.8, w * 0.5);
    const d = Math.max(1.1, Math.min(2.4, w * 0.4));
    const g = makeGoal(w, h, d, bn ? "#111111" : el.color || "#ffffff");
    // en 2D la boca está en el borde de abajo del recuadro (+y local) y la red hacia arriba
    const inner = new THREE.Group();
    g.position.z = d / 2;
    inner.add(g);
    inner.rotation.y = rotY;
    return at(inner);
  }
  const mat = materialOf(el.k);
  if (mat) {
    const col = hexOf(bn ? "#111111" : el.color || mat.color, mat.color);
    const g = new THREE.Group();
    if (el.k === "pole") {
      const p = new THREE.Mesh(geo("pole", () => new THREE.CylinderGeometry(1, 1, 1, 14)), lambert(col));
      p.scale.set(0.16 * k, 2.6 * k, 0.16 * k); p.position.y = 1.3 * k; p.castShadow = true;
      const tip = new THREE.Mesh(geo("pole", () => new THREE.CylinderGeometry(1, 1, 1, 14)), lambert("#ffffff"));
      tip.scale.set(0.165 * k, 0.8 * k, 0.165 * k); tip.position.y = 2.2 * k; tip.castShadow = true;
      const base = new THREE.Mesh(geo("coneBase", () => new THREE.CylinderGeometry(1, 1, 1, 24)), lambert(col));
      base.scale.set(0.6 * k, 0.1, 0.6 * k); base.position.y = 0.05;
      g.add(p, tip, base);
    } else if (el.k === "hurdle") {
      const w = mat.hw * 1.6 * k, h = 0.9 * k;
      const m = lambert(col);
      const box = (sx, sy, sz, x, y) => { const b = new THREE.Mesh(geo("box", () => new THREE.BoxGeometry(1, 1, 1)), m); b.scale.set(sx, sy, sz); b.position.set(x, y, 0); b.castShadow = true; g.add(b); };
      box(w, 0.12 * k, 0.12 * k, 0, h);
      box(0.12 * k, h, 0.12 * k, -w / 2, h / 2); box(0.12 * k, h, 0.12 * k, w / 2, h / 2);
      box(0.12 * k, 0.06, 0.8 * k, -w / 2, 0.03); box(0.12 * k, 0.06, 0.8 * k, w / 2, 0.03);
    } else if (el.k === "dummy") {
      const body = new THREE.Mesh(geo("dummy", () => new THREE.CapsuleGeometry(0.5, 1.2, 6, 16)), lambert(col));
      body.scale.set(mat.hw * 1.3 * k, k, mat.hh * 0.75 * k);
      body.position.y = 1.1 * k; body.castShadow = true;
      const head = new THREE.Mesh(geo("foot", () => new THREE.SphereGeometry(1, 16, 10)), lambert(mixHex(col, "#000000", 0.15)));
      head.scale.setScalar(0.32 * k); head.position.y = 2.3 * k; head.castShadow = true;
      g.add(body, head);
    }
    g.rotation.y = rotY;
    return at(g);
  }
  if (el.k === "text") {
    const fs = Number(el.size) || 3;
    const bg = el.bg && String(el.text || "").trim() ? el.bg : null;
    const opts = bg
      ? { bg, bgAlpha: el.bgOpacity ?? 1, fill: bn ? "#111111" : el.color || contrastColor(bg), stroke: null, bold: el.bold !== false }
      : { fill: bn ? s.textFill : el.color || s.textFill, stroke: s.textStroke, bold: el.bold !== false };
    const sp = labelSprite(`txt:${el.text}:${JSON.stringify(opts)}`, String(el.text || ""), opts, fs * 1.3);
    sp.center.set(0.5, 0.2);
    sp.position.set(el.x, 0.2, el.y);
    return sp;
  }
  return null;
}

// ── Cámara ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// Lo que enseña el recuadro `vb` del 2D se lleva al suelo (en perspectiva, deshaciendo la proyección) y la cámara 3D se
// coloca para que ese trozo de campo llene la imagen. Sin cámara ni zoom, el campo entero (con 4 m alrededor) ocupa toda
// la imagen y las gradas salen por los lados, como en FmStadio.
function placeCamera(camera, board, view, aspect, tilt = TILT_VIEW) {
  const { field, orient, persp: p2, vb } = view;
  const sc = SCREEN[orient];
  const U = new THREE.Vector3(sc.up[0], 0, sc.up[1]);
  const persp = isPersp(board);
  const cut = isCutField(board.field);
  // el campo con las porterías (2 m por detrás de cada línea de meta) y un poco de aire a los lados
  const lim = [-3, -3.2, field.w + 3, field.h + (cut ? 3 : 3.2)];
  const corners = [[vb[0], vb[1]], [vb[0] + vb[2], vb[1]], [vb[0] + vb[2], vb[1] + vb[3]], [vb[0], vb[1] + vb[3]]];
  let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
  for (const [x, y] of corners) {
    const q = fromView(field, orient, p2 ? p2.inv({ x, y }) : { x, y });
    const gx = Math.min(lim[2], Math.max(lim[0], q.x)), gy = Math.min(lim[3], Math.max(lim[1], q.y));
    gx0 = Math.min(gx0, gx); gx1 = Math.max(gx1, gx); gy0 = Math.min(gy0, gy); gy1 = Math.max(gy1, gy);
  }
  if (gx1 - gx0 < 6) { const m = (gx0 + gx1) / 2; gx0 = m - 3; gx1 = m + 3; }
  if (gy1 - gy0 < 6) { const m = (gy0 + gy1) / 2; gy0 = m - 3; gy1 = m + 3; }
  const T = new THREE.Vector3((gx0 + gx1) / 2, 0, (gy0 + gy1) / 2);
  const span = Math.max(gx1 - gx0, gy1 - gy0);
  const D = (span / (2 * Math.tan((FOV * Math.PI) / 360))) * (persp ? 1.05 : 2.4);
  const e = ((persp ? tilt : 89.9) * Math.PI) / 180;
  camera.fov = FOV;
  camera.aspect = 1;
  camera.near = D * 0.05;
  camera.far = D * 5;
  camera.position.copy(T).addScaledVector(U, -D * Math.cos(e));
  camera.position.y = D * Math.sin(e);
  camera.up.copy(persp ? new THREE.Vector3(0, 1, 0) : U);
  camera.lookAt(T);
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  // el trozo de suelo tiene que caber (lo que sobra a los lados, según la proporción de la imagen, son gradas)
  const pts = [[gx0, 0, gy0], [gx1, 0, gy0], [gx1, 0, gy1], [gx0, 0, gy1]];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const v = new THREE.Vector3();
  for (const q of pts) {
    v.set(...q).project(camera);
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
  }
  // se amplía el lado que sobra hasta la proporción de la imagen (lo que entra de más son las gradas)
  let w = x1 - x0, h = y1 - y0;
  let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const w0 = w, h0 = h;
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  // en medio campo y 3/4 el campo se acaba en el corte: lo que sobra se añade por el otro lado (como el corte recto del 2D)
  if (cut) {
    const c = v.set(field.w / 2, 0, field.h).project(camera);
    if (Math.abs(c.y - cy) >= Math.abs(c.x - cx)) { if (h > h0) cy = c.y < cy ? y0 + h / 2 : y1 - h / 2; }
    else if (w > w0) cx = c.x < cx ? x0 + w / 2 : x1 - w / 2;
  }
  camera.setViewOffset(W0, W0, ((cx - w / 2 + 1) / 2) * W0, ((1 - (cy + h / 2)) / 2) * W0, (w / 2) * W0, (h / 2) * W0);
  camera.updateProjectionMatrix();
  return { T, U, span, D };
}

// ── Dibujar ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Dibuja un fotograma en 3D sobre `target` (canvas 2D) con el tamaño de ese canvas.
 * opts: { camera, frame, aspect, fullView, viewOverride } como en Board. Devuelve una promesa si faltan texturas por
 * cargar (al cumplirse, hay que volver a dibujar) o null si ya está completo.
 */
export function drawBoard3D(target, board, els, opts = {}) {
  const S = shared();
  const { renderer } = S;
  const look = lookOf(board.look);
  const pending = [];
  const view = boardView(board, opts);
  const W = target.width, H = target.height;
  if (!W || !H) return null;
  // escena fija (cacheada por dibujo)
  const key = staticKey(board) + JSON.stringify(groundRegion(board));
  let st = S.statics.get(key);
  if (!st || !st.complete) {
    if (st) disposeGroup(st.group);
    st = buildStatic(board, pending);
    S.statics.set(key, st);
    if (S.statics.size > 4) { const first = S.statics.keys().next().value; if (first !== key) { disposeGroup(S.statics.get(first).group); S.statics.delete(first); } }
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(st.background);
  scene.add(st.group);
  const region = st.region;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 1000);
  const cam = placeCamera(camera, board, view, W / H, opts.tilt);
  const sc = SCREEN[orientOf(board.orient)];
  const scr = { angle: orientAngle(orientOf(board.orient)), texRot: Math.atan2(-sc.up[0], -sc.up[1]) };
  // luz: ambiente + sol desde arriba a la izquierda de la pantalla (las sombras caen abajo a la derecha, como en 2D)
  const s = styleOf(look);
  const night = look === "estadio-noche" || !!styleOf(look).stadium?.night;
  scene.add(new THREE.HemisphereLight(night ? 0xc8d0ff : 0xffffff, night ? 0x202840 : 0x6b7a70, night ? 1.9 : 2.1));
  const sun = new THREE.DirectionalLight(0xffffff, night ? 1.3 : 1.7);
  const R3 = new THREE.Vector3(sc.right[0], 0, sc.right[1]);
  // el sol y su sombra cubren todo el estadio, sea cual sea el encuadre
  const full = fieldOf(isCutField(board.field) ? "full" : board.field);
  const C = new THREE.Vector3(full.w / 2, 0, full.h / 2);
  const big = Math.max(full.w, full.h) + 2 * S3.outer;
  sun.position.copy(C).addScaledVector(R3, -big * 0.35).addScaledVector(cam.U, big * 0.55).add(new THREE.Vector3(0, big * 0.9, 0));
  sun.target.position.copy(C);
  sun.castShadow = (s.shadow || 0) > 0;
  const half = big * 0.62;
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: big * 3 });
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  // lo pintado en el suelo
  // (al dibujar en 3D: lo que se está dibujando y la marca de lo elegido que va en el suelo)
  const sel = opts.sel || [];
  const flat = [...els.filter(isFlatMark), ...draftEls(opts.draft)];
  const flatSel = sel.filter((id) => flat.some((e) => e.id === id));
  if (flat.length) {
    const linked = new Set(flat.filter((e) => e.k === "link").flatMap((e) => e.ids || []));
    const mk = JSON.stringify([flat, flatSel, els.filter((e) => linked.has(e.id)).map((e) => [e.id, e.x, e.y]), look, board.teams || null]);
    const tex = asyncTexture(`marks:${key}:${mk}`, () => svgCanvas(React.createElement(GroundMarksSvg, { board, els: flat, all: els, region, sel: [...flatSel, "draft"] }), 3072), pending, 40, S.marks);
    const prev = S.lastMarks?.get(target);
    const use = tex || (prev && prev.key === key ? prev.tex : null);
    if (tex) { if (!S.lastMarks) S.lastMarks = new WeakMap(); S.lastMarks.set(target, { key, tex }); }
    if (use) {
      const rw = region[2] - region[0], rh = region[3] - region[1];
      const m = new THREE.Mesh(geo("unitPlane", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), new THREE.MeshBasicMaterial({ map: use, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.scale.set(rw, 1, rh);
      m.position.set(region[0] + rw / 2, 0.03, region[1] + rh / 2);
      m.renderOrder = 1;
      scene.add(m);
    }
  }
  // fichas, balón, material, porterías y textos
  const chip = chipOf(board);
  const dyn = new THREE.Group();
  for (const el of els) {
    if (isFlatMark(el)) continue;
    const o = buildPiece(board, el, look, chip, scr, pending);
    if (!o) continue;
    if ((el.opacity ?? 1) < 1) o.traverse((n) => { if (n.material) { n.material = n.material.clone(); n.material.transparent = true; n.material.opacity *= el.opacity; } });
    dyn.add(o);
  }
  scene.add(dyn);
  // lo elegido (al dibujar en 3D): un aro naranja en el suelo
  for (const id of sel) {
    const el = els.find((e) => e.id === id);
    if (!el || isFlatMark(el) || el.x == null) continue;
    const R = pickRadius(board, el, chip) * 1.25 + 0.4;
    const ring = new THREE.Mesh(geo("selRing", () => new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2)), new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.95, depthTest: false }));
    ring.scale.set(R, 1, R);
    ring.position.set(el.x, 0.06, el.y);
    ring.renderOrder = 5;
    dyn.add(ring);
  }
  // dibujar en el canvas compartido y copiar
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  // En perspectiva, lo que queda entre la cámara y el borde de abajo de la imagen (la grada de este lado) solo puede tapar el
  // campo: se recorta (con zoom cerca de la portería de abajo, la grada y su cubierta tapaban el área)
  renderer.clippingPlanes = [];
  if (isPersp(board)) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, -1), camera);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    if (hit) renderer.clippingPlanes = [new THREE.Plane(cam.U.clone(), -(cam.U.dot(hit) - 2))];
  }
  renderer.render(scene, camera);
  renderer.clippingPlanes = [];
  const g = target.getContext("2d");
  g.drawImage(renderer.domElement, 0, 0, W, H);
  // la cámara se guarda para llevar el puntero al campo y saber qué hay debajo
  S.views.set(target, { camera, W, H, board, chip });
  // limpiar lo de este fotograma (las geometrías y materiales compartidos se quedan)
  scene.remove(st.group);
  dyn.traverse((n) => { if (n.isSprite) n.material.dispose(); else if (n.material && !Array.from(S.mats.values()).includes(n.material)) { n.material.dispose(); } });
  sun.shadow.map?.dispose();
  if (!pending.length) return null;
  return Promise.allSettled(pending).then(() => true);
}
function disposeGroup(g) {
  g.traverse((n) => { n.geometry?.dispose?.(); if (n.material && !n.material.isMeshLambertMaterial) n.material.dispose?.(); });
}

/** Dibuja en 3D y espera a que estén todas las texturas (para la imagen PNG y el vídeo). */
export async function renderBoard3D(target, board, els, opts = {}) {
  for (let i = 0; i < 6; i++) {
    const p = drawBoard3D(target, board, els, opts);
    if (!p) return target;
    await p;
  }
  return target;
}

// ── Dibujar en 3D: puntero → campo y qué hay debajo ──────────────────────────────────────────────────────────────────
// Lo que se está dibujando (flecha, zona o recuadro de elegir) se pinta en el suelo como un elemento más
function draftEls(d) {
  if (!d) return [];
  if (d.k === "box") {
    const x = Math.min(d.x, d.x + d.w), y = Math.min(d.y, d.y + d.h);
    return [{ id: "draft", k: "zone", shape: "rect", x, y, w: Math.abs(d.w), h: Math.abs(d.h), fill: "#f59e0b", fillOpacity: 0.14, stroke: "#f59e0b", dash: "dashed", strokeWidth: 0.35 }];
  }
  if (d.k === "zone") {
    const x = Math.min(d.x, d.x + d.w), y = Math.min(d.y, d.y + d.h);
    return [{ ...d, id: "draft", x, y, w: Math.abs(d.w), h: Math.abs(d.h) }];
  }
  return [{ ...d, id: "draft" }];
}
// Lo que se agarra en 3D por donde se ve (de pie); lo demás (pintado en el suelo, porterías, escaleras) se agarra en el suelo
export const pickable3D = (el) => el.k === "token" || el.k === "ball" || el.k === "text" || (el.k === "cone" && el.shape !== "flat") || el.k === "pole" || el.k === "dummy" || el.k === "hurdle";
function pickRadius(board, el, chip) {
  const k = Number(el.size) || 1;
  if (el.k === "token") return tokenR(chip, el) * (isPersp(board) ? PERSP.chip : 1) * 0.92;
  if (el.k === "ball") return ballR(chip) * k * 0.75;
  if (el.k === "text") return (Number(el.size) || 3) * Math.max(1, String(el.text || "").length * 0.3);
  if (el.k === "goal") return (Number(el.w) || 7.32) / 2;
  return 1.2 * k;
}
const pickHeight = (el, chip) => (el.k === "token" ? 0.3 : el.k === "text" ? (Number(el.size) || 3) * 0.6 : el.k === "pole" ? 1.2 : el.k === "dummy" ? 1.1 : 0.6);
/** Punto del campo (m) bajo el píxel (px, py) del canvas, o null si no se ha dibujado todavía. */
export function groundAt(target, px, py) {
  const v = shared().views.get(target);
  if (!v) return null;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((px / v.W) * 2 - 1, -((py / v.H) * 2 - 1)), v.camera);
  const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  return hit ? { x: hit.x, y: hit.z } : null;
}
/** Píxel del canvas de un punto del campo a una altura h. */
export function projectAt(target, x, y, h = 0) {
  const v = shared().views.get(target);
  if (!v) return null;
  const q = new THREE.Vector3(x, h, y).project(v.camera);
  return { x: ((q.x + 1) / 2) * v.W, y: ((1 - q.y) / 2) * v.H, depth: q.z };
}
/** Lo que se ve bajo el píxel (de la lista, de arriba abajo); solo lo que está de pie (`pickable3D`). */
export function pickAt(target, list, px, py) {
  const v = shared().views.get(target);
  if (!v) return null;
  let best = null;
  for (const el of list) {
    if (!pickable3D(el) || el.x == null) continue;
    const r = pickRadius(v.board, el, v.chip), h = pickHeight(el, v.chip);
    const c = projectAt(target, el.x, el.y, h);
    // radio en pantalla: el punto a r metros hacia la derecha de la cámara
    const right = new THREE.Vector3().setFromMatrixColumn(v.camera.matrixWorld, 0);
    const e = projectAt(target, el.x + right.x * r, el.y + right.z * r, h);
    const rp = Math.max(10, Math.hypot(e.x - c.x, e.y - c.y) * 1.1);
    const d = Math.hypot(px - c.x, py - c.y);
    if (d <= rp && (!best || c.depth < best.depth - 1e-4 || (Math.abs(c.depth - best.depth) <= 1e-4 && d < best.d))) best = { el, d, depth: c.depth };
  }
  return best?.el || null;
}
