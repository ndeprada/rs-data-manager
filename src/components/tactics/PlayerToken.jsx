import React, { useState, useRef } from "react";

export default function PlayerToken({ position, assignment, players, onAssign, readOnly }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const assignedPlayer = players.find((p) => p.id === assignment?.player_id);
  const isGK = position.key === "gk";

  return (
    <div
      ref={ref}
      className="absolute flex flex-col items-center"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: "translate(-50%, -50%)",
        zIndex: open ? 50 : 10,
      }}
    >
      {/* Token */}
      <button
        onClick={() => !readOnly && setOpen((o) => !o)}
        className="flex flex-col items-center gap-0.5 group"
        disabled={readOnly}
      >
        <div
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white shadow-lg transition-transform group-hover:scale-110 ${
            assignedPlayer ? "border-yellow-300" : "border-white/50 border-dashed"
          }`}
          style={{
            background: assignedPlayer
              ? isGK ? "#b45309" : "var(--granate)"
              : "rgba(0,0,0,0.35)",
          }}
        >
          {assignedPlayer
            ? `${assignedPlayer.first_name?.[0]}${assignedPlayer.last_name?.[0]}`
            : position.label}
        </div>
        <span
          className="text-[9px] font-bold px-1 py-0.5 rounded text-white shadow"
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          {assignedPlayer
            ? `${assignedPlayer.first_name?.split(" ")[0]} ${assignedPlayer.last_name?.split(" ")[0]}`
            : position.label}
        </span>
      </button>

      {/* Dropdown to assign player */}
      {open && !readOnly && (
        <div
          className="absolute bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-44 overflow-hidden"
          style={{ top: "110%", left: "50%", transform: "translateX(-50%)" }}
        >
          <div
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {position.label} — Asignar
          </div>
          <div className="max-h-44 overflow-y-auto">
            {assignment?.player_id && (
              <button
                onClick={() => { onAssign(position.key, null); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 border-b border-gray-100"
              >
                ✕ Quitar jugador
              </button>
            )}
            {players
              .filter((p) => p.status !== "baja")
              .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onAssign(position.key, p.id); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                    assignment?.player_id === p.id ? "bg-gray-100 font-semibold" : ""
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{ background: "var(--granate)" }}
                  >
                    {p.first_name?.[0]}{p.last_name?.[0]}
                  </span>
                  {p.first_name} {p.last_name}
                  {p.status === "lesionado" && <span className="ml-auto text-orange-400">⚠</span>}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Backdrop to close */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}