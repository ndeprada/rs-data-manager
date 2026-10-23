// Descarga de un fotograma de la pizarra como imagen PNG nítida (se pinta aparte, sin selección ni ayudas del editor).

// SVG (texto) → imagen lista para pintar en un canvas
export function loadSvgImage(svg) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => { URL.revokeObjectURL(url); resolve(i); };
    i.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo preparar la imagen")); };
    i.src = url;
  });
}

// Texto SVG de un elemento de la pizarra con el tamaño final puesto; devuelve también ese tamaño
export async function boardSvgMarkup(node, width) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(node);
  const vb = /viewBox="([^"]+)"/.exec(markup)?.[1].split(/\s+/).map(Number) || [0, 0, 1, 1];
  const height = Math.round((width * vb[3]) / vb[2]);
  return { svg: markup.replace("<svg ", `<svg width="${width}" height="${height}" `), width, height };
}

export async function boardToPngBlob(node, { width = 1600 } = {}) {
  const { svg, height } = await boardSvgMarkup(node, width);
  const img = await loadSvgImage(svg);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear el PNG"))), "image/png"));
}

export function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
