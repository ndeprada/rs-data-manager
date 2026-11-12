// Genera src/lib/darkColors.js: los colores claros (fondos) y oscuros (textos) escritos a mano en el código, para que el
// modo oscuro (src/lib/darkTheme.js) también los cambie cuando van en estilos en línea.
// Uso: node scripts/darkColors.mjs  (volver a pasarlo cuando se añadan colores nuevos a mano)
import fs from "node:fs";
import path from "node:path";
import { contrastRatio } from "../src/lib/brand.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SKIP = /(components\/(board|video)\/|lib\/(board|setPieceBoard|matchSheet|squadPlanPdf|squadPassesPdf|sessionPdf|darkColors|darkTheme|videoTags)|i18n\/)/;
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|mjs)$/.test(f) && !SKIP.test(p)) files.push(p); } };
walk(path.join(ROOT, "src"));

const expand = (h) => (h.length === 4 ? "#" + [...h.slice(1)].map((c) => c + c).join("") : h).toUpperCase();
const light = new Set(), dark = new Set();
const SURFACE = "#1E1819";
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/["'`]\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\s*["'`]/g)) {
    const h = expand(m[1]);
    if (contrastRatio(h, "#000000") >= 15) light.add(h); // muy claro: fondo
    if (contrastRatio(h, SURFACE) < 4.5) dark.add(h); // no se lee sobre el fondo oscuro: texto
  }
}
light.delete("#FFFFFF");
const out = `// Generado con scripts/darkColors.mjs: no editar a mano.\nexport const LIGHT_BGS = ${JSON.stringify([...light].sort())};\nexport const DARK_TEXTS = ${JSON.stringify([...dark].sort())};\n`;
fs.writeFileSync(path.join(ROOT, "src/lib/darkColors.js"), out);
console.log(`claros: ${light.size} · oscuros: ${dark.size} · archivos: ${files.length}`);
