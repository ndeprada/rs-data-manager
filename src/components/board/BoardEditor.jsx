import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, Circle, Copy, Download, Flag, MousePointer2, MoveUpRight, Pause, Play, Plus, Repeat, RotateCw, Spline, Square, Triangle, Type, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FIELDS, LOOKS, MAX_FRAMES, TEAMS, addElement, addFrame, byRank, changeField, defaultControl, duplicateFrame, fieldOf, fromView, ghostsOf,
  hitTest, isMovable, lerpFrames, lookOf, moveFrame, newId, normalizeBoard, patchElement, removeElement, removeFrame, shiftElement,
} from "@/lib/board";
import Board, { TEAM_COLORS } from "./BoardSvg";
import { boardToPngBlob, downloadBlob } from "./exportPng";

// Editor de la pizarra: fichas, balón, conos, porterías, flechas (rectas o curvas), zonas y textos, con fotogramas para
// animar el movimiento. Mismo editor para tareas de entrenamiento, tácticas y balón parado.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = (n) => Math.round(n * 10) / 10;

const TOOLS = [
  { id: "select", label: "Mover", icon: MousePointer2 },
  { id: "a", label: "Equipo A", icon: Circle, color: TEAM_COLORS.a },
  { id: "b", label: "Equipo B", icon: Circle, color: TEAM_COLORS.b },
  { id: "c", label: "Comodín", icon: Circle, color: TEAM_COLORS.c },
  { id: "gk", label: "Portero", icon: Circle, color: TEAM_COLORS.gk },
  { id: "ball", label: "Balón", icon: Circle, color: "#111827", ring: true },
  { id: "cone", label: "Cono", icon: Triangle, color: "#f97316" },
  { id: "goal", label: "Portería", icon: Flag, color: "#6b7280" },
  { id: "move", label: "Desplazamiento", icon: MoveUpRight },
  { id: "pass", label: "Pase", icon: Spline, color: "#2563eb" },
  { id: "dribble", label: "Conducción", icon: Activity, color: "#73000A" },
  { id: "zone", label: "Zona", icon: Square },
  { id: "text", label: "Texto", icon: Type },
];
const TEAM_TOOLS = ["a", "b", "c", "gk"];
const ARROW_TOOLS = ["move", "pass", "dribble"];
const SPEEDS = [{ id: 2600, label: "Lenta" }, { id: 1500, label: "Normal" }, { id: 800, label: "Rápida" }];
const MAX_HISTORY = 30;

const selectCls = "h-8 rounded-md border border-gray-200 bg-white px-2 text-xs";

/**
 * value     dibujo guardado (formato nuevo o antiguo) o null
 * onChange  (nuevoDibujo) => void
 * roster    [{ id, label }] nombres para añadir fichas con un toque
 * fields    ids de campo permitidos (por defecto todos)
 */
export default function BoardEditor({ value, onChange, roster = [], fields = null, filename = "pizarra" }) {
  const board = useMemo(() => normalizeBoard(value), [value]);
  const field = fieldOf(board.field);
  const orient = board.orient;
  const look = lookOf(board.look);
  const [fi, setFi] = useState(0);
  const [tool, setTool] = useState("select");
  const [selId, setSelId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [history, setHistory] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [anim, setAnim] = useState(null);
  const [speed, setSpeed] = useState(1500);
  const [loop, setLoop] = useState(false);
  const [trails, setTrails] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const svgRef = useRef(null);
  const drag = useRef(null);
  const live = useRef(board);
  live.current = board;

  const last = board.frames.length - 1;
  const idx = Math.min(fi, last);
  const cur = board.frames[idx];
  const prev = idx > 0 ? board.frames[idx - 1] : null;
  const selected = cur.els.find((e) => e.id === selId) || null;
  useEffect(() => { if (selId && !selected && !playing) setSelId(null); }, [selId, selected, playing]);
  useEffect(() => { if (fi > last) setFi(last); }, [fi, last]);

  const commit = (next, { record = true } = {}) => {
    if (record) setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), live.current]);
    onChange(next);
  };
  const undo = () => setHistory((h) => {
    if (!h.length) return h;
    onChange(h[h.length - 1]);
    setSelId(null);
    return h.slice(0, -1);
  });

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
  const point = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const v = pt.matrixTransform(svg.getScreenCTM().inverse());
    const p = fromView(field, orient, v);
    return { x: round(clamp(p.x, -2, field.w + 2)), y: round(clamp(p.y, -2, field.h + 2)) };
  };

  const setEls = (els, opts) => commit({ ...live.current, frames: live.current.frames.map((f, i) => (i === idx ? { ...f, els } : f)) }, opts);
  const add = (el) => { commit(addElement(live.current, idx, el)); setSelId(el.id); };

  const onDown = (e) => {
    if (playing) return;
    if (e.button !== undefined && e.button > 0) return;
    const p = point(e);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const handle = e.target?.dataset?.h;
    if (handle && selected?.k === "arrow") {
      drag.current = { mode: "handle", h: handle, id: selected.id, snapshot: live.current };
      return;
    }
    const target = hitTest([...cur.els].sort(byRank), p);
    if (tool === "select" || (target && !["zone", ...ARROW_TOOLS].includes(tool))) {
      if (target) {
        setSelId(target.id);
        drag.current = { mode: "move", id: target.id, from: p, moved: false, snapshot: live.current };
      } else setSelId(null);
      return;
    }
    if (TEAM_TOOLS.includes(tool)) return add({ id: newId(), k: "token", x: p.x, y: p.y, team: tool, label: "" });
    if (["ball", "cone", "goal"].includes(tool)) return add({ id: newId(), k: tool, x: p.x, y: p.y });
    if (tool === "text") return add({ id: newId(), k: "text", x: p.x, y: p.y, text: "Texto" });
    if (ARROW_TOOLS.includes(tool)) { setDraft({ k: "arrow", style: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y }); drag.current = { mode: "draw" }; return; }
    if (tool === "zone") { setDraft({ k: "zone", x: p.x, y: p.y, w: 0, h: 0 }); drag.current = { mode: "draw" }; }
  };

  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    if (d.mode === "draw") {
      setDraft((c) => (c ? (c.k === "arrow" ? { ...c, x2: p.x, y2: p.y } : { ...c, w: round(p.x - c.x), h: round(p.y - c.y) }) : c));
      return;
    }
    if (d.mode === "handle") {
      const key = d.h === "p1" ? { x1: p.x, y1: p.y } : d.h === "p2" ? { x2: p.x, y2: p.y } : { cx: p.x, cy: p.y };
      onChange(patchElement(d.snapshot, idx, d.id, key));
      d.moved = true;
      return;
    }
    if (d.mode === "move") {
      const dx = p.x - d.from.x, dy = p.y - d.from.y;
      if (!d.moved && Math.hypot(dx, dy) < 0.6) return;
      d.moved = true;
      const els = d.snapshot.frames[idx].els.map((el) => (el.id === d.id ? shiftElement(el, dx, dy) : el));
      onChange({ ...d.snapshot, frames: d.snapshot.frames.map((f, i) => (i === idx ? { ...f, els } : f)) });
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if ((d.mode === "move" || d.mode === "handle") && d.moved) setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), d.snapshot]);
    if (d.mode === "draw" && draft) {
      const big = draft.k === "arrow" ? Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 2.5 : Math.abs(draft.w) > 2.5 && Math.abs(draft.h) > 2.5;
      if (big) add({ id: newId(), ...draft });
      setDraft(null);
    }
  };

  // ── Elemento seleccionado ────────────────────────────────────────────────────────────────────────────────────────
  const patchSel = (patch, allFrames = false) => commit(patchElement(board, idx, selId, patch, { allFrames }));
  const delSel = (onlyHere = false) => { commit(removeElement(board, idx, selId, { onlyHere })); setSelId(null); };
  const dupSel = () => {
    if (!selected) return;
    const copy = shiftElement({ ...selected, id: newId() }, 3, 3);
    add(copy);
  };
  const clearFrame = () => { if (cur.els.length) { setEls([]); setSelId(null); } };

  const addPlayer = (p) => {
    const team = TEAM_TOOLS.includes(tool) ? tool : "a";
    const n = cur.els.filter((e) => e.k === "token").length;
    add({ id: newId(), k: "token", x: round(Math.min(8 + (n % 6) * 10, field.w - 4)), y: round(6 + Math.floor(n / 6) * 7), team, label: p.label });
  };

  // ── Fotogramas ───────────────────────────────────────────────────────────────────────────────────────────────────
  const goFrame = (i) => { stop(); setFi(i); setSelId(null); setDraft(null); };
  const frameOp = (fn) => { stop(); const r = fn(live.current, idx); commit(r.board); setFi(r.index); setSelId(null); };

  const exportPng = async () => {
    setBusy(true);
    setError("");
    try {
      const blob = await boardToPngBlob(<Board board={board} els={cur.els} />);
      downloadBlob(blob, `${filename}${board.frames.length > 1 ? `-${idx + 1}` : ""}.png`);
    } catch (err) {
      setError(err?.message || "No se pudo descargar la imagen");
    } finally {
      setBusy(false);
    }
  };

  const allowed = fields ? FIELDS.filter((f) => fields.includes(f.id)) : FIELDS;
  const used = new Set(cur.els.filter((e) => e.k === "token").map((e) => e.label));
  const tall = (orient === "v" ? field.h : field.w) > 80;
  const cursor = tool === "select" || playing ? "default" : "crosshair";
  const hasEls = board.frames.some((f) => f.els.length);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={board.field} onChange={(e) => commit(changeField(board, e.target.value))} className={selectCls} aria-label="Tipo de campo">
          {allowed.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <Button type="button" size="sm" variant="outline" className="h-8 px-2 gap-1 text-xs" onClick={() => commit({ ...board, orient: orient === "v" ? "h" : "v" })} title="Girar el campo (vertical / horizontal)" aria-label="Girar el campo">
          <RotateCw className="w-3.5 h-3.5" /> {orient === "v" ? "Vertical" : "Horizontal"}
        </Button>
        <select value={look} onChange={(e) => commit({ ...board, look: e.target.value })} className={selectCls} aria-label="Modo visual">
          {LOOKS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <div className="flex gap-1 ml-auto">
          <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={exportPng} disabled={busy} title="Descargar este fotograma como imagen"><Download className="w-3.5 h-3.5" /></Button>
          <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={undo} disabled={!history.length} title="Deshacer"><Undo2 className="w-3.5 h-3.5" /></Button>
          <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-red-600" onClick={clearFrame} disabled={!cur.els.length} title="Vaciar este fotograma"><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const on = tool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={on}
              onClick={() => { setTool(t.id); if (t.id !== "select") setSelId(null); stop(); }}
              className={`h-8 min-w-8 px-1.5 rounded-md border text-[11px] font-semibold flex items-center gap-1 ${on ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
            >
              <Icon className="w-3.5 h-3.5" style={on || !t.color ? undefined : { color: t.color }} fill={TEAM_TOOLS.includes(t.id) ? (on ? "#fff" : t.color) : "none"} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex justify-center">
        <Board
          ref={svgRef}
          board={board}
          els={shownEls}
          selId={playing ? null : selId}
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

      <div className="flex flex-wrap items-center gap-1.5">
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
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className={selectCls} aria-label="Velocidad">
              {SPEEDS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button type="button" aria-pressed={loop} title="Repetir" aria-label="Repetir" onClick={() => setLoop((l) => !l)} className={`h-8 w-8 rounded-md border flex items-center justify-center ${loop ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200"}`}><Repeat className="w-3.5 h-3.5" /></button>
            <button type="button" aria-pressed={trails} title="Mostrar de dónde viene cada ficha" aria-label="Rastro" onClick={() => setTrails((t) => !t)} className={`h-8 px-2 rounded-md border text-[11px] font-semibold ${trails ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200"}`}>Rastro</button>
          </div>
        )}
      </div>
      {board.frames.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
          <span>Fotograma {idx + 1} de {board.frames.length}</span>
          <Button type="button" size="sm" variant="outline" className="h-7 px-1.5" onClick={() => frameOp((b, i) => moveFrame(b, i, -1))} disabled={idx === 0} title="Mover antes" aria-label="Mover fotograma antes"><ChevronLeft className="w-3.5 h-3.5" /></Button>
          <Button type="button" size="sm" variant="outline" className="h-7 px-1.5" onClick={() => frameOp((b, i) => moveFrame(b, i, 1))} disabled={idx === last} title="Mover después" aria-label="Mover fotograma después"><ChevronRight className="w-3.5 h-3.5" /></Button>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={() => frameOp((b, i) => duplicateFrame(b, i))} disabled={board.frames.length >= MAX_FRAMES}><Copy className="w-3 h-3" /> Duplicar</Button>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 gap-1 text-red-600" onClick={() => frameOp((b, i) => removeFrame(b, i))}><Trash2 className="w-3 h-3" /> Quitar fotograma</Button>
        </div>
      )}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

      {selected && !playing && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5">
          {selected.k === "token" && (
            <>
              <Input value={selected.label || ""} onChange={(e) => patchSel({ label: e.target.value }, true)} placeholder="Nombre" className="h-7 w-28 text-xs" aria-label="Nombre de la ficha" />
              <div className="flex gap-1">
                {TEAMS.map((t) => (
                  <button key={t.id} type="button" title={t.label} aria-label={t.label} onClick={() => patchSel({ team: t.id }, true)}
                    className={`w-5 h-5 rounded-full border-2 ${selected.team === t.id ? "border-gray-900" : "border-white"}`} style={{ background: TEAM_COLORS[t.id] }} />
                ))}
              </div>
            </>
          )}
          {selected.k === "text" && <Input value={selected.text || ""} onChange={(e) => patchSel({ text: e.target.value })} className="h-7 w-40 text-xs" aria-label="Texto" />}
          {selected.k === "arrow" && (
            <>
              <select value={selected.style} onChange={(e) => patchSel({ style: e.target.value })} className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs" aria-label="Tipo de flecha">
                <option value="move">Desplazamiento</option>
                <option value="pass">Pase</option>
                <option value="dribble">Conducción</option>
              </select>
              <select value={selected.pointer || "arrow"} onChange={(e) => patchSel({ pointer: e.target.value })} className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs" aria-label="Punta de la flecha">
                <option value="arrow">Flecha</option>
                <option value="bar">Barra</option>
                <option value="none">Sin punta</option>
              </select>
              <button type="button" aria-pressed={selected.cx != null} onClick={() => patchSel(selected.cx != null ? { cx: undefined, cy: undefined } : defaultControl(selected))}
                className={`h-7 px-2 rounded-md border text-xs font-semibold ${selected.cx != null ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>Curva</button>
            </>
          )}
          {selected.k === "zone" && (
            <select value={selected.shape || "rect"} onChange={(e) => patchSel({ shape: e.target.value })} className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs" aria-label="Forma de la zona">
              <option value="rect">Rectángulo</option>
              <option value="ellipse">Elipse</option>
            </select>
          )}
          <span className="text-[11px] text-amber-800 flex-1 min-w-[80px]">{selected.k === "arrow" ? "Arrastra la flecha o sus puntos" : isMovable(selected) && board.frames.length > 1 ? "Arrástrala en cada fotograma" : "Arrastra para moverla"}</span>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={dupSel} title="Duplicar"><Copy className="w-3.5 h-3.5" /></Button>
          {isMovable(selected) && board.frames.length > 1 && (
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => delSel(true)} title="Quitar solo de este fotograma">Solo aquí</Button>
          )}
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-red-600" onClick={() => delSel(false)} title={isMovable(selected) && board.frames.length > 1 ? "Quitar de todos los fotogramas" : "Quitar"}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      )}

      {roster.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Añadir jugador (usa el color elegido: equipo A, B, comodín o portero)</p>
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
      {!hasEls && <p className="text-[11px] text-gray-400">Elige una herramienta y toca el campo. Con «+» añades un fotograma para animar el movimiento.</p>}
    </div>
  );
}
