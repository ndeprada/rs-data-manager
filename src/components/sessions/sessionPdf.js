// PDF de la hoja de sesión (02/11/2026): se fotografía la hoja (html2canvas) y se reparte en hojas A4 cortando
// siempre entre bloques (cabecera, jugadores, cada tarea…), nunca por la mitad de una tarea si cabe entera en una hoja.
// La lógica de los cortes es pura (pageBreaks) y se prueba en Node.

const A4_W = 210, A4_H = 297, MARGIN_X = 8, MARGIN_TOP = 8, MARGIN_BOTTOM = 12;

// Cortes de página: blocks = [{top, bottom}] en px (en orden), pageH = alto útil de una hoja en px.
// Devuelve las posiciones y donde empieza cada hoja (la primera es 0).
export function pageBreaks(blocks, pageH, total) {
  const starts = [0];
  let start = 0;
  for (const b of blocks) {
    if (b.bottom - start <= pageH) continue;
    // El bloque no cabe en lo que queda: empieza hoja nueva en su inicio (si eso adelanta algo)
    if (b.top > start) { start = b.top; starts.push(start); }
    // Si aun así no cabe (bloque más alto que una hoja), se corta por donde toque
    while (b.bottom - start > pageH) { start += pageH; starts.push(start); }
  }
  // Lo que quede al final (sin bloques) también tiene que caber
  while (total - start > pageH) { start += pageH; starts.push(start); }
  return starts;
}

export async function downloadSessionPdf(node, filename = "sesion.pdf") {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  // Esperar a que carguen las imágenes (escudo, dibujos) y las letras
  await Promise.all([...node.querySelectorAll("img")].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
  if (document.fonts?.ready) await document.fonts.ready;
  // Los dibujos de la pizarra se pasan a imagen antes: dentro de la captura los nombres de las fichas salían más pequeños
  await Promise.all([...node.querySelectorAll("svg")].map(async (svg) => {
    const r = svg.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return;
    const copy = svg.cloneNode(true);
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", String(Math.round(r.width * 3)));
    copy.setAttribute("height", String(Math.round(r.height * 3)));
    copy.removeAttribute("style");
    const img = new Image();
    img.style.cssText = `width:${r.width}px;height:${r.height}px;display:block`;
    await new Promise((res) => { img.onload = res; img.onerror = res; img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`; });
    if (img.naturalWidth) svg.replaceWith(img);
  }));
  const scale = 2;
  // html-to-image dibuja la hoja con el propio navegador (dentro de un SVG), así que sale igual que en pantalla
  // (html2canvas colocaba el texto unos píxeles más abajo). Si una imagen no se puede leer (escudo de otro dominio), sale en blanco.
  // Las imágenes que no han cargado (p. ej. el escudo sin conexión) se dejan fuera: si no, la captura se queda esperándolas
  const filter = (n) => !(n.tagName === "IMG" && !(n.complete && n.naturalWidth > 0));
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("La hoja ha tardado demasiado en prepararse")), 30000));
  const canvas = await Promise.race([
    toCanvas(node, { pixelRatio: scale, backgroundColor: "#ffffff", cacheBust: false, filter, imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" }),
    timeout,
  ]);
  const root = node.getBoundingClientRect();
  const blocks = [...node.querySelectorAll("[data-pdf-block]")].map((el) => {
    const r = el.getBoundingClientRect();
    return { top: (r.top - root.top) * scale, bottom: (r.bottom - root.top) * scale };
  }).sort((a, b) => a.top - b.top);
  const contentW = A4_W - 2 * MARGIN_X;
  const pxPerMm = canvas.width / contentW;
  const pageH = Math.floor((A4_H - MARGIN_TOP - MARGIN_BOTTOM) * pxPerMm);
  const starts = pageBreaks(blocks, pageH, canvas.height);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  starts.forEach((y0, i) => {
    const y1 = Math.min(canvas.height, i + 1 < starts.length ? starts[i + 1] : canvas.height, y0 + pageH);
    const h = Math.max(1, Math.round(y1 - y0));
    const part = document.createElement("canvas");
    part.width = canvas.width;
    part.height = h;
    const ctx = part.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, part.width, h);
    ctx.drawImage(canvas, 0, Math.round(y0), canvas.width, h, 0, 0, canvas.width, h);
    if (i) pdf.addPage();
    pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN_X, MARGIN_TOP, contentW, h / pxPerMm);
    pdf.setFontSize(7);
    pdf.setTextColor(150);
    pdf.text(`Página ${i + 1} de ${starts.length}`, A4_W - MARGIN_X, A4_H - 6, { align: "right" });
  });
  pdf.save(filename);
}
