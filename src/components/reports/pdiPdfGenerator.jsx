import jsPDF from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function setFill(doc, r, g, b) { doc.setFillColor(r, g, b); }
function setDraw(doc, r, g, b) { doc.setDrawColor(r, g, b); }
function setTxt(doc, r, g, b) { doc.setTextColor(r, g, b); }

function addWrappedText(doc, text, x, y, maxWidth, lineHeight = 5.5) {
  const lines = doc.splitTextToSize(text || "—", maxWidth);
  lines.forEach((line, i) => { doc.text(line, x, y + i * lineHeight); });
  return y + lines.length * lineHeight;
}

const FIELD_SECTIONS = [
  { key: "technical", label: "Habilidades Técnicas" },
  { key: "tactical", label: "Habilidades Tácticas" },
  { key: "physical", label: "Condición Física" },
  { key: "mental", label: "Actitud y Aspectos Mentales" },
  { key: "strengths", label: "Puntos Fuertes" },
  { key: "areas_to_improve", label: "Áreas de Mejora" },
  { key: "objectives", label: "Objetivos para el siguiente período" },
];

function addPDIBlock(doc, pdi, margin, cW, y) {
  const W = 210;

  // Period header bar
  setFill(doc, 248, 245, 245);
  doc.roundedRect(margin, y, cW, 12, 2, 2, "F");
  setTxt(doc, 139, 26, 43);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const periodLabel = pdi.period || (pdi.date ? format(new Date(pdi.date), "MMMM yyyy", { locale: es }) : "—");
  doc.text(periodLabel, margin + 4, y + 8);

  // Date / evaluator / rating on the right
  const meta = [
    pdi.date ? format(new Date(pdi.date), "dd/MM/yyyy") : "",
    pdi.evaluator ? `Evaluador: ${pdi.evaluator}` : "",
    pdi.overall_rating ? `Valoración: ${pdi.overall_rating}/10` : "",
  ].filter(Boolean).join("  ·  ");
  setTxt(doc, 100, 100, 100);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(meta, margin + cW - doc.getTextWidth(meta) - 4, y + 8);

  y += 16;

  FIELD_SECTIONS.forEach(({ key, label }) => {
    const value = pdi[key];
    if (!value) return;
    if (y > 265) { doc.addPage(); y = 20; }

    setTxt(doc, 139, 26, 43);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(label.toUpperCase(), margin, y);
    y += 4;

    setTxt(doc, 50, 50, 50);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    y = addWrappedText(doc, value, margin + 2, y, cW - 4, 5.5);
    y += 5;
  });

  // Separator
  setDraw(doc, 210, 210, 210);
  doc.setLineWidth(0.25);
  doc.line(margin, y, margin + cW, y);
  y += 8;

  return y;
}

export function generatePDIPDF(player, team, pdiRecords) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const margin = 18;
  const cW = W - margin * 2;
  let y = 0;

  // === HEADER BAND ===
  setFill(doc, 139, 26, 43);
  doc.rect(0, 0, W, 42, "F");
  setTxt(doc, 255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Informe PDI — Plan de Desarrollo Individual", margin, 14);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.text(`${player.first_name} ${player.last_name}  ·  ${team?.name || "—"}`, margin, 23);
  doc.setFontSize(7.5);
  doc.text(`Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}  ·  ${pdiRecords.length} evaluación${pdiRecords.length !== 1 ? "es" : ""}`, margin, 30);

  // Player initials circle
  setFill(doc, 255, 255, 255);
  doc.circle(W - margin - 12, 21, 12, "F");
  setTxt(doc, 139, 26, 43);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  const initials = `${player.first_name?.[0] || ""}${player.last_name?.[0] || ""}`;
  doc.text(initials, W - margin - 17, 24);

  y = 54;

  // === PLAYER INFO ===
  setTxt(doc, 139, 26, 43);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`${player.first_name} ${player.last_name}`, margin, y);

  setTxt(doc, 110, 110, 110);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const infoLine = [
    player.position && player.position.replace(/_/g, " "),
    player.jersey_number && `#${player.jersey_number}`,
    player.laterality,
  ].filter(Boolean).join("  ·  ");
  doc.text(infoLine, margin, y + 6);
  y += 16;

  // Separator
  setDraw(doc, 220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + cW, y);
  y += 10;

  if (pdiRecords.length === 0) {
    setTxt(doc, 150, 150, 150);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("No hay evaluaciones PDI registradas para este jugador.", margin, y);
  } else {
    pdiRecords.forEach((pdi) => {
      if (y > 255) { doc.addPage(); y = 20; }
      y = addPDIBlock(doc, pdi, margin, cW, y);
    });
  }

  // === FOOTER ===
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    setFill(doc, 139, 26, 43);
    doc.rect(0, 289, W, 9, "F");
    setTxt(doc, 255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`RS Data Manager — PDI Confidencial — ${player.first_name} ${player.last_name}`, margin, 294.5);
    doc.text(`Pág. ${p} / ${totalPages}`, W - margin - 16, 294.5);
  }

  return doc;
}

export function downloadPDIPDF(player, team, pdiRecords) {
  const doc = generatePDIPDF(player, team, pdiRecords);
  const safeName = `${player.first_name}_${player.last_name}`.replace(/\s+/g, "_");
  doc.save(`PDI_${safeName}.pdf`);
}