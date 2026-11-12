import { readClubBrand } from './clubBrand.js';
import { fullBrand } from '../../src/lib/brand.js';

// Icono de la app instalable (escudo blanco sobre granate, 512x512). Se sirve desde el mismo dominio para el manifiesto.
const ICON_URL = 'https://ec90o3jwukbsn8az.public.blob.vercel-storage.com/uploads/1792158857163-rs-icon-512-oh4DzwRE6HvWPDJcpmCgQctywEpuVT.png';

// Manifiesto de la app instalable con el nombre y los colores del club (/api/manifest)
async function manifest(res) {
  let b = fullBrand({});
  try { b = fullBrand(await readClubBrand()); } catch { /* sin base de datos: los de siempre */ }
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  const icon = (sizes, purpose) => ({ src: '/api/icon', sizes, type: 'image/png', purpose });
  res.status(200).send(JSON.stringify({
    name: b.appName, short_name: b.appName,
    description: `Gestión del ${b.clubName}: convocatorias, calendario, partidos y avisos.`,
    start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait',
    background_color: b.colors.primary, theme_color: b.colors.primary, lang: 'es',
    icons: [icon('192x192', 'any'), icon('512x512', 'any'), icon('512x512', 'maskable')],
  }));
}

export default async function handler(req, res) {
  if (req.query?.m) return manifest(res);
  try {
    let src = ICON_URL;
    try { src = (await readClubBrand()).icon || ICON_URL; } catch { /* el de siempre */ }
    const r = await fetch(src);
    if (!r.ok) throw new Error(`icon_${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
