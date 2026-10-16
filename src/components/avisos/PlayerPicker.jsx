import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { base44 } from "@/api/base44Client";

export const RELATIONS = [
  { v: "padre", l: "Padre" }, { v: "madre", l: "Madre" }, { v: "tutor", l: "Tutor/a" }, { v: "otro_familiar", l: "Otro familiar" },
];
export const relLabel = (v) => RELATIONS.find((r) => r.v === v)?.l || v;

// Buscador de jugador + parentesco. Llama a onPick({ player, relationship }).
export default function PlayerPicker({ onPick, busy, buttonLabel = "Solicitar vínculo" }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [player, setPlayer] = useState(null);
  const [rel, setRel] = useState("");

  useEffect(() => {
    if (player || q.trim().length < 3) { setResults([]); return; }
    const t = setTimeout(() => base44.club.searchPlayers(q.trim()).then(setResults).catch(() => setResults([])), 300);
    return () => clearTimeout(t);
  }, [q, player]);

  return (
    <div className="space-y-3">
      {player ? (
        <div className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
          <div>
            <p className="text-sm font-bold text-gray-900">{player.name}</p>
            <p className="text-[11px] text-gray-400">{player.team}{player.birth_year ? ` · ${player.birth_year}` : ""}</p>
          </div>
          <button onClick={() => { setPlayer(null); setQ(""); }} className="text-xs text-gray-400 hover:text-gray-600">Cambiar</button>
        </div>
      ) : (
        <div>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del jugador (mín. 3 letras)"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2" />
          </div>
          {results.length > 0 && (
            <div className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
              {results.map((p) => (
                <button key={p.id} onClick={() => setPlayer(p)} className="w-full text-left px-3 py-2 hover:bg-gray-50">
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  <p className="text-[11px] text-gray-400">{p.team}{p.birth_year ? ` · ${p.birth_year}` : ""}</p>
                </button>
              ))}
            </div>
          )}
          {q.trim().length >= 3 && results.length === 0 && <p className="text-[11px] text-gray-400 mt-1">Sin resultados. Prueba con otro nombre o apellido.</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {RELATIONS.map((r) => (
          <button key={r.v} type="button" onClick={() => setRel(r.v)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${rel === r.v ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200"}`}
            style={rel === r.v ? { background: "var(--granate)" } : undefined}>{r.l}</button>
        ))}
      </div>
      <button disabled={!player || !rel || busy} onClick={() => onPick({ player, relationship: rel })}
        className="w-full py-2.5 rounded-full text-white font-bold uppercase text-xs tracking-wider disabled:opacity-40" style={{ background: "var(--granate)" }}>
        {busy ? "Enviando..." : buttonLabel}
      </button>
    </div>
  );
}
