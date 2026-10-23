import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, BoxSelect, ChevronLeft, ChevronRight, Circle, Copy, Film, Image as ImageIcon, Layers, MousePointer2, MoveUpRight, Pause, Pentagon, Play, Plus, Repeat, Spline, Square, SquareCheckBig, TrendingUp, Triangle, Type, Trash2, Undo2, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AIR_MAX, FIELDS, LOOKS, MATERIALS, MAX_FRAMES, MAX_TEAMS, ORIENTS, addElement, addFrame, addTeam, alignElements, arrowPoints, changeField, chipOf, defaultControl, distributeElements, drawOrder, duplicateFrame, elementsInBox, faceToward, fieldOf, fromView,
  boardMode, boardSpeed, ghostsOf, hitTest, isCarried, isLinkable, isMovable, isQuad, isSideways, lerpFrames, lookOf, materialOf, moveFrame, moveLayer, newId, normalizeBoard, orderForLine, orientOf, patchElement, recolorElements, removeElement,
  removeElements, removeFrame, removeTeam, resizeElements, setAllChips, setAllFeet, setFeetOf, setTeamOf, shiftElement, spreadElements, stepLayer, teamInUse, teamsOf, liftNormal, zoneCorners,
} from "@/lib/board";
import Board, { ChipGlyph } from "./BoardSvg";
import { DummyIcon, GoalIcon, HurdleIcon, LadderIcon, PoleIcon } from "./BoardControls";
import BoardProps, { ARROW_PRESETS, KIND_LABEL, typeOfArrow } from "./BoardProps";
import BoardDownloads from "./BoardDownloads";
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
const BRUSH_KEYS = ["shape", "color", "color2", "pattern", "size", "w", "rungs", "width", "dash", "border", "borderColor", "pointer", "fill", "fillOpacity", "stroke", "strokeWidth", "font", "bold", "lift"];
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
  const [playing, setPlaying] = useState(false);
  const [anim, setAnim] = useState(null);
  const [loop, setLoop] = useState(false);
  const [trails, setTrails] = useState(true);
  const [error, setError] = useState("");
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
  useEffect(() => {
    if (playing || !sel.length) return;
    const alive = sel.filter((id) => cur.els.some((e) => e.id === id));
    if (alive.length !== sel.length) setSel(alive);
  }, [sel, cur, playing]);
  useEffect(() => { if (fi > last) setFi(last); }, [fi, last]);

  // Los cambios seguidos de un mismo control (deslizador, selector de color) cuentan como uno solo al deshacer.
  const commit = (next, { record = true, key = null } = {}) => {
    if (record) {
      const now = Date.now();
      const same = key && coalesce.current.key === key && now - coalesce.current.at < 900;
      if (!same) setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), live.current]);
      coalesce.current = { key, at: now };
    }
    onChange(next);
  };
  const undo = () => {
    if (!history.length) return;
    onChange(history[history.length - 1]);
    setHistory(history.slice(0, -1)); // lo elegido sigue elegido (si ya no existe, se suelta solo)
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
  const toField = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return fromView(field, orient, pt.matrixTransform(svg.getScreenCTM().inverse()));
  };
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

  const setEls = (els, opts) => commit({ ...live.current, frames: live.current.frames.map((f, i) => (i === idx ? { ...f, els } : f)) }, opts);
  const add = (el) => { commit(addElement(live.current, idx, el)); setSelId(el.id); };

  const onDown = (e) => {
    if (playing) return;
    if (e.button !== undefined && e.button > 0) return;
    const p = point(e);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const handle = e.target?.dataset?.h;
    if (handle && (selected?.k === "arrow" || (isQuad(selected) && /^q[0-3]$/.test(handle)) || (selected?.k === "token" && handle === "f") || (materialOf(selected?.k) && handle === "r"))) {
      drag.current = { mode: "handle", h: handle, id: selected.id, el: selected, snapshot: live.current };
      return;
    }
    // Unir fichas: se toca cada ficha (o se arrastra un recuadro) para elegirlas; luego se crea el conector
    if (tool === "link") {
      const hit = hitTest(drawOrder(cur.els.filter(isLinkable)), p, { orient, chip });
      if (hit) setPick((pk) => (pk.includes(hit.id) ? pk.filter((i) => i !== hit.id) : [...pk, hit.id]));
      else { drag.current = { mode: "box", from: p }; setDraft({ k: "box", x: p.x, y: p.y, w: 0, h: 0 }); }
      return;
    }
    // Con las herramientas de colocar (fichas, balón…) una zona o un conector no se «agarra» por dentro: ahí se coloca
    const sorted = drawOrder(cur.els);
    const additive = tool === "select" && (multiMode || e.shiftKey || e.ctrlKey || e.metaKey);
    const target = hitTest(tool === "select" ? sorted : sorted.filter((el) => el.k !== "zone" && el.k !== "link"), p, { orient, chip });
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
        // arrastrar una de varias elegidas las mueve todas; tocarla sin arrastrar deja solo esa
        const inGroup = sel.length > 1 && sel.includes(target.id);
        if (!inGroup) setSel([target.id]);
        // un conector no se arrastra: su forma sale de las fichas que une
        drag.current = target.k === "link" && !inGroup ? null : { mode: "move", ids: inGroup ? sel : [target.id], only: inGroup ? target.id : null, from: p, moved: false, snapshot: live.current };
      } else {
        // espacio vacío: recuadro para elegir varias cosas a la vez
        if (!additive) setSel([]);
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

  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
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
      const els = d.snapshot.frames[idx].els.map((el) => (d.ids.includes(el.id) ? shiftElement(el, dx, dy) : el));
      onChange({ ...d.snapshot, frames: d.snapshot.frames.map((f, i) => (i === idx ? { ...f, els } : f)) });
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if ((d.mode === "move" || d.mode === "handle") && d.moved) {
      setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), d.snapshot]);
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
        const { curved, ...rest } = draft;
        const el = { id: newId(), ...rest };
        if (curved && el.k === "arrow") Object.assign(el, defaultControl(el));
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
    if (t && Object.keys(keep).length) setBrush((b) => ({ ...b, [t]: { ...b[t], ...keep } }));
  };
  const brushKey = isTeamTool(tool) ? "token" : tool;
  const patchBrush = (patch) => setBrush((b) => ({ ...b, [brushKey]: { ...b[brushKey], ...patch } }));
  const setArrowType = (t) => {
    if (selected?.k === "arrow") patchSel({ ...ARROW_PRESETS[t], lift: t === "air" ? Number(selected.lift) || 6 : selected.lift }, "type");
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
  const selectAll = () => { setTool("select"); setDraft(null); setPick([]); setSel(cur.els.filter((e) => e.k !== "link").map((e) => e.id)); };
  const clearFrame = () => { if (cur.els.length) { setEls([]); setSel([]); } };

  const addPlayer = (p) => {
    const team = isTeamTool(tool) ? tool : "a";
    const n = cur.els.filter((e) => e.k === "token").length;
    add({ id: newId(), k: "token", x: round(Math.min(8 + (n % 6) * 10, field.w - 4)), y: round(6 + Math.floor(n / 6) * 7), team, label: p.label });
  };

  const pickTool = (id) => { setTool(id); if (id !== "select") { setSel([]); setMultiMode(false); } setPick([]); setDraft(null); stop(); };

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
  const cursor = tool === "select" || playing ? "default" : "crosshair";
  const hasEls = board.frames.some((f) => f.els.length);

  // Qué muestra el panel de propiedades: el elemento seleccionado o la herramienta elegida
  const brushEl = !selected && !playing
    ? isTeamTool(tool) ? { k: "token", team: tool, ...brush.token }
      : KIND_OF_TOOL[tool] ? { k: KIND_OF_TOOL[tool], ...brush[tool] } : null
    : null;
  const panelEl = !playing ? selected || brushEl : null;

  const toolBtn = (t, content) => {
    const on = tool === t.id;
    return (
      <button
        key={t.id}
        type="button"
        title={t.label}
        aria-label={t.label}
        aria-pressed={on}
        onClick={() => pickTool(t.id)}
        className={`h-8 min-w-8 px-1.5 rounded-md border text-[11px] font-semibold flex items-center gap-1 ${on ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
      >
        {content(on)}
      </button>
    );
  };
  const iconTool = (t) => toolBtn(t, (on) => {
    const Icon = t.icon;
    return (
      <>
        <Icon className="w-3.5 h-3.5" style={on || !t.color ? undefined : { color: t.color }} />
        <span className="hidden sm:inline">{t.label.replace(/ \(.*\)/, "")}</span>
      </>
    );
  });

  const setMode = (m) => { stop(); setFi(0); setSelId(null); setPick([]); setDraft(null); commit({ ...live.current, mode: m }); };

  return (
    <div className="space-y-2">
      {modes && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 space-y-1" data-testid="board-mode">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Tipo de dibujo</span>
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
          </div>
          <p className="text-[11px] text-gray-500">
            {imageMode
              ? board.frames.length > 1
                ? "Se guarda como imagen (el fotograma 1). Las demás posiciones de la animación se conservan por si vuelves a Animación."
                : "Se guarda como imagen fija; se puede descargar en PNG."
              : board.frames.length > 1
                ? "Se guarda la animación en la tarea y se puede descargar como vídeo."
                : "Añade un segundo fotograma con + para moverlas y crear la animación."}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={board.field} onChange={(e) => commit(changeField(board, e.target.value))} className={selectCls} aria-label="Tipo de campo">
          {allowed.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <select value={orient} onChange={(e) => commit({ ...board, orient: orientOf(e.target.value) })} className={selectCls} aria-label="Orientación del campo" title="Orientación del campo">
          {ORIENTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select value={look} onChange={(e) => commit({ ...board, look: e.target.value })} className={selectCls} aria-label="Modo visual">
          {LOOKS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <div className="flex flex-wrap gap-1 ml-auto">
          <BoardDownloads board={board} frame={idx} filename={filename} />
          <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={undo} disabled={!history.length} title="Deshacer"><Undo2 className="w-3.5 h-3.5" /></Button>
          <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-red-600" onClick={clearFrame} disabled={!cur.els.length} title="Vaciar este fotograma"><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {toolBtn({ id: "select", label: "Mover" }, () => (<><MousePointer2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Mover</span></>))}
        <button
          type="button"
          title="Varios: toca cada cosa para sumarla o quitarla de lo elegido (en el ordenador también con Mayús)"
          aria-label="Elegir varios"
          aria-pressed={multiMode}
          onClick={() => { if (tool !== "select") pickTool("select"); setMultiMode((m) => !m); }}
          className={`h-8 min-w-8 px-1.5 rounded-md border text-[11px] font-semibold flex items-center gap-1 ${multiMode ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
        >
          <BoxSelect className="w-3.5 h-3.5" /><span className="hidden sm:inline">Varios</span>
        </button>
        <button
          type="button"
          title="Elegir todo lo del fotograma"
          aria-label="Elegir todo"
          onClick={selectAll}
          disabled={!cur.els.length || playing}
          className="h-8 min-w-8 px-1.5 rounded-md border text-[11px] font-semibold flex items-center gap-1 bg-white text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-40"
        >
          <SquareCheckBig className="w-3.5 h-3.5" /><span className="hidden sm:inline">Todo</span>
        </button>
        <button
          type="button"
          title="Lista de capas: elegir cualquier cosa del fotograma y subirla o bajarla"
          aria-label="Lista de capas"
          aria-pressed={layersOpen}
          onClick={() => setLayersOpen((o) => !o)}
          className={`h-8 min-w-8 px-1.5 rounded-md border text-[11px] font-semibold flex items-center gap-1 ${layersOpen ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
        >
          <Layers className="w-3.5 h-3.5" /><span className="hidden sm:inline">Capas</span>
        </button>
        <span className="w-px h-5 bg-gray-200 mx-0.5" aria-hidden="true" />
        {teams.map((t) => toolBtn({ id: t.id, label: t.name }, () => (
          <>
            <ChipGlyph board={board} el={{ team: t.id }} look={look} size={16} />
            <span className="hidden md:inline max-w-[64px] truncate">{t.name}</span>
          </>
        )))}
        {teams.length < MAX_TEAMS && (
          <button type="button" onClick={newTeam} title="Nuevo equipo (otro color de fichas)" aria-label="Nuevo equipo" className="h-8 px-1.5 rounded-md border border-dashed border-gray-300 bg-white text-[11px] font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Equipo</span>
          </button>
        )}
        <span className="w-px h-5 bg-gray-200 mx-0.5" aria-hidden="true" />
        {OBJECT_TOOLS.map(iconTool)}
        <span className="w-px h-5 bg-gray-200 mx-0.5" aria-hidden="true" />
        {LINE_TOOLS.map(iconTool)}
      </div>

      <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex justify-center">
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
          className="w-full max-w-[560px] select-none"
          style={{ touchAction: "none", cursor, maxHeight: tall ? 560 : 380 }}
          label="Pizarra"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>

      {tool === "link" && !playing && (
        <div className="rounded-lg border px-2 py-1.5 space-y-1.5 bg-gray-50 border-gray-200" data-testid="link-bar">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Unir fichas</span>
            <span className="text-[11px] text-gray-600 flex-1 min-w-[120px]">
              {pick.length ? `${pick.length} ${pick.length === 1 ? "elegida" : "elegidas"}` : "Toca las fichas que quieras unir, o arrastra un recuadro sobre ellas (también vale con conos y balón)."}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-gray-600">Crear</span>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pick.length < 2} onClick={() => makeLink("line")} title="Una línea de un extremo al otro de las fichas">Línea</Button>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pick.length < 3} onClick={() => makeLink("zone")} title="Una zona que envuelve a todas las fichas">Zona</Button>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pick.length < 2} onClick={() => makeLink("mesh")} title="Todas las fichas unidas entre sí">Red</Button>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs ml-auto" disabled={!pick.length} onClick={() => setPick([])}>Borrar elección</Button>
          </div>
        </div>
      )}

      {multi && !playing && (
        <MultiPanel
          els={selEls}
          board={board}
          look={look}
          frames={board.frames.length}
          onTeam={teamMany}
          onColor={colorMany}
          onFeet={feetMany}
          onResize={resizeMany}
          onSpread={spreadMany}
          onAlign={alignMany}
          onDistribute={distributeMany}
          onLayer={layer}
          onDup={dupMany}
          onDel={delMany}
          onClear={() => setSel([])}
        />
      )}

      {panelEl && (
        <div className={`rounded-lg border px-2 py-1.5 space-y-1.5 ${selected ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`} data-testid="board-props">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
              {selected ? KIND_LABEL[selected.k] : `Lo siguiente que dibujes${isTeamTool(tool) ? "" : ` (${KIND_LABEL[panelEl.k].toLowerCase()})`}`}
            </span>
            {selected && <span className="text-[11px] text-amber-800 flex-1 min-w-[80px]">{selected.k === "arrow" ? "Arrastra la flecha o sus puntos" : selected.k === "token" && selected.feet ? "Arrastra la ficha; el punto naranja gira hacia dónde mira" : materialOf(selected.k) ? "Arrastra el material; el punto naranja lo gira" : selected.k === "link" ? "Sigue a sus fichas: mueve las fichas para cambiar la figura" : isQuad(selected) ? "Arrastra la zona o sus esquinas" : isMovable(selected) && board.frames.length > 1 ? "Arrástrala en cada fotograma" : "Arrastra para moverla"}</span>}
          </div>
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
          />
          {selected && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <LayerButtons onLayer={layer} />
              {selected.k !== "link" && <Button type="button" size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs" onClick={dupSel} title="Duplicar"><Copy className="w-3.5 h-3.5" /> Duplicar</Button>}
              {isCarried(selected) && board.frames.length > 1 && (
                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => delSel(true)} title="Quitar solo de este fotograma">Solo aquí</Button>
              )}
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs text-red-600" onClick={() => delSel(false)} title={isCarried(selected) && board.frames.length > 1 ? "Quitar de todos los fotogramas" : "Quitar"}><Trash2 className="w-3.5 h-3.5" /> Quitar</Button>
            </div>
          )}
        </div>
      )}

      {layersOpen && !playing && <LayerList els={cur.els} board={board} look={look} sel={sel} onPick={pickLayer} onStep={stepOne} />}

      {!imageMode && <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" size="sm" className="h-8 px-2.5 gap-1 text-xs" onClick={() => (playing ? stop() : setPlaying(true))} disabled={board.frames.length < 2} title={board.frames.length < 2 ? "Añade otro fotograma para animar" : playing ? "Parar" : "Reproducir la animación"}>
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} {playing ? "Parar" : "Reproducir"}
        </Button>
        <div className="flex gap-1 items-center" role="tablist" aria-label="Fotogramas">
          {board.frames.map((f, i) => (
            <button key={f.id} type="button" role="tab" aria-selected={i === idx} onClick={() => goFrame(i)}
              className={`h-8 min-w-8 px-2 rounded-md border text-xs font-bold ${i === idx ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
              {i + 1}
            </button>
          ))}
          <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={() => frameOp((b, i) => addFrame(b, i))} disabled={board.frames.length >= MAX_FRAMES} title="Nuevo fotograma (copia las posiciones del actual)" aria-label="Nuevo fotograma"><Plus className="w-3.5 h-3.5" /></Button>
        </div>
        {board.frames.length > 1 && (
          <div className="flex gap-1 items-center ml-auto">
            <select value={speed} onChange={(e) => commit({ ...live.current, speed: Number(e.target.value) }, { record: false })} className={selectCls} aria-label="Velocidad">
              {SPEEDS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button type="button" aria-pressed={loop} title="Repetir" aria-label="Repetir" onClick={() => setLoop((l) => !l)} className={`h-8 w-8 rounded-md border flex items-center justify-center ${loop ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200"}`}><Repeat className="w-3.5 h-3.5" /></button>
            <button type="button" aria-pressed={trails} title="Mostrar de dónde viene cada ficha" aria-label="Rastro" onClick={() => setTrails((t) => !t)} className={`h-8 px-2 rounded-md border text-[11px] font-semibold ${trails ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200"}`}>Rastro</button>
          </div>
        )}
      </div>}
      {!imageMode && board.frames.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
          <span>Fotograma {idx + 1} de {board.frames.length}</span>
          <Button type="button" size="sm" variant="outline" className="h-7 px-1.5" onClick={() => frameOp((b, i) => moveFrame(b, i, -1))} disabled={idx === 0} title="Mover antes" aria-label="Mover fotograma antes"><ChevronLeft className="w-3.5 h-3.5" /></Button>
          <Button type="button" size="sm" variant="outline" className="h-7 px-1.5" onClick={() => frameOp((b, i) => moveFrame(b, i, 1))} disabled={idx === last} title="Mover después" aria-label="Mover fotograma después"><ChevronRight className="w-3.5 h-3.5" /></Button>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={() => frameOp((b, i) => duplicateFrame(b, i))} disabled={board.frames.length >= MAX_FRAMES}><Copy className="w-3 h-3" /> Duplicar</Button>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 gap-1 text-red-600" onClick={() => frameOp((b, i) => removeFrame(b, i))}><Trash2 className="w-3 h-3" /> Quitar fotograma</Button>
        </div>
      )}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

      {roster.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Añadir jugador (con el color del equipo elegido arriba)</p>
          <div className="flex flex-wrap gap-1">
            {roster.map((p) => (
              <button key={p.id} type="button" onClick={() => addPlayer(p)}
                className={`px-2 py-0.5 rounded-full border text-[11px] ${used.has(p.label) ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
                + {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {hasEls && tool === "select" && !sel.length && !playing && <p className="text-[11px] text-gray-400">Toca algo para elegirlo. Para elegir varias cosas, arrastra un recuadro por el campo o activa «Varios».</p>}
      {!hasEls && <p className="text-[11px] text-gray-400">Elige una herramienta y toca el campo. Con «+» añades un fotograma para animar el movimiento.</p>}
    </div>
  );
}
