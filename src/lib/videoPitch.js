// Análisis de vídeo · calibración del campo (fase 1: sobre una imagen congelada).
// Lógica pura, probada en tests/videoPitch.test.mjs.
//
// Se marcan en la imagen al menos 4 puntos que se conocen del campo (esquinas de las áreas, cruce de la línea de medio
// campo con la banda…). Con ellos se calcula la «homografía»: la fórmula que pasa de metros del césped a la imagen y al
// revés. Con eso se pueden dibujar círculos y rectángulos tumbados sobre el césped, medir distancias en metros y pintar
// las líneas y las zonas del campo encima del vídeo.
//
// Metros: X a lo largo del campo (0 = línea de fondo de la izquierda del dibujo, `len` = la de la derecha) e Y a lo
// ancho (0 = banda de arriba del dibujo, `wid` = banda de abajo). Imagen: x e y de 0 a 1 (fracción del vídeo).

export const PITCH_TYPES = {
  f11: { name: "Fútbol 11", len: 105, wid: 68, box: { d: 16.5, w: 40.32 }, small: { d: 5.5, w: 18.32 }, spot: 11, circle: 9.15, arc: true, goal: 7.32 },
  f7: { name: "Fútbol 7", len: 65, wid: 45, box: { d: 9, w: 24 }, small: { d: 3, w: 12 }, spot: 9, circle: 6, arc: false, goal: 6, offside: 12 },
};

// Medidas del campo calibrado: tipo + largo y ancho que haya puesto la persona (cada campo es distinto)
export function pitchOf(cal) {
  const base = PITCH_TYPES[cal?.field] || PITCH_TYPES.f11;
  const len = clampNum(cal?.len, 30, 130, base.len), wid = clampNum(cal?.wid, 20, 100, base.wid);
  return { ...base, field: PITCH_TYPES[cal?.field] ? cal.field : "f11", len, wid };
}
const clampNum = (v, a, b, def) => (Number.isFinite(+v) && +v > 0 ? Math.max(a, Math.min(b, +v)) : def);

// Puntos que se pueden reconocer en la imagen, con su nombre. `k` es la clave que se guarda.
export function landmarks(p) {
  const { len: L, wid: W } = p, cy = W / 2, bw = p.box.w / 2, sw = p.small.w / 2, out = [];
  const add = (k, name, x, y) => out.push({ k, name, x, y });
  for (const [side, x0, dir] of [["i", 0, 1], ["d", L, -1]]) {
    const lado = side === "i" ? "izquierda" : "derecha";
    add(`c${side}a`, `Córner ${lado} · arriba`, x0, 0);
    add(`c${side}b`, `Córner ${lado} · abajo`, x0, W);
    add(`g${side}fa`, `Área grande ${lado} · en la línea de fondo, arriba`, x0, cy - bw);
    add(`g${side}fb`, `Área grande ${lado} · en la línea de fondo, abajo`, x0, cy + bw);
    add(`g${side}a`, `Área grande ${lado} · esquina de arriba`, x0 + dir * p.box.d, cy - bw);
    add(`g${side}b`, `Área grande ${lado} · esquina de abajo`, x0 + dir * p.box.d, cy + bw);
    add(`p${side}fa`, `Área pequeña ${lado} · en la línea de fondo, arriba`, x0, cy - sw);
    add(`p${side}fb`, `Área pequeña ${lado} · en la línea de fondo, abajo`, x0, cy + sw);
    add(`p${side}a`, `Área pequeña ${lado} · esquina de arriba`, x0 + dir * p.small.d, cy - sw);
    add(`p${side}b`, `Área pequeña ${lado} · esquina de abajo`, x0 + dir * p.small.d, cy + sw);
    add(`s${side}`, `Punto de penalti ${lado}`, x0 + dir * p.spot, cy);
    if (p.arc) {
      const h = Math.sqrt(p.circle ** 2 - (p.box.d - p.spot) ** 2);
      add(`a${side}a`, `Arco del área ${lado} · arriba (donde toca el área)`, x0 + dir * p.box.d, cy - h);
      add(`a${side}b`, `Arco del área ${lado} · abajo (donde toca el área)`, x0 + dir * p.box.d, cy + h);
    }
  }
  add("ma", "Medio campo · banda de arriba", L / 2, 0);
  add("mb", "Medio campo · banda de abajo", L / 2, W);
  add("mc", "Centro del campo", L / 2, cy);
  add("mca", "Círculo central · arriba", L / 2, cy - p.circle);
  add("mcb", "Círculo central · abajo", L / 2, cy + p.circle);
  return out;
}

// Líneas del campo en metros: lista de polilíneas [[{x,y},…], …]
export function pitchLines(p) {
  const { len: L, wid: W } = p, cy = W / 2, out = [];
  const rect = (x0, y0, x1, y1) => out.push([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }]);
  const arc = (cx, cyy, r, a0, a1, n = 48) => { const l = []; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; l.push({ x: cx + r * Math.cos(a), y: cyy + r * Math.sin(a) }); } out.push(l); };
  rect(0, 0, L, W);
  out.push([{ x: L / 2, y: 0 }, { x: L / 2, y: W }]);
  arc(L / 2, cy, p.circle, 0, Math.PI * 2, 64);
  for (const [x0, dir] of [[0, 1], [L, -1]]) {
    const bx = x0 + dir * p.box.d, sx = x0 + dir * p.small.d;
    out.push([{ x: x0, y: cy - p.box.w / 2 }, { x: bx, y: cy - p.box.w / 2 }, { x: bx, y: cy + p.box.w / 2 }, { x: x0, y: cy + p.box.w / 2 }]);
    out.push([{ x: x0, y: cy - p.small.w / 2 }, { x: sx, y: cy - p.small.w / 2 }, { x: sx, y: cy + p.small.w / 2 }, { x: x0, y: cy + p.small.w / 2 }]);
    arc(x0 + dir * p.spot, cy, 0.25, 0, Math.PI * 2, 10);
    if (p.arc) {
      const h = Math.sqrt(p.circle ** 2 - (p.box.d - p.spot) ** 2), a = Math.atan2(h, p.box.d - p.spot);
      if (dir > 0) arc(x0 + p.spot, cy, p.circle, -a, a, 24); else arc(x0 - p.spot, cy, p.circle, Math.PI - a, Math.PI + a, 24);
    }
    if (p.offside) out.push([{ x: x0 + dir * p.offside, y: 0 }, { x: x0 + dir * p.offside, y: W }]);
  }
  return out;
}

// Zonas tácticas que se pueden pintar encima del césped
export const MARKS = [
  ["", "Ninguna"],
  ["carriles5", "5 carriles"],
  ["carriles3", "3 carriles"],
  ["tercios", "Tercios"],
  ["franjas6", "6 franjas"],
  ["zonas18", "18 zonas (3 × 6)"],
];
export function markLines(p, kind) {
  const { len: L, wid: W } = p, cy = W / 2, out = [];
  const across = (x) => out.push([{ x, y: 0 }, { x, y: W }]);
  const along = (y) => out.push([{ x: 0, y }, { x: L, y }]);
  if (kind === "carriles5") [cy - p.box.w / 2, cy - p.small.w / 2, cy + p.small.w / 2, cy + p.box.w / 2].forEach(along);
  if (kind === "carriles3" || kind === "zonas18") [cy - p.box.w / 2, cy + p.box.w / 2].forEach(along);
  if (kind === "tercios") [L / 3, (2 * L) / 3].forEach(across);
  if (kind === "franjas6" || kind === "zonas18") [1, 2, 4, 5].forEach((i) => across((L * i) / 6)); // la de medio campo ya está pintada
  return out;
}

// ---------- homografía ----------
// Resuelve A·x = b (Gauss con pivote parcial); null si no tiene solución única
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / M[c][c]; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / M[i][i]);
}
// Traslada y escala los puntos para que el cálculo sea estable (centro 0, distancia media √2)
function normT(pts) {
  const n = pts.length; let mx = 0, my = 0; pts.forEach((p) => { mx += p.x; my += p.y; }); mx /= n; my /= n;
  let d = 0; pts.forEach((p) => { d += Math.hypot(p.x - mx, p.y - my); }); d = d / n || 1; const s = Math.SQRT2 / d;
  return [[s, 0, -s * mx], [0, s, -s * my], [0, 0, 1]];
}
const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
export function applyH(H, p) {
  const w = H[2][0] * p.x + H[2][1] * p.y + H[2][2];
  return { x: (H[0][0] * p.x + H[0][1] * p.y + H[0][2]) / w, y: (H[1][0] * p.x + H[1][1] * p.y + H[1][2]) / w, w };
}
export function invertH(H) {
  const [[a, b, c], [d, e, f], [g, h, i]] = H;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-15) return null;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}
// H que pasa de `src` a `dst` (listas de {x,y} emparejadas, ≥4). Con más de 4, ajuste por mínimos cuadrados.
export function homography(src, dst) {
  if (src.length < 4 || src.length !== dst.length) return null;
  const Ts = normT(src), Td = normT(dst);
  const s = src.map((p) => applyH(Ts, p)), d = dst.map((p) => applyH(Td, p));
  // h22 = 1 → 8 incógnitas; ecuaciones normales AᵀA·h = Aᵀb
  const AtA = Array.from({ length: 8 }, () => new Array(8).fill(0)), Atb = new Array(8).fill(0);
  const row = (r, v) => { for (let i = 0; i < 8; i++) { Atb[i] += r[i] * v; for (let j = 0; j < 8; j++) AtA[i][j] += r[i] * r[j]; } };
  s.forEach((p, k) => {
    const q = d[k];
    row([p.x, p.y, 1, 0, 0, 0, -q.x * p.x, -q.x * p.y], q.x);
    row([0, 0, 0, p.x, p.y, 1, -q.y * p.x, -q.y * p.y], q.y);
  });
  const h = solve(AtA, Atb); if (!h || h.some((v) => !Number.isFinite(v))) return null;
  const Hn = [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
  const TdInv = invertH(Td); if (!TdInv) return null;
  const H = mul(TdInv, mul(Hn, Ts)); const k = H[2][2] || 1;
  return H.map((r) => r.map((v) => v / k));
}

// Calibración lista para usar: { p (medidas), H (metros → imagen), Hi (imagen → metros), err (metros), n } o null.
// `aspect` = ancho/alto del vídeo: la imagen se trata en proporción real para que los errores se midan bien.
export function solveCal(cal, aspect = 16 / 9) {
  if (!cal?.pairs || cal.pairs.length < 4) return null;
  const p = pitchOf(cal); const lm = Object.fromEntries(landmarks(p).map((l) => [l.k, l]));
  const pairs = cal.pairs.filter((q) => lm[q.k]); if (pairs.length < 4) return null;
  const G = pairs.map((q) => ({ x: lm[q.k].x, y: lm[q.k].y })), I = pairs.map((q) => ({ x: q.x * aspect, y: q.y }));
  const Ha = homography(G, I); if (!Ha) return null;
  // vuelve a la imagen en fracciones 0..1
  let H = [[Ha[0][0] / aspect, Ha[0][1] / aspect, Ha[0][2] / aspect], Ha[1], Ha[2]];
  // la escala de H puede salir negativa: se le da el signo que deja los puntos marcados «delante» de la cámara
  // (w > 0), así lineImg sabe qué tramos del campo quedan detrás y no se pintan. Signos mezclados = puntos imposibles.
  const ws = G.map((g) => applyH(H, g).w);
  if (ws.every((w) => w < 0)) H = H.map((r) => r.map((v) => -v));
  else if (!ws.every((w) => w > 0)) return null;
  const Hi = invertH(H); if (!Hi) return null;
  let e = 0; pairs.forEach((q, i) => { const g = applyH(Hi, q); e += (g.x - G[i].x) ** 2 + (g.y - G[i].y) ** 2; });
  return { p, H, Hi, n: pairs.length, err: pairs.length > 4 ? Math.sqrt(e / pairs.length) : null };
}
export const toImage = (cal, g) => applyH(cal.H, g);
export const toGround = (cal, q) => applyH(cal.Hi, q);
export const groundDist = (cal, a, b) => { const A = toGround(cal, a), B = toGround(cal, b); return Math.hypot(A.x - B.x, A.y - B.y); };
// Círculo de radio r (m) con centro g (m), en la imagen
export function circleImg(cal, g, r, n = 48) {
  const out = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; out.push(toImage(cal, { x: g.x + r * Math.cos(a), y: g.y + r * Math.sin(a) })); } return out;
}
// Rectángulo alineado con el campo entre dos esquinas de la imagen: sus 4 esquinas en la imagen
export function groundRectImg(cal, a, b) {
  const A = toGround(cal, a), B = toGround(cal, b);
  return [{ x: A.x, y: A.y }, { x: B.x, y: A.y }, { x: B.x, y: B.y }, { x: A.x, y: B.y }].map((g) => toImage(cal, g));
}
// Polilínea en metros → imagen, cortada a lo que queda delante de la cámara y partida en trozos rectos cortos
// (una recta del césped sigue siendo recta en la imagen, pero así se cortan bien los tramos que se salen).
export function lineImg(cal, pts, step = 1.5) {
  const out = []; let cur = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = i ? 1 : 0; k <= n; k++) {
      const g = { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }; const q = toImage(cal, g);
      if (q.w > 0 && q.x > -1 && q.x < 2 && q.y > -1 && q.y < 2) cur.push(q); else if (cur.length) { out.push(cur); cur = []; }
    }
  }
  if (cur.length > 1) out.push(cur);
  return out.filter((l) => l.length > 1);
}
// Texto de la precisión para la persona
export function calQuality(sol) {
  if (!sol) return { level: "none", text: "Faltan puntos: hacen falta 4 como mínimo." };
  if (sol.err == null) return { level: "ok", text: "Con 4 puntos no se puede comprobar la precisión: añade un 5.º punto para saberla." };
  const e = sol.err;
  if (e < 0.6) return { level: "good", text: `Precisión buena (±${e.toFixed(1).replace(".", ",")} m)` };
  if (e < 1.5) return { level: "ok", text: `Precisión aceptable (±${e.toFixed(1).replace(".", ",")} m)` };
  return { level: "bad", text: `Precisión mala (±${e.toFixed(1).replace(".", ",")} m): revisa que cada punto esté en su sitio` };
}
export const fmtM = (m) => (m < 10 ? m.toFixed(1) : Math.round(m).toString()).replace(".", ",") + " m";
