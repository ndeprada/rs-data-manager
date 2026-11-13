// Hoja del entrenador (A4 horizontal): alineación + banquillo a la izquierda, plan en ataque y en defensa a la derecha.
import * as jspdfMod from "jspdf";
const jsPDF = jspdfMod.jsPDF || jspdfMod.default?.jsPDF || jspdfMod.default;
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { playerFirstName } from "@/lib/playerName";
import { f7Markings } from "./pitchGeometry";
import { lineupLayout, firstSurname, fitText, LINEUP } from "@/lib/matchSheetLayout";
import { drawRichText } from "@/lib/richTextPdf";
import { BRAND, F as clubFont } from "./brand.js";
import { shirtPng } from "./clubKits.js";

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

// Campo del once. `light` = versión de poca tinta (fondo blanco y líneas grises), la de la hoja del entrenador
export function drawPitch(doc, x0, y0, pw, ph, isF7 = false, { light = false } = {}) {
  const s = pw / 300;
  const line = light ? [200, 193, 193] : [150, 190, 155];
  doc.setFillColor(...(light ? [255, 255, 255] : [238, 246, 238]));
  if (light) { doc.setDrawColor(225, 218, 218); doc.setLineWidth(0.3); doc.roundedRect(x0, y0, pw, ph, 1.5, 1.5, "FD"); }
  else doc.roundedRect(x0, y0, pw, ph, 1.5, 1.5, "F");
  doc.setDrawColor(...line);
  doc.setLineWidth(0.35);
  const m = 12 * s;
  doc.rect(x0 + m, y0 + m, pw - 2 * m, ph - 2 * m);
  doc.line(x0 + m, y0 + ph / 2, x0 + pw - m, y0 + ph / 2);
  if (isF7) {
    // Fútbol 7 a escala (45 × 65 m): áreas, punto de penalti, círculo y líneas de fuera de juego a 12 m de cada línea de meta
    const f = f7Markings(x0 + m, y0 + m, pw - 2 * m, ph - 2 * m);
    doc.circle(f.centre.x, f.centre.y, f.centre.r);
    doc.setFillColor(...line);
    doc.circle(f.centre.x, f.centre.y, 0.6, "F");
    const top = y0 + m, bottom = y0 + ph - m;
    doc.rect(f.area.x, top, f.area.w, f.area.d);
    doc.rect(f.goalArea.x, top, f.goalArea.w, f.goalArea.d);
    doc.rect(f.area.x, bottom - f.area.d, f.area.w, f.area.d);
    doc.rect(f.goalArea.x, bottom - f.goalArea.d, f.goalArea.w, f.goalArea.d);
    doc.circle(f.centre.x, top + f.spot, 0.45, "F");
    doc.circle(f.centre.x, bottom - f.spot, 0.45, "F");
    doc.setDrawColor(...(light ? [175, 165, 165] : [95, 150, 105])); doc.setLineWidth(0.4); doc.setLineDashPattern([1.8, 1.4], 0);
    doc.line(x0 + m, top + f.offside, x0 + pw - m, top + f.offside);
    doc.line(x0 + m, bottom - f.offside, x0 + pw - m, bottom - f.offside);
    doc.setLineDashPattern([], 0);
    return;
  }
  doc.circle(x0 + pw / 2, y0 + ph / 2, 38 * s);
  doc.setFillColor(...line);
  doc.circle(x0 + pw / 2, y0 + ph / 2, 0.6, "F");
  doc.rect(x0 + pw * 0.22, y0 + m, pw * 0.56, 72 * s);
  doc.rect(x0 + pw * 0.34, y0 + m, pw * 0.32, 28 * s);
  doc.rect(x0 + pw * 0.22, y0 + ph - m - 72 * s, pw * 0.56, 72 * s);
  doc.rect(x0 + pw * 0.34, y0 + ph - m - 28 * s, pw * 0.32, 28 * s);
}

// Tipografía de los títulos del club dentro del PDF (si es un .ttf; si no, Helvetica)
let titleFontB64 = null;
async function useTitleFont(doc) {
  const url = clubFont.titleUrl;
  if (!url || !/\.ttf(\?|$)/i.test(url)) return null;
  try {
    if (!titleFontB64) {
      const buf = new Uint8Array(await fetch(url).then((r) => { if (!r.ok) throw new Error("font"); return r.arrayBuffer(); }));
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      titleFontB64 = btoa(bin);
    }
    doc.addFileToVFS("club-title.ttf", titleFontB64);
    doc.addFont("club-title.ttf", "ClubTitle", "normal");
    return "ClubTitle";
  } catch { return null; }
}

const ORANGE = [255, 110, 0];
const INK = [30, 20, 22], INK2 = [74, 61, 63], MUTED = [107, 94, 96], LINE = [230, 222, 221], SOFT = [247, 243, 242];
const POS_SHORT = { portero: "POR", central: "DFC", libre: "LIB", lateral: "LAT", mediocentro: "MC", interior: "INT", mediapunta: "MP", extremo: "EXT", delantero_centro: "DC" };
const htmlText = (v) => String(v || "").replace(/<\/(p|li|div)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").split("\n").map((x) => x.trim()).filter(Boolean);

// Hoja del entrenador (13/11/2026, maqueta «Maqueta Hoja del entrenador», versión B «poca tinta» elegida por Nacho):
// página 1 = once en el campo · banquillo, no convocados y rival · plan de partido, balón parado y notas;
// página 2 (opcional) = para el banquillo durante el partido: minutos y acciones, ventanas de cambio de los dos equipos y
// tarjetas del rival. Escudos de los dos equipos: el local a la izquierda y el visitante a la derecha.
export async function downloadMatchSheetPDF({ event, team, isF7 = false, formation, positions, slots, captainId, kit, gkKit, gkKitBench, kits, gkKits, benchPlayers, planAttack, planDefense, planSet, ourLogoUrl, opponentLogoUrl, preview = false,
  callupTime = "", kitText = "", absent = [], rival = null, rivalNotes = [], pieces = [], benchPage = true, amateur = false }) {
  const [ourLogo, oppLogo] = await Promise.all([loadImage(ourLogoUrl), loadImage(opponentLogoUrl)]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const TF = await useTitleFont(doc);
  const W = 297, H = 210, M = 9;
  const titleFont = (pt) => { if (TF) doc.setFont(TF, "normal"); else doc.setFont("helvetica", "bold"); doc.setFontSize(pt); };
  const font = (pt, bold = false, italic = false) => { doc.setFont("helvetica", bold ? (italic ? "bolditalic" : "bold") : italic ? "italic" : "normal"); doc.setFontSize(pt); };
  const heading = (text, x, y, right = "") => {
    doc.setFillColor(...ORANGE); doc.rect(x, y - 4.3, 1.1, 5, "F");
    titleFont(14.5); doc.setTextColor(...GRANATE); doc.text(text, x + 3, y);
    if (right) { font(7.2); doc.setTextColor(...MUTED); return doc.text(right, x + headingW(x), y, { align: "right" }); }
  };
  let headingW = () => 0;

  const date = event?.date ? new Date(event.date) : null;
  const isHome = event?.is_home !== false;
  const ours = team?.name || "Nuestro equipo";
  const opp = event?.opponent || "Rival";
  const [local, visitor] = isHome ? [ours, opp] : [opp, ours];
  const [localLogo, visitorLogo] = isHome ? [ourLogo, oppLogo] : [oppLogo, ourLogo];
  const typeLabel = event?.type === "partido_amistoso" ? "Amistoso" : event?.type === "torneo" ? "Torneo" : "Liga";
  const jornada = event?.fcf_jornada ? ` · Jornada ${event.fcf_jornada}` : "";
  const placeholderCrest = (x, y, name) => {
    doc.setDrawColor(...LINE); doc.setFillColor(...SOFT); doc.setLineWidth(0.3); doc.roundedRect(x, y, 19, 19, 3, 3, "FD");
    titleFont(10); doc.setTextColor(...MUTED); doc.text(String(name || "?").replace(/["«»]/g, "").trim().slice(0, 2).toUpperCase(), x + 9.5, y + 12.3, { align: "center" });
  };
  const crest = (img, x, y, name) => (img ? addImageFit(doc, img, x, y, 19, 19) : placeholderCrest(x, y, name));

  // ── Cabecera de una página: escudo local, título «LOCAL vs VISITANTE», escudo visitante; raya granate debajo ──
  const header = (kicker, chips) => {
    crest(localLogo, M, 8, local);
    crest(visitorLogo, W - M - 19, 8, visitor);
    // pastillas a la derecha, junto al escudo visitante
    font(7.3, true);
    const chipW = (t) => doc.getTextWidth(t) + 5;
    const rows = [chips.slice(0, 2), chips.slice(2, 4)].map((r) => r.filter(Boolean));
    const widest = Math.max(0, ...rows.map((r) => r.reduce((a, t) => a + chipW(t) + 1.5, 0)));
    const chipsRight = W - M - 23;
    rows.forEach((r, ri) => {
      let x = chipsRight;
      [...r].reverse().forEach((t) => {
        const w = chipW(t); x -= w;
        doc.setDrawColor(...LINE); doc.setFillColor(...SOFT); doc.setLineWidth(0.25);
        doc.roundedRect(x, 9.5 + ri * 7.4, w, 5.4, 2.7, 2.7, "FD");
        font(7.3, true); doc.setTextColor(...INK2); doc.text(t, x + 2.5, 13.2 + ri * 7.4);
        x -= 1.5;
      });
    });
    const tx = M + 23, maxW = chipsRight - widest - 6 - tx;
    font(7.5, true); doc.setTextColor(...ORANGE); doc.text(kicker, tx, 12.6);
    let pt = 22;
    titleFont(pt);
    const vs = "  vs  ";
    const totalW = () => doc.getTextWidth(local.toUpperCase()) + doc.getTextWidth(vs) + doc.getTextWidth(visitor.toUpperCase());
    while (pt > 11 && totalW() > maxW) { pt -= 1; titleFont(pt); }
    let x = tx;
    doc.setTextColor(...GRANATE); doc.text(local.toUpperCase(), x, 23); x += doc.getTextWidth(local.toUpperCase());
    doc.setTextColor(...ORANGE); doc.text(vs, x, 23); x += doc.getTextWidth(vs);
    doc.setTextColor(...GRANATE); doc.text(visitor.toUpperCase(), x, 23);
    doc.setDrawColor(...GRANATE); doc.setLineWidth(0.9); doc.line(M, 31, W - M, 31);
  };


  const when = date ? format(date, "EEE d MMM · HH:mm", { locale: es }).toUpperCase() : "";
  const place = event?.location ? `${isHome ? "En casa" : "Fuera"} · ${event.location}` : (isHome ? "En casa" : "Fuera");
  header(`HOJA DEL ENTRENADOR  ·  ${typeLabel.toUpperCase()}${jornada.toUpperCase()}`,
    [when, callupTime ? `Convocatoria ${callupTime}` : "", place, kitText].filter(Boolean));

  // ── Columna 1: once en el campo ──
  const top = 44, bottom = H - 7;
  const lx = M, ph = bottom - top - 3, pw = ph * 300 / 420;
  headingW = () => pw - 2.6;
  heading(`${isF7 ? "SIETE" : "ONCE"} INICIAL · ${formation}`, lx, top - 3, captainId ? "C = capitán" : "");
  const ly = top;
  drawPitch(doc, lx, ly, pw, ph, isF7, { light: true });
  const colorsFor = (p, gk = gkKit) => (p?.position === "portero" ? (gkKits[gk] || gkKits.naranja) : (kits[kit] || kits["1"]));
  const widthOf = (text, pt, bold) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(pt); return doc.getTextWidth(text); };
  const shirtR = 6.2;
  const shirts = new Map();
  const titleFontName = clubFont.titleName || "Racing Sarria";
  await Promise.all(slots.filter(Boolean).map(async (p) => {
    const k = colorsFor(p);
    const key = `${k.img}|${p.jersey_number ?? ""}`;
    if (!shirts.has(key)) shirts.set(key, shirtPng(k, p.jersey_number ?? "", { font: titleFontName, scale: 0.5 }).catch(() => null));
  }));
  const shirtOf = async (p) => { const k = colorsFor(p); return k.img ? shirts.get(`${k.img}|${p.jersey_number ?? ""}`) : null; };
  const layout = lineupLayout(slots, positions, pw, ph, widthOf, { r: shirtR });
  for (const [i, p] of slots.entries()) {
    const L = layout[i];
    if (!L) continue;
    const cx = lx + L.cx, cy = ly + L.cy, r = L.r;
    const k = colorsFor(p);
    if (L.empty) {
      doc.setDrawColor(160, 160, 160); doc.setLineDashPattern([1, 1], 0); doc.setLineWidth(0.3);
      doc.circle(cx, cy, r * 0.7, "S"); doc.setLineDashPattern([], 0);
      continue;
    }
    const img = await shirtOf(p);
    if (img) {
      const sh = r * 2, sw = sh * img.w / img.h;
      try { doc.addImage(img.data, "PNG", cx - sw / 2, cy - sh / 2, sw, sh, undefined, "FAST"); } catch { /* imagen no válida */ }
    } else {
      doc.setFillColor(...hex(k.fill)); doc.setDrawColor(...hex(k.stroke)); doc.setLineWidth(0.7);
      doc.circle(cx, cy, r * 0.78, "FD");
      doc.setTextColor(...hex(k.num)); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
      doc.text(String(p.jersey_number || p.first_name?.[0] || ""), cx, cy + 1.25, { align: "center" });
    }
    if (p.id === captainId) {
      doc.setFillColor(...ORANGE); doc.circle(cx + r - 0.5, cy - r + 0.5, 1.9, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(6); doc.text("C", cx + r - 0.5, cy - r + 1.5, { align: "center" });
    }
    doc.setTextColor(...INK); doc.setFontSize(L.size);
    L.lines.forEach((ln) => {
      doc.setFont("helvetica", ln.bold ? "bold" : "normal");
      doc.text(ln.text, cx, ly + ln.y, { align: "center" });
    });
  }

  // ── Columna 2: banquillo, no convocados y rival ──
  const bx = lx + pw + 6, bw = 70;
  headingW = () => bw;
  heading("BANQUILLO", bx, top - 3, benchPlayers.length ? "min. entra" : "");
  let y = top + 1.8;
  const rowH = Math.min(5.6, 70 / Math.max(benchPlayers.length, 1));
  benchPlayers.forEach((p) => {
    doc.setDrawColor(241, 236, 236); doc.setLineWidth(0.25); doc.line(bx, y - 1.2, bx + bw, y - 1.2);
    titleFont(10); doc.setTextColor(...GRANATE); doc.text(String(p.jersey_number ?? ""), bx + 6, y + 2.6, { align: "right" });
    const nm = fitText(`${playerFirstName(p)} ${p.last_name || ""}`.trim(), 40, widthOf, true, 8.3, 6.5);
    doc.setTextColor(...INK); font(nm.size, true); doc.text(nm.text, bx + 8, y + 2.6);
    font(6.3, true); doc.setTextColor(...MUTED); doc.text(POS_SHORT[p.position] || "", bx + 50, y + 2.6);
    doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.roundedRect(bx + 58, y - 0.4, 12, 4, 0.8, 0.8, "S");
    y += rowH;
  });
  if (!benchPlayers.length) { font(8, false, true); doc.setTextColor(170, 170, 170); doc.text("Sin banquillo.", bx, y + 2.6); y += 6; }
  y += 5;
  if (absent.length) {
    heading("NO CONVOCADOS", bx, y);
    y += 4.6;
    absent.slice(0, 8).forEach((a) => {
      titleFont(8.5); doc.setTextColor(...MUTED); doc.text(String(a.dorsal ?? ""), bx + 6, y + 2.4, { align: "right" });
      const txt = `${a.name}${a.reason ? ` · ${a.reason}` : ""}`;
      font(7.4); doc.setTextColor(...INK2);
      const t1 = fitText(txt, bw - 8, widthOf, false, 7.4, 6);
      doc.setFontSize(t1.size); doc.text(t1.text, bx + 8, y + 2.4);
      y += 4.3;
    });
    y += 4;
  }
  if (rival) {
    heading(`RIVAL · ${String(opp).toUpperCase()}`.slice(0, 34), bx, y);
    y += 9;
    if (rival.pos) { titleFont(17); doc.setTextColor(...GRANATE); doc.text(`${rival.pos}.º`, bx, y); }
    font(7.6); doc.setTextColor(...INK2);
    doc.text([rival.pts != null ? `${rival.pts} pts` : "", rival.gf != null ? `${rival.gf} GF` : "", rival.gc != null ? `${rival.gc} GC` : ""].filter(Boolean).join(" · "), bx + 13, y - 0.6);
    let fx = bx + bw - 4.2 * (rival.form?.length || 0);
    (rival.form || []).forEach((f) => {
      doc.setFillColor(...(f === "G" ? [21, 128, 61] : f === "E" ? [217, 119, 6] : [185, 28, 28]));
      doc.roundedRect(fx, y - 3.6, 3.7, 3.7, 0.7, 0.7, "F");
      font(6, true); doc.setTextColor(255, 255, 255); doc.text(f, fx + 1.85, y - 0.9, { align: "center" });
      fx += 4.2;
    });
    y += 4.5;
    const info = [rival.awayText, rival.h2hText, rival.scorer].filter(Boolean).join(" · ");
    if (info) { font(7); doc.setTextColor(...INK2); const ls = doc.splitTextToSize(info, bw); doc.text(ls.slice(0, 2), bx, y); y += ls.slice(0, 2).length * 3.2 + 1; }
  }
  if (rivalNotes.length && y < bottom - 14) {
    const lines = [];
    font(7);
    rivalNotes.slice(0, 4).forEach((n) => doc.splitTextToSize(`· ${n}`, bw - 5).forEach((l) => lines.push(l)));
    const room = Math.max(1, Math.floor((bottom - y - 8) / 3.2));
    const shown = lines.slice(0, room);
    const bh = 6 + shown.length * 3.2;
    doc.setFillColor(...SOFT); doc.roundedRect(bx, y, bw, bh, 1.5, 1.5, "F");
    font(7.2, true); doc.setTextColor(...GRANATE); doc.text("Lo que apuntamos de ellos", bx + 2.5, y + 4);
    font(7); doc.setTextColor(...INK2); doc.text(shown, bx + 2.5, y + 7.4);
  }

  // ── Columna 3: plan de partido, balón parado y notas ──
  const rx = bx + bw + 6, rw = W - M - rx;
  headingW = () => rw;
  const notesH = 30;
  const abp = pieces.slice(0, 7);
  const abpH = abp.length ? 8 + abp.length * 5.4 : (htmlText(planSet).length ? 26 : 0);
  const planH = (bottom - top + 3 - notesH - abpH - (abpH ? 4 : 0)) / 2 - 3;
  let py = top - 3;
  [["PLAN DE PARTIDO · ATAQUE", planAttack], ["PLAN DE PARTIDO · DEFENSA", planDefense]].forEach(([label, text]) => {
    heading(label, rx, py);
    drawRichText(doc, text, rx + 2.6, py + 2, rw - 2.6, planH - 3, { base: 9 });
    py += planH + 3;
  });
  if (abpH) {
    heading("BALÓN PARADO", rx, py, abp.length ? `${pieces.length} jugada${pieces.length === 1 ? "" : "s"}` : "");
    let ay = py + 5.8;
    if (abp.length) {
      abp.forEach((pc) => {
        doc.setDrawColor(241, 236, 236); doc.setLineWidth(0.25); doc.line(rx, ay - 1.4, rx + rw, ay - 1.4);
        const sig = String(pc.signal || "").trim();
        font(6.8, true); const sw = sig ? Math.min(doc.getTextWidth(sig) + 4.5, rw * 0.38) : 0;
        font(7.6, true); doc.setTextColor(...INK);
        const k = fitText(pc.kind, 34, widthOf, true, 7.6, 6.2); doc.setFontSize(k.size); doc.text(k.text, rx, ay + 2.4);
        const d = fitText(pc.name || "", rw - 36 - sw - 2, widthOf, false, 7.2, 6); font(d.size); doc.setTextColor(...INK2); doc.text(d.text, rx + 36, ay + 2.4);
        if (sig) {
          doc.setFillColor(...GRANATE); doc.roundedRect(rx + rw - sw, ay - 0.3, sw, 3.9, 1.95, 1.95, "F");
          const sg = fitText(sig, sw - 3.5, widthOf, true, 6.8, 5.5); font(sg.size, true); doc.setTextColor(255, 255, 255); doc.text(sg.text, rx + rw - sw / 2, ay + 2.4, { align: "center" });
        }
        ay += 5.4;
      });
    } else drawRichText(doc, planSet, rx + 2.6, py + 2, rw - 2.6, abpH - 4, { base: 8.5 });
    py += abpH + 4;
  }
  const ny = bottom - notesH + 4;
  heading("NOTAS DEL PARTIDO", rx, ny);
  doc.setDrawColor(217, 208, 208); doc.setLineWidth(0.25);
  for (let i = 1; i <= 4; i++) doc.line(rx, ny + 1 + i * 6, rx + rw, ny + 1 + i * 6);



  // ── Página 2: para el banquillo durante el partido ──
  if (benchPage) {
    doc.addPage("a4", "landscape");
    header(`DURANTE EL PARTIDO  ·  ${typeLabel.toUpperCase()}${jornada.toUpperCase()}`, [when, place]);
    const tx = M, tw = 182;
    const cols = [["ENTRA", 14], ["SALE", 14], ["MIN", 12], ["GOL", 11], ["AS.", 11], ["TARJ.", 13]];
    const nameW = 52, numW = 8;
    const notaW = tw - numW - nameW - cols.reduce((a, c) => a + c[1], 0);
    const players = [...slots.filter(Boolean), ...benchPlayers];
    const boxesH = 50;
    const rh = Math.min(6.2, (bottom - top - boxesH - 9) / Math.max(players.length, 1));
    headingW = () => tw;
    heading("MINUTOS Y ACCIONES", tx, top - 3, "se pasa luego al acta");
    let hx = tx + numW + nameW;
    font(6.4, true); doc.setTextColor(...MUTED);
    [...cols, ["NOTA", notaW]].forEach(([c, w]) => { doc.text(c, hx + w / 2, top + 2, { align: "center" }); hx += w; });
    let ty = top + 3.5;
    const starters = slots.filter(Boolean).length;
    players.forEach((p, i) => {
      if (i === starters && i > 0) { doc.setDrawColor(...GRANATE); doc.setLineWidth(0.4); } else { doc.setDrawColor(...LINE); doc.setLineWidth(0.25); }
      doc.line(tx, ty, tx + tw, ty);
      titleFont(Math.min(10, rh * 1.7)); doc.setTextColor(...GRANATE); doc.text(String(p.jersey_number ?? ""), tx + numW - 1, ty + rh * 0.72, { align: "right" });
      const nm = fitText(`${playerFirstName(p)} ${p.last_name || ""}`.trim(), nameW - 2, widthOf, true, Math.min(8.3, rh * 1.45), 6);
      font(nm.size, true); doc.setTextColor(...INK); doc.text(nm.text, tx + numW + 1.5, ty + rh * 0.7);
      let cx = tx + numW + nameW;
      doc.setDrawColor(238, 232, 232); doc.setLineWidth(0.2);
      [...cols, ["", notaW]].forEach(([, w]) => { doc.line(cx, ty + 0.6, cx, ty + rh - 0.6); cx += w; });
      ty += rh;
    });
    doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.line(tx, ty, tx + tw, ty);
    if (starters && players.length > starters) { font(6, false, true); doc.setTextColor(...MUTED); doc.text("titulares arriba · suplentes debajo de la raya", tx + tw, ty + 3, { align: "right" }); }

    // Ventanas de cambio de los dos equipos y tarjetas del rival (debajo de la lista)
    const by2 = bottom - boxesH + 6, half = (tw - 6) / 2;
    headingW = () => half;
    heading("VENTANAS DE CAMBIO", tx, by2, amateur ? "3 ventanas · máx. 7 cambios" : "3 ventanas por equipo");
    font(6.4, false, true); doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize("El descanso no cuenta · se puede aprovechar la ventana del rival", half), tx, by2 + 4);
    [["Nosotros", ours], ["Rival", opp]].forEach(([lab], ri) => {
      const yy = by2 + 8 + ri * 15;
      font(7.6, true); doc.setTextColor(...INK); doc.text(lab, tx, yy + 4);
      for (let w = 0; w < 3; w++) {
        const x = tx + 18 + w * 21;
        doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.roundedRect(x, yy, 19, 6.5, 1, 1, "S");
        font(5.6); doc.setTextColor(...MUTED); doc.text(`${w + 1}.ª  min`, x + 1.2, yy + 2.3); doc.text("nº", x + 12, yy + 2.3);
      }
      if (amateur) {
        font(5.8); doc.setTextColor(...MUTED); doc.text("cambios", tx + 18, yy + 10.2);
        for (let c = 0; c < 7; c++) { doc.setDrawColor(...LINE); doc.rect(tx + 29 + c * 4.6, yy + 7.8, 3.5, 3.5, "S"); }
      }
    });
    const cx2 = tx + half + 6;
    headingW = () => half;
    heading("TARJETAS DEL RIVAL", cx2, by2);
    font(6.4, true); doc.setTextColor(...MUTED);
    const cc = [["MIN", 12], ["DORSAL", 16], ["AM. / ROJA", 22], ["MOTIVO", half - 50]];
    let cxx = cx2;
    cc.forEach(([c, w]) => { doc.text(c, cxx + w / 2, by2 + 4.6, { align: "center" }); cxx += w; });
    for (let r = 0; r < 5; r++) {
      const yy = by2 + 6 + r * 6.2;
      doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.line(cx2, yy, cx2 + half, yy);
      let x = cx2;
      cc.forEach(([, w], ci) => {
        if (ci === 2) { doc.rect(x + 5, yy + 1.4, 3.4, 3.4, "S"); doc.setFillColor(250, 204, 21); doc.rect(x + 5.6, yy + 2, 2.2, 2.2, "F"); doc.rect(x + 13, yy + 1.4, 3.4, 3.4, "S"); doc.setFillColor(220, 38, 38); doc.rect(x + 13.6, yy + 2, 2.2, 2.2, "F"); }
        x += w;
        if (ci < cc.length - 1) { doc.setDrawColor(238, 232, 232); doc.line(x, yy + 0.6, x, yy + 5.6); doc.setDrawColor(...LINE); }
      });
    }
    doc.line(cx2, by2 + 6 + 5 * 6.2, cx2 + half, by2 + 6 + 5 * 6.2);

    // Derecha: qué está pasando en cada parte y marcador
    const qx = tx + tw + 6, qw = W - M - qx;
    headingW = () => qw;
    const partsH = (bottom - top - 26) / 2;
    [isF7 ? "1.ER Y 2.º CUARTO · QUÉ PASA" : "1.ª PARTE · QUÉ ESTÁ PASANDO", isF7 ? "3.ER Y 4.º CUARTO · QUÉ PASA" : "2.ª PARTE · QUÉ ESTÁ PASANDO"].forEach((lab, i) => {
      const yy = top - 3 + i * (partsH + 4);
      heading(lab, qx, yy);
      doc.setDrawColor(217, 208, 208); doc.setLineWidth(0.25);
      for (let l = 1; l * 6.4 < partsH - 2; l++) doc.line(qx, yy + 1 + l * 6.4, qx + qw, yy + 1 + l * 6.4);
    });
    const sy = bottom - 16;
    heading("MARCADOR", qx, sy);
    [["Descanso", qx], ["Final", qx + qw / 2]].forEach(([lab, x]) => {
      font(7, true); doc.setTextColor(...MUTED); doc.text(lab, x, sy + 5);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.4);
      doc.roundedRect(x, sy + 6.5, 10, 8, 1, 1, "S"); doc.roundedRect(x + 14, sy + 6.5, 10, 8, 1, 1, "S");
      titleFont(12); doc.setTextColor(...MUTED); doc.text("–", x + 12, sy + 12.3, { align: "center" });
    });
  }

  const safe = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (preview) return doc.output("bloburl");
  doc.save(`Hoja_entrenador_${safe(ours)}_vs_${safe(opp)}${date ? "_" + format(date, "yyyy-MM-dd") : ""}.pdf`);
  return null;
}
