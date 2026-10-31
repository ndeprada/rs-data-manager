import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Activity, BoxSelect, Hand, Maximize, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Circle, Copy, Film, Image as ImageIcon, Layers, MousePointer2, MoveUpRight, Pause, Pentagon, Play, Plus, Repeat, Spline, Square, TrendingUp, Triangle, Type, Trash2, Undo2, Redo2, Waypoints, Settings2, LogOut, Users, Keyboard, Minus, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AIR_MAX, FIELDS, LOOKS, MATERIALS, MAX_FRAMES, MAX_TEAMS, ORIENTS, addElement, addFrame, addTeam, alignElements, arrowPoints, changeField, chipOf, defaultControl, distributeElements, drawOrder, duplicateFrame, elementsInBox, faceToward, fieldOf, fromView, toView, tokenR,
  boardMode, boardSpeed, camOf, panCam, viewBox, zoomCam, ZOOM_STEPS, ghostsOf, hitTest, hitTestPersp, isCarried, isPersp, perspBoost, paintOrder, perspectiveOf, VIEWS, isLinkable, isMovable, isQuad, isSideways, lerpFrames, lookOf, marginOf, isStadium, hasStands, hasAds, materialOf, moveFrame, moveLayer, moveLayerTo, newId, normalizeBoard, nudgeElements, orderForLine, orientOf, patchElement, recolorElements, removeElement,
  insertVia, removeVia, firstBend, elementBounds, unionBounds, removeElements, removeFrame, removeTeam, resizeElements, setAllChips, setAllFeet, setBibOf, setFeetOf, turnElements, setTeamOf, shiftElement, spreadElements, stepLayer, teamInUse, teamsOf, liftNormal, zoneCorners,
} from "@/lib/board";
import Board, { ChipGlyph, styleOf } from "./BoardSvg";
import { boardKeyAction } from "@/lib/boardKeys";
import BoardHelp from "./BoardHelp";
import { DummyIcon, GoalIcon, HurdleIcon, LadderIcon, PoleIcon } from "./BoardControls";
import BoardProps, { ARROW_PRESETS, KIND_LABEL, typeOfArrow } from "./BoardProps";
import BoardDownloads from "./BoardDownloads";
import ChipQuickEdit from "./BoardChipEdit";
import MultiPanel, { LayerButtons, LayerList } from "./BoardMulti";

// Editor de la pizarra: fichas de hasta cinco equipos (cada uno de su color), balón, conos, porterías, flechas (rectas,
// curvas o por el aire), zonas y textos, con fotogramas para animar el movimiento. Mismo editor para tareas de
// entrenamiento, tácticas y balón parado.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = (n) => Math.round(n * 10) / 10;

const OBJECT_TOOLS = [
  { id: "ball", label: "Balón", icon: Circle, ring: true },
  { id: "cone", label: "Cono", icon: Triangle, color: "#f97316" },
  { id: "goal", label: "Portería", icon: GoalIcon, color: "#6b7280" },
  { id: "pole", label: "Pica", icon: PoleIcon, color: "#eab308" },
  { id: "hurdle", label: "Valla", icon: HurdleIcon, color: "#2563eb" },
  { id: "ladder", label: "Escalera de coordinación", icon: LadderIcon, color: "#f59e0b" },
  { id: "dummy", label: "Maniquí", icon: DummyIcon, color: "#6b7280" },
];
const MATERIAL_IDS = MATERIALS.map((m) => m.id);
const LINE_TOOLS = [
  { id: "move", label: "Desplazamiento", icon: MoveUpRight },
  { id: "pass", label: "Pase", icon: Spline, color: "#2563eb" },
  { id: "air", label: "Pase aéreo (con sombra)", icon: TrendingUp, color: "#2563eb" },
  { id: "dribble", label: "Conducción", icon: Activity, color: "#73000A" },
  { id: "zone", label: "Zona", icon: Square },
  { id: "quad", label: "Zona 4 esquinas", icon: Pentagon },
  { id: "link", label: "Unir fichas", icon: Waypoints },
  { id: "text", label: "Texto", icon: Type },
];
const ARROW_TOOLS = ["move", "pass", "air", "dribble"];
const KIND_OF_TOOL = { ball: "ball", cone: "cone", goal: "goal", pole: "pole", hurdle: "hurdle", ladder: "ladder", dummy: "dummy", move: "arrow", pass: "arrow", air: "arrow", dribble: "arrow", zone: "zone", quad: "zone", text: "text" };
const SPEEDS = [{ id: 2600, label: "Lenta" }, { id: 1500, label: "Normal" }, { id: 800, label: "Rápida" }];
const MAX_HISTORY = 30;

// Lo último que se eligió para cada herramienta se recuerda para lo siguiente que se dibuje
const BRUSH0 = { ...ARROW_PRESETS, token: {}, ball: { pattern: "classic" }, cone: { shape: "tri" }, goal: { w: 7.32 }, pole: {}, hurdle: {}, ladder: {}, dummy: {}, zone: {}, quad: { shape: "quad" }, text: { size: 3 } };
const BRUSH_KEYS = ["bends", "shape", "color", "color2", "pattern", "size", "w", "rungs", "width", "dash", "border", "borderColor", "pointer", "fill", "fillOpacity", "stroke", "strokeWidth", "font", "bold", "lift"];
const toolOfEl = (el) => (el.k === "arrow" ? typeOfArrow(el) : el.k === "zone" ? (isQuad(el) ? "quad" : "zone") : ["ball", "cone", "goal", "text", ...MATERIAL_IDS].includes(el.k) ? el.k : null);

const selectCls = "h-8 rounded-md border border-gray-200 bg-white px-2 text-xs";

/**
 * value     dibujo guardado (formato nuevo o antiguo) o null
 * onChange  (nuevoDibujo) => void
 * roster    [{ id, label }] nombres para añadir fichas con un toque
 * fields    ids de campo permitidos (por defecto todos)
 * modes     true: se puede elegir entre Imagen (un solo fotograma) y Animación (varios fotogramas)
 */
export default function BoardEditor({ value, onChange, roster = [], fields = null, filename = "pizarra", modes = false }) {
  const board = useMemo(() => normalizeBoard(value), [value]);
  const field = fieldOf(board.field);
  const orient = board.orient;
  const look = lookOf(board.look);
  const chip = chipOf(board);
  const teams = teamsOf(board);
  const teamIds = teams.map((t) => t.id);
  const isTeamTool = (id) => teamIds.includes(id);
  const [fi, setFi] = useState(0);
  const [tool, setTool] = useState("select");
  const [sel, setSel] = useState([]); // ids elegidos (uno o varios)
  const [multiMode, setMultiMode] = useState(false); // «Varios»: tocar suma o quita de lo elegido
  const [layersOpen, setLayersOpen] = useState(false); // lista de capas del fotograma
  const [draft, setDraft] = useState(null);
  const [pick, setPick] = useState([]);
  const [brush, setBrush] = useState(BRUSH0);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]); // lo deshecho, para rehacer
  const [helpOpen, setHelpOpen] = useState(false);
  const lastPick = useRef({ arrow: "move", zone: "zone", material: "goal" });
  const [playing, setPlaying] = useState(false);
  const [anim, setAnim] = useState(null);
  const [loop, setLoop] = useState(false);
  const [trails, setTrails] = useState(true);
  const [error, setError] = useState("");
  const [quick, setQuick] = useState(null); // ficha abierta con doble clic (su id)
  const [quickPos, setQuickPos] = useState(null);
  const [full, setFull] = useState(false); // editor a pantalla completa (fuera de él, solo la vista previa)
  const [side, setSide] = useState(null); // panel de «Campo y ajustes» o «Plantilla»
  const [panelHidden, setPanelHidden] = useState(false);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 767px)");
    if (!mq) return undefined;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  const lastTap = useRef({ id: null, at: 0 });
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const drag = useRef(null);
  const live = useRef(board);
  live.current = board;
  const coalesce = useRef({ key: null, at: 0 });

  const speed = boardSpeed(board);
  const imageMode = modes && boardMode(board) === "image";
  const last = board.frames.length - 1;
  const idx = imageMode ? 0 : Math.min(fi, last);
  const cur = board.frames[idx];
  const prev = idx > 0 ? board.frames[idx - 1] : null;
  // Con una sola cosa elegida se edita con su panel y sus tiradores; con varias, con el panel de grupo
  const selId = sel.length === 1 ? sel[0] : null;
  const setSelId = (id) => setSel(id ? [id] : []);
  const selected = selId ? cur.els.find((e) => e.id === selId) || null : null;
  const selEls = sel.map((id) => cur.els.find((e) => e.id === id)).filter(Boolean);
  const multi = sel.length > 1 && selEls.length > 1;
  // el panel flotante vuelve a salir al elegir otra cosa u otra herramienta
  useEffect(() => { setPanelHidden(false); }, [selId, tool, multi]);
  useEffect(() => {
    if (playing || !sel.length) return;
    const alive = sel.filter((id) => cur.els.some((e) => e.id === id));
    if (alive.length !== sel.length) setSel(alive);
  }, [sel, cur, playing]);
  useEffect(() => { if (fi > last) setFi(last); }, [fi, last]);
  const quickEl = quick && !playing && selId === quick ? cur.els.find((e) => e.id === quick && e.k === "token") || null : null;
  useEffect(() => { if (quick && !quickEl) setQuick(null); }, [quick, quickEl]);

  // Los cambios seguidos de un mismo control (deslizador, selector de color) cuentan como uno solo al deshacer.
  const pushHistory = (snap) => { setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), snap]); setFuture([]); };
  const commit = (next, { record = true, key = null } = {}) => {
    if (record) {
      const now = Date.now();
      const same = key && coalesce.current.key === key && now - coalesce.current.at < 900;
      if (!same) pushHistory(live.current);
      coalesce.current = { key, at: now };
    }
    onChange(next);
  };
  const undo = () => {
    if (!history.length) return;
    setFuture((f) => [...f.slice(-(MAX_HISTORY - 1)), live.current]);
    onChange(history[history.length - 1]);
    setHistory(history.slice(0, -1)); // lo elegido sigue elegido (si ya no existe, se suelta solo)
    coalesce.current = { key: null, at: 0 };
  };
  const redo = () => {
    if (!future.length) return;
    setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), live.current]);
    onChange(future[future.length - 1]);
    setFuture(future.slice(0, -1));
    coalesce.current = { key: null, at: 0 };
  };

  // ── Reproducción ─────────────────────────────────────────────────────────────────────────────────────────────────
  const stop = () => { setPlaying(false); setAnim(null); };
  useEffect(() => {
    if (!playing) return undefined;
    const frames = live.current.frames;
    const end = frames.length - 1;
    if (end < 1) { setPlaying(false); return undefined; }
    let i = fi >= end ? 0 : fi;
    let t0 = performance.now();
    let raf = 0;
    setFi(i);
    const tick = (now) => {
      let p = (now - t0) / speed;
      if (p >= 1) {
        i += 1;
        t0 = now;
        p = 0;
        if (i >= end) {
          if (loop) { i = 0; setFi(0); } else { setFi(end); setAnim(null); setPlaying(false); return; }
        } else setFi(i);
      }
      setAnim({ i, t: p });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, loop]);

  const shownEls = anim && board.frames[anim.i + 1] ? lerpFrames(board.frames[anim.i], board.frames[anim.i + 1], anim.t) : cur.els;
  const ghosts = !playing && trails && prev ? ghostsOf(prev, cur) : [];

  // ── Puntero ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // En perspectiva, el punto de la pantalla se lleva al suelo deshaciendo la proyección
  const persp = isPersp(board) ? perspectiveOf(field, orient, marginOf(look, board)) : null;
  const svgPoint = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  // Zoom: lo que se ve sale del zoom guardado en el dibujo (`board.cam`)
  const fullVb = persp ? persp.vb : viewBox(field, orient, marginOf(look, board));
  const cam = camOf(board);
  const setCam = (c) => { const { cam: _c, ...rest } = live.current; commit(c ? { ...rest, cam: c } : rest, { key: "cam" }); };
  const zoomTo = (z, at) => setCam(zoomCam(fullVb, camOf(live.current), z, at));
  const zoomStep = (dir) => {
    const z = camOf(live.current).z;
    const next = dir > 0 ? ZOOM_STEPS.find((v) => v > z + 0.01) : [...ZOOM_STEPS].reverse().find((v) => v < z - 0.01);
    zoomTo(next ?? (dir > 0 ? ZOOM_STEPS[ZOOM_STEPS.length - 1] : 1));
  };
  const pointers = useRef(new Map());
  // Con Ctrl (o el gesto de pellizcar del ratón táctil) la rueda acerca y aleja sobre el punto donde está el puntero
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const at = pt.matrixTransform(svg.getScreenCTM().inverse());
      zoomTo(camOf(live.current).z * Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.004), at);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  });
  const toField = (e) => { const q = svgPoint(e); return fromView(field, orient, persp ? persp.inv(q) : q); };
  // Qué hay bajo el dedo: en perspectiva, lo que está de pie se agarra por donde se ve
  const hitAt = (list, e, p) => (persp ? hitTestPersp(paintOrder(list, field, orient, persp), svgPoint(e), { field, orient, chip, persp }) : hitTest(list, p, { orient, chip }));
  const point = (e) => {
    const p = toField(e);
    return { x: round(clamp(p.x, -2, field.w + 2)), y: round(clamp(p.y, -2, field.h + 2)) };
  };
  // Altura máxima de un pase aéreo (hacia el lado indicado por sign) para que su punto más alto siga dentro de lo que se ve
  const liftMax = (a, sign) => {
    const g = arrowPoints(a, 24)[12], n = liftNormal(a, orient);
    let m = AIR_MAX;
    for (const [pos, dir, lo, hi] of [[g.x, n.x * sign, -2, field.w + 2], [g.y, n.y * sign, -2, field.h + 2]]) {
      if (dir > 1e-6) m = Math.min(m, (hi - pos) / dir);
      else if (dir < -1e-6) m = Math.min(m, (lo - pos) / dir);
    }
    return Math.max(1, m);
  };

  // Dónde se abre la edición rápida: junto a la ficha (debajo si cabe, si no encima), sin salirse del recuadro de la pizarra
  useLayoutEffect(() => {
    if (!quickEl || !svgRef.current || !wrapRef.current) { setQuickPos(null); return; }
    const svg = svgRef.current;
    const v = toView(field, orient, quickEl);
    const c = persp ? persp.P(v) : v;
    const r = tokenR(chip, quickEl) * (persp ? persp.scaleAt(v) * perspBoost(quickEl) : 1);
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = c.x; pt.y = c.y;
    const mid = pt.matrixTransform(ctm);
    pt.y = c.y + r * 2.2;
    const below = pt.matrixTransform(ctm);
    const box = wrapRef.current.getBoundingClientRect();
    const W = Math.min(300, box.width - 8);
    const left = Math.max(4, Math.min(mid.x - box.left - W / 2, box.width - W - 4));
    const top = below.y - box.top + 4;
    // en la mitad de abajo de la pizarra se abre por encima de la ficha
    const rs = Math.abs(below.y - mid.y) / 2.2;
    setQuickPos({ left, top, up: mid.y - box.top > box.height / 2, mid: mid.y - box.top - rs - 6 });
  }, [quickEl, board, orient, field]);

  const setEls = (els, opts) => commit({ ...live.current, frames: live.current.frames.map((f, i) => (i === idx ? { ...f, els } : f)) }, opts);
  const add = (el) => { commit(addElement(live.current, idx, el)); setSelId(el.id); };

  const onDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // dos dedos: acercar o alejar (se deshace lo que hubiera empezado el primer dedo)
    if (pointers.current.size === 2) {
      const d = drag.current;
      if (d?.snapshot && d.moved) onChange(d.snapshot);
      setDraft(null);
      const [a, b] = [...pointers.current.values()];
      const svg = svgRef.current, pt = svg.createSVGPoint();
      pt.x = (a.x + b.x) / 2; pt.y = (a.y + b.y) / 2;
      drag.current = { mode: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: camOf(live.current).z, at: pt.matrixTransform(svg.getScreenCTM().inverse()) };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }
    if (playing) return;
    if (e.button !== undefined && e.button > 0) return;
    const p = point(e);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (tool === "pan") { const cam0 = camOf(live.current); drag.current = cam0.z > 1 ? { mode: "pan", cx: e.clientX, cy: e.clientY, cam0 } : null; return; }
    const handle = e.target?.dataset?.h;
    if (handle && (selected?.k === "arrow" || (isQuad(selected) && /^q[0-3]$/.test(handle)) || (selected?.k === "token" && handle === "f") || (materialOf(selected?.k) && handle === "r"))) {
      // «+» en mitad de un tramo de flecha: nace ahí un quiebro nuevo y se arrastra
      // doble clic o doble toque sobre un quiebro: se quita
      if (/^v\d+$/.test(handle) && selected.k === "arrow") {
        const key = `${selected.id}:${handle}`, now = Date.now();
        if (lastTap.current.id === key && now - lastTap.current.at < 420) {
          lastTap.current = { id: null, at: 0 };
          drag.current = null;
          commit(patchElement(live.current, idx, selected.id, removeVia(selected, Number(handle.slice(1)))));
          return;
        }
        lastTap.current = { id: key, at: now };
      }
      const mid = /^m(\d+)$/.exec(handle);
      if (mid && selected.k === "arrow") {
        const i = Number(mid[1]);
        const el = { ...selected, ...insertVia(selected, i) };
        drag.current = { mode: "handle", h: `v${i}`, id: selected.id, el, snapshot: patchElement(live.current, idx, selected.id, insertVia(selected, i)), base: live.current };
        return;
      }
      drag.current = { mode: "handle", h: handle, id: selected.id, el: selected, snapshot: live.current };
      return;
    }
    // Unir fichas: se toca cada ficha (o se arrastra un recuadro) para elegirlas; luego se crea el conector
    if (tool === "link") {
      const hit = hitAt(drawOrder(cur.els.filter(isLinkable)), e, p);
      if (hit) setPick((pk) => (pk.includes(hit.id) ? pk.filter((i) => i !== hit.id) : [...pk, hit.id]));
      else { drag.current = { mode: "box", from: p }; setDraft({ k: "box", x: p.x, y: p.y, w: 0, h: 0 }); }
      return;
    }
    // Con las herramientas de colocar (fichas, balón…) una zona o un conector no se «agarra» por dentro: ahí se coloca
    const sorted = drawOrder(cur.els);
    const additive = tool === "select" && (multiMode || e.shiftKey || e.ctrlKey || e.metaKey);
    const target = hitAt(tool === "select" ? sorted : sorted.filter((el) => el.k !== "zone" && el.k !== "link"), e, p);
    const drawing = tool === "zone" || tool === "quad" || ARROW_TOOLS.includes(tool);
    if (tool === "select" || (target && !drawing)) {
      if (target) {
        // «Varios» o Mayús/Ctrl: suma o quita esa cosa de lo elegido, sin arrastrar
        if (additive) {
          // una zona o un conector ocupa mucho sitio: arrastrando desde ahí se dibuja el recuadro y, si solo se toca, se suma o se quita
          if (target.k === "zone" || target.k === "link") { drag.current = { mode: "marquee", from: p, add: true, tap: target.id }; setDraft({ k: "box", x: p.x, y: p.y, w: 0, h: 0 }); return; }
          setSel((s) => (s.includes(target.id) ? s.filter((i) => i !== target.id) : [...s, target.id]));
          drag.current = null;
          return;
        }
        // doble clic o doble toque sobre una ficha: se abre su edición rápida
        const now = Date.now();
        const twice = target.k === "token" && lastTap.current.id === target.id && now - lastTap.current.at < 420;
        lastTap.current = { id: target.id, at: twice ? 0 : now };
        if (twice) { setSel([target.id]); setQuick(target.id); drag.current = null; return; }
        if (quick && quick !== target.id) setQuick(null);
        // arrastrar una de varias elegidas las mueve todas; tocarla sin arrastrar deja solo esa
        const inGroup = sel.length > 1 && sel.includes(target.id);
        if (!inGroup) setSel([target.id]);
        // un conector no se arrastra: su forma sale de las fichas que une
        drag.current = target.k === "link" && !inGroup ? null : { mode: "move", ids: inGroup ? sel : [target.id], only: inGroup ? target.id : null, from: p, moved: false, snapshot: live.current };
      } else {
        // espacio vacío: recuadro para elegir varias cosas a la vez
        lastTap.current = { id: null, at: 0 };
        if (!additive) { setSel([]); setQuick(null); }
        drag.current = { mode: "marquee", from: p, add: additive };
        setDraft({ k: "box", x: p.x, y: p.y, w: 0, h: 0 });
      }
      return;
    }
    if (isTeamTool(tool)) return add({ id: newId(), k: "token", x: p.x, y: p.y, team: tool, label: "", ...brush.token });
    if (MATERIAL_IDS.includes(tool)) return add({ id: newId(), k: tool, x: p.x, y: p.y, rot: 0, ...brush[tool] });
    if (tool === "ball") return add({ id: newId(), k: "ball", x: p.x, y: p.y, ...brush.ball });
    if (tool === "cone") return add({ id: newId(), k: "cone", x: p.x, y: p.y, ...brush.cone });
    if (tool === "goal") return add({ id: newId(), k: "goal", x: p.x, y: p.y, rot: 0, ...brush.goal });
    if (tool === "text") return add({ id: newId(), k: "text", x: p.x, y: p.y, text: "Texto", ...brush.text });
    if (ARROW_TOOLS.includes(tool)) { setDraft({ k: "arrow", ...brush[tool], x1: p.x, y1: p.y, x2: p.x, y2: p.y }); drag.current = { mode: "draw" }; return; }
    if (tool === "zone" || tool === "quad") { setDraft({ k: "zone", ...brush[tool], x: p.x, y: p.y, w: 0, h: 0 }); drag.current = { mode: "draw" }; }
  };

  // Doble clic (también el del navegador) o clic derecho / mantener pulsado sobre una ficha: su edición rápida.
  // Se anula el menú y la selección de texto que el navegador haría ahí.
  const openQuickAt = (e) => {
    if (playing || !svgRef.current) return false;
    const p = point(e);
    const hit = hitAt(drawOrder(cur.els.filter((el) => el.k === "token")), e, p);
    if (!hit) return false;
    if (tool !== "select") pickTool("select");
    drag.current = null;
    setSel([hit.id]);
    setQuick(hit.id);
    return true;
  };
  const onDoubleClick = (e) => {
    if (openQuickAt(e)) e.preventDefault();
  };
  const onContextMenu = (e) => { if (openQuickAt(e)) e.preventDefault(); };

  const onMove = (e) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (!d) return;
    if (d.mode === "pinch") {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      zoomTo(d.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / d.d0), d.at);
      return;
    }
    if (d.mode === "pan") {
      const ctm = svgRef.current.getScreenCTM();
      setCam(panCam(fullVb, d.cam0, -(e.clientX - d.cx) / ctm.a, -(e.clientY - d.cy) / ctm.d) || null);
      return;
    }
    if (d.mode === "draw" || d.mode === "box" || d.mode === "marquee") {
      const p = point(e);
      setDraft((c) => (c ? (c.k === "arrow" ? { ...c, x2: p.x, y2: p.y } : { ...c, w: round(p.x - c.x), h: round(p.y - c.y) }) : c));
      return;
    }
    if (d.mode === "handle") {
      let patch;
      if (d.h === "l") {
        const g = arrowPoints(d.el, 24)[12], n = liftNormal(d.el, orient), r = toField(e);
        const raw = (r.x - g.x) * n.x + (r.y - g.y) * n.y;
        const sign = raw < 0 ? -1 : 1;
        patch = { lift: sign * clamp(round(Math.abs(raw)), 1, liftMax(d.el, sign)) };
      } else if (d.h === "f" || d.h === "r") {
        // orientación de una ficha con pies o giro de un material: hacia donde apunta el dedo, desde el centro del elemento
        const a = faceToward(d.el, toField(e));
        patch = d.h === "f" ? { face: a } : { rot: a };
      } else if (/^v\d+$/.test(d.h)) {
        const p = point(e), i = Number(d.h.slice(1));
        patch = { via: d.el.via.map((q, j) => (j === i ? { x: p.x, y: p.y } : q)) };
      } else if (/^q[0-3]$/.test(d.h)) {
        const p = point(e), i = Number(d.h[1]);
        patch = { pts: d.el.pts.map((q, j) => (j === i ? { x: p.x, y: p.y } : q)) };
      } else {
        const p = point(e);
        patch = d.h === "p1" ? { x1: p.x, y1: p.y } : d.h === "p2" ? { x2: p.x, y2: p.y } : { cx: p.x, cy: p.y };
      }
      onChange(patchElement(d.snapshot, idx, d.id, patch));
      d.moved = true;
      return;
    }
    if (d.mode === "move") {
      const p = point(e);
      const dx = p.x - d.from.x, dy = p.y - d.from.y;
      if (!d.moved && Math.hypot(dx, dy) < 0.6) return;
      d.moved = true;
      lastTap.current = { id: null, at: 0 };
      const els = d.snapshot.frames[idx].els.map((el) => (d.ids.includes(el.id) ? shiftElement(el, dx, dy) : el));
      onChange({ ...d.snapshot, frames: d.snapshot.frames.map((f, i) => (i === idx ? { ...f, els } : f)) });
    }
  };

  const onUp = (e) => {
    if (e?.pointerId !== undefined) pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (d?.mode === "pinch") { if (pointers.current.size === 0) drag.current = null; return; }
    drag.current = null;
    if (!d) return;
    if ((d.mode === "move" || d.mode === "handle") && d.moved) {
      pushHistory(d.base || d.snapshot);
      coalesce.current = { key: null, at: 0 };
    }
    if (d.mode === "move" && !d.moved && d.only) setSel([d.only]);
    if (d.mode === "marquee") {
      if (draft && Math.abs(draft.w) > 1 && Math.abs(draft.h) > 1) {
        const ids = elementsInBox(cur.els, draft);
        setSel((s) => (d.add ? [...s, ...ids.filter((i) => !s.includes(i))] : ids));
      } else if (d.tap) setSel((s) => (s.includes(d.tap) ? s.filter((i) => i !== d.tap) : [...s, d.tap]));
      setDraft(null);
    }
    if (d.mode === "box") {
      if (draft && Math.abs(draft.w) > 1.5 && Math.abs(draft.h) > 1.5) {
        const x0 = Math.min(draft.x, draft.x + draft.w), x1 = Math.max(draft.x, draft.x + draft.w);
        const y0 = Math.min(draft.y, draft.y + draft.h), y1 = Math.max(draft.y, draft.y + draft.h);
        // lo que cae dentro del recuadro se añade en orden de fila; lo que se toca una a una, en el orden en que se toca
        const inside = orderForLine(cur.els.filter((el) => isLinkable(el) && el.x >= x0 && el.x <= x1 && el.y >= y0 && el.y <= y1), field, orient);
        setPick((pk) => [...pk, ...inside.filter((id) => !pk.includes(id))]);
      }
      setDraft(null);
    }
    if (d.mode === "draw" && draft) {
      const big = draft.k === "arrow" ? Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 2.5 : Math.abs(draft.w) > 2.5 && Math.abs(draft.h) > 2.5;
      if (big) {
        const { curved, bends, ...rest } = draft;
        const el = { id: newId(), ...rest };
        if (bends && el.k === "arrow" && !el.air) el.via = [firstBend(el)];
        else if (curved && el.k === "arrow") Object.assign(el, defaultControl(el));
        if (el.k === "zone" && el.shape === "quad") {
          // zona libre: nace como un rectángulo cuyas cuatro esquinas se pueden mover por separado
          el.pts = zoneCorners(el).map((q) => ({ x: round(q.x), y: round(q.y) }));
          delete el.x; delete el.y; delete el.w; delete el.h;
        }
        add(el);
        // Una zona recién dibujada queda lista para moverla o ajustarla (con la herramienta de zona activa, tocar encima dibujaría otra)
        if (el.k === "zone") setTool("select");
      }
      setDraft(null);
    }
  };

  // ── Propiedades ──────────────────────────────────────────────────────────────────────────────────────────────────
  // Sobre un elemento seleccionado se cambia el elemento; sin selección, la herramienta activa (lo siguiente que se dibuje).
  const patchSel = (patch, key = null) => {
    if (!selected) return;
    // la posición y hacia dónde mira o cómo está girada cada cosa valen para su fotograma; lo demás, para todos
    const allFrames = isCarried(selected) && !("x" in patch) && !("y" in patch) && !("face" in patch) && !("rot" in patch);
    commit(patchElement(live.current, idx, selId, patch, { allFrames }), { key: key || Object.keys(patch).join(",") });
    const t = toolOfEl(selected);
    const keep = Object.fromEntries(Object.entries(patch).filter(([k]) => BRUSH_KEYS.includes(k)));
    if (keep.shape && (t === "quad" || keep.shape === "quad")) delete keep.shape; // la forma libre tiene su propia herramienta
    if (selected.k === "arrow" && "cx" in patch) keep.curved = patch.cx != null;
    if (selected.k === "arrow" && "via" in patch) { keep.bends = !!patch.via?.length; if (keep.bends) keep.curved = false; }
    if (t && Object.keys(keep).length) setBrush((b) => ({ ...b, [t]: { ...b[t], ...keep } }));
  };
  const brushKey = isTeamTool(tool) ? "token" : tool;
  const patchBrush = (patch) => setBrush((b) => ({ ...b, [brushKey]: { ...b[brushKey], ...patch } }));
  const setArrowType = (t) => {
    if (selected?.k === "arrow") patchSel({ ...ARROW_PRESETS[t], lift: t === "air" ? Number(selected.lift) || 6 : selected.lift, ...(t === "air" ? { via: undefined } : {}) }, "type");
    else pickTool(t);
  };
  const patchTeam = (id, patch) => commit({ ...live.current, teams: teamsOf(live.current).map((t) => (t.id === id ? { ...t, ...patch } : t)) }, { key: `team-${id}-${Object.keys(patch)[0]}` });
  const setChip = (radius) => commit(setAllChips(live.current, radius), { key: "chip" });
  const setFeet = (on) => commit(setAllFeet(live.current, on));
  const newTeam = () => {
    const r = addTeam(live.current);
    if (!r.id) return;
    commit(r.board);
    pickTool(r.id);
  };
  const dropTeam = (id) => {
    commit(removeTeam(live.current, id));
    pickTool("select");
  };

  const delSel = (onlyHere = false) => { commit(removeElement(board, idx, selId, { onlyHere })); setSelId(null); };
  const dupSel = () => {
    if (!selected) return;
    add(shiftElement({ ...selected, id: newId() }, 3, 3));
  };
  // Varios elegidos a la vez
  const delMany = (onlyHere = false) => { commit(removeElements(live.current, idx, sel, { onlyHere })); setSel([]); };
  const dupMany = () => {
    let b = live.current;
    const ids = [];
    for (const e of selEls.filter((x) => x.k !== "link")) {
      const copy = shiftElement({ ...e, id: newId() }, 3, 3);
      ids.push(copy.id);
      b = addElement(b, idx, copy);
    }
    if (!ids.length) return;
    commit(b);
    setSel(ids);
  };
  const resizeMany = (f) => commit(resizeElements(live.current, idx, sel, f));
  const spreadMany = (f) => commit(spreadElements(live.current, idx, sel, f));
  const colorMany = (c) => commit(recolorElements(live.current, idx, sel, c));
  const teamMany = (t) => commit(setTeamOf(live.current, idx, sel, t));
  const feetMany = (on) => commit(setFeetOf(live.current, idx, sel, on));
  const bibMany = (color) => commit(setBibOf(live.current, idx, sel, color));
  const turnMany = (how) => commitIfChanged(turnElements(live.current, idx, sel, how));
  // Capas: lo elegido (una o varias cosas) sube o baja en el orden de dibujo de este fotograma
  const commitIfChanged = (next) => { if (next !== live.current) commit(next); };
  const layer = (where) => commitIfChanged(moveLayer(live.current, idx, sel, where, chip));
  const alignMany = (where) => commitIfChanged(alignElements(live.current, idx, sel, where));
  const distributeMany = (axis) => commitIfChanged(distributeElements(live.current, idx, sel, axis));
  // Lista de capas: elegir una fila y subir o bajar esa cosa un puesto
  const pickLayer = (id, add) => {
    if (tool !== "select") pickTool("select");
    setSel((s) => (add || multiMode ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]));
  };
  const stepOne = (id, dir) => commitIfChanged(stepLayer(live.current, idx, [id], dir));
  const moveRow = (id, pos) => commitIfChanged(moveLayerTo(live.current, idx, id, pos));
  const selectAll = () => { setTool("select"); setDraft(null); setPick([]); setSel(cur.els.filter((e) => e.k !== "link").map((e) => e.id)); };
  const clearFrame = () => { if (cur.els.length) { setEls([]); setSel([]); } };

  // Teclado (con el foco dentro del editor y sin estar escribiendo en un campo), al estilo de FmStadio: ver `src/lib/boardKeys.js`
  // y la ayuda (Mayús + H). Supr quita lo elegido, las flechas lo mueven 0,5 m (Mayús, 2 m) o, sin nada elegido, pasan de
  // fotograma; las pulsaciones seguidas de las flechas cuentan como un solo paso al deshacer.
  const cycle = (list, now) => list[(list.indexOf(now) + 1) % list.length];
  const onKey = (e) => {
    if (e.defaultPrevented) return;
    if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable=true], [role=slider], [role=dialog] [role=dialog]")) return;
    const action = boardKeyAction(e, { hasSel: sel.length > 0 });
    if (!action) return;
    if (playing && action !== "play") return;
    e.preventDefault();
    const nudge = { nudgeLeft: [-1, 0], nudgeRight: [1, 0], nudgeUp: [0, -1], nudgeDown: [0, 1] }[action];
    if (nudge) {
      const step = e.shiftKey ? 2 : 0.5;
      const next = nudgeElements(live.current, idx, sel, nudge[0] * step, nudge[1] * step);
      if (next !== live.current) commit(next, { key: "nudge" });
      return;
    }
    if (/^team\d$/.test(action)) { const t = teams[Number(action.slice(4)) - 1]; if (t) pickTool(t.id); return; }
    const ARROWS = ARROW_TOOLS, ZONES = ["zone", "quad"], MATS = ["goal", ...MATERIAL_IDS];
    switch (action) {
      case "undo": return undo();
      case "redo": return redo();
      case "selectAll": return selectAll();
      case "duplicate": return sel.length > 1 ? dupMany() : dupSel();
      case "delete": return sel.length > 1 ? delMany(false) : delSel(false);
      case "deleteHere": return sel.length > 1 ? delMany(true) : delSel(true);
      case "select": return pickTool("select");
      case "ball": return pickTool("ball");
      case "cone": return pickTool("cone");
      case "link": return pickTool("link");
      case "text": return pickTool("text");
      case "arrow": return pickTool(lastPick.current.arrow);
      case "zone": return pickTool(lastPick.current.zone);
      case "material": return pickTool(lastPick.current.material);
      case "cycleArrow": return pickTool(ARROWS.includes(tool) ? cycle(ARROWS, tool) : lastPick.current.arrow);
      case "cycleZone": return pickTool(ZONES.includes(tool) ? cycle(ZONES, tool) : lastPick.current.zone);
      case "cycleMaterial": return pickTool(MATS.includes(tool) ? cycle(MATS, tool) : lastPick.current.material);
      case "addFrame": if (!imageMode && board.frames.length < MAX_FRAMES) frameOp((b, i) => addFrame(b, i)); return;
      case "removeFrame": if (!imageMode && board.frames.length > 1) frameOp((b, i) => removeFrame(b, i)); return;
      case "nextFrame": if (!imageMode && idx < last) goFrame(idx + 1); return;
      case "prevFrame": if (!imageMode && idx > 0) goFrame(idx - 1); return;
      case "lastFrame": if (!imageMode) goFrame(last); return;
      case "firstFrame": if (!imageMode) goFrame(0); return;
      case "play": if (!imageMode && board.frames.length > 1) { if (playing) stop(); else setPlaying(true); } return;
      case "trail": return setTrails((t) => !t);
      case "alignH": if (sel.length > 1) alignMany("vcenter"); return;
      case "alignV": if (sel.length > 1) alignMany("hcenter"); return;
      case "spread": {
        if (sel.length < 3) return;
        const b = unionBounds(selEls.map((x) => elementBounds(x, chip)).filter(Boolean));
        if (!b) return;
        // a lo largo del lado más largo tal como se ve en pantalla
        const wide = isSideways(orient) ? b.y1 - b.y0 >= b.x1 - b.x0 : b.x1 - b.x0 >= b.y1 - b.y0;
        return distributeMany(wide ? "h" : "v");
      }
      case "zoomIn": return zoomStep(1);
      case "zoomOut": return zoomStep(-1);
      case "help": return setHelpOpen((o) => !o);
      default: return undefined;
    }
  };

  const addPlayer = (p) => {
    const team = isTeamTool(tool) ? tool : "a";
    const n = cur.els.filter((e) => e.k === "token").length;
    add({ id: newId(), k: "token", x: round(Math.min(8 + (n % 6) * 10, field.w - 4)), y: round(6 + Math.floor(n / 6) * 7), team, label: p.label });
  };

  const pickTool = (id) => {
    if (ARROW_TOOLS.includes(id)) lastPick.current.arrow = id;
    if (id === "zone" || id === "quad") lastPick.current.zone = id;
    if (id === "goal" || MATERIAL_IDS.includes(id)) lastPick.current.material = id;
    setTool(id); if (id !== "select") { setSel([]); setMultiMode(false); } setPick([]); setDraft(null); stop();
  };

  // Conector entre las fichas elegidas: línea (de un extremo al otro), zona (contorno que las envuelve) o red (todas con todas)
  const makeLink = (mode) => {
    const items = pick.map((id) => cur.els.find((e) => e.id === id)).filter(Boolean);
    if (items.length < (mode === "zone" ? 3 : 2)) return;
    // la línea sigue el orden en que se han ido tocando las fichas
    const link = { id: newId(), k: "link", mode, ids: items.map((e) => e.id) };
    commit(addElement(live.current, idx, link));
    setPick([]);
    setTool("select");
    setSelId(link.id);
  };

  // ── Fotogramas ───────────────────────────────────────────────────────────────────────────────────────────────────
  const goFrame = (i) => { stop(); setFi(i); setSelId(null); setDraft(null); setPick([]); };
  const frameOp = (fn) => { stop(); const r = fn(live.current, idx); commit(r.board); setFi(r.index); setSelId(null); setPick([]); };

  const allowed = fields ? FIELDS.filter((f) => fields.includes(f.id)) : FIELDS;
  const used = new Set(cur.els.filter((e) => e.k === "token").map((e) => e.label));
  const tall = (isSideways(orient) ? field.w : field.h) > 80;
  const cursor = tool === "pan" ? "grab" : tool === "select" || playing ? "default" : "crosshair";
  const hasEls = board.frames.some((f) => f.els.length);

  // Qué muestra el panel de propiedades: el elemento seleccionado o la herramienta elegida
  const brushEl = !selected && !playing
    ? isTeamTool(tool) ? { k: "token", team: tool, ...brush.token }
      : KIND_OF_TOOL[tool] ? { k: KIND_OF_TOOL[tool], ...brush[tool] } : null
    : null;
  const panelEl = !playing ? selected || brushEl : null;

  const setMode = (m) => { stop(); setFi(0); setSelId(null); setPick([]); setDraft(null); commit({ ...live.current, mode: m }); };

  // ── Pantalla: vista previa en la página y editor a pantalla completa (como FmStadio) ──────────────────────────────
  const title = filename || "Pizarra";
  const openStudio = () => { setFull(true); setSide(null); };
  const closeStudio = () => { stop(); setQuick(null); setFull(false); };
  const groupOf = (id) => TOOL_GROUPS.find((g) => g.tools.includes(id)) || null;
  const curGroup = groupOf(tool);
  const toggleSide = (id) => { setSide((s) => (s === id ? null : id)); setPanelHidden(false); };

  if (!full) {
    const first = board.frames[0];
    return (
      <div className="space-y-1.5" data-testid="board-preview">
        <button
          type="button"
          onClick={openStudio}
          className="group relative block w-full rounded-lg overflow-hidden border border-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--granate)]"
          style={{ background: styleOf(look).surround || "#f3f4f6" }}
          aria-label={hasEls ? "Abrir la pizarra para editar" : "Abrir la pizarra para dibujar"}
          data-testid="board-open"
        >
          <Board board={board} els={first.els} className="w-full pointer-events-none" style={{ maxHeight: tall ? 420 : 300 }} label="Vista previa de la pizarra" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/15 transition-colors">
            <span className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold shadow-lg" style={{ background: RAIL.on, color: RAIL.onInk }}>
              <Maximize2 className="w-4 h-4" /> {hasEls ? "Abrir pizarra" : "Dibujar en la pizarra"}
            </span>
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
          {hasEls && <span>{imageMode || board.frames.length < 2 ? "Imagen fija" : `Animación de ${board.frames.length} fotogramas`}</span>}
          {hasEls && <BoardDownloads board={board} frame={0} filename={filename} compact className="ml-auto" />}
        </div>
      </div>
    );
  }

  // Botones de las barras (mismo aspecto en ordenador y móvil)
  const railTool = (t) => {
    const Icon = t.icon;
    return (
      <RailBtn key={t.id} label={t.label} title={t.title || t.label} on={tool === t.id} onClick={() => pickTool(t.id)} narrow={narrow}>
        <Icon className="w-5 h-5" />
        {narrow && <RailLabel>{t.short || t.label}</RailLabel>}
      </RailBtn>
    );
  };
  const groupBtn = (g) => {
    const curId = g.tools.includes(tool) ? tool : lastPick.current[g.id];
    const info = TOOL_INFO[curId] || {};
    const Icon = info.icon || g.icon;
    return (
      <RailBtn key={g.id} label={g.label} title={`${g.label} (${g.key}) · ahora: ${info.label || ""}`} on={g.tools.includes(tool)} onClick={() => pickTool(curId)} narrow={narrow} testid={`rail-${g.id}`}>
        <Icon className="w-5 h-5" />
        {narrow && <RailLabel>{g.short}</RailLabel>}
      </RailBtn>
    );
  };
  const teamBtn = (t, i) => (
    <RailBtn key={t.id} label={`Fichas: ${t.name}`} title={`${t.name} (${i + 1})`} on={tool === t.id} onClick={() => pickTool(t.id)} narrow={narrow} testid={`rail-team-${t.id}`}>
      <ChipGlyph board={board} el={{ team: t.id }} look={look === "bn" ? "estadio" : look} size={26} />
      {narrow && <RailLabel>{t.name}</RailLabel>}
    </RailBtn>
  );
  const toolButtons = (
    <>
      {railTool({ id: "select", label: "Mover", title: "Mover y elegir (V)", icon: MousePointer2 })}
      <RailBtn label="Elegir varios" title="Varios: cada toque suma o quita (también con Mayús)" on={multiMode} onClick={() => { if (tool !== "select") pickTool("select"); setMultiMode((m) => !m); }} narrow={narrow}>
        <BoxSelect className="w-5 h-5" />{narrow && <RailLabel>Varios</RailLabel>}
      </RailBtn>
      <RailBtn label="Lista de capas" title="Capas del fotograma" on={layersOpen} onClick={() => { setLayersOpen((o) => !o); setPanelHidden(false); }} narrow={narrow}>
        <Layers className="w-5 h-5" />{narrow && <RailLabel>Capas</RailLabel>}
      </RailBtn>
      <RailSep narrow={narrow} />
      {teams.map(teamBtn)}
      {teams.length < MAX_TEAMS && (
        <RailBtn label="Nuevo equipo" title="Nuevo equipo (otro color de fichas)" onClick={newTeam} dashed narrow={narrow}>
          <Plus className="w-5 h-5" />{narrow && <RailLabel>Equipo</RailLabel>}
        </RailBtn>
      )}
      {roster.length > 0 && (
        <RailBtn label="Plantilla" title="Añadir jugadores de la plantilla" on={side === "roster"} onClick={() => toggleSide("roster")} narrow={narrow} testid="rail-roster">
          <Users className="w-5 h-5" />{narrow && <RailLabel>Plantilla</RailLabel>}
        </RailBtn>
      )}
      <RailSep narrow={narrow} />
      {railTool({ id: "ball", label: "Balón", title: "Balón (0)", icon: Circle })}
      {TOOL_GROUPS.map(groupBtn)}
      {railTool({ id: "link", label: "Unir fichas", title: "Unir fichas (L)", icon: Waypoints, short: "Unir" })}
      {railTool({ id: "text", label: "Texto", title: "Texto (E)", icon: Type })}
    </>
  );

  // Panel flotante: lo que corresponda en cada momento (ajustes, plantilla, unir fichas, grupo, propiedades, capas)
  const variants = !selected && curGroup && curGroup.id !== "arrow" ? (
    <div className="flex flex-wrap gap-1" role="group" aria-label={curGroup.label} data-testid="tool-variants">
      {curGroup.tools.map((id) => {
        const info = TOOL_INFO[id];
        const Icon = info.icon;
        const on = tool === id;
        return (
          <button key={id} type="button" aria-pressed={on} onClick={() => pickTool(id)}
            className={`h-8 px-2 rounded-md border text-[11px] font-semibold flex items-center gap-1 ${on ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
            <Icon className="w-3.5 h-3.5" style={on || !info.color ? undefined : { color: info.color }} /> {info.label.replace(/ \(.*\)/, "")}
          </button>
        );
      })}
    </div>
  ) : null;

  const settingsBody = (
    <div className="space-y-2.5" data-testid="board-settings">
      <div className="grid grid-cols-2 gap-1.5">
        <label className="text-[11px] font-semibold text-gray-600 space-y-0.5">Campo
          <select value={board.field} onChange={(e) => commit(changeField(board, e.target.value))} className={`${selectCls} w-full`} aria-label="Tipo de campo">
            {allowed.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-gray-600 space-y-0.5">Modo visual
          <select value={look} onChange={(e) => commit({ ...board, look: e.target.value })} className={`${selectCls} w-full`} aria-label="Modo visual">
            {LOOKS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-gray-600 space-y-0.5">Orientación
          <select value={orient} onChange={(e) => commit({ ...board, orient: orientOf(e.target.value) })} className={`${selectCls} w-full`} aria-label="Orientación del campo">
            {ORIENTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-gray-600 space-y-0.5">Vista
          <select value={board.view === "persp" ? "persp" : "flat"} onChange={(e) => { const { view: _v, ...rest } = board; commit(e.target.value === "persp" ? { ...rest, view: "persp" } : rest); }} className={`${selectCls} w-full`} aria-label="Vista del campo">
            {VIEWS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </label>
      </div>
      {isStadium(look) && (
        <div className="space-y-1" data-testid="board-stadium">
          <span className="text-[11px] font-semibold text-gray-600">Estadio</span>
          <div className="flex flex-wrap gap-1">
            {[
              { id: "stands", label: "Gradas", on: hasStands(board) },
              { id: "ads", label: "Vallas publicitarias", on: hasAds(board) },
            ].map((o) => (
              <button key={o.id} type="button" aria-pressed={o.on} data-testid={`toggle-${o.id}`}
                onClick={() => { const { [o.id]: _x, ...rest } = live.current; commit(o.on ? { ...rest, [o.id]: false } : rest); }}
                className={`h-8 px-2.5 rounded-md border text-xs font-semibold ${o.on ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                {o.on ? "✓ " : ""}{o.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {modes && (
        <div className="space-y-1" data-testid="board-mode">
          <span className="text-[11px] font-semibold text-gray-600">Tipo de dibujo</span>
          <div className="flex gap-1" role="group" aria-label="Tipo de dibujo">
            {[{ id: "image", label: "Imagen", icon: ImageIcon }, { id: "anim", label: "Animación", icon: Film }].map((m) => {
              const on = (imageMode ? "image" : "anim") === m.id;
              const Icon = m.icon;
              return (
                <button key={m.id} type="button" aria-pressed={on} onClick={() => !on && setMode(m.id)}
                  className={`h-8 px-2.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 ${on ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                  <Icon className="w-3.5 h-3.5" /> {m.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-500">
            {imageMode
              ? board.frames.length > 1 ? "Se guarda como imagen (el fotograma 1); las demás posiciones se conservan por si vuelves a Animación." : "Se guarda como imagen fija."
              : "Se guarda la animación y se puede descargar como vídeo."}
          </p>
        </div>
      )}
      {!imageMode && board.frames.length > 1 && (
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-gray-600">Animación</span>
          <div className="flex flex-wrap gap-1 items-center">
            <select value={speed} onChange={(e) => commit({ ...live.current, speed: Number(e.target.value) }, { record: false })} className={selectCls} aria-label="Velocidad">
              {SPEEDS.map((sp) => <option key={sp.id} value={sp.id}>{sp.label}</option>)}
            </select>
            <button type="button" aria-pressed={loop} onClick={() => setLoop((l) => !l)} className={`h-8 px-2 rounded-md border text-[11px] font-semibold flex items-center gap-1 ${loop ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}><Repeat className="w-3.5 h-3.5" /> Repetir</button>
            <button type="button" aria-pressed={trails} onClick={() => setTrails((tr) => !tr)} className={`h-8 px-2 rounded-md border text-[11px] font-semibold ${trails ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>Rastro (J)</button>
          </div>
          <div className="flex flex-wrap gap-1 items-center text-[11px] text-gray-600">
            <span>Fotograma {idx + 1}</span>
            <Button type="button" size="sm" variant="outline" className="h-7 px-1.5" onClick={() => frameOp((b, i) => moveFrame(b, i, -1))} disabled={idx === 0} aria-label="Mover fotograma antes"><ChevronLeft className="w-3.5 h-3.5" /></Button>
            <Button type="button" size="sm" variant="outline" className="h-7 px-1.5" onClick={() => frameOp((b, i) => moveFrame(b, i, 1))} disabled={idx === last} aria-label="Mover fotograma después"><ChevronRight className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      )}
      <div className="space-y-1">
        <span className="text-[11px] font-semibold text-gray-600">Descargar</span>
        <BoardDownloads board={board} frame={idx} filename={filename} />
      </div>
      <Button type="button" size="sm" variant="outline" className="h-8 px-2 gap-1 text-xs text-red-600" onClick={clearFrame} disabled={!cur.els.length}><Trash2 className="w-3.5 h-3.5" /> Vaciar este fotograma</Button>
    </div>
  );

  const rosterBody = (
    <div className="space-y-1.5" data-testid="board-roster">
      <p className="text-[11px] text-gray-500">Toca un nombre para añadir su ficha con el equipo elegido en la barra ({teams.find((t) => t.id === (isTeamTool(tool) ? tool : "a"))?.name}).</p>
      <div className="flex flex-wrap gap-1">
        {roster.map((pl) => (
          <button key={pl.id} type="button" onClick={() => addPlayer(pl)}
            className={`px-2 py-0.5 rounded-full border text-[11px] ${used.has(pl.label) ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
            + {pl.label}
          </button>
        ))}
      </div>
    </div>
  );

  const linkBody = tool === "link" ? (
    <div className="space-y-1.5" data-testid="link-bar">
      <p className="text-[11px] text-gray-600">
        {pick.length ? `${pick.length} ${pick.length === 1 ? "elegida" : "elegidas"}` : "Toca las fichas que quieras unir, o arrastra un recuadro sobre ellas (también vale con conos y balón)."}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pick.length < 2} onClick={() => makeLink("line")}>Línea</Button>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pick.length < 3} onClick={() => makeLink("zone")}>Zona</Button>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pick.length < 2} onClick={() => makeLink("mesh")}>Red</Button>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs ml-auto" disabled={!pick.length} onClick={() => setPick([])}>Borrar elección</Button>
      </div>
    </div>
  ) : null;

  const propsBody = panelEl && !multi ? (
    <div className="space-y-1.5" data-testid="board-props">
      {variants}
      {selected && <p className="text-[11px] text-amber-800">{selected.k === "arrow" ? "Arrastra la flecha o sus puntos" : selected.k === "token" && selected.feet ? "Arrastra la ficha; el punto naranja gira hacia dónde mira" : materialOf(selected.k) ? "Arrastra el material; el punto naranja lo gira" : selected.k === "link" ? "Sigue a sus fichas: mueve las fichas para cambiar la figura" : isQuad(selected) ? "Arrastra la zona o sus esquinas" : isMovable(selected) && board.frames.length > 1 ? "Arrástrala en cada fotograma" : "Arrastra para moverla"}</p>}
      <BoardProps
        key={selected ? selected.id : `tool-${tool}`}
        el={panelEl}
        brush={!selected}
        board={board}
        look={look}
        patch={selected ? patchSel : patchBrush}
        onType={setArrowType}
        patchTeam={patchTeam}
        setChip={setChip}
        setFeet={setFeet}
        canRemoveTeam={Boolean(panelEl.k === "token" && !["a", "b", "c", "gk"].includes(panelEl.team) && !teamInUse(board, panelEl.team))}
        onRemoveTeam={dropTeam}
        onQuick={() => selected && setQuick(selected.id)}
      />
      {selected && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <LayerButtons onLayer={layer} />
          {selected.k !== "link" && <Button type="button" size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs" onClick={dupSel}><Copy className="w-3.5 h-3.5" /> Duplicar</Button>}
          {isCarried(selected) && board.frames.length > 1 && <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => delSel(true)}>Solo aquí</Button>}
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs text-red-600" onClick={() => delSel(false)}><Trash2 className="w-3.5 h-3.5" /> Quitar</Button>
        </div>
      )}
    </div>
  ) : null;

  const panelTitle = side === "settings" ? "Campo y ajustes" : side === "roster" ? "Plantilla"
    : tool === "link" ? "Unir fichas" : multi ? `${selEls.length} elegidos`
      : selected ? KIND_LABEL[selected.k] : panelEl ? (isTeamTool(tool) ? `Fichas · ${teams.find((t) => t.id === tool)?.name || ""}` : curGroup ? curGroup.label : KIND_LABEL[panelEl.k]) : layersOpen ? "Capas" : "";
  const panelBody = playing ? null : side === "settings" ? settingsBody : side === "roster" ? rosterBody : (
    linkBody || (multi ? (
      <MultiPanel els={selEls} board={board} look={look} frames={board.frames.length} onTeam={teamMany} onColor={colorMany} onFeet={feetMany} onBib={bibMany} onTurn={turnMany} onResize={resizeMany} onSpread={spreadMany} onAlign={alignMany} onDistribute={distributeMany} onLayer={layer} onDup={dupMany} onDel={delMany} onClear={() => setSel([])} />
    ) : propsBody)
  );
  const layersBody = layersOpen && !playing && !side ? <LayerList els={cur.els} board={board} look={look} sel={sel} onPick={pickLayer} onStep={stepOne} onMoveTo={moveRow} /> : null;
  const showPanel = !panelHidden && (panelBody || layersBody);
  const panel = showPanel ? (
    <section
      aria-label={panelTitle || "Panel"}
      data-testid="board-panel"
      className={narrow ? "absolute left-2 right-2 bottom-2 max-h-[48%] overflow-y-auto rounded-xl bg-white shadow-2xl border border-gray-200" : "absolute left-[76px] top-3 w-[372px] max-h-[calc(100%-24px)] overflow-y-auto rounded-xl bg-white shadow-2xl border border-gray-200"}
      style={{ zIndex: 5 }}
    >
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b" style={{ background: RAIL.bg, color: RAIL.text, borderColor: RAIL.border }}>
        <h2 className="text-sm font-bold flex-1 truncate">{panelTitle || "Capas"}</h2>
        <button type="button" onClick={() => { setPanelHidden(true); setSide(null); }} aria-label="Cerrar panel" className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-white/10"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-3 space-y-3 text-gray-800">
        {panelBody}
        {layersBody}
      </div>
    </section>
  ) : null;

  const frameBtn = (f, i) => (
    <button key={f.id} type="button" role="tab" aria-selected={i === idx} onClick={() => goFrame(i)} data-testid={`frame-${i + 1}`}
      className="shrink-0 rounded-lg text-sm font-bold tabular-nums"
      style={{ width: narrow ? 44 : 52, height: narrow ? 36 : 30, background: i === idx ? RAIL.text : RAIL.btn, color: i === idx ? RAIL.onInk : RAIL.text, border: `1px solid ${i === idx ? RAIL.text : RAIL.line}` }}>
      {String(i + 1).padStart(2, "0")}
    </button>
  );
  const playBtn = (
    <RailBtn label={playing ? "Parar" : "Reproducir"} title={board.frames.length < 2 ? "Añade otro fotograma para animar (N)" : playing ? "Parar (Espacio)" : "Reproducir (Espacio)"} on={playing} disabled={imageMode || board.frames.length < 2} onClick={() => (playing ? stop() : setPlaying(true))} testid="rail-play">
      {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
    </RailBtn>
  );
  const frameOps = !imageMode && (
    <>
      <RailBtn label="Añadir fotograma" title="Añadir fotograma (N)" disabled={board.frames.length >= MAX_FRAMES} onClick={() => frameOp((b, i) => addFrame(b, i))} narrow={narrow} testid="rail-add-frame"><Plus className="w-5 h-5" />{narrow && <RailLabel>Nuevo</RailLabel>}</RailBtn>
      <RailBtn label="Duplicar fotograma" title="Duplicar fotograma (las flechas y zonas se deslizan)" disabled={board.frames.length >= MAX_FRAMES} onClick={() => frameOp((b, i) => duplicateFrame(b, i))} narrow={narrow}><Copy className="w-5 h-5" />{narrow && <RailLabel>Duplicar</RailLabel>}</RailBtn>
      <RailBtn label="Quitar fotograma" title="Quitar fotograma (M)" disabled={board.frames.length < 2} onClick={() => frameOp((b, i) => removeFrame(b, i))} narrow={narrow}><Minus className="w-5 h-5" />{narrow && <RailLabel>Quitar</RailLabel>}</RailBtn>
    </>
  );
  const helpBtn = (
    <BoardHelp open={helpOpen} onOpenChange={setHelpOpen} side={narrow ? "bottom" : "left"} trigger={
      <button type="button" aria-label="Ayuda y atajos" title="Ayuda y atajos (Mayús + H)" className="shrink-0 rounded-xl flex items-center justify-center" style={{ width: 44, height: 44, background: RAIL.btn, color: RAIL.ink, border: `1px solid ${RAIL.line}` }}>
        <Keyboard className="w-5 h-5" />
      </button>
    } />
  );
  const zoomBox = !playing && (
    <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: "rgba(36,0,10,0.88)", border: `1px solid ${RAIL.border}`, color: RAIL.text, zIndex: 4 }} data-testid="board-zoom">
      <button type="button" className={zoomBtnDark} onClick={() => zoomStep(-1)} disabled={cam.z <= 1} aria-label="Alejar"><ZoomOut className="w-4 h-4" /></button>
      <span className="text-[11px] font-semibold w-10 text-center tabular-nums" data-testid="zoom-level">{Math.round(cam.z * 100)}%</span>
      <button type="button" className={zoomBtnDark} onClick={() => zoomStep(1)} disabled={cam.z >= 4} aria-label="Acercar"><ZoomIn className="w-4 h-4" /></button>
      <button type="button" className={zoomBtnDark} onClick={() => { setCam(null); if (tool === "pan") pickTool("select"); }} disabled={cam.z <= 1} aria-label="Ver todo el campo"><Maximize className="w-4 h-4" /></button>
      <button type="button" aria-pressed={tool === "pan"} className={zoomBtnDark} style={tool === "pan" ? { background: RAIL.on, color: RAIL.onInk } : undefined} onClick={() => pickTool(tool === "pan" ? "select" : "pan")} disabled={cam.z <= 1 && tool !== "pan"} aria-label="Mover la vista"><Hand className="w-4 h-4" /></button>
    </div>
  );
  const stage = (
    <div ref={wrapRef} className={narrow ? "relative flex-1 min-h-0 flex items-center justify-center p-1" : "absolute inset-y-0 left-[72px] right-[80px] flex items-center justify-center p-3"}>
      <Board
        ref={svgRef}
        board={board}
        els={shownEls}
        selIds={playing ? [] : sel}
        marks={playing ? [] : tool === "link" ? pick : selected?.k === "link" ? selected.ids || [] : []}
        markNumbers={!playing && (tool === "link" || (selected?.k === "link" && (selected.mode || "line") === "line"))}
        ghosts={ghosts}
        draft={draft}
        handles={!playing}
        className="w-full h-full select-none"
        style={{ touchAction: "none", cursor, userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
        label="Pizarra"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onMouseDown={(e) => { if (e.detail > 1) e.preventDefault(); }}
      />
      {zoomBox}
      {quickEl && quickPos && (
        <ChipQuickEdit
          el={quickEl}
          board={board}
          look={look}
          patch={patchSel}
          onClose={() => setQuick(null)}
          onDup={() => { setQuick(null); dupSel(); }}
          onDel={(onlyHere) => { setQuick(null); delSel(onlyHere); }}
          canDelHere={isCarried(quickEl) && board.frames.length > 1}
          style={{ position: "absolute", left: quickPos.left, zIndex: 6, ...(quickPos.up ? { bottom: `calc(100% - ${quickPos.mid}px)` } : { top: quickPos.top }) }}
        />
      )}
      {narrow && panel}
    </div>
  );
  const hint = playing ? "Reproduciendo…" : error ? error
    : tool === "select" ? (sel.length ? "Arrastra para mover · Supr para quitar" : hasEls ? "Toca algo para elegirlo · arrastra un recuadro para elegir varios" : "Elige una herramienta en la barra de la izquierda y toca el campo")
      : isTeamTool(tool) ? "Toca el campo para colocar fichas" : ARROW_TOOLS.includes(tool) ? "Arrastra para dibujar la flecha" : tool === "zone" || tool === "quad" ? "Arrastra para dibujar la zona" : tool === "pan" ? "Arrastra para mover la vista" : "Toca el campo para colocarlo";

  const studio = narrow ? (
    <div className="fixed inset-0 flex flex-col" style={{ background: styleOf(look).surround || RAIL.bg, color: RAIL.text, zIndex: 50 }} onKeyDown={onKey} tabIndex={-1} data-testid="board-studio">
      <header className="flex items-center gap-1.5 px-2 py-2" style={{ background: RAIL.bg, borderBottom: `1px solid ${RAIL.border}` }}>
        <RailBtn label="Salir de la pizarra" title="Salir" onClick={closeStudio} testid="board-close"><ChevronLeft className="w-5 h-5" /></RailBtn>
        <div className="flex-1 min-w-0">
          <DialogPrimitive.Title className="text-sm font-bold truncate">{title}</DialogPrimitive.Title>
          <p className="text-[11px] truncate" style={{ color: RAIL.sub }}>{imageMode ? "Imagen" : `Fotograma ${idx + 1} de ${board.frames.length}`}</p>
        </div>
        <RailBtn label="Deshacer" title="Deshacer" disabled={!history.length} onClick={undo}><Undo2 className="w-5 h-5" /></RailBtn>
        <RailBtn label="Rehacer" title="Rehacer" disabled={!future.length} onClick={redo}><Redo2 className="w-5 h-5" /></RailBtn>
        {!imageMode && playBtn}
        <RailBtn label="Campo y ajustes" title="Campo, modo visual, animación y descargas" on={side === "settings"} onClick={() => toggleSide("settings")} testid="rail-settings"><Settings2 className="w-5 h-5" /></RailBtn>
      </header>
      {stage}
      {!imageMode && (
        <div role="tablist" aria-label="Fotogramas" className="flex items-center gap-1.5 px-2 py-1.5 overflow-x-auto" style={{ background: RAIL.bg, borderTop: `1px solid ${RAIL.border}` }}>
          {board.frames.map(frameBtn)}
          {frameOps}
        </div>
      )}
      <nav aria-label="Herramientas" className="flex items-center gap-1.5 px-2 pt-1.5 pb-3 overflow-x-auto" style={{ background: "#1c0007" }}>
        {toolButtons}
        <RailBtn label="Deshacer" disabled={!history.length} onClick={undo} narrow><Undo2 className="w-5 h-5" /><RailLabel>Deshacer</RailLabel></RailBtn>
      </nav>
    </div>
  ) : (
    <div className="fixed inset-0" style={{ background: styleOf(look).surround || "#0d2a1f", color: RAIL.text, zIndex: 50 }} onKeyDown={onKey} tabIndex={-1} data-testid="board-studio">
      {stage}
      <nav aria-label="Herramientas" className="absolute left-3 top-3 bottom-3 flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden pr-0.5 no-scrollbar" style={{ zIndex: 6 }}>
        {toolButtons}
        <RailSep />
        <RailBtn label="Deshacer" title="Deshacer (Ctrl + Z)" disabled={!history.length} onClick={undo}><Undo2 className="w-5 h-5" /></RailBtn>
        <RailBtn label="Rehacer" title="Rehacer (Ctrl + Mayús + Z)" disabled={!future.length} onClick={redo}><Redo2 className="w-5 h-5" /></RailBtn>
      </nav>
      <nav aria-label="Fotogramas y archivo" className="absolute right-3 top-3 bottom-3 flex flex-col items-center gap-1.5 overflow-y-auto overflow-x-hidden no-scrollbar" style={{ zIndex: 6 }}>
        <RailBtn label="Salir de la pizarra" title="Salir (Esc)" onClick={closeStudio} testid="board-close"><LogOut className="w-5 h-5 rotate-180" /></RailBtn>
        {!imageMode && playBtn}
        {!imageMode && (
          <div role="tablist" aria-label="Fotogramas" className="flex flex-col gap-1 my-1">
            {board.frames.map(frameBtn)}
          </div>
        )}
        {frameOps}
        <RailSep />
        <RailBtn label="Campo y ajustes" title="Campo, modo visual, animación y descargas" on={side === "settings"} onClick={() => toggleSide("settings")} testid="rail-settings"><Settings2 className="w-5 h-5" /></RailBtn>
        {helpBtn}
      </nav>
      {panel}
      <div className="absolute left-1/2 -translate-x-1/2 top-3 max-w-[50%] pointer-events-none rounded-full px-4 py-1.5 text-sm font-bold truncate" style={{ background: "rgba(36,0,10,0.9)", border: `1px solid ${RAIL.border}`, zIndex: 3 }}>
        <DialogPrimitive.Title className="truncate">{title}</DialogPrimitive.Title>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-3 max-w-[60%] pointer-events-none rounded-full px-4 py-1.5 text-xs flex gap-3 items-center" style={{ background: "rgba(36,0,10,0.9)", border: `1px solid ${RAIL.border}`, zIndex: 3 }} role="status">
        {!imageMode && board.frames.length > 1 && <span className="font-bold whitespace-nowrap">Fotograma {idx + 1} de {board.frames.length}</span>}
        <span className="truncate" style={{ color: error ? "#fca5a5" : RAIL.sub }}>{hint}</span>
        <span className="whitespace-nowrap hidden lg:inline" style={{ color: RAIL.sub }}>Mayús + H · atajos</span>
      </div>
    </div>
  );

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) closeStudio(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="outline-none"
          onEscapeKeyDown={(e) => { if (quick) { e.preventDefault(); setQuick(null); } else if (sel.length || tool !== "select") { e.preventDefault(); setSel([]); pickTool("select"); } }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {studio}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── Barras de la pantalla completa ─────────────────────────────────────────────────────────────────────────────────
const RAIL = { bg: "#24000a", btn: "rgba(42,0,9,0.94)", line: "#a84a2a", ink: "#FF9B4A", on: "#FF6E00", onInk: "#2a0009", text: "#F7E9E4", sub: "#E2C3BA", border: "#7a2a2f" };
const zoomBtnDark = "h-8 w-8 rounded-md flex items-center justify-center hover:bg-white/10 disabled:opacity-30";
function RailBtn({ label, title, on, disabled, onClick, children, narrow = false, dashed = false, testid }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title || label}
      aria-pressed={on === undefined ? undefined : !!on}
      disabled={disabled}
      onClick={onClick}
      data-testid={testid}
      className="shrink-0 rounded-xl flex flex-col items-center justify-center gap-0.5 disabled:opacity-35 transition-colors"
      style={{ width: narrow ? 58 : 44, height: narrow ? 52 : 44, background: on ? RAIL.on : RAIL.btn, color: on ? RAIL.onInk : RAIL.ink, border: `1px ${dashed ? "dashed" : "solid"} ${on ? RAIL.on : RAIL.line}` }}
    >
      {children}
    </button>
  );
}
const RailLabel = ({ children }) => <span className="text-[10px] font-semibold leading-none max-w-[54px] truncate">{children}</span>;
const RailSep = ({ narrow = false }) => <span aria-hidden="true" className={narrow ? "w-px h-8 shrink-0 mx-0.5" : "h-px w-8 shrink-0 my-0.5 mx-auto"} style={{ background: RAIL.border }} />;
const TOOL_INFO = Object.fromEntries([...OBJECT_TOOLS, ...LINE_TOOLS].map((t) => [t.id, t]));
const TOOL_GROUPS = [
  { id: "arrow", label: "Flechas", short: "Flecha", key: "A", icon: MoveUpRight, tools: ARROW_TOOLS },
  { id: "zone", label: "Zonas", short: "Zona", key: "D", icon: Square, tools: ["zone", "quad"] },
  { id: "material", label: "Material", short: "Material", key: "T", icon: Triangle, tools: ["cone", "goal", ...MATERIAL_IDS] },
];

