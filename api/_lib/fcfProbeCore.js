// TEMPORAL: comprueba desde producción, con las funciones REALES de la app, cada tipo de consulta a la FCF. Solo devuelve códigos y recuentos. Se borra tras verificar.
import { getJson as compJson } from './fcfStandings.js';
import { getFcfJson, CLUB_CODE } from './fcfSync.js';

export const PROBE_KEY = 'fd7591455b3a52d8';
const sum = (v) => (Array.isArray(v) ? `array(${v.length})` : v && typeof v === 'object' ? `objeto{${Object.keys(v).slice(0, 6).join(',')}}` : typeof v);

async function step(out, name, fn) {
  const t0 = Date.now();
  try { const v = await fn(); out[name] = { ok: true, ms: Date.now() - t0, info: sum(v) }; return v; }
  catch (e) { out[name] = { ok: false, ms: Date.now() - t0, error: String(e.message || e).slice(0, 160) }; return null; }
}

export async function runProbe() {
  const out = {};
  const base = `https://www.fcf.cat/api/clubs/${CLUB_CODE}`;
  const club = await step(out, '1 club (sincronización)', () => getFcfJson(base));
  const code = club?.teams?.[0]?.codequipo;
  const detail = code ? await step(out, '2 equipo del club (sincronización)', () => getFcfJson(`${base}/team/${code}`)) : null;
  const acta = detail ? (JSON.stringify(detail).match(/"CODACTA":"?(\d+)/) || [])[1] : null;
  if (acta) await step(out, '3 acta (sincronización)', () => getFcfJson(`https://www.fcf.cat/api/acta/${acta}`));
  else out['3 acta (sincronización)'] = { ok: null, info: 'sin acta en el primer equipo' };
  await step(out, '4 temporadas (clasificaciones)', () => compJson('temporadas'));
  const dis = await step(out, '5 disciplinas', () => compJson('disciplines'));
  const temp = (await compJson('temporadas').catch(() => []))?.[0]?.value;
  const comps = dis?.[0] && temp ? await step(out, '6 competiciones', () => compJson(`competicions?disciplinaId=${dis[0].value}&temporada=${temp}`)) : null;
  const grupos = comps?.[0] ? await step(out, '7 grupos', () => compJson(`grupos?competicioId=${comps[0].value}`)) : null;
  const g = grupos?.[0]?.value;
  if (g) {
    await step(out, '8 clasificación', () => compJson(`classificacio?grupId=${g}`));
    await step(out, '9 partidos (informe de rival)', () => compJson(`partidos?grupId=${g}`));
    await step(out, '10 goleadores (informe de rival)', () => compJson(`goleadores?grupId=${g}`));
  }
  return { region: process.env.VERCEL_REGION || null, results: out };
}
