// Exportar la lista del personal: Excel (CSV que Excel abre directamente) e impresión. Sin dependencias.

const CELL_FORMULA = /^[=@\t\r]/;
const SIGNED_NUMBER_LIKE = /^[+-]?[\d\s().-]+$/;   // teléfonos y cifras: «+34 600 111 222», «-5»

/**
 * Celda de CSV segura: entre comillas si hace falta y sin que Excel la interprete como fórmula
 * (un nombre que empiece por «=» o «@» se guardaría como fórmula; «+34 600…» sí es un teléfono legítimo).
 */
export function csvCell(value) {
  let v = String(value ?? "");
  if (CELL_FORMULA.test(v) || (/^[+-]/.test(v) && !SIGNED_NUMBER_LIKE.test(v))) v = `'${v}`;
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV con «;» como separador (así lo abre Excel en español) y saltos de línea de Windows */
export function toCsv(header, rows) {
  return [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

export const exportFileName = (base, date = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${base}-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.csv`;
};

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Documento HTML listo para imprimir (A4 apaisado), con el escudo y la tipografía del club */
export function staffPrintHtml({ header, rows, title, subtitle, logoUrl, origin = "" }) {
  const head = header.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c) || "—"}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @font-face{font-family:'Racing Sarria';src:url('${origin}/fonts/RacingSarria.ttf') format('truetype')}
  @font-face{font-family:'IBM Plex Sans Condensed';font-weight:400;src:url('${origin}/fonts/IBMPlexSansCondensed-Regular.ttf') format('truetype')}
  @font-face{font-family:'IBM Plex Sans Condensed';font-weight:700;src:url('${origin}/fonts/IBMPlexSansCondensed-Bold.ttf') format('truetype')}
  @page{size:A4 landscape;margin:10mm} *{box-sizing:border-box}
  body{margin:0;font-family:'IBM Plex Sans Condensed',Arial,sans-serif;color:#222;font-size:9.5pt}
  header{display:flex;align-items:center;justify-content:space-between;border-bottom:.6mm solid #73000A;padding-bottom:2.5mm;margin-bottom:4mm}
  .club{display:flex;align-items:center;gap:3mm} .club img{height:13mm;width:auto}
  h1{margin:0;font-family:'Racing Sarria',sans-serif;font-weight:400;font-size:20pt;color:#73000A;text-transform:uppercase;letter-spacing:.3px;line-height:1}
  .sub{font-size:9.5pt;color:#FF6E00;font-weight:700;text-transform:uppercase;margin-top:1mm}
  .meta{font-size:8.5pt;color:#666;text-align:right}
  table{width:100%;border-collapse:collapse}
  th{background:#73000A;color:#fff;text-align:left;font-size:8pt;letter-spacing:.5px;text-transform:uppercase;padding:1.6mm 2mm}
  td{padding:1.5mm 2mm;border-bottom:.2mm solid #ddd;vertical-align:top}
  tr:nth-child(even) td{background:#f6f6f6} tr{break-inside:avoid;page-break-inside:avoid} thead{display:table-header-group}
  td:first-child{font-weight:700}
</style></head><body>
<header><div class="club">${logoUrl ? `<img src="${esc(logoUrl)}" alt="">` : ""}<div><h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div></div></div>
<div class="meta">${rows.length} persona${rows.length === 1 ? "" : "s"}</div></header>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

/** Descarga un CSV (con BOM para que Excel respete las tildes) */
export function downloadCsv(fileName, csv) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Imprime un documento HTML en un iframe oculto (sin tocar la pantalla de la app) */
export function printHtml(html, id = "staff-print-frame") {
  document.getElementById(id)?.remove();
  const fr = document.createElement("iframe");
  fr.id = id;
  fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(fr);
  const doc = fr.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const go = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { window.print(); } };
  const ready = fr.contentWindow.document.fonts?.ready || Promise.resolve();
  Promise.race([ready, new Promise((r) => setTimeout(r, 1800))]).then(() => setTimeout(go, 500));
}
