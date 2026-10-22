// Descarga un fotograma de la pizarra como imagen PNG nítida (se pinta aparte, sin selección ni ayudas del editor).
export async function boardToPngBlob(node, { width = 1600 } = {}) {
  const [{ renderToStaticMarkup }] = await Promise.all([import("react-dom/server")]);
  const markup = renderToStaticMarkup(node);
  const vb = /viewBox="([^"]+)"/.exec(markup)?.[1].split(/\s+/).map(Number) || [0, 0, 1, 1];
  const height = Math.round((width * vb[3]) / vb[2]);
  const svg = markup.replace("<svg ", `<svg width="${width}" height="${height}" `);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("No se pudo preparar la imagen"));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear el PNG"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
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
