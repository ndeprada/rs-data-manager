// Hoja del entrenador (A4 horizontal): alineación + banquillo a la izquierda, plan en ataque y en defensa a la derecha.
import * as jspdfMod from "jspdf";
const jsPDF = jspdfMod.jsPDF || jspdfMod.default?.jsPDF || jspdfMod.default;
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { playerFirstName, playerFullName } from "@/lib/playerName";
import { drawRichText } from "@/lib/richTextPdf";

const GRANATE = [115, 0, 10];
const hex = (h) => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// Carga una imagen como dataURL (null si el servidor no permite leerla)
export function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext("2d").drawImage(img, 0, 0);
        resolve({ data: c.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function addImageFit(doc, img, x, y, w, h) {
  if (!img) return;
  const r = Math.min(w / img.w, h / img.h);
  const iw = img.w * r, ih = img.h * r;
  try { doc.addImage(img.data, "PNG", x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); } catch { /* imagen no válida */ }
}

const PARTICLES = ["de", "del", "la", "las", "los", "da", "di", "van", "von", "el", "i"];
function firstSurname(last = "") {
  const t = last.trim().split(/\s+/).filter(Boolean);
  if (t.length <= 1) return t[0] || "";
  let i = 0;
  while (i < t.length - 1 && PARTICLES.includes(t[i].toLowerCase())) i++;
  return t.slice(0, i + 1).join(" ");
}

function drawPitch(doc, x0, y0, pw, ph) {
  const s = pw / 300;
  doc.setFillColor(238, 246, 238);
  doc.roundedRect(x0, y0, pw, ph, 1.5, 1.5, "F");
  doc.setDrawColor(150, 190, 155);
  doc.setLineWidth(0.35);
  const m = 12 * s;
  doc.rect(x0 + m, y0 + m, pw - 2 * m, ph - 2 * m);
  doc.line(x0 + m, y0 + ph / 2, x0 + pw - m, y0 + ph / 2);
  doc.circle(x0 + pw / 2, y0 + ph / 2, 38 * s);
  doc.setFillColor(150, 190, 155);
  doc.circle(x0 + pw / 2, y0 + ph / 2, 0.6, "F");
  doc.rect(x0 + pw * 0.22, y0 + m, pw * 0.56, 72 * s);
  doc.rect(x0 + pw * 0.34, y0 + m, pw * 0.32, 28 * s);
  doc.rect(x0 + pw * 0.22, y0 + ph - m - 72 * s, pw * 0.56, 72 * s);
  doc.rect(x0 + pw * 0.34, y0 + ph - m - 28 * s, pw * 0.32, 28 * s);
}

export async function downloadMatchSheetPDF({ event, team, formation, positions, slots, captainId, kit, gkKit, gkKitBench, kits, gkKits, benchPlayers, planAttack, planDefense, planSet, ourLogoUrl, opponentLogoUrl }) {
  const [ourLogo, oppLogo] = await Promise.all([loadImage(ourLogoUrl), loadImage(opponentLogoUrl)]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = 297, H = 210;

  // ── Cabecera (sin relleno, para gastar poca tinta) ──
  addImageFit(doc, ourLogo, 10, 5, 22, 22);
  const date = event?.date ? new Date(event.date) : null;
  const isHome = event?.is_home !== false;
  const ours = team?.name || "Nuestro equipo";
  const opp = event?.opponent || "Rival";
  const typeLabel = event?.type === "partido_amistoso" ? "Amistoso" : event?.type === "torneo" ? "Torneo" : "Liga";
  const jornada = event?.fcf_jornada ? ` · Jornada ${event.fcf_jornada}` : "";
  doc.setTextColor(...GRANATE);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text(`HOJA DEL ENTRENADOR  ·  ${typeLabel.toUpperCase()}${jornada.toUpperCase()}`, 38, 10.5);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(19);
  const title = isHome ? `${ours}  vs  ${opp}` : `${opp}  vs  ${ours}`;
  doc.text(doc.splitTextToSize(title, 205)[0], 38, 19.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(90, 90, 90);
  const when = date ? format(date, "EEEE d 'de' MMMM 'de' yyyy · HH:mm 'h'", { locale: es }) : "";
  doc.text([when, event?.location].filter(Boolean).join("   ·   "), 38, 26.5);
  addImageFit(doc, oppLogo, W - 32, 5, 22, 22);
  doc.setDrawColor(...GRANATE); doc.setLineWidth(0.6);
  doc.line(10, 32, W - 10, 32);

  // ── Columna izquierda: alineación ──
  const lx = 10, ly = 44;
  const ph = 148, pw = ph * 300 / 420;
  doc.setTextColor(...GRANATE);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text(`ONCE INICIAL  ·  ${formation}`, lx, ly - 1.5);
  drawPitch(doc, lx, ly, pw, ph);
  const s = pw / 300;
  const colorsFor = (p, gk = gkKit) => (p?.position === "portero" ? (gkKits[gk] || gkKits.naranja) : (kits[kit] || kits["1"]));
  slots.forEach((p, i) => {
    const pos = positions[i];
    if (!pos) return;
    const cx = lx + (pos[0] / 100) * pw, cy = ly + (pos[1] / 100) * ph;
    const k = colorsFor(p);
    const r = 5;
    if (!p) {
      doc.setDrawColor(160, 160, 160); doc.setLineDashPattern([1, 1], 0); doc.setLineWidth(0.3);
      doc.circle(cx, cy, r, "S"); doc.setLineDashPattern([], 0);
      return;
    }
    doc.setFillColor(...hex(k.fill)); doc.setDrawColor(...hex(k.stroke)); doc.setLineWidth(0.7);
    doc.circle(cx, cy, r, "FD");
    doc.setTextColor(...hex(k.num)); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(String(p.jersey_number || p.first_name?.[0] || ""), cx, cy + 1.3, { align: "center" });
    if (p.id === captainId) {
      doc.setFillColor(252, 221, 9); doc.setDrawColor(120, 90, 0); doc.setLineWidth(0.25);
      doc.circle(cx + r - 0.5, cy - r + 0.5, 1.9, "FD");
      doc.setTextColor(60, 40, 0); doc.setFontSize(6); doc.text("C", cx + r - 0.5, cy - r + 1.5, { align: "center" });
    }
    doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "bold"); doc.setFontSize(6.6);
    doc.text(playerFirstName(p), cx, cy + r + 2.6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(firstSurname(p.last_name), cx, cy + r + 5.4, { align: "center" });
  });

  // ── Banquillo ──
  const bx = lx + pw + 8;
  doc.setTextColor(...GRANATE); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text(`BANQUILLO (${benchPlayers.length})`, bx, ly - 1.5);
  const GROUP = { portero: 0, central: 1, libre: 1, lateral: 1, mediocentro: 2, interior: 2, mediapunta: 2, extremo: 3, delantero_centro: 3 };
  let by = ly + 4;
  const step = Math.min(7.5, (ph - 6) / Math.max(benchPlayers.length + 1, 1));
  benchPlayers.forEach((p, i) => {
    if (i > 0 && (GROUP[p.position] ?? 9) !== (GROUP[benchPlayers[i - 1].position] ?? 9)) by += 2;
    const k = colorsFor(p, gkKitBench || gkKit);
    doc.setFillColor(...hex(k.fill)); doc.setDrawColor(...hex(k.stroke)); doc.setLineWidth(0.5);
    doc.circle(bx + 3.2, by, 3.2, "FD");
    doc.setTextColor(...hex(k.num)); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    doc.text(String(p.jersey_number || p.first_name?.[0] || ""), bx + 3.2, by + 1, { align: "center" });
    doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text(doc.splitTextToSize(`${playerFirstName(p)} ${firstSurname(p.last_name)}`, 36)[0], bx + 8, by + 1.1);
    by += step;
  });
  if (!benchPlayers.length) {
    doc.setTextColor(170, 170, 170); doc.setFont("helvetica", "italic"); doc.setFontSize(8.5);
    doc.text("Sin convocatoria.", bx, ly + 5);
  }

  // ── Columna derecha: planes ──
  const rx = bx + 52, rw = W - rx - 10;
  const gap = 6, spH = 30, boxH = (ph - spH - 2 * gap) / 2;
  [["PLAN DE PARTIDO EN ATAQUE", planAttack, ly, boxH], ["PLAN DE PARTIDO EN DEFENSA", planDefense, ly + boxH + gap, boxH], ["BALÓN PARADO", planSet, ly + 2 * (boxH + gap), spH]].forEach(([label, text, y, bh]) => {
    doc.setFillColor(250, 246, 246); doc.setDrawColor(225, 210, 210); doc.setLineWidth(0.3);
    doc.roundedRect(rx, y, rw, bh, 2, 2, "FD");
    doc.setFillColor(...GRANATE);
    doc.roundedRect(rx, y, 1.6, bh, 0.8, 0.8, "F");
    doc.setTextColor(...GRANATE); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
    doc.text(label, rx + 6, y + 6.5);
    drawRichText(doc, text, rx + 6, y + 10, rw - 12, bh - 13, bh === spH ? { base: 9.5 } : undefined);
  });

  // ── Pie ──
  doc.setDrawColor(225, 210, 210); doc.setLineWidth(0.3);
  doc.line(10, H - 9, W - 10, H - 9);
  doc.setTextColor(150, 150, 150); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text(`${ours} · RS Manager`, 10, H - 5);
  doc.text(`Generado el ${format(new Date(), "d/MM/yyyy HH:mm")}`, W - 10, H - 5, { align: "right" });

  const safe = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  doc.save(`Hoja_entrenador_${safe(ours)}_vs_${safe(opp)}${date ? "_" + format(date, "yyyy-MM-dd") : ""}.pdf`);
}
