import React from "react";
import { Phone, Mail, Calendar, Zap, MapPin, Hash } from "lucide-react";

const POSITION_LABELS = {
  portero: "POR", lateral: "LAT", central: "CT", libre: "LIB",
  mediocentro: "MC", interior: "INT", delantero_centro: "DC", extremo: "EXT",
};
const POSITION_FULL = {
  portero: "Portero", lateral: "Lateral", central: "Central", libre: "Libre",
  mediocentro: "Mediocentro", interior: "Interior", delantero_centro: "Delantero", extremo: "Extremo"
};
const LATERALITY_LABELS = { diestro: "Diestro", zurdo: "Zurdo", ambidiestro: "Ambidiestro" };

// Base coords (right-footed / default). X is mirrored for zurdo.
const POSITION_COORDS_BASE = {
  portero:          { x: 50, y: 88 },
  central:          { x: 50, y: 68 },
  lateral:          { x: 22, y: 72 },
  libre:            { x: 50, y: 78 },
  mediocentro:      { x: 50, y: 48 },
  interior:         { x: 30, y: 38 },
  extremo:          { x: 14, y: 25 },
  delantero_centro: { x: 50, y: 18 },
};

// Positions that should mirror X for left-footed players
const LATERALITY_MIRROR_POSITIONS = new Set(["lateral", "extremo", "interior"]);

function getPositionCoords(position, laterality) {
  const base = POSITION_COORDS_BASE[position];
  if (!base) return base;
  if (laterality === "zurdo" && LATERALITY_MIRROR_POSITIONS.has(position)) {
    return { x: 100 - base.x, y: base.y };
  }
  return base;
}

function FootballField({ position, secondaryPosition, laterality }) {
  const primary = getPositionCoords(position, laterality);
  const secondary = secondaryPosition ? getPositionCoords(secondaryPosition, laterality) : null;

  return (
    <svg viewBox="0 0 200 300" className="w-full h-full" style={{ display: "block" }}>
      {/* Base grass gradient */}
      <defs>
        <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a5c28" />
          <stop offset="100%" stopColor="#1e6b2e" />
        </linearGradient>
        <radialGradient id="primaryGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6b1f28" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#6b1f28" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="200" height="300" fill="url(#grassGrad)" rx="4" />

      {/* Stripes */}
      {[0,1,2,3,4].map(i => (
        <rect key={i} x="0" y={i * 60} width="200" height="30" fill="rgba(255,255,255,0.025)" />
      ))}

      {/* Pitch markings */}
      <rect x="8" y="10" width="184" height="280" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
      <line x1="8" y1="150" x2="192" y2="150" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
      <circle cx="100" cy="150" r="28" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
      <circle cx="100" cy="150" r="2" fill="rgba(255,255,255,0.55)" />

      {/* Penalty areas */}
      <rect x="50" y="10" width="100" height="50" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
      <rect x="72" y="10" width="56" height="22" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
      <rect x="50" y="240" width="100" height="50" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
      <rect x="72" y="268" width="56" height="22" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />

      {/* Goals */}
      <rect x="82" y="5" width="36" height="7" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
      <rect x="82" y="288" width="36" height="7" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />

      {/* Penalty spots */}
      <circle cx="100" cy="40" r="1.8" fill="rgba(255,255,255,0.55)" />
      <circle cx="100" cy="260" r="1.8" fill="rgba(255,255,255,0.55)" />

      {/* Secondary position */}
      {secondary && (
        <>
          <circle cx={secondary.x / 100 * 200} cy={secondary.y / 100 * 300} r="13"
            fill="rgba(230,126,34,0.2)" stroke="rgba(230,126,34,0.5)" strokeWidth="1.5" strokeDasharray="3 2" />
          <circle cx={secondary.x / 100 * 200} cy={secondary.y / 100 * 300} r="5"
            fill="#e67e22" opacity="0.85" />
        </>
      )}

      {/* Primary position glow */}
      {primary && (
        <>
          <circle cx={primary.x / 100 * 200} cy={primary.y / 100 * 300} r="22"
            fill="rgba(107,31,40,0.25)" />
          <circle cx={primary.x / 100 * 200} cy={primary.y / 100 * 300} r="13"
            fill="rgba(107,31,40,0.4)" stroke="#6b1f28" strokeWidth="2" />
          <circle cx={primary.x / 100 * 200} cy={primary.y / 100 * 300} r="6"
            fill="#9b2c35" />
          <circle cx={primary.x / 100 * 200} cy={primary.y / 100 * 300} r="3"
            fill="white" opacity="0.9" />
          {/* Position label */}
          <text
            x={primary.x / 100 * 200}
            y={primary.y / 100 * 300 - 18}
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill="white"
            opacity="0.9"
            fontFamily="system-ui, sans-serif"
          >
            {POSITION_LABELS[position]}
          </text>
        </>
      )}
    </svg>
  );
}

export default function PlayerInfoCards({ player }) {
  const birthYear = player.birth_date ? new Date(player.birth_date).getFullYear() : null;
  const age = player.birth_date
    ? Math.floor((new Date() - new Date(player.birth_date)) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header strip */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-900">Ficha del jugador</span>
        {player.jersey_number && (
          <span className="flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full" style={{ background: "#fdf2f4", color: "#6b1f28" }}>
            <Hash className="w-3 h-3" />{player.jersey_number}
          </span>
        )}
      </div>

      {/* Body: data left + field right */}
      <div className="flex gap-0">

        {/* Left: personal data */}
        <div className="flex-1 min-w-0 px-5 py-4 space-y-3">

          {/* Position badge */}
          {player.position && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg text-white" style={{ background: "#6b1f28" }}>
                {POSITION_LABELS[player.position]}
              </span>
              <span className="text-sm font-semibold text-gray-700">{POSITION_FULL[player.position] || player.position}</span>
              {player.secondary_position && (
                <span className="text-xs text-gray-400">/ {POSITION_FULL[player.secondary_position]}</span>
              )}
            </div>
          )}

          {/* Key data grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">

            {age && (
              <div>
                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-0.5">Edad</p>
                <p className="text-sm font-bold text-gray-800">{age} años
                  {birthYear && <span className="text-xs text-gray-400 font-normal ml-1">({birthYear})</span>}
                </p>
              </div>
            )}

            {player.laterality && (
              <div>
                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-0.5">Pie</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-gray-800">{LATERALITY_LABELS[player.laterality]}</span>
                  {player.laterality === "zurdo" && <span className="text-base">🦶</span>}
                </div>
              </div>
            )}

            {player.status && (
              <div>
                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-0.5">Estado</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  player.status === "activo" ? "bg-green-100 text-green-700"
                  : player.status === "lesionado" ? "bg-orange-100 text-orange-700"
                  : "bg-red-100 text-red-700"
                }`}>
                  {player.status === "activo" ? "Activo" : player.status === "lesionado" ? "Lesionado" : "Baja"}
                </span>
              </div>
            )}

            {player.jersey_number && (
              <div>
                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-0.5">Dorsal</p>
                <p className="text-sm font-bold text-gray-800">#{player.jersey_number}</p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            {player.phone && (
              <a href={`tel:${player.phone}`} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-800 transition-colors group">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 group-hover:opacity-80 transition-opacity" style={{ background: "#fdf2f4" }}>
                  <Phone className="w-3 h-3" style={{ color: "#6b1f28" }} />
                </span>
                <span className="truncate font-medium">{player.phone}</span>
              </a>
            )}
            {player.email && (
              <a href={`mailto:${player.email}`} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-800 transition-colors group">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 group-hover:opacity-80 transition-opacity" style={{ background: "#fdf2f4" }}>
                  <Mail className="w-3 h-3" style={{ color: "#6b1f28" }} />
                </span>
                <span className="truncate font-medium">{player.email}</span>
              </a>
            )}
          </div>
        </div>

        {/* Right: football field */}
        {player.position && (
          <div className="shrink-0 flex flex-col items-center justify-center p-4" style={{ width: 130 }}>
            <div className="w-full" style={{ aspectRatio: "200/300" }}>
              <FootballField position={player.position} secondaryPosition={player.secondary_position} laterality={player.laterality} />
            </div>
            {/* Legend */}
            <div className="mt-2 space-y-1 w-full">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "#9b2c35" }} />
                <span className="text-[9px] text-gray-500 truncate">{POSITION_FULL[player.position]}</span>
              </div>
              {player.secondary_position && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-orange-400" />
                  <span className="text-[9px] text-gray-400 truncate">{POSITION_FULL[player.secondary_position]}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}