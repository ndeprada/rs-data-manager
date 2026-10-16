// Icono de la app instalable (escudo blanco sobre granate, 512x512). Se sirve desde el mismo dominio para el manifiesto.
const ICON_URL = 'https://ec90o3jwukbsn8az.public.blob.vercel-storage.com/uploads/1792158857163-rs-icon-512-oh4DzwRE6HvWPDJcpmCgQctywEpuVT.png';

export default async function handler(req, res) {
  try {
    const r = await fetch(ICON_URL);
    if (!r.ok) throw new Error(`icon_${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
