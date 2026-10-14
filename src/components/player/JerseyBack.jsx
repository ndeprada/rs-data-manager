import React from "react";

// Espalda de la camiseta de Racing Sarrià con el dorsal del jugador (blanca; naranja para porteros)
export default function JerseyBack({ number, goalkeeper = false, className = "w-[72px] h-[78px]" }) {
  const fill = goalkeeper ? "#FF6E00" : "#F4F4F4";
  const stroke = goalkeeper ? "#B84C00" : "#CFCFCF";
  const ink = goalkeeper ? "#FFFFFF" : "#73000A";
  const len = String(number).length;
  const size = len >= 3 ? 36 : len === 2 ? 48 : 56;
  return (
    <svg viewBox="0 0 120 130" className={`shrink-0 drop-shadow-md ${className}`} role="img" aria-label={`Camiseta dorsal ${number}`}>
      <path
        d="M40,6 L28,10 L6,26 L16,48 L30,42 L30,122 L90,122 L90,42 L104,48 L114,26 L92,10 L80,6 Q60,17 40,6 Z"
        fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* cuello y costuras */}
      <path d="M40,6 Q60,17 80,6" fill="none" stroke={ink} strokeWidth="2" opacity={goalkeeper ? 0.6 : 0.9} />
      <text x="60" y="27" textAnchor="middle" fontSize="5" letterSpacing="0.3" fill={ink} opacity="0.7" style={{ fontFamily: "'IBM Plex Sans Condensed', sans-serif", fontWeight: 600 }}>
        EF HRISTO STOITCHKOV
      </text>
      <image href={goalkeeper ? "/img/chalito-blanco.png" : "/img/chalito-granate.png"} x="40" y="102" width="40" height="15" preserveAspectRatio="xMidYMid meet" />
      <text x="60" y="82" textAnchor="middle" fontSize={size} fill={ink} style={{ fontFamily: "'Racing Sarria', sans-serif", letterSpacing: "0.05em" }}>
        {number}
      </text>
    </svg>
  );
}
