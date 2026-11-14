import { readClubBrand } from './clubBrand.js';
import { fullBrand } from '../../src/lib/brand.js';
import { squarePng, isPng } from './squareIcon.js';

// Icono de la app instalable (escudo blanco sobre granate, 512x512). Se sirve desde el mismo dominio para el manifiesto.
const ICON_URL = 'https://ec90o3jwukbsn8az.public.blob.vercel-storage.com/uploads/1792158857163-rs-icon-512-oh4DzwRE6HvWPDJcpmCgQctywEpuVT.png';

// Manifiesto de la app instalable con el nombre y los colores del club (/api/manifest)
async function manifest(res) {
  let b = fullBrand({});
  try { b = fullBrand(await readClubBrand()); } catch { /* sin base de datos: los de siempre */ }
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  const icon = (sizes, purpose) => ({ src: `/api/icon?s=${parseInt(sizes, 10)}${purpose === 'maskable' ? '&mask=1' : ''}`, sizes, type: 'image/png', purpose });
  res.status(200).send(JSON.stringify({
    name: b.appName, short_name: b.appName,
    description: `Gestión del ${b.clubName}: convocatorias, calendario, partidos y avisos.`,
    start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait',
    background_color: b.colors.primary, theme_color: b.colors.primary, lang: 'es',
    icons: [icon('192x192', 'any'), icon('512x512', 'any'), icon('512x512', 'maskable')],
  }));
}

// Lo ya hecho en esta función (se reutiliza mientras siga encendida): origen → bytes, y PNG cuadrados por tamaño
const cache = new Map();
const remember = (k, v) => { if (cache.size > 40) cache.delete(cache.keys().next().value); cache.set(k, v); return v; };

// GET /api/icon: el icono de la app SIEMPRE cuadrado y sin deformar (14/11/2026).
//   ?fav=1  icono de la pestaña del navegador: el icono de Configuración o, si no hay, el escudo; fondo transparente.
//   ?bg=1   fondo blanco (icono de la pantalla de inicio del iPhone: no admite transparencia).
//   ?mask=1 icono «maskable» de Android: fondo blanco y margen para el recorte en círculo.
//   ?s=n    tamaño en px (16–1024; 512 por defecto).
export default async function handler(req, res) {
  if (req.query?.m) return manifest(res);
  const q = req.query || {};
  const size = Math.max(16, Math.min(1024, parseInt(q.s, 10) || 512));
  const mask = q.mask === '1', fav = q.fav === '1', white = q.bg === '1' || mask;
  try {
    let brand = {};
    try { brand = await readClubBrand(); } catch { /* el de siempre */ }
    const src = (fav ? brand.icon || fullBrand(brand).logo : brand.icon) || ICON_URL;
    const key = `${src}|${size}|${mask}|${white}`;
    let out = cache.get(key);
    let type = 'image/png';
    if (!out) {
      let raw = cache.get(src);
      if (!raw) {
        const r = await fetch(src);
        if (!r.ok) throw new Error(`icon_${r.status}`);
        raw = remember(src, { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || 'image/png' });
      }
      if (isPng(raw.buf)) {
        try {
          out = remember(key, squarePng(raw.buf, size, { pad: mask ? 0.18 : white ? 0.08 : 0, bg: white ? [255, 255, 255] : null }));
        } catch { out = raw.buf; type = raw.type; }
      } else { out = raw.buf; type = raw.type; }
    }
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    res.status(200).send(out);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
