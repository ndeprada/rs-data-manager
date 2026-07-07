import jsPDF from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function setFill(doc, r, g, b) { doc.setFillColor(r, g, b); }
function setDraw(doc, r, g, b) { doc.setDrawColor(r, g, b); }
function setTxt(doc, r, g, b) { doc.setTextColor(r, g, b); }

function addWrappedText(doc, text, x, y, maxWidth, lineHeight = 5.5) {
  const lines = doc.splitTextToSize(text || "—", maxWidth);
  lines.forEach((line, i) => doc.text(line, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function statBox(doc, label, value, bx, by, boxW) {
  setFill(doc, 248, 245, 245);
  doc.roundedRect(bx, by, boxW, 18, 2, 2, "F");
  setTxt(doc, 139, 26, 43);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(String(value), bx + boxW / 2, by + 10, { align: "center" });
  setTxt(doc, 110, 110, 110);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(label, bx + boxW / 2, by + 15.5, { align: "center" });
}

export function downloadProgressionPDF(player, team, matchStats, attendance, pdiRecords, sessionReports) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const margin = 18;
  const cW = W - margin * 2;
  let y = 0;

  // ── HEADER ──
  setFill(doc, 139, 26, 43);
  doc.rect(0, 0, W, 44, "F");
  setTxt(doc, 255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Informe de Progresión Individual", margin, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${player.first_name} ${player.last_name}  ·  ${team?.name || "—"}`, margin, 23);
  doc.setFontSize(7.5);
  doc.text(
    `Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}`,
    margin, 31
  );

  // Initials circle
  setFill(doc, 255, 255, 255);
  doc.circle(W - margin - 12, 22, 12, "F");
  setTxt(doc, 139, 26, 43);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  const initials = `${player.first_name?.[0] || ""}${player.last_name?.[0] || ""}`;
  doc.text(initials, W - margin - 17, 25);

  y = 56;

  // ── RESUMEN ESTADÍSTICO ──
  setTxt(doc, 139, 26, 43);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Resumen Estadístico", margin, y);
  y += 3;
  setDraw(doc, 139, 26, 43);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + cW, y);
  y += 6;

  // Compute stats
  const totalMinutes = matchStats.reduce((s, m) => s + (m.minutes_played || 0), 0);
  const totalGoals = matchStats.reduce((s, m) => s + (m.goals || 0), 0);
  const totalAssists = matchStats.reduce((s, m) => s + (m.assists || 0), 0);
  const matchesPlayed = matchStats.length;

  const presentCount = attendance.filter(a => a.status === "present" || a.attended === true).length;
  const apartCount = attendance.filter(a => a.status === "apart").length;
  const absentCount = attendance.filter(a => a.status === "absent" || a.attended === false).length;
  const totalSessions = attendance.length;
  const attendanceRate = totalSessions > 0 ? Math.round(((presentCount + apartCount) / totalSessions) * 100) : 0;

  const boxW = (cW - 10) / 6;
  const statsData = [
    { label: "Partidos", value: matchesPlayed },
    { label: "Minutos", value: totalMinutes },
    { label: "Goles", value: totalGoals },
    { label: "Asistencias", value: totalAssists },
    { label: "Entrenos asistidos", value: `${presentCount + apartCount}/${totalSessions}` },
    { label: "% Asistencia", value: `${attendanceRate}%` },
  ];

  statsData.forEach((s, i) => {
    statBox(doc, s.label, s.value, margin + i * (boxW + 2), y, boxW);
  });
  y += 24;

  // ── PARTIDOS / MINUTOS ──
  if (matchStats.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    y += 4;
    setTxt(doc, 139, 26, 43);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Participación en Partidos", margin, y);
    y += 3;
    setDraw(doc, 139, 26, 43);
    doc.setLineWidth(0.4);
    doc.line(margin, y, margin + cW, y);
    y += 6;

    // Table header
    setFill(doc, 139, 26, 43);
    doc.rect(margin, y, cW, 7, "F");
    setTxt(doc, 255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("Fecha", margin + 2, y + 5);
    doc.text("Rival", margin + 28, y + 5);
    doc.text("Titular", margin + 85, y + 5);
    doc.text("Min.", margin + 105, y + 5);
    doc.text("G", margin + 120, y + 5);
    doc.text("A", margin + 130, y + 5);
    doc.text("TA", margin + 140, y + 5);
    doc.text("TR", margin + 152, y + 5);
    doc.text("Nota", margin + 162, y + 5);
    y += 7;

    matchStats.slice(0, 20).forEach((m, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) {
        setFill(doc, 248, 248, 248);
        doc.rect(margin, y, cW, 7, "F");
      }
      setTxt(doc, 40, 40, 40);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      const dateStr = m.date ? format(new Date(m.date), "dd/MM/yy") : "—";
      doc.text(dateStr, margin + 2, y + 5);
      doc.text((m.opponent || "—").substring(0, 28), margin + 28, y + 5);
      doc.text(m.starter ? "Sí" : "No", margin + 85, y + 5);
      doc.text(String(m.minutes_played ?? "—"), margin + 105, y + 5);
      doc.text(String(m.goals ?? 0), margin + 120, y + 5);
      doc.text(String(m.assists ?? 0), margin + 130, y + 5);
      doc.text(String(m.yellow_cards ?? 0), margin + 140, y + 5);
      doc.text(String(m.red_cards ?? 0), margin + 152, y + 5);
      doc.text(m.rating ? `${m.rating}/5` : "—", margin + 162, y + 5);
      y += 7;
    });
    if (matchStats.length > 20) {
      setTxt(doc, 140, 140, 140);
      doc.setFontSize(7);
      doc.text(`... y ${matchStats.length - 20} partidos más`, margin + 2, y + 5);
      y += 8;
    }
  }

  // ── ASISTENCIA ENTRENAMIENTOS ──
  if (attendance.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    y += 8;
    setTxt(doc, 139, 26, 43);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Asistencia a Entrenamientos", margin, y);
    y += 3;
    setDraw(doc, 139, 26, 43);
    doc.setLineWidth(0.4);
    doc.line(margin, y, margin + cW, y);
    y += 6;

    // Summary bar
    const barW = cW;
    const presentW = totalSessions > 0 ? (presentCount / totalSessions) * barW : 0;
    const apartW = totalSessions > 0 ? (apartCount / totalSessions) * barW : 0;
    const absentW = totalSessions > 0 ? (absentCount / totalSessions) * barW : 0;

    setFill(doc, 220, 220, 220);
    doc.roundedRect(margin, y, barW, 5, 1, 1, "F");
    setFill(doc, 22, 163, 74);
    doc.roundedRect(margin, y, presentW, 5, 1, 1, "F");
    setFill(doc, 234, 88, 12);
    doc.roundedRect(margin + presentW, y, apartW, 5, 1, 1, "F");
    y += 8;

    setTxt(doc, 22, 163, 74);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text(`● Presente: ${presentCount}`, margin, y);
    setTxt(doc, 234, 88, 12);
    doc.text(`● A parte: ${apartCount}`, margin + 40, y);
    setTxt(doc, 180, 60, 60);
    doc.text(`● Ausente: ${absentCount}`, margin + 80, y);
    y += 8;

    // Last 15 sessions
    const recentSessions = [...attendance].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
    setFill(doc, 139, 26, 43);
    doc.rect(margin, y, cW, 7, "F");
    setTxt(doc, 255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("Fecha", margin + 2, y + 5);
    doc.text("Estado", margin + 40, y + 5);
    doc.text("Motivo ausencia", margin + 80, y + 5);
    y += 7;

    recentSessions.forEach((a, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) {
        setFill(doc, 248, 248, 248);
        doc.rect(margin, y, cW, 7, "F");
      }
      const statusLabel = a.status === "present" || a.attended ? "Presente" : a.status === "apart" ? "A parte" : "Ausente";
      setTxt(doc, 40, 40, 40);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(a.date ? format(new Date(a.date), "dd/MM/yy") : "—", margin + 2, y + 5);
      doc.text(statusLabel, margin + 40, y + 5);
      doc.text(a.absence_reason || "—", margin + 80, y + 5);
      y += 7;
    });
  }

  // ── NOTAS TÁCTICAS PDI ──
  const latestPDI = pdiRecords.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  if (latestPDI) {
    if (y > 230) { doc.addPage(); y = 20; }
    y += 8;
    setTxt(doc, 139, 26, 43);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Evaluación PDI — Notas del Cuerpo Técnico", margin, y);
    y += 3;
    setDraw(doc, 139, 26, 43);
    doc.setLineWidth(0.4);
    doc.line(margin, y, margin + cW, y);
    y += 6;

    const periodLabel = latestPDI.period || format(new Date(latestPDI.date), "MMMM yyyy", { locale: es });
    setFill(doc, 248, 245, 245);
    doc.roundedRect(margin, y, cW, 10, 2, 2, "F");
    setTxt(doc, 139, 26, 43);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(periodLabel, margin + 4, y + 7);
    if (latestPDI.overall_rating) {
      setTxt(doc, 110, 110, 110);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Valoración global: ${latestPDI.overall_rating}/10`, margin + cW - 50, y + 7);
    }
    y += 14;

    const fields = [
      { key: "technical", label: "Técnica" },
      { key: "tactical", label: "Táctica" },
      { key: "physical", label: "Física" },
      { key: "mental", label: "Mental" },
      { key: "strengths", label: "Puntos fuertes" },
      { key: "areas_to_improve", label: "Áreas de mejora" },
      { key: "objectives", label: "Objetivos" },
    ];

    fields.forEach(({ key, label }) => {
      if (!latestPDI[key]) return;
      if (y > 265) { doc.addPage(); y = 20; }
      setTxt(doc, 139, 26, 43);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(label.toUpperCase(), margin, y);
      y += 4;
      setTxt(doc, 50, 50, 50);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      y = addWrappedText(doc, latestPDI[key], margin + 2, y, cW - 4, 5.5);
      y += 4;
    });
  }

  // ── NOTAS DE ENTRENADORES (SessionReports con notas) ──
  const relevantNotes = sessionReports.filter(r => r.tactical_notes || r.observations).slice(0, 8);
  if (relevantNotes.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    y += 8;
    setTxt(doc, 139, 26, 43);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Notas Tácticas de Sesiones", margin, y);
    y += 3;
    setDraw(doc, 139, 26, 43);
    doc.setLineWidth(0.4);
    doc.line(margin, y, margin + cW, y);
    y += 6;

    relevantNotes.forEach((r) => {
      if (y > 255) { doc.addPage(); y = 20; }
      setFill(doc, 248, 245, 245);
      doc.roundedRect(margin, y, cW, 8, 1.5, 1.5, "F");
      setTxt(doc, 110, 110, 110);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      const dateStr = r.date ? format(new Date(r.date), "d MMM yyyy", { locale: es }) : "—";
      doc.text(dateStr, margin + 4, y + 5.5);
      if (r.physical_load) {
        doc.text(`Carga: ${r.physical_load.replace(/_/g, " ")}`, margin + 40, y + 5.5);
      }
      y += 11;
      if (r.tactical_notes) {
        setTxt(doc, 139, 26, 43);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text("Notas tácticas:", margin + 2, y);
        y += 4;
        setTxt(doc, 50, 50, 50);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        y = addWrappedText(doc, r.tactical_notes, margin + 4, y, cW - 8, 5);
        y += 3;
      }
      if (r.observations) {
        setTxt(doc, 139, 26, 43);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text("Observaciones:", margin + 2, y);
        y += 4;
        setTxt(doc, 50, 50, 50);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        y = addWrappedText(doc, r.observations, margin + 4, y, cW - 8, 5);
        y += 3;
      }
      setDraw(doc, 220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, y, margin + cW, y);
      y += 5;
    });
  }

  // ── FOOTER ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    setFill(doc, 139, 26, 43);
    doc.rect(0, 289, W, 9, "F");
    setTxt(doc, 255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`RS Data Manager — Progresión Individual — ${player.first_name} ${player.last_name}`, margin, 294.5);
    doc.text(`Pág. ${p} / ${totalPages}`, W - margin - 16, 294.5);
  }

  const safeName = `${player.first_name}_${player.last_name}`.replace(/\s+/g, "_");
  doc.save(`Progresion_${safeName}.pdf`);
}