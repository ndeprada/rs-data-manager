// PDF de la hoja de sesión (02/11/2026): la hoja ya viene repartida en páginas A4 (SessionSheet + packPages, nunca se
// parte una tarea); cada página se fotografía a 3× (html-to-image) y ocupa una hoja del PDF. Lógica pura probada en Node.

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

// Reparto de bloques en hojas (02/11/2026): blocks = [{ h, gap, stick }] (alto, separación hasta el siguiente y si debe ir
// pegado al siguiente, como el título de una parte); pageH = alto útil. Devuelve las hojas como listas de índices.
// Un bloque nunca se parte: si no cabe, pasa entero a la hoja siguiente (si ni así cabe, se queda solo en su hoja).
export function packPages(blocks, pageH) {
  const pages = [];
  let cur = [], used = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const gap = cur.length ? blocks[cur[cur.length - 1]].gap : 0;
    // un título pegado al siguiente bloque: tienen que caber los dos
    const need = b.h + (b.stick && blocks[i + 1] ? b.gap + blocks[i + 1].h : 0);
    if (cur.length && used + gap + need > pageH) { pages.push(cur); cur = []; used = 0; }
    used += (cur.length ? blocks[cur[cur.length - 1]].gap : 0) + b.h;
    cur.push(i);
  }
  if (cur.length) pages.push(cur);
  return pages.length ? pages : [[]];
}

// PDF: cada hoja (794 × 1123 px) se pinta con el propio navegador a 3 aumentos (≈ 290 ppp) y va a una página A4 entera
export async function downloadSessionPdf(pageNodes, filename = "sesion.pdf") {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  if (document.fonts?.ready) await document.fonts.ready;
  const filter = (n) => !(n.tagName === "IMG" && !(n.complete && n.naturalWidth > 0));
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  for (let i = 0; i < pageNodes.length; i++) {
    const node = pageNodes[i];
    await Promise.all([...node.querySelectorAll("img")].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("La hoja ha tardado demasiado en prepararse")), 40000));
    const canvas = await Promise.race([toCanvas(node, { pixelRatio: 3, backgroundColor: "#ffffff", cacheBust: false, filter }), timeout]);
    if (i) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297, undefined, "FAST");
  }
  pdf.save(filename);
}
