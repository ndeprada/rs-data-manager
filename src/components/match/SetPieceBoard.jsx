import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, MousePointer2, Circle, Eraser, MoveRight, BookmarkPlus, Library, X } from "lucide-react";
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
const arrowStyle = (a) => ({
  dashed: a.dashed ?? a.kind === "arrow_move",
  color: a.color && a.color !== "#ffffff" || a.dashed !== undefined ? a.color || "#73000A" : "#73000A",
});
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
  const { dashed, color } = arrowStyle(a);
  const curved = a.cx != null && a.cy != null;
  const fromX = curved ? a.cx : a.x1, fromY = curved ? a.cy : a.y1;
  const ang = Math.atan2(a.y2 - fromY, a.x2 - fromX);
  const L = 8, Wd = 3.4;
  const bx = a.x2 - Math.cos(ang) * L, by = a.y2 - Math.sin(ang) * L;
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  const head = `${a.x2},${a.y2} ${bx + nx * Wd},${by + ny * Wd} ${bx - nx * Wd},${by - ny * Wd}`;
  const d = curved ? `M ${a.x1} ${a.y1} Q ${a.cx} ${a.cy} ${bx} ${by}` : `M ${a.x1} ${a.y1} L ${bx} ${by}`;
  return (
    <g>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={selected ? 4 : 3} strokeDasharray={dashed ? "5 4" : undefined} strokeLinecap="round" />
      <polygon points={head} fill="rgba(255,255,255,0.85)" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" strokeDasharray={dashed ? "5 4" : undefined} strokeLinecap="round" />
      <polygon points={head} fill={color} />
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
  const [opts, setOpts] = useState({ curve: false, dashed: false, color: "#73000A" });
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
        const a = { id: uid(), ...draft, dashed: opts.dashed, color: opts.color };
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
    setOpts((o) => ({ ...o, ...("dashed" in patch ? { dashed: patch.dashed } : {}), ...("color" in patch ? { color: patch.color } : {}), ...("curve" in patch ? { curve: patch.curve } : {}) }));
    if (selArrow) {
      const { curve, ...rest } = patch;
      const next = { ...rest };
      if (curve === true) Object.assign(next, defaultControl(selArrow));
      if (curve === false) { next.cx = null; next.cy = null; }
      setArrow(selArrow.id, next);
    }
  };

  const showArrowOpts = tool === "arrow" || selArrow;
  const arrowCurve = selArrow ? selArrow.cx != null : opts.curve;
  const arrowDashed = selArrow ? arrowStyle(selArrow).dashed : opts.dashed;
  const arrowColor = selArrow ? arrowStyle(selArrow).color : opts.color;
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
          {draft && <ArrowShape a={{ ...draft, ...(opts.curve ? defaultControl(draft) : {}), dashed: opts.dashed, color: opts.color }} />}
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
              {t.role && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-extrabold uppercase text-center" style={{ bottom: "100%", marginBottom: 1, fontSize: f * 0.85, color: "#fde68a", textShadow: shadow, letterSpacing: 0.3 }}>{t.role}</span>}
              <div className="w-full h-full rounded-full flex items-center justify-center font-black"
                style={{ background: fill, color: num, border: `${Math.max(2, d / 9)}px solid ${stroke}`, fontSize: d * (String(shown).length > 2 ? 0.34 : 0.5), outline: selToken?.id === t.id ? "2px solid #facc15" : undefined, outlineOffset: 2, fontFamily: "var(--font-display)" }}>
                {String(shown).slice(0, 4)}
              </div>
              {nameTxt && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-bold text-white text-center" style={{ top: "100%", marginTop: 1, fontSize: f, textShadow: shadow }}>{nameTxt}</span>}
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
          <Swatches value={arrowColor} onPick={(c) => changeArrow({ color: c })} />
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
            <input type="range" min="0.6" max="1.8" step="0.1" value={selToken.size || 1} onChange={(e) => setToken(selToken.id, { size: Number(e.target.value) })} className="w-full accent-[#73000A]" />
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

export default function SetPieceBoard({ pieces, onChange, candidates = [], kitOf = () => ({ fill: "#fff", stroke: "#73000A", num: "#73000A" }), teamId }) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState(null);
  const [libOpen, setLibOpen] = useState(false);
  const [msg, setMsg] = useState("");
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
          <button type="button" onClick={() => setLibOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"><Library className="w-3.5 h-3.5" /> Biblioteca{library.length ? ` (${library.length})` : ""}</button>
          <button type="button" onClick={add} className="inline-flex items-center gap-1 text-xs font-bold text-white px-2.5 py-1.5 rounded" style={{ background: "var(--granate)" }}><Plus className="w-3.5 h-3.5" /> Nueva jugada</button>
        </div>
      </div>

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
