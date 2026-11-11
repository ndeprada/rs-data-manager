// Análisis de vídeo (RS Video): etiquetar un partido, playlist de clips y editor con dibujos,
// congelados, seguimiento automático de jugadores y exportación a MP4.
// Es JavaScript normal (sin React) para poder usar el mismo código dentro de RS Manager y como página suelta:
//   const app = mountRSVideo(elemento, { storagePrefix })  →  app.destroy()
// El vídeo nunca sale del ordenador: se abre como archivo local y lo exportado se descarga.
import { RATES, stepRate, RESERVED_KEYS, newTag, defaultSets, cleanSet, duplicateKeys, uniqueName, duplicateSet, exportSets, importSets, restoreSets, isDefaultSet, setPayload, syncPlan, sortSets } from "../../lib/videoTags.js";
import { clipLen, mapL, freezeStartL, localOfVideo, kfOffset, ptsAt, visibleAt as visible, smoothTrack, samplesToLocal, spliceKeys, nudgeTrack } from "../../lib/videoTimeline.js";
import { createTracker, bodyBox } from "../../lib/videoTracker.js";
import { PITCH_TYPES, MARKS, pitchOf, landmarks, pitchLines, markLines, solveCal, toImage, toGround, groundDist, circleImg, groundRectImg, lineImg, calQuality, fmtM } from "../../lib/videoPitch.js";
const MIN_CLIP = 0.5; // segundos: corte más corto
const TRACK_SMOOTH = 0.15;
const FIX_WIN = 0.6; // segundos antes y después que se mueven al corregir un seguimiento a mano // segundos: suavizado del seguimiento (quita el balanceo de cada zancada)

const PALETTE = ["#ffffff", "#FF6E00", "#ffd400", "#e5484d", "#2fbf71", "#3ec7ff", "#73000A", "#111111"];
const TRACKABLE = ["ring", "spot", "ellipse", "mag", "poly", "zone"];
const MULTI = ["poly", "zone"];
const GROUND_TYPES = ["ellipse", "spot", "ring", "rect", "measure"]; // con el campo calibrado se dibujan sobre el césped
const GROUND_R = { ring: 1.2, spot: 1, ellipse: 5 }; // metros, al tocar sin arrastrar

const TEMPLATE = `
<header>
  <div class="brand">RS <span>VIDEO</span></div>
  <div class="seg" data-id="modeSeg"><button data-m="tag" class="on">1 · Etiquetar</button><button data-m="edit">2 · Editor</button></div>
  <div class="file" id="rsvFileName">Sin vídeo</div>
  <div class="sp"></div>
  <button id="rsvOpen">Abrir vídeo</button>
  <button id="rsvSaveProj" title="Guardar etiquetas y dibujos en un archivo">Guardar proyecto</button>
  <button id="rsvLoadProj">Cargar proyecto</button>
  <button id="rsvExt" title="Abre el vídeo en otra ventana para llevarla al monitor o al proyector">🖥 Otra pantalla</button>
  <button id="rsvFull" title="Pantalla completa">⛶</button>
  <input type="file" id="rsvFileIn" accept="video/*" hidden>
  <input type="file" id="rsvProjIn" accept=".json,application/json" hidden>
  <input type="file" id="rsvSetIn" accept=".json,application/json" hidden>
</header>
<main>
  <section class="view on" id="tagView">
    <aside class="tagDock" id="tagDock"></aside>
    <div class="left">
      <div class="stage" id="rsvTagStage">
        <video id="rsvVid" playsinline muted preload="auto"></video>
        <div class="drop" id="rsvDrop">
          <div class="big">Arrastra aquí el vídeo del partido</div>
          <div>MP4 descargado de Veo u otra cámara · el vídeo no se sube a ningún sitio, se queda en tu ordenador</div>
          <button class="pri" id="rsvOpen2">Elegir archivo</button>
        </div>
      </div>
      <div class="transport">
        <button id="tPlay" title="Espacio">▶</button>
        <button id="tBack" title="← 2 s · Mayús+← 10 s">⟲ 2s</button>
        <button id="tFwd" title="→ 2 s · Mayús+→ 10 s">2s ⟳</button>
        <button id="tFrameB" title=", fotograma atrás">◂|</button>
        <button id="tFrameF" title=". fotograma adelante">|▸</button>
        <span class="rate" title="Velocidad · flechas ↑ ↓"><select id="tRate"></select></span>
        <div class="time" id="tTime"><b>00:00</b> / 00:00</div>
        <div class="bar" id="tBar"><div class="track"></div><div class="fill" id="tFill"></div><div id="tMarks"></div><div class="head" id="tHead"></div></div>
      </div>
      <div class="trimRow" id="trimRow" hidden></div>
      <div class="tags">
        <div class="tagsHead"><b style="color:var(--txt)" class="tagsTitle">Etiquetas</b><select id="setSel" title="Tabla de etiquetas"></select>
          <button id="btnTagEdit">Editar tabla</button><div class="sp"></div>
          <span class="tagsTip">Pulsa el botón o su tecla mientras ves el partido · <kbd>↑</kbd><kbd>↓</kbd> velocidad</span>
          <span class="dockSeg" title="Dónde va la tabla de etiquetas"><button data-dock="left" title="A la izquierda">◧</button><button data-dock="bottom" title="Debajo del vídeo">⬓</button><button data-dock="float" title="Flotante: arrástrala por su barra donde quieras">⧉</button></span></div>
        <div class="tagGrid" id="tagGrid"></div>
      </div>
    </div>
    <aside class="right">
      <div class="rHead"><span>Playlist</span><small id="clipCount">0 clips</small></div>
      <div class="chips" id="chips"></div>
      <div class="list" id="clipList"></div>
      <div class="rFoot"><button id="selAll">Marcar todos</button><button class="pri" id="toEditor">Llevar al editor →</button></div>
    </aside>
  </section>
  <section class="view" id="editView">
    <div class="tools" id="tools"></div>
    <div class="eStage">
      <div class="stage" id="rsvEditStage"><canvas id="rsvCv"></canvas>
        <div class="drop" id="editEmpty" style="display:none"><div class="big">No hay clips en el editor</div><div>Vuelve a «Etiquetar», marca los clips en la playlist y pulsa «Llevar al editor».</div></div>
        <div class="trackOv" id="trackOv"><span>🎯 Siguiendo al jugador…</span><div class="prog"><div id="trackBar"></div></div><button id="trackStop">Parar</button></div>
      </div>
      <div class="transport">
        <button id="ePlay" title="Espacio">▶</button>
        <button id="eFrameB" title=",">◂|</button>
        <button id="eFrameF" title=".">|▸</button>
        <span class="rate" title="Velocidad · flechas ↑ ↓"><select id="eRate"></select></span>
        <div class="time" id="eTime"><b>00:00.0</b> / 00:00.0</div>
        <label style="display:flex;gap:4px;align-items:center;color:var(--mut)"><input type="checkbox" id="ePlayAll" checked> Secuencia</label>
        <div class="sp"></div>
        <button id="eCalib" title="Marca 4 puntos del campo en una imagen congelada para dibujar sobre el césped y medir en metros">📐 Calibrar campo</button>
        <button id="eFreeze" title="Congela la imagen en este punto para explicar">❄ Congelar</button>
        <input type="number" id="eFreezeDur" value="3" min="0.5" step="0.5" title="segundos"> s
        <button class="pri" id="eExport">Exportar vídeo</button>
      </div>
    </div>
    <aside class="props" id="props"></aside>
    <div class="tl">
      <div class="tlBar"><b>Línea de tiempo</b><span style="color:var(--mut)" id="tlInfo"></span><div class="sp"></div><button id="clipRemove" title="Quitar este clip del editor">Quitar clip</button></div>
      <div class="seq" id="seq"></div>
      <div class="det" id="det"></div>
    </div>
  </section>
</main>
<div class="dlg" id="dlgTags"><div class="box">
  <h2>Tabla de etiquetas</h2>
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><span style="color:var(--mut)">Nombre de la tabla</span><input id="setName" type="text" style="flex:1;max-width:340px"></div>
  <div id="setShareRow" style="display:none;margin:0 0 8px"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="setShared"> Compartir con el club: la verán y la podrán usar todos los entrenadores</label></div>
  <p class="hint" id="setRO" style="display:none;color:#ffb27a"></p>
  <p class="hint">Crea tantas tablas como quieras (análisis de partido, del rival, individual…) y elige cuál usar arriba. «Instantánea»: un clic crea el clip con los segundos de antes y después. «Inicio/fin»: primer clic empieza, segundo clic termina. La tecla es opcional (no valen espacio, flechas, coma ni punto).</p>
  <table class="tagEd"><thead><tr><th>Color</th><th>Nombre</th><th>Tecla</th><th>Antes (s)</th><th>Después (s)</th><th>Modo</th><th></th></tr></thead><tbody id="tagEdBody"></tbody></table>
  <div style="margin-top:8px"><button id="tagAdd">+ Añadir etiqueta</button></div>
  <div class="setBar"><button id="setNew">Nueva tabla</button><button id="setDup">Duplicar</button><button id="setExp" title="Descargar la tabla para compartirla">Exportar</button><button id="setImp" title="Añadir una tabla que te han pasado">Importar</button><button id="setDel" style="color:var(--bad)">Borrar tabla</button><div class="sp"></div><button class="pri" id="tagClose">Hecho</button></div>
</div></div>
<div class="dlg" id="dlgExport"><div class="box">
  <h2>Exportar vídeo</h2>
  <div id="expOpts">
    <div class="brandGrid">
      <div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
          <label><input type="radio" name="expScope" value="seq" checked> Toda la secuencia (<span id="expSeqDur"></span>)</label>
          <label><input type="radio" name="expScope" value="clip"> Solo el clip actual (<span id="expClipDur"></span>)</label>
          <label>Calidad <select id="expQ"><option value="1280">720p (rápido, para WhatsApp)</option><option value="1920" selected>1080p</option></select></label>
        </div>
        <div class="brandSec"><label><input type="checkbox" id="bIntro"> Añadir intro</label>
          <div id="bIntroOpts">
            <div class="f"><span>Escudo o imagen</span><span style="display:flex;gap:6px;align-items:center"><i class="thumb" id="bIntroThumb"></i><button id="bIntroImgBtn">Elegir…</button><button id="bIntroImgDel" title="Quitar">✕</button></span></div>
            <div class="f"><span>Título</span><input type="text" id="bIntroTitle" placeholder="p. ej. Análisis vs Rival"></div>
            <div class="f"><span>Subtítulo</span><input type="text" id="bIntroSub" placeholder="p. ej. Jornada 8 · Juvenil A"></div>
            <div class="f"><span>Fondo</span><input type="color" id="bIntroBg"></div>
            <div class="f"><span>Duración</span><span><input type="number" id="bIntroDur" min="1" max="10" step="0.5"> s</span></div>
          </div>
        </div>
        <div class="brandSec"><label><input type="checkbox" id="bWm"> Añadir marca de agua</label>
          <div id="bWmOpts">
            <div class="f"><span>Imagen</span><span style="display:flex;gap:6px;align-items:center"><i class="thumb" id="bWmThumb"></i><button id="bWmImgBtn">Elegir…</button><button id="bWmImgDel" title="Quitar">✕</button></span></div>
            <div class="f"><span>Texto</span><input type="text" id="bWmText" placeholder="opcional"></div>
            <div class="f"><span>Posición</span><select id="bWmPos"><option value="tl">Arriba izquierda</option><option value="tr">Arriba derecha</option><option value="bl">Abajo izquierda</option><option value="br">Abajo derecha</option></select></div>
            <div class="f"><span>Tamaño</span><input type="range" id="bWmSize" min="4" max="25" step="1"></div>
            <div class="f"><span>Opacidad</span><input type="range" id="bWmOp" min="0.15" max="1" step="0.05"></div>
          </div>
        </div>
        <input type="file" id="bImgIn" accept="image/*" hidden>
      </div>
      <div>
        <div style="color:var(--mut);margin-bottom:6px">Vista previa</div>
        <canvas class="pv" id="bPrevIntro" width="640" height="360"></canvas>
        <canvas class="pv" id="bPrevWm" width="640" height="360" style="margin-top:8px"></canvas>
        <p class="hint" style="margin-top:8px">La intro y la marca de agua son opcionales y se recuerdan en este ordenador para la próxima vez.</p>
      </div>
    </div>
    <p class="hint">La exportación se graba en tiempo real: tarda lo mismo que dura el vídeo. No cambies de pestaña mientras tanto.</p>
    <div style="display:flex;gap:6px;justify-content:flex-end"><button id="expCancel">Cancelar</button><button class="pri" id="expGo">Exportar</button></div>
  </div>
  <div id="expRun" style="display:none"><div id="expMsg">Grabando…</div><div class="prog"><div id="expBar"></div></div><div style="display:flex;justify-content:flex-end"><button id="expStop">Detener</button></div></div>
  <div id="expDone" style="display:none"><div id="expDoneMsg"></div><div style="display:flex;gap:6px;justify-content:flex-end;margin-top:12px"><button id="expClose">Cerrar</button><button class="pri" id="expSave">Descargar</button></div></div>
</div></div>
<div class="toast" id="rsvToast"></div>`;

const TOOLS = [
  ["select", "Seleccionar / mover (V)", '<path d="M5 3l12 9-5 1 3 6-2 1-3-6-4 4z" fill="currentColor"/>'],
  ["arrow", "Flecha (A)", '<path d="M4 20L19 5M19 5h-8M19 5v8" stroke="currentColor" stroke-width="2" fill="none"/>'],
  ["curve", "Flecha curva (C)", '<path d="M4 19C6 8 14 6 19 6M19 6l-6-2M19 6l-3 5" stroke="currentColor" stroke-width="2" fill="none"/>'],
  ["line", "Línea (L)", '<path d="M4 20L20 4" stroke="currentColor" stroke-width="2"/>'],
  ["poly", "Línea de jugadores / formación (F) · clic en los pies de cada jugador, doble clic para terminar", '<path d="M3 15l6-4 6 3 6-6" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="3" cy="15" r="2" fill="currentColor"/><circle cx="9" cy="11" r="2" fill="currentColor"/><circle cx="15" cy="14" r="2" fill="currentColor"/><circle cx="21" cy="8" r="2" fill="currentColor"/>'],
  ["zone", "Zona libre (Z) · clic en cada vértice, doble clic para cerrar", '<path d="M4 17l4-11 11 3-3 10z" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".3"/>'],
  ["ellipse", "Zona circular en el césped (O)", '<ellipse cx="12" cy="13" rx="9" ry="5" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".3"/>'],
  ["spot", "Foco sobre jugador (S)", '<path d="M8 3h8l4 15H4z" fill="currentColor" opacity=".35"/><ellipse cx="12" cy="18" rx="8" ry="3" stroke="currentColor" stroke-width="2" fill="none"/>'],
  ["ring", "Marca de jugador con nombre (M)", '<ellipse cx="12" cy="18" rx="7" ry="3" stroke="currentColor" stroke-width="2" fill="none"/><rect x="6" y="3" width="12" height="7" rx="2" fill="currentColor"/>'],
  ["rect", "Zona rectangular en el césped (R) · con el campo calibrado sale en perspectiva", '<path d="M3 17l5-10h13l-5 10z" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity=".3"/>'],
  ["measure", "Medir distancia (D) · necesita el campo calibrado", '<path d="M3 17L21 7" stroke="currentColor" stroke-width="2"/><path d="M3 13v8M21 3v8" stroke="currentColor" stroke-width="2"/><path d="M8 14.5l1 1.8M12 12.3l1 1.8M16 10l1 1.8" stroke="currentColor" stroke-width="1.5"/>'],
  ["text", "Texto (T)", '<path d="M5 5h14M12 5v15" stroke="currentColor" stroke-width="2.4"/>'],
  ["mag", "Lupa (G)", '<circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="2" fill="none"/><path d="M15 15l6 6" stroke="currentColor" stroke-width="2.4"/>'],
];
const TOOL_KEYS = { v: "select", a: "arrow", c: "curve", l: "line", f: "poly", z: "zone", o: "ellipse", r: "rect", s: "spot", m: "ring", d: "measure", t: "text", g: "mag" };
const TOOL_NAMES = { arrow: "Flecha", curve: "Flecha curva", line: "Línea", poly: "Línea de jugadores", zone: "Zona", ellipse: "Zona circular", rect: "Zona rectangular", measure: "Medida", spot: "Foco", ring: "Marca jugador", text: "Texto", mag: "Lupa" };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (s, dec) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = s - m * 60; return String(m).padStart(2, "0") + ":" + (dec ? r.toFixed(1).padStart(4, "0") : String(Math.floor(r)).padStart(2, "0")); };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rateLabel = (r) => (r < 1 ? String(r).replace("0.", "0,") : String(r).replace(".", ",")) + "×";
const hexA = (hex, a) => { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

export function mountRSVideo(root, opts = {}) {
  const P = opts.storagePrefix || "rsv";
  root.classList.add("rsv");
  root.innerHTML = TEMPLATE;
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const cleanups = [];
  const on = (target, ev, fn, o) => { target.addEventListener(ev, fn, o); cleanups.push(() => target.removeEventListener(ev, fn, o)); };
  const load = (k) => { try { return JSON.parse(localStorage.getItem(`${P}:${k}`)); } catch { return null; } };
  const store = (k, v) => { try { localStorage.setItem(`${P}:${k}`, JSON.stringify(v)); return true; } catch { return false; } };

  const restored = restoreSets(load("sets"), load("tags"));
  const BRAND_DEFAULT = { intro: { on: false, img: null, title: "", sub: "", bg: "#36000D", dur: 3 }, wm: { on: false, img: null, text: "", pos: "tr", size: 10, op: 0.8 } };
  const savedBrand = load("brand") || {};
  const S = {
    video: null, sets: restored.sets, setId: restored.active, clips: [], seq: [], mode: "tag", filter: null, activeRow: null, rec: {},
    cur: null, L: 0, playing: false, tool: "select", sel: null, selFreeze: null, draft: null, tracking: null, calib: null,
    style: { color: "#ffffff", width: 4, dash: false, fill: 0.25, anim: true },
    brand: { intro: { ...BRAND_DEFAULT.intro, ...(savedBrand.intro || {}) }, wm: { ...BRAND_DEFAULT.wm, ...(savedBrand.wm || {}) } },
  };
  let hist = [];
  // Tablas en RS Manager (opcional): opts.tagStore = { me: {id, name, admin}, list, create, update, remove }
  const remote = opts.tagStore || null;
  const me = remote?.me || null;
  const isMine = (s) => !remote || !s.owner_id || s.owner_id === me.id;
  const canEditSet = (s) => isMine(s) || (!!me?.admin && s.shared === true);
  const own = (s) => { if (remote) Object.assign(s, { _new: true, owner_id: me.id, owner_name: me.name }); return s; };
  let saved = null; // Map id → lo último guardado en RS Manager (null hasta cargar)
  let syncT = 0, syncing = false, syncAgain = false;
  const queueSync = () => { if (!remote || !saved) return; clearTimeout(syncT); syncT = setTimeout(syncSets, 700); };
  async function syncSets() {
    if (!remote || !saved) return;
    if (syncing) { syncAgain = true; return; }
    syncing = true;
    try {
      const plan = syncPlan(saved, S.sets, canEditSet);
      for (const s of plan.create) {
        const old = s.id; s.owner_id ||= me.id; s.owner_name ||= me.name;
        const doc = await remote.create(setPayload(s));
        s.id = doc.id; delete s._new; if (S.setId === old) S.setId = doc.id;
        saved.set(s.id, JSON.stringify(setPayload(s)));
      }
      for (const s of plan.update) { await remote.update(s.id, setPayload(s)); saved.set(s.id, JSON.stringify(setPayload(s))); }
      for (const id of plan.remove) { await remote.remove(id); saved.delete(id); }
      if (plan.create.length && alive) { renderSetSel(); store("sets", { sets: S.sets, active: S.setId }); }
    } catch {
      if (alive) toast("No se ha podido guardar la tabla en RS Manager; se volverá a intentar");
      setTimeout(queueSync, 8000);
    } finally { syncing = false; if (syncAgain) { syncAgain = false; queueSync(); } }
  }
  async function loadRemote() {
    try {
      const docs = await remote.list();
      const sets = (Array.isArray(docs) ? docs : []).map((d) => cleanSet(d));
      saved = new Map(sets.map((x) => [x.id, JSON.stringify(setPayload(x))]));
      // tablas creadas en este ordenador que aún no se habían guardado
      restored.sets.filter((x) => x._new && x.owner_id === me.id).forEach((x) => { x.name = uniqueName(x.name, sets); sets.push(x); });
      // la primera vez: las tablas que ya había en este navegador pasan a RS Manager (menos la de ejemplo sin tocar)
      if (!load("migrated")) {
        restored.sets.filter((x) => !x.owner_id && x.tags.length && !isDefaultSet(x)).forEach((x) => { const c = own({ ...x, id: uid() }); c.name = uniqueName(c.name, sets); sets.push(c); });
        store("migrated", true);
      }
      if (!sets.some(isMine)) sets.push(own(defaultSets()[0]));
      S.sets = sortSets(sets, me.id);
      if (!S.sets.some((x) => x.id === S.setId)) S.setId = (S.sets.find(isMine) || S.sets[0]).id;
      if (!alive) return;
      renderSetSel(); renderTagGrid(); if ($("#dlgTags").classList.contains("on")) renderTagEd();
      store("sets", { sets: S.sets, active: S.setId }); queueSync();
    } catch {
      if (alive) toast("No se han podido cargar las tablas de RS Manager: se usan las de este ordenador");
    }
  }
  const vid = $("#rsvVid"), cv = $("#rsvCv"), ctx = cv.getContext("2d");
  const activeSet = () => S.sets.find((s) => s.id === S.setId) || S.sets[0];
  const tags = () => activeSet().tags;
  const projKey = () => (S.video ? `p:${S.video.name}:${S.video.size}` : null);
  let saveT; const autosave = () => { queueSync(); clearTimeout(saveT); saveT = setTimeout(() => { store("sets", { sets: S.sets, active: S.setId }); const k = projKey(); if (k && !store(k, { clips: S.clips, seq: S.seq })) toast("No se ha podido guardar en el navegador: usa «Guardar proyecto»"); }, 300); };
  const snapshot = () => { hist.push(JSON.stringify({ clips: S.clips, seq: S.seq })); if (hist.length > 60) hist.shift(); };
  const undo = () => { const h = hist.pop(); if (!h) return toast("Nada que deshacer"); const o = JSON.parse(h); S.clips = o.clips; S.seq = o.seq; S.sel = null; renderAll(); autosave(); };
  const toast = (m) => { const t = $("#rsvToast"); t.textContent = m; t.classList.add("on"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("on"), 2400); };
  const clipById = (id) => S.clips.find((c) => c.id === id);
  const curClip = () => clipById(S.cur);

  // velocidades
  ["#tRate", "#eRate"].forEach((sel) => { $(sel).innerHTML = RATES.map((r) => `<option value="${r}" ${r === 1 ? "selected" : ""}>${rateLabel(r)}</option>`).join(""); });
  function setRate(r, quiet) {
    const sel = S.mode === "tag" ? $("#tRate") : $("#eRate"); sel.value = String(r);
    if (S.mode === "tag") vid.playbackRate = r; else if (S.playing) vid.playbackRate = r;
    if (!quiet) toast("Velocidad " + rateLabel(r));
  }

  /* ------------------ ABRIR VÍDEO ------------------ */
  const drop = $("#rsvDrop");
  on($("#rsvOpen"), "click", () => $("#rsvFileIn").click());
  on($("#rsvOpen2"), "click", () => $("#rsvFileIn").click());
  on($("#rsvFileIn"), "change", (e) => { const f = e.target.files[0]; if (f) openVideo(f); e.target.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => on(root, ev, (e) => { e.preventDefault(); if (S.mode === "tag") drop.classList.add("hover"); }));
  ["dragleave", "drop"].forEach((ev) => on(root, ev, (e) => { e.preventDefault(); drop.classList.remove("hover"); }));
  on(root, "drop", (e) => { const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith("video") || /\.(mp4|mov|mkv|webm|m4v)$/i.test(x.name)); if (f) openVideo(f); });
  on($("#rsvFull"), "click", () => { if (document.fullscreenElement) document.exitFullscreen?.(); else root.requestFullscreen?.().catch(() => toast("Este navegador no deja poner pantalla completa")); });
  on(document, "fullscreenchange", () => setTimeout(sizeCanvas, 50));
  function openVideo(f) {
    if (vid.src) URL.revokeObjectURL(vid.src);
    vid.src = URL.createObjectURL(f);
    S.video = { name: f.name, size: f.size };
    vid.onloadedmetadata = () => {
      S.video.duration = vid.duration; S.video.w = vid.videoWidth; S.video.h = vid.videoHeight;
      drop.style.display = "none"; $("#rsvFileName").textContent = f.name;
      const p = load(projKey());
      if (S.pendingProj) { S.clips = S.pendingProj.clips; S.seq = S.pendingProj.seq; S.pendingProj = null; }
      else if (p && p.clips) { S.clips = p.clips; S.seq = p.seq || []; if (S.clips.length) toast("Recuperadas " + S.clips.length + " acciones guardadas de este partido"); }
      else { S.clips = []; S.seq = []; }
      S.cur = null; S.sel = null; hist = [];
      sizeCanvas(); renderAll();
    };
    vid.onerror = () => toast("Este navegador no puede reproducir ese archivo");
  }

  /* ------------------ MODO ------------------ */
  $$('[data-id="modeSeg"] button').forEach((b) => on(b, "click", () => setMode(b.dataset.m)));
  function setMode(m) {
    if (S.tracking) return;
    S.mode = m; pause(); S.rec = {};
    $$('[data-id="modeSeg"] button').forEach((b) => b.classList.toggle("on", b.dataset.m === m));
    $("#tagView").classList.toggle("on", m === "tag"); $("#editView").classList.toggle("on", m === "edit");
    (m === "tag" ? $("#rsvTagStage") : $("#rsvEditStage")).prepend(vid);
    vid.style.display = m === "tag" ? "" : "none";
    vid.playbackRate = m === "tag" ? +$("#tRate").value : 1;
    if (m === "edit") { S.seq = S.seq.filter((id) => clipById(id)); if (!S.cur || !S.seq.includes(S.cur)) S.cur = S.seq[0] || null; S.L = 0; sizeCanvas(); seekLocal(0); }
    renderAll();
  }

  /* =========================================================
     1 · ETIQUETAR
     ========================================================= */
  function renderSetSel() {
    const opt = (s) => `<option value="${s.id}" ${s.id === S.setId ? "selected" : ""}>${esc(s.name)}${remote && isMine(s) && s.shared ? " · compartida" : ""}${!isMine(s) && s.owner_name ? " · " + esc(s.owner_name) : ""}</option>`;
    const mine = S.sets.filter(isMine), club = S.sets.filter((s) => !isMine(s));
    $("#setSel").innerHTML = (remote ? `<optgroup label="Mis tablas">${mine.map(opt).join("")}</optgroup>` + (club.length ? `<optgroup label="Del club">${club.map(opt).join("")}</optgroup>` : "") : S.sets.map(opt).join("")) + `<option value="__new">＋ Nueva tabla…</option>`;
  }
  on($("#setSel"), "change", (e) => {
    if (e.target.value === "__new") { newSet(); openTagEditor(); return; }
    S.setId = e.target.value; S.rec = {}; autosave(); renderSetSel(); renderTagGrid(); toast("Tabla: " + activeSet().name);
    e.target.blur(); // para que las teclas de las etiquetas funcionen enseguida
  });
  function newSet() { const s = own({ id: uid(), name: uniqueName("Nueva tabla", S.sets), tags: [newTag({ label: "Nueva etiqueta", key: "1" })] }); S.sets.push(s); S.setId = s.id; autosave(); renderSetSel(); renderTagGrid(); }
  function renderTagGrid() {
    const ts = tags();
    $("#tagGrid").innerHTML = ts.length ? ts.map((t) => `<button class="tagBtn ${S.rec[t.id] != null ? "rec" : ""}" style="--c:${t.color}" data-id="${t.id}">
      ${esc(t.label)}${t.key ? `<span class="k">${esc(t.key.toUpperCase())}</span>` : ""}
      <span class="m">${t.mode === "instant" ? "−" + t.pre + "s / +" + t.post + "s" : S.rec[t.id] != null ? "● grabando… pulsa para cerrar" : "inicio / fin"}</span></button>`).join("")
      : `<div class="empty" style="padding:8px">Esta tabla no tiene etiquetas. Pulsa «Editar tabla» para crearlas.</div>`;
    $$(".tagBtn").forEach((b) => on(b, "click", () => fireTag(b.dataset.id)));
  }
  const newClip = (tag, tin, tout) => ({ id: uid(), tagId: tag.id, label: tag.label, color: tag.color, tin, tout, rating: 0, pick: false, freezes: [], drawings: [], createdAt: Date.now() });
  function fireTag(id) {
    if (!S.video) return toast("Primero abre el vídeo del partido");
    const t = tags().find((x) => x.id === id); if (!t) return;
    const now = vid.currentTime, D = S.video.duration;
    let c;
    if (t.mode === "toggle") {
      if (S.rec[id] == null) { S.rec[id] = now; renderTagGrid(); return; }
      let a = S.rec[id], b = now; delete S.rec[id]; if (b < a) [a, b] = [b, a]; if (b - a < 1) b = a + 1;
      c = newClip(t, clamp(a - t.pre, 0, D), clamp(b + t.post, 0, D));
    } else c = newClip(t, clamp(now - t.pre, 0, D), clamp(now + t.post, 0, D));
    snapshot(); S.clips.push(c); S.clips.sort((a, b) => a.tin - b.tin); S.activeRow = c.id;
    renderTagGrid(); renderClips(); renderMarks(); autosave();
    const nb = $(`.tagBtn[data-id="${id}"]`); if (nb) { nb.classList.add("flash"); setTimeout(() => nb.classList.remove("flash"), 250); }
    $(`.row[data-id="${c.id}"]`)?.scrollIntoView({ block: "nearest" });
  }
  function filtered() {
    const f = S.filter; if (!f) return S.clips;
    if (f === "__good") return S.clips.filter((c) => c.rating === 1);
    if (f === "__bad") return S.clips.filter((c) => c.rating === -1);
    if (f === "__fav") return S.clips.filter((c) => c.fav);
    return S.clips.filter((c) => c.label === f);
  }
  function renderChips() {
    const used = [...new Set(S.clips.map((c) => c.label))];
    $("#chips").innerHTML = (used.length ? `<span class="chip ${!S.filter ? "on" : ""}" data-f="">Todas</span>` : "") +
      (S.clips.length ? ["__good", "__bad", "__fav"].map((f) => `<span class="chip ${S.filter === f ? "on" : ""}" data-f="${f}">${{ __good: "👍", __bad: "👎", __fav: "★" }[f]}</span>`).join("") : "") +
      used.map((l) => `<span class="chip ${S.filter === l ? "on" : ""}" data-f="${esc(l)}">${esc(l)} · ${S.clips.filter((c) => c.label === l).length}</span>`).join("");
    $$(".chip").forEach((ch) => on(ch, "click", () => { S.filter = ch.dataset.f || null; renderClips(); }));
  }
  function renderClips() {
    renderChips();
    const list = filtered(); const picked = S.clips.filter((c) => c.pick).length;
    $("#clipCount").textContent = S.clips.length + (S.clips.length === 1 ? " clip" : " clips") + (picked ? " · " + picked + (picked === 1 ? " marcado" : " marcados") : "");
    if (!S.clips.length) { S.activeRow = null; renderTrim(); $("#clipList").innerHTML = `<div class="empty">Aún no hay clips.<br>Reproduce el partido y pulsa una etiqueta (o su tecla) cuando pase la acción: el clip aparecerá aquí.</div>`; return; }
    $("#clipList").innerHTML = list.map((c) => `<div class="row ${S.activeRow === c.id ? "act" : ""}" style="--c:${c.color}" data-id="${c.id}">
      <input type="checkbox" ${c.pick ? "checked" : ""} data-a="pick" title="Marcar para el editor">
      <div><div class="n">${esc(c.label)}${S.seq.includes(c.id) ? ' <span style="color:var(--naranja);font-size:10px">● en editor</span>' : ""}</div>
        <div class="t">${fmt(c.tin)} → ${fmt(c.tout)} · ${Math.round(c.tout - c.tin)}s${c.drawings.length ? " · ✎" + c.drawings.length : ""}</div></div>
      <div class="acts"><button class="g ${c.rating === 1 ? "on" : ""}" data-a="good" title="Bien">👍</button><button class="b ${c.rating === -1 ? "on" : ""}" data-a="bad" title="Mal">👎</button><button class="f ${c.fav ? "on" : ""}" data-a="fav" title="Favorito">★</button><button data-a="del" title="Borrar">✕</button></div>
      ${S.activeRow === c.id ? `<div class="trim"><button data-a="in-">Inicio −1s</button><button data-a="in+">+1s</button><button data-a="inNow">Inicio = aquí</button><button data-a="out-">Fin −1s</button><button data-a="out+">+1s</button><button data-a="outNow">Fin = aquí</button></div>` : ""}
    </div>`).join("") || `<div class="empty">Ningún clip con este filtro.</div>`;
    $$(".row").forEach((r) => on(r, "click", (e) => {
      const c = clipById(r.dataset.id), a = e.target.dataset.a;
      if (a === "pick") { c.pick = e.target.checked; autosave(); renderClips(); return; }
      if (a) {
        snapshot();
        if (a === "good") c.rating = c.rating === 1 ? 0 : 1; else if (a === "bad") c.rating = c.rating === -1 ? 0 : -1;
        else if (a === "fav") c.fav = !c.fav; else if (a === "del") { S.clips = S.clips.filter((x) => x !== c); S.seq = S.seq.filter((x) => x !== c.id); if (S.activeRow === c.id) S.activeRow = null; }
        else if (a === "in-") setClipRange(c, c.tin - 1, c.tout); else if (a === "in+") setClipRange(c, Math.min(c.tout - MIN_CLIP, c.tin + 1), c.tout);
        else if (a === "out-") setClipRange(c, c.tin, c.tout - 1); else if (a === "out+") setClipRange(c, c.tin, c.tout + 1);
        else if (a === "inNow") setClipRange(c, Math.min(vid.currentTime, c.tout - MIN_CLIP), c.tout); else if (a === "outNow") setClipRange(c, c.tin, vid.currentTime);
        if (a.startsWith("in")) vid.currentTime = c.tin; if (a.startsWith("out")) vid.currentTime = Math.max(c.tin, c.tout - 2);
        autosave(); renderClips(); renderMarks(); return;
      }
      S.activeRow = c.id; playRange(c.tin, c.tout); renderClips();
    }));
    renderTrim();
  }
  let stopAt = null;
  const playRange = (a, b) => { vid.currentTime = a; stopAt = b; vid.play(); };
  on($("#selAll"), "click", () => { const l = filtered(); const all = l.every((c) => c.pick); l.forEach((c) => (c.pick = !all)); autosave(); renderClips(); });
  on($("#toEditor"), "click", () => {
    const picks = S.clips.filter((c) => c.pick); const src = picks.length ? picks : filtered();
    if (!src.length) return toast("No hay clips para llevar al editor");
    snapshot(); src.forEach((c) => { if (!S.seq.includes(c.id)) S.seq.push(c.id); });
    S.cur = src[0].id; autosave(); setMode("edit"); toast(src.length === 1 ? "1 clip en el editor" : src.length + " clips en el editor");
  });
  function renderMarks() {
    const D = S.video?.duration || 1;
    $("#tMarks").innerHTML = S.clips.map((c) => `<div class="mk ${S.activeRow === c.id ? "on" : ""}" data-id="${c.id}" title="${esc(c.label)} · ${fmt(c.tin)} → ${fmt(c.tout)}" style="left:${(c.tin / D) * 100}%;width:${Math.max(0.25, ((c.tout - c.tin) / D) * 100)}%;background:${c.color}"></div>`).join("");
  }

  // ---- inicio y final de un corte: se cambian arrastrando los extremos en la barra de corte ----
  // Cambiar el inicio deja congelados, dibujos y seguimientos en el mismo momento del vídeo.
  function setClipRange(c, nin, nout) {
    const D = S.video?.duration || Math.max(nout, c.tout);
    nin = clamp(nin, 0, D); nout = clamp(nout, 0, D);
    if (nout - nin < MIN_CLIP) { if (nin + MIN_CLIP <= D) nout = nin + MIN_CLIP; else nin = Math.max(0, nout - MIN_CLIP); }
    const dIn = nin - c.tin;
    if (Math.abs(dIn) > 1e-6) {
      c.freezes.forEach((f) => (f.at -= dIn));
      c.drawings.forEach((d) => { d.from = Math.max(0, d.from - dIn); d.to = Math.max(d.from + 0.1, d.to - dIn); (d.kf || []).forEach((k) => (k.t -= dIn)); (d.ptk || []).forEach((tk) => (tk || []).forEach((k) => (k.t -= dIn))); });
    }
    c.tin = nin; c.tout = nout;
    c.freezes = c.freezes.filter((f) => f.at >= 0 && f.at <= c.tout - c.tin);
    const L = clipLen(c); c.drawings.forEach((d) => { d.to = Math.min(d.to, L); d.from = Math.min(d.from, d.to - 0.1); });
  }
  let trimWin = null;
  const niceStep = (W) => [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find((s) => W / s <= 12) || 600;
  function renderTrim() {
    const el = $("#trimRow"); const c = S.activeRow && clipById(S.activeRow);
    if (!S.video || !c) { el.hidden = true; trimWin = null; return; }
    const D = S.video.duration;
    if (!trimWin || trimWin.id !== c.id || c.tin < trimWin.a || c.tout > trimWin.b) {
      const pad = Math.max(6, (c.tout - c.tin) * 0.8);
      trimWin = { id: c.id, a: Math.max(0, c.tin - pad), b: Math.min(D, c.tout + pad) };
    }
    const { a, b } = trimWin, W = Math.max(0.5, b - a), P = (t) => ((t - a) / W) * 100;
    const st = niceStep(W); let ticks = "";
    for (let t = Math.ceil(a / st) * st; t <= b + 1e-6; t += st) ticks += `<div class="tk" style="left:${P(t)}%"><span>${fmt(t)}</span></div>`;
    const others = S.clips.filter((o) => o !== c && o.tout > a && o.tin < b)
      .map((o) => `<div class="tother" data-id="${o.id}" title="${esc(o.label)} · ${fmt(o.tin)} → ${fmt(o.tout)}" style="left:${P(Math.max(a, o.tin))}%;width:${P(Math.min(b, o.tout)) - P(Math.max(a, o.tin))}%;background:${o.color}"></div>`).join("");
    el.hidden = false;
    el.innerHTML = `<div class="trimInfo"><span class="dot" style="background:${c.color}"></span><b>${esc(c.label)}</b>
        <span>Inicio <b id="trIn">${fmt(c.tin, 1)}</b></span><span>Final <b id="trOut">${fmt(c.tout, 1)}</b></span><span id="trLen">${(c.tout - c.tin).toFixed(1)} s</span>
        <span class="hint">Arrastra los extremos para cambiar el inicio y el final · el centro mueve el corte entero</span><div class="sp"></div>
        <button data-tr="play" title="Ver el corte">▶ Ver el corte</button><button data-tr="close" title="Cerrar">✕</button></div>
      <div class="trimTrack" id="trTrack">${ticks}<div class="tothers">${others}</div>
        <div class="tclip" id="trClip" style="--c:${c.color}"><div class="grip l" data-g="in" title="Inicio del corte"></div><div class="grip r" data-g="out" title="Final del corte"></div></div>
        <div class="thead" id="trHead"></div></div>`;
    placeTrim(c);
    el.querySelectorAll("[data-tr]").forEach((bt) => on(bt, "click", () => {
      if (bt.dataset.tr === "play") playRange(c.tin, c.tout);
      else { S.activeRow = null; renderClips(); renderMarks(); }
      bt.blur();
    }));
  }
  function placeTrim(c) {
    if (!trimWin) return; const W = Math.max(0.5, trimWin.b - trimWin.a), P = (t) => ((t - trimWin.a) / W) * 100;
    const cl = $("#trClip"); if (!cl) return;
    cl.style.left = P(c.tin) + "%"; cl.style.width = Math.max(0.3, P(c.tout) - P(c.tin)) + "%";
    $("#trIn").textContent = fmt(c.tin, 1); $("#trOut").textContent = fmt(c.tout, 1); $("#trLen").textContent = (c.tout - c.tin).toFixed(1) + " s";
  }
  on($("#trimRow"), "pointerdown", (e) => {
    const track = e.target.closest("#trTrack"); if (!track || !trimWin) return;
    const c = clipById(S.activeRow); if (!c) return;
    e.preventDefault();
    const r = track.getBoundingClientRect(), W = trimWin.b - trimWin.a;
    const tAt = (x) => clamp(trimWin.a + ((x - r.left) / r.width) * W, trimWin.a, trimWin.b);
    const other = e.target.closest(".tother");
    if (other) { S.activeRow = other.dataset.id; const o = clipById(other.dataset.id); vid.pause(); vid.currentTime = o.tin; renderClips(); renderMarks(); return; }
    const g = e.target.dataset.g || (e.target.closest("#trClip") ? "move" : null);
    vid.pause(); stopAt = null;
    if (!g) { const mv = (ev) => { vid.currentTime = tAt(ev.clientX); }; mv(e); const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); }; addEventListener("pointermove", mv); addEventListener("pointerup", up); return; }
    snapshot();
    const t0 = tAt(e.clientX), in0 = c.tin, out0 = c.tout, len = out0 - in0; let moved = false;
    const mv = (ev) => {
      const t = tAt(ev.clientX); moved = true;
      if (g === "in") { setClipRange(c, Math.min(t, c.tout - MIN_CLIP), c.tout); vid.currentTime = c.tin; }
      else if (g === "out") { setClipRange(c, c.tin, Math.max(t, c.tin + MIN_CLIP)); vid.currentTime = c.tout; }
      else { const ni = clamp(in0 + (t - t0), 0, S.video.duration - len); setClipRange(c, ni, ni + len); vid.currentTime = c.tin; }
      placeTrim(c); renderMarks();
    };
    const up = () => {
      removeEventListener("pointermove", mv); removeEventListener("pointerup", up);
      if (!moved) { hist.pop(); vid.currentTime = g === "out" ? c.tout : c.tin; return; }
      S.clips.sort((x, y) => x.tin - y.tin); autosave(); renderClips(); renderMarks();
      if (S.seq.includes(c.id) && S.cur === c.id) { renderTimeline(); renderProps(); }
    };
    addEventListener("pointermove", mv); addEventListener("pointerup", up);
  });
  on($("#tPlay"), "click", () => (vid.paused ? vid.play() : vid.pause()));
  on($("#tBack"), "click", () => (vid.currentTime -= 2)); on($("#tFwd"), "click", () => (vid.currentTime += 2));
  on($("#tFrameB"), "click", () => { vid.pause(); vid.currentTime -= 1 / 25; }); on($("#tFrameF"), "click", () => { vid.pause(); vid.currentTime += 1 / 25; });
  on($("#tRate"), "change", (e) => { vid.playbackRate = +e.target.value; e.target.blur(); });
  on(vid, "play", () => { $("#tPlay").textContent = "❚❚"; }); on(vid, "pause", () => { $("#tPlay").textContent = "▶"; });
  // barra del partido: tocar = ir a ese momento; tocar un corte = elegirlo; en el corte elegido, arrastrar sus
  // extremos cambia el inicio y el final, y arrastrar el centro lo mueve (igual que en la barra de corte de abajo)
  on($("#tBar"), "pointerdown", (e) => {
    if (!S.video) return; e.preventDefault(); const bar = $("#tBar"); const r = bar.getBoundingClientRect(); const D = S.video.duration;
    const tAt = (x) => clamp((x - r.left) / r.width, 0, 1) * D;
    const act = S.activeRow && clipById(S.activeRow);
    let g = null;
    if (act) {
      const x0 = r.left + (act.tin / D) * r.width, x1 = r.left + (act.tout / D) * r.width, edge = Math.min(10, Math.max(4, (x1 - x0) / 3));
      if (Math.abs(e.clientX - x0) <= edge) g = "in"; else if (Math.abs(e.clientX - x1) <= edge) g = "out";
      else if (e.target.closest(".mk")?.dataset.id === act.id) g = "move";
    }
    if (!g) {
      const mk = e.target.closest(".mk");
      if (mk) { const c = clipById(mk.dataset.id); if (c) { S.activeRow = c.id; vid.pause(); stopAt = null; vid.currentTime = c.tin; renderClips(); renderMarks(); $(`.row[data-id="${c.id}"]`)?.scrollIntoView({ block: "nearest" }); } return; }
      const mv = (ev) => { vid.currentTime = tAt(ev.clientX); stopAt = null; }; mv(e);
      const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); }; addEventListener("pointermove", mv); addEventListener("pointerup", up); return;
    }
    vid.pause(); stopAt = null; snapshot();
    const t0 = tAt(e.clientX), in0 = act.tin, len = act.tout - act.tin; let moved = false;
    const mv = (ev) => {
      const t = tAt(ev.clientX); moved = true;
      if (g === "in") { setClipRange(act, Math.min(t, act.tout - MIN_CLIP), act.tout); vid.currentTime = act.tin; }
      else if (g === "out") { setClipRange(act, act.tin, Math.max(t, act.tin + MIN_CLIP)); vid.currentTime = act.tout; }
      else { const ni = clamp(in0 + (t - t0), 0, D - len); setClipRange(act, ni, ni + len); vid.currentTime = act.tin; }
      renderMarks(); placeTrim(act);
    };
    const up = () => {
      removeEventListener("pointermove", mv); removeEventListener("pointerup", up);
      if (!moved) { hist.pop(); vid.currentTime = g === "out" ? act.tout : act.tin; return; }
      S.clips.sort((x, y) => x.tin - y.tin); autosave(); renderClips(); renderMarks();
    };
    addEventListener("pointermove", mv); addEventListener("pointerup", up);
  });
  // el cursor dice qué se puede hacer: ↔ en los extremos del corte elegido
  on($("#tBar"), "pointermove", (e) => {
    const act = S.video && S.activeRow && clipById(S.activeRow); const bar = $("#tBar"); if (!act) { bar.style.cursor = ""; return; }
    const r = bar.getBoundingClientRect(), D = S.video.duration, x0 = r.left + (act.tin / D) * r.width, x1 = r.left + (act.tout / D) * r.width, edge = Math.min(10, Math.max(4, (x1 - x0) / 3));
    bar.style.cursor = Math.abs(e.clientX - x0) <= edge || Math.abs(e.clientX - x1) <= edge ? "ew-resize" : e.target.closest(".mk")?.dataset.id === act.id ? "grab" : "pointer";
  });
  function tagTick() {
    if (!S.video) return;
    const t = vid.currentTime, D = S.video.duration;
    if (stopAt != null && t >= stopAt) { vid.pause(); stopAt = null; }
    $("#tTime").innerHTML = `<b>${fmt(t)}</b> / ${fmt(D)}`;
    $("#tFill").style.width = (t / D) * 100 + "%"; $("#tHead").style.left = (t / D) * 100 + "%";
    const th = trimWin && $("#trHead"); if (th) { const u = (t - trimWin.a) / (trimWin.b - trimWin.a); th.style.display = u < 0 || u > 1 ? "none" : ""; th.style.left = u * 100 + "%"; }
  }

  // ----- tabla de etiquetas (diálogo) -----
  function openTagEditor() { renderTagEd(); $("#dlgTags").classList.add("on"); }
  on($("#btnTagEdit"), "click", openTagEditor);
  on($("#tagClose"), "click", () => { $("#dlgTags").classList.remove("on"); renderSetSel(); renderTagGrid(); autosave(); document.activeElement?.blur?.(); });
  on($("#tagAdd"), "click", () => { if (!canEditSet(activeSet())) return; tags().push(newTag()); renderTagEd(); autosave(); setTimeout(() => { const inps = $$('#tagEdBody input[data-k="label"]'); inps[inps.length - 1]?.select(); }, 0); });
  on($("#setName"), "input", (e) => { if (!canEditSet(activeSet())) return; activeSet().name = e.target.value.slice(0, 60) || "Tabla sin nombre"; autosave(); renderSetSel(); });
  on($("#setNew"), "click", () => { newSet(); renderTagEd(); });
  on($("#setShared"), "change", (e) => { const set = activeSet(); if (!isMine(set)) return; set.shared = e.target.checked; autosave(); renderSetSel(); toast(set.shared ? "Tabla compartida: la verán todos los entrenadores" : "La tabla vuelve a ser solo tuya"); });
  on($("#setDup"), "click", () => { const c = own(duplicateSet(activeSet(), S.sets)); S.sets.push(c); S.setId = c.id; autosave(); renderTagEd(); toast("Tabla duplicada"); });
  on($("#setDel"), "click", () => {
    if (!canEditSet(activeSet())) return;
    if (S.sets.filter(isMine).length < 2 && isMine(activeSet())) return toast("Tiene que quedar al menos una tabla tuya");
    const b = $("#setDel");
    if (!b.dataset.confirm) { b.dataset.confirm = "1"; b.textContent = remote && activeSet().shared ? "¿Seguro? Se quita para todo el club" : "¿Seguro? Pulsa otra vez"; setTimeout(() => { b.dataset.confirm = ""; b.textContent = "Borrar tabla"; }, 2500); return; }
    b.dataset.confirm = ""; b.textContent = "Borrar tabla";
    S.sets = S.sets.filter((s) => s.id !== S.setId); S.setId = (S.sets.find(isMine) || S.sets[0]).id; autosave(); renderTagEd(); toast("Tabla borrada");
  });
  on($("#setExp"), "click", () => saveFile(`Etiquetas - ${activeSet().name}.json`, new Blob([JSON.stringify(exportSets([activeSet()]), null, 1)], { type: "application/json" })));
  on($("#setImp"), "click", () => $("#rsvSetIn").click());
  on($("#rsvSetIn"), "change", async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try { const got = importSets(await f.text(), S.sets).map(own); S.sets.push(...got); S.setId = got[0].id; autosave(); renderTagEd(); toast(got.length === 1 ? `Tabla «${got[0].name}» importada` : `${got.length} tablas importadas`); }
    catch (err) { toast(err.message); }
  });
  function renderTagEd() {
    const set = activeSet(); $("#setName").value = set.name; renderSetSel();
    const ro = !canEditSet(set); const dis = ro ? "disabled" : "";
    $("#setName").disabled = ro; $("#tagAdd").style.display = ro ? "none" : ""; $("#setDel").style.display = ro ? "none" : "";
    $("#setShareRow").style.display = remote && isMine(set) ? "" : "none"; $("#setShared").checked = set.shared === true;
    const roMsg = ro ? `Tabla de ${esc(set.owner_name || "otra persona")} compartida con el club. Solo la puede cambiar su autor o coordinación: pulsa «Duplicar» para tener tu copia y cambiarla.`
      : !isMine(set) ? `Tabla de ${esc(set.owner_name || "otra persona")} compartida con el club: los cambios los verá todo el club.` : "";
    $("#setRO").style.display = roMsg ? "" : "none"; $("#setRO").innerHTML = roMsg;
    const dup = duplicateKeys(set.tags); const dupIds = new Set(Object.values(dup).flat());
    $("#tagEdBody").innerHTML = set.tags.map((t, i) => `<tr data-id="${t.id}"><td><input type="color" data-k="color" value="${t.color}" ${dis}></td><td><input type="text" data-k="label" value="${esc(t.label)}" ${dis}></td>
      <td><input class="key ${dupIds.has(t.id) ? "bad-key" : ""}" data-k="key" maxlength="1" value="${esc(t.key)}" title="${dupIds.has(t.id) ? "Esta tecla está repetida" : ""}" ${dis}></td><td><input type="number" data-k="pre" value="${t.pre}" min="0" ${dis}></td><td><input type="number" data-k="post" value="${t.post}" min="0" ${dis}></td>
      <td><select data-k="mode" ${dis}><option value="instant" ${t.mode === "instant" ? "selected" : ""}>Instantánea</option><option value="toggle" ${t.mode === "toggle" ? "selected" : ""}>Inicio/fin</option></select></td>
      <td style="white-space:nowrap">${ro ? "" : `<button data-mv="-1" ${i ? "" : "disabled"} title="Subir">↑</button><button data-mv="1" ${i < set.tags.length - 1 ? "" : "disabled"} title="Bajar">↓</button><button data-del="1" title="Quitar">✕</button>`}</td></tr>`).join("") ||
      `<tr><td colspan="7" style="color:var(--mut);padding:12px">Sin etiquetas todavía.</td></tr>`;
    $$("#tagEdBody tr[data-id]").forEach((tr) => {
      const t = set.tags.find((x) => x.id === tr.dataset.id);
      tr.querySelectorAll("[data-k]").forEach((inp) => on(inp, inp.tagName === "SELECT" || inp.type === "color" ? "change" : "input", () => {
        const k = inp.dataset.k;
        if (k === "pre" || k === "post") t[k] = clamp(+inp.value || 0, 0, 120);
        else if (k === "key") { const v = inp.value.toLowerCase(); if (RESERVED_KEYS.includes(v)) { inp.value = ""; t.key = ""; toast("Esa tecla la usan los controles del vídeo"); } else t.key = v; renderTagEdKeys(); }
        else t[k] = inp.value;
        autosave();
      }));
      if (ro) return;
      on(tr.querySelector("[data-del]"), "click", () => { set.tags = set.tags.filter((x) => x !== t); autosave(); renderTagEd(); });
      tr.querySelectorAll("[data-mv]").forEach((b) => on(b, "click", () => { const i = set.tags.indexOf(t), j = i + +b.dataset.mv; [set.tags[i], set.tags[j]] = [set.tags[j], set.tags[i]]; autosave(); renderTagEd(); }));
    });
  }
  function renderTagEdKeys() {
    const dupIds = new Set(Object.values(duplicateKeys(activeSet().tags)).flat());
    $$("#tagEdBody tr[data-id]").forEach((tr) => tr.querySelector('[data-k="key"]').classList.toggle("bad-key", dupIds.has(tr.dataset.id)));
  }

  /* =========================================================
     2 · EDITOR
     ========================================================= */
  function sizeCanvas() {
    if (!S.video?.w) return;
    const host = $("#rsvEditStage"); const W = host.clientWidth - 12, H = host.clientHeight - 12; if (W <= 0 || H <= 0) return;
    const ar = S.video.w / S.video.h; let w = W, h = W / ar; if (h > H) { h = H; w = H * ar; }
    const s = Math.min(1, 1920 / S.video.w); cv.width = Math.round(S.video.w * s); cv.height = Math.round(S.video.h * s);
    cv.style.width = w + "px"; cv.style.height = h + "px";
  }
  const ro = new ResizeObserver(() => { if (S.mode === "edit") sizeCanvas(); }); ro.observe($("#rsvEditStage")); cleanups.push(() => ro.disconnect());

  // ---- reproducción del editor (también la usa la exportación) ----
  let lastVT = null;
  function seekLocal(L) {
    const c = curClip(); if (!c) return; S.L = clamp(L, 0, clipLen(c)); const m = mapL(c, S.L);
    if (Math.abs(vid.currentTime - m.vt) > 0.02) vid.currentTime = m.vt; lastVT = m.vt;
  }
  function play() { const c = curClip(); if (!c) return; if (S.L >= clipLen(c) - 0.05) seekLocal(0); S.playing = true; S._wall = performance.now(); lastVT = vid.currentTime; $("#ePlay").textContent = "❚❚"; }
  function pause() { S.playing = false; vid.pause(); $("#ePlay").textContent = "▶"; }
  function nextClip() { const i = S.seq.indexOf(S.cur); if (i >= 0 && i < S.seq.length - 1) { S.cur = S.seq[i + 1]; S.sel = null; seekLocal(0); renderTimeline(); renderProps(); return true; } return false; }
  function engineTick(now) {
    const c = curClip(); if (!c || !S.playing) return;
    const rate = +$("#eRate").value; const dtWall = (Math.min(0.1, (now - S._wall) / 1000)) * rate; S._wall = now;
    const m = mapL(c, S.L);
    if (m.frozen) { if (!vid.paused) vid.pause(); S.L += dtWall; if (!mapL(c, S.L).frozen) lastVT = vid.currentTime; }
    else {
      if (vid.paused && !vid.seeking) { vid.playbackRate = rate; vid.play().catch(() => {}); lastVT = vid.currentTime; }
      const vt = vid.currentTime; const d = clamp(vt - (lastVT ?? vt), 0, 0.5 * Math.max(1, rate)); lastVT = vt; S.L += d;
      const m2 = mapL(c, S.L);
      if (m2.frozen) { vid.pause(); S.L = freezeStartL(c, m2.frozen); vid.currentTime = m2.vt; }
    }
    if (S.L >= clipLen(c)) {
      S.L = clipLen(c);
      if (S._onClipEnd) return S._onClipEnd();
      if ($("#ePlayAll").checked && nextClip()) { S._wall = performance.now(); return; }
      pause();
    }
  }

  // ---- herramientas ----
  function renderTools() {
    $("#tools").innerHTML = TOOLS.map(([id, t, svg], i) => (i === 1 ? "<hr>" : "") + `<button data-t="${id}" class="${S.tool === id ? "on" : ""}" title="${t}"><svg viewBox="0 0 24 24">${svg}</svg></button>`).join("") + `<hr><button id="tUndo" title="Deshacer (Ctrl+Z)">↶</button>`;
    $$("#tools [data-t]").forEach((b) => on(b, "click", () => setTool(b.dataset.t)));
    on($("#tUndo"), "click", undo);
  }
  function setTool(t) { S.tool = t; S.draft = null; renderTools(); renderProps(); }

  // ---- pintar ----
  function render(g, W, H, c, L, o = {}) {
    g.clearRect(0, 0, W, H);
    if (vid.readyState >= 2) g.drawImage(vid, 0, 0, W, H); else { g.fillStyle = "#000"; g.fillRect(0, 0, W, H); }
    if (!c) return;
    const sc = H / 720;
    if (!o.clean && S.calib && calFreeze()) { drawCalibration(g, W, H, sc); return; }
    const cal = calAt(c, L);
    if (cal) drawPitchMarks(g, W, H, sc, cal);
    const animate = o.clean || S.playing || S.tracking;
    for (const d of c.drawings) if (visible(d, L)) drawShape(g, W, H, sc, d, L, !animate, cal);
    if (o.clean) { if (o.watermark) drawWatermark(g, W, H); return; }
    if (S.draft) drawShape(g, W, H, sc, S.draft, L, true, cal);
    const sd = c.drawings.find((d) => d.id === S.sel);
    if (sd && visible(sd, L)) {
      if (TRACKABLE.includes(sd.type) && !S.playing) {
        g.save(); g.strokeStyle = "rgba(255,110,0,.85)"; g.setLineDash([6, 4]); g.lineWidth = 1.5;
        const pts = ptsAt(sd, L); (MULTI.includes(sd.type) ? pts : [pts[0]]).forEach((p) => { const b = bodyBox(p.x * W, p.y * H, (sd.trackH || 0.09) * H); g.strokeRect(b.x, b.y, b.w, b.h); });
        g.restore();
      }
      if ((sd.tracked || hasOwnTracks(sd)) && !S.playing) drawTrackPath(g, W, H, sd, L);
      for (const p of ptsAt(sd, L)) { g.fillStyle = "#fff"; g.strokeStyle = "#000"; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x * W, p.y * H, 6, 0, 7); g.fill(); g.stroke(); }
    }
  }
  // recorrido del seguimiento (±2 s): ayuda a ver dónde se ha ido con otro jugador
  function drawTrackPath(g, W, H, d, L) {
    const a = Math.max(d.from, L - 2), b = Math.min(d.to, L + 2); if (b - a < 0.1) return;
    const own = hasOwnTracks(d); const idx = own ? d.ptk.map((tk, i) => (tk && tk.length ? i : -1)).filter((i) => i >= 0) : [0];
    g.save(); g.lineWidth = 2; g.setLineDash([]);
    for (const i of idx) {
      for (const [lo, hi, col] of [[a, L, "rgba(255,110,0,.55)"], [L, b, "rgba(255,255,255,.55)"]]) {
        g.strokeStyle = col; g.beginPath(); let first = true;
        for (let t = lo; t <= hi + 1e-6; t += 1 / 25) { const q = ptsAt(d, t)[i]; if (first) { g.moveTo(q.x * W, q.y * H); first = false; } else g.lineTo(q.x * W, q.y * H); }
        g.stroke();
      }
    }
    g.restore();
  }
  function drawShape(g, W, H, sc, d, L, still, cal) {
    const Pt = ptsAt(d, L).map((p) => ({ x: p.x * W, y: p.y * H }));
    if (!Pt.length) return;
    let alpha = 1, grow = 1;
    if (!still) { const fi = 0.2; alpha = clamp(Math.min((L - d.from) / fi, (d.to - L) / fi), 0, 1); if (d.anim) grow = clamp((L - d.from) / 0.7, 0, 1); grow = 1 - Math.pow(1 - grow, 2); }
    g.save(); g.globalAlpha = alpha;
    const lw = d.width * sc; g.lineWidth = lw; g.strokeStyle = d.color; g.fillStyle = d.color; g.lineCap = "round"; g.lineJoin = "round";
    g.setLineDash(d.dash ? [lw * 2.6, lw * 2] : []);
    g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 4 * sc;
    const t = d.type;
    if (t === "arrow" || t === "line") {
      if (Pt.length < 2) { g.restore(); return; }
      const a = Pt[0], b = { x: a.x + (Pt[1].x - a.x) * grow, y: a.y + (Pt[1].y - a.y) * grow };
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      if (t === "arrow") { g.setLineDash([]); arrowHead(g, b, Math.atan2(b.y - a.y, b.x - a.x), lw * 3.2); }
    } else if (t === "curve") {
      if (Pt.length < 3) { g.restore(); return; }
      const [a, ctl, b] = Pt; const N = 40, pts = []; for (let i = 0; i <= N * grow; i++) pts.push(qb(a, ctl, b, i / N));
      if (pts.length < 2) { g.restore(); return; }
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
      const e = pts[pts.length - 1], e0 = pts[Math.max(0, pts.length - 3)]; g.setLineDash([]); arrowHead(g, e, Math.atan2(e.y - e0.y, e.x - e0.x), lw * 3.2);
    } else if (t === "poly") {
      const n = Math.max(1, Math.ceil(Pt.length * grow));
      g.beginPath(); Pt.slice(0, n).forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); g.setLineDash([]);
      Pt.slice(0, n).forEach((p) => { g.beginPath(); g.ellipse(p.x, p.y, lw * 2.6, lw * 1.1, 0, 0, 7); g.fill(); });
    } else if (t === "zone") {
      g.beginPath(); Pt.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); if (!still || d !== S.draft) g.closePath();
      g.save(); g.shadowBlur = 0; g.fillStyle = hexA(d.color, d.fill * grow); g.fill(); g.restore(); g.stroke();
    } else if (t === "rect") {
      if (Pt.length < 2) { g.restore(); return; }
      const poly = rectCorners(d, L, cal).map((q) => ({ x: q.x * W, y: q.y * H }));
      g.beginPath(); poly.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath();
      g.save(); g.shadowBlur = 0; g.fillStyle = hexA(d.color, d.fill * grow); g.fill(); g.restore(); g.stroke();
      if (cal && d.gnd && d.text !== "off") {
        const P0 = ptsAt(d, L), A = toGround(cal, P0[0]), B = toGround(cal, P0[1]);
        const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        label(g, `${fmtM(Math.abs(B.x - A.x))} × ${fmtM(Math.abs(B.y - A.y))}`, mid(poly[0], poly[2]).x, mid(poly[0], poly[2]).y, d.color, sc * 0.75, true);
      }
    } else if (t === "measure") {
      if (Pt.length < 2) { g.restore(); return; }
      const a = Pt[0], b = Pt[1], ang = Math.atan2(b.y - a.y, b.x - a.x), n = { x: -Math.sin(ang), y: Math.cos(ang) }, tk = 9 * sc;
      g.setLineDash([]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y);
      for (const q of [a, b]) { g.moveTo(q.x - n.x * tk, q.y - n.y * tk); g.lineTo(q.x + n.x * tk, q.y + n.y * tk); }
      g.stroke();
      const txt = cal && d.gnd ? fmtM(groundDist(cal, ptsAt(d, L)[0], ptsAt(d, L)[1])) : "Calibra el campo";
      label(g, txt, (a.x + b.x) / 2, (a.y + b.y) / 2 - 18 * sc, d.color, sc * 0.8, true);
    } else if ((t === "ellipse" || t === "spot" || t === "ring") && cal && d.gnd && Pt.length > 1) {
      // sobre el césped: círculo de verdad en metros, más pequeño cuanto más lejos
      const P0 = ptsAt(d, L), G = toGround(cal, P0[0]), R = Math.max(0.2, groundDist(cal, P0[0], P0[1])) * (t === "ring" || t === "ellipse" ? grow : 1);
      const poly = circleImg(cal, G, R, 56).map((q) => ({ x: q.x * W, y: q.y * H }));
      const path = () => { g.beginPath(); poly.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath(); };
      const c0 = Pt[0]; const xs = poly.map((q) => q.x), ys = poly.map((q) => q.y);
      const rx = Math.max(4, (Math.max(...xs) - Math.min(...xs)) / 2), ry = Math.max(2, (Math.max(...ys) - Math.min(...ys)) / 2);
      const pxm = rx / R; // píxeles por metro en ese punto del campo: lo de pie (un jugador ≈ 1,8 m) se ve a esa escala
      if (t === "ellipse") { path(); g.save(); g.shadowBlur = 0; g.fillStyle = hexA(d.color, d.fill); g.fill(); g.restore(); g.stroke(); }
      if (t === "ring") { g.setLineDash(d.dash ? [lw * 2, lw * 1.6] : []); path(); g.stroke(); if (d.text) label(g, d.text, c0.x, c0.y - pxm * 2 - 20 * sc, d.color, sc, true); }
      if (t === "spot") {
        g.shadowBlur = 0; const cy = (Math.max(...ys) + Math.min(...ys)) / 2, top = cy - pxm * 2.2 * grow;
        const gr = g.createLinearGradient(0, top, 0, cy); gr.addColorStop(0, hexA(d.color, 0)); gr.addColorStop(1, hexA(d.color, 0.42));
        g.fillStyle = gr; g.beginPath(); g.moveTo(c0.x - rx * 0.45, top); g.lineTo(c0.x + rx * 0.45, top); g.lineTo(c0.x + rx, cy); g.ellipse(c0.x, cy, rx, ry, 0, 0, Math.PI); g.closePath(); g.fill();
        g.setLineDash([]); g.lineWidth = lw * 0.8; path(); g.fillStyle = hexA(d.color, 0.35); g.fill(); g.stroke();
      }
    } else if (t === "ellipse" || t === "spot" || t === "ring" || t === "mag") {
      const c0 = Pt[0], c1 = Pt[1] || { x: c0.x + 40 * sc, y: c0.y };
      const rx = Math.max(6, Math.hypot(c1.x - c0.x, c1.y - c0.y)) * (t === "mag" ? 1 : grow);
      if (t === "ellipse") { g.beginPath(); g.ellipse(c0.x, c0.y, rx, rx * 0.38, 0, 0, 7); g.save(); g.shadowBlur = 0; g.fillStyle = hexA(d.color, d.fill); g.fill(); g.restore(); g.stroke(); }
      if (t === "spot") {
        g.shadowBlur = 0; const ry = rx * 0.32, top = c0.y - rx * 4.2;
        const gr = g.createLinearGradient(0, top, 0, c0.y); gr.addColorStop(0, hexA(d.color, 0)); gr.addColorStop(1, hexA(d.color, 0.42));
        g.fillStyle = gr; g.beginPath(); g.moveTo(c0.x - rx * 0.45, top); g.lineTo(c0.x + rx * 0.45, top); g.lineTo(c0.x + rx, c0.y); g.ellipse(c0.x, c0.y, rx, ry, 0, 0, Math.PI); g.closePath(); g.fill();
        g.setLineDash([]); g.lineWidth = lw * 0.8; g.beginPath(); g.ellipse(c0.x, c0.y, rx, ry, 0, 0, 7); g.fillStyle = hexA(d.color, 0.35); g.fill(); g.stroke();
      }
      if (t === "ring") {
        g.setLineDash(d.dash ? [lw * 2, lw * 1.6] : []); g.beginPath(); g.ellipse(c0.x, c0.y, rx, rx * 0.36, 0, 0, 7); g.stroke();
        if (d.text) label(g, d.text, c0.x, c0.y - (d.trackH || 0.09) * H - 22 * sc, d.color, sc, true); // justo encima de la cabeza
      }
      if (t === "mag") {
        const z = 2; g.save(); g.shadowBlur = 0; g.beginPath(); g.arc(c0.x, c0.y, rx, 0, 7); g.clip();
        if (vid.readyState >= 2) { const sx = (c0.x / W) * vid.videoWidth, sy = (c0.y / H) * vid.videoHeight, sw = ((rx * 2) / z / W) * vid.videoWidth, sh = ((rx * 2) / z / H) * vid.videoHeight; g.drawImage(vid, sx - sw / 2, sy - sh / 2, sw, sh, c0.x - rx, c0.y - rx, rx * 2, rx * 2); }
        g.restore(); g.setLineDash([]); g.lineWidth = lw; g.beginPath(); g.arc(c0.x, c0.y, rx, 0, 7); g.stroke();
      }
    } else if (t === "text") label(g, d.text || "Texto", Pt[0].x, Pt[0].y, d.color, sc * (d.width / 4), false);
    g.restore();
  }
  const qb = (a, c, b, u) => { const v = 1 - u; return { x: v * v * a.x + 2 * v * u * c.x + u * u * b.x, y: v * v * a.y + 2 * v * u * c.y + u * u * b.y }; };
  function arrowHead(g, b, ang, hl) { g.beginPath(); g.moveTo(b.x + Math.cos(ang) * hl * 0.3, b.y + Math.sin(ang) * hl * 0.3); g.lineTo(b.x - Math.cos(ang - 0.5) * hl, b.y - Math.sin(ang - 0.5) * hl); g.lineTo(b.x - Math.cos(ang + 0.5) * hl, b.y - Math.sin(ang + 0.5) * hl); g.closePath(); g.fill(); }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function label(g, txt, x, y, color, sc, center) {
    g.save(); g.shadowBlur = 0; g.setLineDash([]);
    const fs = 22 * sc; g.font = `700 ${fs}px 'IBM Plex Sans Condensed', 'Barlow Condensed', sans-serif`; const w = g.measureText(txt).width + fs * 0.9, h = fs * 1.45;
    const x0 = center ? x - w / 2 : x, y0 = y - h / 2;
    g.fillStyle = color; rr(g, x0, y0, w, h, h * 0.22); g.fill();
    const n = parseInt(color.slice(1), 16); const lum = ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11;
    g.fillStyle = lum > 150 ? "#111" : "#fff"; g.textBaseline = "middle"; g.fillText(txt, x0 + fs * 0.45, y0 + h / 2 + 1);
    g.restore();
  }

  // ---- calibración del campo (sobre un congelado) ----
  const calCache = new Map();
  const aspectOf = () => (S.video?.w && S.video?.h ? S.video.w / S.video.h : 16 / 9);
  function solved(cal) {
    if (!cal?.pairs || cal.pairs.length < 4) return null;
    const key = JSON.stringify([cal.field, cal.len, cal.wid, cal.pairs, aspectOf()]);
    if (!calCache.has(key)) { if (calCache.size > 40) calCache.clear(); calCache.set(key, solveCal(cal, aspectOf())); }
    return calCache.get(key);
  }
  function calAt(c, L) { const f = c && mapL(c, L).frozen; return f?.cal ? solved(f.cal) : null; }
  const calFreeze = () => { const c = curClip(); return c && S.calib ? c.freezes.find((f) => f.id === S.calib.fzId) : null; };
  function rectCorners(d, L, cal) {
    const P = ptsAt(d, L); if (P.length < 2) return P;
    if (cal && d.gnd) return groundRectImg(cal, P[0], P[1]);
    return [P[0], { x: P[1].x, y: P[0].y }, P[1], { x: P[0].x, y: P[1].y }];
  }
  function strokeGround(g, W, H, cal, lines) {
    for (const l of lines) for (const seg of lineImg(cal, l)) { g.beginPath(); seg.forEach((q, i) => (i ? g.lineTo(q.x * W, q.y * H) : g.moveTo(q.x * W, q.y * H))); g.stroke(); }
  }
  function drawPitchMarks(g, W, H, sc, cal, f) {
    const fz = f || mapL(curClip(), S.L).frozen; const opt = fz?.cal || {};
    g.save(); g.lineCap = "round";
    if (opt.lines) { g.strokeStyle = "rgba(255,110,0,.85)"; g.lineWidth = 2 * sc; strokeGround(g, W, H, cal, pitchLines(cal.p)); }
    if (opt.marks) { g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 2.2 * sc; g.setLineDash([10 * sc, 8 * sc]); strokeGround(g, W, H, cal, markLines(cal.p, opt.marks)); }
    g.restore();
  }
  function drawCalibration(g, W, H, sc) {
    const f = calFreeze(); const cal = f.cal; const sol = solved(cal); const lm = Object.fromEntries(landmarks(pitchOf(cal)).map((l) => [l.k, l]));
    g.save(); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0, 0, W, H);
    if (sol) { g.strokeStyle = "rgba(255,110,0,.95)"; g.lineWidth = 2.2 * sc; g.lineCap = "round"; strokeGround(g, W, H, sol, pitchLines(sol.p)); }
    cal.pairs.forEach((q, i) => {
      const x = q.x * W, y = q.y * H, r = 7 * sc;
      g.lineWidth = 2 * sc; g.strokeStyle = "#000"; g.fillStyle = S.calib.drag === i ? "#ff6e00" : "#2fbf71";
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x - r * 2, y); g.lineTo(x - r, y); g.moveTo(x + r, y); g.lineTo(x + r * 2, y); g.moveTo(x, y - r * 2); g.lineTo(x, y - r); g.moveTo(x, y + r); g.lineTo(x, y + r * 2); g.strokeStyle = "#fff"; g.stroke();
      label(g, String(i + 1), x + r * 2.4, y - r * 2.2, "#2fbf71", sc * 0.7, false);
      if (sol) { const pr = toImage(sol, lm[q.k]); g.strokeStyle = "#ff6e00"; g.lineWidth = 1.5 * sc; g.beginPath(); g.moveTo(x, y); g.lineTo(pr.x * W, pr.y * H); g.stroke(); }
    });
    // lupa para afinar: lo que hay bajo el puntero, ampliado
    const hv = S.calib.hover;
    if (hv && vid.readyState >= 2) {
      const R = 70 * sc, z = 3, cx = hv.x * W > W - R * 3 ? R + 12 * sc : W - R - 12 * sc, cy = R + 12 * sc;
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
      const sw = ((R * 2) / z / W) * vid.videoWidth, sh = ((R * 2) / z / H) * vid.videoHeight;
      g.drawImage(vid, hv.x * vid.videoWidth - sw / 2, hv.y * vid.videoHeight - sh / 2, sw, sh, cx - R, cy - R, R * 2, R * 2);
      g.strokeStyle = "rgba(255,110,0,.9)"; g.lineWidth = 1.5 * sc; g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
      g.restore(); g.lineWidth = 3 * sc; g.strokeStyle = "#fff"; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
    }
    g.restore();
  }
  function makeFreeze(c, dur) {
    const m = mapL(c, S.L); const at = m.vt - c.tin;
    shiftAfter(c, S.L + 1e-3, dur); const f = { id: uid(), at, dur }; c.freezes.push(f);
    S.L = freezeStartL(c, f) + 0.001; return f;
  }
  function startCalib() {
    const c = curClip(); if (!c) return toast("Lleva un clip al editor para calibrar el campo");
    pause(); snapshot();
    let f = mapL(c, S.L).frozen;
    if (!f) { f = makeFreeze(c, Math.max(3, +$("#eFreezeDur").value || 3)); toast("He congelado la imagen aquí para calibrar sobre ella"); }
    const prev = c.freezes.filter((x) => x !== f && x.cal).sort((a, b) => b.at - a.at)[0]?.cal;
    if (!f.cal) f.cal = { field: prev?.field || "f11", len: prev?.len, wid: prev?.wid, pairs: [], marks: "", lines: false };
    S.calib = { fzId: f.id, sel: null, drag: null, hover: null }; S.selFreeze = f; S.sel = null; S.draft = null; S.tool = "select";
    renderTools(); renderTimeline(); renderProps();
  }
  function endCalib() { S.calib = null; autosave(); renderProps(); renderTimeline(); }
  on($("#eCalib"), "click", (e) => { e.currentTarget.blur(); S.calib ? endCalib() : startCalib(); });
  // dibujo pequeño del campo con los puntos que se pueden marcar
  function miniPitch(cal) {
    const p = pitchOf(cal), m = 3, done = Object.fromEntries(cal.pairs.map((q, i) => [q.k, i + 1]));
    const lines = pitchLines(p).map((l) => `<polyline points="${l.map((q) => `${q.x + m},${q.y + m}`).join(" ")}"/>`).join("");
    const dots = landmarks(p).map((l) => { const n = done[l.k], sel = S.calib?.sel === l.k;
      return `<g class="lm ${n ? "done" : ""} ${sel ? "sel" : ""}" data-k="${l.k}"><title>${esc(l.name)}</title><circle cx="${l.x + m}" cy="${l.y + m}" r="${sel ? 2.3 : 1.8}"/>${n ? `<text x="${l.x + m}" y="${l.y + m + 0.9}">${n}</text>` : ""}</g>`; }).join("");
    return `<svg class="miniPitch" viewBox="0 0 ${p.len + 2 * m} ${p.wid + 2 * m}"><rect x="0" y="0" width="${p.len + 2 * m}" height="${p.wid + 2 * m}" rx="2"/><g class="ln">${lines}</g>${dots}</svg>`;
  }
  function calibPanel() {
    const f = calFreeze(); const cal = f.cal; const p = pitchOf(cal); const q = calQuality(solved(cal)); const lm = Object.fromEntries(landmarks(p).map((l) => [l.k, l]));
    const selName = S.calib.sel ? lm[S.calib.sel]?.name : null;
    return `<h3>📐 Calibrar el campo</h3>
      <div class="hint">1. Toca en el dibujo un punto del campo que se vea bien en la imagen.<br>2. Tócalo en la imagen (arriba a la derecha sale una lupa).<br>Hacen falta <b>4 puntos</b> (mejor 5 o 6), repartidos y que no estén todos en la misma línea. Las líneas naranjas tienen que caer encima de las del campo.</div>
      <div class="f"><label>Campo</label><select id="cField">${Object.entries(PITCH_TYPES).map(([k, v]) => `<option value="${k}" ${p.field === k ? "selected" : ""}>${v.name}</option>`).join("")}</select></div>
      <div class="f"><label>Largo × ancho</label><span><input type="number" id="cLen" value="${p.len}" min="30" max="130" step="0.5" style="width:56px"> × <input type="number" id="cWid" value="${p.wid}" min="20" max="100" step="0.5" style="width:56px"> m</span></div>
      ${miniPitch(cal)}
      <div class="calSel ${selName ? "on" : ""}">${selName ? `Ahora toca en la imagen: <b>${esc(selName)}</b>` : "Elige un punto en el dibujo del campo"}</div>
      <div class="calQ ${q.level}">${q.text}</div>
      ${cal.pairs.length ? `<div class="calList">${cal.pairs.map((x, i) => `<div><span>${i + 1}</span>${esc(lm[x.k]?.name || x.k)}<button data-cdel="${i}" title="Quitar este punto">✕</button></div>`).join("")}</div>` : ""}
      <h3>En el césped</h3>
      <div class="f"><label>Zonas</label><select id="cMarks">${MARKS.map(([k, n]) => `<option value="${k}" ${cal.marks === k ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div class="f"><label>Ver líneas del campo</label><input type="checkbox" id="cLines" ${cal.lines ? "checked" : ""}></div>
      <div class="btnrow">${cal.pairs.length ? `<button id="cClear">Borrar puntos</button>` : ""}<button id="cRemove" style="color:var(--bad)">Quitar calibración</button></div>
      <button class="pri" id="cDone" style="width:100%;margin-top:6px">Hecho</button>`;
  }
  function bindCalibPanel(el) {
    const f = calFreeze(); const cal = f.cal; const re = () => { autosave(); renderProps(); };
    el.querySelectorAll(".miniPitch .lm").forEach((n) => on(n, "click", () => { S.calib.sel = S.calib.sel === n.dataset.k ? null : n.dataset.k; renderProps(); }));
    on($("#cField"), "change", (e) => { snapshot(); cal.field = e.target.value; cal.len = undefined; cal.wid = undefined; const ok = new Set(landmarks(pitchOf(cal)).map((l) => l.k)); cal.pairs = cal.pairs.filter((x) => ok.has(x.k)); re(); });
    on($("#cLen"), "change", (e) => { snapshot(); cal.len = +e.target.value; re(); });
    on($("#cWid"), "change", (e) => { snapshot(); cal.wid = +e.target.value; re(); });
    on($("#cMarks"), "change", (e) => { snapshot(); cal.marks = e.target.value; re(); });
    on($("#cLines"), "change", (e) => { snapshot(); cal.lines = e.target.checked; re(); });
    el.querySelectorAll("[data-cdel]").forEach((b) => on(b, "click", () => { snapshot(); cal.pairs.splice(+b.dataset.cdel, 1); re(); }));
    const cl = $("#cClear"); if (cl) on(cl, "click", () => { snapshot(); cal.pairs = []; re(); });
    on($("#cRemove"), "click", () => { snapshot(); delete f.cal; S.calib = null; autosave(); renderProps(); renderTimeline(); toast("Calibración quitada"); });
    on($("#cDone"), "click", () => {
      if (cal.pairs.length && !solved(cal)) toast(cal.pairs.length < 4 ? "Faltan puntos: la calibración no se usará hasta tener 4" : "Con estos puntos no se puede calcular: revisa que no estén en la misma línea");
      endCalib();
    });
  }
  function calibPointer(e, kind) {
    const f = calFreeze(); const cal = f.cal; const p = evPt(e); const W = cv.width, H = cv.height, tol = (14 / cv.getBoundingClientRect().width) * W;
    if (kind === "down") {
      const i = cal.pairs.findIndex((q) => Math.hypot((q.x - p.x) * W, (q.y - p.y) * H) < tol);
      if (i >= 0) { snapshot(); S.calib.drag = i; return; }
      if (!S.calib.sel) return toast("Primero elige en el dibujo del campo (a la derecha) qué punto vas a marcar");
      snapshot(); cal.pairs = cal.pairs.filter((q) => q.k !== S.calib.sel); cal.pairs.push({ k: S.calib.sel, x: p.x, y: p.y });
      S.calib.drag = cal.pairs.length - 1; S.calib.sel = null; renderProps(); return;
    }
    if (kind === "move") { S.calib.hover = p; if (S.calib.drag != null) { const q = cal.pairs[S.calib.drag]; if (q) { q.x = clamp(p.x, 0, 1); q.y = clamp(p.y, 0, 1); } } cv.style.cursor = "crosshair"; return; }
    if (kind === "up") { if (S.calib.drag != null) { S.calib.drag = null; autosave(); renderProps(); } }
    if (kind === "leave") S.calib.hover = null;
  }

  // ---- ratón / dedo sobre el vídeo ----
  const evPt = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  const segD = (p, a, b) => { const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2; let u = l2 ? ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2 : 0; u = clamp(u, 0, 1); return Math.hypot(p.x - a.x - u * (b.x - a.x), p.y - a.y - u * (b.y - a.y)); };
  const inPoly = (p, pts) => { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) ins = !ins; } return ins; };
  function hit(c, p) {
    const W = cv.width, H = cv.height, tol = (12 / cv.getBoundingClientRect().width) * W;
    const Pp = (d) => ptsAt(d, S.L).map((q) => ({ x: q.x * W, y: q.y * H })); const q = { x: p.x * W, y: p.y * H };
    const vis = c.drawings.filter((d) => visible(d, S.L));
    const sd = vis.find((d) => d.id === S.sel);
    if (sd) { const pp = Pp(sd); for (let i = 0; i < pp.length; i++) if (Math.hypot(pp[i].x - q.x, pp[i].y - q.y) < tol) return { d: sd, h: i }; }
    for (let k = vis.length - 1; k >= 0; k--) {
      const d = vis[k], pp = Pp(d);
      if (["arrow", "line", "poly", "curve"].includes(d.type)) { const pl = d.type === "curve" ? [...Array(21)].map((_, i) => qb(pp[0], pp[1], pp[2], i / 20)) : pp; for (let i = 0; i < pl.length - 1; i++) if (segD(q, pl[i], pl[i + 1]) < tol) return { d, h: -1 }; }
      else if (d.type === "zone") { if (inPoly(q, pp)) return { d, h: -1 }; }
      else if (d.type === "rect") { if (inPoly(q, rectCorners(d, S.L, calAt(c, S.L)).map((r) => ({ x: r.x * W, y: r.y * H })))) return { d, h: -1 }; }
      else if (d.type === "measure") { if (segD(q, pp[0], pp[1]) < tol) return { d, h: -1 }; }
      else if (d.type === "text") { if (Math.abs(q.x - pp[0].x - 60) < 80 && Math.abs(q.y - pp[0].y) < 24) return { d, h: -1 }; }
      else { const r = Math.hypot(pp[1].x - pp[0].x, pp[1].y - pp[0].y); const ry = d.type === "mag" ? r : r * 0.4; const dx = (q.x - pp[0].x) / r, dy = (q.y - pp[0].y) / Math.max(ry, 8);
        if (dx * dx + dy * dy < 1.4 || (d.type === "ring" && Math.abs(q.x - pp[0].x) < 50 && q.y < pp[0].y && q.y > pp[0].y - (d.trackH || 0.09) * H - 40)) return { d, h: -1 }; }
    }
    return null;
  }
  function defaultRange(c) {
    const m = mapL(c, S.L);
    if (m.frozen) { const s = freezeStartL(c, m.frozen); return [s, s + m.frozen.dur]; }
    return [S.L, Math.min(clipLen(c), S.L + 4)];
  }
  function mkDrawing(type, pts) {
    const c = curClip(); const [from, to] = defaultRange(c); const st = S.style;
    const gnd = GROUND_TYPES.includes(type) && !!calAt(c, S.L);
    return { id: uid(), type, pts, color: st.color, width: type === "text" ? 4 : st.width, dash: st.dash, fill: st.fill, anim: st.anim, from, to, kf: [], trackH: 0.09, text: type === "ring" ? "Jugador" : type === "text" ? "Texto" : "", ...(gnd ? { gnd: true } : {}) };
  }
  const hasOwnTracks = (d) => d.ptk && d.ptk.some((x) => x && x.length);
  function upsert(list, t, v) { const k = list.find((x) => Math.abs(x.t - t) < 0.05); if (k) Object.assign(k, v); else { list.push({ t, ...v }); list.sort((a, b) => a.t - b.t); } }
  function setKf(d, t, dx, dy) { d.kf = d.kf || []; if (!d.kf.length) d.kf.push({ t: d.from, dx: 0, dy: 0 }); upsert(d.kf, t, { dx, dy }); }
  let drag = null;
  on(cv, "pointerdown", (e) => {
    const c = curClip(); if (!c || S.tracking) return; cv.setPointerCapture(e.pointerId); const p = evPt(e);
    if (S.calib && calFreeze()) return calibPointer(e, "down");
    if (S.playing) pause();
    if (S.tool === "select") {
      const h = hit(c, p);
      if (!h) { S.sel = null; renderProps(); renderTimeline(); return; }
      S.sel = h.d.id; snapshot();
      const d = h.d; const centered = ["ellipse", "spot", "ring", "mag", "text"].includes(d.type) && h.h === 0;
      const [ox, oy] = kfOffset(d, S.L);
      drag = { kind: h.h >= 0 && !centered ? "handle" : "move", d, h: h.h, start: p, orig: d.pts.map((q) => ({ ...q })), ox, oy, cur: ptsAt(d, S.L),
        kf0: (d.kf || []).map((k) => ({ ...k })), ptk0: (d.ptk || []).map((tk) => (tk ? tk.map((k) => ({ ...k })) : tk)) };
      renderProps(); renderTimeline(); return;
    }
    if (S.tool === "poly" || S.tool === "zone") {
      if (!S.draft) S.draft = mkDrawing(S.tool, [p, { ...p }]);
      else { S.draft.pts[S.draft.pts.length - 1] = p; S.draft.pts.push({ ...p }); }
      return;
    }
    if (S.tool === "text") { snapshot(); const d = mkDrawing("text", [p]); c.drawings.push(d); S.sel = d.id; afterCreate(true); return; }
    S.draft = mkDrawing(S.tool, S.tool === "curve" ? [p, { ...p }, { ...p }] : [p, { ...p }]);
    drag = { kind: "create" };
  });
  on(cv, "pointerleave", (e) => { if (S.calib && calFreeze()) calibPointer(e, "leave"); });
  on(cv, "pointermove", (e) => {
    const p = evPt(e); const c = curClip(); if (!c) return;
    if (S.calib && calFreeze()) return calibPointer(e, "move");
    if ((S.tool === "poly" || S.tool === "zone") && S.draft) { S.draft.pts[S.draft.pts.length - 1] = p; return; }
    if (!drag) { cv.style.cursor = S.tool === "select" ? (hit(c, p) ? "move" : "default") : "crosshair"; return; }
    if (drag.kind === "create") {
      const d = S.draft; if (d.type === "curve") { d.pts[2] = p; const a = d.pts[0], dx = p.x - a.x, dy = p.y - a.y; d.pts[1] = { x: a.x + dx / 2 - dy * 0.25, y: a.y + dy / 2 + dx * 0.25 }; } else d.pts[1] = p;
      return;
    }
    const d = drag.d, dx = p.x - drag.start.x, dy = p.y - drag.start.y; drag.last = p;
    const own = hasOwnTracks(d), win = d.fixWin || FIX_WIN; drag.fixed = own || d.tracked;
    // en un dibujo con seguimiento, arrastrar corrige ese momento y lo de alrededor (sin saltos)
    if (drag.kind === "handle") {
      if (own && drag.ptk0[drag.h]?.length) d.ptk[drag.h] = nudgeTrack(drag.ptk0[drag.h], S.L, dx, dy, win, "x", "y");
      else d.pts[drag.h] = { x: drag.orig[drag.h].x + dx, y: drag.orig[drag.h].y + dy };
    } else if (own) { d.ptk = drag.ptk0.map((tk) => (tk && tk.length ? nudgeTrack(tk, S.L, dx, dy, win, "x", "y") : tk)); }
    else if (d.tracked) d.kf = nudgeTrack(drag.kf0, S.L, dx, dy, win);
    else if (d.follow) setKf(d, S.L, drag.ox + dx, drag.oy + dy);
    else d.pts = drag.orig.map((q) => ({ x: q.x + dx, y: q.y + dy }));
  });
  on(cv, "pointerup", (e) => {
    const c = curClip(); if (!c) return;
    if (S.calib && calFreeze()) return calibPointer(e, "up");
    if (drag?.kind === "create") {
      const d = S.draft; S.draft = null; drag = null;
      const big = Math.hypot(d.pts[d.pts.length - 1].x - d.pts[0].x, d.pts[d.pts.length - 1].y - d.pts[0].y) > 0.006;
      if (!big && !["ring", "spot", "ellipse", "mag"].includes(d.type)) return;
      const gcal = d.gnd && calAt(c, S.L);
      if (!big && gcal) { const G = toGround(gcal, d.pts[0]); const q = toImage(gcal, { x: G.x + GROUND_R[d.type], y: G.y }); d.pts[1] = { x: q.x, y: q.y }; }
      else if (!big) d.pts[1] = { x: d.pts[0].x + { ring: 0.022, spot: 0.03, ellipse: 0.06, mag: 0.08 }[d.type], y: d.pts[0].y };
      snapshot(); c.drawings.push(d); S.sel = d.id; afterCreate(d.type === "ring"); return;
    }
    if (drag) {
      const wasFix = drag.fixed && (drag.kind === "move" || hasOwnTracks(drag.d)) && Math.hypot(drag.start.x - (drag.last?.x ?? drag.start.x), drag.start.y - (drag.last?.y ?? drag.start.y)) > 0.002;
      drag = null; autosave(); renderTimeline(); renderProps();
      if (wasFix) toast(`Corregido en ${fmt(S.L, 1)}. Si desde aquí se va con otro jugador, pulsa «🎯 Seguir desde aquí»`);
    }
  });
  on(cv, "dblclick", () => finishDraft());
  function finishDraft() {
    const c = curClip(); const d = S.draft; if (!d || !c) return; d.pts.pop();
    const pts = d.pts.filter((p, i) => i === 0 || Math.hypot(p.x - d.pts[i - 1].x, p.y - d.pts[i - 1].y) > 0.003);
    S.draft = null; if (pts.length < 2) return; d.pts = pts; snapshot(); c.drawings.push(d); S.sel = d.id; afterCreate();
  }
  function afterCreate(focusText) { autosave(); renderTimeline(); renderProps(); renderClips(); if (focusText) { const i = $("#pText"); if (i) { i.focus(); i.select(); } } }

  // ---- seguimiento automático ----
  on($("#trackStop"), "click", () => { if (S.tracking) S.tracking.cancel = true; });
  async function autoTrack(d) {
    const c = curClip(); if (!c || !d || S.tracking) return;
    if (!vid.videoWidth) return toast("El vídeo no está listo");
    pause();
    if (!visible(d, S.L)) seekLocal(d.from + 0.01);
    if (mapL(c, S.L).frozen) { const f = mapL(c, S.L).frozen; seekLocal(freezeStartL(c, f)); }
    snapshot();
    const L0 = S.L; const len = clipLen(c);
    if (d.to < len - 0.05) d.to = len;
    const v0 = mapL(c, L0).vt; const vEnd = mapL(c, d.to).vt;
    if (vEnd - v0 < 0.3) return toast("No queda vídeo después de este punto para seguir al jugador");
    const multi = MULTI.includes(d.type);
    const start = ptsAt(d, L0); const idxs = multi ? start.map((_, i) => i) : [0];
    const TW = Math.min(960, vid.videoWidth), TH = Math.round((vid.videoHeight * TW) / vid.videoWidth);
    const wc = document.createElement("canvas"); wc.width = TW; wc.height = TH; const wg = wc.getContext("2d", { willReadFrequently: true });
    const grab = () => { wg.drawImage(vid, 0, 0, TW, TH); return wg.getImageData(0, 0, TW, TH); };
    await seekWait(v0);
    const hpx = (d.trackH || 0.09) * TH;
    let img = grab();
    const trackers = idxs.map((i) => createTracker(img, start[i].x * TW, start[i].y * TH, hpx));
    if (trackers.some((t) => !t)) return toast("Pon la marca en los pies del jugador (el recuadro naranja se sale de la imagen)");
    const samples = idxs.map((i) => [{ vt: v0, x: start[i].x, y: start[i].y }]);
    const alive = idxs.map(() => true); let lostAt = null;
    S.tracking = { cancel: false }; $("#trackOv").classList.add("on"); $("#trackBar").style.width = "0%";
    const baseKf = (d.kf || []).map((k) => ({ ...k })), basePtk = (d.ptk || []).map((x) => (x ? x.map((k) => ({ ...k })) : x));
    const apply = () => {
      const keysOf = (k) => samplesToLocal(c, smoothTrack(samples[k], TRACK_SMOOTH));
      if (multi) { d.ptk = idxs.map((i, k) => spliceKeys(basePtk[i], L0, keysOf(k))); }
      else { const p0 = d.pts[0]; d.kf = spliceKeys(baseKf, L0, keysOf(0).map((s) => ({ t: s.t, dx: s.x - p0.x, dy: s.y - p0.y }))); }
    };
    vid.playbackRate = idxs.length > 2 ? 0.5 : 1;
    let last = v0, n = 0;
    await new Promise((res) => {
      let done = false;
      const finish = () => { if (done) return; done = true; vid.pause(); res(); };
      // el vídeo está oculto en el editor (se pinta en el lienzo), así que se mira cada vez que el navegador pinta
      const schedule = () => requestAnimationFrame(() => onFrame(0, null));
      const onFrame = (_now, meta) => {
        if (done) return;
        if (S.tracking.cancel) return finish();
        const vt = meta?.mediaTime ?? vid.currentTime;
        if (vt <= last + 1e-4) { if (vid.ended || vid.paused) return finish(); return schedule(); }
        const gap = Math.max(1, Math.round((vt - last) * 25)); last = vt;
        img = grab();
        trackers.forEach((tr, k) => {
          if (!alive[k]) return;
          const r = tr.update(img, gap);
          if (r.lost) { alive[k] = false; if (lostAt == null) lostAt = vt; }
          else samples[k].push({ vt, x: r.x / TW, y: r.y / TH });
        });
        n++;
        if (n % 4 === 0) { apply(); S.L = localOfVideo(c, vt); }
        $("#trackBar").style.width = clamp(((vt - v0) / (vEnd - v0)) * 100, 0, 100) + "%";
        if (vt >= vEnd - 0.02 || !alive.some(Boolean) || vid.ended) return finish();
        schedule();
      };
      vid.play().then(schedule).catch(() => { toast("No se ha podido reproducir el vídeo"); finish(); });
    });
    vid.playbackRate = 1;
    apply(); d.tracked = true;
    const cancelled = S.tracking.cancel;
    S.tracking = null; $("#trackOv").classList.remove("on");
    if (!multi && lostAt != null) d.to = Math.max(L0 + 0.3, Math.min(d.to, localOfVideo(c, lostAt) + 0.3));
    seekLocal(L0); autosave(); renderTimeline(); renderProps();
    if (cancelled) toast("Seguimiento parado: hecho hasta donde ha llegado");
    else if (lostAt != null) toast(`Se ha perdido ${multi ? "algún jugador" : "al jugador"} en ${fmt(localOfVideo(c, lostAt), 1)}: ve a ese momento, coloca la marca y pulsa otra vez «Seguir desde aquí»`);
    else toast("Seguimiento hecho. Si en algún momento se va a otro jugador, arrástrala a su sitio y vuelve a pulsar «Seguir desde aquí»");
  }

  // ---- panel de propiedades ----
  function renderProps() {
    const c = curClip(); const el = $("#props");
    if (!c) { el.innerHTML = `<h3>Editor</h3><div class="hint">Lleva clips desde la playlist para empezar a dibujar.</div>`; return; }
    if (S.calib && !calFreeze()) S.calib = null;
    $("#eCalib").classList.toggle("on", !!S.calib);
    if (S.calib) { el.innerHTML = calibPanel(); bindCalibPanel(el); return; }
    const d = c.drawings.find((x) => x.id === S.sel);
    const st = d || S.style;
    const sw = PALETTE.map((col) => `<i style="background:${col}" class="${st.color.toLowerCase() === col.toLowerCase() ? "on" : ""}" data-c="${col}"></i>`).join("");
    let h = "";
    if (d) {
      h += `<h3>${TOOL_NAMES[d.type]}</h3>`;
      if (d.type === "text" || d.type === "ring") h += `<div class="f"><label>${d.type === "ring" ? "Nombre / dorsal" : "Texto"}</label><input id="pText" value="${esc(d.text)}" style="width:140px"></div>`;
      if (TRACKABLE.includes(d.type)) {
        const tracked = d.tracked || hasOwnTracks(d);
        h += `<div class="track"><button class="pri" id="pTrack">🎯 Seguir ${MULTI.includes(d.type) ? "a los jugadores" : "al jugador"} desde aquí</button>
          <div class="f"><label>Altura del jugador</label><input type="range" id="pTrackH" min="0.03" max="0.35" step="0.005" value="${d.trackH || 0.09}"></div>
          ${tracked ? "" : `<div class="hint">${MULTI.includes(d.type) ? "Cada punto tiene que estar en los pies de un jugador." : "Pon la marca en los pies del jugador."} Ajusta la altura hasta que el recuadro naranja cubra al jugador de pies a cabeza y pulsa el botón.</div>`}
          ${tracked ? `<div class="fixBox"><b>Corregir el seguimiento</b>
            <div class="hint">Ve al momento en que se equivoca (barra de tiempo o <kbd>,</kbd> <kbd>.</kbd> fotograma a fotograma) y <b>arrastra la marca</b> al jugador: se corrige ese momento y, suavemente, lo de alrededor. La línea naranja es por dónde ha pasado y la blanca por dónde va a ir. Si desde ahí sigue a otro, pulsa «🎯 Seguir desde aquí» y vuelve a seguir desde el sitio corregido.</div>
            <div class="f"><label>Alcance de la corrección</label><span><input type="range" id="pFixWin" min="0.2" max="3" step="0.1" value="${d.fixWin || FIX_WIN}"> <small id="pFixWinV">±${(d.fixWin || FIX_WIN).toFixed(1).replace(".", ",")} s</small></span></div>
            <div class="btnrow"><button id="pTrackCut" title="El dibujo desaparece en este momento">✂ Termina aquí</button><button id="pTrackClear">Quitar seguimiento</button></div></div>` : ""}</div>`;
      }
    } else {
      h += `<h3>${S.tool === "select" ? "Clip" : "Nuevo: " + TOOL_NAMES[S.tool]}</h3>`;
      if (S.tool === "select") h += `<div class="f"><label>${esc(c.label)}</label><span style="color:var(--mut)">${fmt(c.tin)} → ${fmt(c.tout)}</span></div>
        <div class="btnrow"><button data-trim="in-">Inicio −1s</button><button data-trim="in+">Inicio +1s</button><button data-trim="out-">Fin −1s</button><button data-trim="out+">Fin +1s</button></div>`;
    }
    h += `<div class="f"><label>Color</label><div class="sw">${sw}</div></div>
      <div class="f"><label>Grosor</label><input type="range" id="pW" min="1" max="12" value="${st.width}"></div>
      <div class="f"><label>Discontinua</label><input type="checkbox" id="pDash" ${st.dash ? "checked" : ""}></div>
      <div class="f"><label>Relleno zonas</label><input type="range" id="pFill" min="0" max="0.7" step="0.05" value="${st.fill}"></div>
      <div class="f"><label>Animar al aparecer</label><input type="checkbox" id="pAnim" ${st.anim ? "checked" : ""}></div>`;
    if (d) {
      h += `<h3>Tiempo</h3><div class="f"><label>Aparece</label><span><input type="number" id="pFrom" step="0.1" value="${d.from.toFixed(1)}"> s</span></div>
        <div class="f"><label>Desaparece</label><span><input type="number" id="pTo" step="0.1" value="${d.to.toFixed(1)}"> s</span></div>
        <div class="btnrow"><button id="pFromNow">Aparece aquí</button><button id="pToNow">Termina aquí</button></div>`;
      if (!MULTI.includes(d.type) && d.type !== "arrow" && d.type !== "curve" && d.type !== "line" && !d.tracked) {
        h += `<h3>Mover a mano</h3><div class="f"><label>Keyframes al arrastrar</label><input type="checkbox" id="pFollow" ${d.follow ? "checked" : ""}></div>
          <div class="hint">Avanza el vídeo y arrastra el dibujo en varios momentos: entre punto y punto se mueve solo (${(d.kf || []).length} keyframes).</div>`;
      }
      h += `<h3>Acciones</h3><div class="btnrow"><button id="pDup">Duplicar</button><button id="pDel" style="color:var(--bad)">Borrar (Supr)</button></div>`;
    } else if (S.tool === "select") {
      h += `<div class="hint" style="margin-top:12px"><b>Cómo funciona</b><br>1. Para el vídeo donde quieras explicar algo y pulsa <b>❄ Congelar</b>.<br>2. Elige una herramienta a la izquierda y dibuja.<br>3. Lo que dibujas en un congelado dura lo que dura el congelado; en vídeo en movimiento, 4 s (se cambia en la línea de tiempo).<br>4. Para que una marca, un foco o una línea de jugadores siga a los jugadores: selecciónala y pulsa <b>🎯 Seguir</b>.<br><br><kbd>Espacio</kbd> play · <kbd>↑</kbd><kbd>↓</kbd> velocidad · <kbd>,</kbd> <kbd>.</kbd> fotograma · <kbd>Supr</kbd> borrar · <kbd>Ctrl+Z</kbd> deshacer</div>`;
      if (S.selFreeze) {
        const sol = S.selFreeze.cal ? solved(S.selFreeze.cal) : null;
        h += `<h3>Congelado</h3><div class="f"><label>Duración</label><span><input type="number" id="pFz" step="0.5" min="0.5" value="${S.selFreeze.dur}"> s</span></div>
          <div class="f"><label>Campo</label><span style="color:${sol ? "var(--good,#2fbf71)" : "var(--mut)"}">${sol ? "📐 Calibrado" : "Sin calibrar"}</span></div>
          <div class="btnrow"><button id="pFzCal">${sol ? "Revisar calibración" : "📐 Calibrar el campo"}</button><button id="pFzDel" style="color:var(--bad)">Quitar congelado</button></div>`;
      }
    } else {
      h += `<div class="hint" style="margin-top:12px">${{
        arrow: "Arrastra desde el origen hasta el destino.", curve: "Arrastra de origen a destino; luego, con Seleccionar, mueve el punto central para curvarla.", line: "Arrastra para trazar la línea.",
        poly: "Clic en los pies de cada jugador (p. ej. la línea defensiva). Doble clic o Intro para terminar. Después puedes pulsar «Seguir» para que la línea se mueva con ellos.", zone: "Clic en cada vértice. Doble clic o Intro para cerrar la zona.",
        ellipse: "Arrastra desde el centro hacia fuera. Se dibuja aplanada, como pegada al césped.", spot: "Clic en los pies del jugador (o arrastra para el tamaño).",
        ring: "Clic en los pies del jugador y escribe su nombre o dorsal.", rect: "Arrastra de una esquina a la contraria. Con el campo calibrado sale tumbada en el césped, con sus medidas en metros.",
        measure: "Arrastra de un punto a otro del césped: sale la distancia en metros. Necesita el campo calibrado (botón 📐).", text: "Clic donde quieras el texto y escríbelo a la derecha.", mag: "Clic donde quieras ampliar; arrastra para el tamaño." }[S.tool]}</div>`;
    }
    el.innerHTML = h;
    const tgt = d || S.style;
    const ch = (fn) => { if (d) snapshot(); fn(); if (d) { autosave(); renderTimeline(); } };
    el.querySelectorAll(".sw i").forEach((i) => on(i, "click", () => { ch(() => (tgt.color = i.dataset.c)); renderProps(); }));
    on($("#pW"), "input", (e) => { tgt.width = +e.target.value; if (d) autosave(); });
    on($("#pDash"), "change", (e) => ch(() => (tgt.dash = e.target.checked)));
    on($("#pFill"), "input", (e) => { tgt.fill = +e.target.value; if (d) autosave(); });
    on($("#pAnim"), "change", (e) => ch(() => (tgt.anim = e.target.checked)));
    const pt = $("#pText"); if (pt) on(pt, "input", (e) => { d.text = e.target.value; autosave(); });
    if (d) {
      const L = clipLen(c);
      on($("#pFrom"), "change", (e) => ch(() => (d.from = clamp(+e.target.value, 0, d.to - 0.1))));
      on($("#pTo"), "change", (e) => ch(() => (d.to = clamp(+e.target.value, d.from + 0.1, L))));
      on($("#pFromNow"), "click", () => { ch(() => (d.from = Math.min(S.L, d.to - 0.1))); renderProps(); });
      on($("#pToNow"), "click", () => { ch(() => (d.to = Math.max(S.L, d.from + 0.1))); renderProps(); });
      const fol = $("#pFollow"); if (fol) on(fol, "change", (e) => { ch(() => (d.follow = e.target.checked)); if (d.follow) toast("Avanza el vídeo y arrastra la marca sobre el jugador"); });
      const tb = $("#pTrack"); if (tb) on(tb, "click", () => autoTrack(d));
      const th = $("#pTrackH"); if (th) on(th, "input", (e) => { d.trackH = +e.target.value; autosave(); });
      const fw = $("#pFixWin"); if (fw) on(fw, "input", (e) => { d.fixWin = +e.target.value; $("#pFixWinV").textContent = "±" + d.fixWin.toFixed(1).replace(".", ",") + " s"; autosave(); });
      const tcut = $("#pTrackCut"); if (tcut) on(tcut, "click", () => { ch(() => (d.to = Math.max(d.from + 0.1, S.L))); renderProps(); toast("El dibujo termina en " + fmt(S.L, 1)); });
      const tc = $("#pTrackClear"); if (tc) on(tc, "click", () => { ch(() => { const cur = ptsAt(d, S.L); d.pts = cur; d.kf = []; d.ptk = null; d.tracked = false; }); renderProps(); });
      on($("#pDup"), "click", () => { snapshot(); const n = JSON.parse(JSON.stringify(d)); n.id = uid(); n.pts = n.pts.map((p) => ({ x: p.x + 0.02, y: p.y + 0.02 })); n.kf = []; n.ptk = null; n.tracked = false; c.drawings.push(n); S.sel = n.id; afterCreate(); });
      on($("#pDel"), "click", delSel);
    }
    el.querySelectorAll("[data-trim]").forEach((b) => on(b, "click", () => trimClip(c, b.dataset.trim)));
    const fz = $("#pFz");
    if (fz) {
      on(fz, "change", (e) => { snapshot(); const nd = Math.max(0.5, +e.target.value); shiftAfter(c, freezeStartL(c, S.selFreeze) + S.selFreeze.dur, nd - S.selFreeze.dur); S.selFreeze.dur = nd; autosave(); renderTimeline(); });
      on($("#pFzCal"), "click", () => { seekLocal(freezeStartL(c, S.selFreeze) + 0.01); startCalib(); });
      on($("#pFzDel"), "click", () => { snapshot(); const f = S.selFreeze, s = freezeStartL(c, f); shiftAfter(c, s + f.dur, -f.dur, s); c.freezes = c.freezes.filter((x) => x !== f); S.selFreeze = null; seekLocal(Math.min(S.L, clipLen(c))); autosave(); renderTimeline(); renderProps(); });
    }
  }
  function delSel() { const c = curClip(); if (!c || !S.sel) return; snapshot(); c.drawings = c.drawings.filter((d) => d.id !== S.sel); S.sel = null; autosave(); renderTimeline(); renderProps(); renderClips(); }
  // mueve en el tiempo todo lo que está a partir de `at` (al poner o quitar congelados)
  function shiftAfter(c, at, delta, floor) {
    const f = (t) => (t >= at - 1e-6 ? t + delta : floor != null && t > floor ? floor : t);
    c.drawings.forEach((d) => {
      d.from = f(d.from); d.to = Math.max(d.from + 0.1, f(d.to));
      (d.kf || []).forEach((k) => (k.t = f(k.t)));
      (d.ptk || []).forEach((tk) => (tk || []).forEach((k) => (k.t = f(k.t))));
    });
  }
  function trimClip(c, how) {
    snapshot();
    if (how === "in-") setClipRange(c, c.tin - 1, c.tout); if (how === "in+") setClipRange(c, Math.min(c.tout - MIN_CLIP, c.tin + 1), c.tout);
    if (how === "out-") setClipRange(c, c.tin, Math.max(c.tin + MIN_CLIP, c.tout - 1)); if (how === "out+") setClipRange(c, c.tin, c.tout + 1);
    seekLocal(Math.min(S.L, clipLen(c))); autosave(); renderProps(); renderTimeline(); renderClips(); renderMarks();
  }

  // ---- congelar ----
  on($("#eFreeze"), "click", () => {
    const c = curClip(); if (!c) return; pause(); const m = mapL(c, S.L);
    if (m.frozen) return toast("Ya estás en un congelado");
    const dur = Math.max(0.5, +$("#eFreezeDur").value || 3);
    snapshot(); const f = makeFreeze(c, dur);
    S.selFreeze = f; if (S.tool === "select") S.tool = "arrow"; renderTools();
    autosave(); renderTimeline(); renderProps(); toast("Imagen congelada " + dur + " s · dibuja encima");
  });

  // ---- línea de tiempo ----
  function renderTimeline() {
    const seq = $("#seq"), det = $("#det"); const c = curClip();
    $("#editEmpty").style.display = S.seq.length ? "none" : "flex"; cv.style.display = S.seq.length ? "" : "none";
    const tot = S.seq.reduce((a, id) => a + clipLen(clipById(id)), 0);
    $("#tlInfo").textContent = S.seq.length ? ` · ${S.seq.length} ${S.seq.length === 1 ? "clip" : "clips"} · ${fmt(tot)} en total · arrastra los bloques para cambiar el orden` : "";
    seq.innerHTML = S.seq.map((id) => { const k = clipById(id); return `<div class="blk ${id === S.cur ? "act" : ""}" draggable="true" data-id="${id}" style="--c:${k.color};width:${Math.max(70, clipLen(k) * 7)}px">${esc(k.label)}<small>${fmt(k.tin)} · ${clipLen(k).toFixed(0)}s${k.drawings.length ? " · ✎" + k.drawings.length : ""}</small></div>`; }).join("");
    seq.querySelectorAll(".blk").forEach((b) => {
      on(b, "click", () => { if (S.tracking) return; pause(); S.cur = b.dataset.id; S.sel = null; S.selFreeze = null; seekLocal(0); renderTimeline(); renderProps(); });
      on(b, "dragstart", (e) => e.dataTransfer.setData("text/plain", b.dataset.id));
      on(b, "dragover", (e) => e.preventDefault());
      on(b, "drop", (e) => { e.preventDefault(); e.stopPropagation(); const from = e.dataTransfer.getData("text/plain"), to = b.dataset.id; if (!from || from === to) return; snapshot(); const a = S.seq.filter((x) => x !== from); a.splice(a.indexOf(to), 0, from); S.seq = a; autosave(); renderTimeline(); });
    });
    if (!c) { det.innerHTML = ""; return; }
    const L = clipLen(c), W = det.clientWidth - 20 || 600, px = W / L;
    const step = L > 60 ? 10 : L > 25 ? 5 : L > 10 ? 2 : 1;
    let h = `<div class="ruler" id="ruler">`; for (let t = 0; t <= L; t += step) h += `<div class="tick" style="left:${t * px}px">${t}s</div>`; h += `</div>`;
    c.freezes.forEach((f) => { const s = freezeStartL(c, f); h += `<div class="frz ${S.selFreeze === f ? "sel" : ""}" data-fz="${f.id}" style="left:${10 + s * px}px;width:${f.dur * px}px"><span>❄ ${f.dur}s</span></div>`; });
    c.drawings.forEach((d) => {
      const kf = d.kf || []; const tracked = d.tracked || hasOwnTracks(d);
      const keys = tracked ? "" : kf.length <= 40 ? kf.map((k) => `<div class="kf" style="left:${(k.t - d.from) * px}px"></div>`).join("") : "";
      let trk = "";
      if (tracked) { const all = [...kf, ...(d.ptk || []).flat().filter(Boolean)]; if (all.length) { const a = Math.min(...all.map((k) => k.t)), b = Math.max(...all.map((k) => k.t)); trk = `<div class="trk" style="left:${Math.max(0, (a - d.from) * px)}px;width:${Math.max(2, (b - a) * px)}px"></div>`; } }
      h += `<div class="lane"><div class="dbar ${d.id === S.sel ? "sel" : ""}" data-d="${d.id}" style="--c:${d.color === "#111111" ? "#888" : d.color};left:${d.from * px}px;width:${Math.max(8, (d.to - d.from) * px)}px">
        <div class="h l" data-e="l"></div>${tracked ? "🎯 " : ""}${TOOL_NAMES[d.type]}${d.text ? " · " + esc(d.text) : ""}${keys}${trk}<div class="h r" data-e="r"></div></div></div>`;
    });
    if (!c.drawings.length) h += `<div style="color:var(--mut);padding:10px 0">Sin dibujos en este clip. Congela la imagen o dibuja sobre el vídeo en movimiento.</div>`;
    h += `<div class="phead" id="phead"></div>`;
    det.innerHTML = h;
    const toT = (x) => clamp((x - det.getBoundingClientRect().left - 10 + det.scrollLeft) / px, 0, L);
    on($("#ruler"), "pointerdown", (e) => { if (S.tracking) return; pause(); const mv = (ev) => seekLocal(toT(ev.clientX)); mv(e); const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); }; addEventListener("pointermove", mv); addEventListener("pointerup", up); });
    det.querySelectorAll(".frz").forEach((z) => on(z, "click", () => { S.selFreeze = c.freezes.find((f) => f.id === z.dataset.fz); S.sel = null; S.tool = "select"; renderTools(); seekLocal(freezeStartL(c, S.selFreeze) + 0.01); renderTimeline(); renderProps(); }));
    det.querySelectorAll(".dbar").forEach((b) => on(b, "pointerdown", (e) => {
      if (S.tracking) return;
      e.stopPropagation(); const d = c.drawings.find((x) => x.id === b.dataset.d); S.sel = d.id; S.selFreeze = null; S.tool = "select"; renderTools();
      const edge = e.target.dataset.e, x0 = e.clientX, f0 = d.from, t0 = d.to, k0 = (d.kf || []).map((k) => k.t), p0 = (d.ptk || []).map((tk) => (tk || []).map((k) => k.t)); snapshot(); let moved = false;
      const mv = (ev) => {
        moved = true; const dt = (ev.clientX - x0) / px;
        if (edge === "l") d.from = clamp(f0 + dt, 0, d.to - 0.1); else if (edge === "r") d.to = clamp(t0 + dt, d.from + 0.1, L);
        else { const dd = clamp(dt, -f0, L - t0); d.from = f0 + dd; d.to = t0 + dd; (d.kf || []).forEach((k, i) => (k.t = k0[i] + dd)); (d.ptk || []).forEach((tk, i) => (tk || []).forEach((k, j) => (k.t = p0[i][j] + dd))); }
        b.style.left = d.from * px + "px"; b.style.width = Math.max(8, (d.to - d.from) * px) + "px";
      };
      const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); if (!moved) { hist.pop(); if (!visible(d, S.L)) seekLocal(d.from + 0.01); } autosave(); renderTimeline(); renderProps(); };
      addEventListener("pointermove", mv); addEventListener("pointerup", up);
    }));
  }
  on($("#clipRemove"), "click", () => { if (!S.cur || S.tracking) return; snapshot(); const i = S.seq.indexOf(S.cur); S.seq = S.seq.filter((x) => x !== S.cur); S.cur = S.seq[Math.min(i, S.seq.length - 1)] || null; S.sel = null; seekLocal(0); autosave(); renderAll(); });
  on($("#ePlay"), "click", () => (S.playing ? pause() : play()));
  on($("#eFrameB"), "click", () => { pause(); seekLocal(S.L - 1 / 25); }); on($("#eFrameF"), "click", () => { pause(); seekLocal(S.L + 1 / 25); });
  on($("#eRate"), "change", (e) => { if (S.playing) vid.playbackRate = +e.target.value; e.target.blur(); });

  /* ---- dónde va la tabla de etiquetas: izquierda, debajo del vídeo o flotante (se arrastra por su barra) ---- */
  const tagsEl = root.querySelector("#tagView .tags");
  let dock = load("tagDock") || { at: "left", x: 80, y: 80, w: 300, h: 420 };
  function placeTags() {
    const tv = $("#tagView");
    tv.classList.remove("dock-left", "dock-bottom", "dock-float"); tv.classList.add("dock-" + dock.at);
    if (dock.at === "left") $("#tagDock").appendChild(tagsEl);
    else if (dock.at === "bottom") $("#tagView .left").appendChild(tagsEl);
    else {
      tv.appendChild(tagsEl);
      const W = tv.clientWidth || 1200, H = tv.clientHeight || 700;
      dock.w = clamp(dock.w, 220, Math.max(220, W - 20)); dock.h = clamp(dock.h, 160, Math.max(160, H - 20));
      dock.x = clamp(dock.x, 0, Math.max(0, W - 120)); dock.y = clamp(dock.y, 0, Math.max(0, H - 60));
      Object.assign(tagsEl.style, { left: dock.x + "px", top: dock.y + "px", width: dock.w + "px", height: dock.h + "px" });
    }
    if (dock.at !== "float") Object.assign(tagsEl.style, { left: "", top: "", width: "", height: "" });
    $$("[data-dock]").forEach((b) => b.classList.toggle("on", b.dataset.dock === dock.at));
  }
  $$("[data-dock]").forEach((b) => on(b, "click", () => { dock = { ...dock, at: b.dataset.dock }; store("tagDock", dock); placeTags(); b.blur(); }));
  on(tagsEl.querySelector(".tagsHead"), "pointerdown", (e) => {
    if (dock.at !== "float" || e.target.closest("button,select,input")) return;
    e.preventDefault(); const x0 = e.clientX, y0 = e.clientY, ox = dock.x, oy = dock.y;
    const mv = (ev) => { dock.x = ox + ev.clientX - x0; dock.y = oy + ev.clientY - y0; placeTags(); };
    const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); store("tagDock", dock); };
    addEventListener("pointermove", mv); addEventListener("pointerup", up);
  });
  // tamaño de la flotante (se cambia por la esquina de abajo a la derecha)
  const dockRO = new ResizeObserver(() => { if (dock.at === "float" && tagsEl.offsetWidth) { dock.w = tagsEl.offsetWidth; dock.h = tagsEl.offsetHeight; store("tagDock", dock); } });
  dockRO.observe(tagsEl); cleanups.push(() => dockRO.disconnect());
  placeTags();

  /* ---- otra pantalla: una ventana aparte que enseña el vídeo (con los dibujos) para llevarla al monitor ---- */
  let ext = null;
  function openExternal() {
    if (ext && !ext.win.closed) { ext.win.focus(); return; }
    const win = window.open("", "rsvExternal", "width=1280,height=720");
    if (!win) return toast("El navegador ha bloqueado la ventana: permite las ventanas emergentes de esta página");
    win.document.title = "RS Video · pantalla";
    win.document.body.innerHTML = `<style>html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:system-ui,sans-serif}canvas{position:absolute;inset:0;width:100%;height:100%}
      #fs{position:fixed;right:14px;bottom:14px;background:rgba(0,0,0,.6);color:#fff;border:1px solid #555;border-radius:8px;padding:8px 12px;cursor:pointer;opacity:.85}
      body:fullscreen #fs{display:none}#hint{position:fixed;left:14px;bottom:14px;color:#bbb;font-size:13px;background:rgba(0,0,0,.6);padding:6px 10px;border-radius:6px}</style>
      <canvas id="c"></canvas><div id="hint">Arrastra esta ventana al otro monitor y pulsa «Pantalla completa»</div><button id="fs">⛶ Pantalla completa</button>`;
    const c = win.document.getElementById("c");
    win.document.getElementById("fs").onclick = () => { win.document.documentElement.requestFullscreen?.().catch(() => {}); win.document.getElementById("hint").remove(); };
    ext = { win, c, g: c.getContext("2d") };
    root.classList.add("ext"); $("#rsvExt").classList.add("on"); setTimeout(sizeCanvas, 50);
    toast("Vídeo en otra ventana: llévala al monitor. Aquí tienes más sitio para etiquetas y línea de tiempo");
  }
  function closeExternal() { if (!ext) return; try { if (!ext.win.closed) ext.win.close(); } catch { /* ya cerrada */ } ext = null; root.classList.remove("ext"); $("#rsvExt").classList.remove("on"); setTimeout(sizeCanvas, 50); }
  on($("#rsvExt"), "click", (e) => { e.currentTarget.blur(); ext ? closeExternal() : openExternal(); });
  cleanups.push(closeExternal);
  function drawExternal() {
    if (!ext) return; if (ext.win.closed) { closeExternal(); return; }
    const c = ext.c, dpr = ext.win.devicePixelRatio || 1, W = Math.round(ext.win.innerWidth * dpr), H = Math.round(ext.win.innerHeight * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = ext.g; g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    const vw = S.video?.w || 16, vh = S.video?.h || 9, s = Math.min(W / vw, H / vh), w = vw * s, h = vh * s, x = (W - w) / 2, y = (H - h) / 2;
    if (S.mode === "edit" && curClip()) { g.save(); g.translate(x, y); render(g, w, h, curClip(), S.L, { clean: true }); g.restore(); }
    else if (vid.readyState >= 2) g.drawImage(vid, x, y, w, h);
  }

  /* ---- bucle principal ---- */
  let raf = 0, alive = true;
  function loop(now) {
    if (!alive) return;
    if (S.mode === "tag") tagTick();
    else if (!S.exporting) {
      if (!S.tracking) engineTick(now);
      const c = curClip();
      if (c && cv.width) {
        render(ctx, cv.width, cv.height, c, S.L);
        const L = clipLen(c); $("#eTime").innerHTML = `<b>${fmt(S.L, 1)}</b> / ${fmt(L, 1)}` + (mapL(c, S.L).frozen ? ' <span style="color:#5aaaff">❄ congelado</span>' : "");
        const ph = $("#phead"), det = $("#det"); if (ph && det) ph.style.left = 10 + S.L * ((det.clientWidth - 20) / L) + "px";
      }
    }
    if (ext && !S.exporting) drawExternal();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  /* ---- teclado ---- */
  on(window, "keydown", (e) => {
    if (!root.isConnected || root.offsetParent === null && !document.fullscreenElement) return;
    if (e.target.matches?.("input,select,textarea")) { if (e.key === "Enter") e.target.blur(); return; }
    if (root.querySelector(".dlg.on") || S.tracking || S.exporting) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === "arrowup" || k === "arrowdown") { e.preventDefault(); const sel = S.mode === "tag" ? $("#tRate") : $("#eRate"); setRate(stepRate(+sel.value, k === "arrowup" ? 1 : -1)); return; }
    if (S.mode === "tag") {
      if (!S.video) return;
      if (k === " ") { e.preventDefault(); vid.paused ? vid.play() : vid.pause(); return; }
      if (k === "arrowleft") { e.preventDefault(); vid.currentTime -= e.shiftKey ? 10 : 2; return; } if (k === "arrowright") { e.preventDefault(); vid.currentTime += e.shiftKey ? 10 : 2; return; }
      if (k === ",") { vid.pause(); vid.currentTime -= 1 / 25; return; } if (k === ".") { vid.pause(); vid.currentTime += 1 / 25; return; }
      const t = tags().find((x) => x.key && x.key === k); if (t) { e.preventDefault(); fireTag(t.id); }
    } else {
      if (k === " ") { e.preventDefault(); S.playing ? pause() : play(); return; }
      if (k === ",") { pause(); seekLocal(S.L - 1 / 25); return; } if (k === ".") { pause(); seekLocal(S.L + 1 / 25); return; }
      if (k === "arrowleft") { e.preventDefault(); pause(); seekLocal(S.L - (e.shiftKey ? 5 : 1)); return; } if (k === "arrowright") { e.preventDefault(); pause(); seekLocal(S.L + (e.shiftKey ? 5 : 1)); return; }
      if (k === "delete" || k === "backspace") { e.preventDefault(); delSel(); return; }
      if (k === "enter") { finishDraft(); return; } if (k === "escape") { if (S.calib) return endCalib(); S.draft = null; S.sel = null; renderProps(); renderTimeline(); return; }
      if (S.calib) return;
      if (TOOL_KEYS[k]) setTool(TOOL_KEYS[k]);
    }
  });

  /* ---- intro y marca de agua ---- */
  const imgCache = new Map();
  const imgOf = (src) => { if (!src) return null; let im = imgCache.get(src); if (!im) { im = new Image(); im.onload = () => drawBrandPreviews(); im.src = src; imgCache.set(src, im); } return im.complete && im.naturalWidth ? im : null; };
  const saveBrand = () => { if (!store("brand", S.brand)) toast("La imagen es muy grande para recordarla; se usará solo ahora"); };
  function fitImage(file, max = 600) {
    return new Promise((res, rej) => {
      const r = new FileReader(); r.onerror = rej;
      r.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => { const s = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement("canvas"); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL("image/png")); }; im.src = r.result; };
      r.readAsDataURL(file);
    });
  }
  function drawIntro(g, W, H, t, dur) {
    const B = S.brand.intro; const a = clamp(Math.min(t / 0.5, (dur - t) / 0.5), 0, 1);
    g.fillStyle = B.bg || "#36000D"; g.fillRect(0, 0, W, H);
    g.save(); g.globalAlpha = a;
    const im = imgOf(B.img); const hasText = B.title || B.sub;
    let y = H * (hasText ? 0.42 : 0.5);
    if (im) { const ih = H * (hasText ? 0.38 : 0.5), iw = (ih * im.naturalWidth) / im.naturalHeight; const z = 0.92 + 0.08 * clamp(t / 0.8, 0, 1); g.drawImage(im, W / 2 - (iw * z) / 2, y - (ih * z) / 2, iw * z, ih * z); y += ih / 2 + H * 0.09; }
    else y = H * 0.45;
    g.textAlign = "center"; g.textBaseline = "middle";
    const n = parseInt((B.bg || "#36000D").slice(1), 16); const lum = ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11; const fg = lum > 150 ? "#111" : "#fff";
    if (B.title) { g.fillStyle = fg; g.font = `700 ${H * 0.075}px 'IBM Plex Sans Condensed','Barlow Condensed',sans-serif`; g.fillText(B.title.toUpperCase(), W / 2, y); y += H * 0.075; }
    if (B.sub) { g.fillStyle = lum > 150 ? "#73000A" : "#FF6E00"; g.font = `600 ${H * 0.052}px 'IBM Plex Sans Condensed','Barlow Condensed',sans-serif`; g.fillText(B.sub, W / 2, y); }
    g.restore();
  }
  function drawWatermark(g, W, H) {
    const B = S.brand.wm; if (!B.on) return;
    const im = imgOf(B.img); if (!im && !B.text) return;
    const m = H * 0.03, ih = (H * B.size) / 100; const iw = im ? (ih * im.naturalWidth) / im.naturalHeight : 0;
    g.save(); g.globalAlpha = B.op;
    const fs = ih * 0.38; g.font = `700 ${fs}px 'IBM Plex Sans Condensed','Barlow Condensed',sans-serif`;
    const tw = B.text ? g.measureText(B.text).width : 0; const gap = im && B.text ? fs * 0.5 : 0; const tot = iw + gap + tw;
    const right = B.pos === "tr" || B.pos === "br", bottom = B.pos === "bl" || B.pos === "br";
    const x0 = right ? W - m - tot : m, yc = bottom ? H - m - ih / 2 : m + ih / 2;
    if (im) g.drawImage(im, x0, yc - ih / 2, iw, ih);
    if (B.text) { g.fillStyle = "#fff"; g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = fs * 0.2; g.textBaseline = "middle"; g.fillText(B.text, x0 + iw + gap, yc); }
    g.restore();
  }
  function drawBrandPreviews() {
    const pi = $("#bPrevIntro"), pw = $("#bPrevWm"); if (!pi || !$("#dlgExport").classList.contains("on")) return;
    const gi = pi.getContext("2d"); if (S.brand.intro.on) drawIntro(gi, pi.width, pi.height, 1, 3); else { gi.fillStyle = "#111"; gi.fillRect(0, 0, pi.width, pi.height); gi.fillStyle = "#666"; gi.font = "16px sans-serif"; gi.textAlign = "center"; gi.fillText("Sin intro", pi.width / 2, pi.height / 2); gi.textAlign = "left"; }
    const gw = pw.getContext("2d"); const c = curClip(); render(gw, pw.width, pw.height, c, S.L, { clean: true, watermark: true });
  }
  function bindBrand() {
    const I = S.brand.intro, Wm = S.brand.wm;
    const sync = () => {
      $("#bIntro").checked = I.on; $("#bIntroOpts").style.opacity = I.on ? 1 : 0.45; $("#bIntroTitle").value = I.title; $("#bIntroSub").value = I.sub; $("#bIntroBg").value = I.bg; $("#bIntroDur").value = I.dur;
      $("#bIntroThumb").style.backgroundImage = I.img ? `url(${I.img})` : "none";
      $("#bWm").checked = Wm.on; $("#bWmOpts").style.opacity = Wm.on ? 1 : 0.45; $("#bWmText").value = Wm.text; $("#bWmPos").value = Wm.pos; $("#bWmSize").value = Wm.size; $("#bWmOp").value = Wm.op;
      $("#bWmThumb").style.backgroundImage = Wm.img ? `url(${Wm.img})` : "none";
      drawBrandPreviews();
    };
    const set = (obj, k, v) => { obj[k] = v; saveBrand(); sync(); };
    on($("#bIntro"), "change", (e) => set(I, "on", e.target.checked));
    on($("#bIntroTitle"), "input", (e) => set(I, "title", e.target.value));
    on($("#bIntroSub"), "input", (e) => set(I, "sub", e.target.value));
    on($("#bIntroBg"), "input", (e) => set(I, "bg", e.target.value));
    on($("#bIntroDur"), "change", (e) => set(I, "dur", clamp(+e.target.value || 3, 1, 10)));
    on($("#bWm"), "change", (e) => set(Wm, "on", e.target.checked));
    on($("#bWmText"), "input", (e) => set(Wm, "text", e.target.value));
    on($("#bWmPos"), "change", (e) => set(Wm, "pos", e.target.value));
    on($("#bWmSize"), "input", (e) => set(Wm, "size", +e.target.value));
    on($("#bWmOp"), "input", (e) => set(Wm, "op", +e.target.value));
    let target = null;
    on($("#bIntroImgBtn"), "click", () => { target = I; $("#bImgIn").click(); });
    on($("#bWmImgBtn"), "click", () => { target = Wm; $("#bImgIn").click(); });
    on($("#bIntroImgDel"), "click", () => set(I, "img", null));
    on($("#bWmImgDel"), "click", () => set(Wm, "img", null));
    on($("#bImgIn"), "change", async (e) => {
      const f = e.target.files[0]; e.target.value = ""; if (!f || !target) return;
      try { const url = await fitImage(f); target.on = true; set(target, "img", url); } catch { toast("No se ha podido leer esa imagen"); }
    });
    return sync;
  }
  const syncBrand = bindBrand();

  /* ---- exportar ---- */
  let expBlob = null, expName = "";
  on($("#eExport"), "click", () => {
    if (!S.seq.length) return toast("No hay clips en el editor"); pause();
    const tot = S.seq.reduce((a, id) => a + clipLen(clipById(id)), 0);
    $("#expSeqDur").textContent = fmt(tot); $("#expClipDur").textContent = fmt(clipLen(curClip()));
    $("#expOpts").style.display = ""; $("#expRun").style.display = "none"; $("#expDone").style.display = "none";
    $("#dlgExport").classList.add("on"); syncBrand();
  });
  on($("#expCancel"), "click", () => $("#dlgExport").classList.remove("on"));
  on($("#expClose"), "click", () => $("#dlgExport").classList.remove("on"));
  on($("#expStop"), "click", () => { S._abort = true; });
  const pickMime = () => ["video/mp4;codecs=avc1.640028", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
  function seekWait(t) { return new Promise((r) => { if (Math.abs(vid.currentTime - t) < 0.01 && vid.readyState >= 2) return r(); const done = () => { vid.removeEventListener("seeked", done); r(); }; vid.addEventListener("seeked", done); vid.currentTime = t; }); }
  on($("#expGo"), "click", async () => {
    const scope = root.querySelector("[name=expScope]:checked").value;
    const ids = scope === "seq" ? [...S.seq] : [S.cur];
    const maxW = +$("#expQ").value; const s = Math.min(1, maxW / S.video.w);
    const oc = document.createElement("canvas"); oc.width = Math.round((S.video.w * s) / 2) * 2; oc.height = Math.round((S.video.h * s) / 2) * 2; const og = oc.getContext("2d");
    const mime = pickMime(); if (!mime) return toast("Este navegador no permite grabar vídeo; usa Chrome o Edge");
    $("#expOpts").style.display = "none"; $("#expRun").style.display = "";
    const intro = S.brand.intro.on ? S.brand.intro.dur : 0;
    const total = intro + ids.reduce((a, id) => a + clipLen(clipById(id)), 0); let done = 0;
    const stream = oc.captureStream(30); const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: maxW >= 1920 ? 10e6 : 5e6 });
    const chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    S.exporting = true; S._abort = false; const keepCur = S.cur, keepL = S.L, keepRate = $("#eRate").value; $("#eRate").value = "1";
    const wm = { clean: true, watermark: true };
    if (intro) drawIntro(og, oc.width, oc.height, 0, intro); else render(og, oc.width, oc.height, clipById(ids[0]), 0, wm);
    rec.start(500);
    if (intro) {
      $("#expMsg").textContent = "Grabando la intro…";
      await new Promise((res) => { const t0 = performance.now(); const step = () => { const t = (performance.now() - t0) / 1000; if (S._abort || t >= intro) return res(); drawIntro(og, oc.width, oc.height, t, intro); $("#expBar").style.width = (t / total) * 100 + "%"; requestAnimationFrame(step); }; requestAnimationFrame(step); });
      done = intro;
    }
    rec.pause();
    for (const id of ids) {
      if (S._abort) break;
      S.cur = id; const c = curClip(); $("#expMsg").textContent = "Grabando: " + c.label;
      await seekWait(c.tin); S.L = 0; lastVT = vid.currentTime;
      render(og, oc.width, oc.height, c, 0, wm); rec.resume();
      await new Promise((res) => {
        S.playing = true; S._wall = performance.now(); let fin = false;
        S._onClipEnd = () => { fin = true; };
        const step = (now) => {
          if (S._abort) fin = true;
          engineTick(now); render(og, oc.width, oc.height, c, S.L, wm);
          $("#expBar").style.width = ((done + S.L) / total) * 100 + "%";
          if (fin) { S._onClipEnd = null; S.playing = false; vid.pause(); res(); } else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      rec.pause(); done += clipLen(c);
    }
    rec.resume(); await new Promise((r) => setTimeout(r, 120));
    await new Promise((r) => { rec.onstop = r; rec.stop(); });
    S.exporting = false; S.cur = keepCur; seekLocal(keepL); $("#eRate").value = keepRate; $("#ePlay").textContent = "▶";
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    expBlob = new Blob(chunks, { type: mime.split(";")[0] });
    const base = (S.video.name.replace(/\.[^.]+$/, "") || "partido").slice(0, 60);
    expName = `${base} - ${scope === "seq" ? "analisis" : clipById(ids[0]).label}.${ext}`;
    $("#expRun").style.display = "none"; $("#expDone").style.display = "";
    $("#expDoneMsg").innerHTML = (S._abort ? "Exportación detenida. " : "Vídeo listo. ") + `<b>${esc(expName)}</b> · ${(expBlob.size / 1048576).toFixed(1)} MB`;
  });
  on($("#expSave"), "click", () => saveFile(expName, expBlob));
  let downloads;
  async function getDownloads() { if (downloads !== undefined) return downloads; try { downloads = window.claude?.use ? await window.claude.use("downloads") : null; } catch { downloads = null; } return downloads; }
  async function saveFile(name, blob) {
    const dl = await getDownloads();
    if (dl) { try { await dl.save({ filename: name, data: blob }); toast("Descargado"); return; } catch (e) { if (e?.code === "declined") return; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  /* ---- archivo de proyecto ---- */
  on($("#rsvSaveProj"), "click", () => {
    if (!S.clips.length) return toast("Todavía no hay nada que guardar");
    const data = JSON.stringify({ app: "rs-video", v: 2, video: S.video, tagSet: activeSet(), clips: S.clips, seq: S.seq }, null, 1);
    saveFile((S.video?.name || "partido").replace(/\.[^.]+$/, "") + " - proyecto.json", new Blob([data], { type: "application/json" }));
  });
  on($("#rsvLoadProj"), "click", () => $("#rsvProjIn").click());
  on($("#rsvProjIn"), "change", async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try {
      const o = JSON.parse(await f.text()); if (o.app !== "rs-video") throw 0; snapshot();
      const set = o.tagSet || (o.tags ? { name: "Tabla del proyecto", tags: o.tags } : null);
      if (set && !S.sets.some((x) => x.id === set.id)) { const c = own(cleanSet({ ...set, owner_id: undefined, shared: false })); c.name = uniqueName(c.name, S.sets); S.sets.push(c); S.setId = c.id; }
      S.clips = o.clips || []; S.seq = o.seq || [];
      if (!S.video || S.video.name !== o.video?.name) { S.pendingProj = { clips: S.clips, seq: S.seq }; toast("Proyecto cargado · ahora abre el vídeo «" + (o.video?.name || "") + "»"); }
      else toast("Proyecto cargado");
      autosave(); renderAll();
    } catch { toast("Ese archivo no es un proyecto de RS Video"); }
  });

  if (remote) loadRemote();

  function renderAll() { renderSetSel(); renderTagGrid(); renderClips(); renderMarks(); renderTools(); renderProps(); if (S.mode === "edit") renderTimeline(); }
  renderAll();

  return {
    destroy() {
      alive = false; cancelAnimationFrame(raf); clearTimeout(saveT);
      if (remote && saved) { clearTimeout(syncT); syncSets(); } // lo último que se cambió se guarda aunque se salga de la página
      if (S.tracking) S.tracking.cancel = true;
      vid.pause(); if (vid.src) URL.revokeObjectURL(vid.src);
      cleanups.forEach((f) => f());
      root.innerHTML = ""; root.classList.remove("rsv");
    },
  };
}
