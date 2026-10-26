import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeftRight, ChevronsUp, Eye, GripVertical, Plus, Target } from "lucide-react";
import { F7_FIELD } from "@/lib/pitchGeometry";
import { LEAVE, POSITION_LABEL, passText, statusLabel, zoneTitle } from "@/lib/squadPlan";
import { CHIP, DOT, LEAVE_TAG, PASS_TAG } from "./squadPlanUi";

// Campo de la planificación: un campo a escala (F11 105 × 68 m, F7 65 × 45 m) con todos los puestos siempre a la vista. En pantallas anchas va
// en horizontal (portería a la izquierda, ataque a la derecha, izquierda del equipo arriba); en estrechas, en vertical (ataque arriba, izquierda
// del equipo a la izquierda). Cada puesto crece con su gente (nombres completos, sin cortar ni «+N más») y se puede arrastrar a cualquiera a otro.
const HORIZONTAL_FROM = 880; // ancho (px) a partir del cual el campo se pone en horizontal
const LANE = { l: 0, c: 1, r: 2 };
// Anchos de las 6 líneas en horizontal (portero, libre, defensas, medios, mediapunta, delanteros): los medios quedan a caballo de la línea de medio campo
const COLS_H = "minmax(0,12fr) minmax(0,12fr) minmax(0,21fr) minmax(0,21fr) minmax(0,14fr) minmax(0,20fr)";
const MIN_H_WIDTH = 780; // el campo en horizontal nunca es más estrecho que esto (más estrecho, los nombres no caben)
const TOP_SPACE = 270; // alto (px) que ocupan encima del campo el selector de equipo y el resumen; el resto de la pantalla es para el campo
const COMPACT_BELOW = 520; // por debajo (móvil) las fichas se compactan: nombre arriba y año/etiquetas debajo

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const LINE = "rgba(255,255,255,0.78)";

/** Campo a escala dibujado en metros (siempre en horizontal) y girado si va en vertical. Las líneas no se deforman al estirarse (non-scaling-stroke). */
function PitchSvg({ isF7, vertical }) {
  const uid = useId().replace(/:/g, "");
  const L = isF7 ? 65 : 105, W = isF7 ? 45 : 68, cy = W / 2;
  const stripes = isF7 ? 10 : 14;
  const m = 0.5;
  const st = { fill: "none", stroke: LINE, strokeWidth: 2, vectorEffect: "non-scaling-stroke" };
  const spot = (x) => <circle cx={x} cy={cy} r={0.45} fill={LINE} />;
  const F = F7_FIELD;
  const area = isF7 ? { w: F.areaWidth, d: F.areaDepth } : { w: 40.32, d: 16.5 };
  const goalArea = isF7 ? { w: F.goalAreaWidth, d: F.goalAreaDepth } : { w: 18.32, d: 5.5 };
  const spotAt = isF7 ? F.penaltySpot : 11;
  const circleR = isF7 ? F.centreRadius : 9.15;
  const goalW = isF7 ? F.goalWidth : 7.32;
  const arcDy = isF7 ? 0 : Math.sqrt(9.15 ** 2 - (area.d - spotAt) ** 2); // el arco del área solo en F11
  const vb = vertical ? `0 0 ${W} ${L}` : `0 0 ${L} ${W}`;
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={vb} preserveAspectRatio="none" aria-hidden="true" data-testid="plan-pitch-svg">
      <defs>
        <radialGradient id={`vig${uid}`} cx="50%" cy="50%" r="75%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
        </radialGradient>
      </defs>
      <g transform={vertical ? `matrix(0 -1 1 0 0 ${L})` : undefined}>
        {Array.from({ length: stripes }, (_, i) => (
          <rect key={i} x={(i * L) / stripes} y={0} width={L / stripes + 0.02} height={W} fill={i % 2 ? "#47935c" : "#3b7f4e"} />
        ))}
        <rect x={m} y={m} width={L - 2 * m} height={W - 2 * m} {...st} />
        <line x1={L / 2} y1={m} x2={L / 2} y2={W - m} {...st} />
        <circle cx={L / 2} cy={cy} r={circleR} {...st} />
        {spot(L / 2)}
        {/* Áreas, puntos de penalti, arcos y porterías (la de la derecha es la de la izquierda reflejada) */}
        {[0, 1].map((side) => {
          const x0 = side ? L - m : m, dir = side ? -1 : 1;
          const rx = (d) => x0 + dir * d;
          return (
            <g key={side}>
              <rect x={side ? rx(area.d) : x0} y={cy - area.w / 2} width={area.d} height={area.w} {...st} />
              <rect x={side ? rx(goalArea.d) : x0} y={cy - goalArea.w / 2} width={goalArea.d} height={goalArea.w} {...st} />
              {spot(side ? L - m - spotAt : m + spotAt)}
              {arcDy > 0 && <path d={`M ${rx(area.d)} ${cy - arcDy} A ${circleR} ${circleR} 0 0 ${side ? 0 : 1} ${rx(area.d)} ${cy + arcDy}`} {...st} />}
              <rect x={side ? L - m - 1.2 : m} y={cy - goalW / 2} width={1.2} height={goalW} fill="rgba(255,255,255,0.14)" stroke={LINE} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {isF7 && (
          <g stroke={LINE} strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke">
            <line x1={m + F.offsideLine} y1={m} x2={m + F.offsideLine} y2={W - m} vectorEffect="non-scaling-stroke" />
            <line x1={L - m - F.offsideLine} y1={m} x2={L - m - F.offsideLine} y2={W - m} vectorEffect="non-scaling-stroke" />
          </g>
        )}
        {[`M ${m} ${m + 1} A 1 1 0 0 0 ${m + 1} ${m}`, `M ${L - m - 1} ${m} A 1 1 0 0 0 ${L - m} ${m + 1}`,
          `M ${L - m} ${W - m - 1} A 1 1 0 0 0 ${L - m - 1} ${W - m}`, `M ${m + 1} ${W - m} A 1 1 0 0 0 ${m} ${W - m - 1}`].map((d) => <path key={d} d={d} {...st} />)}
      </g>
      <rect x="0" y="0" width={vertical ? W : L} height={vertical ? L : W} fill={`url(#vig${uid})`} />
    </svg>
  );
}

/** Una persona del plan: nombre completo (se parte por palabras si no cabe), estado por color y etiquetas (baja del club/propia, lesión, puesto cambiado). */
function Chip({ item, compact, dragging, onOpen, onGrab, wasDrag }) {
  const sale = item.status === "sale";
  const leave = sale && item.leave ? LEAVE[item.leave] : null;
  const out = item.pass === "out"; // pasa a otro equipo: se ve en su puesto pero no se coloca desde aquí
  const tip = [item.name, item.year, statusLabel(item), item.injured ? "lesionado" : null,
    item.moved ? `puesto cambiado${item.naturalPosition ? ` (en su ficha: ${POSITION_LABEL[item.naturalPosition]})` : ""}` : null].filter(Boolean).join(" · ");
  const open = () => { if (!wasDrag()) onOpen(item); };
  const mark = item.kind === "scout" ? (
    item.status === "seguido" ? <Eye className="w-3 h-3 shrink-0 text-indigo-600" aria-label="Jugador seguido" /> : <Target className="w-3 h-3 shrink-0 text-sky-600" aria-label="Objetivo de scouting" />
  ) : <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[item.status]}`} />;
  const tags = (leave || item.pass || item.injured || item.moved) && (
    <>
      {item.pass && <span data-testid={`pass-${item.key}`} className={`rounded px-1 text-[9px] font-extrabold uppercase leading-[14px] tracking-wide ${PASS_TAG}`}>{passText(item)}</span>}
      {leave && <span data-testid={`leave-${item.key}`} className={`rounded px-1 text-[9px] font-extrabold uppercase leading-[14px] tracking-wide ${LEAVE_TAG}`}>{leave.label}</span>}
      {item.injured && <span className="text-[10px] font-bold leading-none text-red-700" aria-label="lesionado">✚ lesionado</span>}
      {item.moved && <ArrowLeftRight className="w-3 h-3 text-black/45" aria-label="puesto cambiado" />}
    </>
  );
  const nameCls = `block text-[11px] leading-[1.15] font-semibold break-words ${sale ? "line-through decoration-red-700/70" : ""}`;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(item); } }}
      onPointerDown={(e) => { if (!out && (e.pointerType === "mouse" || e.target.closest?.("[data-grip]"))) onGrab(e, item); }}
      data-testid={`chip-${item.key}`}
      data-status={item.status}
      title={tip}
      className={`flex items-stretch gap-0.5 rounded-md border ${compact ? "min-h-[30px] pr-1" : "min-h-[22px] pr-1"} text-left shadow-sm cursor-pointer select-none ${CHIP[item.status] || CHIP.continua} ${dragging ? "opacity-35" : ""}`}
    >
      <span data-grip="" aria-hidden="true" className={`shrink-0 flex items-center justify-center text-black/30 ${out ? "invisible" : "touch-none cursor-grab"} ${compact ? "w-3.5" : "w-3 [@media(hover:hover)_and_(pointer:fine)]:hidden"}`}><GripVertical className="w-3.5 h-3.5" /></span>
      {compact ? (
        <span className="flex-1 min-w-0 py-1">
          <span className={nameCls}>{item.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] leading-none tabular-nums opacity-90">
            {mark}{item.year && <span className="opacity-70">{item.year}</span>}{tags}
          </span>
        </span>
      ) : (
        <>
          <span className="flex-1 min-w-0 flex items-start gap-1 py-[3px] pl-1 [@media(hover:none)]:pl-0.5">
            <span className="mt-[3px] shrink-0">{mark}</span>
            <span className="min-w-0">
              <span className={nameCls}>{item.name}</span>
              {tags && <span className="mt-px flex flex-wrap items-center gap-1">{tags}</span>}
            </span>
          </span>
          {item.year && <span className="shrink-0 self-center text-[10px] tabular-nums opacity-70">{item.year}</span>}
        </>
      )}
    </div>
  );
}

function ZoneCell({ zone, vertical, compact, hot, dragging, draggingKey, onZone, onAdd, onItem, onGrab, wasDrag }) {
  const empty = zone.items.length === 0;
  const lane = LANE[zone.lane];
  const place = vertical ? { gridRow: 6 - zone.line, gridColumn: lane + 1 } : { gridColumn: zone.line + 1, gridRow: lane + 1 };
  const ring = hot ? "ring-2 ring-white" : zone.need ? "ring-2 ring-fuchsia-400" : "";
  return (
    <div
      data-zone-drop={zone.key}
      data-testid={`zone-cell-${zone.key}`}
      className={`min-w-0 flex flex-col justify-center rounded-xl transition-colors ${hot ? "bg-white/25" : dragging ? "bg-white/10" : ""}`}
      style={place}
    >
      <div
        data-testid={`zone-${zone.key}`}
        data-need={zone.need ? "1" : undefined}
        className={`rounded-lg border flex flex-col ${compact ? "gap-1 p-0.5" : "gap-0.5 p-[3px]"} min-w-0 ${empty ? "border-dashed border-white/45 bg-black/30" : "border-white/30 bg-black/35"} ${ring}`}
      >
        <div className="flex items-center gap-1 min-w-0">
          <button type="button" onClick={() => onZone(zone)} data-testid={`zone-head-${zone.key}`} className="flex-1 min-w-0 flex items-center gap-1 text-left">
            <span className={`truncate font-extrabold uppercase text-white [text-shadow:0_1px_2px_rgba(0,0,0,.65)] ${compact ? "text-[9px] tracking-normal" : "text-[10px] tracking-wide"}`}>{vertical ? zone.label : zoneTitle(zone)}</span>
            {!empty && <span className="shrink-0 rounded bg-black/45 px-1 text-[10px] font-bold leading-4 tabular-nums text-white" data-testid={`zone-count-${zone.key}`}>{zone.items.length}</span>}
          </button>
          {!compact && (
            <button type="button" onClick={() => onAdd(zone)} aria-label={`Añadir de scouting en ${zoneTitle(zone)}`} data-testid={`zone-add-${zone.key}`} className="shrink-0 w-[18px] h-[18px] rounded bg-white/20 text-white flex items-center justify-center hover:bg-white/35">
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
        {zone.need && (
          <button type="button" onClick={() => onZone(zone)} data-testid={`zone-need-${zone.key}`} className="w-full rounded bg-fuchsia-600 px-1.5 py-0.5 text-left text-[10px] font-bold leading-tight text-white flex items-start gap-1">
            <ChevronsUp className="w-3 h-3 shrink-0 mt-[1px]" />
            <span className="min-w-0 break-words">A reforzar{zone.need.note ? ` · ${zone.need.note}` : ""}</span>
          </button>
        )}
        {zone.items.map((it) => (
          <Chip key={it.key} item={it} compact={compact} dragging={draggingKey === it.key} onOpen={onItem} onGrab={onGrab} wasDrag={wasDrag} />
        ))}
      </div>
    </div>
  );
}

/** zones: todos los puestos de `buildPlan`; drag: {item, over} mientras se arrastra a alguien. */
export default function SquadPitch({ zones, isF7, drag, onZone, onAdd, onItem, onGrab, wasDrag }) {
  const [wrapRef, avail] = useWidth(); // ancho disponible: decide la orientación
  const vertical = avail > 0 && avail < HORIZONTAL_FROM;
  const compact = vertical && avail < COMPACT_BELOW;
  const L = isF7 ? 65 : 105, W = isF7 ? 45 : 68;
  const ratio = vertical ? L / W : W / L; // alto mínimo = ancho × ratio: el campo nunca es más bajo que un campo de verdad
  // En horizontal el campo no pasa de lo que cabe en la altura de la pantalla (así se ve entero sin bajar): ancho = (alto − lo de arriba) / proporción
  const fit = vertical ? undefined : `max(${MIN_H_WIDTH}px, calc((100vh - ${TOP_SPACE}px) / ${(ratio + 0.02).toFixed(3)}))`;
  return (
    <div ref={wrapRef} data-testid="plan-pitch-wrap">
      <div data-testid="plan-pitch" data-orient={vertical ? "v" : "h"} data-format={isF7 ? "f7" : "f11"} className={`mx-auto rounded-2xl shadow-sm ${compact ? "p-1" : "p-1.5 sm:p-2"}`} style={{ background: "#2c6a3f", maxWidth: fit }}>
        <div className="relative overflow-hidden rounded-md" style={{ containerType: "inline-size" }}>
          <PitchSvg isF7={isF7} vertical={vertical} />
          <div
            className={`relative grid ${compact ? "gap-1 p-1" : "gap-1 p-1"}`}
            style={{
              gridTemplateColumns: vertical ? "repeat(3, minmax(0, 1fr))" : COLS_H,
              gridTemplateRows: vertical ? "repeat(6, auto)" : "repeat(3, 1fr)", // en vertical cada línea mide lo que ocupa su gente y el resto se reparte
              minHeight: `calc(100cqw * ${ratio.toFixed(4)})`,
            }}
          >
            {zones.map((z) => (
              <ZoneCell
                key={z.key} zone={z} vertical={vertical} compact={compact} hot={drag?.over === z.key} dragging={!!drag} draggingKey={drag?.item?.key}
                onZone={onZone} onAdd={onAdd} onItem={onItem} onGrab={onGrab} wasDrag={wasDrag}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
