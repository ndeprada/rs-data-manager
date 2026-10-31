import React, { useState } from "react";
import { KIT_GROUPS, kitPatch, sameKit } from "@/lib/boardKits";
import { ChipGlyph } from "./BoardSvg";

// Galería «Equipaciones» (como el menú de fichas de FmStadio): pestañas por grupo y una cuadrícula de fichas con su nombre.
// Tocar una equipación se la pone al equipo entero (color, dibujo, forma botón/camiseta y ribetes).
export default function BoardKitPicker({ team, onPick, look }) {
  const [group, setGroup] = useState(() => KIT_GROUPS.find((g) => g.kits.some((k) => sameKit(team, k)))?.id || KIT_GROUPS[0].id);
  const cur = KIT_GROUPS.find((g) => g.id === group) || KIT_GROUPS[0];
  return (
    <div className="w-full rounded-lg border border-[#2b3550] bg-[#0f1a2e] p-2" data-testid="kit-picker">
      <div className="flex flex-wrap gap-1 mb-2" role="tablist" aria-label="Grupos de equipaciones">
        {KIT_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={g.id === group}
            onClick={() => setGroup(g.id)}
            data-testid={`kit-group-${g.id}`}
            className={`h-7 px-2.5 rounded-md border text-[11px] font-semibold ${g.id === group ? "bg-white text-[#0f1a2e] border-white" : "bg-transparent text-[#f2c55c] border-[#c9a24a] hover:bg-white/10"}`}
          >
            {g.name}
          </button>
        ))}
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))" }}>
        {cur.kits.map((k) => {
          const on = sameKit(team, k);
          return (
            <button
              key={k.name}
              type="button"
              onClick={() => onPick(kitPatch(k))}
              title={k.name}
              data-testid={`kit-${cur.id}-${k.name}`}
              className={`flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-center ${on ? "border-white bg-white/15" : "border-[#c9a24a]/70 hover:bg-white/10"}`}
            >
              <ChipGlyph board={{ teams: [{ id: "k", name: k.name, ...kitPatch(k) }] }} el={{ team: "k" }} look={look === "bn" ? "estadio" : look} size={30} />
              <span className="text-[10px] leading-tight font-medium text-[#f2c55c]">{k.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
