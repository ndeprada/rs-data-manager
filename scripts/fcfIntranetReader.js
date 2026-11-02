// Lector de actas de la intranet de la FCF (SOLO LECTURA). No lo usa la app: se pega en la consola (o con la herramienta de
// JavaScript del navegador) en https://intranet.fcf.cat/nfg/NPcd/NFG_CmpJornada?cod_primaria=1000128 con la sesión del club.
// 1) Pega este archivo. 2) Pulsa el botón granate «Abrir RS Manager (carga de actas)» (el navegador solo deja abrir la ventana
// con un clic): abre https://rs-dm.vercel.app/FcfBridge, que guarda lo que llega con la sesión de quien está conectado.
// 3) FCFX.run(plan) con el plan (ver abajo). Progreso en window.__RUN; para parar: __RUN.stop = true.
// Una petición cada vez, con una pausa de 120 ms entre actas. Las actas repetidas se sustituyen (no se duplican).
window.FCFX = {
  dec: async (u) => new TextDecoder('iso-8859-15').decode(await (await fetch(u, { credentials: 'include' })).arrayBuffer()),
  opts: (t) => [...t.matchAll(/<option value='(\d+)'[^>]*>([^<]*)</g)].map((m) => ({ v: m[1], t: m[2].replace(/\s+/g, ' ').trim() })).filter((o) => o.v !== '0'),
  arr: (t) => { const m = /new Array\(([^)]*)\)/.exec(t); if (!m) return []; const a = [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]); const out = []; for (let i = 0; i + 1 < a.length; i += 2) if (a[i] !== '0') out.push({ v: a[i], t: a[i + 1].trim() }); return out; },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  toISO: (d) => { const m = /(\d{2})-(\d{2})-(\d{4})/.exec(d || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; },
  norm: (s) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim(),
  // Delegació Barcelona (100). temp: 22 = 2026-27, 21 = 2025-26, 20 = 2024-25… tipo: 1 = F11, 2 = F7
  SCOPE11: /^(DIVISIÓ HONOR (CADET|INFANTIL)|PREFERENT (CADET|INFANTIL|JUVENILS)|(CADET|INFANTIL|JUVENIL) (PRIMERA|SEGONA) DIVISIÓ|LLIGA NACIONAL JUVENIL)( S\d+)?$/,
  SCOPE7: /^(PREFERENT|PRIMERA DIVISIÓ|SEGONA DIVISIÓ|TERCERA DIVISIÓ) (ALEVÍ|BENJAMÍ)( S\d+)?$/,
};
const X = window.FCFX;
X.comps = async (temp, tipo) => X.opts(await X.dec(`/nfg/NPcd/NFG_CmpJornada_Exec?cod_primaria=1000128&codtemporada=${temp}&cod_agrupacion=1&Sch_Codigo_Delegacion=100&Sch_Tipo_Juego=${tipo}`));
X.groups = async (comp) => X.arr(await X.dec(`/nfg/NPcd/NFG_CmpJornada_Exec?cod_primaria=1000128&codcompeticion=${comp}&Sch_Codigo_Delegacion=100&cod_agrupacion=1`));
X.jornadas = async (grp) => X.arr(await X.dec(`/nfg/NPcd/NFG_CmpJornada_Exec?cod_primaria=1000128&codgrupo=${grp}&cod_agrupacion=1`));
X.actaIds = async (temp, tipo, comp, grp, jor) => [...new Set([...(await X.dec(`/nfg/NPcd/NFG_CmpJornada?cod_primaria=1000128&CodCompeticion=${comp}&CodGrupo=${grp}&CodTemporada=${temp}&CodJornada=${jor}&cod_agrupacion=1&Sch_Codigo_Delegacion=100&Sch_Tipo_Juego=${tipo}`)).matchAll(/CodActa=(\d+)/g)].map((m) => m[1]))];
// Ficha del partido (NFG_CmpPartido) → acta en el formato de api/_lib/fcfDb.js (actaRows)
X.parse = (html, id) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript').forEach((n) => n.remove());
  const N = X.norm;
  const sec = (title) => { const sp = [...doc.querySelectorAll('span')].find((x) => N(x.textContent) === title); return sp ? sp.closest('td') : null; };
  const goals = [];
  const gt = sec('GOLS');
  if (gt) for (const tr of gt.querySelectorAll('tr')) { const a = tr.querySelector('a.lgol, a[class*=gol]'); const tds = tr.querySelectorAll('td'); if (!a || tds.length < 2) continue; goals.push({ type: N(a.getAttribute('title')) || 'Gol', name: N(tds[1].textContent).replace(/\(\s*\d+[^)]*\)\s*$/, '').trim() }); }
  const cards = [];
  const ct = sec('TARGETES');
  // tarj_amar.gif = amarilla, tarj_roja.gif = roja (la doble amarilla, si tiene imagen propia, por su nombre)
  if (ct) for (const tr of ct.querySelectorAll('tr')) { const img = tr.querySelector('img'); const tds = tr.querySelectorAll('td'); if (!img || tds.length < 2) continue; const src = (img.getAttribute('src') || '').toLowerCase(); if (!/tarj/.test(src)) continue; const type = /roj|verm/.test(src) ? 'R' : /dob|2|seg/.test(src.replace(/.*tarj/, '')) ? '2A' : 'A'; cards.push({ type, src: src.split('/').pop(), name: N(tds[1].textContent).replace(/\(\s*\d+[^)]*\)\s*$/, '').trim() }); }
  doc.querySelectorAll('a').forEach((x) => { const m = /jugador=(\d+)/.exec(x.getAttribute('href') || ''); if (m) x.textContent = '\n[P' + m[1] + ' ' + N(x.textContent) + ']\n'; });
  doc.querySelectorAll('img').forEach((x) => x.replaceWith(doc.createTextNode('\n{img}\n')));
  const lines = (doc.body.textContent || '').split('\n').map(N).filter(Boolean);
  const L = lines.slice(lines.findIndex((l) => l === 'Fitxa de Partit'));
  const all = L.join(' ');
  const season = (/Temporada (\d{4}-\d{4})/.exec(all) || [])[1];
  const date = (/Data: (\d{2}-\d{2}-\d{4})/.exec(all) || [])[1];
  const cg = L.map((l) => /^(.*) \(([^()]*)\) Jornada (\d+)$/.exec(l)).find(Boolean);
  const players = [], teams = [];
  let team = null, tit = null, dorsal = '';
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    if (l === 'Titulars:') { let k = i - 1; while (k > 0 && L[k] === '{img}') k--; team = L[k]; teams.push(team); tit = true; continue; }
    if (l === 'Suplents:') { tit = false; continue; }
    if (/^COS T/.test(l)) { tit = null; continue; }
    if (tit === null) continue;
    if (/^\d{1,3}$/.test(l)) { dorsal = l; continue; }
    const m = /^\[P(\d+) (.*)\]$/.exec(l);
    if (m) { players.push({ id: m[1], name: m[2], team, tit, dorsal }); dorsal = ''; }
  }
  const byName = new Map(); for (const p of players) if (!byName.has(p.name.toUpperCase())) byName.set(p.name.toUpperCase(), p.id);
  const idOf = (n) => byName.get(n.toUpperCase()) || null;
  return { acta: String(id), season, competition: cg && cg[1], group: cg && cg[2], jornada: cg && +cg[3], date, teams, players,
    goals: goals.map((g) => ({ id: idOf(g.name), name: g.name, type: g.type })), cards: cards.map((c) => ({ id: idOf(c.name), name: c.name, type: c.type, src: c.src })) };
};
// El resto (botón del puente, envío por lotes de 20 con acuse y FCFX.run(plan) con plan = [{temp, season, tipo, scope, minDate?}])
// está en CLAUDE.md, «Carga de actas de la intranet (02/11/2026)».
