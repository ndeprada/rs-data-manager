// Geometría común de las gradas del estadio (vista plana, perspectiva y 3D), en metros del campo (vertical, y hacia abajo).
// Rehecha el 03/11/2026 (Nacho: «en los córners no hay escaleras de acceso… las de detrás de la portería se ven irregulares…
// que quede como un estadio normal»). Cómo es:
// - Filas paralelas a las líneas en los cuatro lados y, en las esquinas, arcos con centro en el banderín de córner (todas las
//   filas comparten centro: las escaleras de las esquinas son rectas, hacia el banderín).
// - Escaleras: en cada lado, una en el centro y otras repartidas cada ~12 m, más una al final de cada lado (donde empieza la
//   esquina); en cada esquina, una a 45° en la grada baja y tres (22,5°, 45° y 67,5°) en la grada alta, que es más larga.
// - Asientos: en cada tramo entre dos escaleras se reparten por igual; en los lados, todas las filas tienen los asientos en las
//   mismas columnas.
// Sin importaciones de la app: se prueba en Node.

export const SEAT = 1.1; // un asiento cada ~1,1 m
export const SEAT_HL = 0.46; // medio ancho del asiento
export const STAIR_W = 1.3; // ancho de una escalera
// Gradas grandes (como en FmStadio, no van a escala): grada baja, pasillo, grada alta y muro de atrás
export const BIG_STAND = { track: 5.5, row: 1.6, lowRows: 12, aisle: 3.2, upRows: 13, back: 1.0, roofIn: 43, roofOut: 90 };
export const BS = (() => {
  const S = BIG_STAND;
  const lowTop = S.track + S.lowRows * S.row, upStart = lowTop + S.aisle, upTop = upStart + S.upRows * S.row;
  return { ...S, lowTop, upStart, upTop, outer: upTop + S.back };
})();
export const tierOf = (d) => (d < BS.lowTop + 0.01 ? 0 : 1);

// Radio de las esquinas a la distancia d de las líneas: el centro es el banderín de córner
export const cornerR = (d) => Math.max(0, d);

// Rectángulo de esquinas redondeadas a d m por fuera de las líneas (`steps` puntos por esquina)
export function roundRect(field, d, steps = 10) {
  const r = cornerR(d), x0 = -d, y0 = -d, x1 = field.w + d, y1 = field.h + d;
  const arc = (cx, cy, a0) => Array.from({ length: steps }, (_, i) => { const a = ((a0 + (i * 90) / steps) * Math.PI) / 180; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }; });
  return [...arc(x1 - r, y0 + r, -90), ...arc(x1 - r, y1 - r, 0), ...arc(x0 + r, y1 - r, 90), ...arc(x0 + r, y0 + r, 180)];
}

// Lados: centro del lado sobre la línea, dirección a lo largo (u), hacia fuera (n) y medio largo
export function sidesOf(field) {
  const W = field.w, H = field.h;
  return [
    { side: 0, c: { x: W / 2, y: 0 }, u: { x: 1, y: 0 }, n: { x: 0, y: -1 }, half: W / 2 },
    { side: 1, c: { x: W, y: H / 2 }, u: { x: 0, y: 1 }, n: { x: 1, y: 0 }, half: H / 2 },
    { side: 2, c: { x: W / 2, y: H }, u: { x: -1, y: 0 }, n: { x: 0, y: 1 }, half: W / 2 },
    { side: 3, c: { x: 0, y: H / 2 }, u: { x: 0, y: -1 }, n: { x: -1, y: 0 }, half: H / 2 },
  ];
}
// Esquinas: banderín y ángulo de inicio (grados; la esquina va de a0 a a0 + 90, en el sentido de los lados)
export function cornersOf(field) {
  const W = field.w, H = field.h;
  return [
    { corner: 0, c: { x: W, y: 0 }, a0: -90 },
    { corner: 1, c: { x: W, y: H }, a0: 0 },
    { corner: 2, c: { x: 0, y: H }, a0: 90 },
    { corner: 3, c: { x: 0, y: 0 }, a0: 180 },
  ];
}

// Escaleras de un lado (centros, en m desde el centro del lado): centro, repartidas cada ~12 m y una al final de cada lado
export function sideStairs(half) {
  const n = Math.max(1, Math.round(half / 12));
  const out = [];
  for (let k = -n + 1; k <= n - 1; k++) out.push((k * half) / n);
  out.push(-half + STAIR_W / 2, half - STAIR_W / 2);
  return out.sort((a, b) => a - b);
}
// Escaleras de una esquina (grados desde su inicio)
export const cornerStairs = (tier) => (tier ? [22.5, 45, 67.5] : [45]);

const at = (sd, t, d) => ({ x: sd.c.x + sd.u.x * t + sd.n.x * d, y: sd.c.y + sd.u.y * t + sd.n.y * d });
const polar = (cn, a, r) => { const ar = (a * Math.PI) / 180; return { x: cn.c.x + Math.cos(ar) * r, y: cn.c.y + Math.sin(ar) * r }; };

// Asientos de una fila a la distancia d (la línea de los asientos): [{ a, b, n, part, i }]
// a–b = el asiento de lado a lado, n = hacia fuera (para el respaldo), part + i = sitio estable (el mismo en todas las filas)
export function rowSeats(field, d, tier = tierOf(d)) {
  const out = [];
  for (const sd of sidesOf(field)) {
    const st = sideStairs(sd.half);
    for (let s = 0; s + 1 < st.length; s++) {
      const g0 = st[s] + STAIR_W / 2, g1 = st[s + 1] - STAIR_W / 2, len = g1 - g0;
      const n = Math.floor(len / SEAT);
      if (n < 1) continue;
      const sp = len / n, hl = Math.min(SEAT_HL, sp * 0.42);
      for (let i = 0; i < n; i++) {
        const t = g0 + sp * (i + 0.5);
        out.push({ a: at(sd, t - hl, d), b: at(sd, t + hl, d), n: sd.n, part: sd.side * 100 + s, i });
      }
    }
  }
  const r = cornerR(d);
  if (r > 0.5) {
    for (const cn of cornersOf(field)) {
      const marks = [0, ...cornerStairs(tier), 90];
      const half = ((STAIR_W / 2) / r) * (180 / Math.PI); // medio ancho de la escalera, en grados, a este radio
      for (let s = 0; s + 1 < marks.length; s++) {
        const a0 = cn.a0 + marks[s] + (s ? half : 0), a1 = cn.a0 + marks[s + 1] - (s + 1 < marks.length - 1 ? half : 0);
        const len = (r * (a1 - a0) * Math.PI) / 180;
        const n = Math.floor(len / SEAT);
        if (n < 1) continue;
        const da = (a1 - a0) / n, hl = Math.min(SEAT_HL, ((r * da * Math.PI) / 180) * 0.42);
        for (let i = 0; i < n; i++) {
          const a = a0 + da * (i + 0.5), ar = (a * Math.PI) / 180;
          const p = polar(cn, a, r), tx = -Math.sin(ar), ty = Math.cos(ar);
          out.push({ a: { x: p.x - tx * hl, y: p.y - ty * hl }, b: { x: p.x + tx * hl, y: p.y + ty * hl }, n: { x: Math.cos(ar), y: Math.sin(ar) }, part: 1000 + cn.corner * 10 + s, i });
        }
      }
    }
  }
  return out;
}

// Escaleras entre las distancias d0 y d1 (un peldaño, o un tramo entero): polígonos de 4 puntos (lado del campo primero)
export function stairQuads(field, d0, d1, tier = tierOf((d0 + d1) / 2)) {
  const out = [];
  const w = STAIR_W / 2;
  for (const sd of sidesOf(field)) {
    for (const t of sideStairs(sd.half)) out.push([at(sd, t - w, d0), at(sd, t + w, d0), at(sd, t + w, d1), at(sd, t - w, d1)]);
  }
  for (const cn of cornersOf(field)) {
    for (const m of cornerStairs(tier)) {
      const ar = ((cn.a0 + m) * Math.PI) / 180, rx = Math.cos(ar), ry = Math.sin(ar), px = -ry * w, py = rx * w;
      const P = (r, sgn) => ({ x: cn.c.x + rx * r + px * sgn, y: cn.c.y + ry * r + py * sgn });
      out.push([P(d0, -1), P(d0, 1), P(d1, 1), P(d1, -1)]);
    }
  }
  return out;
}

// Filas de las dos gradas: { d0, d1, tier, t } (t = de 0 delante a 1 al fondo, para el degradado de los asientos)
export function standRows() {
  const rows = [];
  for (let i = 0; i < BS.lowRows; i++) rows.push({ d0: BS.track + i * BS.row, d1: BS.track + (i + 1) * BS.row, tier: 0, t: (i / (BS.lowRows - 1)) * 0.45 });
  for (let j = 0; j < BS.upRows; j++) rows.push({ d0: BS.upStart + j * BS.row, d1: BS.upStart + (j + 1) * BS.row, tier: 1, t: 0.55 + (j / (BS.upRows - 1)) * 0.45 });
  return rows;
}

// Reparto fijo (sin azar) para mezclar un poco los tonos de los asientos
export const seatHash = (part, i, row) => ((((part * 73856093) ^ (i * 19349663) ^ (row * 83492791)) >>> 0) % 1000) / 1000;
