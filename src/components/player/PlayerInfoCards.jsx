import { birthYearOf } from "@/lib/birthYear";
import { Flag, countryOf } from "@/lib/countries";
import React from "react";
import { LEVELS, getPositionList, getPitchMarkers } from "@/lib/playerPositions";
import { findRole } from "@/lib/competencyCatalog";
import PlayerFoot from "./PlayerFoot";
import { Phone, Mail } from "lucide-react";
import { useT, msg } from "@/i18n";

const POSITION_LABELS = {
  portero: msg("POR"), lateral: msg("LAT"), central: msg("CT"), libre: msg("LIB"),
  mediocentro: msg("MC"), interior: msg("INT"), mediapunta: msg("MP"), delantero_centro: msg("DC"), extremo: msg("EXT"),
};
const POSITION_FULL = {
  portero: msg("Portero"), lateral: msg("Lateral"), central: msg("Central"), libre: msg("Libre"),
  mediocentro: msg("Mediocentro"), interior: msg("Interior"), mediapunta: msg("Mediapunta"), delantero_centro: msg("Delantero"), extremo: msg("Extremo")
};

// Base coords en el lado izquierdo; se espejan al derecho salvo en zurdos (perfil natural).
const POSITION_COORDS_BASE = {
  portero:          { x: 50, y: 88 },
  central:          { x: 50, y: 68 },
  lateral:          { x: 22, y: 72 },
  libre:            { x: 50, y: 78 },
  mediocentro:      { x: 50, y: 48 },
  interior:         { x: 30, y: 38 },
  mediapunta:       { x: 50, y: 30 },
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

function FootballField({ player }) {
  const t = useT();
  const laterality = player.laterality;
  const order = { competente: 0, secundaria: 1, natural: 2 };
  const pts = getPitchMarkers(player, laterality).sort((a, b) => order[a.level] - order[b.level]);

  return (
    <svg viewBox="0 0 200 300" className="w-full h-full" style={{ display: "block" }}>
      {/* Base grass gradient */}
      <defs>
        <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a5c28" />
          <stop offset="100%" stopColor="#1e6b2e" />
        </linearGradient>
        <radialGradient id="primaryGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#73000A" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#73000A" stopOpacity="0" />
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

      {pts.map((x) => {
        const cx = (x.c.x / 100) * 200, cy = (x.c.y / 100) * 300, col = LEVELS[x.level].color;
        const nat = x.level === "natural";
        return (
          <g key={x.position + (x.role||"") + x.c.x}>
            {nat && <circle cx={cx} cy={cy} r="27" fill={col} fillOpacity="0.22" />}
            {nat && <circle cx={cx} cy={cy} r="20" fill={col} fillOpacity="0.35" />}
            <circle cx={cx} cy={cy} r={nat ? 13 : 11} fill={col} stroke={nat ? "#fff" : "#0b2a12"} strokeWidth={nat ? 2.5 : 2} />
            <text x={cx} y={x.c.y < 80 ? cy + (nat ? 27 : 24) : cy - (nat ? 22 : 17)} textAnchor="middle" fontSize="12" fontWeight="800" fill="white" fontFamily="system-ui, sans-serif" stroke="rgba(0,0,0,0.5)" strokeWidth="0.7" paintOrder="stroke">{t(POSITION_LABELS[x.position])}</text>
          </g>
        );
      })}
    </svg>
  );
}

const Label = ({ children }) => <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-0.5">{children}</p>;

export default function PlayerInfoCards({ player, footMode = "hidden" }) {
  const t = useT();
  const birthYear = birthYearOf(player);
  const statusCls = player.status === "activo" ? "bg-green-100 text-green-700" : player.status === "lesionado" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700";
  const statusTxt = player.status === "activo" ? t("Activo") : player.status === "lesionado" ? t("Lesionado") : t("Baja");

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-100">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{t("Ficha del jugador")}</span>
      </div>
      <div className="flex items-stretch gap-5 px-4 py-3">
        {/* Izquierda: posiciones y datos */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {player.position && (
            <div>
              <Label>{t("Posiciones")}</Label>
              <div className="space-y-1">
                {getPositionList(player).map((x) => {
                  const role = x.role ? t(findRole(x.role)?.role.label) : "";
                  return (
                    <div key={x.position + (x.role||"")} className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md min-w-[34px] text-center shrink-0" style={{ background: LEVELS[x.level].color, color: LEVELS[x.level].text }}>{t(POSITION_LABELS[x.position])}</span>
                      <div className="leading-tight min-w-0">
                        <p className={`text-sm ${x.level === "natural" ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>{POSITION_FULL[x.position] ? t(POSITION_FULL[x.position]) : x.position}{role ? ` · ${role}` : ""}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: LEVELS[x.level].ink }}>{t(LEVELS[x.level].label)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="border-t border-gray-100 pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-x-4">
              {birthYear && (
                <div>
                  <Label>{t("Año de nacimiento")}</Label>
                  <p className="text-sm font-bold text-gray-800">{birthYear}</p>
                </div>
              )}
              {countryOf(player) && (
                <div>
                  <Label>{t("Nacionalidad")}</Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Flag player={player} className="text-sm" />
                    {(player.birth_place || player.birth_province) && (
                      <span className="text-[11px] text-gray-500">{[player.birth_place, player.birth_province && player.birth_province !== player.birth_place ? player.birth_province : ""].filter(Boolean).join(", ")}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-x-4 items-start">
              {player.jersey_number && (
                <div>
                  <Label>{t("Dorsal")}</Label>
                  <p className="text-sm font-bold text-gray-800">#{player.jersey_number}</p>
                </div>
              )}
              {player.status && (
                <div>
                  <Label>{t("Estado")}</Label>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusCls}`}>{statusTxt}</span>
                </div>
              )}
              {player.laterality && (
                <div>
                  <Label>{t("Lateralidad")}</Label>
                  <div className="w-fit"><PlayerFoot player={player} light mode={footMode} /></div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Derecha: campograma y lateralidad debajo */}
        {player.position && (
          <div className="shrink-0" style={{ width: 160 }}>
            <div className="w-full" style={{ aspectRatio: "200/300" }}>
              <FootballField player={player} />
            </div>
          </div>
        )}
      </div>
      {(player.phone || player.email) && (
        <div className="border-t border-gray-100 px-4 py-2 flex flex-wrap gap-x-4 gap-y-1">
          {player.phone && <a href={`tel:${player.phone}`} className="flex items-center gap-1.5 text-xs text-gray-600"><Phone className="w-3 h-3" style={{ color: "#73000A" }} />{player.phone}</a>}
          {player.email && <a href={`mailto:${player.email}`} className="flex items-center gap-1.5 text-xs text-gray-600 min-w-0"><Mail className="w-3 h-3 shrink-0" style={{ color: "#73000A" }} /><span className="truncate">{player.email}</span></a>}
        </div>
      )}
    </div>
  );
}
