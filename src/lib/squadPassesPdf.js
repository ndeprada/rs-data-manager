// Scouting → Planificación → «Pases del club» en PDF (A4 vertical): el cuadro de origen → destino y, debajo, la lista de jugadores de cada pareja de
// equipos. Siempre en español. Los datos salen de `buildPassSummary` (`squadPlan.js`, con tests); aquí solo se dibuja.
import * as jspdfMod from "jspdf";
const jsPDF = jspdfMod.jsPDF || jspdfMod.default?.jsPDF || jspdfMod.default;
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { loadImage } from "@/lib/matchSheetPdf";
import { fitText } from "@/lib/matchSheetLayout";

const GRANATE = [115, 0, 10];
const INK = [30, 30, 30];
const GREY = [110, 110, 110];
const PASS = [13, 148, 136];
const AMBER = [217, 119, 6];
const GREEN = [22, 163, 74];
const W = 210, H = 297, MARGIN = 12, BOTTOM = 284, ROW = 5;

const safe = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");

export async function downloadClubPassesPDF({ season, summary, logoUrl }) {
  const logo = await loadImage(logoUrl);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const widthOf = (text, pt, bold) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(pt); return doc.getTextWidth(text); };
  const put = (text, x, y, { pt = 8, bold = false, color = INK, align = "left", maxW } = {}) => {
    const f = maxW ? fitText(String(text ?? ""), maxW, widthOf, bold, pt, pt - 1.5) : { text: String(text ?? ""), size: pt };
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(f.size); doc.setTextColor(...color);
    doc.text(f.text, x, y, { align });
  };
  /** Parte un texto por palabras en líneas de `maxW` (como mucho `maxLines`). */
  const wrap = (text, maxW, pt, bold, maxLines) => {
    const out = [];
    let cur = "";
    for (const w of String(text || "").split(/\s+/).filter(Boolean)) {
      const t = cur ? `${cur} ${w}` : w;
      if (!cur || widthOf(t, pt, bold) <= maxW) cur = t; else { out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
    const lines = out.slice(0, maxLines);
    if (out.length > maxLines) lines[maxLines - 1] = out.slice(maxLines - 1).join(" ");
    return lines;
  };
  const today = format(new Date(), "d/MM/yyyy", { locale: es });
  const { total, teams, matrix, groups } = summary;

  // ── Cabecera ──
  if (logo) { const r = Math.min(20 / logo.w, 20 / logo.h); try { doc.addImage(logo.data, "PNG", MARGIN + (20 - logo.w * r) / 2, 8 + (20 - logo.h * r) / 2, logo.w * r, logo.h * r); } catch { /* sin escudo */ } }
  const hx = logo ? MARGIN + 25 : MARGIN;
  put(`PLANIFICACIÓN DE PLANTILLA  ·  TEMPORADA ${season}`, hx, 13, { pt: 8.5, bold: true, color: GRANATE });
  put("Pases del club", hx, 22, { pt: 19, bold: true });
  put(total === 0 ? "Todavía no hay pases" : `${total} pase${total === 1 ? "" : "s"} entre ${teams.length} equipos`, hx, 28.5, { pt: 9.5, color: [90, 90, 90] });
  put(`Generado el ${today}`, W - MARGIN, 13, { pt: 7.5, color: GREY, align: "right" });
  doc.setDrawColor(...GRANATE); doc.setLineWidth(0.6); doc.line(MARGIN, 33, W - MARGIN, 33);
  let y = 40;
  const contentW = W - 2 * MARGIN;
  const continuation = () => {
    doc.addPage();
    put(`PASES DEL CLUB  ·  TEMPORADA ${season}  (continuación)`, MARGIN, 12, { pt: 8.5, bold: true, color: GRANATE });
    doc.setDrawColor(...GRANATE); doc.setLineWidth(0.5); doc.line(MARGIN, 15, W - MARGIN, 15);
    y = 22;
  };
  const ensure = (h) => { if (y + h > BOTTOM) continuation(); };

  if (total === 0) {
    put("Los pases se crean desde la ventana de un jugador o con «Traer de otro equipo». Solo cambian en el plan: la ficha del jugador no se toca.", MARGIN, y + 4, { pt: 9, color: GREY, maxW: contentW });
  } else {
    // ── Cuadro origen → destino ──
    const origins = teams.filter((t) => matrix[t.id]);
    const dests = teams.filter((t) => origins.some((o) => matrix[o.id][t.id]));
    put("DE DÓNDE A DÓNDE", MARGIN, y + 3, { pt: 9.5, bold: true, color: PASS });
    y += 6.5;
    const firstW = 46;
    const colW = Math.min(30, (contentW - firstW) / Math.max(1, dests.length));
    const heads = dests.map((t) => wrap(t.name, colW - 2, 6.5, true, 2));
    const headH = 3 + Math.max(...heads.map((h) => h.length)) * 3;
    ensure(headH + ROW * origins.length + 8);
    put("DE (filas)  ·  A (columnas)", MARGIN, y + headH - 1.2, { pt: 6, bold: true, color: GREY });
    dests.forEach((t, i) => {
      const cx = MARGIN + firstW + i * colW + colW / 2;
      heads[i].forEach((ln, k) => put(ln, cx, y + 3 + k * 3, { pt: 6.5, bold: true, color: GREY, align: "center" }));
    });
    y += headH;
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2); doc.line(MARGIN, y, MARGIN + firstW + dests.length * colW, y);
    for (const o of origins) {
      y += ROW;
      put(o.name, MARGIN, y - 1.3, { pt: 8, bold: true, maxW: firstW - 2 });
      dests.forEach((t, i) => {
        const n = matrix[o.id][t.id] || 0;
        put(n ? String(n) : "·", MARGIN + firstW + i * colW + colW / 2, y - 1.2, { pt: n ? 9 : 8, bold: !!n, color: n ? PASS : [185, 185, 185], align: "center" });
      });
      doc.setDrawColor(238, 238, 238); doc.setLineWidth(0.15); doc.line(MARGIN, y + 0.8, MARGIN + firstW + dests.length * colW, y + 0.8);
    }
    y += 9;

    // ── Un listado por pareja de equipos ──
    const FR = [0.32, 0.07, 0.22, 0.12, 0.27];
    const drawHead = () => {
      let hx2 = MARGIN;
      ["Jugador", "Año", "Puesto", "Estado", "Nota"].forEach((h, i) => { put(h.toUpperCase(), hx2, y + 2.4, { pt: 6, bold: true, color: GREY }); hx2 += FR[i] * contentW; });
      y += 3.4; doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2); doc.line(MARGIN, y, MARGIN + contentW, y);
    };
    for (const g of groups) {
      ensure(ROW * 4 + 6);
      put(`${g.from.name}  >  ${g.to.name}  ·  ${g.rows.length}`, MARGIN, y + 3, { pt: 9.5, bold: true, color: PASS, maxW: contentW });
      y += 5.5;
      drawHead();
      for (const r of g.rows) {
        if (y + ROW > BOTTOM) { continuation(); drawHead(); }
        y += ROW;
        let rx = MARGIN;
        const cells = [r.name, r.year || "–", r.placeLabel, r.status === "duda" ? "Duda" : "Seguro", r.note || ""];
        cells.forEach((c, i) => {
          put(c, rx, y - 1.2, { pt: 7.5, bold: i === 0, color: i === 3 ? (r.status === "duda" ? AMBER : GREEN) : i === 1 ? GREY : i === 4 ? [80, 80, 80] : INK, maxW: FR[i] * contentW - 1.5 });
          rx += FR[i] * contentW;
        });
        doc.setDrawColor(238, 238, 238); doc.setLineWidth(0.15); doc.line(MARGIN, y + 0.8, MARGIN + contentW, y + 0.8);
      }
      y += 6;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    put("RS Manager · Racing Sarrià", MARGIN, H - 6, { pt: 6.5, color: [150, 150, 150] });
    put(`Página ${p} de ${pages}`, W - MARGIN, H - 6, { pt: 6.5, color: [150, 150, 150], align: "right" });
  }
  doc.save(`Pases_del_club_${safe(season)}.pdf`);
}
