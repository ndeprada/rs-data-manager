import React, { useRef, useState, useCallback, useEffect } from "react";

const DRAW_COLORS = [
  { label: "Blanco", value: "#ffffff" },
  { label: "Amarillo", value: "#facc15" },
  { label: "Rojo", value: "#ef4444" },
  { label: "Azul", value: "#3b82f6" },
  { label: "Naranja", value: "#f97316" },
];

const DRAW_TYPES = [
  { label: "Flecha", value: "arrow" },
  { label: "Línea", value: "line" },
  { label: "Discontinua", value: "dashed" },
];

function ArrowMarker({ id, color }) {
  return (
    <defs>
      <marker id={id} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill={color} />
      </marker>
    </defs>
  );
}

function pathToD(points) {
  if (!points || points.length < 2) return "";
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ` + rest.map(p => `L ${p.x} ${p.y}`).join(" ");
}

export default function DrawableField({
  children,
  paths = [],
  onPathsChange,
  drawMode = false,
  drawColor = "#ffffff",
  drawType = "arrow",
}) {
  const svgRef = useRef(null);
  const [currentPath, setCurrentPath] = useState(null);
  const isDrawing = useRef(false);

  const getSVGCoords = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: parseFloat(((clientX - rect.left) / rect.width * 100).toFixed(2)),
      y: parseFloat(((clientY - rect.top) / rect.height * 100).toFixed(2)),
    };
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (!drawMode) return;
    e.preventDefault();
    isDrawing.current = true;
    const pt = getSVGCoords(e.clientX, e.clientY);
    setCurrentPath({ id: Date.now().toString(), points: [pt], color: drawColor, type: drawType, width: 2.5 });
  }, [drawMode, drawColor, drawType, getSVGCoords]);

  const handleMouseMove = useCallback((e) => {
    if (!isDrawing.current || !currentPath) return;
    const pt = getSVGCoords(e.clientX, e.clientY);
    setCurrentPath(prev => ({ ...prev, points: [...prev.points, pt] }));
  }, [currentPath, getSVGCoords]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing.current || !currentPath) return;
    isDrawing.current = false;
    if (currentPath.points.length >= 2) {
      onPathsChange([...paths, currentPath]);
    }
    setCurrentPath(null);
  }, [currentPath, paths, onPathsChange]);

  const handleTouchStart = useCallback((e) => {
    if (!drawMode) return;
    e.preventDefault();
    isDrawing.current = true;
    const t = e.touches[0];
    const pt = getSVGCoords(t.clientX, t.clientY);
    setCurrentPath({ id: Date.now().toString(), points: [pt], color: drawColor, type: drawType, width: 2.5 });
  }, [drawMode, drawColor, drawType, getSVGCoords]);

  const handleTouchMove = useCallback((e) => {
    if (!isDrawing.current || !currentPath) return;
    e.preventDefault();
    const t = e.touches[0];
    const pt = getSVGCoords(t.clientX, t.clientY);
    setCurrentPath(prev => ({ ...prev, points: [...prev.points, pt] }));
  }, [currentPath, getSVGCoords]);

  const renderPath = (path, isPreview = false) => {
    if (!path || path.points.length < 2) return null;
    const markerId = `arrow-${path.id}`;
    const d = pathToD(path.points);
    const isArrow = path.type === "arrow";
    const isDashed = path.type === "dashed";

    return (
      <g key={path.id}>
        {isArrow && <ArrowMarker id={markerId} color={path.color} />}
        <path
          d={d}
          fill="none"
          stroke={path.color}
          strokeWidth={path.width || 2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={isDashed ? "6,4" : undefined}
          markerEnd={isArrow ? `url(#${markerId})` : undefined}
          opacity={isPreview ? 0.75 : 0.9}
        />
      </g>
    );
  };

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: "2/3", touchAction: drawMode ? "none" : "auto" }}>
      {/* Field background + player tokens */}
      <div className="absolute inset-0 rounded-xl overflow-hidden"
        style={{ background: "linear-gradient(180deg, #2d7a1f 0%, #3a9427 50%, #2d7a1f 100%)" }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute top-0 bottom-0"
            style={{ left: `${i * 12.5}%`, width: "12.5%", background: i % 2 === 0 ? "rgba(0,0,0,0.05)" : "transparent" }} />
        ))}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 300" preserveAspectRatio="none">
          <rect x="10" y="10" width="180" height="280" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
          <line x1="10" y1="150" x2="190" y2="150" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
          <circle cx="100" cy="150" r="25" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
          <circle cx="100" cy="150" r="2" fill="rgba(255,255,255,0.7)" />
          <rect x="45" y="10" width="110" height="55" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
          <rect x="70" y="10" width="60" height="25" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
          <path d="M70,65 A30,30 0 0,1 130,65" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
          <rect x="45" y="235" width="110" height="55" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
          <rect x="70" y="265" width="60" height="25" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
          <path d="M70,235 A30,30 0 0,0 130,235" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Player tokens layer — only visible when NOT drawing */}
      <div className="absolute inset-0" style={{ pointerEvents: drawMode ? "none" : "auto" }}>
        {children}
      </div>

      {/* Draw SVG overlay */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ cursor: drawMode ? "crosshair" : "default", pointerEvents: drawMode ? "all" : "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        {paths.map(p => renderPath(p))}
        {currentPath && renderPath(currentPath, true)}
      </svg>
    </div>
  );
}