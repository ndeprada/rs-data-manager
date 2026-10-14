import { birthYearOf } from "@/lib/birthYear";
import { Flag, countryOf } from "@/lib/countries";
import React from "react";
import { FootIndicator } from "./PlayerPositionBadges";
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

// Base coords en el lado izquierdo; se espejan al derecho salvo en zurdos (perfil natural).
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
  if (laterality !== "zurdo" && LATERALITY_MIRROR_POSITIONS.has(position)) {
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

const Label = ({ children }) => <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-0.5">{children}</p>;

export default function PlayerInfoCards({ player }) {
  const birthYear = birthYearOf(player);
  const statusCls = player.status === "activo" ? "bg-green-100 text-green-700" : player.status === "lesionado" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700";
  const statusTxt = player.status === "activo" ? "Activo" : player.status === "lesionado" ? "Lesionado" : "Baja";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-100">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Ficha del jugador</span>
      </div>
      <div className="flex items-start gap-5 px-4 py-3">
        {/* Columna 1: posición, año, estado */}
        <div className="space-y-2 min-w-0">
          {player.position && (
            <div>
              <Label>Posición</Label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg text-white" style={{ background: "#6b1f28" }}>{POSITION_LABELS[player.position]}</span>
                <span className="text-sm font-semibold text-gray-700">{POSITION_FULL[player.position] || player.position}</span>
                {player.secondary_position && <span className="text-xs text-gray-400">/ {POSITION_FULL[player.secondary_position]}</span>}
              </div>
            </div>
          )}
          {birthYear && (
            <div>
              <Label>Año de nacimiento</Label>
              <p className="text-sm font-bold text-gray-800">{birthYear}</p>
            </div>
          )}
          {countryOf(player) && (
            <div>
              <Label>Nacionalidad</Label>
              <Flag player={player} className="text-sm" />
              {(player.birth_place || player.birth_province) && (
                <p className="text-[11px] text-gray-500 mt-0.5">{[player.birth_place, player.birth_province && player.birth_province !== player.birth_place ? player.birth_province : ""].filter(Boolean).join(", ")}</p>
              )}
            </div>
          )}
          {player.status && (
            <div>
              <Label>Estado</Label>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusCls}`}>{statusTxt}</span>
            </div>
          )}
        </div>
        {/* Columna 2: lateralidad y dorsal */}
        <div className="space-y-2">
          {player.laterality && (
            <div>
              <Label>Lateralidad</Label>
              <FootIndicator laterality={player.laterality} light />
            </div>
          )}
          {player.jersey_number && (
            <div>
              <Label>Dorsal</Label>
              <p className="text-sm font-bold text-gray-800">#{player.jersey_number}</p>
            </div>
          )}
        </div>
        {/* Campo */}
        {player.position && (
          <div className="shrink-0 flex flex-col items-center" style={{ width: 70 }}>
            <div className="w-full" style={{ aspectRatio: "200/300" }}>
              <FootballField position={player.position} secondaryPosition={player.secondary_position} laterality={player.laterality} />
            </div>
          </div>
        )}
      </div>
      {(player.phone || player.email) && (
        <div className="border-t border-gray-100 px-4 py-2 flex flex-wrap gap-x-4 gap-y-1">
          {player.phone && <a href={`tel:${player.phone}`} className="flex items-center gap-1.5 text-xs text-gray-600"><Phone className="w-3 h-3" style={{ color: "#6b1f28" }} />{player.phone}</a>}
          {player.email && <a href={`mailto:${player.email}`} className="flex items-center gap-1.5 text-xs text-gray-600 min-w-0"><Mail className="w-3 h-3 shrink-0" style={{ color: "#6b1f28" }} /><span className="truncate">{player.email}</span></a>}
        </div>
      )}
    </div>
  );
}
