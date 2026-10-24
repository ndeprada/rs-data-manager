// TEMPORAL (se borra tras el diagnóstico): sonda desde el servidor normal (Node).
import { runProbe, PROBE_KEY } from './_lib/fcfProbeCore.js';

export default async function handler(req, res) {
  if (req.query?.k !== PROBE_KEY) return res.status(404).json({ error: 'not_found' });
  res.status(200).json({ runtime: 'node', ...(await runProbe()) });
}
