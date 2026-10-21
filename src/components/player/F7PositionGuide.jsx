import React from "react";
import { f7Info, F7_PRINCIPLE } from "@/lib/f7Positions";
import { getPositionList, LEVELS } from "@/lib/playerPositions";

// Qué cualidades pide una posición de fútbol 7 y qué contenidos se trabajan en ella (TFM, apartado 4.5.2)
export function F7PositionDetail({ position, className = "" }) {
  const info = f7Info(position);
  if (!info) return null;
  return (
    <div className={`rounded-lg bg-amber-50/70 border border-amber-100 px-3 py-2 space-y-2 ${className}`}>
      <p className="text-xs text-gray-700 leading-snug"><strong className="text-gray-900">¿Por qué ubicamos aquí al jugador?</strong> {info.why}</p>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Contenidos que favorece</p>
        <div className="flex flex-wrap gap-1">
          {info.contents.map((c) => <span key={c} className="px-2 py-0.5 rounded-full bg-white border border-amber-200 text-[11px] text-gray-700">{c}</span>)}
        </div>
      </div>
    </div>
  );
}

// Posiciones de fútbol 7 del jugador (la natural abierta, las demás plegadas) con su descripción y contenidos
export default function F7PositionGuide({ player, title = "Posiciones en fútbol 7", className = "" }) {
  const seen = new Set();
  const list = getPositionList(player).filter((x) => f7Info(x.position) && !seen.has(x.position) && seen.add(x.position));
  if (list.length === 0) return null;
  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{title}</p>
      {list.map((x, i) => (
        <details key={x.position} open={i === 0} className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800 select-none">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: LEVELS[x.level].color }} />
            {f7Info(x.position).label}
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: LEVELS[x.level].ink }}>{LEVELS[x.level].label}</span>
          </summary>
          <F7PositionDetail position={x.position} className="mt-1.5" />
        </details>
      ))}
      <p className="text-[11px] text-gray-400 leading-snug">{F7_PRINCIPLE}</p>
    </div>
  );
}
