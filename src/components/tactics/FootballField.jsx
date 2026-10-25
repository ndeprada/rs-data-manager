import React from "react";
import { f7Markings } from "@/lib/pitchGeometry";

const GRASS = "linear-gradient(180deg, #3d7d4e 0%, #4a9a5f 8%, #3d7d4e 8%, #3d7d4e 16%, #4a9a5f 16%, #4a9a5f 24%, #3d7d4e 24%, #3d7d4e 32%, #4a9a5f 32%, #4a9a5f 40%, #3d7d4e 40%, #3d7d4e 48%, #4a9a5f 48%, #4a9a5f 56%, #3d7d4e 56%, #3d7d4e 64%, #4a9a5f 64%, #4a9a5f 72%, #3d7d4e 72%, #3d7d4e 80%, #4a9a5f 80%, #4a9a5f 88%, #3d7d4e 88%)";
const LINE = "rgba(255,255,255,0.85)";

// Campo de fútbol 7 a escala (45 × 65 m, portería propia arriba): áreas de 24 × 9 y 12 × 3 m, punto de penalti a 9 m, círculo central de 6 m y
// líneas de fuera de juego a 12 m de cada línea de meta (mismas medidas que la pestaña Táctica del partido: src/lib/pitchGeometry.js).
function F7Field({ children }) {
  const W = 450, H = 650, M = 14;
  const m = f7Markings(M, M, W - 2 * M, H - 2 * M);
  const stroke = { fill: "none", stroke: LINE, strokeWidth: 2.5 };
  return (
    <div
      className="relative w-full max-w-md mx-auto select-none"
      data-testid="tactics-field-f7"
      style={{ aspectRatio: `${W} / ${H}`, background: GRASS, borderRadius: "4px", overflow: "hidden" }}
    >
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <rect x={M} y={M} width={W - 2 * M} height={H - 2 * M} rx="6" ry="6" {...stroke} />
        <line x1={M} y1={H / 2} x2={W - M} y2={H / 2} {...stroke} />
        <circle cx={m.centre.x} cy={m.centre.y} r={m.centre.r} {...stroke} />
        <circle cx={m.centre.x} cy={m.centre.y} r="4" fill={LINE} />
        {/* Áreas de arriba y de abajo, y puntos de penalti */}
        <rect x={m.area.x} y={M} width={m.area.w} height={m.area.d} {...stroke} />
        <rect x={m.goalArea.x} y={M} width={m.goalArea.w} height={m.goalArea.d} {...stroke} />
        <rect x={m.area.x} y={H - M - m.area.d} width={m.area.w} height={m.area.d} {...stroke} />
        <rect x={m.goalArea.x} y={H - M - m.goalArea.d} width={m.goalArea.w} height={m.goalArea.d} {...stroke} />
        <circle cx={W / 2} cy={M + m.spot} r="4" fill={LINE} />
        <circle cx={W / 2} cy={H - M - m.spot} r="4" fill={LINE} />
        {/* Líneas de fuera de juego, a 12 m de cada línea de meta */}
        <g data-testid="f7-offside" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeDasharray="14 9">
          <line x1={M} y1={M + m.offside} x2={W - M} y2={M + m.offside} />
          <line x1={M} y1={H - M - m.offside} x2={W - M} y2={H - M - m.offside} />
        </g>
      </svg>
      {children}
    </div>
  );
}

/** f7: campo de fútbol 7 (45 × 65 m); si no, campo de fútbol 11. */
export default function FootballField({ children, f7 = false }) {
  if (f7) return <F7Field>{children}</F7Field>;
  return (
    <div
      className="relative w-full max-w-md mx-auto select-none"
      style={{
        aspectRatio: "65 / 100",
        background: GRASS,
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      {/* Field lines SVG overlay */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 650 1000" preserveAspectRatio="none">
        {/* El campo se dibujó en horizontal; se gira para que la portería propia quede arriba, como en las posiciones de las formaciones */}
        <g transform="matrix(0 1 1 0 0 0)">
        {/* Outer border - con esquinas redondeadas */}
        <rect x="30" y="30" width="940" height="590" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" rx="8" ry="8" />
        
        {/* Center line */}
        <line x1="500" y1="30" x2="500" y2="620" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
        
        {/* Center circle */}
        <circle cx="500" cy="325" r="80" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
        <circle cx="500" cy="325" r="4" fill="rgba(255,255,255,0.85)" />
        
        {/* Left goal area */}
        <rect x="30" y="157.5" width="120" height="335" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
        
        {/* Left penalty area */}
        <rect x="30" y="107.5" width="210" height="435" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
        
        {/* Left penalty spot */}
        <circle cx="190" cy="325" r="4" fill="rgba(255,255,255,0.85)" />
        
        {/* Left penalty arc */}
        <path d="M 240 220 A 80 80 0 0 1 240 430" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
        
        {/* Left goal keeper area (small) */}
        <rect x="30" y="207.5" width="45" height="235" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
        
        {/* Right goal area */}
        <rect x="850" y="157.5" width="120" height="335" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
        
        {/* Right penalty area */}
        <rect x="760" y="107.5" width="210" height="435" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
        
        {/* Right penalty spot */}
        <circle cx="810" cy="325" r="4" fill="rgba(255,255,255,0.85)" />
        
        {/* Right penalty arc */}
        <path d="M 760 220 A 80 80 0 0 0 760 430" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
        
        {/* Right goal keeper area (small) */}
        <rect x="925" y="207.5" width="45" height="235" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
        
        {/* Corner arcs */}
        <path d="M 30 38 A 8 8 0 0 1 38 30" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
        <path d="M 962 30 A 8 8 0 0 1 970 38" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
        <path d="M 970 612 A 8 8 0 0 1 962 620" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
        <path d="M 38 620 A 8 8 0 0 1 30 612" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
      </g>
      </svg>

      {/* Player tokens */}
      {children}
    </div>
  );
}