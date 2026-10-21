import React, { useEffect, useMemo, useRef, useState } from "react";
import { MousePointer2, Trash2, Undo2, Copy, Circle, MoveUpRight, Spline, Square, Type, Flag, Triangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Dibujo de tareas sobre el campo: fichas de jugadores por equipo, balón, conos, porterías, flechas, zonas y textos.
// Se guarda como datos (no como imagen): en unidades de campo (68 de ancho; 105 de alto en campo completo), así se puede
// seguir editando y se imprime nítido en la ficha.

const W = 68;
export const FIELDS = [
  { id: "full", label: "Campo completo", h: 105, view: [-3, -3, 74, 111] },
  { id: "half", label: "Medio campo", h: 52.5, view: [-3, -3, 74, 58.5] },
  { id: "free", label: "Espacio libre", h: 52.5, view: [-3, -3, 74, 58.5] },
];
const fieldOf = (id) => FIELDS.find((f) => f.id === id) || FIELDS[1];

const TEAM_COLORS = { a: "#73000A", b: "#2563eb", c: "#f59e0b", gk: "#16a34a", n: "#374151" };
const TEAM_LABELS = { a: "Equipo A", b: "Equipo B", c: "Comodín", gk: "Portero", n: "Neutro" };
const ARROW_COLORS = { move: "#111827", pass: "#2563eb", dribble: "#73000A" };

const PITCH_GREEN = "#3f8a4a";
const LINE = "rgba(255,255,255,0.92)";

// Líneas del campo (reglamentarias, en metros)
function Lines({ field }) {
  const h = field.h;
  const s = { fill: "none", stroke: LINE, strokeWidth: 0.35 };
  const full = field.id === "full";
  if (field.id === "free") return <rect x={0} y={0} width={W} height={h} {...s} strokeDasharray="1.2 1.2" />;
  const goalTop = (
    <g {...s}>
      <rect x={W / 2 - 20.15} y={0} width={40.3} height={16.5} />
      <rect x={W / 2 - 9.16} y={0} width={18.32} height={5.5} />
      <path d={`M ${W / 2 - 7.3} 16.5 A 9.15 9.15 0 0 0 ${W / 2 + 7.3} 16.5`} />
      <rect x={W / 2 - 3.66} y={-1.8} width={7.32} height={1.8} />
    </g>
  );
  const dot = (cx, cy) => <circle cx={cx} cy={cy} r={0.45} fill={LINE} />;
  return (
    <g>
      <rect x={0} y={0} width={W} height={h} {...s} />
      {goalTop}
      {dot(W / 2, 11)}
      {full ? (
        <>
          <g transform={`rotate(180 ${W / 2} ${h / 2})`}>{goalTop}{dot(W / 2, 11)}</g>
          <line x1={0} y1={h / 2} x2={W} y2={h / 2} {...s} />
          <circle cx={W / 2} cy={h / 2} r={9.15} {...s} />
          {dot(W / 2, h / 2)}
        </>
      ) : (
        <path d={`M ${W / 2 - 9.15} ${h} A 9.15 9.15 0 0 1 ${W / 2 + 9.15} ${h}`} {...s} />
      )}
    </g>
  );
}

function Token({ el, selected }) {
  const c = TEAM_COLORS[el.team] || TEAM_COLORS.a;
  return (
    <g>
      {selected && <circle cx={el.x} cy={el.y} r={3.6} fill="none" stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="1 0.8" />}
      <circle cx={el.x} cy={el.y} r={2.3} fill={c} stroke="#fff" strokeWidth={0.5} />
      {el.label ? (
        <text x={el.x} y={el.y + 5.4} textAnchor="middle" fontSize={2.7} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={0.55} paintOrder="stroke" style={{ fontFamily: "Arial, sans-serif" }}>{el.label}</text>
      ) : null}
    </g>
  );
}

function Item({ el, selected }) {
  switch (el.k) {
    case "token": return <Token el={el} selected={selected} />;
    case "ball":
      return (
        <g>
          {selected && <circle cx={el.x} cy={el.y} r={2.6} fill="none" stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="1 0.8" />}
          <circle cx={el.x} cy={el.y} r={1.25} fill="#fff" stroke="#111" strokeWidth={0.4} />
          <circle cx={el.x} cy={el.y} r={0.45} fill="#111" />
        </g>
      );
    case "cone":
      return (
        <g>
          {selected && <circle cx={el.x} cy={el.y} r={2.6} fill="none" stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="1 0.8" />}
          <polygon points={`${el.x},${el.y - 1.5} ${el.x + 1.3},${el.y + 1.1} ${el.x - 1.3},${el.y + 1.1}`} fill="#f97316" stroke="#fff" strokeWidth={0.3} />
        </g>
      );
    case "goal":
      return (
        <g>
          {selected && <rect x={el.x - 4.2} y={el.y - 2} width={8.4} height={4} fill="none" stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="1 0.8" />}
          <rect x={el.x - 3} y={el.y - 0.9} width={6} height={1.8} fill="rgba(255,255,255,0.35)" stroke="#fff" strokeWidth={0.45} />
        </g>
      );
    case "zone":
      return <rect x={Math.min(el.x, el.x + el.w)} y={Math.min(el.y, el.y + el.h)} width={Math.abs(el.w)} height={Math.abs(el.h)} fill="rgba(255,255,255,0.08)" stroke={selected ? "#f59e0b" : "#fff"} strokeWidth={0.45} strokeDasharray="1.6 1.2" />;
    case "arrow": {
      const col = ARROW_COLORS[el.style] || ARROW_COLORS.move;
      const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const hx = el.x2, hy = el.y2;
      const head = `${hx},${hy} ${hx - ux * 2.4 - uy * 1.2},${hy - uy * 2.4 + ux * 1.2} ${hx - ux * 2.4 + uy * 1.2},${hy - uy * 2.4 - ux * 1.2}`;
      return (
        <g>
          {selected && <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#f59e0b" strokeWidth={1.8} opacity={0.55} />}
          <line x1={el.x1} y1={el.y1} x2={hx - ux * 1.6} y2={hy - uy * 1.6} stroke={col} strokeWidth={0.55} strokeDasharray={el.style === "pass" ? "1.6 1.1" : undefined} />
          <polygon points={head} fill={col} />
        </g>
      );
    }
    case "text":
      return <text x={el.x} y={el.y} fontSize={3} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={0.5} paintOrder="stroke" textAnchor="middle" style={{ fontFamily: "Arial, sans-serif" }}>{el.text}</text>;
    default: return null;
  }
}

// Vista de solo lectura (ficha impresa y vista previa)
export function PitchView({ board, className = "", style }) {
  const field = fieldOf(board?.field);
  const els = board?.elements || [];
  const [vx, vy, vw, vh] = field.view;
  return (
    <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} className={className} style={style} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Dibujo de la tarea">
      <rect x={vx} y={vy} width={vw} height={vh} fill={PITCH_GREEN} />
      <Lines field={field} />
      {els.filter((e) => e.k === "zone").map((e) => <Item key={e.id} el={e} />)}
      {els.filter((e) => e.k !== "zone" && e.k !== "arrow" && e.k !== "text" && e.k !== "token").map((e) => <Item key={e.id} el={e} />)}
      {els.filter((e) => e.k === "arrow").map((e) => <Item key={e.id} el={e} />)}
      {els.filter((e) => e.k === "token").map((e) => <Item key={e.id} el={e} />)}
      {els.filter((e) => e.k === "text").map((e) => <Item key={e.id} el={e} />)}
    </svg>
  );
}

export const hasBoard = (b) => !!b && (b.elements || []).length > 0;

let idn = 0;
const nid = () => `e${Date.now().toString(36)}${(idn++).toString(36)}`;
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
  { id: "zone", label: "Zona", icon: Square },
  { id: "text", label: "Texto", icon: Type },
];

/**
 * value    { field, elements: [...] } o null
 * onChange (nuevoValor) => void
 * roster   [{ id, label }] nombres para añadir fichas con un toque
 */
export default function PitchBoard({ value, onChange, roster = [] }) {
  const board = useMemo(() => ({ field: value?.field || "half", elements: value?.elements || [] }), [value]);
  const field = fieldOf(board.field);
  const [tool, setTool] = useState("select");
  const [selId, setSelId] = useState(null);
  const [draft, setDraft] = useState(null); // flecha o zona en curso
  const [history, setHistory] = useState([]);
  const svgRef = useRef(null);
  const drag = useRef(null);
  const live = useRef(board);
  live.current = board;

  const commit = (next, { record = true } = {}) => {
    if (record) setHistory((h) => [...h.slice(-19), live.current]);
    onChange(next);
  };
  const setEls = (elements, opts) => commit({ ...live.current, elements }, opts);

  const point = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: round(clamp(p.x, -2, W + 2)), y: round(clamp(p.y, -2, field.h + 2)) };
  };

  const hit = (p) => {
    const els = live.current.elements;
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i];
      if (el.k === "token" && Math.hypot(el.x - p.x, el.y - p.y) < 3.6) return el;
      if ((el.k === "ball" || el.k === "cone") && Math.hypot(el.x - p.x, el.y - p.y) < 2.8) return el;
      if (el.k === "goal" && Math.abs(el.x - p.x) < 4.2 && Math.abs(el.y - p.y) < 2.4) return el;
      if (el.k === "text" && Math.abs(el.x - p.x) < 6 && Math.abs(el.y - p.y) < 2.4) return el;
      if (el.k === "arrow") {
        const { x1, y1, x2, y2 } = el;
        const t = clamp(((p.x - x1) * (x2 - x1) + (p.y - y1) * (y2 - y1)) / (((x2 - x1) ** 2 + (y2 - y1) ** 2) || 1), 0, 1);
        if (Math.hypot(x1 + t * (x2 - x1) - p.x, y1 + t * (y2 - y1) - p.y) < 2.2) return el;
      }
      if (el.k === "zone") {
        const x0 = Math.min(el.x, el.x + el.w), x1 = Math.max(el.x, el.x + el.w), y0 = Math.min(el.y, el.y + el.h), y1 = Math.max(el.y, el.y + el.h);
        const onEdge = p.x >= x0 - 1.5 && p.x <= x1 + 1.5 && p.y >= y0 - 1.5 && p.y <= y1 + 1.5 && !(p.x > x0 + 1.5 && p.x < x1 - 1.5 && p.y > y0 + 1.5 && p.y < y1 - 1.5);
        if (onEdge) return el;
      }
    }
    return null;
  };

  const onDown = (e) => {
    if (e.button !== undefined && e.button > 0) return;
    const p = point(e);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const target = hit(p);
    if (tool === "select" || (target && !["arrow", "zone"].includes(tool))) {
      if (target) {
        setSelId(target.id);
        drag.current = { mode: "move", id: target.id, from: p, moved: false, snapshot: live.current };
      } else setSelId(null);
      return;
    }
    if (["a", "b", "c", "gk"].includes(tool)) {
      const el = { id: nid(), k: "token", x: p.x, y: p.y, team: tool, label: "" };
      setEls([...live.current.elements, el]);
      setSelId(el.id);
      return;
    }
    if (["ball", "cone", "goal"].includes(tool)) {
      const el = { id: nid(), k: tool, x: p.x, y: p.y };
      setEls([...live.current.elements, el]);
      setSelId(el.id);
      return;
    }
    if (tool === "text") {
      const el = { id: nid(), k: "text", x: p.x, y: p.y, text: "Texto" };
      setEls([...live.current.elements, el]);
      setSelId(el.id);
      return;
    }
    if (tool === "move" || tool === "pass") { setDraft({ k: "arrow", style: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y }); drag.current = { mode: "draw" }; return; }
    if (tool === "zone") { setDraft({ k: "zone", x: p.x, y: p.y, w: 0, h: 0 }); drag.current = { mode: "draw" }; }
  };

  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    if (d.mode === "draw") {
      setDraft((cur) => (cur ? (cur.k === "arrow" ? { ...cur, x2: p.x, y2: p.y } : { ...cur, w: round(p.x - cur.x), h: round(p.y - cur.y) }) : cur));
      return;
    }
    if (d.mode === "move") {
      const dx = p.x - d.from.x, dy = p.y - d.from.y;
      if (!d.moved && Math.hypot(dx, dy) < 0.6) return;
      d.moved = true;
      const els = d.snapshot.elements.map((el) => {
        if (el.id !== d.id) return el;
        if (el.k === "arrow") return { ...el, x1: round(el.x1 + dx), y1: round(el.y1 + dy), x2: round(el.x2 + dx), y2: round(el.y2 + dy) };
        return { ...el, x: round(el.x + dx), y: round(el.y + dy) };
      });
      onChange({ ...live.current, elements: els });
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.mode === "move" && d.moved) setHistory((h) => [...h.slice(-19), d.snapshot]);
    if (d.mode === "draw" && draft) {
      const big = draft.k === "arrow" ? Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 2.5 : Math.abs(draft.w) > 2.5 && Math.abs(draft.h) > 2.5;
      if (big) { const el = { id: nid(), ...draft }; setEls([...live.current.elements, el]); setSelId(el.id); }
      setDraft(null);
    }
  };

  const selected = board.elements.find((e) => e.id === selId) || null;
  useEffect(() => { if (selId && !selected) setSelId(null); }, [selId, selected]);

  const patchSel = (patch) => setEls(board.elements.map((e) => (e.id === selId ? { ...e, ...patch } : e)));
  const delSel = () => { setEls(board.elements.filter((e) => e.id !== selId)); setSelId(null); };
  const dupSel = () => {
    if (!selected) return;
    const copy = { ...selected, id: nid() };
    if (copy.k === "arrow") { copy.x1 += 3; copy.y1 += 3; copy.x2 += 3; copy.y2 += 3; } else { copy.x += 3; copy.y += 3; }
    setEls([...board.elements, copy]);
    setSelId(copy.id);
  };
  const undo = () => setHistory((h) => { if (!h.length) return h; onChange(h[h.length - 1]); setSelId(null); return h.slice(0, -1); });
  const clear = () => { if (board.elements.length) { setEls([]); setSelId(null); } };

  const addPlayer = (p) => {
    const t = ["a", "b", "c", "gk"].includes(tool) ? tool : "a";
    const n = board.elements.filter((e) => e.k === "token").length;
    const el = { id: nid(), k: "token", x: round(8 + (n % 6) * 10), y: round(6 + Math.floor(n / 6) * 7), team: t, label: p.label };
    setEls([...board.elements, el]);
    setSelId(el.id);
  };

  const [vx, vy, vw, vh] = field.view;
  const cursor = tool === "select" ? "default" : "crosshair";
  const used = new Set(board.elements.filter((e) => e.k === "token").map((e) => e.label));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={board.field}
          onChange={(e) => commit({ ...board, field: e.target.value })}
          className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs"
          aria-label="Tipo de campo"
        >
          {FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
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
                onClick={() => { setTool(t.id); if (t.id !== "select") setSelId(null); }}
                className={`h-8 min-w-8 px-1.5 rounded-md border text-[11px] font-semibold flex items-center gap-1 ${on ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
              >
                <Icon className="w-3.5 h-3.5" style={on || !t.color ? undefined : { color: t.color }} fill={t.id === "a" || t.id === "b" || t.id === "c" || t.id === "gk" ? (on ? "#fff" : t.color) : "none"} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-1 ml-auto">
          <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={undo} disabled={!history.length} title="Deshacer"><Undo2 className="w-3.5 h-3.5" /></Button>
          <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-red-600" onClick={clear} disabled={!board.elements.length} title="Borrar todo"><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex justify-center">
        <svg
          ref={svgRef}
          viewBox={`${vx} ${vy} ${vw} ${vh}`}
          className="w-full max-w-[520px] select-none"
          style={{ touchAction: "none", cursor, maxHeight: field.id === "full" ? 560 : 360 }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <rect x={vx} y={vy} width={vw} height={vh} fill={PITCH_GREEN} />
          <Lines field={field} />
          {[...board.elements].sort((a, b) => rank(a) - rank(b)).map((el) => <Item key={el.id} el={el} selected={el.id === selId} />)}
          {draft && <Item el={{ id: "draft", ...draft }} selected />}
        </svg>
      </div>

      {selected && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5">
          {selected.k === "token" && (
            <>
              <Input value={selected.label || ""} onChange={(e) => patchSel({ label: e.target.value })} placeholder="Nombre" className="h-7 w-28 text-xs" aria-label="Nombre de la ficha" />
              <div className="flex gap-1">
                {Object.keys(TEAM_COLORS).map((k) => (
                  <button key={k} type="button" title={TEAM_LABELS[k]} aria-label={TEAM_LABELS[k]} onClick={() => patchSel({ team: k })}
                    className={`w-5 h-5 rounded-full border-2 ${selected.team === k ? "border-gray-900" : "border-white"}`} style={{ background: TEAM_COLORS[k] }} />
                ))}
              </div>
            </>
          )}
          {selected.k === "text" && <Input value={selected.text || ""} onChange={(e) => patchSel({ text: e.target.value })} className="h-7 w-40 text-xs" aria-label="Texto" />}
          {selected.k === "arrow" && (
            <select value={selected.style} onChange={(e) => patchSel({ style: e.target.value })} className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs" aria-label="Tipo de flecha">
              <option value="move">Desplazamiento</option>
              <option value="pass">Pase</option>
              <option value="dribble">Conducción</option>
            </select>
          )}
          <span className="text-[11px] text-amber-800 flex-1 min-w-[80px]">Arrastra para moverla</span>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={dupSel} title="Duplicar"><Copy className="w-3.5 h-3.5" /></Button>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-red-600" onClick={delSel} title="Quitar"><Trash2 className="w-3.5 h-3.5" /></Button>
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
    </div>
  );
}

const rank = (e) => ({ zone: 0, goal: 1, cone: 1, ball: 2, arrow: 3, token: 4, text: 5 }[e.k] ?? 2);
