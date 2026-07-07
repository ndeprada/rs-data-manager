import React, { useRef, useState, useCallback } from "react";

const POSITION_LABELS = {
  portero: "POR",
  lateral: "LAT",
  central: "CEN",
  libre: "LIB",
  mediocentro: "MC",
  interior: "INT",
  delantero_centro: "DC",
  extremo: "EXT",
};

export default function FreeDragField({ players = [], positions = [], onChange }) {
  const fieldRef = useRef(null);
  const [draggingId, setDraggingId] = useState(null);

  const getFieldCoords = useCallback((clientX, clientY) => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    const x = Math.max(3, Math.min(97, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(3, Math.min(97, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!draggingId) return;
    const { x, y } = getFieldCoords(e.clientX, e.clientY);
    onChange(positions.map((p) => p.player_id === draggingId ? { ...p, x, y } : p));
  }, [draggingId, positions, onChange, getFieldCoords]);

  const handleTouchMove = useCallback((e) => {
    if (!draggingId) return;
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = getFieldCoords(touch.clientX, touch.clientY);
    onChange(positions.map((p) => p.player_id === draggingId ? { ...p, x, y } : p));
  }, [draggingId, positions, onChange, getFieldCoords]);

  const handleMouseUp = useCallback(() => setDraggingId(null), []);

  return (
    <div
      ref={fieldRef}
      className="relative w-full select-none touch-none"
      style={{ aspectRatio: "2/3", cursor: draggingId ? "grabbing" : "default" }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      {/* Field background */}
      <div className="absolute inset-0 rounded-xl overflow-hidden"
        style={{ background: "linear-gradient(180deg, #2d7a1f 0%, #3a9427 50%, #2d7a1f 100%)" }}>
        {/* Grass stripes */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0"
            style={{
              left: `${i * 12.5}%`,
              width: "12.5%",
              background: i % 2 === 0 ? "rgba(0,0,0,0.05)" : "transparent",
            }}
          />
        ))}
        {/* SVG field markings */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 300" preserveAspectRatio="none">
          {/* Border */}
          <rect x="10" y="10" width="180" height="280" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
          {/* Center line */}
          <line x1="10" y1="150" x2="190" y2="150" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
          {/* Center circle */}
          <circle cx="100" cy="150" r="25" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
          <circle cx="100" cy="150" r="2" fill="rgba(255,255,255,0.7)" />
          {/* Top penalty area */}
          <rect x="45" y="10" width="110" height="55" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
          <rect x="70" y="10" width="60" height="25" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
          <path d="M70,65 A30,30 0 0,1 130,65" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
          {/* Bottom penalty area */}
          <rect x="45" y="235" width="110" height="55" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
          <rect x="70" y="265" width="60" height="25" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
          <path d="M70,235 A30,30 0 0,0 130,235" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Player tokens */}
      {positions.map((pos) => {
        const player = players.find((p) => p.id === pos.player_id);
        if (!player) return null;
        const isDragging = draggingId === pos.player_id;
        const initials = `${player.first_name?.[0] || ""}${player.last_name?.[0] || ""}`;
        const label = POSITION_LABELS[player.position] || initials;

        return (
          <div
            key={pos.player_id}
            className="absolute flex flex-col items-center"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: "translate(-50%, -50%)",
              cursor: isDragging ? "grabbing" : "grab",
              zIndex: isDragging ? 50 : 10,
              userSelect: "none",
            }}
            onMouseDown={(e) => { e.preventDefault(); setDraggingId(pos.player_id); }}
            onTouchStart={(e) => { e.preventDefault(); setDraggingId(pos.player_id); }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg border-2 border-white/60 transition-transform"
              style={{
                background: isDragging ? "#1a1a2e" : "var(--granate)",
                transform: isDragging ? "scale(1.2)" : "scale(1)",
              }}
            >
              {initials || label}
            </div>
            <div className="mt-0.5 bg-black/60 text-white text-[9px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap max-w-[70px] truncate text-center">
              {player.first_name} {player.last_name?.[0]}.
            </div>
          </div>
        );
      })}
    </div>
  );
}