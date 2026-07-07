import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const TAG_CATEGORIES = [
  {
    key: "ataque",
    label: "Ataque",
    color: "orange",
    titleClass: "text-orange-600",
    activeClass: "bg-orange-500 text-white border-orange-500",
    inactiveClass: "bg-white text-orange-600 border-orange-300 hover:bg-orange-50",
    tags: [
      "Finalizador", "Corre al espacio", "Profundo", "Llegador", "Regateador",
      "Tiro media distancia", "Juego entre líneas", "Asistidor", "Desequilibrante",
      "Presión alta", "Pivote ofensivo",
    ],
  },
  {
    key: "defensa",
    label: "Defensa",
    color: "blue",
    titleClass: "text-blue-600",
    activeClass: "bg-blue-600 text-white border-blue-600",
    inactiveClass: "bg-white text-blue-600 border-blue-300 hover:bg-blue-50",
    tags: [
      "Ganador de duelos", "Interceptador", "Recuperador", "Marcador", "Pressing",
      "Colocación", "Juego de cabeza", "Salida de balón", "Agresivo", "Anticipación",
    ],
  },
  {
    key: "mental",
    label: "Mental / Físico",
    color: "green",
    titleClass: "text-green-600",
    activeClass: "bg-green-600 text-white border-green-600",
    inactiveClass: "bg-white text-green-600 border-green-300 hover:bg-green-50",
    tags: [
      "Personalidad", "Inteligente", "Rápido", "Físico", "Resistencia",
      "Liderazgo", "Competitivo", "Desarrollo tardío", "Polivalente", "Visión 360",
    ],
  },
  {
    key: "portero",
    label: "Portero",
    color: "yellow",
    titleClass: "text-yellow-600",
    activeClass: "bg-yellow-500 text-white border-yellow-500",
    inactiveClass: "bg-white text-yellow-600 border-yellow-300 hover:bg-yellow-50",
    tags: [
      "Bajo palos", "Salidas", "Juego con los pies", "Mando del área",
      "Reflejos", "1vs1", "Saques largos", "Comunicación",
    ],
    onlyPosition: "portero",
  },
];

export default function PlayerTagsPanel({ player }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [draftTags, setDraftTags] = useState(player.tags || []);
  const [dirty, setDirty] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (tags) => base44.entities.ScoutedPlayer.update(player.id, { tags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouted_players"] });
      setDirty(false);
      toast({ title: "Atributos guardados." });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleTag = (tag) => {
    setDraftTags(prev => {
      const next = prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag];
      setDirty(true);
      return next;
    });
  };

  const visibleCategories = TAG_CATEGORIES.filter(
    cat => !cat.onlyPosition || player.position === cat.onlyPosition
  );

  return (
    <div className="space-y-5">
      {visibleCategories.map(cat => (
        <div key={cat.key}>
          <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${cat.titleClass}`} style={{ fontFamily: "var(--font-display)" }}>
            {cat.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {cat.tags.map(tag => {
              const active = draftTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${active ? cat.activeClass : cat.inactiveClass}`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {dirty && (
        <div className="pt-2">
          <Button
            onClick={() => saveMutation.mutate(draftTags)}
            disabled={saveMutation.isPending}
            size="sm"
            className="text-white"
            style={{ background: "var(--granate)" }}
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            {saveMutation.isPending ? "Guardando..." : "Guardar atributos"}
          </Button>
        </div>
      )}
    </div>
  );
}