// Scouting → Planificación → PDF (A4 horizontal). Página 1: el campo a escala en horizontal (portería a la izquierda, ataque a la derecha, con todos
// los puestos y los nombres completos) y, a la derecha, el resumen por líneas y los puestos a reforzar. Después, si hace falta, una página con las
// listas (objetivos, jugadores seguidos, bajas, dudas, sin posición) y otra con la plantilla prevista completa cuando algún puesto tiene más gente de
// la que cabe en el campo. Siempre en español. La colocación en el campo es la misma que en pantalla (`squadPlan.js`, con tests).
import * as jspdfMod from "jspdf";
const jsPDF = jspdfMod.jsPDF || jspdfMod.default?.jsPDF || jspdfMod.default;
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { loadImage } from "@/lib/matchSheetPdf";
import { fitText } from "@/lib/matchSheetLayout";
import { playerFullName } from "@/lib/playerName";
import { F7_FIELD } from "@/lib/pitchGeometry";
import { GROUPS, POSITION_LABEL, LEAVE, pdfLists, squadByGroup, statusLabel, zoneTitle } from "@/lib/squadPlan";

const GRANATE = [115, 0, 10];
const INK = [30, 30, 30];
const GREY = [110, 110, 110];
const NEED = [192, 38, 211];
const TONE = { continua: [22, 163, 74], duda: [217, 119, 6], sale: [220, 38, 38], objetivo: [2, 132, 199], seguido: [99, 102, 241] };
const FILL = { continua: [255, 255, 255], duda: [254, 243, 199], sale: [254, 226, 226], objetivo: [224, 242, 254], seguido: [238, 242, 255] };
const DECISION = { fichar: "Fichar", seguir_viendo: "Seguir viendo", descartar: "Descartar" };

const W = 297, H = 210, MARGIN = 10, BOTTOM = 197;
const ROW = 4.4;      // alto de una fila de tabla
const HEAD_H = 3.6;   // alto de la cabecera de un puesto
const COLS = [13, 12, 21, 21, 13, 20]; // % del ancho del campo de las 6 líneas (portero, libre, defensas, medios, mediapunta, delanteros)
const LANE_Y = { l: 1 / 6, c: 3 / 6, r: 5 / 6 }; // altura (fracción del campo) del centro de cada carril: la izquierda del equipo, arriba

const safe = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
const tone = (it) => it.status;

/** Campo a escala en horizontal, en tonos claros para gastar poca tinta (F11 105 × 68 m; F7 65 × 45 m con las medidas de la FCF). */
function drawField(doc, x0, y0, pw, ph, isF7) {
  const L = isF7 ? F7_FIELD.length : 105, Wm = isF7 ? F7_FIELD.width : 68;
  const m = 1.2;
  const fx = x0 + m, fy = y0 + m, fw = pw - 2 * m, fh = ph - 2 * m;
  const sx = fw / L, sy = fh / Wm, cy = fy + fh / 2;
  doc.setFillColor(240, 247, 240); doc.rect(x0, y0, pw, ph, "F");
  const n = isF7 ? 10 : 14;
  doc.setFillColor(231, 242, 231);
  for (let i = 1; i < n; i += 2) doc.rect(x0 + (i * pw) / n, y0, pw / n, ph, "F");
  doc.setDrawColor(150, 190, 155); doc.setLineWidth(0.35);
  doc.rect(fx, fy, fw, fh);
  doc.line(fx + fw / 2, fy, fx + fw / 2, fy + fh);
  const circleR = isF7 ? F7_FIELD.centreRadius : 9.15;
  doc.ellipse(fx + fw / 2, cy, circleR * sx, circleR * sy);
  doc.setFillColor(150, 190, 155);
  doc.ellipse(fx + fw / 2, cy, 0.6, 0.6, "F");
  const area = isF7 ? { w: F7_FIELD.areaWidth, d: F7_FIELD.areaDepth } : { w: 40.32, d: 16.5 };
  const goal = isF7 ? { w: F7_FIELD.goalAreaWidth, d: F7_FIELD.goalAreaDepth } : { w: 18.32, d: 5.5 };
  const spot = isF7 ? F7_FIELD.penaltySpot : 11;
  for (const right of [false, true]) {
    const xAt = (d) => (right ? fx + fw - d * sx : fx + d * sx);
    const rectAt = (d, wm) => doc.rect(right ? xAt(d) : fx, cy - (wm / 2) * sy, d * sx, wm * sy);
    rectAt(area.d, area.w); rectAt(goal.d, goal.w);
    doc.ellipse(xAt(spot), cy, 0.45, 0.45, "F");
    if (!isF7) { // arco del área: la parte del círculo de 9,15 m del punto de penalti que queda fuera del área
      const th = Math.acos((area.d - spot) / 9.15);
      let prev = null;
      for (let i = 0; i <= 16; i++) {
        const t = -th + (2 * th * i) / 16;
        const px = xAt(spot) + (right ? -1 : 1) * 9.15 * Math.cos(t) * sx, py = cy + 9.15 * Math.sin(t) * sy;
        if (prev) doc.line(prev[0], prev[1], px, py);
        prev = [px, py];
      }
    }
  }
  if (isF7) { // líneas de fuera de juego a 12 m de cada línea de meta
    doc.setDrawColor(95, 150, 105); doc.setLineWidth(0.4); doc.setLineDashPattern([1.8, 1.4], 0);
    doc.line(fx + F7_FIELD.offsideLine * sx, fy, fx + F7_FIELD.offsideLine * sx, fy + fh);
    doc.line(fx + fw - F7_FIELD.offsideLine * sx, fy, fx + fw - F7_FIELD.offsideLine * sx, fy + fh);
    doc.setLineDashPattern([], 0);
  }
}

export async function downloadSquadPlanPDF({ team, season, isF7 = false, plan, logoUrl }) {
  const logo = await loadImage(logoUrl);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const widthOf = (text, pt, bold) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(pt); return doc.getTextWidth(text); };
  /** Texto que cabe en `maxW` (se achica un poco y, si hace falta, se acorta con un punto). */
  const clip = (text, maxW, pt, bold = false, minPt = pt - 1) => fitText(String(text ?? ""), maxW, widthOf, bold, pt, minPt);
  const put = (text, x, y, { pt = 7.5, bold = false, color = INK, align = "left", maxW } = {}) => {
    const f = maxW ? clip(text, maxW, pt, bold) : { text: String(text ?? ""), size: pt };
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(f.size); doc.setTextColor(...color);
    doc.text(f.text, x, y, { align });
  };
  /** Parte un texto en líneas de `maxW` por palabras (como mucho `maxLines`; la última se acorta si hace falta). */
  const wrap = (text, maxW, pt, bold, maxLines) => {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const out = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (!cur || widthOf(t, pt, bold) <= maxW) cur = t;
      else { out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
    const lines = out.slice(0, maxLines);
    if (out.length > maxLines) lines[maxLines - 1] = out.slice(maxLines - 1).join(" ");
    return lines.map((l) => (widthOf(l, pt, bold) > maxW ? clip(l, maxW, pt, bold, pt).text : l));
  };
  const today = format(new Date(), "d/MM/yyyy", { locale: es });
  const ours = team?.name || "Equipo";
  const total = plan.summary.total;
  let onFirst = true;

  // ── Cabecera de la primera página ──
  if (logo) { const r = Math.min(22 / logo.w, 22 / logo.h); try { doc.addImage(logo.data, "PNG", MARGIN + (22 - logo.w * r) / 2, 5 + (22 - logo.h * r) / 2, logo.w * r, logo.h * r); } catch { /* sin escudo */ } }
  const hx = logo ? 38 : MARGIN; // sin escudo (no se pudo cargar) el texto empieza en el margen
  put(`PLANIFICACIÓN DE PLANTILLA  ·  TEMPORADA ${season}`, hx, 10.5, { pt: 8.5, bold: true, color: GRANATE });
  put(ours, hx, 19.5, { pt: 19, bold: true, maxW: 235 });
  put(`${isF7 ? "Fútbol 7" : "Fútbol 11"}  ·  ${plan.items.filter((i) => i.kind === "player").length} jugadores ahora  ·  plantilla prevista: ${total.prevista}`, hx, 26.5, { pt: 9.5, color: [90, 90, 90] });
  put(`Generado el ${today}`, W - MARGIN, 10.5, { pt: 7.5, color: GREY, align: "right" });
  doc.setDrawColor(...GRANATE); doc.setLineWidth(0.6); doc.line(MARGIN, 32, W - MARGIN, 32);

  // ── Campo (izquierda) ──
  const lx = MARGIN, ly = 40, pw = 190;
  const ph = isF7 ? (pw * F7_FIELD.width) / F7_FIELD.length : (pw * 68) / 105;
  put("CAMPOGRAMA  ·  ataque hacia la derecha", lx, ly - 1.6, { pt: 9, bold: true, color: GRANATE });
  drawField(doc, lx, ly, pw, ph, isF7);

  /** Una ficha: nombre completo (hasta 3 líneas), año, «+» si está lesionado y, si se va, su tipo de baja. */
  // Tamaño de letra de los nombres: más grande cuanto menos gente hay por puesto (con mucha gente, 5,8 pt para que quepa todo)
  const crowd = Math.max(0, ...plan.zones.map((z) => z.items.length));
  const NAME_PT = crowd <= 3 ? 6.8 : crowd <= 5 ? 6.3 : 5.8;
  const PITCH = NAME_PT * 0.405; // separación entre líneas de un nombre (mm)
  const chipBox = (it, w) => {
    const yr = it.year ? String(it.year) : "";
    const right = (yr ? widthOf(yr, 5, false) + 0.9 : 0) + (it.injured ? widthOf("+", 6.5, true) + 0.7 : 0);
    const textW = w - 3.5 - right - 0.7;
    const lines = wrap(it.name, Math.max(textW, 6), NAME_PT, false, 3);
    const leave = it.status === "sale" && it.leave ? LEAVE[it.leave].label.toUpperCase() : "";
    return { lines, yr, leave, h: Math.max(3.9, lines.length * PITCH + 1.5) + (leave ? 2.8 : 0) };
  };
  const drawChip = (it, box, x, y, w) => {
    const k = tone(it);
    doc.setFillColor(...FILL[k]); doc.setDrawColor(...TONE[k]); doc.setLineWidth(0.25);
    if (k === "objetivo") doc.setLineDashPattern([0.8, 0.6], 0);
    if (k === "seguido") doc.setLineDashPattern([0.2, 0.5], 0);
    doc.roundedRect(x, y, w, box.h, 0.6, 0.6, "FD"); doc.setLineDashPattern([], 0);
    doc.setFillColor(...TONE[k]); doc.circle(x + 1.5, y + 2.3, 0.65, "F");
    box.lines.forEach((ln, i) => {
      const by = y + 2.4 + i * PITCH;
      put(ln, x + 3, by, { pt: NAME_PT, color: k === "sale" ? [150, 60, 60] : INK });
      if (k === "sale") { const tw = widthOf(ln, NAME_PT, false); doc.setDrawColor(...TONE.sale); doc.setLineWidth(0.2); doc.line(x + 3, by - 0.55, x + 3 + tw, by - 0.55); }
    });
    let rx = x + w - 0.8;
    if (box.yr) { put(box.yr, rx, y + 2.4, { pt: 5, color: GREY, align: "right" }); rx -= widthOf(box.yr, 5, false) + 0.9; }
    if (it.injured) put("+", rx, y + 2.5, { pt: 6.5, bold: true, color: TONE.sale, align: "right" });
    if (box.leave) {
      const tw = widthOf(box.leave, 4.2, true) + 1.8;
      doc.setFillColor(...TONE.sale); doc.roundedRect(x + 3, y + box.h - 3.3, Math.min(tw, w - 3.8), 2.4, 0.5, 0.5, "F");
      put(box.leave, x + 3.9, y + box.h - 1.6, { pt: 4.2, bold: true, color: [255, 255, 255], maxW: w - 5.5 });
    }
  };

  let hidden = false; // ¿algún puesto tiene más gente de la que cabe? (entonces se añade la plantilla completa)
  let colX = lx;
  const colOf = {};
  COLS.forEach((c, i) => { colOf[i] = { x: colX, w: (pw * c) / 100 }; colX += (pw * c) / 100; });
  for (const z of plan.zones) {
    const c = colOf[z.line];
    const x = c.x + 0.8, w = c.w - 1.6;
    const budget = ph / 3 - 2;
    const empty = z.items.length === 0;
    const needH = z.need ? 3.6 + (z.need.note ? 0 : 0) : 0;
    const boxes = z.items.map((it) => ({ it, box: chipBox(it, w - 1) }));
    let used = HEAD_H + (needH ? needH + 0.4 : 0);
    let shown = boxes;
    const all = used + boxes.reduce((s, b) => s + b.box.h + 0.4, 0);
    if (all > budget) {
      shown = [];
      let u = used;
      for (const b of boxes) { if (u + b.box.h + 0.4 + 3.4 > budget) break; shown.push(b); u += b.box.h + 0.4; }
      used = u + 3.4;
      hidden = true;
    } else used = all;
    const top = Math.min(Math.max(ly + ph * LANE_Y[z.lane] - used / 2, ly + 1.2), ly + ph - 1.2 - used);
    if (z.need) { doc.setDrawColor(...NEED); doc.setLineWidth(0.5); doc.roundedRect(x - 0.4, top - 0.4, w + 0.8, used + 0.8, 0.9, 0.9); }
    if (empty) {
      doc.setFillColor(246, 250, 246); doc.setDrawColor(120, 150, 125); doc.setLineWidth(0.25); doc.setLineDashPattern([0.9, 0.7], 0);
      doc.roundedRect(x, top, w, HEAD_H, 0.6, 0.6, "FD"); doc.setLineDashPattern([], 0);
      put(zoneTitle(z).toUpperCase(), x + 1.2, top + 2.5, { pt: 5, bold: true, color: [95, 130, 105], maxW: w - 2.4 });
    } else {
      doc.setFillColor(62, 92, 72); doc.roundedRect(x, top, w, HEAD_H, 0.6, 0.6, "F");
      put(zoneTitle(z).toUpperCase(), x + 1.2, top + 2.5, { pt: 5, bold: true, color: [255, 255, 255], maxW: w - 7 });
      put(String(z.items.length), x + w - 1.2, top + 2.5, { pt: 5, bold: true, color: [255, 255, 255], align: "right" });
    }
    let cy = top + HEAD_H + 0.4;
    if (z.need) {
      doc.setFillColor(...NEED); doc.roundedRect(x, cy, w, needH, 0.6, 0.6, "F");
      put(`A reforzar${z.need.note ? ` · ${z.need.note}` : ""}`, x + 1.2, cy + 2.5, { pt: 5, bold: true, color: [255, 255, 255], maxW: w - 2.4 });
      cy += needH + 0.4;
    }
    for (const { it, box } of shown) { drawChip(it, box, x + 0.5, cy, w - 1); cy += box.h + 0.4; }
    if (shown.length < boxes.length) {
      doc.setFillColor(62, 92, 72); doc.roundedRect(x + 0.5, cy, w - 1, 3, 0.6, 0.6, "F");
      put(`+${boxes.length - shown.length} más`, x + w / 2, cy + 2.1, { pt: 5, bold: true, color: [255, 255, 255], align: "center", maxW: w - 2 });
    }
  }

  // Leyenda (dos filas bajo el campo)
  const lgy = ly + ph + 5;
  const legend = (items, y) => {
    let x = lx;
    for (const [label, draw] of items) {
      draw(x, y);
      put(label, x + 5, y, { pt: 6.5, color: [70, 70, 70] });
      x += 5 + widthOf(label, 6.5, false) + 4;
    }
  };
  const dot = (k) => (x, y) => { doc.setFillColor(...TONE[k]); doc.circle(x + 1.2, y - 0.9, 0.8, "F"); };
  const swatch = (k, dash) => (x, y) => { doc.setFillColor(...FILL[k]); doc.setDrawColor(...TONE[k]); doc.setLineWidth(0.25); doc.setLineDashPattern(dash, 0); doc.roundedRect(x, y - 2.3, 3.6, 2.7, 0.5, 0.5, "FD"); doc.setLineDashPattern([], 0); };
  const pill = (x, y) => { doc.setFillColor(...TONE.sale); doc.roundedRect(x, y - 2.2, 3.6, 2.4, 0.5, 0.5, "F"); };
  legend([["Continúa", dot("continua")], ["Duda", dot("duda")], ["Baja del club", pill], ["Baja propia", pill], ["lesionado", (x, y) => put("+", x + 1.2, y + 0.2, { pt: 8, bold: true, color: TONE.sale, align: "center" })]], lgy);
  if (hidden) put("«+N más»: la lista completa está en la última página.", lx + pw, lgy, { pt: 6.5, color: GREY, align: "right" });
  legend([["Objetivo de scouting", swatch("objetivo", [0.8, 0.6])], ["Jugador seguido", swatch("seguido", [0.2, 0.5])], ["Puesto a reforzar", (x, y) => { doc.setDrawColor(...NEED); doc.setLineWidth(0.5); doc.roundedRect(x, y - 2.3, 3.6, 2.7, 0.5, 0.5); }]], lgy + 4.6);

  // ── Columna derecha de la primera página: resumen y puestos a reforzar ──
  let col = { x: lx + pw + 7, w: W - MARGIN - (lx + pw + 7) };
  let y = 40;
  const continuation = () => {
    doc.addPage();
    onFirst = false;
    put(`PLANIFICACIÓN DE PLANTILLA  ·  ${ours}  ·  ${season}  (continuación)`, MARGIN, 10, { pt: 8.5, bold: true, color: GRANATE });
    doc.setDrawColor(...GRANATE); doc.setLineWidth(0.5); doc.line(MARGIN, 13, W - MARGIN, 13);
    col = { x: MARGIN, w: W - 2 * MARGIN }; y = 20;
  };
  const ensure = (h) => { if (y + h > BOTTOM) { continuation(); return true; } return false; };
  const title = (text, color = GRANATE) => {
    ensure(ROW * 3);
    put(text, col.x, y + 3, { pt: 9.5, bold: true, color });
    y += 5.5;
  };

  // Resumen en cinco cuadros
  const boxW = (col.w - 4 * 1.5) / 5;
  const rest = total.sale - total.club - total.propia;
  const bajasSub = total.sale === 0 ? "" : [total.club ? `${total.club} club` : "", total.propia ? `${total.propia} propia` : "", rest ? `${rest} s/c` : ""].filter(Boolean).join(" · ");
  [["Continúan", total.continua, "continua", ""], ["Dudas", total.duda, "duda", ""], ["Bajas", total.sale, "sale", bajasSub], ["Objetivos", total.objetivo, "objetivo", ""], ["Seguidos", total.seguido, "seguido", ""]].forEach(([label, n, k, sub], i) => {
    const bx = col.x + i * (boxW + 1.5);
    doc.setDrawColor(...TONE[k]); doc.setLineWidth(0.35); doc.setFillColor(...(k === "continua" ? [236, 253, 245] : FILL[k]));
    doc.roundedRect(bx, y, boxW, 15, 1.2, 1.2, "FD");
    put(String(n), bx + boxW / 2, y + 7, { pt: 14, bold: true, color: TONE[k], align: "center" });
    put(label.toUpperCase(), bx + boxW / 2, y + 10.6, { pt: 5, bold: true, color: TONE[k], align: "center", maxW: boxW - 1 });
    if (sub) put(sub, bx + boxW / 2, y + 13.4, { pt: 4.2, color: TONE[k], align: "center", maxW: boxW - 1 });
  });
  y += 20;

  // Plantilla prevista por líneas
  put(`PLANTILLA PREVISTA ${season}`, col.x, y + 3, { pt: 9, bold: true, color: GRANATE });
  put(String(total.prevista), col.x + col.w, y + 3.6, { pt: 15, bold: true, color: GRANATE, align: "right" });
  y += 5.5;
  put("Continúan + objetivos. Dudas, bajas y seguidos, no.", col.x, y + 2.2, { pt: 6, color: GREY });
  y += 5;
  const cx = [0.27, 0.40, 0.52, 0.64, 0.76, 0.88, 1].map((f) => col.x + f * col.w);
  ["Línea", "Cont.", "Dudas", "Bajas", "Obj.", "Seg.", "Prev."].forEach((h, i) => put(h.toUpperCase(), i === 0 ? col.x : cx[i], y + 2.4, { pt: 5.5, bold: true, color: GREY, align: i === 0 ? "left" : "right" }));
  y += 3.4; doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2); doc.line(col.x, y, col.x + col.w, y);
  const { groups, sinPosicion } = plan.summary;
  const lines = [...GROUPS.map((g) => [g, groups[g]]), ...(sinPosicion.continua + sinPosicion.duda + sinPosicion.sale + sinPosicion.objetivo + sinPosicion.seguido > 0 ? [["Sin posición", sinPosicion]] : [])];
  for (const [g, r] of lines) {
    y += ROW;
    put(g, col.x, y - 1.1, { pt: 7, bold: true });
    [r.continua, r.duda || "·", r.sale || "·", r.objetivo || "·", r.seguido || "·", r.prevista].forEach((v, i) => put(String(v), cx[i + 1], y - 1.1, { pt: 7, bold: i === 5, color: [TONE.continua, TONE.duda, TONE.sale, TONE.objetivo, TONE.seguido, INK][i], align: "right" }));
  }
  y += 7;

  const lists = pdfLists(plan);
  if (lists.refuerzos.length) {
    title(`PUESTOS A REFORZAR · ${lists.refuerzos.length}`, NEED);
    for (const z of lists.refuerzos) {
      const prev = z.items.filter((i) => i.status === "continua" || i.status === "objetivo").length;
      const note = z.need.note ? wrap(z.need.note, col.w - 1, 6.5, false, 2) : [];
      ensure(5 + note.length * 2.9);
      put(zoneTitle(z), col.x, y + 2.8, { pt: 7.5, bold: true, color: NEED, maxW: col.w - 22 });
      put(`${prev} previsto${prev === 1 ? "" : "s"}`, col.x + col.w, y + 2.8, { pt: 6.5, color: GREY, align: "right" });
      y += 4.2;
      note.forEach((ln) => { put(ln, col.x, y + 1.8, { pt: 6.5, color: [80, 80, 80] }); y += 2.9; });
      y += 1.2;
    }
  }

  // ── Listas de personas (a todo lo ancho, en página aparte) ──
  const FR = [0.26, 0.06, 0.15, 0.17, 0.36];
  const table = (head, rows, toneOf) => {
    const drawHead = () => {
      let hxx = col.x;
      head.forEach((h, i) => { put(h.toUpperCase(), hxx, y + 2.4, { pt: 6, bold: true, color: GREY }); hxx += FR[i] * col.w; });
      y += 3.4; doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2); doc.line(col.x, y, col.x + col.w, y);
    };
    drawHead();
    rows.forEach((r, ri) => {
      if (y + ROW > BOTTOM) { continuation(); drawHead(); }
      y += ROW;
      let rx = col.x;
      r.forEach((cell, i) => {
        const w = FR[i] * col.w - 1.2;
        put(cell, rx, y - 1.1, { pt: 7.5, bold: i === 0, color: i === 3 ? TONE[toneOf(ri)] : i === 1 || i === 4 ? (i === 1 ? GREY : [80, 80, 80]) : INK, maxW: w });
        rx += FR[i] * col.w;
      });
      doc.setDrawColor(238, 238, 238); doc.setLineWidth(0.15); doc.line(col.x, y + 0.7, col.x + col.w, y + 0.7);
    });
    y += 5;
  };
  const posOf = (it) => POSITION_LABEL[it.position] || "–";
  const person = (it) => playerFullName(it.source) || it.name;
  const anyList = lists.objetivos.length + lists.seguidos.length + lists.salen.length + lists.dudas.length + lists.sinPosicion.length > 0;
  if (anyList && onFirst) continuation();

  if (lists.objetivos.length) {
    title(`OBJETIVOS DE SCOUTING · ${lists.objetivos.length}`, TONE.objetivo);
    table(["Jugador", "Año", "Puesto", "Decisión", "Club · nota"], lists.objetivos.map((it) => [person(it), it.year || "–", posOf(it), DECISION[it.decision] || "–", [it.club, it.note].filter(Boolean).join(" · ")]), () => "objetivo");
  }
  if (lists.seguidos.length) {
    title(`JUGADORES SEGUIDOS · ${lists.seguidos.length}`, TONE.seguido);
    table(["Jugador", "Año", "Puesto", "Decisión", "Club · nota"], lists.seguidos.map((it) => [person(it), it.year || "–", posOf(it), DECISION[it.decision] || "–", [it.club, it.note].filter(Boolean).join(" · ")]), () => "seguido");
  }
  if (lists.salen.length) {
    title(`BAJAS · ${lists.salen.length}  (${lists.salen.filter((i) => i.leave === "club").length} del club · ${lists.salen.filter((i) => i.leave === "propia").length} propias)`, TONE.sale);
    table(["Jugador", "Año", "Puesto", "Tipo de baja", "Nota"], lists.salen.map((it) => [person(it), it.year || "–", posOf(it), statusLabel(it), it.note || ""]), () => "sale");
  }
  if (lists.dudas.length) {
    title(`DUDAS · ${lists.dudas.length}`, TONE.duda);
    table(["Jugador", "Año", "Puesto", "Estado", "Nota"], lists.dudas.map((it) => [person(it), it.year || "–", posOf(it), statusLabel(it), it.note || ""]), () => "duda");
  }
  if (lists.sinPosicion.length) {
    title(`SIN POSICIÓN · ${lists.sinPosicion.length}  (no salen en el campo)`);
    table(["Jugador", "Año", "Puesto", "Estado", "Nota"], lists.sinPosicion.map((it) => [person(it), it.year || "–", "–", statusLabel(it), it.note || ""]), (i) => tone(lists.sinPosicion[i]));
  }

  // ── Plantilla completa, solo si el campo no enseña a todos ──
  if (hidden) {
    continuation();
    put(`PLANTILLA PREVISTA COMPLETA  ·  ${ours}  ·  ${season}`, MARGIN, y + 3, { pt: 11, bold: true, color: GRANATE });
    y += 9;
    for (const line of squadByGroup(plan.items)) {
      const prev = line.items.filter((i) => i.status === "continua" || i.status === "objetivo").length;
      ensure(ROW * 3);
      doc.setFillColor(243, 240, 240); doc.rect(col.x, y, col.w, 5, "F");
      put(`${line.group.toUpperCase()}  ·  ${line.items.length}  (${prev} en la plantilla prevista)`, col.x + 1.5, y + 3.5, { pt: 7.5, bold: true, color: GRANATE });
      y += 5;
      table(["Jugador", "Año", "Puesto", "Estado", "Club · nota"], line.items.map((it) => [
        person(it), it.year || "–", posOf(it), `${statusLabel(it)}${it.injured ? " · lesionado" : ""}`,
        it.kind === "scout" ? [it.club, DECISION[it.decision], it.note].filter(Boolean).join(" · ") : it.note || "",
      ]), (i) => tone(line.items[i]));
      y -= 2;
    }
  }

  // Pie de página
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    put("RS Manager · Racing Sarrià", MARGIN, H - 5, { pt: 6.5, color: [150, 150, 150] });
    put(`Página ${p} de ${pages}`, W - MARGIN, H - 5, { pt: 6.5, color: [150, 150, 150], align: "right" });
  }
  doc.save(`Planificacion_${safe(ours)}_${season}.pdf`);
}
