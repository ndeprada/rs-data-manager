import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Eraser, Wand2, Search, FileDown } from "lucide-react";
import { downloadMatchSheetPDF } from "@/lib/matchSheetPdf";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SetPieceBoard from "./SetPieceBoard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import RichTextBox from "./RichTextBox";
import { playerFirstName, playerFullName, matchesPlayerSearch } from "@/lib/playerName";

const FORMATIONS_F11 = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2", "4-5-1", "4-1-4-1"];
// En F7 la primera es la táctica por defecto
const FORMATIONS_F7 = ["3-1-2", "3-2-1", "2-3-1", "2-2-2", "1-3-2"];

// Positions as [x%, y%] — origin top-left, attack towards top
// 4-3-3: MC pivot retrasado (50,52), dos MCO avanzados (28,42)(72,42)
//        Extremos adelantados (18,18)(82,18), DC ligeramente más retrasado (50,24)
const FORMATION_POSITIONS = {
  "4-3-3":    [[50,88],[18,68],[38,68],[62,68],[82,68],[28,42],[50,52],[72,42],[18,18],[50,24],[82,18]],
  "4-4-2":    [[50,88],[18,68],[38,68],[62,68],[82,68],[18,46],[38,46],[62,46],[82,46],[35,20],[65,20]],
  "4-2-3-1":  [[50,88],[18,68],[38,68],[62,68],[82,68],[35,54],[65,54],[22,38],[50,34],[78,38],[50,16]],
  "3-5-2":    [[50,88],[25,68],[50,68],[75,68],[10,50],[30,46],[50,44],[70,46],[90,50],[35,20],[65,20]],
  "3-4-3":    [[50,88],[25,68],[50,68],[75,68],[18,48],[40,48],[60,48],[82,48],[22,22],[50,18],[78,22]],
  "5-3-2":    [[50,88],[10,68],[28,68],[50,68],[72,68],[90,68],[28,46],[50,42],[72,46],[35,20],[65,20]],
  "4-5-1":    [[50,88],[18,68],[38,68],[62,68],[82,68],[12,46],[32,44],[52,44],[72,44],[88,46],[50,18]],
  "4-1-4-1":  [[50,88],[18,68],[38,68],[62,68],[82,68],[50,56],[18,40],[38,40],[62,40],[82,40],[50,18]],
  "3-2-1":    [[50,88],[22,68],[50,68],[78,68],[35,46],[65,46],[50,20]],
  "2-3-1":    [[50,88],[30,72],[70,72],[20,50],[50,46],[80,50],[50,20]],
  "2-2-2":    [[50,88],[30,70],[70,70],[30,46],[70,46],[30,22],[70,22]],
  "3-1-2":    [[50,88],[22,61],[50,70],[78,61],[50,40],[17,26],[83,26]],
  "1-3-2":    [[50,88],[50,72],[22,52],[50,48],[78,52],[30,22],[70,22]],
};

// ── Draggable Football Field ────────────────────────────
const KITS = {
  "1": { label: "1ª", fill: "#ffffff", stroke: "#73000A", num: "#73000A" },
  "2": { label: "2ª", fill: "#73000A", stroke: "#36000D", num: "#ffffff" },
  "3": { label: "3ª", fill: "#22a559", stroke: "#0f5132", num: "#ffffff" },
};
const GK_KITS = {
  naranja: { label: "Naranja", fill: "#F97316", stroke: "#9a3412", num: "#ffffff" },
  azul: { label: "Azul eléctrico", fill: "#0a4bff", stroke: "#0a2a99", num: "#ffffff" },
};
const kitFor = (player, kit, gkKit) =>
  player?.position === "portero" ? (GK_KITS[gkKit] || GK_KITS.naranja) : (KITS[kit] || KITS["1"]);

function DraggableField({ kit, gkKit, captainId,  slots, positions, onPositionsChange, onSlotClick, selectedIdx = null }) {
  const svgRef = useRef(null);
  const draggingIdx = useRef(null);
  const W = 300, H = 420;

  const getSVGPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    return {
      x: Math.max(14, Math.min(W - 14, (clientX - rect.left) * scaleX)),
      y: Math.max(14, Math.min(H - 14, (clientY - rect.top) * scaleY)),
    };
  }, []);

  const downAt = useRef(null);
  const handlePointerDown = (e, idx) => {
    e.preventDefault();
    draggingIdx.current = idx;
    downAt.current = { x: e.clientX, y: e.clientY, idx };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (draggingIdx.current === null) return;
    const pt = getSVGPoint(e.clientX, e.clientY);
    if (!pt) return;
    const next = [...positions];
    next[draggingIdx.current] = [pt.x / W * 100, pt.y / H * 100];
    onPositionsChange(next);
  };

  const handlePointerUp = (e) => {
    const d = downAt.current;
    if (d && e && e.type === "pointerup" && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) {
      const idx = d.idx;
      setTimeout(() => onSlotClick?.(idx), 120); // evita que el "click" posterior caiga sobre el selector ya abierto
    }
    downAt.current = null;
    draggingIdx.current = null;
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full touch-none select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <defs>
        <linearGradient id="tFieldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#166534" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
      </defs>
      {/* Field background */}
      <rect x="0" y="0" width={W} height={H} fill="url(#tFieldGrad)" />
      {/* Stripes */}
      {[0,1,2,3,4,5].map(i => <rect key={i} x="0" y={i*70} width={W} height="35" fill="rgba(255,255,255,0.025)" />)}
      {/* Lines */}
      <rect x="12" y="12" width={W-24} height={H-24} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
      <line x1="12" y1={H/2} x2={W-12} y2={H/2} stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
      <circle cx={W/2} cy={H/2} r="38" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
      <circle cx={W/2} cy={H/2} r="3" fill="rgba(255,255,255,0.4)" />
      {/* Penalty areas */}
      <rect x={W*0.22} y="12" width={W*0.56} height="72" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
      <rect x={W*0.34} y="12" width={W*0.32} height="28" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.1" />
      <rect x={W*0.22} y={H-84} width={W*0.56} height="72" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
      <rect x={W*0.34} y={H-40} width={W*0.32} height="28" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.1" />
      {/* Corner arcs */}
      <path d="M12,22 A10,10 0 0,0 22,12" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <path d={`M${W-12},22 A10,10 0 0,1 ${W-22},12`} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <path d={`M12,${H-22} A10,10 0 0,1 22,${H-12}`} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <path d={`M${W-12},${H-22} A10,10 0 0,0 ${W-22},${H-12}`} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />

      {/* Players */}
      {positions.map((pos, i) => {
        const player = slots[i];
        if (!pos) return null;
        const cx = pos[0] / 100 * W;
        const cy = pos[1] / 100 * H;
        const [line1, line2] = player ? labelLines(player) : ["", ""];
        const k = kitFor(player, kit, gkKit);
        return (
          <g key={i} onPointerDown={e => handlePointerDown(e, i)} style={{ cursor: "grab" }}>
            {selectedIdx === i && <circle cx={cx} cy={cy} r="19" fill="rgba(252,221,9,0.18)" stroke="#FCDD09" strokeWidth="2.5" />}
            <circle cx={cx + 1} cy={cy + 1.5} r="13" fill="rgba(0,0,0,0.25)" />
            <circle cx={cx} cy={cy} r="13" fill={player ? k.fill : "rgba(255,255,255,0.15)"} stroke={player ? k.stroke : "white"} strokeWidth="2.2" strokeDasharray={player ? "0" : "4 3"} />
            <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={player ? 17 : 13} fontWeight="400" style={{ fontFamily: "'Racing Sarria', sans-serif" }} fill={player ? k.num : "white"}>
              {player ? (player.jersey_number || player.first_name?.[0]) : "+"}
            </text>
            {player && captainId && player.id === captainId && (
              <g transform={`translate(${cx + 11}, ${cy - 20})`}>
                <rect x="-0.8" y="-0.8" width="15.6" height="11.6" rx="2" fill="#1f2937" opacity="0.55" />
                <rect x="0" y="0" width="14" height="10" rx="1.5" fill="#FCDD09" />
                {[1.4, 4.4, 7.4, 10.4].map(x => <rect key={x} x={x} y="0" width="1.7" height="10" fill="#DA121A" />)}
                <text x="7" y="8.4" textAnchor="middle" fontSize="9" style={{ fontFamily: "'Racing Sarria', sans-serif" }} fill="white" stroke="rgba(0,0,0,0.8)" strokeWidth="1.8" paintOrder="stroke" strokeLinejoin="round">C</text>
              </g>
            )}
            {player && (
              <text x={cx} y={cy + 23} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="white" stroke="rgba(0,0,0,0.55)" strokeWidth="2.2" paintOrder="stroke" strokeLinejoin="round">
                <tspan x={cx}>{line1}</tspan>
                {line2 && <tspan x={cx} dy="9.5">{line2}</tspan>}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Nombre completo en una línea y primer apellido en la segunda (respeta partículas: "De la Torre")
const PARTICLES = ["de", "del", "la", "las", "los", "da", "di", "van", "von", "el", "i"];
function firstSurname(last = "") {
  const t = last.trim().split(/\s+/).filter(Boolean);
  if (t.length <= 1) return t[0] || "";
  let i = 0;
  while (i < t.length - 1 && PARTICLES.includes(t[i].toLowerCase())) i++;
  return t.slice(0, i + 1).join(" ");
}
function labelLines(p) { return [playerFirstName(p), firstSurname(p.last_name)]; }


// ── Selector de jugador para un hueco del once ─────────
function PlayerPicker({ open, onClose, teamPlayers, taken, onPick, onClear, current }) {
  const [q, setQ] = useState("");
  const { data: allPlayers = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list(), enabled: open });
  useEffect(() => { if (open) setQ(""); }, [open]);
  const pool = q.trim()
    ? allPlayers.filter(p => p.status !== "baja" && matchesPlayerSearch(p, q)).slice(0, 30)
    : teamPlayers;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-white border-gray-200 max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Elegir jugador</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar (incluye otros equipos)…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-300" />
        </div>
        <div className="space-y-1">
          {current && <button onClick={onClear} className="w-full text-left text-xs px-3 py-2 rounded border border-red-200 text-red-600 hover:bg-red-50">Dejar el hueco vacío</button>}
          {pool.map(p => {
            const used = taken.has(p.id) && p.id !== current?.id;
            return (
              <button key={p.id} disabled={used} onClick={() => onPick(p)} className={`w-full text-left flex items-center gap-2 px-3 py-1.5 rounded text-sm ${used ? "opacity-40" : "hover:bg-gray-50"}`}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0" style={{ background: "var(--granate)" }}>{p.jersey_number || p.first_name?.[0]}</span>
                <span className="font-medium truncate">{playerFullName(p)}</span>
                <span className="ml-auto text-[10px] text-gray-400">{POS_LABEL[p.position] || ""}</span>
              </button>
            );
          })}
          {pool.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sin resultados</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const POS_LABEL = { portero: "POR", lateral: "LAT", central: "CT", libre: "LIB", mediocentro: "MC", interior: "INT", delantero_centro: "DC", extremo: "EXT" };
const POS_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "extremo", "delantero_centro"];

function Plan({ title, hint, value, onChange: set, placeholder, minHeight = 140, small = false }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl space-y-2 ${small ? "p-4" : "p-5"}`}>
      <p className="text-sm font-bold text-gray-900">{title}</p>
      <p className="text-[10px] text-gray-400">{hint}</p>
      <RichTextBox value={value} onChange={set} placeholder={placeholder} minHeight={minHeight} />
    </div>
  );
}

// ── Main Tab ────────────────────────────────────────────
export default function TacticaTab({ event, players, convocadoIds, starterIds, footballFormat, team }) {
  const qc = useQueryClient();
  const isF7 = footballFormat === "f7";
  const formations = isF7 ? FORMATIONS_F7 : FORMATIONS_F11;
  const validDefault = formations[0];
  const teamPlayers = [...players.filter(p => p.status !== "baja")].sort((a, b) => (POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position)) || (a.last_name || "").localeCompare(b.last_name || ""));

  const { data: allPlayers = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const [formation, setFormation] = useState(validDefault);
  const [positions, setPositions] = useState(null);
  const [lineup, setLineup] = useState([]);       // ids por hueco (null = vacío)
  const [planAttack, setPlanAttack] = useState("");
  const [planDefense, setPlanDefense] = useState("");
  const [planSet, setPlanSet] = useState("");
  const [rival, setRival] = useState({ strengths: "", weaknesses: "", keys: "", notes: "" });
  const [pieces, setPieces] = useState([]);
  const [captain, setCaptain] = useState("");
  const [kit, setKit] = useState("1");
  const [gkKit, setGkKit] = useState("naranja");
  const [gkKit2, setGkKit2] = useState(""); // portero suplente ("" = igual que el titular)
  const [pickSlot, setPickSlot] = useState(null);
  const [status, setStatus] = useState("");
  const loaded = useRef(false);
  const planId = useRef(null);
  const chain = useRef(Promise.resolve());

  const { data: plan, isFetched } = useQuery({
    queryKey: ["matchplan", event?.id],
    queryFn: () => base44.entities.MatchPlan.filter({ event_id: event.id }).then(d => d[0] || null),
    enabled: !!event?.id,
  });

  // Carga inicial (una vez): plan guardado, o el borrador antiguo de este navegador
  useEffect(() => {
    if (!isFetched || loaded.current) return;
    loaded.current = true;
    if (plan) {
      planId.current = plan.id;
      if (formations.includes(plan.formation)) setFormation(plan.formation);
      setPositions(plan.positions || null);
      setLineup(plan.lineup || []);
      setPlanAttack(plan.plan_attack || "");
      setPlanDefense(plan.plan_defense || "");
      setPlanSet(plan.plan_setpieces || "");
      setRival({ strengths: "", weaknesses: "", keys: "", notes: "", ...(plan.rival || {}) });
      setPieces(plan.set_pieces || []);
      setCaptain(plan.captain_id || "");
      if (KITS[plan.kit]) setKit(plan.kit);
      if (GK_KITS[plan.gk_kit]) setGkKit(plan.gk_kit);
      setGkKit2(GK_KITS[plan.gk_kit2] ? plan.gk_kit2 : "");
    } else {
      try {
        const old = JSON.parse(localStorage.getItem(`tactica_${event?.id}`) || "null");
        if (old) {
          if (formations.includes(old.formation)) setFormation(old.formation);
          setPlanAttack(old.planPropio || "");
          setRival(r => ({ ...r, notes: old.planRival || "" }));
        }
      } catch (_) {}
    }
  }, [isFetched]);

  const validFormation = formations.includes(formation) ? formation : validDefault;
  const defaultPositions = FORMATION_POSITIONS[validFormation] || [];
  const currentPositions = positions || defaultPositions;
  const nSlots = defaultPositions.length;
  const slotIds = Array.from({ length: nSlots }, (_, i) => lineup[i] || null);
  const slots = slotIds.map(id => (id ? allPlayers.find(p => p.id === id) || players.find(p => p.id === id) || null : null));
  const taken = new Set(slotIds.filter(Boolean));

  // Autoguardado (1,2 s después del último cambio)
  const payload = { formation: validFormation, positions, lineup: slotIds, plan_attack: planAttack, plan_defense: planDefense, plan_setpieces: planSet, rival, set_pieces: pieces, kit, gk_kit: gkKit, gk_kit2: gkKit2, captain_id: slotIds.includes(captain) ? captain : "" };
  const payloadKey = JSON.stringify(payload);
  const firstRun = useRef(true);
  useEffect(() => {
    if (!loaded.current) return;
    if (firstRun.current) { firstRun.current = false; return; }
    setStatus("Guardando…");
    const t = setTimeout(() => {
      chain.current = chain.current.then(async () => {
        try {
          if (planId.current) await base44.entities.MatchPlan.update(planId.current, payload);
          else { const c = await base44.entities.MatchPlan.create({ event_id: event.id, team_id: event.team_id, ...payload }); planId.current = c.id; }
          qc.invalidateQueries({ queryKey: ["matchplan", event.id] });
          setStatus("Guardado ✓");
        } catch (_) { setStatus("Error al guardar"); }
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [payloadKey]);

  const handleFormationChange = (f) => {
    setFormation(f);
    setPositions(null);
    setLineup(l => l.slice(0, (FORMATION_POSITIONS[f] || []).length));
  };
  const setSlot = (i, id) => setLineup(() => { const n = [...slotIds]; n[i] = id; return n; });
  // Banquillo: solo los convocados que no están en el once, ordenados por porteros, defensas, medios y delanteros
  const GROUP = { portero: 0, central: 1, libre: 1, lateral: 1, mediocentro: 2, interior: 2, extremo: 3, delantero_centro: 3 };
  const benchPlayers = [...new Set(convocadoIds || [])]
    .filter(id => !taken.has(id))
    .map(id => allPlayers.find(p => p.id === id) || players.find(p => p.id === id))
    .filter(Boolean)
    .sort((a, b) => ((GROUP[a.position] ?? 9) - (GROUP[b.position] ?? 9)) || ((Number(a.jersey_number) || 999) - (Number(b.jersey_number) || 999)) || (a.last_name || "").localeCompare(b.last_name || ""));
  const [sel, setSel] = useState(null); // { kind: "slot", i } | { kind: "bench", id }
  const selPlayer = sel?.kind === "slot" ? slots[sel.i] : sel?.kind === "bench" ? benchPlayers.find(p => p.id === sel.id) : null;
  const onSlotTap = (i) => {
    if (!sel) { if (slots[i]) setSel({ kind: "slot", i }); else setPickSlot(i); return; }
    if (sel.kind === "bench") { setSlot(i, sel.id); setSel(null); return; }
    if (sel.i === i) { setSel(null); return; }
    const n = [...slotIds]; [n[i], n[sel.i]] = [n[sel.i], n[i]];
    setLineup(n); setSel(null);
  };
  const onBenchTap = (p) => {
    if (!sel || sel.kind === "bench") { setSel(sel?.id === p.id ? null : { kind: "bench", id: p.id }); return; }
    setSlot(sel.i, p.id); setSel(null);
  };
  const fillFromActa = () => {
    const ids = players.filter(p => starterIds.includes(p.id)).sort((a, b) => POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position)).map(p => p.id);
    setLineup(Array.from({ length: nSlots }, (_, i) => ids[i] || null));
  };
  const [pdfBusy, setPdfBusy] = useState(false);
  const makePdf = async () => {
    setPdfBusy(true);
    try {
      await downloadMatchSheetPDF({
        event, team, formation: validFormation, positions: currentPositions, slots, captainId: slotIds.includes(captain) ? captain : "",
        kit, gkKit, gkKitBench: gkKit2 || gkKit, kits: KITS, gkKits: GK_KITS, benchPlayers, planAttack, planDefense, planSet,
        ourLogoUrl: team?.logo_url || CLUB_LOGO_URL, opponentLogoUrl: event?.opponent_logo_url,
      });
    } finally { setPdfBusy(false); }
  };
  const filled = slotIds.filter(Boolean).length;
  const names = [...new Set(players.map(p => p.last_name).filter(Boolean))];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <button type="button" disabled={pdfBusy} onClick={makePdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60" style={{ background: "var(--granate)" }}>
          <FileDown className="w-3.5 h-3.5" /> {pdfBusy ? "Generando…" : "Hoja del entrenador (PDF)"}
        </button>
        <span className="text-[11px] text-gray-400 h-4">{status}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Once inicial: libre, no depende de la convocatoria ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900">Once inicial <span className="text-gray-400 font-normal text-xs">({filled}/{nSlots})</span></p>
            <div className="flex items-center gap-2">
              <Select value={validFormation} onValueChange={handleFormationChange}>
                <SelectTrigger className="w-28 h-8 text-xs border-gray-200"><SelectValue /></SelectTrigger>
                <SelectContent>{formations.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
              <button onClick={() => setPositions(null)} title="Restablecer posiciones" className="p-1.5 rounded border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50"><RotateCcw className="w-3.5 h-3.5" /></button>
              {starterIds?.length > 0 && <button onClick={fillFromActa} title="Rellenar con los titulares del acta" className="p-1.5 rounded border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50"><Wand2 className="w-3.5 h-3.5" /></button>}
              {filled > 0 && <button onClick={() => setLineup([])} title="Vaciar el once" className="p-1.5 rounded border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50"><Eraser className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Equipación</span>
              {Object.entries(KITS).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setKit(k)} title={`${v.label} equipación`}
                  className={`w-7 h-7 rounded-full text-[10px] font-black flex items-center justify-center ${kit === k ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
                  style={{ background: v.fill, border: `2px solid ${v.stroke}`, color: v.num }}>{v.label[0]}</button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Portero</span>
              {Object.entries(GK_KITS).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setGkKit(k)} title={v.label}
                  className={`w-7 h-7 rounded-full text-[10px] font-black flex items-center justify-center ${gkKit === k ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
                  style={{ background: v.fill, border: `2px solid ${v.stroke}`, color: v.num }}>P</button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Portero suplente</span>
              {Object.entries(GK_KITS).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setGkKit2(k)} title={v.label}
                  className={`w-7 h-7 rounded-full text-[10px] font-black flex items-center justify-center ${(gkKit2 || gkKit) === k ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
                  style={{ background: v.fill, border: `2px solid ${v.stroke}`, color: v.num }}>P</button>
              ))}
            </div>
          </div>
          {filled > 0 && (
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Capitán</span>
              <Select value={slotIds.includes(captain) ? captain : "none"} onValueChange={v => setCaptain(v === "none" ? "" : v)}>
                <SelectTrigger className="w-44 h-7 text-xs border-gray-200"><SelectValue placeholder="Elegir…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin capitán</SelectItem>
                  {slots.filter(Boolean).map(p => <SelectItem key={p.id} value={p.id}>{playerFirstName(p)} {firstSurname(p.last_name)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-[10px] text-gray-400 text-center">Toca un jugador y luego otro (del campo o del banquillo) para intercambiarlos · toca un hueco vacío para elegir · arrastra para reposicionar</p>
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <div className="flex-1 min-w-0 w-full" style={{ maxWidth: 380 }}>
              <div style={{ aspectRatio: "300/420" }}>
                <DraggableField
                  kit={kit}
                  gkKit={gkKit}
                  captainId={slotIds.includes(captain) ? captain : ""}
                  slots={slots}
                  positions={currentPositions}
                  onPositionsChange={(newPos) => setPositions(newPos)}
                  onSlotClick={onSlotTap}
                  selectedIdx={sel?.kind === "slot" ? sel.i : null}
                />
              </div>
            </div>

            {/* Banquillo: solo convocados, por líneas */}
            <div className="w-full sm:w-44 shrink-0">
              <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1.5">Banquillo <span className="font-normal">({benchPlayers.length})</span></p>
              {benchPlayers.length === 0 ? (
                <p className="text-[11px] text-gray-400">{(convocadoIds || []).length === 0 ? "Aún no hay convocatoria." : "Todos los convocados están en el once."}</p>
              ) : (
                <div className="flex flex-row flex-wrap sm:flex-col gap-1">
                  {benchPlayers.map((p, idx) => {
                    const k = kitFor(p, kit, gkKit2 || gkKit);
                    const on = sel?.kind === "bench" && sel.id === p.id;
                    const newGroup = idx > 0 && (GROUP[p.position] ?? 9) !== (GROUP[benchPlayers[idx - 1].position] ?? 9);
                    return (
                      <button key={p.id} type="button" onClick={() => onBenchTap(p)}
                        className={`flex items-center gap-1.5 text-left rounded-md px-1 py-0.5 border ${on ? "bg-yellow-50 border-yellow-400" : "border-transparent hover:bg-gray-50"} ${newGroup ? "sm:mt-1.5" : ""}`}>
                        <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0" style={{ background: k.fill, border: `2px solid ${k.stroke}`, color: k.num, fontFamily: "'Racing Sarria', sans-serif", fontSize: 11 }}>
                          {p.jersey_number || p.first_name?.[0]}
                        </span>
                        <span className="text-[11px] font-medium text-gray-800 truncate">{playerFirstName(p)} {firstSurname(p.last_name)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {sel && selPlayer && (
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2">
              <span className="text-gray-700"><b>{playerFullName(selPlayer)}</b> seleccionado · {sel.kind === "bench" ? "toca un hueco del once para meterlo" : "toca otro jugador para intercambiarlo"}</span>
              <span className="flex items-center gap-1.5">
                {sel.kind === "slot" && <button onClick={() => { setPickSlot(sel.i); }} className="px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-white">Elegir otro jugador</button>}
                {sel.kind === "slot" && <button onClick={() => { setSlot(sel.i, null); setSel(null); }} className="px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-white">Vaciar hueco</button>}
                <button onClick={() => setSel(null)} className="px-2 py-1 rounded border border-gray-300 text-gray-500 hover:bg-white">Cancelar</button>
              </span>
            </div>
          )}
        </div>

        {/* ── Planes ── */}
        <div className="space-y-4">
          <Plan title="⚔️ Plan de partido en ataque" hint="Salida de balón, progresión, zonas de ataque, movimientos clave, finalización…" value={planAttack} onChange={setPlanAttack}
            placeholder="Ej: Salida 3+1 con el mediocentro, progresar por banda derecha, extremos cerrando para el desmarque del 9…" />
          <Plan title="🛡️ Plan de partido en defensa" hint="Bloque, altura de presión, referencias de marcaje, transiciones defensivas…" value={planDefense} onChange={setPlanDefense}
            placeholder="Ej: Bloque medio 4-4-2, presión tras pase atrás, vigilar al 10 rival en el rechace, repliegue rápido…" />
          <Plan small minHeight={56} title="⚑ Balón parado" hint="Córners, faltas, saques de banda: referencias y aspectos a tener en cuenta." value={planSet} onChange={setPlanSet}
            placeholder="Ej: Córner a favor: 2 al primer palo; en contra: marcaje mixto, 9 rival vigilado…" />
        </div>
      </div>

      {/* ── Análisis del rival ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="text-sm font-bold text-gray-900">🔍 Análisis del rival{event?.opponent ? ` · ${event.opponent}` : ""}</p>
        <div className="grid md:grid-cols-3 gap-3">
          {[["strengths", "Puntos fuertes", "Qué hacen bien, cómo atacan…"], ["weaknesses", "Puntos débiles", "Dónde les podemos hacer daño…"], ["keys", "Jugadores clave", "Dorsal, perfil, cómo frenarlo…"]].map(([k, label, ph]) => (
            <div key={k} className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
              <RichTextBox value={rival[k]} onChange={v => setRival(r => ({ ...r, [k]: v }))} placeholder={ph} minHeight={110} />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Comentarios</p>
          <RichTextBox value={rival.notes} onChange={v => setRival(r => ({ ...r, notes: v }))} placeholder="Sistema habitual, estilo, balón parado, resultados recientes…" minHeight={70} />
        </div>
      </div>

      {/* ── Balón parado ── */}
      <SetPieceBoard pieces={pieces} onChange={setPieces} names={names} />

      <PlayerPicker
        open={pickSlot !== null}
        onClose={() => setPickSlot(null)}
        teamPlayers={teamPlayers}
        taken={taken}
        current={pickSlot !== null ? slots[pickSlot] : null}
        onPick={(p) => { setSlot(pickSlot, p.id); setSel(null); setPickSlot(null); }}
        onClear={() => { setSlot(pickSlot, null); setSel(null); setPickSlot(null); }}
      />
    </div>
  );
}
