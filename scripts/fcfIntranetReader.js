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
// ── Puente con la app, envío por lotes y recorrido ──────────────────────────────────────────────────────────────────
const R = (window.__RUN ||= { status: 'idle', stop: false, log: [], stats: { actas: 0, saved: 0, errors: 0, groups: 0, skipped: 0 }, cards: {}, goalTypes: {}, current: '' });
const log = (m) => { R.log.push(`${new Date().toLocaleTimeString('es-ES')} ${m}`); if (R.log.length > 400) R.log.splice(0, R.log.length - 400); };
const APP = 'https://rs-dm.vercel.app';
window.addEventListener('message', (e) => {
  if (e.origin !== APP || !e.data) return;
  if (e.data.type === 'rs-fcf-ready') window.__bridgeReady = true;
  if (e.data.type === 'rs-fcf-ack') { const w = (window.__acks ||= {})[e.data.id]; if (w) { delete window.__acks[e.data.id]; w(e.data); } }
});
// Botón granate (abrir la ventana del puente necesita un clic de verdad)
if (!document.getElementById('rs-bridge-btn')) {
  const b = document.createElement('button');
  b.id = 'rs-bridge-btn';
  b.textContent = 'Abrir RS Manager (carga de actas)';
  b.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;background:#73000A;color:#fff;border:0;border-radius:8px;padding:14px 18px;font:600 15px Arial;cursor:pointer';
  b.onclick = () => { window.__bridgeReady = false; window.__bridge = window.open(`${APP}/FcfBridge`, 'rs-fcf-bridge'); };
  document.body.appendChild(b);
}
// Envía un lote y espera el acuse (60 s como máximo)
const send = (actas) => new Promise((resolve) => {
  const w = window.__bridge;
  if (!w || w.closed) { resolve({ ok: false, error: 'ventana cerrada' }); return; }
  const id = `b${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const t = setTimeout(() => { delete window.__acks[id]; resolve({ ok: false, error: 'timeout' }); }, 60000);
  (window.__acks ||= {})[id] = (d) => { clearTimeout(t); resolve(d); };
  w.postMessage({ type: 'rs-fcf-batch', id, actas }, APP);
});
// plan = [{ temp, season, tipo, scope: /regex de competiciones/, minDate?: 'aaaa-mm-dd', skipGroups?: { 'COMPETICIÓ': ['GRUP 1', …] } }]
// window.__L[season][competició][grup] = actas ya cargadas: sin minDate, el grupo se salta si ya tiene todas.
X.run = async (plan) => {
  R.status = 'running'; R.stop = false;
  const today = new Date().toISOString().slice(0, 10);
  for (const step of plan) {
    if (R.stop) break;
    const { temp, season, tipo, scope, minDate, skipGroups = {} } = step;
    let comps;
    try { comps = (await X.comps(temp, tipo)).filter((c) => scope.test(c.t)); } catch (e) { log('ERR comps ' + e); continue; }
    log(`${season} tipo${tipo}: ${comps.length} competiciones`);
    if (!comps.length) log('AVISO: ninguna competición (¿se ha cerrado la sesión de la intranet?)');
    for (const c of comps) {
      if (R.stop) break;
      let groups = [];
      try { groups = await X.groups(c.v); } catch (e) { log('ERR groups ' + c.t); continue; }
      for (const g of groups) {
        if (R.stop) break;
        if ((skipGroups[c.t] || []).includes(g.t)) { R.stats.skipped++; continue; }
        R.current = `${season} ${c.t} ${g.t}`;
        let jor = [];
        try { jor = (await X.jornadas(g.v)).map((j) => ({ ...j, n: +j.v, d: X.toISO(j.t) })).filter((j) => j.d && j.d <= today && (!minDate || j.d >= minDate)); } catch (e) { log('ERR jornadas ' + R.current); continue; }
        if (!jor.length) continue;
        const loaded = window.__L?.[season]?.[c.t]?.[g.t] || 0;
        if (!minDate && loaded) {
          const per = (await X.actaIds(temp, tipo, c.v, g.v, jor[0].v)).length || 1;
          if (loaded >= (jor.length - 1) * per) { R.stats.skipped++; continue; }
        }
        R.stats.groups++;
        let buf = [];
        for (const j of jor) {
          if (R.stop) break;
          let ids = [];
          try { ids = await X.actaIds(temp, tipo, c.v, g.v, j.v); } catch (e) { log('ERR jornada ' + j.v); continue; }
          for (const id of ids) {
            try {
              const a = X.parse(await X.dec(`/nfg/NPcd/NFG_CmpPartido?cod_primaria=1000128&CodActa=${id}&cod_acta=${id}`), id);
              if (!a.season || !a.competition || !a.players.length) continue;
              for (const k of a.cards) R.cards[k.src] = (R.cards[k.src] || 0) + 1;
              for (const k of a.goals) R.goalTypes[k.type] = (R.goalTypes[k.type] || 0) + 1;
              a.cards = a.cards.map(({ src, ...x }) => x);
              buf.push(a); R.stats.actas++;
            } catch (e) { R.stats.errors++; }
            await X.sleep(120);
            if (buf.length >= 20) { const r = await send(buf); buf = []; if (r.ok) R.stats.saved += r.saved || 0; else { R.stats.errors++; log('ERR envío ' + r.error); } }
          }
        }
        if (buf.length) { const r = await send(buf); if (r.ok) R.stats.saved += r.saved || 0; else { R.stats.errors++; log('ERR envío ' + r.error); } }
        log(`ok ${R.current}`);
      }
    }
  }
  R.status = R.stop ? 'stopped' : 'done';
  log('FIN');
};
