// Colocación de los jugadores en la hoja del entrenador (PDF): círculo con el dorsal y, debajo, nombre y primer apellido.
// Los nombres salen lo más grandes que caben: cada uno se ajusta al hueco que le deja el compañero más cercano en su fila
// (y al borde del campo), y solo baja de tamaño si hace falta. Sin importaciones de la app: se usa también en los tests.
// Todas las medidas en milímetros relativas a la esquina superior izquierda del campo dibujado (pw × ph).
import { playerFirstName } from "./playerName.js";

export const PT = 25.4 / 72; // milímetros por punto tipográfico
export const LINEUP = {
  r: 4.2,        // radio del círculo (antes 5): el dorsal sigue leyéndose y queda más sitio para el nombre
  namePt: 10,    // tamaño de letra del nombre cuando cabe (antes 6,6)
  minPt: 6.5,    // nunca más pequeño que esto (antes 6,6 para todos)
  gap: 1.4,      // aire mínimo entre dos rótulos de la misma fila
  benchPt: 10.5, // nombres del banquillo (antes 8,5)
};

const PARTICLES = ["de", "del", "la", "las", "los", "da", "di", "van", "von", "el", "i"];
export function firstSurname(last = "") {
  const t = last.trim().split(/\s+/).filter(Boolean);
  if (t.length <= 1) return t[0] || "";
  let i = 0;
  while (i < t.length - 1 && PARTICLES.includes(t[i].toLowerCase())) i++;
  return t.slice(0, i + 1).join(" ");
}

/** Mayor tamaño (entre minPt y pt) con el que `text` cabe en `maxW`; si ni así cabe, lo acorta con un punto. widthOf(texto, pt, negrita) → mm */
export function fitText(text, maxW, widthOf, bold, pt, minPt) {
  let size = pt;
  while (size > minPt && widthOf(text, size, bold) > maxW) size = Math.round((size - 0.25) * 100) / 100;
  let out = text;
  if (widthOf(out, size, bold) > maxW) {
    while (out.length > 1 && widthOf(`${out}.`, size, bold) > maxW) out = out.slice(0, -1);
    out = `${out.trimEnd()}.`;
  }
  return { text: out, size };
}

// Posición vertical (mm bajo el centro del círculo) de la línea de base de cada línea del nombre y del final del rótulo
const labelMetrics = (r, size) => {
  const base1 = r + 0.7 + size * PT * 0.74;
  const lineH = size * PT * 1.12;
  const base2 = base1 + lineH;
  return { base1, base2, bottom: base2 + size * PT * 0.25 };
};

/**
 * Para cada hueco del once: { cx, cy, r, empty } y, si hay jugador, `lines` [{ text, bold, y }] con el tamaño `size` y la caja `box` del rótulo.
 * `slots` = jugadores (o null), `positions` = [x%, y%] de cada uno.
 */
export function lineupLayout(slots, positions, pw, ph, widthOf, opts = {}) {
  const { r, namePt, minPt, gap } = { ...LINEUP, ...opts };
  const pts = positions.map((p) => (p ? { x: (p[0] / 100) * pw, y: (p[1] / 100) * ph } : null));
  const reach = r + labelMetrics(r, namePt).bottom; // a menos distancia vertical que esta, dos jugadores pueden pisarse
  return slots.map((p, i) => {
    const pt = pts[i];
    if (!pt) return null;
    if (!p) return { cx: pt.x, cy: pt.y, r, empty: true };
    let maxW = 2 * Math.min(pt.x, pw - pt.x) - 1;
    pts.forEach((q, j) => {
      if (j === i || !q || Math.abs(q.y - pt.y) >= reach) return;
      maxW = Math.min(maxW, Math.abs(q.x - pt.x) - gap);
    });
    maxW = Math.max(maxW, 8);
    const first = fitText(playerFirstName(p), maxW, widthOf, true, namePt, minPt);
    const last = fitText(firstSurname(p.last_name), maxW, widthOf, false, namePt, minPt);
    const size = Math.min(first.size, last.size);
    // Las dos líneas con el mismo tamaño (se vuelve a ajustar la que quedó más grande)
    const l1 = first.size === size ? first : fitText(playerFirstName(p), maxW, widthOf, true, size, size);
    const l2 = last.size === size ? last : fitText(firstSurname(p.last_name), maxW, widthOf, false, size, size);
    const m = labelMetrics(r, size);
    const w = Math.max(widthOf(l1.text, size, true), widthOf(l2.text, size, false));
    return {
      cx: pt.x, cy: pt.y, r, size,
      lines: [{ text: l1.text, bold: true, y: pt.y + m.base1 }, { text: l2.text, bold: false, y: pt.y + m.base2 }],
      box: { x0: pt.x - w / 2, x1: pt.x + w / 2, y0: pt.y + r, y1: pt.y + m.bottom },
    };
  });
}
