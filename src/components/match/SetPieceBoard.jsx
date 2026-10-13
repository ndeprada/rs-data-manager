import React, { useRef, useState } from "react";
import { Plus, Trash2, MousePointer2, Circle, Eraser, MoveRight, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Creador de jugadas a balón parado: medio campo (portería arriba), fichas propias/rivales, balón y flechas.
const W = 300, H = 240;
const TYPES = [
  { value: "corner_favor", label: "Córner a favor" },
  { value: "corner_contra", label: "Córner en contra" },
  { value: "falta_lateral", label: "Falta lateral a favor" },
  { value: "falta_frontal", label: "Falta frontal a favor" },
  { value: "falta_contra", label: "Falta en contra" },
  { value: "saque_banda", label: "Saque de banda" },
  { value: "penalti", label: "Penalti" },
  { value: "saque_puerta", label: "Saque de puerta" },
];
const TOOLS = [
  { key: "move", label: "Mover", icon: MousePointer2 },
  { key: "own", label: "Nuestro", icon: Circle, color: "#6b1f28" },
  { key: "rival", label: "Rival", icon: Circle, color: "#2563eb" },
  { key: "ball", label: "Balón", icon: Circle, color: "#f59e0b" },
  { key: "arrow_move", label: "Movimiento", icon: MoveRight },
  { key: "arrow_pass", label: "Pase / disparo", icon: ArrowRight },
  { key: "erase", label: "Borrar", icon: Eraser },
];
const uid = () => Math.random().toString(36).slice(2, 9);
const newPiece = (n) => ({ id: uid(), name: `Jugada ${n}`, type: "corner_favor", notes: "", tokens: [], arrows: [] });

function Pitch() {
  const l = "rgba(255,255,255,0.55)";
  return (
    <>
      <rect x="0" y="0" width={W} height={H} fill="#15803d" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x="0" y={i * 60} width={W} height="30" fill="rgba(255,255,255,0.03)" />)}
      <rect x="10" y="10" width={W - 20} height={H - 10} fill="none" stroke={l} strokeWidth="1.5" />
      <rect x="66" y="10" width="168" height="72" fill="none" stroke={l} strokeWidth="1.5" />
      <rect x="112" y="10" width="76" height="26" fill="none" stroke={l} strokeWidth="1.5" />
      <rect x="132" y="4" width="36" height="6" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" />
      <circle cx="150" cy="58" r="1.8" fill={l} />
      <path d="M 120 82 A 30 30 0 0 0 180 82" fill="none" stroke={l} strokeWidth="1.5" />
      <path d={`M 110 ${H} A 40 40 0 0 1 190 ${H}`} fill="none" stroke={l} strokeWidth="1.5" />
      <path d="M10,18 A8,8 0 0 0 18,10" fill="none" stroke={l} />
      <path d={`M${W - 10},18 A8,8 0 0 1 ${W - 18},10`} fill="none" stroke={l} />
    </>
  );
}

function Board({ piece, onChange, names }) {
  const svg = useRef(null);
  const [tool, setTool] = useState("move");
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const drag = useRef(null);

  const pt = (e) => {
    const r = svg.current.getBoundingClientRect();
    return { x: Math.max(8, Math.min(W - 8, ((e.clientX - r.left) / r.width) * W)), y: Math.max(8, Math.min(H - 8, ((e.clientY - r.top) / r.height) * H)) };
  };
  const set = (patch) => onChange({ ...piece, ...patch });

  const onDown = (e) => {
    const p = pt(e);
    svg.current.setPointerCapture(e.pointerId);
    if (tool === "own" || tool === "rival" || tool === "ball") {
      if (tool === "ball" && piece.tokens.some((t) => t.kind === "ball")) {
        set({ tokens: piece.tokens.map((t) => (t.kind === "ball" ? { ...t, x: p.x, y: p.y } : t)) });
        return;
      }
      const n = piece.tokens.filter((t) => t.kind === tool).length + 1;
      const t = { id: uid(), kind: tool, x: p.x, y: p.y, label: tool === "ball" ? "" : String(n) };
      set({ tokens: [...piece.tokens, t] });
      setSelected(t.id);
    } else if (tool === "arrow_move" || tool === "arrow_pass") {
      setDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y, kind: tool });
    }
  };
  const onMove = (e) => {
    const p = pt(e);
    if (draft) setDraft({ ...draft, x2: p.x, y2: p.y });
    else if (drag.current) {
      set({ tokens: piece.tokens.map((t) => (t.id === drag.current ? { ...t, x: p.x, y: p.y } : t)) });
    }
  };
  const onUp = () => {
    if (draft) {
      if (Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 8) set({ arrows: [...piece.arrows, { id: uid(), ...draft }] });
      setDraft(null);
    }
    drag.current = null;
  };
  const tokenDown = (e, t) => {
    e.stopPropagation();
    if (tool === "erase") { set({ tokens: piece.tokens.filter((x) => x.id !== t.id) }); return; }
    if (tool === "move") { svg.current.setPointerCapture(e.pointerId); drag.current = t.id; setSelected(t.id); }
  };
  const arrowDown = (e, a) => {
    if (tool === "erase") { e.stopPropagation(); set({ arrows: piece.arrows.filter((x) => x.id !== a.id) }); }
  };

  const sel = piece.tokens.find((t) => t.id === selected);
  const colorOf = { own: "#6b1f28", rival: "#2563eb", ball: "#f59e0b" };

  const Arrow = ({ a, k }) => {
    const pass = a.kind === "arrow_pass";
    return (
      <g key={k} onPointerDown={(e) => arrowDown(e, a)} style={{ cursor: tool === "erase" ? "pointer" : "default" }}>
        <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="transparent" strokeWidth="12" />
        <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="white" strokeWidth="2" strokeDasharray={pass ? "0" : "5 4"} markerEnd="url(#sp-arrow)" opacity="0.95" />
      </g>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const on = tool === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setTool(t.key)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border ${on ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
              style={on ? { background: "var(--granate)" } : {}}>
              <Icon className="w-3.5 h-3.5" style={!on && t.color ? { color: t.color, fill: t.color } : {}} />{t.label}
            </button>
          );
        })}
      </div>
      <div className="rounded-lg overflow-hidden border border-gray-200 touch-none select-none" style={{ maxWidth: 520 }}>
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full block" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={{ cursor: tool === "move" ? "default" : "crosshair" }}>
          <defs>
            <marker id="sp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="white" /></marker>
          </defs>
          <Pitch />
          {piece.arrows.map((a) => <Arrow key={a.id} a={a} k={a.id} />)}
          {draft && <Arrow a={draft} k="draft" />}
          {piece.tokens.map((t) => (
            <g key={t.id} onPointerDown={(e) => tokenDown(e, t)} style={{ cursor: tool === "move" ? "grab" : tool === "erase" ? "pointer" : "inherit" }}>
              {t.kind === "ball" ? (
                <circle cx={t.x} cy={t.y} r="6" fill="#fff" stroke="#111" strokeWidth="1.5" />
              ) : (
                <>
                  <circle cx={t.x} cy={t.y} r="10.5" fill={colorOf[t.kind]} stroke={selected === t.id ? "#fde047" : "white"} strokeWidth={selected === t.id ? 3 : 2} />
                  <text x={t.x} y={t.y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={String(t.label).length > 2 ? 6 : 9} fontWeight="800" fill="white" pointerEvents="none">{String(t.label).slice(0, 5)}</text>
                </>
              )}
            </g>
          ))}
        </svg>
      </div>
      <p className="text-[10px] text-gray-400">Elige una herramienta y toca el campo. Para las flechas, arrastra de origen a destino. «Mover» permite reposicionar y seleccionar una ficha para ponerle nombre.</p>
      {sel && sel.kind !== "ball" && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">Etiqueta de la ficha:</span>
          <Input list="sp-names" value={sel.label} onChange={(e) => set({ tokens: piece.tokens.map((t) => (t.id === sel.id ? { ...t, label: e.target.value } : t)) })} className="h-7 w-36 text-xs border-gray-200" />
          <datalist id="sp-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
        </div>
      )}
    </div>
  );
}

export default function SetPieceBoard({ pieces, onChange, names = [] }) {
  const [activeId, setActiveId] = useState(null);
  const active = pieces.find((p) => p.id === activeId) || pieces[0] || null;

  const add = () => { const p = newPiece(pieces.length + 1); onChange([...pieces, p]); setActiveId(p.id); };
  const update = (p) => onChange(pieces.map((x) => (x.id === p.id ? p : x)));
  const remove = (id) => { onChange(pieces.filter((x) => x.id !== id)); setActiveId(null); };
  const typeLabel = (v) => TYPES.find((t) => t.value === v)?.label || v;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-900">⚽ Acciones a balón parado</p>
          <p className="text-[10px] text-gray-400">Diseña las jugadas del partido: córners, faltas, saques de banda…</p>
        </div>
        <button type="button" onClick={add} className="inline-flex items-center gap-1 text-xs font-bold text-white px-2.5 py-1.5 rounded" style={{ background: "var(--granate)" }}><Plus className="w-3.5 h-3.5" /> Nueva jugada</button>
      </div>
      {pieces.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Aún no hay jugadas. Crea la primera.</p>
      ) : (
        <div className="grid lg:grid-cols-[200px_1fr] gap-4">
          <div className="space-y-1">
            {pieces.map((p) => (
              <button key={p.id} type="button" onClick={() => setActiveId(p.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-xs ${active?.id === p.id ? "border-[var(--granate)] bg-red-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <span className="block font-bold text-gray-900 truncate">{p.name || "Sin nombre"}</span>
                <span className="text-[10px] text-gray-400">{typeLabel(p.type)}</span>
              </button>
            ))}
          </div>
          {active && (
            <div className="space-y-3 min-w-0">
              <div className="grid sm:grid-cols-[1fr_200px_auto] gap-2 items-end">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Nombre</p>
                  <Input value={active.name} onChange={(e) => update({ ...active, name: e.target.value })} className="h-8 text-sm border-gray-200" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Tipo</p>
                  <Select value={active.type} onValueChange={(v) => update({ ...active, type: v })}>
                    <SelectTrigger className="h-8 text-xs border-gray-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <button type="button" onClick={() => remove(active.id)} className="p-2 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Eliminar jugada"><Trash2 className="w-4 h-4" /></button>
              </div>
              <Board key={active.id} piece={active} onChange={update} names={names} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Descripción / instrucciones</p>
                <Textarea rows={3} value={active.notes} onChange={(e) => update({ ...active, notes: e.target.value })} className="border-gray-200 text-sm" placeholder="Quién saca, quién ataca el primer palo, señal de inicio, rechace…" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
