// Efecto imán al dibujar flechas y zonas, como en PowerPoint (03/11/2026, Nacho: «el extremo de la línea se atrae con la
// mitad o el vértice del cuadrado… una línea vertical automáticamente se me pone recta, y en horizontal igual… con Control,
// el movimiento libre»). Funciones puras, en metros del campo (sin importaciones de la app: se prueban en Node).
//
// - Imán a puntos: esquinas, puntos medios de los lados y centro de las zonas; esquinas y puntos medios de las zonas libres;
//   extremos y quiebros de las otras flechas; centro de fichas, balón, conos, material y textos.
// - Recto: si el tramo está casi horizontal o casi vertical (a menos de `angle` grados), se pone recto del todo.
//   Con varios puntos de referencia (un quiebro tiene dos vecinos) cada eje se endereza con el que más cerca esté.
// - Con el recto puesto, el extremo además se alinea con un punto de referencia cercano a lo largo de esa línea.

const CENTER_KINDS = new Set(["token", "ball", "cone", "goal", "pole", "hurdle", "ladder", "dummy", "text"]);

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const num = (v) => typeof v === "number" && Number.isFinite(v);

export function snapAnchors(els, skipId = null) {
  const out = [];
  const put = (x, y, kind, id) => { if (num(x) && num(y)) out.push({ x, y, kind, id }); };
  for (const el of els || []) {
    if (!el || el.id === skipId) continue;
    if (el.k === "zone") {
      if (el.shape === "quad" && Array.isArray(el.pts) && el.pts.length === 4) {
        el.pts.forEach((q, i) => { put(q.x, q.y, "corner", el.id); const m = mid(q, el.pts[(i + 1) % 4]); put(m.x, m.y, "mid", el.id); });
        continue;
      }
      if (![el.x, el.y, el.w, el.h].every(num)) continue;
      const x0 = Math.min(el.x, el.x + el.w), x1 = Math.max(el.x, el.x + el.w);
      const y0 = Math.min(el.y, el.y + el.h), y1 = Math.max(el.y, el.y + el.h);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      // en una elipse las esquinas del recuadro no tocan la forma: solo los cuatro puntos de su borde y el centro
      if (el.shape !== "ellipse") { put(x0, y0, "corner", el.id); put(x1, y0, "corner", el.id); put(x1, y1, "corner", el.id); put(x0, y1, "corner", el.id); }
      put(cx, y0, "mid", el.id); put(x1, cy, "mid", el.id); put(cx, y1, "mid", el.id); put(x0, cy, "mid", el.id);
      put(cx, cy, "center", el.id);
    } else if (el.k === "arrow") {
      put(el.x1, el.y1, "end", el.id); put(el.x2, el.y2, "end", el.id);
      for (const v of Array.isArray(el.via) ? el.via : []) put(v?.x, v?.y, "end", el.id);
    } else if (CENTER_KINDS.has(el.k)) put(el.x, el.y, "center", el.id);
  }
  return out;
}

// p = punto del puntero; from = punto o lista de puntos desde los que se endereza (el otro extremo, los vecinos de un quiebro).
// Devuelve { x, y, guide } con guide = null (nada), { kind: "point", at } (pegado a un punto) o
// { kind: "axis", lines: [[a, b], …], at? } (enderezado; `at` si además se alineó con un punto).
export function snapPoint(p, { anchors = [], from = null, tol = 0.8, angle = 7, minLen = 1 } = {}) {
  if (!p || !num(p.x) || !num(p.y)) return { x: p?.x, y: p?.y, guide: null };
  // 1) imán a un punto (el más cercano dentro del margen)
  let best = null, bd = tol;
  for (const a of anchors) {
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d <= bd) { bd = d; best = a; }
  }
  if (best) return { x: best.x, y: best.y, guide: { kind: "point", at: { x: best.x, y: best.y } } };
  // 2) recto en horizontal / vertical respecto a los puntos de referencia
  const froms = (Array.isArray(from) ? from : from ? [from] : []).filter((f) => f && num(f.x) && num(f.y));
  if (!froms.length) return { x: p.x, y: p.y, guide: null };
  const t = Math.tan((angle * Math.PI) / 180);
  let sx = null, sy = null;
  for (const f of froms) {
    const dx = p.x - f.x, dy = p.y - f.y;
    if (Math.hypot(dx, dy) < minLen) continue;
    // casi vertical en el campo (x casi igual): x = la del punto de referencia
    if (Math.abs(dx) <= t * Math.abs(dy) && (!sx || Math.abs(dx) < sx.d)) sx = { v: f.x, d: Math.abs(dx), f };
    if (Math.abs(dy) <= t * Math.abs(dx) && (!sy || Math.abs(dy) < sy.d)) sy = { v: f.y, d: Math.abs(dy), f };
  }
  if (!sx && !sy) return { x: p.x, y: p.y, guide: null };
  let x = sx ? sx.v : p.x, y = sy ? sy.v : p.y;
  let at = null;
  // 3) a lo largo de la línea recta, alinearse con un punto de referencia cercano (solo si se enderezó un único eje)
  if (!(sx && sy)) {
    let ad = tol;
    for (const a of anchors) {
      const d = sx ? Math.abs(a.y - y) : Math.abs(a.x - x);
      if (d <= ad) { ad = d; at = a; }
    }
    if (at) { if (sx) y = at.y; else x = at.x; }
  }
  const q = { x, y };
  const lines = [];
  if (sx) lines.push([sx.f, q]);
  if (sy) lines.push([sy.f, q]);
  if (at) lines.push([{ x: at.x, y: at.y }, q]);
  return { x, y, guide: { kind: "axis", lines, at: at ? { x: at.x, y: at.y } : null } };
}

// ¿Se pide movimiento libre? Control (o Alt, o Cmd en el Mac) mientras se arrastra.
export const freeMove = (e) => Boolean(e && (e.ctrlKey || e.altKey || e.metaKey));
