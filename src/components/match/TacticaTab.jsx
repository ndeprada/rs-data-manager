import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Eraser, Wand2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SetPieceBoard from "./SetPieceBoard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const FORMATIONS_F11 = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2", "4-5-1", "4-1-4-1"];
const FORMATIONS_F7 = ["3-2-1", "2-3-1", "2-2-2", "3-1-2", "1-3-2"];

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
  "3-1-2":    [[50,88],[22,70],[50,70],[78,70],[50,48],[30,22],[70,22]],
  "1-3-2":    [[50,88],[50,72],[22,52],[50,48],[78,52],[30,22],[70,22]],
};

// ── Draggable Football Field ────────────────────────────
function DraggableField({ slots, positions, onPositionsChange, onSlotClick }) {
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
        const name = player?.last_name || "";
        return (
          <g key={i} onPointerDown={e => handlePointerDown(e, i)} style={{ cursor: "grab" }}>
            <circle cx={cx + 1} cy={cy + 2} r="17" fill="rgba(0,0,0,0.25)" />
            <circle cx={cx} cy={cy} r="17" fill={player ? "var(--granate)" : "rgba(255,255,255,0.15)"} stroke="white" strokeWidth="2.5" strokeDasharray={player ? "0" : "4 3"} />
            <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={player ? 11 : 14} fontWeight="900" fill="white">
              {player ? (player.jersey_number || player.first_name?.[0]) : "+"}
            </text>
            {player && (
              <text x={cx} y={cy + 27} textAnchor="middle" fontSize="8" fontWeight="700" fill="white" opacity="0.95">
                {name.length > 10 ? name.slice(0, 10) + "…" : name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Selector de jugador para un hueco del once ─────────
function PlayerPicker({ open, onClose, teamPlayers, taken, onPick, onClear, current }) {
  const [q, setQ] = useState("");
  const { data: allPlayers = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list(), enabled: open });
  useEffect(() => { if (open) setQ(""); }, [open]);
  const pool = q.trim()
    ? allPlayers.filter(p => p.status !== "baja" && `${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30)
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
                <span className="font-medium truncate">{p.first_name} {p.last_name}</span>
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

function Plan({ title, hint, value, onChange: set, placeholder }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
      <p className="text-sm font-bold text-gray-900">{title}</p>
      <p className="text-[10px] text-gray-400">{hint}</p>
      <Textarea value={value} onChange={e => set(e.target.value)} rows={6} className="border-gray-200 text-sm" placeholder={placeholder} />
    </div>
  );
}

// ── Main Tab ────────────────────────────────────────────
export default function TacticaTab({ event, players, convocadoIds, starterIds, footballFormat }) {
  const qc = useQueryClient();
  const isF7 = footballFormat === "f7";
  const formations = isF7 ? FORMATIONS_F7 : FORMATIONS_F11;
  const validDefault = formations[0];
  const teamPlayers = [...players.filter(p => p.status !== "baja")].sort((a, b) => (POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position)) || (a.last_name || "").localeCompare(b.last_name || ""));

  const { data: allPlayers = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const [formation, setFormation] = useState(validDefault);
  const [positions, setPositions] = useState(null);
  const [lineup, setLineup] = useState([]);       // ids por hueco (null = vacío)
  const [bench, setBench] = useState([]);
  const [planAttack, setPlanAttack] = useState("");
  const [planDefense, setPlanDefense] = useState("");
  const [rival, setRival] = useState({ strengths: "", weaknesses: "", keys: "", notes: "" });
  const [pieces, setPieces] = useState([]);
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
      setBench(plan.bench || []);
      setPlanAttack(plan.plan_attack || "");
      setPlanDefense(plan.plan_defense || "");
      setRival({ strengths: "", weaknesses: "", keys: "", notes: "", ...(plan.rival || {}) });
      setPieces(plan.set_pieces || []);
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
  const payload = { formation: validFormation, positions, lineup: slotIds, bench, plan_attack: planAttack, plan_defense: planDefense, rival, set_pieces: pieces };
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
  const fillFromActa = () => {
    const ids = players.filter(p => starterIds.includes(p.id)).sort((a, b) => POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position)).map(p => p.id);
    setLineup(Array.from({ length: nSlots }, (_, i) => ids[i] || null));
  };
  const toggleBench = (id) => setBench(b => b.includes(id) ? b.filter(x => x !== id) : [...b, id]);
  const benchCandidates = teamPlayers.filter(p => !taken.has(p.id));
  const filled = slotIds.filter(Boolean).length;
  const names = [...new Set(players.map(p => p.last_name).filter(Boolean))];

  return (
    <div className="space-y-5">
      <div className="flex justify-end text-[11px] text-gray-400 h-4">{status}</div>
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
          <p className="text-[10px] text-gray-400 text-center">Toca un hueco para elegir jugador (cualquiera del club) · arrastra para reposicionar</p>
          <div style={{ maxWidth: 320, margin: "0 auto", aspectRatio: "300/420" }}>
            <DraggableField
              slots={slots}
              positions={currentPositions}
              onPositionsChange={(newPos) => setPositions(newPos)}
              onSlotClick={(i) => setPickSlot(i)}
            />
          </div>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1.5">Banquillo <span className="font-normal normal-case">(toca para añadir o quitar)</span></p>
            <div className="flex flex-wrap gap-1">
              {benchCandidates.map(p => {
                const on = bench.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => toggleBench(p.id)}
                    className={`text-[11px] px-2 py-1 rounded-full border ${on ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
                    style={on ? { background: "var(--naranja)" } : {}}>
                    {p.first_name?.[0]}. {p.last_name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Planes ── */}
        <div className="space-y-4">
          <Plan title="⚔️ Plan de partido en ataque" hint="Salida de balón, progresión, zonas de ataque, movimientos clave, finalización…" value={planAttack} onChange={setPlanAttack}
            placeholder="Ej: Salida 3+1 con el mediocentro, progresar por banda derecha, extremos cerrando para el desmarque del 9…" />
          <Plan title="🛡️ Plan de partido en defensa" hint="Bloque, altura de presión, referencias de marcaje, transiciones defensivas…" value={planDefense} onChange={setPlanDefense}
            placeholder="Ej: Bloque medio 4-4-2, presión tras pase atrás, vigilar al 10 rival en el rechace, repliegue rápido…" />
        </div>
      </div>

      {/* ── Análisis del rival ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="text-sm font-bold text-gray-900">🔍 Análisis del rival{event?.opponent ? ` · ${event.opponent}` : ""}</p>
        <div className="grid md:grid-cols-3 gap-3">
          {[["strengths", "Puntos fuertes", "Qué hacen bien, cómo atacan…"], ["weaknesses", "Puntos débiles", "Dónde les podemos hacer daño…"], ["keys", "Jugadores clave", "Dorsal, perfil, cómo frenarlo…"]].map(([k, label, ph]) => (
            <div key={k} className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
              <Textarea rows={5} value={rival[k]} onChange={e => setRival(r => ({ ...r, [k]: e.target.value }))} className="border-gray-200 text-sm" placeholder={ph} />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Comentarios</p>
          <Textarea rows={3} value={rival.notes} onChange={e => setRival(r => ({ ...r, notes: e.target.value }))} className="border-gray-200 text-sm" placeholder="Sistema habitual, estilo, balón parado, resultados recientes…" />
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
        onPick={(p) => { setSlot(pickSlot, p.id); setBench(b => b.filter(x => x !== p.id)); setPickSlot(null); }}
        onClear={() => { setSlot(pickSlot, null); setPickSlot(null); }}
      />
    </div>
  );
}
