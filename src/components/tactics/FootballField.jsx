import React from "react";

export default function FootballField({ children }) {
  return (
    <div
      className="relative w-full select-none"
      style={{
        aspectRatio: "100 / 65",
        background: "linear-gradient(90deg, #3d7d4e 0%, #4a9a5f 8%, #3d7d4e 8%, #3d7d4e 16%, #4a9a5f 16%, #4a9a5f 24%, #3d7d4e 24%, #3d7d4e 32%, #4a9a5f 32%, #4a9a5f 40%, #3d7d4e 40%, #3d7d4e 48%, #4a9a5f 48%, #4a9a5f 56%, #3d7d4e 56%, #3d7d4e 64%, #4a9a5f 64%, #4a9a5f 72%, #3d7d4e 72%, #3d7d4e 80%, #4a9a5f 80%, #4a9a5f 88%, #3d7d4e 88%)",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      {/* Field lines SVG overlay */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 650" preserveAspectRatio="none">
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
      </svg>

      {/* Player tokens */}
      {children}
    </div>
  );
}