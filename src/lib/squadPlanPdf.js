// Scouting → Planificación → PDF (A4 horizontal): el campograma a la izquierda y, a la derecha, el resumen por líneas, los objetivos de
// scouting y las dudas y salidas. Si algún puesto tiene más gente de la que cabe en el campo (o hay listas largas) se añaden páginas con la
// plantilla prevista completa. Siempre en español. La colocación en el campo es la misma que en pantalla (`squadPlan.js`, con tests).
import * as jspdfMod from "jspdf";
const jsPDF = jspdfMod.jsPDF || jspdfMod.default?.jsPDF || jspdfMod.default;
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { loadImage, drawPitch } from "@/lib/matchSheetPdf";
import { fitText } from "@/lib/matchSheetLayout";
import { playerFullName } from "@/lib/playerName";
import {
  PDF_ZONE_ROWS, GROUPS, POSITION_LABEL, STATUS_KEYS, STATUS, zoneRows, pdfLists, squadByGroup, hasHiddenPeople, statusLabel,
} from "@/lib/squadPlan";

const GRANATE = [115, 0, 10];
const INK = [30, 30, 30];
const GREY = [110, 110, 110];
const TONE = { continua: [22, 163, 74], duda: [217, 119, 6], sale: [220, 38, 38], objetivo: [2, 132, 199] };
const FILL = { continua: [255, 255, 255], duda: [254, 243, 199], sale: [254, 226, 226], objetivo: [224, 242, 254] };
const DECISION = { fichar: "Fichar", seguir_viendo: "Seguir viendo", descartar: "Descartar" };

const W = 297, H = 210, MARGIN = 10, BOTTOM = 197;
const ROW = 4.4;     // alto de una fila de tabla
const CHIP_H = 3.7;  // alto de una ficha en el campo
const HEAD_H = 3.4;  // alto de la cabecera de un puesto

const safe = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
const tone = (it) => (it.kind === "scout" ? "objetivo" : it.status);

export async function downloadSquadPlanPDF({ team, season, isF7 = false, plan, zones, logoUrl }) {
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
  const today = format(new Date(), "d/MM/yyyy", { locale: es });
  const ours = team?.name || "Equipo";
  const total = plan.summary.total;

  // ── Cabecera de la primera página ──
  if (logo) { const r = Math.min(22 / logo.w, 22 / logo.h); try { doc.addImage(logo.data, "PNG", MARGIN + (22 - logo.w * r) / 2, 5 + (22 - logo.h * r) / 2, logo.w * r, logo.h * r); } catch { /* sin escudo */ } }
  const hx = logo ? 38 : MARGIN; // sin escudo (no se pudo cargar) el texto empieza en el margen
  put(`PLANIFICACIÓN DE PLANTILLA  ·  TEMPORADA ${season}`, hx, 10.5, { pt: 8.5, bold: true, color: GRANATE });
  put(ours, hx, 19.5, { pt: 19, bold: true, maxW: 235 });
  put(`${isF7 ? "Fútbol 7" : "Fútbol 11"}  ·  ${plan.items.filter((i) => i.kind === "player").length} jugadores ahora  ·  plantilla prevista: ${total.prevista}`, hx, 26.5, { pt: 9.5, color: [90, 90, 90] });
  put(`Generado el ${today}`, W - MARGIN, 10.5, { pt: 7.5, color: GREY, align: "right" });
  doc.setDrawColor(...GRANATE); doc.setLineWidth(0.6); doc.line(MARGIN, 32, W - MARGIN, 32);

  // ── Campograma (izquierda) ──
  const lx = MARGIN, ly = 44, ph = 146, pw = ph * 300 / 420;
  put("CAMPOGRAMA  ·  ataque hacia arriba", lx, ly - 1.5, { pt: 10, bold: true, color: GRANATE });
  drawPitch(doc, lx, ly, pw, ph, isF7);

  for (const z of zones) {
    const w = (pw * z.w) / 100, x = lx + (pw * z.x) / 100 - w / 2, y = ly + (ph * z.y) / 100;
    const empty = z.items.length === 0;
    if (empty) {
      doc.setFillColor(246, 250, 246); doc.setDrawColor(120, 150, 125); doc.setLineWidth(0.25); doc.setLineDashPattern([0.9, 0.7], 0);
      doc.roundedRect(x, y, w, HEAD_H, 0.6, 0.6, "FD"); doc.setLineDashPattern([], 0);
      put(z.label.toUpperCase(), x + 1.2, y + 2.45, { pt: 5.5, bold: true, color: [95, 130, 105], maxW: w - 2.4 });
      continue;
    }
    doc.setFillColor(62, 92, 72); doc.roundedRect(x, y, w, HEAD_H, 0.6, 0.6, "F");
    put(z.label.toUpperCase(), x + 1.2, y + 2.45, { pt: 5.5, bold: true, color: [255, 255, 255], maxW: w - 8 });
    put(String(z.items.length), x + w - 1.2, y + 2.45, { pt: 5.5, bold: true, color: [255, 255, 255], align: "right" });
    const { shown, more } = zoneRows(z.items, PDF_ZONE_ROWS);
    let cy = y + HEAD_H + 0.4;
    for (const it of shown) {
      const k = tone(it);
      doc.setFillColor(...FILL[k]); doc.setDrawColor(...TONE[k]); doc.setLineWidth(0.25);
      if (k === "objetivo") doc.setLineDashPattern([0.8, 0.6], 0);
      doc.roundedRect(x, cy, w, CHIP_H, 0.6, 0.6, "FD"); doc.setLineDashPattern([], 0);
      doc.setFillColor(...TONE[k]); doc.circle(x + 1.5, cy + CHIP_H / 2, 0.7, "F");
      const yr = it.year ? String(it.year) : "";
      const yrW = yr ? widthOf(yr, 5.5, false) + (it.injured ? 2.2 : 0) + 1 : (it.injured ? 3 : 0);
      const nm = clip(it.name, w - 3.6 - yrW - 0.8, 6.5, false, 5.5);
      put(nm.text, x + 3, cy + 2.6, { pt: nm.size, color: k === "sale" ? [150, 60, 60] : INK });
      if (k === "sale") { const tw = widthOf(nm.text, nm.size, false); doc.setDrawColor(...TONE.sale); doc.setLineWidth(0.2); doc.line(x + 3, cy + 1.95, x + 3 + tw, cy + 1.95); }
      if (yr) put(yr, x + w - 0.9, cy + 2.55, { pt: 5.5, color: GREY, align: "right" });
      if (it.injured) put("+", x + w - 0.9 - (yr ? widthOf(yr, 5.5, false) + 0.6 : 0), cy + 2.6, { pt: 6.5, bold: true, color: TONE.sale, align: "right" });
      cy += CHIP_H + 0.4;
    }
    if (more > 0) {
      doc.setFillColor(62, 92, 72); doc.roundedRect(x, cy, w, 3.1, 0.6, 0.6, "F");
      put(`+${more} más`, x + w / 2, cy + 2.2, { pt: 5.5, bold: true, color: [255, 255, 255], align: "center" });
    }
  }
  // Leyenda
  let lgx = lx;
  const lgy = ly + ph + 5;
  for (const k of [...STATUS_KEYS, "objetivo"]) {
    const label = k === "objetivo" ? "Objetivo de scouting" : STATUS[k].label;
    doc.setFillColor(...TONE[k]); doc.circle(lgx + 1, lgy - 0.9, 0.9, "F");
    put(label, lgx + 2.6, lgy, { pt: 7, color: [70, 70, 70] });
    lgx += 3.6 + widthOf(label, 7, false) + 3;
  }
  put("+ lesionado", lgx, lgy, { pt: 7, color: [70, 70, 70] });

  // ── Columna derecha: resumen, objetivos, dudas y salidas ──
  let col = { x: 128, w: W - MARGIN - 128 };
  let y = 40;
  const continuation = () => {
    doc.addPage();
    put(`PLANIFICACIÓN DE PLANTILLA  ·  ${ours}  ·  ${season}  (continuación)`, MARGIN, 10, { pt: 8.5, bold: true, color: GRANATE });
    doc.setDrawColor(...GRANATE); doc.setLineWidth(0.5); doc.line(MARGIN, 13, W - MARGIN, 13);
    col = { x: MARGIN, w: W - 2 * MARGIN }; y = 20;
  };
  const ensure = (h) => { if (y + h > BOTTOM) { continuation(); return true; } return false; };
  const title = (text) => {
    ensure(ROW * 3);
    put(text, col.x, y + 3, { pt: 9.5, bold: true, color: GRANATE });
    y += 5.5;
  };

  // Resumen en cuatro cuadros
  const boxW = (col.w - 9) / 4;
  [["Continúan", total.continua, "continua"], ["Dudas", total.duda, "duda"], ["Se van", total.sale, "sale"], ["Objetivos", total.objetivo, "objetivo"]].forEach(([label, n, k], i) => {
    const bx = col.x + i * (boxW + 3);
    doc.setDrawColor(...TONE[k]); doc.setLineWidth(0.35); doc.setFillColor(...FILL[k] === FILL.continua ? [236, 253, 245] : FILL[k]);
    doc.roundedRect(bx, y, boxW, 12.5, 1.2, 1.2, "FD");
    put(String(n), bx + boxW / 2, y + 7, { pt: 15, bold: true, color: TONE[k], align: "center" });
    put(label.toUpperCase(), bx + boxW / 2, y + 10.8, { pt: 6, bold: true, color: TONE[k], align: "center" });
  });
  y += 17;

  // Plantilla prevista por líneas
  put(`PLANTILLA PREVISTA ${season}`, col.x, y + 3, { pt: 9.5, bold: true, color: GRANATE });
  put(String(total.prevista), col.x + col.w, y + 3.6, { pt: 15, bold: true, color: GRANATE, align: "right" });
  y += 5.5;
  put("Continúan + objetivos. Las dudas y los que se van no cuentan.", col.x, y + 2.2, { pt: 6.5, color: GREY });
  y += 5;
  const cx = [0, 0.46, 0.58, 0.70, 0.82, 0.94].map((f) => col.x + f * col.w);
  ["Línea", "Cont.", "Dudas", "Van", "Obj.", "Prev."].forEach((h, i) => put(h.toUpperCase(), i === 0 ? cx[0] : cx[i] + 0.06 * col.w - 1, y + 2.4, { pt: 6, bold: true, color: GREY, align: i === 0 ? "left" : "right" }));
  y += 3.4; doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2); doc.line(col.x, y, col.x + col.w, y);
  const { groups, sinPosicion } = plan.summary;
  const lines = [...GROUPS.map((g) => [g, groups[g]]), ...(sinPosicion.continua + sinPosicion.duda + sinPosicion.sale + sinPosicion.objetivo > 0 ? [["Sin posición", sinPosicion]] : [])];
  for (const [g, r] of lines) {
    y += ROW;
    put(g, cx[0], y - 1.1, { pt: 7.5, bold: true });
    [r.continua, r.duda || "·", r.sale || "·", r.objetivo || "·", r.prevista].forEach((v, i) => put(String(v), cx[i + 1] + 0.06 * col.w - 1, y - 1.1, { pt: 7.5, bold: i === 4, color: [TONE.continua, TONE.duda, TONE.sale, TONE.objetivo, INK][i], align: "right" }));
  }
  y += 6;

  // Tablas de personas (cada fila: nombre, año, puesto, estado, detalle)
  const FR = [0.27, 0.07, 0.17, 0.15, 0.34];
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
  const lists = pdfLists(plan);

  title(`OBJETIVOS DE SCOUTING · ${lists.objetivos.length}`);
  if (lists.objetivos.length === 0) { put("Todavía no hay objetivos de scouting en este equipo.", col.x, y + 2.5, { pt: 7.5, color: GREY }); y += 8; }
  else table(["Jugador", "Año", "Puesto", "Decisión", "Club · nota"], lists.objetivos.map((it) => [person(it), it.year || "–", posOf(it), DECISION[it.decision] || "–", [it.club, it.note].filter(Boolean).join(" · ")]), (i) => "objetivo");

  const dudasSalen = [...lists.dudas, ...lists.salen];
  if (dudasSalen.length) {
    title(`DUDAS Y SALIDAS · ${dudasSalen.length}`);
    table(["Jugador", "Año", "Puesto", "Estado", "Nota"], dudasSalen.map((it) => [person(it), it.year || "–", posOf(it), statusLabel(it), it.note || ""]), (i) => dudasSalen[i].status);
  }
  if (lists.sinPosicion.length) {
    title(`SIN POSICIÓN · ${lists.sinPosicion.length}  (no salen en el campo)`);
    table(["Jugador", "Año", "Puesto", "Estado", "Nota"], lists.sinPosicion.map((it) => [person(it), it.year || "–", "–", statusLabel(it), it.note || ""]), (i) => tone(lists.sinPosicion[i]));
  }

  // ── Plantilla completa, solo si el campo no enseña a todos ──
  if (hasHiddenPeople(zones)) {
    continuation();
    put(`PLANTILLA PREVISTA COMPLETA  ·  ${ours}  ·  ${season}`, MARGIN, y + 3, { pt: 11, bold: true, color: GRANATE });
    y += 9;
    for (const line of squadByGroup(plan.items)) {
      const prev = line.items.filter((i) => i.kind === "scout" || i.status === "continua").length;
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
