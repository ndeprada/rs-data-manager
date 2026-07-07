import React, { useState, useEffect, useRef, useCallback } from "react";
import { Save, RotateCcw } from "lucide-react";
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
function DraggableField({ players, positions, onPositionsChange }) {
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

  const handlePointerDown = (e, idx) => {
    e.preventDefault();
    draggingIdx.current = idx;
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

  const handlePointerUp = () => {
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
        const player = players[i];
        if (!pos) return null;
        const cx = pos[0] / 100 * W;
        const cy = pos[1] / 100 * H;
        const name = player?.last_name || `${i + 1}`;
        return (
          <g
            key={i}
            onPointerDown={e => handlePointerDown(e, i)}
            style={{ cursor: "grab" }}
          >
            {/* Shadow */}
            <circle cx={cx + 1} cy={cy + 2} r="17" fill="rgba(0,0,0,0.25)" />
            {/* Token */}
            <circle cx={cx} cy={cy} r="17" fill="var(--granate)" stroke="white" strokeWidth="2.5" />
            {/* Number */}
            {player?.jersey_number ? (
              <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="900" fill="white">
                {player.jersey_number}
              </text>
            ) : (
              <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="rgba(255,255,255,0.7)">
                {i + 1}
              </text>
            )}
            {/* Name label */}
            <text x={cx} y={cy + 27} textAnchor="middle" fontSize="8" fontWeight="700" fill="white" opacity="0.95"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
              {name.length > 10 ? name.slice(0, 10) + "…" : name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Tab ────────────────────────────────────────────
export default function TacticaTab({ event, players, convocadoIds, starterIds, footballFormat }) {
  const isF7 = footballFormat === "f7";
  const formations = isF7 ? FORMATIONS_F7 : FORMATIONS_F11;
  const validDefault = formations[0];

  const [formation, setFormation] = useState(validDefault);
  const [positions, setPositions] = useState(null); // null = use default
  const [planPropio, setPlanPropio] = useState("");
  const [planRival, setPlanRival] = useState("");
  const [saved, setSaved] = useState(false);

  const starters = players.filter(p => starterIds.includes(p.id));
  const suplentes = players.filter(p => convocadoIds.includes(p.id) && !starterIds.includes(p.id));

  const validFormation = formations.includes(formation) ? formation : validDefault;
  const defaultPositions = FORMATION_POSITIONS[validFormation] || [];
  const currentPositions = positions || defaultPositions;

  // Reset positions when formation changes
  const handleFormationChange = (f) => {
    setFormation(f);
    setPositions(null);
  };

  const handleResetPositions = () => setPositions(null);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`tactica_${event?.id}`);
    if (stored) {
      try {
        const { formation: f, positions: pos, planPropio: p, planRival: r } = JSON.parse(stored);
        if (formations.includes(f)) { setFormation(f); }
        if (pos) setPositions(pos);
        setPlanPropio(p || "");
        setPlanRival(r || "");
      } catch (_) {}
    }
  }, [event?.id]);

  const handleSave = () => {
    localStorage.setItem(`tactica_${event?.id}`, JSON.stringify({
      formation: validFormation, positions: currentPositions, planPropio, planRival,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Campo táctico ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-gray-900">Once inicial</p>
            <div className="flex items-center gap-2">
              <Select value={validFormation} onValueChange={handleFormationChange}>
                <SelectTrigger className="w-32 h-8 text-xs border-gray-200"><SelectValue /></SelectTrigger>
                <SelectContent>{formations.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
              <button onClick={handleResetPositions} title="Restablecer posiciones" className="p-1.5 rounded border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {starters.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Define los titulares en la pestaña Convocatoria</p>
          ) : (
            <>
              <p className="text-[10px] text-gray-400 text-center">Arrastra los jugadores para reposicionarlos</p>
              <div style={{ maxWidth: 320, margin: "0 auto", aspectRatio: "300/420" }}>
                <DraggableField
                  players={starters}
                  positions={currentPositions.slice(0, starters.length)}
                  onPositionsChange={(newPos) => {
                    const full = [...currentPositions];
                    newPos.forEach((p, i) => { full[i] = p; });
                    setPositions(full);
                  }}
                />
              </div>
            </>
          )}

          {/* Titulares + suplentes list */}
          {starters.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-gray-100">
              <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">Titulares</p>
              <div className="grid grid-cols-2 gap-1">
                {starters.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-50 text-xs">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-black shrink-0" style={{ background: "var(--granate)" }}>{i + 1}</span>
                    <span className="font-medium truncate">{p.first_name?.[0]}. {p.last_name}</span>
                    {p.jersey_number && <span className="text-gray-400 ml-auto text-[10px]">#{p.jersey_number}</span>}
                  </div>
                ))}
              </div>
              {suplentes.length > 0 && (
                <>
                  <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mt-2 mb-1">Suplentes</p>
                  <div className="grid grid-cols-2 gap-1">
                    {suplentes.map(p => (
                      <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-orange-50 text-xs">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-black shrink-0" style={{ background: "var(--naranja)" }}>S</span>
                        <span className="font-medium truncate">{p.first_name?.[0]}. {p.last_name}</span>
                        {p.jersey_number && <span className="text-gray-400 ml-auto text-[10px]">#{p.jersey_number}</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Plan de partido ── */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <p className="text-sm font-bold text-gray-900">🎯 Nuestro plan de partido</p>
            <p className="text-[10px] text-gray-400">Estrategia, sistemas, movimientos clave, pressing…</p>
            <Textarea
              value={planPropio}
              onChange={e => setPlanPropio(e.target.value)}
              rows={7}
              className="border-gray-200 text-sm"
              placeholder="Ej: Salir en 4-3-3 con presión alta. Aprovechar la banda derecha con el lateral. Saques de esquina en corto…"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <p className="text-sm font-bold text-gray-900">🔍 Análisis del rival</p>
            <p className="text-[10px] text-gray-400">Puntos fuertes/débiles del rival, cómo neutralizarlos…</p>
            <Textarea
              value={planRival}
              onChange={e => setPlanRival(e.target.value)}
              rows={7}
              className="border-gray-200 text-sm"
              placeholder="Ej: Rival muy fuerte en transiciones. Delantero rápido por la derecha. Tapar el mediocampista organizador…"
            />
          </div>

          <Button onClick={handleSave} className="w-full text-white" style={{ background: "var(--granate)" }}>
            <Save className="w-4 h-4 mr-2" />{saved ? "¡Guardado!" : "Guardar plan de partido"}
          </Button>
        </div>
      </div>
    </div>
  );
}