import React from "react";
import { LEVELS, getPositionList } from "@/lib/playerPositions";

const POSITION_FULL = {
  portero: "Portero", lateral: "Lateral", central: "Central", libre: "Libre",
  mediocentro: "Mediocentro", interior: "Interior", delantero_centro: "Delantero", extremo: "Extremo",
};
const LATERALITY_LABELS = { diestro: "Diestro", zurdo: "Zurdo", ambidiestro: "Ambidiestro" };

// Coordenadas base en el lado izquierdo (perfil del zurdo); en diestro/ambidiestro/sin dato se espejan
// laterales, extremos e interiores al lado derecho, para ponerlos siempre en su perfil natural.
const COORDS = {
  portero: { x: 50, y: 88 }, central: { x: 50, y: 68 }, lateral: { x: 22, y: 72 },
  libre: { x: 50, y: 78 }, mediocentro: { x: 50, y: 48 }, interior: { x: 30, y: 38 },
  extremo: { x: 14, y: 25 }, delantero_centro: { x: 50, y: 18 },
};
const MIRROR = new Set(["lateral", "extremo", "interior"]);
const coords = (pos, lat) => {
  const c = COORDS[pos];
  if (!c) return null;
  return lat !== "zurdo" && MIRROR.has(pos) ? { x: 100 - c.x, y: c.y } : c;
};

const GREEN = "#22c55e";
const ORANGE = "#f59e0b";

export function MiniPitch({ player, position, secondaryPosition, laterality }) {
  const list = player ? getPositionList(player) : [{ position, level: "natural" }, ...(secondaryPosition ? [{ position: secondaryPosition, level: "secundaria" }] : [])];
  const lat = player ? player.laterality : laterality;
  const pts = list.map((x) => ({ ...x, c: coords(x.position, lat) })).filter((x) => x.c);
  if (!pts.length) return null;
  const order = { competente: 0, secundaria: 1, natural: 2 };
  pts.sort((a, b) => order[a.level] - order[b.level]);
  const title = list.map((x) => `${POSITION_FULL[x.position] || x.position} (${LEVELS[x.level].label})`).join(" · ");
  const line = "rgba(255,255,255,0.45)";
  return (
    <svg viewBox="0 0 100 150" width="40" height="60" role="img" aria-label={title} style={{ display: "block" }}>
      <title>{title}</title>
      <rect x="1" y="1" width="98" height="148" rx="3" fill="rgba(255,255,255,0.07)" stroke={line} strokeWidth="2" />
      <line x1="1" y1="75" x2="99" y2="75" stroke={line} strokeWidth="2" />
      <circle cx="50" cy="75" r="14" fill="none" stroke={line} strokeWidth="2" />
      <rect x="25" y="1" width="50" height="25" fill="none" stroke={line} strokeWidth="2" />
      <rect x="25" y="124" width="50" height="25" fill="none" stroke={line} strokeWidth="2" />
      {pts.map((x) => (
        <circle key={x.position} cx={x.c.x} cy={(x.c.y / 100) * 150} r={x.level === "natural" ? 10 : 9} fill={LEVELS[x.level].color} stroke="#fff" strokeWidth={x.level === "natural" ? 2 : 1.5} />
      ))}
    </svg>
  );
}

function Foot({ side, active, inactive = "rgba(255,255,255,0.28)" }) {
  // Planta del pie: el dedo gordo mira hacia dentro (derecha en el pie izquierdo, izquierda en el derecho).
  const dir = side === "left" ? 1 : -1;
  const color = active ? GREEN : inactive;
  const toes = [
    { x: 7 * dir, y: 2, r: 3.2 }, { x: 2 * dir, y: -1, r: 2.2 }, { x: -2 * dir, y: -0.5, r: 2 },
    { x: -5.5 * dir, y: 1, r: 1.8 }, { x: -8.5 * dir, y: 3, r: 1.6 },
  ];
  return (
    <svg viewBox="-14 -6 28 44" width="18" height="28" aria-hidden="true">
      <g fill={color}>
        <path d={`M ${-8 * dir} 8 C ${-9 * dir} 16 ${-6 * dir} 30 ${-1 * dir} 36 C ${4 * dir} 40 ${9 * dir} 36 ${9 * dir} 28 C ${9 * dir} 20 ${10 * dir} 14 ${9 * dir} 8 C ${8 * dir} 4 ${-7 * dir} 4 ${-8 * dir} 8 Z`} />
        {toes.map((t, i) => <circle key={i} cx={t.x} cy={t.y} r={t.r} />)}
      </g>
    </svg>
  );
}

export function FootIndicator({ laterality, light = false }) {
  if (!laterality) return null;
  const left = laterality === "zurdo" || laterality === "ambidiestro";
  const right = laterality === "diestro" || laterality === "ambidiestro";
  return (
    <div className="flex flex-col items-center" title={LATERALITY_LABELS[laterality]}>
      <div className="flex gap-1 items-end">
        <Foot side="left" active={left} inactive={light ? "#d1d5db" : undefined} />
        <Foot side="right" active={right} inactive={light ? "#d1d5db" : undefined} />
      </div>
      <span className={`text-[9px] leading-none mt-1 ${light ? "text-gray-500" : "text-white/60"}`}>{LATERALITY_LABELS[laterality]}</span>
    </div>
  );
}
