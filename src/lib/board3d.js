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
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  boardView, chipOf, contrastColor, faceOf, fieldOf, groundRegion, hasAds, hasStands, isCutField, isGroundEl, isPersp,
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
const TILT = 50;
const FOV = 30;
const W0 = 10000; // imagen virtual completa (px) para setViewOffset

const FIELD_SPEC = {
  f11: { goalW: 7.32, goalH: 2.44, goalD: 2.0 },
  f7: { goalW: 6, goalH: 2, goalD: 1.5 },
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
  SHARED = { canvas, renderer, statics: new Map(), tex: new Map(), mats: new Map(), geos: {} };
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
function asyncTexture(key, make, pending, limit = 400) {
  const S = shared();
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
// Perfil de la grada (distancia d, altura h): escalones de la grada baja, pasillo, grada alta, cubierta y muro exterior
function standProfile() {
  const S = STAND;
  const segs = [];
  let h = 0;
  const step = (d0, d1, hTread, kind, rowT) => { if (hTread !== h) segs.push({ d0, d1: d0, h0: h, h1: hTread, kind: kind === "seat" ? "riser" : "wall" }); segs.push({ d0, d1, h0: hTread, h1: hTread, kind, rowT }); h = hTread; };
  const nLow = Math.round((S.lowTop - S.track) / S.row), rl = (S.lowTop - S.track) / nLow;
  for (let i = 0; i < nLow; i++) step(S.track + i * rl, S.track + (i + 1) * rl, 0.6 + i * rl * 0.8, "seat", i / (nLow - 1));
  const hA = standHeight(S.lowTop);
  step(S.lowTop, S.ring, hA, "aisle");
  const nUp = Math.round((S.upTop - S.ring) / S.row), ru = (S.upTop - S.ring) / nUp;
  for (let j = 0; j < nUp; j++) step(S.ring + j * ru, S.ring + (j + 1) * ru, hA + 0.5 + j * ru * 1.05, "seat", 0.35 + (0.65 * j) / Math.max(1, nUp - 1));
  const hTop = standHeight(S.roof) + 0.6;
  step(S.upTop, S.roof, hTop, "roof");
  segs.push({ d0: S.roof, d1: S.roof, h0: hTop, h1: 0, kind: "outer" });
  return segs;
}
function buildStands(field, st) {
  const S = STAND;
  const segs = standProfile();
  const rings = new Map();
  const ring = (d) => { if (!rings.has(d)) rings.set(d, ringPts(field, d)); return rings.get(d); };
  // escaleras: cada ~13 m en los lados rectos (mismos sitios que en 2D)
  const ref = ring(S.lowTop);
  const stair = ref.map((p) => {
    if (!p.side) return false;
    const n = Math.max(2, Math.round(p.len / 13));
    for (let k = 1; k < n; k++) if (Math.abs(p.t - k / n) * p.len < 0.55) return true;
    return false;
  });
  const pos = [], col = [];
  const c = new THREE.Color();
  const push = (pts, color) => {
    c.set(color).convertSRGBToLinear();
    for (const p of pts) { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); }
  };
  const seats = (st.seats || []).map((x) => hexOf(x));
  segs.forEach((sg, si) => {
    const A = ring(sg.d0), B = ring(sg.d1);
    const n = A.length;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      const a0 = [A[k].x, sg.h0, A[k].y], a1 = [A[k2].x, sg.h0, A[k2].y], b1 = [B[k2].x, sg.h1, B[k2].y], b0 = [B[k].x, sg.h1, B[k].y];
      let color;
      if (sg.kind === "seat") {
        if (stair[k]) color = st.aisle;
        else {
          const r = hash(k * 31 + si * 7);
          const base = mixHex(st.seatDark || seats[0], st.seatLight || seats[1], sg.rowT * 0.85);
          color = mixHex(base, seats[Math.floor(r * seats.length) % seats.length] || base, 0.45 + 0.2 * hash(k + si * 13));
          if (r > 0.93) color = mixHex(color, "#ffffff", 0.18);
        }
      } else if (sg.kind === "riser") color = mixHex(hexOf(st.riser), "#000000", 0.25);
      else if (sg.kind === "aisle") color = hexOf(st.concourse);
      else if (sg.kind === "roof") color = hexOf(st.roof);
      else if (sg.kind === "outer") color = mixHex(hexOf(st.outer), hexOf(st.roof), 0.6);
      else color = mixHex(hexOf(st.riser), "#000000", 0.1);
      push([a0, a1, b1, a0, b1, b0], color);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // foso entre las vallas y la grada
  const track = flatRing(field, S.ads, S.track, hexOf(st.track));
  const group = new THREE.Group();
  group.add(mesh, track);
  return group;
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
    const m = new THREE.Mesh(g, tex ? new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }) : new THREE.MeshBasicMaterial({ color: new THREE.Color(pn.bg), side: THREE.DoubleSide }));
    m.castShadow = true;
    group.add(m);
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
    g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 5;
    g.strokeRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(NET_CANVAS);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// Portería con la boca en z = 0 mirando a +z y la red hacia −z
function makeGoal(w, h, depth, color = "#ffffff") {
  const group = new THREE.Group();
  const r = Math.max(0.05, Math.min(0.08, w * 0.011));
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
  // red: techo (del larguero al fondo), fondo y laterales
  const quads = [
    [[-x, h, 0], [x, h, 0], [x, hb, -depth], [-x, hb, -depth]],
    [[-x, hb, -depth], [x, hb, -depth], [x, 0, -depth], [-x, 0, -depth]],
    [[-x, h, 0], [-x, hb, -depth], [-x, 0, -depth], [-x, 0, 0]],
    [[x, h, 0], [x, hb, -depth], [x, 0, -depth], [x, 0, 0]],
  ];
  const pos = [], uv = [];
  const cell = 0.16;
  for (const q of quads) {
    const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const U = len(q[0], q[1]) / cell, V = len(q[1], q[2]) / cell;
    const t = [[0, 0], [U, 0], [U, V], [0, V]];
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...q[i]); uv.push(...t[i]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  const net = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: netTexture(), color: new THREE.Color(hexOf(color, "#ffffff")), transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
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
      group.add(buildStands(full, s.stadium));
      // por fuera de la grada (las esquinas son redondas), el color de alrededor del estadio
      group.add(flatRing(full, STAND.roof - 0.05, 60, bg));
    }
    if (hasAds(board)) group.add(buildAds(full, board, pending));
  }
  // porterías del campo
  if (field.id !== "free") {
    const sp = field.id === "f7" ? FIELD_SPEC.f7 : FIELD_SPEC.f11;
    const ink = look === "bn" ? "#111111" : "#ffffff";
    const top = makeGoal(sp.goalW, sp.goalH, sp.goalD, ink);
    top.position.set(full.w / 2, 0, 0);
    top.rotation.y = Math.PI;
    group.add(top);
    const bot = makeGoal(sp.goalW, sp.goalH, sp.goalD, ink);
    bot.position.set(full.w / 2, 0, full.h);
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

let BALL_CANVAS = null;
function ballTexture(bs) {
  const key = `ball:${bs.pattern}:${bs.color}:${bs.color2}`;
  const S = shared();
  if (S.tex.has(key)) return S.tex.get(key).texture;
  BALL_CANVAS = document.createElement("canvas");
  BALL_CANVAS.width = 512; BALL_CANVAS.height = 256;
  const g = BALL_CANVAS.getContext("2d");
  g.fillStyle = bs.color; g.fillRect(0, 0, 512, 256);
  g.fillStyle = bs.color2;
  if (bs.pattern === "stripe") g.fillRect(0, 108, 512, 40);
  else if (bs.pattern !== "plain") {
    // las 12 manchas del balón clásico (vértices de un icosaedro)
    const pts = [[90, 0], [-90, 0]];
    for (let i = 0; i < 5; i++) { pts.push([26.57, i * 72]); pts.push([-26.57, i * 72 + 36]); }
    for (const [lat, lon] of pts) {
      const y = ((90 - lat) / 180) * 256;
      const rr = 22;
      const sx = 1 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
      for (const dx of [-512, 0, 512]) {
        g.beginPath();
        g.ellipse(((lon + 180) / 360) * 512 + dx, y, rr * sx, rr, 0, 0, Math.PI * 2);
        g.fill();
      }
      if (Math.abs(lat) === 90) g.fillRect(0, lat > 0 ? 0 : 256 - 14, 512, 14);
    }
  }
  const t = canvasTexture(BALL_CANVAS);
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
    const rb = Math.max(0.7, chip * 0.55) * k * 0.75;
    const bs = ballStyle(el);
    const m = new THREE.Mesh(geo("ball", () => new THREE.SphereGeometry(1, 32, 20)), new THREE.MeshLambertMaterial({ map: ballTexture(bn ? { pattern: "dot", color: "#ffffff", color2: "#111111" } : bs) }));
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
    const h = w >= 7 ? 2.44 : w >= 5 ? 2 : Math.max(0.8, w * 0.5);
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
// Coloca la cámara para que el recuadro completo (`fullVb`) sea el suelo del dibujo y enseña la fracción `vb` de él
function placeCamera(camera, board, region, fullVb, vb) {
  const orient = orientOf(board.orient);
  const sc = SCREEN[orient];
  const U = new THREE.Vector3(sc.up[0], 0, sc.up[1]);
  const persp = isPersp(board);
  const rw = region[2] - region[0], rh = region[3] - region[1];
  const T = new THREE.Vector3(region[0] + rw / 2, 0, region[1] + rh / 2);
  const span = Math.max(rw, rh);
  const D = (span / (2 * Math.tan((FOV * Math.PI) / 360))) * (persp ? 0.9 : 2.4);
  const e = ((persp ? TILT : 89.9) * Math.PI) / 180;
  camera.fov = FOV;
  camera.aspect = 1;
  camera.near = D * 0.05;
  camera.far = D * 4;
  camera.position.copy(T).addScaledVector(U, -D * Math.cos(e));
  camera.position.y = D * Math.sin(e);
  camera.up.copy(persp ? new THREE.Vector3(0, 1, 0) : U);
  camera.lookAt(T);
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  // puntos que deben caber: esquinas y mitades del suelo, levantadas lo que mide la grada en ese lado
  const field = fieldOf(board.field);
  const stadium = isStadium(lookOf(board.look)) && hasStands(board);
  const hAt = (d) => (stadium && d > STAND.track ? standHeight(Math.min(d, STAND.roof)) + 0.6 : 0);
  const xs = [region[0], (region[0] + region[2]) / 2, region[2]], ys = [region[1], (region[1] + region[3]) / 2, region[3]];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const v = new THREE.Vector3();
  for (const x of xs) for (const y of ys) {
    const d = Math.max(-x, x - field.w, -y, y - field.h, 0);
    for (const hh of [0, hAt(d)]) {
      v.set(x, hh, y).project(camera);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
  }
  // al recuadro completo se le da la proporción del de 2D (para que la cámara de la pizarra encuadre lo mismo)
  const A = fullVb[2] / fullVb[3];
  let w = x1 - x0, h = y1 - y0;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (w / h < A) w = h * A; else h = w / A;
  const R = { x: ((cx - w / 2 + 1) / 2) * W0, y: ((1 - (cy + h / 2)) / 2) * W0, w: (w / 2) * W0, h: (h / 2) * W0 };
  const fx = (vb[0] - fullVb[0]) / fullVb[2], fy = (vb[1] - fullVb[1]) / fullVb[3], fw = vb[2] / fullVb[2], fh = vb[3] / fullVb[3];
  camera.setViewOffset(W0, W0, R.x + fx * R.w, R.y + fy * R.h, fw * R.w, fh * R.h);
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
  const { fullVb, vb } = boardView(board, opts);
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
  const cam = placeCamera(camera, board, region, fullVb, vb);
  const sc = SCREEN[orientOf(board.orient)];
  const scr = { angle: orientAngle(orientOf(board.orient)), texRot: Math.atan2(-sc.up[0], -sc.up[1]) };
  // luz: ambiente + sol desde arriba a la izquierda de la pantalla (las sombras caen abajo a la derecha, como en 2D)
  const s = styleOf(look);
  const night = look === "estadio-noche";
  scene.add(new THREE.HemisphereLight(night ? 0xc8d0ff : 0xffffff, night ? 0x202840 : 0x6b7a70, night ? 1.9 : 2.1));
  const sun = new THREE.DirectionalLight(0xffffff, night ? 1.3 : 1.7);
  const R3 = new THREE.Vector3(sc.right[0], 0, sc.right[1]);
  sun.position.copy(cam.T).addScaledVector(R3, -cam.span * 0.35).addScaledVector(cam.U, cam.span * 0.55).add(new THREE.Vector3(0, cam.span * 0.9, 0));
  sun.target.position.copy(cam.T);
  sun.castShadow = (s.shadow || 0) > 0;
  const half = cam.span * 0.75;
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: cam.span * 3 });
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  // lo pintado en el suelo
  const flat = els.filter(isFlatMark);
  if (flat.length) {
    const linked = new Set(flat.filter((e) => e.k === "link").flatMap((e) => e.ids || []));
    const mk = JSON.stringify([flat, els.filter((e) => linked.has(e.id)).map((e) => [e.id, e.x, e.y]), look, board.teams || null]);
    const tex = asyncTexture(`marks:${key}:${mk}`, () => svgCanvas(React.createElement(GroundMarksSvg, { board, els: flat, all: els, region }), 3072), pending, 60);
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
  // dibujar en el canvas compartido y copiar
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.render(scene, camera);
  const g = target.getContext("2d");
  g.drawImage(renderer.domElement, 0, 0, W, H);
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
