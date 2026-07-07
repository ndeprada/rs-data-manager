import jsPDF from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function setFill(doc, r, g, b) { doc.setFillColor(r, g, b); }
function setDraw(doc, r, g, b) { doc.setDrawColor(r, g, b); }
function setTxt(doc, r, g, b) { doc.setTextColor(r, g, b); }

function addWrappedText(doc, text, x, y, maxWidth, lineHeight) {
  const lh = lineHeight || 5.5;
  const lines = doc.splitTextToSize(text || "", maxWidth);
  lines.forEach((line, i) => { doc.text(line, x, y + i * lh); });
  return y + lines.length * lh;
}

function statBox(doc, x, y, w, h, label, value) {
  setFill(doc, 248, 248, 248);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "F");
  setDraw(doc, 220, 220, 220);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "S");
  setTxt(doc, 120, 120, 120);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(label, x + 3, y + 5);
  setTxt(doc, 20, 20, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(String(value ?? "—"), x + 3, y + 11);
}

export function generatePlayerPDF(player, team, stats, attendance, month, year) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const margin = 18;
  const cW = W - margin * 2;
  let y = 0;

  const periodLabel = format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: es });

  // === HEADER BAND ===
  setFill(doc, 139, 26, 43);
  doc.rect(0, 0, W, 40, "F");
  setTxt(doc, 255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Informe Mensual de Jugador", margin, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${team?.name || "—"}  ·  ${periodLabel}`, margin, 22);
  doc.setFontSize(7.5);
  doc.text(`Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}`, margin, 29);

  // Player initials circle
  setFill(doc, 255, 255, 255);
  doc.circle(W - margin - 12, 20, 12, "F");
  setTxt(doc, 139, 26, 43);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const initials = `${player.first_name?.[0] || ""}${player.last_name?.[0] || ""}`;
  doc.text(initials, W - margin - 16.5, 22.5);

  y = 50;

  // === PLAYER INFO ===
  setTxt(doc, 139, 26, 43);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`${player.first_name} ${player.last_name}`, margin, y);
  y += 5;

  setTxt(doc, 100, 100, 100);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const infoLine = [
    player.position && player.position.replace(/_/g, " "),
    player.jersey_number && `#${player.jersey_number}`,
    player.laterality,
    player.status && player.status.toUpperCase(),
  ].filter(Boolean).join("  ·  ");
  doc.text(infoLine, margin, y);
  y += 10;

  // Separator
  setDraw(doc, 220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + cW, y);
  y += 8;

  // === MATCH STATS ===
  setTxt(doc, 139, 26, 43);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Rendimiento en Partidos", margin, y);
  y += 7;

  const totalMinutes = stats.reduce((a, s) => a + (s.minutes_played || 0), 0);
  const totalGoals = stats.reduce((a, s) => a + (s.goals || 0), 0);
  const totalAssists = stats.reduce((a, s) => a + (s.assists || 0), 0);
  const totalYellow = stats.reduce((a, s) => a + (s.yellow_cards || 0), 0);
  const totalRed = stats.reduce((a, s) => a + (s.red_cards || 0), 0);
  const starterCount = stats.filter((s) => s.starter).length;
  const ratingStats = stats.filter((s) => s.rating);
  const avgRating = ratingStats.length > 0
    ? (ratingStats.reduce((a, s) => a + s.rating, 0) / ratingStats.length).toFixed(1)
    : null;

  const boxW = (cW - 10) / 6;
  const boxes = [
    { label: "Partidos", value: stats.length },
    { label: "Titular", value: starterCount },
    { label: "Minutos", value: totalMinutes },
    { label: "Goles", value: totalGoals },
    { label: "Asistencias", value: totalAssists },
    { label: "Valoración", value: avgRating ? `${avgRating}/10` : "—" },
  ];
  boxes.forEach((b, i) => {
    statBox(doc, margin + i * (boxW + 2), y, boxW, 16, b.label, b.value);
  });
  y += 22;

  if (totalYellow > 0 || totalRed > 0) {
    setTxt(doc, 160, 100, 20);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`⚠  Tarjetas: ${totalYellow} amarilla${totalYellow !== 1 ? "s" : ""}  /  ${totalRed} roja${totalRed !== 1 ? "s" : ""}`, margin, y);
    y += 7;
  }

  // Match history table
  if (stats.length > 0) {
    setTxt(doc, 80, 80, 80);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("Fecha", margin, y);
    doc.text("Rival", margin + 22, y);
    doc.text("Min", margin + 75, y);
    doc.text("Goles", margin + 88, y);
    doc.text("Asis.", margin + 103, y);
    doc.text("Val.", margin + 118, y);
    y += 3;
    setDraw(doc, 220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, y, margin + cW, y);
    y += 4;

    stats.slice(0, 8).forEach((s, i) => {
      if (y > 255) { doc.addPage(); y = 20; }
      if (i % 2 === 0) {
        setFill(doc, 250, 250, 250);
        doc.rect(margin, y - 3, cW, 6.5, "F");
      }
      setTxt(doc, 50, 50, 50);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(s.date ? format(new Date(s.date), "dd/MM/yy") : "—", margin, y + 1);
      doc.text((s.opponent || "—").slice(0, 28), margin + 22, y + 1);
      doc.text(String(s.minutes_played ?? "—"), margin + 75, y + 1);
      doc.text(String(s.goals ?? 0), margin + 88, y + 1);
      doc.text(String(s.assists ?? 0), margin + 103, y + 1);
      doc.text(s.rating ? `${s.rating}/10` : "—", margin + 118, y + 1);
      y += 7;
    });
    y += 4;
  }

  // === ATTENDANCE ===
  if (y > 225) { doc.addPage(); y = 20; }

  setDraw(doc, 220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + cW, y);
  y += 8;

  setTxt(doc, 139, 26, 43);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Asistencia a Entrenamientos", margin, y);
  y += 7;

  const present = attendance.filter((a) => a.status === "present").length;
  const apart = attendance.filter((a) => a.status === "apart").length;
  const absent = attendance.filter((a) => a.status === "absent").length;
  const total = attendance.length;
  const rate = total > 0 ? Math.round(((present + apart) / total) * 100) : null;

  const attBoxW = (cW - 6) / 4;
  [
    { label: "Total sesiones", value: total },
    { label: "Presente", value: present },
    { label: "Trabajando apart.", value: apart },
    { label: "Ausente", value: absent },
  ].forEach((b, i) => {
    statBox(doc, margin + i * (attBoxW + 2), y, attBoxW, 16, b.label, b.value);
  });
  y += 22;

  if (rate !== null) {
    // Attendance bar
    const barW = cW;
    const filled = Math.round((barW * (present + apart)) / Math.max(total, 1));
    setFill(doc, 230, 230, 230);
    doc.roundedRect(margin, y, barW, 5, 2, 2, "F");
    const barColor = rate >= 80 ? [34, 197, 94] : rate >= 60 ? [234, 179, 8] : [239, 68, 68];
    setFill(doc, ...barColor);
    doc.roundedRect(margin, y, filled, 5, 2, 2, "F");
    setTxt(doc, 50, 50, 50);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text(`${rate}% asistencia`, margin + barW + 2, y + 4);
    y += 10;
  }

  // === GUARDIAN INFO ===
  if (player.guardian_name || player.guardian_email) {
    if (y > 240) { doc.addPage(); y = 20; }
    y += 4;
    setDraw(doc, 220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + cW, y);
    y += 8;

    setTxt(doc, 139, 26, 43);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Contacto del Tutor Legal", margin, y);
    y += 6;

    setTxt(doc, 50, 50, 50);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    if (player.guardian_name) doc.text(`Nombre: ${player.guardian_name}`, margin, y);
    y += 5;
    if (player.guardian_phone) doc.text(`Teléfono: ${player.guardian_phone}`, margin, y);
    y += 5;
    if (player.guardian_email) doc.text(`Email: ${player.guardian_email}`, margin, y);
    y += 5;
  }

  // === FOOTER on all pages ===
  const total_pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total_pages; p++) {
    doc.setPage(p);
    setFill(doc, 139, 26, 43);
    doc.rect(0, 289, W, 9, "F");
    setTxt(doc, 255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`RS Data Manager — Informe Mensual Confidencial — ${player.first_name} ${player.last_name}`, margin, 294.5);
    doc.text(`Pág. ${p} / ${total_pages}`, W - margin - 16, 294.5);
  }

  return doc;
}

export function downloadPlayerPDF(player, team, stats, attendance, month, year) {
  const doc = generatePlayerPDF(player, team, stats, attendance, month, year);
  const safeName = `${player.first_name}_${player.last_name}`.replace(/\s+/g, "_");
  doc.save(`informe_${safeName}_${year}-${String(month).padStart(2, "0")}.pdf`);
}