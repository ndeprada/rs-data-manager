import React from "react";
import { Star } from "lucide-react";
import { LEVELS, getPositionList, getPitchXY, getPitchMarkers } from "@/lib/playerPositions";
import { weakFootColor, weakSide, weakFootText } from "@/lib/weakFoot";
import { useT, msg } from "@/i18n";

const POSITION_FULL = {
  portero: msg("Portero"), lateral: msg("Lateral"), central: msg("Central"), libre: msg("Libre"),
  mediocentro: msg("Mediocentro"), interior: msg("Interior"), mediapunta: msg("Mediapunta"), delantero_centro: msg("Delantero"), extremo: msg("Extremo"),
};
const LATERALITY_LABELS = { diestro: msg("Diestro"), zurdo: msg("Zurdo"), ambidiestro: msg("Ambidiestro") };

// Coordenadas base en el lado izquierdo (perfil del zurdo); en diestro/ambidiestro/sin dato se espejan
// laterales, extremos e interiores al lado derecho, para ponerlos siempre en su perfil natural.
const COORDS = {
  portero: { x: 50, y: 88 }, central: { x: 50, y: 68 }, lateral: { x: 22, y: 72 },
  libre: { x: 50, y: 78 }, mediocentro: { x: 50, y: 48 }, interior: { x: 30, y: 38 }, mediapunta: { x: 50, y: 30 },
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
  const t = useT();
  const list = player ? getPositionList(player) : [{ position, level: "natural" }, ...(secondaryPosition ? [{ position: secondaryPosition, level: "secundaria" }] : [])];
  const lat = player ? player.laterality : laterality;
  const pts = player ? getPitchMarkers(player, lat) : list.map((x) => ({ ...x, c: getPitchXY(x.position, x.role, lat) })).filter((x) => x.c);
  if (!pts.length) return null;
  const order = { competente: 0, secundaria: 1, natural: 2 };
  pts.sort((a, b) => order[a.level] - order[b.level]);
  const title = list.map((x) => `${POSITION_FULL[x.position] ? t(POSITION_FULL[x.position]) : x.position} (${t(LEVELS[x.level].label)})`).join(" · ");
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
        <circle key={x.position + (x.role||"") + x.c.x} cx={x.c.x} cy={(x.c.y / 100) * 150} r={x.level === "natural" ? 10 : 9} fill={LEVELS[x.level].color} stroke="#fff" strokeWidth={x.level === "natural" ? 2 : 1.5} />
      ))}
    </svg>
  );
}

function Foot({ side, active, tint, inactive = "rgba(255,255,255,0.28)" }) {
  // Planta del pie: el dedo gordo mira hacia dentro (derecha en el pie izquierdo, izquierda en el derecho).
  // tint = color de la valoración de la pierna no hábil (verde → rojo); manda sobre el resto.
  const dir = side === "left" ? 1 : -1;
  const color = tint || (active ? GREEN : inactive);
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

// Cinco estrellas coloreadas según el dominio de la pierna no hábil (como el «pie malo» del FIFA)
function WeakStars({ rating, light }) {
  const color = weakFootColor(rating);
  const empty = light ? "#d1d5db" : "rgba(255,255,255,0.3)";
  return (
    <div className="flex gap-px mt-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className="w-2.5 h-2.5" strokeWidth={1.5} style={i <= (rating || 0) ? { color, fill: color } : { color: empty, fill: "none" }} />
      ))}
    </div>
  );
}

// weak = undefined → solo la lateralidad (como siempre; es lo que ve el jugador).
// weak = { rating, editable } → muestra también la pierna no hábil: el pie malo toma el color de la valoración y
// van debajo las estrellas. Sin valorar solo se dibujan las estrellas vacías si se puede editar (para invitar a rellenarlas).
export function FootIndicator({ laterality, light = false, weak }) {
  const t = useT();
  if (!laterality) return null;
  const left = laterality === "zurdo" || laterality === "ambidiestro";
  const right = laterality === "diestro" || laterality === "ambidiestro";
  const rating = weak?.rating || null;
  const side = weakSide(laterality);
  const tint = (s) => (rating && (laterality === "ambidiestro" || s === side) ? weakFootColor(rating) : null);
  const title = t(LATERALITY_LABELS[laterality]) + (weak && (rating || weak.editable) ? ` · ${weakFootText(rating, t)}` : "");
  return (
    <div className="flex flex-col items-center" title={title}>
      <div className="flex gap-1 items-end">
        <Foot side="left" active={left} tint={tint("left")} inactive={light ? "#d1d5db" : undefined} />
        <Foot side="right" active={right} tint={tint("right")} inactive={light ? "#d1d5db" : undefined} />
      </div>
      {weak && (rating || weak.editable) && <WeakStars rating={rating} light={light} />}
      <span className={`text-[9px] leading-none mt-1 ${light ? "text-gray-500" : "text-white/60"}`}>{t(LATERALITY_LABELS[laterality])}</span>
    </div>
  );
}
