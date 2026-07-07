import { put } from '@vercel/blob';
import { requireUser } from './_lib/auth.js';

export const config = {
  api: {
    bodyParser: { sizeLimit: '15mb' },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const { filename, contentType, base64 } = req.body || {};
    if (!filename || !base64) {
      res.status(400).json({ error: 'filename_and_base64_required' });
      return;
    }
    const buffer = Buffer.from(base64, 'base64');
    const blob = await put(`uploads/${Date.now()}-${filename}`, buffer, {
      access: 'public',
      contentType: contentType || 'application/octet-stream',
    });
    res.status(200).json({ file_url: blob.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'upload_failed', message: err.message });
  }
}
