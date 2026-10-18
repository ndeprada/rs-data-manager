import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, MousePointer2, Circle, Eraser, MoveRight, BookmarkPlus, Library, X, Printer, ArrowUp, ArrowDown, User, Type, Copy, FlipHorizontal, LayoutTemplate, Users, BookOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { playerFirstName } from "@/lib/playerName";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";

import { Button } from "@/components/ui/button";
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
  { key: "signal", label: "Señal", icon: User },
  { key: "text", label: "Texto", icon: Type },
  { key: "arrow", label: "Flecha", icon: MoveRight },
  { key: "erase", label: "Borrar", icon: Eraser },
];
const COLORS = [
  { v: "#73000A", n: "Granate" },
  { v: "#2563eb", n: "Azul" },
  { v: "#ffffff", n: "Blanco" },
  { v: "#facc15", n: "Amarillo" },
  { v: "#0a4bff", n: "Azul eléctrico" },
  { v: "#f97316", n: "Naranja" },
  { v: "#111827", n: "Negro" },
];
const SIGNALS = [["head", "Mano a la cabeza"], ["arm", "Brazo extendido"], ["bounce", "Bota el balón"]];
const ROLES = ["Lanzador", "Rematador 1er palo", "Rematador 2º palo", "Rematador", "Bloqueador", "Pantalla", "Referencia", "Rechace", "Segunda jugada", "Marca", "Zona", "Cobertura", "Pasador"];
const RIVAL_COLOR = "#2563eb";
const GRANATE = "#73000A", NARANJA = "#FF6E00";
const F_BIG = "'Racing Sarria', sans-serif", F_TXT = "'IBM Plex Sans Condensed', sans-serif";
const uid = () => Math.random().toString(36).slice(2, 9);
const newPiece = (n) => ({ id: uid(), name: `Jugada ${n}`, type: "corner_favor", signal: "", notes: "", tokens: [], arrows: [] });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lightColor = (c) => ["#ffffff", "#facc15"].includes(c);
// Dos fichas pegadas con el mismo rol (p. ej. dos "Lanzador") no repiten la etiqueta: se escribe una sola vez, en la primera
const roleDuplicated = (t, tokens) => {
  if (!t.role) return false;
  const i = tokens.indexOf(t);
  return tokens.some((o, j) => j < i && o.role === t.role && o.kind === t.kind && Math.abs(o.x - t.x) < 36 && Math.abs(o.y - t.y) < 16);
};
const shortName = (p) => (p ? `${playerFirstName(p)} ${(p.last_name || "").split(" ")[0]}`.trim() : "");

// Compatibilidad con jugadas antiguas (flechas sin estilo, fichas sin tamaño)
const teamColor = (team) => (team === "rival" ? RIVAL_COLOR : "#73000A");
const arrowStyle = (a) => ({
  dashed: a.dashed ?? a.kind === "arrow_move",
  color: a.color || teamColor(a.team),
  border: a.border === true,
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

// ── Plantillas de partida (coordenadas sobre el campo 300×240; se cambian los jugadores después) ──
const mkOwn = (x, y, label, role = "") => ({ id: uid(), kind: "own", x, y, size: 1, label, role, player_id: null, color: null });
const mkRiv = (x, y, label, role = "") => ({ id: uid(), kind: "rival", x, y, size: 1, label, role, player_id: null, color: null });
const mkBall = (x, y) => ({ id: uid(), kind: "ball", x, y, size: 1, label: "", role: "", player_id: null, color: null });
const mkArr = (x1, y1, x2, y2, o = {}) => ({ id: uid(), x1, y1, x2, y2, dashed: false, team: "own", ...o });
const TEMPLATES = [
  { key: "corner_favor", label: "Córner a favor", make: () => ({ tokens: [mkOwn(30, 26, "L", "Lanzador"), mkBall(14, 14), mkRiv(150, 18, "P"), mkOwn(104, 44, "1", "1er palo"), mkOwn(150, 62, "2", "Rematador"), mkOwn(198, 44, "3", "2º palo"), mkOwn(100, 112, "R", "Rechace"), mkOwn(200, 112, "R", "Rechace"), mkOwn(150, 175, "C", "Cobertura")],
    arrows: [mkArr(38, 26, 132, 50, { cx: 80, cy: 22 }), mkArr(198, 96, 198, 64, { dashed: true }), mkArr(150, 86, 114, 52, { dashed: true })] }) },
  { key: "corner_contra", label: "Córner en contra", make: () => ({ tokens: [mkRiv(284, 22, "X", "Lanzador"), mkBall(292, 12), mkOwn(150, 18, "P"), mkOwn(112, 30, "Z"), mkOwn(188, 30, "Z"), mkOwn(90, 62, "Z"), mkOwn(130, 70, "Z"), mkOwn(170, 70, "Z"), mkOwn(210, 62, "Z"), mkOwn(118, 100, "M", "Marca"), mkOwn(182, 100, "M", "Marca"), mkOwn(150, 128, "C", "Cobertura"), mkRiv(104, 48, "1"), mkRiv(150, 46, "2"), mkRiv(196, 48, "3"), mkRiv(232, 80, "4")], arrows: [] }) },
  { key: "falta_lateral", label: "Falta lateral a favor", make: () => ({ tokens: [mkOwn(44, 158, "L", "Lanzador"), mkBall(52, 152), ...[75, 105, 135, 165, 195, 225].map((x, i) => mkOwn(x, 118, String(i + 1))), mkOwn(112, 162, "R", "Rechace"), mkOwn(188, 162, "R", "Rechace"), mkOwn(150, 200, "C", "Cobertura")],
    arrows: [mkArr(58, 150, 158, 40, { cx: 70, cy: 70 }), ...[75, 105, 135, 165, 195, 225].map((x, i) => mkArr(x, 114, 108 + i * 17, 62, { dashed: true }))] }) },
  { key: "falta_frontal", label: "Falta frontal a favor", make: () => ({ tokens: [mkOwn(138, 132, "T", "Toque"), mkOwn(164, 132, "L", "Lanzador"), mkBall(150, 124), mkRiv(150, 18, "P"), ...[122, 136, 150, 164, 178].map((x) => ({ ...mkRiv(x, 102, "B"), size: 0.75 })), mkOwn(120, 52, "1"), mkOwn(150, 56, "2"), mkOwn(182, 52, "3"), mkOwn(96, 120, "R", "Rechace"), mkOwn(204, 120, "R", "Rechace"), mkOwn(150, 182, "C", "Cobertura")], arrows: [mkArr(150, 118, 190, 36, { cx: 200, cy: 90 })] }) },
  { key: "falta_contra", label: "Falta en contra (barrera + zona)", make: () => ({ tokens: [mkRiv(176, 132, "X", "Lanzador"), mkBall(166, 128), mkOwn(150, 18, "P"), ...[122, 136, 150, 164, 178].map((x, i) => ({ ...mkOwn(x, 100, String(i + 1), i === 0 ? "Barrera" : ""), size: 0.75 })), mkOwn(84, 62, "Z"), mkOwn(108, 64, "Z"), mkOwn(192, 64, "Z"), mkOwn(216, 62, "Z"), mkOwn(150, 72, "Z"), mkOwn(150, 150, "R", "Rechace")], arrows: [] }) },
  { key: "saque_banda", label: "Saque de banda", make: () => ({ tokens: [mkOwn(8, 124, "L", "Saque"), mkBall(18, 124), mkOwn(44, 100, "1"), mkOwn(50, 148, "2"), mkOwn(86, 124, "3"), mkRiv(58, 116, "A"), mkRiv(72, 138, "B")], arrows: [mkArr(26, 124, 80, 124), mkArr(86, 124, 120, 100, { dashed: true }), mkArr(44, 100, 70, 80, { dashed: true })] }) },
];
const fromTemplate = (tpl, n) => ({ ...newPiece(n), name: tpl.label, type: tpl.key, ...tpl.make() });

// Voltear izquierda/derecha
const flipX = (x) => W - x;
const flipPiece = (pc) => ({
  ...pc,
  tokens: pc.tokens.map((t) => ({ ...t, x: flipX(t.x) })),
  arrows: pc.arrows.map((a) => ({ ...a, x1: flipX(a.x1), x2: flipX(a.x2), ...(a.cx != null ? { cx: flipX(a.cx) } : {}) })),
});

// Figurita de señal (gesto del lanzador)
const signalPaths = (variant) => {
  const arms = { head: "M12 13 L19 11 L15 5", arm: "M12 13 L23 12", bounce: "M12 13 L18 21" }[variant] || "M12 13 L19 11 L15 5";
  return `<circle cx="12" cy="6" r="3.6" fill="#111"/><path d="M12 10 L12 22 M12 22 L8 31 M12 22 L16 31 M12 13 L6 21 ${arms}" fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>${variant === "bounce" ? '<circle cx="20" cy="26" r="2.6" fill="#fff" stroke="#111" stroke-width="1.4"/>' : ""}`;
};

function Pitch() {
  const l = "#b8b8b8";
  return (
    <>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <defs><pattern id="sp-net" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0L4 4M4 0L0 4" stroke="#d4d4d4" strokeWidth=".5" /></pattern></defs>
      <rect x="132" y="2" width="36" height="9" fill="url(#sp-net)" stroke="#9a9a9a" strokeWidth="1" />
      <g fill="none" stroke={l} strokeWidth="1.2">
        <rect x="3" y="11" width={W - 6} height={H - 12} />
        <rect x="66" y="11" width="168" height="72" />
        <rect x="112" y="11" width="76" height="26" />
        <path d="M 120 83 A 30 30 0 0 0 180 83" />
        <path d={`M 110 ${H - 1} A 40 40 0 0 1 190 ${H - 1}`} />
      </g>
      <circle cx="150" cy="58" r="1.6" fill={l} />
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
  const halo = "#111827";
  return (
    <g>
      {border && <path d={d} fill="none" stroke={halo} strokeWidth={width + 1.5} strokeDasharray={dashed ? "5 4" : undefined} strokeLinecap="round" />}
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

function Board({ piece, onChange, candidates, lookup, kitOf, header, side }) {
  const box = useRef(null);
  const [width, setWidth] = useState(520);
  const [tool, setTool] = useState("move");
  const [sel, setSel] = useState(null); // { type: "token" | "arrow", id }
  const [draft, setDraft] = useState(null);
  const [allSize, setAllSize] = useState(false);
  const [opts, setOpts] = useState({ curve: false, dashed: false, color: null, team: "own", border: false, head: true, width: 1.4 });
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
    } else if (tool === "signal" || tool === "text") {
      const t = tool === "signal" ? { id: uid(), kind: "signal", x: p.x, y: p.y, size: 1, variant: "head" } : { id: uid(), kind: "text", x: p.x, y: p.y, size: 1, label: "Texto", color: null };
      set({ tokens: [...piece.tokens, t] });
      setSel({ type: "token", id: t.id });
      setTool("move");
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
  const playerOf = (t) => (t.player_id ? lookup.find((p) => p.id === t.player_id) : null);
  const fillWithSquad = () => {
    const GROUP = { portero: 0, central: 1, libre: 1, lateral: 1, mediocentro: 2, interior: 2, extremo: 3, delantero_centro: 3 };
    const used = new Set(piece.tokens.map((t) => t.player_id).filter(Boolean));
    const pool = candidates.filter((p) => !used.has(p.id)).sort((a, b) => ((GROUP[a.position] ?? 9) - (GROUP[b.position] ?? 9)) || ((Number(a.jersey_number) || 999) - (Number(b.jersey_number) || 999)));
    let i = 0;
    set({ tokens: piece.tokens.map((t) => (t.kind === "own" && !t.player_id && pool[i] ? { ...t, player_id: pool[i++].id } : t)) });
  };

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
        <button type="button" onClick={fillWithSquad} disabled={!candidates.length} title="Asigna los convocados (porteros, defensas, medios, delanteros) a las fichas nuestras que no tienen jugador"
          className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-40"><Users className="w-3.5 h-3.5" /> Rellenar con convocados</button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm space-y-3">
      {header}
      <div className="flex flex-col md:flex-row gap-3 items-start">
      <div className="flex-1 min-w-0 w-full">
      <div ref={box} className={`relative overflow-hidden select-none w-full ${tool === "move" ? "touch-pan-y" : "touch-none"}`}
        style={{ aspectRatio: `${W} / ${H}`, cursor: tool === "move" ? "default" : "crosshair" }}
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
          const ring = selToken?.id === t.id ? `2px solid ${NARANJA}` : undefined;
          if (t.kind === "signal") {
            const h = Math.max(24, 26 * scale * size);
            return (
              <div key={t.id} onPointerDown={(e) => tokenDown(e, t)} className="absolute touch-none"
                style={{ left, top, width: h * 0.75, height: h, transform: "translate(-50%,-50%)", outline: ring, outlineOffset: 2, pointerEvents: interactiveTokens ? "auto" : "none", cursor: tool === "move" ? "grab" : "pointer", zIndex: 6 }}>
                <svg viewBox="0 0 24 32" className="w-full h-full" dangerouslySetInnerHTML={{ __html: signalPaths(t.variant) }} />
              </div>
            );
          }
          if (t.kind === "text") {
            return (
              <div key={t.id} onPointerDown={(e) => tokenDown(e, t)} className="absolute touch-none text-center font-bold uppercase underline leading-tight"
                style={{ left, top, transform: "translate(-50%,-50%)", fontFamily: F_TXT, fontSize: Math.max(8, 6.4 * scale * size), color: t.color || NARANJA, whiteSpace: "pre", outline: ring, outlineOffset: 2, pointerEvents: interactiveTokens ? "auto" : "none", cursor: tool === "move" ? "grab" : "pointer", zIndex: 6 }}>
                {t.label || " "}
              </div>
            );
          }
          if (t.kind === "ball") {
            const d = Math.max(10, 10 * scale * size);
            return (
              <div key={t.id} onPointerDown={(e) => tokenDown(e, t)} className="absolute touch-none rounded-full flex items-center justify-center"
                style={{ left, top, width: d, height: d, transform: "translate(-50%,-50%)", background: "#fff", border: `${Math.max(1.2, d / 9)}px solid #111`, outline: ring, outlineOffset: 2, pointerEvents: interactiveTokens ? "auto" : "none", cursor: tool === "move" ? "grab" : "pointer", zIndex: 5 }}>
                <span className="rounded-full" style={{ width: d * 0.38, height: d * 0.38, background: "#111" }} />
              </div>
            );
          }
          const player = playerOf(t);
          const own = t.kind === "own";
          const gk = own && player?.position === "portero";
          const ks = own ? (gk ? kitOf(player) : { fill: GRANATE, stroke: GRANATE, num: "#ffffff" }) : { fill: RIVAL_COLOR, stroke: RIVAL_COLOR, num: "#ffffff" };
          const fill = t.color || ks.fill;
          const stroke = t.color ? (lightColor(t.color) ? GRANATE : fill) : ks.stroke;
          const num = t.color ? (lightColor(t.color) ? "#111827" : "#ffffff") : ks.num;
          const d = Math.max(18, 16 * scale * size);
          const f = Math.max(8, 6.8 * scale * Math.min(size, 1.3));
          const shown = own ? (player ? player.jersey_number || player.first_name?.[0] || "" : t.label) : t.label;
          const nameTxt = player ? shortName(player) : "";
          const roleTxt = roleDuplicated(t, piece.tokens) ? "" : t.role;
          return (
            <div key={t.id} onPointerDown={(e) => tokenDown(e, t)} className="absolute touch-none"
              style={{ left, top, width: d, height: d, transform: "translate(-50%,-50%)", pointerEvents: interactiveTokens ? "auto" : "none", cursor: tool === "move" ? "grab" : "pointer", zIndex: selToken?.id === t.id ? 20 : 10 }}>
              <div className="w-full h-full rounded-full flex items-center justify-center"
                style={{ background: fill, color: num, border: `${Math.max(1.5, d / 12)}px solid ${stroke}`, fontSize: d * (String(shown).length > 2 ? 0.42 : 0.58), outline: ring, outlineOffset: 2, fontFamily: F_BIG, letterSpacing: "0.03em" }}>
                {String(shown).slice(0, 4)}
              </div>
              {(nameTxt || roleTxt) && (
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center whitespace-nowrap uppercase" style={{ top: "100%", marginTop: 1, fontFamily: F_TXT }}>
                  {nameTxt && <span className="font-bold text-center leading-tight" style={{ fontSize: f, color: own ? GRANATE : RIVAL_COLOR }}>{nameTxt}</span>}
                  {roleTxt && <span className="font-bold text-center leading-tight" style={{ fontSize: f * 0.85, color: NARANJA }}>{roleTxt}</span>}
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
      </div>
      {side}
      </div>
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

      {selToken && selToken.kind === "signal" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Señal</span>
          <div className="flex gap-1 flex-wrap">
            {SIGNALS.map(([v, l]) => (
              <button key={v} type="button" onClick={() => setToken(selToken.id, { variant: v })} className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${selToken.variant === v ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={selToken.variant === v ? { background: "var(--granate)" } : {}}>{l}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px] text-gray-500">Tamaño
            <input type="range" min="0.6" max="1.8" step="0.1" value={selToken.size || 1} onChange={(e) => setToken(selToken.id, { size: Number(e.target.value) })} className="w-24 accent-[#73000A]" />
          </label>
          <button type="button" onClick={() => { set({ tokens: piece.tokens.filter((t) => t.id !== selToken.id) }); setSel(null); }} className="ml-auto p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Quitar"><Trash2 className="w-4 h-4" /></button>
        </div>
      )}
      {selToken && selToken.kind === "text" && (
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <div className="sm:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Texto (admite varias líneas)</p>
            <Textarea rows={2} value={selToken.label} onChange={(e) => setToken(selToken.id, { label: e.target.value })} className="border-gray-200 text-sm bg-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Tamaño</p>
            <input type="range" min="0.6" max="2.2" step="0.1" value={selToken.size || 1} onChange={(e) => setToken(selToken.id, { size: Number(e.target.value) })} className="w-full accent-[#73000A]" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Color</p>
            <Swatches value={selToken.color} onPick={(c) => setToken(selToken.id, { color: c })} allowReset resetLabel="Naranja" />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="button" onClick={() => { set({ tokens: piece.tokens.filter((t) => t.id !== selToken.id) }); setSel(null); }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /> Quitar texto</button>
          </div>
        </div>
      )}
      {selToken && !["ball", "signal", "text"].includes(selToken.kind) && (
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

// Dibujo estático (SVG como texto) de una jugada para imprimir: fondo blanco y líneas claras (ahorra tinta)
function pieceSvg(piece, candidates, kitOf) {
  const l = "#b8b8b8";
  let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;display:block;font-family:'IBM Plex Sans Condensed',Arial,sans-serif">`;
  o += `<defs><pattern id="net" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0L4 4M4 0L0 4" stroke="#d4d4d4" stroke-width=".5"/></pattern></defs>`;
  o += `<rect x="132" y="2" width="36" height="9" fill="url(#net)" stroke="#9a9a9a" stroke-width="1"/>`;
  o += `<g fill="none" stroke="${l}" stroke-width="1.2"><rect x="3" y="11" width="${W - 6}" height="${H - 12}"/><rect x="66" y="11" width="168" height="72"/><rect x="112" y="11" width="76" height="26"/><path d="M 120 83 A 30 30 0 0 0 180 83"/><path d="M 110 ${H - 1} A 40 40 0 0 1 190 ${H - 1}"/></g><circle cx="150" cy="58" r="1.6" fill="${l}"/>`;
  for (const a of piece.arrows || []) {
    const { dashed, color, width, head: hasHead } = arrowStyle(a);
    const curved = a.cx != null && a.cy != null;
    const fx = curved ? a.cx : a.x1, fy = curved ? a.cy : a.y1;
    const ang = Math.atan2(a.y2 - fy, a.x2 - fx), L = 5 + width * 2, Wd = 2 + width * 1.2;
    const bx = hasHead ? a.x2 - Math.cos(ang) * L : a.x2, by = hasHead ? a.y2 - Math.sin(ang) * L : a.y2;
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const hd = `${a.x2},${a.y2} ${bx + nx * Wd},${by + ny * Wd} ${bx - nx * Wd},${by - ny * Wd}`;
    const d = curved ? `M ${a.x1} ${a.y1} Q ${a.cx} ${a.cy} ${bx} ${by}` : `M ${a.x1} ${a.y1} L ${bx} ${by}`;
    if (arrowStyle(a).border) { o += `<path d="${d}" fill="none" stroke="#111827" stroke-width="${width + 1.5}" stroke-linecap="round"${dashed ? ' stroke-dasharray="4 3"' : ""}/>`; if (hasHead) o += `<polygon points="${hd}" fill="#111827" stroke="#111827" stroke-width="1.2" stroke-linejoin="round"/>`; }
    o += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"${dashed ? ' stroke-dasharray="4 3"' : ""}/>`;
    if (hasHead) o += `<polygon points="${hd}" fill="${color}"/>`;
  }
  const txt = (x, y, size, fill, str, weight = 600) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(str)}</text>`;
  for (const t of piece.tokens || []) {
    const sz = t.size || 1;
    if (t.kind === "ball") {
      const r = 5 * sz;
      o += `<circle cx="${t.x}" cy="${t.y}" r="${r}" fill="#fff" stroke="#111" stroke-width="1.2"/><circle cx="${t.x}" cy="${t.y}" r="${r * 0.38}" fill="#111"/>`;
      continue;
    }
    if (t.kind === "signal") { const h = 26 * sz; o += `<svg x="${t.x - h * 0.375}" y="${t.y - h / 2}" width="${h * 0.75}" height="${h}" viewBox="0 0 24 32">${signalPaths(t.variant)}</svg>`; continue; }
    if (t.kind === "text") {
      const fs = 6.4 * sz, lines = String(t.label || "").split("\n");
      o += `<text x="${t.x}" y="${t.y - ((lines.length - 1) * fs * 1.15) / 2 + fs * 0.35}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${t.color || NARANJA}" text-decoration="underline">${lines.map((ln, i) => `<tspan x="${t.x}" dy="${i ? fs * 1.15 : 0}">${esc(ln.toUpperCase())}</tspan>`).join("")}</text>`;
      continue;
    }
    const pl = t.player_id ? candidates.find((p) => p.id === t.player_id) : null;
    const own = t.kind === "own";
    const gk = own && pl?.position === "portero";
    const ks = own ? (gk ? kitOf(pl) : { fill: "#73000A", stroke: "#73000A", num: "#fff" }) : { fill: RIVAL_COLOR, stroke: RIVAL_COLOR, num: "#fff" };
    const fill = t.color || ks.fill;
    const stroke = t.color ? (lightColor(t.color) ? "#73000A" : fill) : ks.stroke;
    const num = t.color ? (lightColor(t.color) ? "#111827" : "#fff") : ks.num;
    const r = 8 * sz;
    const shown = String(own ? (pl ? pl.jersey_number || pl.first_name?.[0] || "" : t.label) : t.label).slice(0, 4);
    o += `<circle cx="${t.x}" cy="${t.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`;
    o += `<text x="${t.x}" y="${t.y + r * 0.36}" text-anchor="middle" font-size="${r * (shown.length > 2 ? 0.85 : 1.1)}" font-family="'Racing Sarria',sans-serif" fill="${num}">${esc(shown)}</text>`;
    const k = Math.min(sz, 1.3);
    let yy = t.y + r + 7.5 * k;
    if (pl) { o += txt(t.x, yy, 6.8 * k, own ? "#73000A" : RIVAL_COLOR, shortName(pl).toUpperCase(), 700); yy += 7 * k; }
    if (t.role && !roleDuplicated(t, piece.tokens)) o += txt(t.x, yy, 5.8 * k, "#FF6E00", t.role.toUpperCase(), 700);
  }
  return o + "</svg>";
}

function printPieces(list, candidates, kitOf, perPage, teamName, book = false) {
  const now = new Date(), y = now.getFullYear();
  const season = now.getMonth() >= 6 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
  const cover = book ? `<div class="cover"><img src="${CLUB_LOGO_URL}" alt=""><h1>ESTRATEGIA<br>A BALÓN PARADO</h1><h3>${esc(teamName || "")}</h3><p>TEMPORADA ${season}</p></div>` : "";
  const typeLabel = (v) => TYPES.find((t) => t.value === v)?.label || v;
  const cards = list.map((p) => `<section class="card">
    <header><div class="club"><img src="${CLUB_LOGO_URL}" alt=""><div><b>RACING SARRIÀ</b><span>${esc(teamName || "")}</span></div></div>
    <div class="ttl"><h2>${esc(p.name)}</h2>${(p.name || "").trim().toLowerCase() === typeLabel(p.type).toLowerCase() ? "" : `<span>${esc(typeLabel(p.type))}</span>`}</div></header>
    ${p.signal ? `<div class="sig"><b>SEÑAL</b><span>${esc(p.signal)}</span></div>` : ""}
    <div class="body"><div class="fld">${pieceSvg(p, candidates, kitOf)}</div>${p.notes ? `<div class="notes"><b>INSTRUCCIONES</b>${esc(p.notes)}</div>` : ""}</div></section>`).join("");
  const one = perPage === 1;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Acciones a balón parado${teamName ? " · " + esc(teamName) : ""}</title>
  <style>
    @font-face{font-family:'Racing Sarria';src:url('${location.origin}/fonts/RacingSarria.ttf') format('truetype')}
    @font-face{font-family:'IBM Plex Sans Condensed';font-weight:400;src:url('${location.origin}/fonts/IBMPlexSansCondensed-Regular.ttf') format('truetype')}
    @font-face{font-family:'IBM Plex Sans Condensed';font-weight:500;src:url('${location.origin}/fonts/IBMPlexSansCondensed-Medium.ttf') format('truetype')}
    @font-face{font-family:'IBM Plex Sans Condensed';font-weight:700;src:url('${location.origin}/fonts/IBMPlexSansCondensed-Bold.ttf') format('truetype')}
    @page{size:A4;margin:10mm} *{box-sizing:border-box} body{margin:0;font-family:'IBM Plex Sans Condensed',Arial,sans-serif;color:#222}
    .card{break-inside:avoid;page-break-inside:avoid;height:${one ? "275mm" : "134mm"};${one ? "" : "margin-bottom:6mm;"}overflow:hidden}
    ${one ? "" : ".card:nth-child(2n){margin-bottom:0}"}
    header{border-bottom:.6mm solid #73000A;padding-bottom:2mm;display:flex;justify-content:space-between;align-items:flex-start;gap:8mm;margin-bottom:3mm}
    .club{display:flex;align-items:center;gap:2.5mm} .club img{height:${one ? 15 : 12}mm;width:auto}
    .club b{display:block;font-family:'Racing Sarria',sans-serif;font-weight:400;font-size:${one ? 14 : 11}pt;color:#73000A;line-height:1.05;letter-spacing:.3px} .club span{display:block;font-size:${one ? 13 : 10}pt;color:#FF6E00;font-weight:700;text-transform:uppercase;line-height:1.1}
    .ttl{text-align:right} .ttl h2{margin:0;font-family:'Racing Sarria',sans-serif;font-weight:400;font-size:${one ? 26 : 19}pt;line-height:1;color:#73000A;text-transform:uppercase;letter-spacing:.3px} .ttl span{display:block;font-family:'Racing Sarria',sans-serif;font-weight:400;letter-spacing:.5px;font-size:${one ? 15 : 11.5}pt;color:#FF6E00;font-weight:700;text-transform:uppercase;margin-top:1mm}
    .sig{display:flex;align-items:center;gap:3mm;border:.3mm solid #FF6E00;border-radius:1.5mm;padding:1.2mm 3mm;margin-bottom:3mm;font-size:${one ? 12 : 10}pt}
    .sig b{background:#FF6E00;color:#fff;padding:.4mm 2mm;border-radius:1mm;font-size:${one ? 10 : 8.5}pt;letter-spacing:.5px} .sig span{color:#333;font-weight:500}
    .body{display:flex;gap:4mm;align-items:flex-start;justify-content:center} .fld{flex:1;min-width:0;${one ? "" : "max-width:132mm;"}}
    .notes{width:${one ? "52mm" : "48mm"};font-size:${one ? 11 : 9.5}pt;white-space:pre-wrap;color:#333;border-left:.5mm solid #FF6E00;padding-left:3mm;font-weight:500}
    .notes b{display:block;color:#FF6E00;font-size:${one ? 9.5 : 8.5}pt;letter-spacing:.5px;margin-bottom:1mm}
      .cover{height:275mm;page-break-after:always;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6mm}
    .cover img{height:50mm;width:auto} .cover h1{margin:0;font-family:'Racing Sarria',sans-serif;font-weight:400;font-size:40pt;line-height:1.05;color:#73000A;letter-spacing:.5px;border-bottom:1.2mm solid #FF6E00;padding-bottom:5mm}
    .cover h3{margin:0;font-family:'Racing Sarria',sans-serif;font-weight:400;font-size:24pt;color:#FF6E00;text-transform:uppercase;letter-spacing:.5px} .cover p{margin:0;font-size:13pt;color:#555;letter-spacing:2px}
  </style></head><body>${cover}<div class="pages">${cards}</div></body></html>`;
  const old = document.getElementById("sp-print-frame");
  if (old) old.remove();
  const fr = document.createElement("iframe");
  fr.id = "sp-print-frame";
  fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(fr);
  const doc = fr.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const go = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { window.print(); } };
  const ready = fr.contentWindow.document.fonts?.ready || Promise.resolve();
  Promise.race([ready, new Promise((r) => setTimeout(r, 1800))]).then(() => setTimeout(go, 500));
  return true;
}

export default function SetPieceBoard({ pieces, onChange, candidates = [], allPlayers = [], teamName = "", kitOf = () => ({ fill: "#fff", stroke: "#73000A", num: "#73000A" }), teamId }) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState(null);
  const [libOpen, setLibOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [order, setOrder] = useState([]);
  const [off, setOff] = useState([]);
  const [perPage, setPerPage] = useState(1);
  const printList = [...order.filter((id) => pieces.some((p) => p.id === id)), ...pieces.map((p) => p.id).filter((id) => !order.includes(id))];
  const moveP = (id, dir) => { const i = printList.indexOf(id), j = i + dir; if (j < 0 || j >= printList.length) return; const n = [...printList]; [n[i], n[j]] = [n[j], n[i]]; setOrder(n); };
  const doPrint = () => {
    const list = printList.filter((id) => !off.includes(id)).map((id) => pieces.find((p) => p.id === id));
    if (!list.length) return flash("Marca al menos una jugada");
    try { printPieces(list, lookup, kitOf, perPage, teamName); } catch (e) { flash("No se pudo imprimir: " + (e?.message || "error")); }
  };
  const active = pieces.find((p) => p.id === activeId) || pieces[0] || null;

  const { data: library = [] } = useQuery({
    queryKey: ["setplays", teamId],
    queryFn: () => base44.entities.SetPlay.filter({ team_id: teamId }),
    enabled: !!teamId,
  });

  const lookup = [...candidates, ...allPlayers.filter((p) => !candidates.some((c) => c.id === p.id))];
  const addPiece = (p) => { onChange([...pieces, p]); setActiveId(p.id); setTplOpen(false); };
  const add = () => addPiece(newPiece(pieces.length + 1));
  const addTemplate = (tpl) => addPiece(fromTemplate(tpl, pieces.length + 1));
  const duplicate = () => { if (!active) return; const c = { ...active, id: uid(), name: `${active.name} (copia)`, lib_id: undefined, tokens: active.tokens.map((t) => ({ ...t, id: uid() })), arrows: active.arrows.map((a) => ({ ...a, id: uid() })) }; addPiece(c); };
  const flip = () => { if (active) update(flipPiece(active)); };
  const printBook = () => {
    if (!library.length) return flash("La biblioteca está vacía");
    const order = TYPES.map((t) => t.value);
    const list = [...library].sort((a, b) => (order.indexOf(a.type) - order.indexOf(b.type)) || (a.name || "").localeCompare(b.name || ""));
    try { printPieces(list, lookup, kitOf, perPage, teamName, true); } catch (e) { flash("No se pudo imprimir: " + (e?.message || "error")); }
  };
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
          <button type="button" onClick={() => setTplOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-bold text-white px-2.5 py-1.5 rounded" style={{ background: "var(--granate)" }}><Plus className="w-3.5 h-3.5" /> Nueva jugada</button>
        </div>
      </div>

      {tplOpen && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Empezar desde…</p>
            <button type="button" onClick={() => setTplOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <button type="button" onClick={add} className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"><Plus className="w-3.5 h-3.5" /> Campo en blanco</button>
            {TEMPLATES.map((t) => (
              <button key={t.key} type="button" onClick={() => addTemplate(t)} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 hover:bg-gray-50 text-left"><LayoutTemplate className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--granate)" }} /> {t.label}</button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400">Las fichas ya vienen colocadas. Después solo asignas los jugadores (o pulsas «Rellenar con convocados»).</p>
        </div>
      )}

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
            <button type="button" onClick={printBook} disabled={!library.length} title="Imprime toda la biblioteca del equipo, con portada y agrupada por tipo" className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-white disabled:opacity-40"><BookOpen className="w-3.5 h-3.5" /> Libro del equipo</button>
            <Button type="button" variant="club" size="sm" onClick={doPrint} className="ml-auto gap-1"><Printer className="w-3.5 h-3.5" /> Imprimir</Button>
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
              <Board key={active.id} piece={active} onChange={update} candidates={candidates} lookup={lookup} kitOf={kitOf}
                header={(
                  <>
                    <div className="flex items-start justify-between gap-3 border-b-2 pb-2" style={{ borderColor: GRANATE }}>
                      <div className="flex items-center gap-2 shrink-0">
                        <img src={CLUB_LOGO_URL} alt="" className="h-9 sm:h-11 w-auto" />
                        <div className="hidden sm:block leading-tight">
                          <p className="text-sm" style={{ fontFamily: F_BIG, color: GRANATE, letterSpacing: "0.05em" }}>RACING SARRIÀ</p>
                          <p className="text-xs uppercase font-semibold" style={{ fontFamily: F_TXT, color: NARANJA }}>{teamName}</p>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col items-end">
                        <input value={active.name} onChange={(e) => update({ ...active, name: e.target.value })} placeholder="TÍTULO DE LA JUGADA"
                          className="w-full text-right uppercase bg-transparent rounded px-1 outline-none hover:bg-gray-50 focus:bg-gray-50 focus:ring-1 focus:ring-[#FF6E00] text-xl sm:text-3xl leading-tight"
                          style={{ fontFamily: F_BIG, color: GRANATE, letterSpacing: "0.05em" }} />
                        <Select value={active.type} onValueChange={(v) => update({ ...active, type: v })}>
                          <SelectTrigger className="h-7 w-auto max-w-full border-0 bg-transparent shadow-none px-1 gap-1 focus:ring-0 hover:bg-gray-50 text-sm sm:text-base uppercase" style={{ fontFamily: F_BIG, color: NARANJA, letterSpacing: "0.05em" }}><SelectValue /></SelectTrigger>
                          <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border px-2 py-1" style={{ borderColor: NARANJA }}>
                      <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded shrink-0" style={{ background: NARANJA, fontFamily: F_TXT, letterSpacing: "0.08em" }}>SEÑAL</span>
                      <input value={active.signal || ""} onChange={(e) => update({ ...active, signal: e.target.value })} placeholder="Cómo se avisa: el lanzador se toca la cabeza, bota el balón…"
                        className="flex-1 min-w-0 bg-transparent outline-none text-sm text-gray-800" style={{ fontFamily: F_TXT }} />
                    </div>
                  </>
                )}
                side={(
                  <div className="w-full md:w-48 shrink-0 md:border-l-2 md:pl-3" style={{ borderColor: NARANJA }}>
                    <p className="text-[10px] font-bold mb-1" style={{ color: NARANJA, fontFamily: F_TXT, letterSpacing: "0.08em" }}>INSTRUCCIONES</p>
                    <Textarea rows={5} value={active.notes} onChange={(e) => update({ ...active, notes: e.target.value })} className="border-gray-200 text-sm" style={{ fontFamily: F_TXT }} placeholder="Quién saca, quién ataca el primer palo, rechace…" />
                  </div>
                )} />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={saveToLibrary} disabled={!teamId} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded border" style={{ borderColor: "var(--granate)", color: "var(--granate)" }}>
                  <BookmarkPlus className="w-3.5 h-3.5" /> {active.lib_id ? "Actualizar en la biblioteca" : "Guardar en biblioteca"}
                </button>
                <button type="button" onClick={duplicate} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"><Copy className="w-3.5 h-3.5" /> Duplicar</button>
                <button type="button" onClick={flip} title="Voltea la jugada de izquierda a derecha (por ejemplo, un córner del otro lado)" className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"><FlipHorizontal className="w-3.5 h-3.5" /> Voltear izq/der</button>
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
