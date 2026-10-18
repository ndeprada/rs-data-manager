// Informe del rival de un partido de liga con datos públicos de la FCF (solo lectura):
// clasificación, racha, local/visitante, goleadores y claves automáticas.
import { query } from './db.js';
import { resolveGroup, getJson } from './fcfStandings.js';
import { prettyName } from './fcfSync.js';

const CREST = 'https://files.fcf.cat/escudos/clubes/escudos/';
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const tok = (s) => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean);
// Nombres de equipo como en el resto de la app (siglas en mayúsculas); nombres de persona en formato título
const title = (s) => prettyName(s);
const person = (s) => clean(s).toLowerCase().replace(/(^|[\s\-'’(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const crest = (l) => (l ? (String(l).startsWith('http') ? l : CREST + l) : null);
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

// Las clasificaciones, calendarios y goleadores se guardan 15 minutos para no cargar a la FCF en cada visita
const cache = new Map();
async function cached(key, fn, ttl = 15 * 60 * 1000) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}

// Similitud entre el nombre del rival escrito en el partido y el de la clasificación (por palabras)
function nameScore(a, b) {
  const A = new Set(tok(a)), B = new Set(tok(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / Math.max(A.size, B.size);
}

const resultOf = (gf, gc) => (gf > gc ? 'G' : gf < gc ? 'P' : 'E');

function record(list) {
  const r = { pj: list.length, g: 0, e: 0, p: 0, gf: 0, gc: 0 };
  for (const m of list) { r.gf += m.gf; r.gc += m.gc; if (m.result === 'G') r.g++; else if (m.result === 'E') r.e++; else r.p++; }
  return r;
}

const f1 = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

export function buildReport({ table, matches, scorers, ourCode, rivalCode, competition, group }) {
  const rows = table || [];
  const rivalRow = rows.find((r) => String(r.team?.teamId) === rivalCode);
  const ourRow = rows.find((r) => String(r.team?.teamId) === ourCode);
  if (!rivalRow) return { available: false, reason: 'rival' };

  const flat = Object.values(matches || {}).flat();
  const played = flat
    .filter((m) => num(m.GOLES_CASA) !== null && num(m.GOLES_FUERA) !== null)
    .map((m) => ({ m, date: m.COMIENZO1 || '', jornada: Number(m.JORNADA) || 0 }));

  // Partidos del rival, vistos desde el rival
  const view = (code) => played
    .filter(({ m }) => String(m.CODEQUIPO_CASA) === code || String(m.CODEQUIPO_FUERA) === code)
    .map(({ m, date, jornada }) => {
      const home = String(m.CODEQUIPO_CASA) === code;
      const gf = num(home ? m.GOLES_CASA : m.GOLES_FUERA), gc = num(home ? m.GOLES_FUERA : m.GOLES_CASA);
      return { date, jornada, home, gf, gc, result: resultOf(gf, gc), vs: title(home ? m.NOMBRE_FUERA : m.NOMBRE_CASA), vsCode: String(home ? m.CODEQUIPO_FUERA : m.CODEQUIPO_CASA) };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const rm = view(rivalCode);
  const form = rm.slice(-5).reverse().map((x) => ({ result: x.result, gf: x.gf, gc: x.gc, vs: x.vs, home: x.home, date: x.date }));
  const home = record(rm.filter((x) => x.home));
  const away = record(rm.filter((x) => !x.home));
  const cleanSheets = rm.filter((x) => x.gc === 0).length;

  const upcoming = flat
    .filter((m) => num(m.GOLES_CASA) === null && m.COMIENZO1 && (String(m.CODEQUIPO_CASA) === rivalCode || String(m.CODEQUIPO_FUERA) === rivalCode))
    .sort((a, b) => (a.COMIENZO1 < b.COMIENZO1 ? -1 : 1))
    .slice(0, 2)
    .map((m) => { const h = String(m.CODEQUIPO_CASA) === rivalCode; return { date: m.COMIENZO1, home: h, vs: title(h ? m.NOMBRE_FUERA : m.NOMBRE_CASA) }; });

  const h2h = rm.filter((x) => x.vsCode === ourCode).reverse().map((x) => ({ date: x.date, rivalHome: x.home, rivalGoals: x.gf, ourGoals: x.gc }));

  const sc = (scorers || []).filter((x) => String(x.codequipo) === rivalCode)
    .map((x) => { const [last, first] = String(x.nombre_jugador || '').split(','); return { name: person(`${first || ''} ${last || ''}`), goals: Number(x.goles) || 0 }; })
    .filter((x) => x.goals > 0).sort((a, b) => b.goals - a.goals);

  const pj = Number(rivalRow.played) || 0;
  const gf = Number(rivalRow.goalsFor) || 0, gc = Number(rivalRow.goalsAgainst) || 0;
  const rival = {
    code: rivalCode, name: title(rivalRow.team?.name), logo: crest(rivalRow.team?.logo), pos: Number(rivalRow.position), pts: Number(rivalRow.points),
    pj, g: rivalRow.won, e: rivalRow.drawn, p: rivalRow.lost, gf, gc,
  };
  const us = ourRow ? { pos: Number(ourRow.position), pts: Number(ourRow.points), pj: Number(ourRow.played) || 0, gf: Number(ourRow.goalsFor) || 0, gc: Number(ourRow.goalsAgainst) || 0 } : null;

  // ── Claves automáticas (solo con datos suficientes) ──
  const insights = [];
  if (form.length >= 3) {
    const wins = form.findIndex((x) => x.result !== 'G');
    const unbeaten = form.findIndex((x) => x.result === 'P');
    const winless = form.findIndex((x) => x.result === 'G');
    const run = (i) => (i === -1 ? form.length : i);
    if (run(wins) >= 3) insights.push(`Racha de ${run(wins)} victorias seguidas.`);
    else if (run(unbeaten) >= 3) insights.push(`Lleva ${run(unbeaten)} partidos sin perder.`);
    else if (run(winless) >= 3) insights.push(`Lleva ${run(winless)} partidos sin ganar.`);
  }
  if (pj >= 3) {
    const byGf = [...rows].sort((a, b) => Number(b.goalsFor) - Number(a.goalsFor)).findIndex((r) => String(r.team?.teamId) === rivalCode) + 1;
    const byGc = [...rows].sort((a, b) => Number(a.goalsAgainst) - Number(b.goalsAgainst)).findIndex((r) => String(r.team?.teamId) === rivalCode) + 1;
    if (byGf <= 3) insights.push(`Ataque nº ${byGf} del grupo: ${gf} goles (${f1(gf / pj)} por partido).`);
    else if (gf / pj < 1) insights.push(`Marca poco: ${f1(gf / pj)} goles por partido.`);
    if (byGc <= 3) insights.push(`Defensa nº ${byGc} del grupo: solo ${gc} goles encajados (${f1(gc / pj)} por partido).`);
    else if (gc / pj >= 2) insights.push(`Encaja mucho: ${f1(gc / pj)} goles por partido.`);
    if (cleanSheets >= Math.ceil(pj / 2)) insights.push(`Ha dejado la portería a cero en ${cleanSheets} de ${pj} partidos.`);
  }
  if (home.pj >= 2 && away.pj >= 2) {
    const ppg = (r) => (r.g * 3 + r.e) / r.pj;
    const d = ppg(home) - ppg(away);
    if (d >= 1) insights.push(`Mucho más fuerte en casa (${f1(ppg(home))} pts/partido) que fuera (${f1(ppg(away))}).`);
    else if (d <= -1) insights.push(`Rinde más fuera (${f1(ppg(away))} pts/partido) que en casa (${f1(ppg(home))}).`);
  }
  if (sc.length && gf >= 4 && sc[0].goals / gf >= 0.4) insights.push(`Depende de ${sc[0].name}: ${sc[0].goals} de sus ${gf} goles.`);
  if (h2h.length) {
    const x = h2h[0]; // el más reciente
    const verb = x.ourGoals > x.rivalGoals ? 'ganasteis' : x.ourGoals < x.rivalGoals ? 'perdisteis' : 'empatasteis';
    insights.push(`Ya os enfrentasteis: ${verb} ${x.ourGoals}-${x.rivalGoals} ${x.rivalHome ? 'jugando fuera' : 'en casa'}.`);
  }

  return {
    available: true, competition, group, updated: new Date().toISOString(),
    rival, us, form, home, away, cleanSheets, scorers: sc.slice(0, 3), next: upcoming, h2h, insights,
  };
}

export async function rivalReport(eventId) {
  const { rows } = await query(`select data from entities where id = $1 and entity_type = 'Event'`, [eventId]);
  const ev = rows[0]?.data;
  if (!ev?.team_id) return { available: false, reason: 'evento' };
  if (ev.type !== 'partido_liga') return { available: false, reason: 'no_liga' };
  const g = await resolveGroup(ev.team_id);
  if (g.notFound || !g.available) return { available: false, reason: 'sin_grupo' };
  const ourCode = String(g.team.fcf_team_code);
  const [matches, scorers] = await Promise.all([
    cached(`p:${g.grupId}`, () => getJson(`partidos?grupId=${g.grupId}`)),
    cached(`g:${g.grupId}`, () => getJson(`goleadores?grupId=${g.grupId}`).catch(() => [])),
  ]);

  // El rival se identifica por el acta de la FCF del partido; si no la tiene, por el nombre
  let rivalCode = null;
  const flat = Object.values(matches || {}).flat();
  const byActa = ev.fcf_acta && flat.find((m) => String(m.CODACTA) === String(ev.fcf_acta));
  if (byActa) rivalCode = String(byActa.CODEQUIPO_CASA) === ourCode ? String(byActa.CODEQUIPO_FUERA) : String(byActa.CODEQUIPO_CASA);
  if (!rivalCode && ev.opponent) {
    let best = 0;
    for (const r of g.table || []) {
      if (String(r.team?.teamId) === ourCode) continue;
      const sc = nameScore(ev.opponent, r.team?.name);
      if (sc > best) { best = sc; rivalCode = String(r.team?.teamId); }
    }
    if (best < 0.6) rivalCode = null;
  }
  if (!rivalCode) return { available: false, reason: 'rival' };
  return buildReport({ table: g.table, matches, scorers: Array.isArray(scorers) ? scorers : [], ourCode, rivalCode, competition: g.competition, group: g.group });
}
