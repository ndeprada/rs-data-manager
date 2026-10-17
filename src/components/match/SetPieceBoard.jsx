import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, MousePointer2, Circle, Eraser, MoveRight, BookmarkPlus, Library, X, Printer, ArrowUp, ArrowDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { playerFirstName } from "@/lib/playerName";

// Creador de jugadas a balón parado: medio campo (portería arriba), fichas propias/rivales con jugador, dorsal y rol,
// balón y flechas finas (rectas o curvas, continuas o discontinuas). Las jugadas se pueden guardar en la biblioteca del
// equipo y reutilizar otra semana cambiando solo los jugadores.
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
  { key: "own", label: "Nuestro", icon: Circle, color: "#73000A" },
  { key: "rival", label: "Rival", icon: Circle, color: "#2563eb" },
  { key: "ball", label: "Balón", icon: Circle, color: "#f59e0b" },
  { key: "arrow", label: "Flecha", icon: MoveRight },
  { key: "erase", label: "Borrar", icon: Eraser },
];
const COLORS = [
  { v: "#73000A", n: "Granate" },
  { v: "#2563eb", n: "Azul" },
  { v: "#ffffff", n: "Blanco" },
  { v: "#facc15", n: "Amarillo" },
  { v: "#f97316", n: "Naranja" },
  { v: "#111827", n: "Negro" },
];
const ROLES = ["Lanzador", "Rematador 1er palo", "Rematador 2º palo", "Rematador", "Bloqueador", "Pantalla", "Referencia", "Rechace", "Segunda jugada", "Marca", "Zona", "Cobertura", "Pasador"];
const RIVAL_COLOR = "#2563eb";
const uid = () => Math.random().toString(36).slice(2, 9);
const newPiece = (n) => ({ id: uid(), name: `Jugada ${n}`, type: "corner_favor", signal: "", notes: "", tokens: [], arrows: [] });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lightColor = (c) => ["#ffffff", "#facc15"].includes(c);
const shortName = (p) => (p ? `${playerFirstName(p)} ${(p.last_name || "").split(" ")[0]}`.trim() : "");

// Compatibilidad con jugadas antiguas (flechas sin estilo, fichas sin tamaño)
const teamColor = (team) => (team === "rival" ? RIVAL_COLOR : "#73000A");
const arrowStyle = (a) => ({
  dashed: a.dashed ?? a.kind === "arrow_move",
  color: a.color || teamColor(a.team),
  border: a.border !== false,
  width: a.width || 1.4,
  head: a.head !== false,
});
// Curvatura: el punto de control = punto medio + k · (perpendicular al trazo)
const curvatureOf = (a) => {
  const dx = a.x2 - a.x1, dy = a.y2 - a.y1, d2 = dx * dx + dy * dy || 1;
  return (((a.cx - (a.x1 + a.x2) / 2) * -dy) + ((a.cy - (a.y1 + a.y2) / 2) * dx)) / d2;
};
const controlFromK = (a, k) => ({ cx: (a.x1 + a.x2) / 2 - (a.y2 - a.y1) * k, cy: (a.y1 + a.y2) / 2 + (a.x2 - a.x1) * k });
const defaultControl = (a) => {
  const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
  const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
  return { cx: mx - dy * 0.25, cy: my + dx * 0.25 };
};

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

// Flecha fina con punta: línea (recta o curva) + triángulo calculado, con un halo blanco para que se lea sobre el césped
function ArrowShape({ a, hit, onHitDown, selected }) {
  const { dashed, color, border, width, head: hasHead } = arrowStyle(a);
  const curved = a.cx != null && a.cy != null;
  const fromX = curved ? a.cx : a.x1, fromY = curved ? a.cy : a.y1;
  const ang = Math.atan2(a.y2 - fromY, a.x2 - fromX);
  const L = 5 + width * 2, Wd = 2 + width * 1.2;
  const bx = hasHead ? a.x2 - Math.cos(ang) * L : a.x2, by = hasHead ? a.y2 - Math.sin(ang) * L : a.y2;
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  const head = `${a.x2},${a.y2} ${bx + nx * Wd},${by + ny * Wd} ${bx - nx * Wd},${by - ny * Wd}`;
  const d = curved ? `M ${a.x1} ${a.y1} Q ${a.cx} ${a.cy} ${bx} ${by}` : `M ${a.x1} ${a.y1} L ${bx} ${by}`;
  const halo = "rgba(255,255,255,0.9)";
  return (
    <g>
      {border && <path d={d} fill="none" stroke={halo} strokeWidth={width + 1.8} strokeDasharray={dashed ? "5 4" : undefined} strokeLinecap="round" />}
      {border && hasHead && <polygon points={head} fill={halo} stroke={halo} strokeWidth="1.6" strokeLinejoin="round" />}
      <path d={d} fill="none" stroke={color} strokeWidth={selected ? width + 0.6 : width} strokeDasharray={dashed ? "5 4" : undefined} strokeLinecap="round" />
      {hasHead && <polygon points={head} fill={color} />}
      {hit && <path d={d} fill="none" stroke="transparent" strokeWidth="14" style={{ pointerEvents: "stroke", cursor: "pointer" }} onPointerDown={onHitDown} />}
    </g>
  );
}

function Swatches({ value, onPick, allowReset, resetLabel = "Equipación" }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {allowReset && (
        <button type="button" onClick={() => onPick(null)} className={`px-1.5 h-6 rounded-full border text-[10px] font-semibold ${!value ? "border-[var(--granate)] text-[var(--granate)]" : "border-gray-200 text-gray-500"}`}>{resetLabel}</button>
      )}
      {COLORS.map((c) => (
        <button key={c.v} type="button" title={c.n} onClick={() => onPick(c.v)} className="w-6 h-6 rounded-full border-2" style={{ background: c.v, borderColor: value === c.v ? "#facc15" : "#d1d5db", boxShadow: value === c.v ? "0 0 0 2px #73000A" : undefined }} />
      ))}
    </div>
  );
}

function Board({ piece, onChange, candidates, kitOf }) {
  const box = useRef(null);
  const [width, setWidth] = useState(520);
  const [tool, setTool] = useState("move");
  const [sel, setSel] = useState(null); // { type: "token" | "arrow", id }
  const [draft, setDraft] = useState(null);
  const [allSize, setAllSize] = useState(false);
  const [opts, setOpts] = useState({ curve: false, dashed: false, color: null, team: "own", border: true, head: true, width: 1.4 });
  const drag = useRef(null);

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width || 520));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const scale = width / W;

  const pt = (e) => {
    const r = box.current.getBoundingClientRect();
    return { x: clamp(((e.clientX - r.left) / r.width) * W, 6, W - 6), y: clamp(((e.clientY - r.top) / r.height) * H, 6, H - 6) };
  };
  const set = (patch) => onChange({ ...piece, ...patch });
  const setToken = (id, patch) => set({ tokens: piece.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const setArrow = (id, patch) => set({ arrows: piece.arrows.map((a) => (a.id === id ? { ...a, ...patch } : a)) });

  const onDown = (e) => {
    const p = pt(e);
    box.current.setPointerCapture(e.pointerId);
    if (tool === "own" || tool === "rival" || tool === "ball") {
      if (tool === "ball" && piece.tokens.some((t) => t.kind === "ball")) {
        set({ tokens: piece.tokens.map((t) => (t.kind === "ball" ? { ...t, x: p.x, y: p.y } : t)) });
        return;
      }
      const n = piece.tokens.filter((t) => t.kind === tool).length + 1;
      const t = { id: uid(), kind: tool, x: p.x, y: p.y, label: tool === "ball" ? "" : String(n), size: 1, role: "", player_id: null, color: null };
      set({ tokens: [...piece.tokens, t] });
      if (tool !== "ball") setSel({ type: "token", id: t.id });
    } else if (tool === "arrow") {
      setDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    } else if (tool === "move") {
      setSel(null);
    }
  };
  const onMove = (e) => {
    const p = pt(e);
    if (draft) { setDraft({ ...draft, x2: p.x, y2: p.y }); return; }
    const d = drag.current;
    if (!d) return;
    if (d.type === "token") setToken(d.id, { x: p.x, y: p.y });
    else if (d.type === "a1") setArrow(d.id, { x1: p.x, y1: p.y });
    else if (d.type === "a2") setArrow(d.id, { x2: p.x, y2: p.y });
    else if (d.type === "ac") setArrow(d.id, { cx: p.x, cy: p.y });
  };
  const onUp = () => {
    if (draft) {
      if (Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 8) {
        const a = { id: uid(), ...draft, dashed: opts.dashed, color: opts.color, team: opts.team, border: opts.border, head: opts.head, width: opts.width };
        if (opts.curve) Object.assign(a, defaultControl(a));
        set({ arrows: [...piece.arrows, a] });
        setSel({ type: "arrow", id: a.id });
      }
      setDraft(null);
    }
    drag.current = null;
  };
  const startDrag = (e, type, id) => {
    e.stopPropagation();
    box.current.setPointerCapture(e.pointerId);
    drag.current = { type, id };
  };
  const tokenDown = (e, t) => {
    if (tool === "erase") { e.stopPropagation(); set({ tokens: piece.tokens.filter((x) => x.id !== t.id) }); setSel(null); return; }
    if (tool === "move") { setSel({ type: "token", id: t.id }); startDrag(e, "token", t.id); }
  };
  const arrowHitDown = (e, a) => {
    e.stopPropagation();
    if (tool === "erase") { set({ arrows: piece.arrows.filter((x) => x.id !== a.id) }); setSel(null); return; }
    if (tool === "move") setSel({ type: "arrow", id: a.id });
  };

  const selToken = sel?.type === "token" ? piece.tokens.find((t) => t.id === sel.id) : null;
  const selArrow = sel?.type === "arrow" ? piece.arrows.find((a) => a.id === sel.id) : null;
  const playerOf = (t) => (t.player_id ? candidates.find((p) => p.id === t.player_id) : null);

  // Cambios de estilo de flecha: afectan a la flecha seleccionada y a las nuevas
  const changeArrow = (patch) => {
    setOpts((o) => ({ ...o, ...patch }));
    if (selArrow) {
      const { curve, ...rest } = patch;
      const next = { ...rest };
      if (curve === true) Object.assign(next, defaultControl(selArrow));
      if (curve === false) { next.cx = null; next.cy = null; }
      setArrow(selArrow.id, next);
    }
  };

  const showArrowOpts = tool === "arrow" || selArrow;
  const arrowBorder = selArrow ? arrowStyle(selArrow).border : opts.border;
  const arrowHead = selArrow ? arrowStyle(selArrow).head : opts.head;
  const arrowWidth = selArrow ? arrowStyle(selArrow).width : opts.width;
  const arrowCurve = selArrow ? selArrow.cx != null : opts.curve;
  const arrowDashed = selArrow ? arrowStyle(selArrow).dashed : opts.dashed;
  const arrowTeam = selArrow ? selArrow.team || "own" : opts.team;
  const arrowColor = selArrow ? selArrow.color || null : opts.color;
  const interactiveTokens = tool === "move" || tool === "erase";

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

      <div ref={box} className={`relative rounded-lg overflow-hidden border border-gray-200 select-none w-full ${tool === "move" ? "touch-pan-y" : "touch-none"}`}
        style={{ maxWidth: 640, aspectRatio: `${W} / ${H}`, cursor: tool === "move" ? "default" : "crosshair" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
          <Pitch />
          {piece.arrows.map((a) => <ArrowShape key={a.id} a={a} hit={interactiveTokens} onHitDown={(e) => arrowHitDown(e, a)} selected={selArrow?.id === a.id} />)}
          {draft && <ArrowShape a={{ ...draft, ...(opts.curve ? defaultControl(draft) : {}), dashed: opts.dashed, color: opts.color, team: opts.team, border: opts.border, head: opts.head, width: opts.width }} />}
        </svg>

        {/* Fichas (HTML, para que el nombre y el rol se lean bien y el dedo pueda arrastrarlas) */}
        {piece.tokens.map((t) => {
          const left = `${(t.x / W) * 100}%`, top = `${(t.y / H) * 100}%`;
          const size = t.size || 1;
          if (t.kind === "ball") {
            const d = Math.max(10, 12 * scale * size);
            return (
              <div key={t.id} onPointerDown={(e) => tokenDown(e, t)} className="absolute touch-none rounded-full"
                style={{ left, top, width: d, height: d, transform: "translate(-50%,-50%)", background: "#fff", border: `${Math.max(1.5, d / 8)}px solid #111`, outline: selToken?.id === t.id ? "2px solid #facc15" : undefined, pointerEvents: interactiveTokens ? "auto" : "none", cursor: tool === "move" ? "grab" : "pointer", zIndex: 5 }} />
            );
          }
          const player = playerOf(t);
          const own = t.kind === "own";
          const ks = own ? kitOf(player) : { fill: RIVAL_COLOR, stroke: "#ffffff", num: "#ffffff" };
          const fill = t.color || ks.fill;
          const stroke = t.color ? (lightColor(t.color) ? "#73000A" : "#ffffff") : ks.stroke;
          const num = t.color ? (lightColor(t.color) ? "#111827" : "#ffffff") : ks.num;
          const d = Math.max(20, 22 * scale * size);
          const f = Math.max(8, 6.5 * scale * Math.min(size, 1.3));
          const shown = own ? (player ? player.jersey_number || player.first_name?.[0] || "" : t.label) : t.label;
          const nameTxt = player ? shortName(player) : "";
          const shadow = "0 0 2px #000, 0 0 3px #000, 0 1px 2px #000";
          return (
            <div key={t.id} onPointerDown={(e) => tokenDown(e, t)} className="absolute touch-none"
              style={{ left, top, width: d, height: d, transform: "translate(-50%,-50%)", pointerEvents: interactiveTokens ? "auto" : "none", cursor: tool === "move" ? "grab" : "pointer", zIndex: selToken?.id === t.id ? 20 : 10 }}>
              <div className="w-full h-full rounded-full flex items-center justify-center font-black"
                style={{ background: fill, color: num, border: `${Math.max(2, d / 9)}px solid ${stroke}`, fontSize: d * (String(shown).length > 2 ? 0.34 : 0.5), outline: selToken?.id === t.id ? "2px solid #facc15" : undefined, outlineOffset: 2, fontFamily: "var(--font-display)" }}>
                {String(shown).slice(0, 4)}
              </div>
              {(nameTxt || t.role) && (
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center whitespace-nowrap" style={{ top: "100%", marginTop: 1 }}>
                  {nameTxt && <span className="font-bold text-white text-center leading-tight" style={{ fontSize: f, textShadow: shadow }}>{nameTxt}</span>}
                  {t.role && <span className="font-extrabold uppercase text-center leading-tight" style={{ fontSize: f * 0.85, color: "#fde68a", textShadow: shadow, letterSpacing: 0.3 }}>{t.role}</span>}
                </div>
              )}
            </div>
          );
        })}

        {/* Asas de la flecha seleccionada: extremos y curvatura */}
        {selArrow && tool === "move" && (
          <>
            {[["a1", selArrow.x1, selArrow.y1], ["a2", selArrow.x2, selArrow.y2], ...(selArrow.cx != null ? [["ac", selArrow.cx, selArrow.cy]] : [])].map(([k, x, y]) => (
              <div key={k} onPointerDown={(e) => startDrag(e, k, selArrow.id)} className="absolute touch-none rounded-full"
                style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: 16, height: 16, transform: "translate(-50%,-50%)", background: k === "ac" ? "#facc15" : "#fff", border: "2px solid #73000A", cursor: "grab", zIndex: 30 }} />
            ))}
          </>
        )}
      </div>
      <p className="text-[10px] text-gray-400">Elige una herramienta y toca el campo. Con «Flecha», arrastra de origen a destino. Con «Mover», toca una ficha o una flecha para editarla.</p>

      {showArrowOpts && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Flecha</span>
          <div className="flex gap-1">
            {[[false, "Recta"], [true, "Curva"]].map(([v, l]) => (
              <button key={l} type="button" onClick={() => changeArrow({ curve: v })} className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${arrowCurve === v ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={arrowCurve === v ? { background: "var(--granate)" } : {}}>{l}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {[[false, "Continua"], [true, "Discontinua"]].map(([v, l]) => (
              <button key={l} type="button" onClick={() => changeArrow({ dashed: v })} className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${arrowDashed === v ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={arrowDashed === v ? { background: "var(--granate)" } : {}}>{l}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {[["own", "Nuestro"], ["rival", "Rival"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => changeArrow({ team: v, color: null })} className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${arrowTeam === v ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={arrowTeam === v ? { background: teamColor(v) } : {}}>{l}</button>
            ))}
          </div>
          <Swatches value={arrowColor} onPick={(c) => changeArrow({ color: c })} allowReset resetLabel="Del equipo" />
          <div className="flex gap-1">
            {[[true, "Con borde"], [false, "Sin borde"]].map(([v, l]) => (
              <button key={l} type="button" onClick={() => changeArrow({ border: v })} className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${arrowBorder === v ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={arrowBorder === v ? { background: "var(--granate)" } : {}}>{l}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {[[true, "Con punta"], [false, "Sin punta"]].map(([v, l]) => (
              <button key={l} type="button" onClick={() => changeArrow({ head: v })} className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${arrowHead === v ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={arrowHead === v ? { background: "var(--granate)" } : {}}>{l}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px] text-gray-500">Grosor
            <input type="range" min="0.8" max="3.5" step="0.1" value={arrowWidth} onChange={(e) => changeArrow({ width: Number(e.target.value) })} className="w-24 accent-[#73000A]" />
          </label>
          {selArrow && selArrow.cx != null && (
            <label className="flex items-center gap-2 text-[11px] text-gray-500">Curvatura
              <input type="range" min="-0.8" max="0.8" step="0.02" value={curvatureOf(selArrow)} onChange={(e) => setArrow(selArrow.id, controlFromK(selArrow, Number(e.target.value)))} className="w-28 accent-[#73000A]" />
            </label>
          )}
          {selArrow && <button type="button" onClick={() => { set({ arrows: piece.arrows.filter((a) => a.id !== selArrow.id) }); setSel(null); }} className="ml-auto p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Eliminar flecha"><Trash2 className="w-4 h-4" /></button>}
        </div>
      )}

      {selToken && selToken.kind !== "ball" && (
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          {selToken.kind === "own" ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Jugador</p>
              <Select value={selToken.player_id || "__none__"} onValueChange={(v) => setToken(selToken.id, { player_id: v === "__none__" ? null : v })}>
                <SelectTrigger className="h-8 text-xs border-gray-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none__">Sin asignar</SelectItem>
                  {candidates.map((p) => <SelectItem key={p.id} value={p.id}>{p.jersey_number || "–"} · {shortName(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Dorsal / etiqueta</p>
              <Input value={selToken.label} onChange={(e) => setToken(selToken.id, { label: e.target.value })} className="h-8 text-xs border-gray-200 bg-white" />
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Rol en la jugada</p>
            <Input list="sp-roles" value={selToken.role || ""} onChange={(e) => setToken(selToken.id, { role: e.target.value })} className="h-8 text-xs border-gray-200 bg-white" />
            <datalist id="sp-roles">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Tamaño de la ficha</p>
            <input type="range" min="0.6" max="1.8" step="0.1" value={selToken.size || 1} onChange={(e) => { const size = Number(e.target.value); if (allSize) set({ tokens: piece.tokens.map((t) => ({ ...t, size })) }); else setToken(selToken.id, { size }); }} className="w-full accent-[#73000A]" />
            <label className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer"><input type="checkbox" checked={allSize} onChange={(e) => { setAllSize(e.target.checked); if (e.target.checked) { const size = selToken.size || 1; set({ tokens: piece.tokens.map((t) => ({ ...t, size })) }); } }} className="accent-[#73000A]" /> Aplicar a todas las fichas y el balón</label>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Color de la ficha</p>
            <Swatches value={selToken.color} onPick={(c) => setToken(selToken.id, { color: c })} allowReset resetLabel={selToken.kind === "own" ? "Equipación" : "Azul"} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="button" onClick={() => { set({ tokens: piece.tokens.filter((t) => t.id !== selToken.id) }); setSel(null); }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /> Quitar ficha</button>
          </div>
        </div>
      )}
    </div>
  );
}

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Dibujo estático (SVG como texto) de una jugada, para imprimir
function pieceSvg(piece, candidates, kitOf) {
  const l = "rgba(255,255,255,0.7)";
  let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;border:1px solid #999;border-radius:6px">`;
  o += `<rect width="${W}" height="${H}" fill="#15803d"/><g fill="none" stroke="${l}" stroke-width="1.5"><rect x="10" y="10" width="${W - 20}" height="${H - 10}"/><rect x="66" y="10" width="168" height="72"/><rect x="112" y="10" width="76" height="26"/><rect x="132" y="4" width="36" height="6"/><path d="M 120 82 A 30 30 0 0 0 180 82"/><path d="M 110 ${H} A 40 40 0 0 1 190 ${H}"/></g><circle cx="150" cy="58" r="1.8" fill="${l}"/>`;
  for (const a of piece.arrows || []) {
    const { dashed, color, border, width, head: hasHead } = arrowStyle(a);
    const curved = a.cx != null && a.cy != null;
    const fx = curved ? a.cx : a.x1, fy = curved ? a.cy : a.y1;
    const ang = Math.atan2(a.y2 - fy, a.x2 - fx), L = 5 + width * 2, Wd = 2 + width * 1.2;
    const bx = hasHead ? a.x2 - Math.cos(ang) * L : a.x2, by = hasHead ? a.y2 - Math.sin(ang) * L : a.y2;
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const hd = `${a.x2},${a.y2} ${bx + nx * Wd},${by + ny * Wd} ${bx - nx * Wd},${by - ny * Wd}`;
    const d = curved ? `M ${a.x1} ${a.y1} Q ${a.cx} ${a.cy} ${bx} ${by}` : `M ${a.x1} ${a.y1} L ${bx} ${by}`;
    const da = dashed ? ' stroke-dasharray="5 4"' : "";
    if (border) { o += `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="${width + 1.8}" stroke-linecap="round"${da}/>`; if (hasHead) o += `<polygon points="${hd}" fill="#fff" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>`; }
    o += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"${da}/>`;
    if (hasHead) o += `<polygon points="${hd}" fill="${color}"/>`;
  }
  const txt = (x, y, size, fill, str, weight = 700) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${fill}" stroke="#000" stroke-width="${size * 0.28}" paint-order="stroke" font-family="Arial,sans-serif">${esc(str)}</text>`;
  for (const t of piece.tokens || []) {
    const sz = t.size || 1;
    if (t.kind === "ball") { o += `<circle cx="${t.x}" cy="${t.y}" r="${6 * sz}" fill="#fff" stroke="#111" stroke-width="1.6"/>`; continue; }
    const pl = t.player_id ? candidates.find((p) => p.id === t.player_id) : null;
    const own = t.kind === "own";
    const ks = own ? kitOf(pl) : { fill: RIVAL_COLOR, stroke: "#fff", num: "#fff" };
    const fill = t.color || ks.fill;
    const stroke = t.color ? (lightColor(t.color) ? "#73000A" : "#fff") : ks.stroke;
    const num = t.color ? (lightColor(t.color) ? "#111827" : "#fff") : ks.num;
    const r = 11 * sz;
    const shown = String(own ? (pl ? pl.jersey_number || pl.first_name?.[0] || "" : t.label) : t.label).slice(0, 4);
    o += `<circle cx="${t.x}" cy="${t.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(1.5, r / 4.5)}"/>`;
    o += `<text x="${t.x}" y="${t.y + r * 0.36}" text-anchor="middle" font-size="${r * (shown.length > 2 ? 0.8 : 1.05)}" font-weight="900" fill="${num}" font-family="Arial,sans-serif">${esc(shown)}</text>`;
    let yy = t.y + r + 7 * Math.min(sz, 1.3);
    if (pl) { o += txt(t.x, yy, 6.5 * Math.min(sz, 1.3), "#fff", shortName(pl)); yy += 7 * Math.min(sz, 1.3); }
    if (t.role) o += txt(t.x, yy, 5.6 * Math.min(sz, 1.3), "#fde68a", t.role.toUpperCase(), 800);
  }
  return o + "</svg>";
}

function printPieces(list, candidates, kitOf, perPage, title) {
  const typeLabel = (v) => TYPES.find((t) => t.value === v)?.label || v;
  const cards = list.map((p) => `<section class="card"><h2>${esc(p.name)}</h2><p class="meta">${esc(typeLabel(p.type))}</p>${p.signal ? `<p class="sig"><b>Señal:</b> ${esc(p.signal)}</p>` : ""}${pieceSvg(p, candidates, kitOf)}${p.notes ? `<p class="notes">${esc(p.notes)}</p>` : ""}</section>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page{size:A4;margin:12mm} body{font-family:Arial,sans-serif;color:#111;margin:0}
    .grid{display:grid;grid-template-columns:${perPage === 1 ? "1fr" : "1fr 1fr"};gap:8mm}
    .card{break-inside:avoid;page-break-inside:avoid;${perPage === 1 ? "page-break-after:always;" : ""}}
    ${perPage === 1 ? ".card:last-child{page-break-after:auto}" : ""}
    h1{font-size:14px;margin:0 0 6px;color:#73000A} h2{font-size:${perPage === 1 ? 20 : 14}px;margin:0} .meta{font-size:11px;color:#666;margin:2px 0 4px}
    .sig{font-size:${perPage === 1 ? 14 : 11}px;margin:2px 0 6px} .notes{font-size:${perPage === 1 ? 13 : 10}px;white-space:pre-wrap;margin:6px 0 0}
  </style></head><body><h1>${esc(title)}</h1><div class="grid">${cards}</div></body></html>`;
  const old = document.getElementById("sp-print-frame");
  if (old) old.remove();
  const fr = document.createElement("iframe");
  fr.id = "sp-print-frame";
  fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(fr);
  const doc = fr.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { window.print(); } }, 400);
  return true;
}

export default function SetPieceBoard({ pieces, onChange, candidates = [], kitOf = () => ({ fill: "#fff", stroke: "#73000A", num: "#73000A" }), teamId }) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState(null);
  const [libOpen, setLibOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  const [order, setOrder] = useState([]);
  const [off, setOff] = useState([]);
  const [perPage, setPerPage] = useState(1);
  const printList = [...order.filter((id) => pieces.some((p) => p.id === id)), ...pieces.map((p) => p.id).filter((id) => !order.includes(id))];
  const moveP = (id, dir) => { const i = printList.indexOf(id), j = i + dir; if (j < 0 || j >= printList.length) return; const n = [...printList]; [n[i], n[j]] = [n[j], n[i]]; setOrder(n); };
  const doPrint = () => {
    const list = printList.filter((id) => !off.includes(id)).map((id) => pieces.find((p) => p.id === id));
    if (!list.length) return flash("Marca al menos una jugada");
    try { printPieces(list, candidates, kitOf, perPage, "Acciones a balón parado"); } catch (e) { flash("No se pudo imprimir: " + (e?.message || "error")); }
  };
  const active = pieces.find((p) => p.id === activeId) || pieces[0] || null;

  const { data: library = [] } = useQuery({
    queryKey: ["setplays", teamId],
    queryFn: () => base44.entities.SetPlay.filter({ team_id: teamId }),
    enabled: !!teamId,
  });

  const add = () => { const p = newPiece(pieces.length + 1); onChange([...pieces, p]); setActiveId(p.id); };
  const update = (p) => onChange(pieces.map((x) => (x.id === p.id ? p : x)));
  const remove = (id) => { onChange(pieces.filter((x) => x.id !== id)); setActiveId(null); };
  const typeLabel = (v) => TYPES.find((t) => t.value === v)?.label || v;
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };

  const saveToLibrary = async () => {
    if (!active || !teamId) return;
    const data = { team_id: teamId, name: active.name, type: active.type, signal: active.signal || "", notes: active.notes || "", tokens: active.tokens, arrows: active.arrows };
    try {
      if (active.lib_id && library.some((l) => l.id === active.lib_id)) {
        await base44.entities.SetPlay.update(active.lib_id, data);
        flash("Jugada actualizada en la biblioteca");
      } else {
        const created = await base44.entities.SetPlay.create(data);
        update({ ...active, lib_id: created.id });
        flash("Jugada guardada en la biblioteca");
      }
      qc.invalidateQueries({ queryKey: ["setplays", teamId] });
    } catch (e) { flash("No se pudo guardar: " + (e?.message || "error")); }
  };
  // Usar una jugada guardada: se mantiene todo, y los jugadores solo si siguen disponibles; si no, queda vacío para reasignar
  const useFromLibrary = (l) => {
    const ok = new Set(candidates.map((p) => p.id));
    const p = {
      ...newPiece(pieces.length + 1), name: l.name, type: l.type, signal: l.signal || "", notes: l.notes || "", lib_id: l.id,
      tokens: (l.tokens || []).map((t) => ({ ...t, id: uid(), player_id: t.player_id && ok.has(t.player_id) ? t.player_id : null })),
      arrows: (l.arrows || []).map((a) => ({ ...a, id: uid() })),
    };
    onChange([...pieces, p]); setActiveId(p.id); setLibOpen(false);
  };
  const removeFromLibrary = async (l) => {
    await base44.entities.SetPlay.delete(l.id);
    qc.invalidateQueries({ queryKey: ["setplays", teamId] });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">⚽ Acciones a balón parado</p>
          <p className="text-[10px] text-gray-400">Diseña las jugadas del partido y guárdalas para reutilizarlas.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPrintOpen((v) => !v)} disabled={!pieces.length} className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"><Printer className="w-3.5 h-3.5" /> Imprimir</button>
          <button type="button" onClick={() => setLibOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"><Library className="w-3.5 h-3.5" /> Biblioteca{library.length ? ` (${library.length})` : ""}</button>
          <button type="button" onClick={add} className="inline-flex items-center gap-1 text-xs font-bold text-white px-2.5 py-1.5 rounded" style={{ background: "var(--granate)" }}><Plus className="w-3.5 h-3.5" /> Nueva jugada</button>
        </div>
      </div>

      {printOpen && pieces.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Imprimir · elige jugadas y orden</p>
            <button type="button" onClick={() => setPrintOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-1">
            {printList.map((id, i) => { const p = pieces.find((x) => x.id === id); return (
              <div key={id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5">
                <input type="checkbox" checked={!off.includes(id)} onChange={(e) => setOff(e.target.checked ? off.filter((x) => x !== id) : [...off, id])} className="accent-[#73000A]" />
                <span className="text-xs font-semibold text-gray-800 truncate flex-1 min-w-0">{i + 1}. {p.name || "Sin nombre"}</span>
                <button type="button" onClick={() => moveP(id, -1)} className="p-1 text-gray-400 hover:text-gray-800"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => moveP(id, 1)} className="p-1 text-gray-400 hover:text-gray-800"><ArrowDown className="w-3.5 h-3.5" /></button>
              </div>); })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[[1, "1 por página"], [2, "2 por página"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setPerPage(v)} className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${perPage === v ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={perPage === v ? { background: "var(--granate)" } : {}}>{l}</button>
            ))}
            <button type="button" onClick={doPrint} className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-white px-3 py-1.5 rounded" style={{ background: "var(--granate)" }}><Printer className="w-3.5 h-3.5" /> Imprimir</button>
          </div>
        </div>
      )}

      {libOpen && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Biblioteca del equipo</p>
            <button type="button" onClick={() => setLibOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
          </div>
          {library.length === 0 ? (
            <p className="text-xs text-gray-400">Aún no hay jugadas guardadas. Crea una y pulsa «Guardar en biblioteca».</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {library.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">{l.name || "Sin nombre"}</p>
                    <p className="text-[10px] text-gray-400 truncate">{typeLabel(l.type)}{l.signal ? ` · Señal: ${l.signal}` : ""}</p>
                  </div>
                  <button type="button" onClick={() => useFromLibrary(l)} className="text-[11px] font-bold text-white px-2 py-1 rounded shrink-0" style={{ background: "var(--granate)" }}>Usar</button>
                  <button type="button" onClick={() => removeFromLibrary(l)} className="p-1 text-gray-300 hover:text-red-500 shrink-0" title="Quitar de la biblioteca"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pieces.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Aún no hay jugadas. Crea una nueva o usa una de la biblioteca.</p>
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
              <div className="grid sm:grid-cols-[1fr_200px] gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Título de la jugada</p>
                  <Input value={active.name} onChange={(e) => update({ ...active, name: e.target.value })} className="h-9 text-sm font-semibold border-gray-200" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Tipo</p>
                  <Select value={active.type} onValueChange={(v) => update({ ...active, type: v })}>
                    <SelectTrigger className="h-9 text-xs border-gray-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Señal de la jugada</p>
                <Input value={active.signal || ""} onChange={(e) => update({ ...active, signal: e.target.value })} className="h-9 text-sm border-gray-200" />
                <p className="text-[10px] text-gray-400 mt-1">Cómo se avisa al equipo (gesto del lanzador, palabra clave…).</p>
              </div>
              <Board key={active.id} piece={active} onChange={update} candidates={candidates} kitOf={kitOf} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Descripción / instrucciones</p>
                <Textarea rows={3} value={active.notes} onChange={(e) => update({ ...active, notes: e.target.value })} className="border-gray-200 text-sm" placeholder="Quién saca, quién ataca el primer palo, señal de inicio, rechace…" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={saveToLibrary} disabled={!teamId} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded border" style={{ borderColor: "var(--granate)", color: "var(--granate)" }}>
                  <BookmarkPlus className="w-3.5 h-3.5" /> {active.lib_id ? "Actualizar en la biblioteca" : "Guardar en biblioteca"}
                </button>
                {msg && <span className="text-[11px] text-gray-500">{msg}</span>}
                <button type="button" onClick={() => remove(active.id)} className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /> Quitar del partido</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
