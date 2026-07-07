import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Undo2, Download, Pencil, Circle, Minus, ArrowRight } from "lucide-react";

const COLORS = ["#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#000000", "#ffffff"];

const TOOLS = [
  { id: "pencil", icon: Pencil, label: "Lápiz" },
  { id: "line", icon: Minus, label: "Línea" },
  { id: "arrow", icon: ArrowRight, label: "Flecha" },
  { id: "circle", icon: Circle, label: "Círculo" },
];

function drawFootballField(ctx, w, h, half = false) {
  ctx.clearRect(0, 0, w, h);
  // Green background
  ctx.fillStyle = "#3a7d44";
  ctx.fillRect(0, 0, w, h);

  // Stripes
  const stripeW = w / 10;
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(0,0,0,0.07)" : "transparent";
    ctx.fillRect(i * stripeW, 0, stripeW, h);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";

  const pad = w * 0.05;
  const fw = w - pad * 2;
  const fh = h - pad * 2;

  if (!half) {
    // Full field border
    ctx.strokeRect(pad, pad, fw, fh);
    // Center line
    ctx.beginPath();
    ctx.moveTo(pad + fw / 2, pad);
    ctx.lineTo(pad + fw / 2, pad + fh);
    ctx.stroke();
    // Center circle
    ctx.beginPath();
    ctx.arc(pad + fw / 2, pad + fh / 2, fh * 0.15, 0, Math.PI * 2);
    ctx.stroke();
    // Center dot
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(pad + fw / 2, pad + fh / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Penalty areas (left and right)
    const paW = fw * 0.12;
    const paH = fh * 0.45;
    ctx.strokeRect(pad, pad + (fh - paH) / 2, paW, paH); // left
    ctx.strokeRect(pad + fw - paW, pad + (fh - paH) / 2, paW, paH); // right
    // Goal areas
    const gaW = fw * 0.05;
    const gaH = fh * 0.22;
    ctx.strokeRect(pad, pad + (fh - gaH) / 2, gaW, gaH);
    ctx.strokeRect(pad + fw - gaW, pad + (fh - gaH) / 2, gaW, gaH);
    // Goals
    const goalH = fh * 0.12;
    const goalD = fw * 0.015;
    ctx.strokeRect(pad - goalD, pad + (fh - goalH) / 2, goalD, goalH);
    ctx.strokeRect(pad + fw, pad + (fh - goalH) / 2, goalD, goalH);
    // Penalty spots
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.arc(pad + fw * 0.09, pad + fh / 2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(pad + fw - fw * 0.09, pad + fh / 2, 2.5, 0, Math.PI * 2); ctx.fill();
    // Corner arcs
    const cr = fh * 0.03;
    [0, 1].forEach(xi => [0, 1].forEach(yi => {
      const cx = pad + xi * fw;
      const cy = pad + yi * fh;
      const startA = (xi === 0 ? 0 : Math.PI) + (yi === 0 ? -Math.PI / 2 : Math.PI / 2) * (xi === 0 ? 1 : -1);
      ctx.beginPath();
      ctx.arc(cx, cy, cr, startA, startA + Math.PI / 2);
      ctx.stroke();
    }));
  } else {
    // Half field
    ctx.strokeRect(pad, pad, fw, fh);
    // Mid line
    ctx.beginPath();
    ctx.moveTo(pad, pad + fh);
    ctx.lineTo(pad + fw, pad + fh);
    ctx.stroke();
    // Half center circle arc
    ctx.beginPath();
    ctx.arc(pad + fw / 2, pad + fh, fh * 0.28, Math.PI, 0);
    ctx.stroke();
    // Center dot
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(pad + fw / 2, pad + fh, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Penalty area
    const paW = fw * 0.55;
    const paH = fh * 0.35;
    ctx.strokeRect(pad + (fw - paW) / 2, pad, paW, paH);
    // Goal area
    const gaW = fw * 0.27;
    const gaH = fh * 0.14;
    ctx.strokeRect(pad + (fw - gaW) / 2, pad, gaW, gaH);
    // Goal
    const goalW = fw * 0.14;
    const goalD = fh * 0.04;
    ctx.strokeRect(pad + (fw - goalW) / 2, pad - goalD, goalW, goalD);
    // Penalty spot
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.arc(pad + fw / 2, pad + paH * 0.72, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawArrow(ctx, x1, y1, x2, y2) {
  const headLen = 12;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

export default function FieldDrawingBoard({ value, onChange, fieldMode = "full" }) {
  const canvasRef = useRef(null);
  const fieldCanvasRef = useRef(null);
  const [tool, setTool] = useState("pencil");
  const [color, setColor] = useState("#e11d48");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [mode, setMode] = useState(fieldMode);

  const W = 560;
  const H = mode === "full" ? 340 : 300;

  // Draw field background
  useEffect(() => {
    const fc = fieldCanvasRef.current;
    if (!fc) return;
    fc.width = W;
    fc.height = H;
    const ctx = fc.getContext("2d");
    drawFootballField(ctx, W, H, mode === "half");
  }, [mode, W, H]);

  // Redraw drawing canvas
  const redraw = useCallback((pathList, preview = null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    const drawShape = (p) => {
      ctx.strokeStyle = p.color;
      ctx.fillStyle = p.color;
      ctx.lineWidth = p.strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (p.type === "pencil") {
        if (p.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(p.points[0].x, p.points[0].y);
        p.points.slice(1).forEach(pt => ctx.lineTo(pt.x, pt.y));
        ctx.stroke();
      } else if (p.type === "line") {
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
      } else if (p.type === "arrow") {
        drawArrow(ctx, p.x1, p.y1, p.x2, p.y2);
      } else if (p.type === "circle") {
        const r = Math.sqrt((p.x2 - p.x1) ** 2 + (p.y2 - p.y1) ** 2);
        ctx.beginPath();
        ctx.arc(p.x1, p.y1, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    pathList.forEach(drawShape);
    if (preview) drawShape(preview);
  }, [W, H]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    redraw(paths);
  }, [paths, redraw, W, H]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    const pos = getPos(e);
    setDrawing(true);
    setStartPos(pos);
    if (tool === "pencil") {
      setCurrentPath({ type: "pencil", color, strokeWidth, points: [pos] });
    }
  };

  const onPointerMove = (e) => {
    e.preventDefault();
    if (!drawing) return;
    const pos = getPos(e);
    if (tool === "pencil") {
      setCurrentPath(prev => {
        const updated = { ...prev, points: [...prev.points, pos] };
        redraw(paths, updated);
        return updated;
      });
    } else {
      const preview = { type: tool, color, strokeWidth, x1: startPos.x, y1: startPos.y, x2: pos.x, y2: pos.y };
      redraw(paths, preview);
    }
  };

  const onPointerUp = (e) => {
    if (!drawing) return;
    const pos = getPos(e);
    setDrawing(false);
    let newPath;
    if (tool === "pencil") {
      newPath = currentPath;
      setCurrentPath(null);
    } else {
      newPath = { type: tool, color, strokeWidth, x1: startPos.x, y1: startPos.y, x2: pos.x, y2: pos.y };
    }
    if (!newPath) return;
    const newPaths = [...paths, newPath];
    setPaths(newPaths);
    redraw(newPaths);
    saveDrawing(newPaths);
  };

  const undo = () => {
    const newPaths = paths.slice(0, -1);
    setPaths(newPaths);
    redraw(newPaths);
    saveDrawing(newPaths);
  };

  const clear = () => {
    setPaths([]);
    redraw([]);
    onChange(null);
  };

  const saveDrawing = (pathList) => {
    // Merge field + drawing into a single image and save as data URL
    const merged = document.createElement("canvas");
    merged.width = W;
    merged.height = H;
    const mctx = merged.getContext("2d");
    mctx.drawImage(fieldCanvasRef.current, 0, 0);
    mctx.drawImage(canvasRef.current, 0, 0);
    if (pathList.length === 0) { onChange(null); return; }
    onChange(merged.toDataURL("image/png"));
  };

  const download = () => {
    const merged = document.createElement("canvas");
    merged.width = W;
    merged.height = H;
    const mctx = merged.getContext("2d");
    mctx.drawImage(fieldCanvasRef.current, 0, 0);
    mctx.drawImage(canvasRef.current, 0, 0);
    const link = document.createElement("a");
    link.download = "diagrama-tarea.png";
    link.href = merged.toDataURL("image/png");
    link.click();
  };

  const switchMode = (m) => {
    setMode(m);
    setPaths([]);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      {/* Mode selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Campo:</span>
        <button onClick={() => switchMode("full")}
          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${mode === "full" ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          style={mode === "full" ? { background: "var(--granate)" } : {}}>
          Campo completo
        </button>
        <button onClick={() => switchMode("half")}
          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${mode === "half" ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          style={mode === "half" ? { background: "var(--granate)" } : {}}>
          Medio campo
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap p-2 bg-gray-50 rounded-lg border border-gray-200">
        {/* Tools */}
        <div className="flex gap-1">
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
              className={`p-1.5 rounded transition-colors ${tool === t.id ? "text-white" : "text-gray-500 hover:bg-gray-200"}`}
              style={tool === t.id ? { background: "var(--granate)" } : {}}>
              <t.icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-gray-200" />
        {/* Colors */}
        <div className="flex gap-1">
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
              style={{ background: c, borderColor: color === c ? "#374151" : "transparent" }} />
          ))}
        </div>
        <div className="w-px h-5 bg-gray-200" />
        {/* Stroke width */}
        <div className="flex gap-1 items-center">
          {[1, 2, 4].map(w => (
            <button key={w} onClick={() => setStrokeWidth(w)}
              className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${strokeWidth === w ? "bg-gray-700" : "hover:bg-gray-200"}`}>
              <div className="rounded-full bg-gray-700" style={{ width: w * 2.5, height: w * 2.5, background: strokeWidth === w ? "white" : "#374151" }} />
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {/* Actions */}
        <button onClick={undo} disabled={paths.length === 0} title="Deshacer"
          className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 text-gray-500">
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={clear} disabled={paths.length === 0} title="Limpiar"
          className="p-1.5 rounded hover:bg-red-50 disabled:opacity-30 text-gray-500 hover:text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={download} disabled={paths.length === 0} title="Descargar"
          className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 text-gray-500">
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Canvas area */}
      <div className="relative w-full rounded-lg overflow-hidden border border-gray-200" style={{ aspectRatio: `${W}/${H}` }}>
        <canvas ref={fieldCanvasRef} className="absolute inset-0 w-full h-full" style={{ imageRendering: "pixelated" }} />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: "crosshair", touchAction: "none" }}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        />
      </div>
      <p className="text-[10px] text-gray-400 text-center">Dibuja sobre el campo. Usa los botones para cambiar herramienta, color y grosor.</p>
    </div>
  );
}