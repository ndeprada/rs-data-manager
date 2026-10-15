// Texto enriquecido (HTML de Quill) → PDF con jsPDF. También normaliza el texto plano antiguo.
const BASE_PX = 14;
export const FONT_FAMILIES = [
  { value: "IBM Plex Sans Condensed", label: "IBM Plex", pdf: "helvetica" },
  { value: "Arial", label: "Arial", pdf: "helvetica" },
  { value: "Georgia", label: "Georgia", pdf: "times" },
  { value: "Courier New", label: "Courier", pdf: "courier" },
];
const pdfFont = (css) => FONT_FAMILIES.find((f) => css && css.toLowerCase().includes(f.value.toLowerCase()))?.pdf || "helvetica";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function toHtml(value) {
  const v = value || "";
  if (/<(p|ul|ol|div|h\d|br)[\s>/]/i.test(v)) return v;
  return v.split("\n").map((l) => `<p>${l ? esc(l) : "<br>"}</p>`).join("");
}
export const isEmptyHtml = (value) => !(toHtml(value).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim());

function hexToRgb(c) {
  if (!c) return null;
  const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) return [+m[1], +m[2], +m[3]];
  const h = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!h) return null;
  const x = h[1].length === 3 ? h[1].replace(/./g, (d) => d + d) : h[1];
  return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
}

// → [{ align, list: null|"ul"|"ol", runs: [{ text, bold, color, px, font }] }]
export function parseBlocks(value) {
  const doc = new DOMParser().parseFromString(toHtml(value), "text/html");
  const blocks = [];
  const walk = (node, st, runs) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { if (n.textContent) runs.push({ ...st, text: n.textContent.replace(/ /g, " ") }); return; }
      if (n.nodeType !== 1) return;
      const t = n.tagName.toLowerCase();
      if (t === "br") return;
      const s = { ...st };
      if (t === "strong" || t === "b") s.bold = true;
      if (n.style) {
        if (n.style.color) s.color = hexToRgb(n.style.color) || s.color;
        if (n.style.fontSize) s.px = parseFloat(n.style.fontSize) || s.px;
        if (n.style.fontFamily) s.font = pdfFont(n.style.fontFamily);
        if (/bold|[6-9]00/.test(n.style.fontWeight || "")) s.bold = true;
      }
      walk(n, s, runs);
    });
  };
  const addBlock = (el, list) => {
    const runs = [];
    walk(el, { bold: false, color: null, px: BASE_PX, font: "helvetica" }, runs);
    const align = (el.style && el.style.textAlign) || "left";
    blocks.push({ align, list, runs });
  };
  doc.body.childNodes.forEach((n) => {
    if (n.nodeType === 3) { if (n.textContent.trim()) blocks.push({ align: "left", list: null, runs: [{ text: n.textContent, bold: false, color: null, px: BASE_PX, font: "helvetica" }] }); return; }
    const t = n.tagName.toLowerCase();
    if (t === "ul" || t === "ol") n.querySelectorAll(":scope > li").forEach((li) => addBlock(li, t));
    else addBlock(n, null);
  });
  return blocks;
}

const MM = 0.3528;
function layout(doc, blocks, w, scale, base) {
  const lines = [];
  let num = 0;
  blocks.forEach((b) => {
    if (b.list === "ol") num += 1; else num = 0;
    const indent = b.list ? 5 : 0;
    const maxW = w - indent;
    const toks = [];
    b.runs.forEach((r) => r.text.split(/(\s+)/).filter(Boolean).forEach((t) => toks.push({ ...r, text: t, size: base * scale * (r.px / BASE_PX) })));
    const defSize = base * scale;
    let cur = [], cw = 0, first = true;
    const push = () => {
      while (cur.length && /^\s+$/.test(cur[cur.length - 1].text)) cur.pop();
      const size = cur.reduce((m, t) => Math.max(m, t.size), defSize);
      const width = cur.reduce((s, t) => s + t.w, 0);
      lines.push({ toks: cur, size, width, align: b.align, indent, marker: first && b.list ? (b.list === "ol" ? `${num}.` : "•") : null, markerSize: cur[0]?.size || defSize });
      first = false; cur = []; cw = 0;
    };
    toks.forEach((t) => {
      doc.setFont(t.font, t.bold ? "bold" : "normal"); doc.setFontSize(t.size);
      t.w = doc.getTextWidth(t.text);
      const space = /^\s+$/.test(t.text);
      if (space && !cur.length) return;
      if (!space && cur.length && cw + t.w > maxW) push();
      cur.push(t); cw += t.w;
    });
    if (cur.length || first) push();
  });
  lines.forEach((l) => { l.h = l.size * MM * 1.3; });
  return lines;
}

// Dibuja el HTML dentro de la caja (x, y, w, h), reduciendo el tamaño si no cabe
export function drawRichText(doc, value, x, y, w, h, { base = 10.5, minScale = 0.6 } = {}) {
  if (isEmptyHtml(value)) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(170, 170, 170);
    doc.text("Sin anotaciones.", x, y + 5);
    return;
  }
  const blocks = parseBlocks(value);
  let scale = 1, lines;
  for (; scale >= minScale - 1e-6; scale -= 0.05) {
    lines = layout(doc, blocks, w, scale, base);
    if (lines.reduce((s, l) => s + l.h, 0) <= h) break;
  }
  let cy = y, cut = false;
  for (const l of lines) {
    if (cy + l.h > y + h + 0.5) { cut = true; break; }
    const baseline = cy + l.size * MM * 1.05;
    const avail = w - l.indent;
    let sx = x + l.indent;
    if (l.align === "center") sx += (avail - l.width) / 2;
    else if (l.align === "right") sx += avail - l.width;
    if (l.marker) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(l.markerSize); doc.setTextColor(40, 40, 40);
      doc.text(l.marker, x + (l.marker === "•" ? 1.2 : 0), baseline);
    }
    let tx = sx;
    const extra = l.align === "justify" && l.toks.length > 1 ? Math.max(0, (avail - l.width)) / Math.max(1, l.toks.filter((t) => /^\s+$/.test(t.text)).length) : 0;
    l.toks.forEach((t) => {
      doc.setFont(t.font, t.bold ? "bold" : "normal"); doc.setFontSize(t.size);
      const c = t.color || [40, 40, 40]; doc.setTextColor(c[0], c[1], c[2]);
      doc.text(t.text, tx, baseline);
      tx += t.w + (extra && /^\s+$/.test(t.text) ? extra : 0);
    });
    cy += l.h;
  }
  if (cut) { doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.text("… (texto recortado, reduce las anotaciones para que quepa)", x, y + h + 2); }
}
