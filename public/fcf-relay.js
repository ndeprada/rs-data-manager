// «Actualizar desde la FCF» (07/11/2026). Lo carga el marcador «RS Manager · FCF» dentro de la web de la FCF.
// La FCF ya no deja que el servidor de la app lea su API (403 a todo lo que sale de Vercel/Amazon), pero sí el navegador que está en su web.
// Este programa hace de relevo: pregunta a la app qué le falta (?relay=sync y luego ?relay=standings), lo lee en la propia web de la FCF
// (mismo sitio: permitido), se lo entrega a la app (?relay=put) y vuelve a preguntar hasta que no falta nada. Enseña cómo va en un
// recuadro abajo a la derecha. Solo lee en la FCF (nunca escribe nada allí) y solo direcciones /api/ de fcf.cat.
// El marcador deja antes: window.__rsRelayApp (dirección de la app) y window.__rsRelayKey (llave personal, api/_lib/fcfRelayKey.js).
(function () {
  "use strict";
  var MAX_ROUND = 14;
  var WORKERS = 6;

  function chunkItems(items, maxBytes) {
    maxBytes = maxBytes || 1500000;
    var out = [], cur = [], size = 0;
    for (var i = 0; i < items.length; i++) {
      var n = JSON.stringify(items[i]).length;
      if (cur.length && size + n > maxBytes) { out.push(cur); cur = []; size = 0; }
      cur.push(items[i]); size += n;
    }
    if (cur.length) out.push(cur);
    return out;
  }

  /** Vueltas hasta que la app no echa nada en falta. post(mode, body) y fetchUrls(urls) se reciben de fuera (así se puede probar). */
  async function runRelay(deps) {
    var post = deps.post, fetchUrls = deps.fetchUrls, onStep = deps.onStep || function () {}, maxRounds = deps.maxRounds || MAX_ROUND;
    var failed = new Set();
    var result = { skipped: [] };
    var jobs = ["sync", "standings"];
    for (var j = 0; j < jobs.length; j++) {
      var job = jobs[j], last = "";
      for (var round = 1; ; round++) {
        onStep({ job: job, round: round, phase: "server" });
        var r = await post(job, { skip: Array.from(failed) });
        if (r && r.done) { result[job] = r.stats || {}; break; }
        var missing = ((r && r.missing) || []).filter(function (u) { return !failed.has(u); });
        if (!missing.length) throw new Error((r && r.error) || "La app no ha podido terminar");
        var key = missing.slice().sort().join("|");
        if (round > maxRounds || key === last) throw new Error("La FCF no termina de dar los datos. Vuelve a intentarlo en un rato.");
        last = key;
        onStep({ job: job, round: round, phase: "fcf", count: missing.length });
        var got = (await fetchUrls(missing)) || [];
        var items = [], seen = new Set();
        got.forEach(function (g) {
          if (!g || !g.url) return;
          seen.add(g.url);
          if (g.body !== undefined && g.body !== null && typeof g.body === "object") items.push({ url: g.url, body: g.body });
          else failed.add(g.url);
        });
        // Lo que la FCF no da ni al navegador (un acta que ya no existe, p. ej.) no se espera
        missing.forEach(function (u) { if (!seen.has(u)) failed.add(u); });
        if (!items.length && job === "sync" && round === 1) throw new Error("La FCF no ha devuelto datos.");
        onStep({ job: job, round: round, phase: "save", count: items.length });
        var chunks = chunkItems(items);
        for (var c = 0; c < chunks.length; c++) await post("put", { items: chunks[c] });
      }
    }
    result.skipped = Array.from(failed);
    return result;
  }

  // Para las pruebas (tests/fcfRelay.test.mjs): solo se exponen las piezas
  if (typeof window === "undefined" || window.__rsRelayTest) {
    var g = typeof globalThis !== "undefined" ? globalThis : window;
    g.__rsRelayLib = { runRelay: runRelay, chunkItems: chunkItems };
    return;
  }

  var APP = String(window.__rsRelayApp || "").replace(/\/+$/, "");
  var KEY = String(window.__rsRelayKey || "");
  if (!/(^|\.)fcf\.cat$/.test(location.hostname)) { alert("Abre www.fcf.cat y vuelve a pulsar «RS Manager · FCF»"); return; }
  if (window.__rsRelayRunning) return;
  window.__rsRelayRunning = true;

  // ── Recuadro ──────────────────────────────────────────────────────────────────────────────────────────────────────
  var box = document.getElementById("rs-relay-box");
  if (box) box.remove();
  box = document.createElement("div");
  box.id = "rs-relay-box";
  box.setAttribute("role", "status");
  box.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;width:320px;max-width:calc(100vw - 32px);"
    + "background:#fff;color:#1f1f1f;border:1px solid #E6DEDD;border-left:6px solid #73000A;border-radius:12px;"
    + "box-shadow:0 10px 30px rgba(0,0,0,.25);font:14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;padding:12px 14px";
  var head = document.createElement("div");
  head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:700;color:#73000A;margin-bottom:6px";
  head.textContent = "RS Manager · FCF";
  var close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", "Cerrar");
  close.style.cssText = "border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:#666;padding:0 2px";
  close.onclick = function () { box.remove(); };
  head.appendChild(close);
  var text = document.createElement("div");
  var bar = document.createElement("div");
  bar.style.cssText = "height:4px;background:#F5F2F1;border-radius:4px;margin-top:8px;overflow:hidden";
  var fill = document.createElement("div");
  fill.style.cssText = "height:100%;width:5%;background:#FF6E00;transition:width .4s";
  bar.appendChild(fill);
  box.appendChild(head); box.appendChild(text); box.appendChild(bar);
  document.body.appendChild(box);
  function show(msg, pct, tone) {
    text.textContent = msg;
    if (pct != null) fill.style.width = Math.max(5, Math.min(100, pct)) + "%";
    if (tone === "ok") { box.style.borderLeftColor = "#2E7D32"; fill.style.background = "#2E7D32"; }
    if (tone === "error") { box.style.borderLeftColor = "#C62828"; fill.style.background = "#C62828"; bar.style.display = "none"; }
  }

  // Sin llave (actualización programada): vale la de «Recordar este navegador», que el navegador manda solo (cookie de la app)
  if (!APP) { show("Este marcador está incompleto. Vuelve a crearlo en RS Manager (Equipos → Actualizar desde la FCF).", null, "error"); window.__rsRelayRunning = false; return; }

  // ── App y FCF ─────────────────────────────────────────────────────────────────────────────────────────────────────
  async function post(mode, body) {
    var headers = { "content-type": "application/json" };
    if (KEY) headers["x-rs-relay"] = KEY;
    var r = await fetch(APP + "/api/sync-fcf?relay=" + mode, {
      method: "POST", mode: "cors", credentials: KEY ? "omit" : "include",
      headers: headers,
      body: JSON.stringify(body || {}),
    });
    var j = {};
    try { j = await r.json(); } catch (e) { j = {}; }
    if (r.status === 401 && !KEY) throw new Error("Este navegador no está preparado. En RS Manager (Equipos → Actualizar desde la FCF), pulsa «Recordar este navegador».");
    if (r.status === 401) throw new Error("Este marcador ya no vale. Vuelve a crearlo en RS Manager (Equipos → Actualizar desde la FCF).");
    if (r.status === 403) throw new Error("Tu usuario de RS Manager no puede actualizar los datos de la FCF.");
    if (!r.ok) throw new Error(j.error || "Error " + r.status + " en RS Manager");
    return j;
  }
  function okUrl(u) {
    try { var x = new URL(u); return /(^|\.)fcf\.cat$/.test(x.hostname) && x.pathname.indexOf("/api/") === 0; } catch (e) { return false; }
  }
  async function fetchUrls(urls) {
    var q = urls.filter(okUrl), out = [], i = 0;
    async function worker() {
      while (i < q.length) {
        var u = q[i++];
        try {
          var x = new URL(u);
          var r = await fetch(x.pathname + x.search, { credentials: "same-origin", headers: { accept: "application/json, text/plain, */*" } });
          out.push(r.ok ? { url: u, body: await r.json() } : { url: u, status: r.status });
        } catch (e) { out.push({ url: u, error: String(e) }); }
      }
    }
    var ws = [];
    for (var k = 0; k < WORKERS; k++) ws.push(worker());
    await Promise.all(ws);
    return out;
  }

  var started = Date.now();
  show("Preguntando a RS Manager qué datos faltan…", 5);
  runRelay({
    post: post,
    fetchUrls: fetchUrls,
    onStep: function (s) {
      var base = s.job === "sync" ? 5 : 70, span = s.job === "sync" ? 60 : 25;
      var pct = base + span * (1 - 1 / (1 + (s.round - 1) * 0.6 + (s.phase === "save" ? 0.3 : 0)));
      var what = s.job === "sync" ? "Equipos, jugadores y partidos" : "Clasificaciones y rivales";
      if (s.phase === "fcf") show(what + ": leyendo " + s.count + " datos en la FCF… (vuelta " + s.round + ")", pct);
      else if (s.phase === "save") show(what + ": guardando " + s.count + " datos en RS Manager… (vuelta " + s.round + ")", pct);
      else show(what + ": preguntando qué falta… (vuelta " + s.round + ")", pct);
    },
  }).then(function (res) {
    var s = res.sync || {};
    var secs = Math.round((Date.now() - started) / 1000);
    show("Hecho en " + secs + " s. Partidos nuevos: " + (s.matches_created || 0) + " · actualizados: " + (s.matches_updated || 0)
      + " · jugadores nuevos: " + (s.players_created || 0) + ". Ya puedes cerrar esta pestaña.", 100, "ok");
    box.setAttribute("data-state", "done");
  }).catch(function (e) {
    show("No se pudo actualizar: " + ((e && e.message) || e), null, "error");
    box.setAttribute("data-state", "error");
  }).then(function () { window.__rsRelayRunning = false; });
})();
