// TEMPORAL (se borra tras el diagnóstico): misma sonda desde una función Edge fijada en París (cdg1).
import { runProbe, PROBE_KEY } from './_lib/fcfProbeCore.js';

export const config = { runtime: 'edge', regions: ['cdg1'] };

export default async function handler(request) {
  const k = new URL(request.url).searchParams.get('k');
  if (k !== PROBE_KEY) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ runtime: 'edge', ...(await runProbe()) }), { headers: { 'content-type': 'application/json' } });
}
