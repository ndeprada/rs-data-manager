import React from "react";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BOARD_SHORTCUTS } from "@/lib/boardKeys";

// Ayuda con los atajos de teclado de la pizarra (botón del teclado o Mayús + H)
export default function BoardHelp({ open, onOpenChange }) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-8 px-2" title="Atajos de teclado (Mayús + H)" aria-label="Atajos de teclado">
          <Keyboard className="w-3.5 h-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,560px)] p-3" data-testid="board-help">
        <p className="text-xs font-bold text-gray-800 mb-2">Atajos de teclado</p>
        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
          {BOARD_SHORTCUTS.map((g) => (
            <div key={g.group}>
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">{g.group}</p>
              <ul className="space-y-0.5">
                {g.items.map(([k, label]) => (
                  <li key={k + label} className="flex items-center justify-between gap-3 text-[11px] text-gray-700">
                    <span>{label}</span>
                    <kbd className="shrink-0 rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-700">{k}</kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-gray-500">Funcionan con el cursor sobre la pizarra (haz clic en ella primero). En Mac, Cmd en lugar de Ctrl.</p>
      </PopoverContent>
    </Popover>
  );
}
