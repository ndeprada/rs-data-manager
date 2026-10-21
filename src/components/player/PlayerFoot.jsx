import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WEAK_FOOT_FIELD, WEAK_FOOT_LEVELS, weakFootRating } from "@/lib/weakFoot";
import { FootIndicator } from "./PlayerPositionBadges";

/**
 * Lateralidad del jugador + dominio de la pierna no hábil.
 * mode: "hidden" (cuenta de jugador: solo la lateralidad de siempre), "view" (cuerpo técnico que solo consulta)
 *       o "edit" (entrenadores y coordinación: al pulsar se elige de 1 a 5 estrellas).
 * Un ambidiestro cuenta siempre con 5 estrellas y no se edita.
 */
export default function PlayerFoot({ player, light = false, mode = "view" }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const rate = useMutation({
    mutationFn: (rating) => base44.entities.Player.update(player.id, { [WEAK_FOOT_FIELD]: rating }),
    onMutate: (rating) => {
      qc.setQueryData(["players"], (old) => (Array.isArray(old) ? old.map((p) => (p.id === player.id ? { ...p, [WEAK_FOOT_FIELD]: rating } : p)) : old));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["player_by_id", player.id] });
    },
  });

  if (!player.laterality) return null;
  if (mode === "hidden") return <FootIndicator laterality={player.laterality} light={light} />;

  const rating = weakFootRating(player);
  const editable = mode === "edit" && player.laterality !== "ambidiestro";
  const indicator = <FootIndicator laterality={player.laterality} light={light} weak={{ rating, editable }} />;
  if (!editable) return indicator;

  const choose = (n) => { rate.mutate(n); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Valorar la pierna no hábil"
          className={`rounded-md px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors ${light ? "hover:bg-gray-100" : "hover:bg-white/10"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400`}>
          {indicator}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <p className="px-2 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Dominio de la pierna no hábil</p>
        <div className="space-y-0.5">
          {[5, 4, 3, 2, 1].map((n) => {
            const lv = WEAK_FOOT_LEVELS[n];
            const selected = rating === n;
            return (
              <button key={n} type="button" onClick={() => choose(n)}
                className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${selected ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                <span className="flex gap-px shrink-0" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-3 h-3" strokeWidth={1.5} style={i <= n ? { color: lv.color, fill: lv.color } : { color: "#d1d5db", fill: "none" }} />
                  ))}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-xs font-bold text-gray-800">{lv.label}</span>
                  <span className="block text-[10px] text-gray-500">{lv.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        {rating && (
          <button type="button" onClick={() => choose(null)} className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[11px] font-medium text-gray-500 hover:bg-gray-50">
            Quitar valoración
          </button>
        )}
        <p className="px-2 pt-1.5 pb-1 text-[10px] text-gray-400">Solo la ve el cuerpo técnico. El jugador no la ve.</p>
      </PopoverContent>
    </Popover>
  );
}
