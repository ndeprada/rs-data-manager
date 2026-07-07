import jsPDF from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function setFill(doc, r, g, b) { doc.setFillColor(r, g, b); }
function setDraw(doc, r, g, b) { doc.setDrawColor(r, g, b); }
function setTxt(doc, r, g, b) { doc.setTextColor(r, g, b); }

function addWrappedText(doc, text, x, y, maxWidth, lineHeight) {
  const lh = lineHeight || 5.5;
  const lines = doc.splitTextToSize(text || "", maxWidth);
  lines.forEach(function(line, i) { doc.text(line, x, y + i * lh); });
  return y + lines.length * lh;
}

export function generatePDF(data) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const margin = 18;
  const cW = W - margin * 2;
  let y = 0;

  // Header band
  setFill(doc, 139, 26, 43);
  doc.rect(0, 0, W, 36, "F");
  setTxt(doc, 255, 255, 255);
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.text("Informe Ejecutivo", margin, 15);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(
    data.scope + "  ·  " + format(new Date(data.generatedAt), "d MMMM yyyy", { locale: es }),
    margin, 23
  );

  y = 46;

  // Executive Summary
  setTxt(doc, 139, 26, 43);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Resumen Ejecutivo", margin, y);
  y += 4;
  setDraw(doc, 139, 26, 43);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + cW, y);
  y += 6;

  setTxt(doc, 30, 30, 30);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  y = addWrappedText(doc, data.executiveSummary, margin, y, cW);
  y += 10;

  // Teams
  data.teams.forEach(function(team) {
    if (y > 242) { doc.addPage(); y = 20; }

    // Team header bar
    setFill(doc, 139, 26, 43);
    doc.roundedRect(margin, y, cW, 14, 2, 2, "F");
    setTxt(doc, 255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(team.name, margin + 4, y + 6);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(
      team.category + "  ·  Entrenador: " + team.coach + "  ·  " + team.season,
      margin + 4, y + 12
    );
    y += 19;

    const stats = [
      { label: "Jugadores", val: team.playerCount + "  (" + team.activePlayers + " activos)" },
      { label: "Partidos Jugados", val: String(team.matchesPlayed || "—") },
      { label: "Goles / Asistencias", val: team.totalGoals + " / " + team.totalAssists },
      { label: "Asistencia entrenos", val: team.attendanceRate != null ? team.attendanceRate + "%" : "—" },
      { label: "Valoración media", val: team.avgRating ? team.avgRating + "/10" : "—" },
      { label: "Tarjetas Amarillas / Rojas", val: team.totalYellow + " / " + team.totalRed },
    ];

    const boxW = (cW - 4) / 2;
    stats.forEach(function(s, i) {
      const col = i % 2;
      const bx = margin + col * (boxW + 4);
      const sy = y;

      setFill(doc, 248, 248, 248);
      doc.roundedRect(bx, sy, boxW, 13, 1.5, 1.5, "F");
      setDraw(doc, 220, 220, 220);
      doc.setLineWidth(0.25);
      doc.roundedRect(bx, sy, boxW, 13, 1.5, 1.5, "S");

      setTxt(doc, 100, 100, 100);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(s.label, bx + 4, sy + 5.5);

      setTxt(doc, 30, 30, 30);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(s.val, bx + 4, sy + 10.5);

      if (col === 1) y += 17;
    });
    if (stats.length % 2 !== 0) y += 17;
    y += 4;

    // Top scorers
    if (team.topScorers && team.topScorers.length > 0) {
      if (y > 255) { doc.addPage(); y = 20; }

      setTxt(doc, 100, 100, 100);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Màxims Golejadors", margin, y);
      y += 5;

      team.topScorers.forEach(function(scorer, idx) {
        const cx = margin + 3;
        const cy = y - 0.5;
        if (idx === 0) {
          setFill(doc, 139, 26, 43);
        } else {
          setFill(doc, 160, 160, 160);
        }
        doc.circle(cx, cy, 2.8, "F");

        setTxt(doc, 255, 255, 255);
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.text(String(idx + 1), cx - 0.8, cy + 1);

        setTxt(doc, 30, 30, 30);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.text(scorer.name, margin + 9, y + 0.8);

        setTxt(doc, 100, 100, 100);
        doc.setFontSize(8);
        doc.text(scorer.goals + " gols · " + scorer.assists + " assist.", margin + 85, y + 0.8);
        y += 7;
      });
      y += 3;
    }

    y += 8;
  });

  // Footer on all pages
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    setFill(doc, 139, 26, 43);
    doc.rect(0, 289, W, 9, "F");
    setTxt(doc, 255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("RS Data Manager — Informe Confidencial", margin, 294.5);
    doc.text("Pàgina " + p + " / " + total, W - margin - 20, 294.5);
  }

  doc.save("informe_" + format(new Date(), "yyyy-MM-dd") + ".pdf");
}