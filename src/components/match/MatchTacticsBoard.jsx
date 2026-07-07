import React, { useState, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Trash2, Save, Pencil, Eraser, MousePointer,
  StickyNote, ChevronDown, LayoutGrid, Move, Undo2
} from "lucide-react";
import DrawableField from "@/components/tactics/DrawableField";
import FootballField from "@/components/tactics/FootballField";
import PlayerToken from "@/components/tactics/PlayerToken";
import { FORMATIONS, FORMATION_KEYS } from "@/components/tactics/formations";

const DRAW_COLORS = [
  { label: "Blanco", value: "#ffffff" },
  { label: "Amarillo", value: "#facc15" },
  { label: "Rojo", value: "#ef4444" },
  { label: "Azul", value: "#60a5fa" },
  { label: "Naranja", value: "#fb923c" },
];

const DRAW_TYPES = [
  { label: "→ Flecha", value: "arrow" },
  { label: "— Línea", value: "line" },
  { label: "- - Discontinua", value: "dashed" },
];

const POSITION_LABELS = {
  portero: "POR", lateral: "LAT", central: "CEN", libre: "LIB",
  mediocentro: "MC", interior: "INT", delantero_centro: "DC", extremo: "EXT",
};

function PlayerDragToken({ pos, player, onMouseDown, onTouchStart, isDragging }) {
  const initials = `${player?.first_name?.[0] || ""}${player?.last_name?.[0] || ""}`;
  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: "translate(-50%, -50%)",
        cursor: isDragging ? "grabbing" : "grab",
        zIndex: isDragging ? 50 : 10,
        userSelect: "none",
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg border-2 border-white/60 transition-transform"
        style={{ background: isDragging ? "#1a1a2e" : "var(--granate)", transform: isDragging ? "scale(1.2)" : "scale(1)" }}>
        {initials}
      </div>
      <div className="mt-0.5 bg-black/60 text-white text-[9px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap max-w-[70px] truncate text-center">
        {player?.first_name} {player?.last_name?.[0]}.
      </div>
    </div>
  );
}

// ── Inline sub-fields ──

function FreeDragDrawField({ fieldRef, positions, players, draggingId, setDraggingId, mode, paths, onPathsChange, drawColor, drawType, onMouseMove, onMouseUp }) {
  const svgRef = React.useRef(null);
  const currentPath = React.useRef(null);
  const [, rerender] = React.useState(0);
  const isDrawing = React.useRef(false);

  const getSVGCoords = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 50, y: 50 };
    const rect = svg.getBoundingClientRect();
    return {
      x: parseFloat(((clientX - rect.left) / rect.width * 100).toFixed(2)),
      y: parseFloat(((clientY - rect.top) / rect.height * 100).toFixed(2)),
    };
  };

  const handleSvgMouseDown = (e) => {
    if (mode !== "draw") return;
    e.preventDefault();
    isDrawing.current = true;
    const pt = getSVGCoords(e.clientX, e.clientY);
    currentPath.current = { id: Date.now().toString(), points: [pt], color: drawColor, type: drawType, width: 2.5 };
    rerender(n => n + 1);
  };

  const handleSvgMouseMove = (e) => {
    if (mode === "move") { onMouseMove(e); return; }
    if (!isDrawing.current || !currentPath.current) return;
    const pt = getSVGCoords(e.clientX, e.clientY);
    currentPath.current = { ...currentPath.current, points: [...currentPath.current.points, pt] };
    rerender(n => n + 1);
  };

  const handleSvgMouseUp = (e) => {
    if (mode === "move") { onMouseUp(e); return; }
    if (isDrawing.current && currentPath.current?.points.length >= 2) {
      onPathsChange([...paths, currentPath.current]);
    }
    isDrawing.current = false;
    currentPath.current = null;
    rerender(n => n + 1);
  };

  const renderPath = (path, preview = false) => {
    if (!path || path.points.length < 2) return null;
    const d = `M ${path.points[0].x} ${path.points[0].y} ` + path.points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
    const markerId = `arr-${path.id}`;
    return (
      <g key={path.id}>
        {path.type === "arrow" && (
          <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={path.color} />
          </marker></defs>
        )}
        <path d={d} fill="none" stroke={path.color} strokeWidth={path.width || 2.5}
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={path.type === "dashed" ? "6,4" : undefined}
          markerEnd={path.type === "arrow" ? `url(#${markerId})` : undefined}
          opacity={preview ? 0.7 : 0.9} />
      </g>
    );
  };

  return (
    <div ref={fieldRef} className="relative w-full select-none touch-none"
      style={{ aspectRatio: "2/3", cursor: mode === "draw" ? "crosshair" : draggingId ? "grabbing" : "default" }}>
      {/* BG */}
      <div className="absolute inset-0 rounded-xl overflow-hidden"
        style={{ background: "linear-gradient(180deg, #2d7a1f 0%, #3a9427 50%, #2d7a1f 100%)" }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute top-0 bottom-0" style={{ left: `${i * 12.5}%`, width: "12.5%", background: i % 2 === 0 ? "rgba(0,0,0,0.05)" : "transparent" }} />
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
      {/* Tokens */}
      <div className="absolute inset-0" style={{ pointerEvents: mode === "draw" ? "none" : "auto" }}>
        {positions.map(pos => {
          const player = players.find(p => p.id === pos.player_id);
          if (!player) return null;
          return (
            <PlayerDragToken key={pos.player_id} pos={pos} player={player} isDragging={draggingId === pos.player_id}
              onMouseDown={(e) => { if (mode === "move") { e.preventDefault(); setDraggingId(pos.player_id); } }}
              onTouchStart={(e) => { if (mode === "move") { e.preventDefault(); setDraggingId(pos.player_id); } }} />
          );
        })}
      </div>
      {/* Draw SVG */}
      <svg ref={svgRef} className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ cursor: mode === "draw" ? "crosshair" : "default", pointerEvents: "all" }}
        onMouseDown={handleSvgMouseDown} onMouseMove={handleSvgMouseMove}
        onMouseUp={handleSvgMouseUp} onMouseLeave={handleSvgMouseUp}>
        {paths.map(p => renderPath(p))}
        {currentPath.current && renderPath(currentPath.current, true)}
      </svg>
    </div>
  );
}

function FormationDrawField({ formation, assignments, boardPlayers, onAssign, paths, onPathsChange, drawMode, drawColor, drawType }) {
  const svgRef = React.useRef(null);
  const currentPath = React.useRef(null);
  const [, rerender] = React.useState(0);
  const isDrawing = React.useRef(false);

  const getSVGCoords = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 50, y: 50 };
    const rect = svg.getBoundingClientRect();
    return {
      x: parseFloat(((clientX - rect.left) / rect.width * 100).toFixed(2)),
      y: parseFloat(((clientY - rect.top) / rect.height * 100).toFixed(2)),
    };
  };

  const handleDown = (e) => {
    if (!drawMode) return;
    e.preventDefault();
    isDrawing.current = true;
    const pt = getSVGCoords(e.clientX, e.clientY);
    currentPath.current = { id: Date.now().toString(), points: [pt], color: drawColor, type: drawType, width: 2.5 };
    rerender(n => n + 1);
  };
  const handleMove = (e) => {
    if (!isDrawing.current || !currentPath.current) return;
    const pt = getSVGCoords(e.clientX, e.clientY);
    currentPath.current = { ...currentPath.current, points: [...currentPath.current.points, pt] };
    rerender(n => n + 1);
  };
  const handleUp = () => {
    if (isDrawing.current && currentPath.current?.points.length >= 2) {
      onPathsChange([...paths, currentPath.current]);
    }
    isDrawing.current = false;
    currentPath.current = null;
    rerender(n => n + 1);
  };

  const renderPath = (path, preview = false) => {
    if (!path || path.points.length < 2) return null;
    const d = `M ${path.points[0].x} ${path.points[0].y} ` + path.points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
    const markerId = `arr2-${path.id}`;
    return (
      <g key={path.id}>
        {path.type === "arrow" && (
          <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={path.color} />
          </marker></defs>
        )}
        <path d={d} fill="none" stroke={path.color} strokeWidth={path.width || 2.5}
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={path.type === "dashed" ? "6,4" : undefined}
          markerEnd={path.type === "arrow" ? `url(#${markerId})` : undefined}
          opacity={preview ? 0.7 : 0.9} />
      </g>
    );
  };

  return (
    <div className="relative" style={{ touchAction: drawMode ? "none" : "auto" }}>
      <FootballField>
        {formation?.positions.map(pos => (
          <PlayerToken key={pos.key} position={pos} assignment={assignments?.[pos.key]}
            players={boardPlayers} onAssign={onAssign} readOnly={drawMode} />
        ))}
      </FootballField>
      {/* Draw overlay */}
      <svg ref={svgRef} className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ cursor: drawMode ? "crosshair" : "default", pointerEvents: drawMode ? "all" : "none" }}
        onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}>
        {paths.map(p => renderPath(p))}
        {currentPath.current && renderPath(currentPath.current, true)}
      </svg>
    </div>
  );
}

export default function MatchTacticsBoard({ eventId, teamId, players }) {
  const queryClient = useQueryClient();

  // Board state
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [newBoardDialog, setNewBoardDialog] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", formation: "4-4-2" });
  const [notesOpen, setNotesOpen] = useState(false);
  const [mode, setMode] = useState("move"); // "move" | "draw"
  const [drawColor, setDrawColor] = useState("#ffffff");
  const [drawType, setDrawType] = useState("arrow");
  const [viewMode, setViewMode] = useState("free"); // "free" | "formation"

  // Free drag state
  const fieldRef = React.useRef(null);
  const [draggingId, setDraggingId] = useState(null);

  const { data: boards = [] } = useQuery({
    queryKey: ["matchTactics", eventId],
    queryFn: () => base44.entities.TacticsBoard.filter({ event_id: eventId }),
    enabled: !!eventId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TacticsBoard.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["matchTactics", eventId] });
      setActiveBoardId(created.id);
      setNewBoardDialog(false);
      setNewForm({ name: "", formation: "4-4-2" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TacticsBoard.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["matchTactics", eventId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TacticsBoard.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["matchTactics", eventId] });
      if (activeBoardId === id) setActiveBoardId(null);
    },
  });

  const activeBoard = boards.find(b => b.id === activeBoardId);
  const formation = activeBoard ? FORMATIONS[activeBoard.formation] : null;
  const boardPlayers = players.filter(p => p.status !== "baja");

  // ── Handlers ──
  const handleAssign = (posKey, playerId) => {
    if (!activeBoard) return;
    const assignments = { ...(activeBoard.assignments || {}) };
    if (playerId === null) delete assignments[posKey];
    else assignments[posKey] = { player_id: playerId };
    updateMutation.mutate({ id: activeBoard.id, data: { assignments } });
  };

  const handleFormationChange = (f) => {
    if (!activeBoard) return;
    updateMutation.mutate({ id: activeBoard.id, data: { formation: f, assignments: {} } });
  };

  const handlePathsChange = useCallback((newPaths) => {
    if (!activeBoard) return;
    updateMutation.mutate({ id: activeBoard.id, data: { draw_paths: newPaths } });
  }, [activeBoard, updateMutation]);

  const handleUndo = () => {
    if (!activeBoard) return;
    const paths = activeBoard.draw_paths || [];
    updateMutation.mutate({ id: activeBoard.id, data: { draw_paths: paths.slice(0, -1) } });
  };

  const handleClearPaths = () => {
    if (!activeBoard) return;
    updateMutation.mutate({ id: activeBoard.id, data: { draw_paths: [] } });
  };

  // Free drag logic
  const getFieldCoords = useCallback((clientX, clientY) => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return {
      x: parseFloat(Math.max(3, Math.min(97, (clientX - rect.left) / rect.width * 100)).toFixed(2)),
      y: parseFloat(Math.max(3, Math.min(97, (clientY - rect.top) / rect.height * 100)).toFixed(2)),
    };
  }, []);

  const handleFieldMouseMove = useCallback((e) => {
    if (!draggingId || mode !== "move") return;
    const { x, y } = getFieldCoords(e.clientX, e.clientY);
    const positions = (activeBoard?.free_positions || []).map(p =>
      p.player_id === draggingId ? { ...p, x, y } : p
    );
    // Optimistic local update (debounce on save)
    queryClient.setQueryData(["matchTactics", eventId], (old) =>
      old?.map(b => b.id === activeBoard.id ? { ...b, free_positions: positions } : b)
    );
  }, [draggingId, mode, activeBoard, getFieldCoords, queryClient, eventId]);

  const handleFieldMouseUp = useCallback((e) => {
    if (!draggingId || !activeBoard) return;
    const { x, y } = getFieldCoords(e.clientX, e.clientY);
    const positions = (activeBoard?.free_positions || []).map(p =>
      p.player_id === draggingId ? { ...p, x, y } : p
    );
    setDraggingId(null);
    updateMutation.mutate({ id: activeBoard.id, data: { free_positions: positions } });
  }, [draggingId, activeBoard, getFieldCoords, updateMutation]);

  const addPlayerToField = (playerId) => {
    if (!activeBoard) return;
    const positions = activeBoard.free_positions || [];
    if (positions.find(p => p.player_id === playerId)) return;
    updateMutation.mutate({ id: activeBoard.id, data: { free_positions: [...positions, { player_id: playerId, x: 50, y: 50 }] } });
  };

  const removePlayerFromField = (playerId) => {
    if (!activeBoard) return;
    const positions = (activeBoard.free_positions || []).filter(p => p.player_id !== playerId);
    updateMutation.mutate({ id: activeBoard.id, data: { free_positions: positions } });
  };

  return (
    <div className="space-y-4">
      {/* Board selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={activeBoardId || "none"} onValueChange={v => setActiveBoardId(v === "none" ? null : v)}>
          <SelectTrigger className="h-9 w-52 border-gray-200 text-sm bg-white">
            <SelectValue placeholder="Seleccionar pizarra..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Sin pizarra —</SelectItem>
            {boards.map(b => (
              <SelectItem key={b.id} value={b.id}>{b.name || b.formation}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setNewBoardDialog(true)} className="text-white h-9" style={{ background: "var(--granate)" }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nueva pizarra
        </Button>
        {activeBoard && (
          <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(activeBoard.id)} className="text-red-500 border-red-200 hover:bg-red-50 h-9 ml-auto">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {!activeBoard ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-3xl">⚽</div>
          <p className="font-semibold text-gray-500 uppercase tracking-wide text-sm" style={{ fontFamily: "var(--font-display)" }}>Sin pizarra activa</p>
          <p className="text-xs text-gray-400 mt-1">Crea una pizarra para este partido</p>
          <Button onClick={() => setNewBoardDialog(true)} size="sm" className="mt-4 text-white" style={{ background: "var(--granate)" }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Crear pizarra
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-4">
          {/* Field column */}
          <div className="space-y-3">
            {/* Toolbar */}
            <div className="bg-white border border-gray-200 rounded-xl p-2 flex flex-wrap items-center gap-2">
              {/* View mode */}
              <div className="flex rounded-lg overflow-hidden border border-gray-200">
                <button onClick={() => setViewMode("free")}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors ${viewMode === "free" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                  style={{ fontFamily: "var(--font-display)" }}>
                  <Move className="w-3.5 h-3.5" /> Libre
                </button>
                <button onClick={() => setViewMode("formation")}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors ${viewMode === "formation" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                  style={{ fontFamily: "var(--font-display)" }}>
                  <LayoutGrid className="w-3.5 h-3.5" /> Formación
                </button>
              </div>

              {viewMode === "formation" && (
                <Select value={activeBoard.formation} onValueChange={handleFormationChange}>
                  <SelectTrigger className="h-8 w-28 text-xs border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMATION_KEYS.map(f => <SelectItem key={f} value={f}>{FORMATIONS[f].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {/* Separator */}
              <div className="h-6 w-px bg-gray-200 mx-1" />

              {/* Interaction mode */}
              <div className="flex rounded-lg overflow-hidden border border-gray-200">
                <button onClick={() => setMode("move")}
                  className={`px-2.5 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors ${mode === "move" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                  title="Mover fichas">
                  <MousePointer className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setMode("draw")}
                  className={`px-2.5 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors ${mode === "draw" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                  title="Dibujar">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Draw options */}
              {mode === "draw" && (
                <>
                  <div className="flex items-center gap-1">
                    {DRAW_COLORS.map(c => (
                      <button key={c.value} onClick={() => setDrawColor(c.value)}
                        className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                        style={{ background: c.value, borderColor: drawColor === c.value ? "#1f2937" : "transparent" }}
                        title={c.label} />
                    ))}
                  </div>
                  <Select value={drawType} onValueChange={setDrawType}>
                    <SelectTrigger className="h-7 w-32 text-[11px] border-gray-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DRAW_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button onClick={handleUndo} title="Deshacer último trazo"
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={handleClearPaths} title="Borrar todos los trazos"
                    className="p-1.5 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition-colors">
                    <Eraser className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              <button onClick={() => setNotesOpen(o => !o)}
                className={`ml-auto flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${notesOpen ? "bg-yellow-50 border-yellow-300 text-yellow-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                <StickyNote className="w-3.5 h-3.5" /> Notas
              </button>
            </div>

            {/* Notes */}
            {notesOpen && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-xs text-yellow-700 font-bold uppercase mb-1.5" style={{ fontFamily: "var(--font-display)" }}>Notas tácticas</p>
                <Textarea
                  className="bg-white border-yellow-200 text-sm"
                  rows={2}
                  value={activeBoard.notes || ""}
                  onChange={e => updateMutation.mutate({ id: activeBoard.id, data: { notes: e.target.value } })}
                  placeholder="Instrucciones, estrategia, observaciones..."
                />
              </div>
            )}

            {/* Mode info banner */}
            {mode === "draw" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 font-medium flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5 shrink-0" />
                Modo dibujo activo — arrastra para trazar movimientos
              </div>
            )}

            {/* Field */}
            {viewMode === "free" ? (
              <FreeDragDrawField
                fieldRef={fieldRef}
                positions={activeBoard.free_positions || []}
                players={players}
                draggingId={draggingId}
                setDraggingId={setDraggingId}
                mode={mode}
                paths={activeBoard.draw_paths || []}
                onPathsChange={handlePathsChange}
                drawColor={drawColor}
                drawType={drawType}
                onMouseMove={handleFieldMouseMove}
                onMouseUp={handleFieldMouseUp}
              />
            ) : (
              <FormationDrawField
                formation={formation}
                assignments={activeBoard.assignments}
                boardPlayers={boardPlayers}
                onAssign={handleAssign}
                paths={activeBoard.draw_paths || []}
                onPathsChange={handlePathsChange}
                drawMode={mode === "draw"}
                drawColor={drawColor}
                drawType={drawType}
              />
            )}
          </div>

          {/* Players sidebar */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden self-start">
            <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
                Plantilla ({boardPlayers.length})
              </p>
            </div>
            <div className="p-2 space-y-1 max-h-[500px] overflow-y-auto">
              {viewMode === "free" ? (
                boardPlayers.map(p => {
                  const onField = (activeBoard.free_positions || []).some(fp => fp.player_id === p.id);
                  return (
                    <div key={p.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${onField ? "bg-gray-100 text-gray-400" : "hover:bg-gray-50 text-gray-700"}`}
                      onClick={() => onField ? removePlayerFromField(p.id) : addPlayerToField(p.id)}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                        style={{ background: onField ? "#9ca3af" : "var(--granate)" }}>
                        {p.first_name?.[0]}{p.last_name?.[0]}
                      </span>
                      <span className="truncate flex-1">{p.first_name} {p.last_name}</span>
                      {p.jersey_number && <span className="text-gray-400 text-[10px]">#{p.jersey_number}</span>}
                      {onField && <span className="text-red-400 text-[10px] font-bold">✕</span>}
                    </div>
                  );
                })
              ) : (
                boardPlayers.map(p => {
                  const isAssigned = Object.values(activeBoard.assignments || {}).some(a => a.player_id === p.id);
                  return (
                    <div key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${isAssigned ? "bg-gray-100 text-gray-400 line-through" : p.status === "lesionado" ? "bg-orange-50 text-orange-700" : "text-gray-700"}`}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                        style={{ background: isAssigned ? "#9ca3af" : "var(--granate)" }}>
                        {p.first_name?.[0]}{p.last_name?.[0]}
                      </span>
                      <span className="truncate flex-1">{p.first_name} {p.last_name}</span>
                      {p.jersey_number && <span className="text-[10px]">#{p.jersey_number}</span>}
                      {p.status === "lesionado" && <span title="Lesionado" className="ml-auto">⚠️</span>}
                    </div>
                  );
                })
              )}
              {boardPlayers.length === 0 && (
                <p className="text-xs text-gray-400 p-3 text-center">Sin jugadores activos</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Multiple boards list */}
      {boards.length > 1 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {boards.map(b => (
            <button key={b.id}
              onClick={() => setActiveBoardId(b.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${b.id === activeBoardId ? "border-gray-800 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
              style={{ fontFamily: "var(--font-display)" }}>
              {b.name || b.formation}
            </button>
          ))}
        </div>
      )}

      {/* New board dialog */}
      <Dialog open={newBoardDialog} onOpenChange={o => { if (!o) setNewBoardDialog(false); }}>
        <DialogContent className="bg-white border-gray-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-black uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
              Nueva Pizarra
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Nombre (opcional)</p>
              <Input
                placeholder="Ej: 1ª parte, Jugada a balón parado..."
                value={newForm.name}
                onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                className="border-gray-200"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Formación</p>
              <Select value={newForm.formation} onValueChange={v => setNewForm({ ...newForm, formation: v })}>
                <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATION_KEYS.map(f => <SelectItem key={f} value={f}>{FORMATIONS[f].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewBoardDialog(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate({ ...newForm, team_id: teamId, event_id: eventId, assignments: {}, draw_paths: [], free_positions: [] })}
              className="text-white" style={{ background: "var(--granate)" }}>
              Crear pizarra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}