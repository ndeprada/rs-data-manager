import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Search, X } from "lucide-react";
import { BLOCKS, PRIORITY, blockInfo, contentBlock, contentName, priorityOf, stageContents, stageInfo, targetPct } from "@/lib/sessionPlan";

const MAX_PRINCIPAL = 2;
const MAX_SECONDARY = 2;

// Chip de un contenido ya elegido (en la tarea y en la ficha)
export function ContentChip({ id, stage, kind, onRemove }) {
  const pr = priorityOf(stage, id);
  const b = blockInfo(contentBlock(id));
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border pl-2 ${onRemove ? "pr-1" : "pr-2"} py-0.5 text-[11px] font-semibold ${kind === "principal" ? "bg-[var(--granate-pale)] border-[var(--granate)]/30 text-[var(--granate)]" : "bg-gray-50 border-gray-300 text-gray-600"}`} title={b?.label}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: b?.color || "#999" }} />
      {contentName(id)}
      {pr && <span className="text-[9px] font-black rounded px-1" style={{ background: PRIORITY[pr].bg, color: PRIORITY[pr].color }} title={`Prioridad ${PRIORITY[pr].label.toLowerCase()} en la etapa`}>{PRIORITY[pr].short}</span>}
      {!pr && <span className="text-[9px] rounded px-1 bg-amber-100 text-amber-700" title="Este contenido no es de la etapa del equipo">otra etapa</span>}
      {onRemove && <button type="button" onClick={onRemove} className="p-0.5 rounded-full hover:bg-black/10" aria-label={`Quitar ${contentName(id)}`}><X className="w-3 h-3" /></button>}
    </span>
  );
}

/**
 * Elegir los contenidos de una tarea: 1 o 2 principales y hasta 2 secundarios, de los contenidos de la etapa.
 */
export default function ContentPicker({ open, onOpenChange, stage, principal = [], secondary = [], onChange }) {
  const [mode, setMode] = useState("principal");
  const [q, setQ] = useState("");
  const list = useMemo(() => stageContents(stage), [stage]);
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtered = q.trim() ? list.filter((c) => norm(c.name).includes(norm(q.trim()))) : list;

  const toggle = (id) => {
    if (principal.includes(id)) return onChange({ principal: principal.filter((x) => x !== id), secondary });
    if (secondary.includes(id)) return onChange({ principal, secondary: secondary.filter((x) => x !== id) });
    if (mode === "principal") {
      if (principal.length >= MAX_PRINCIPAL) return;
      return onChange({ principal: [...principal, id], secondary });
    }
    if (secondary.length >= MAX_SECONDARY) return;
    onChange({ principal, secondary: [...secondary, id] });
  };

  const full = mode === "principal" ? principal.length >= MAX_PRINCIPAL : secondary.length >= MAX_SECONDARY;
  const info = stageInfo(stage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 shrink-0">
          <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Contenidos de la tarea</DialogTitle>
          <DialogDescription className="text-xs">
            {info ? `${info.label} (${info.teams}). ` : ""}Elige 1 o 2 contenidos <b>principales</b> (los que buscas y corriges) y hasta 2 <b>secundarios</b> (los que aparecen y también corriges).
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-2 space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-1.5">
            {[["principal", `Principales ${principal.length}/${MAX_PRINCIPAL}`], ["secondary", `Secundarios ${secondary.length}/${MAX_SECONDARY}`]].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setMode(k)}
                className={`h-9 rounded-lg border text-sm font-bold ${mode === k ? (k === "principal" ? "bg-[var(--granate)] text-white border-[var(--granate)]" : "bg-gray-700 text-white border-gray-700") : "bg-white text-gray-600 border-gray-200"}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500">
            Tocas un contenido para añadirlo como <b>{mode === "principal" ? "principal" : "secundario"}</b>{full ? " (ya has elegido el máximo: quita uno para cambiarlo)" : ""}. El bloque del <b>primer principal</b> es donde cuenta el tiempo de la tarea.
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar contenido…" className="pl-8 h-9" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">
          {BLOCKS.map((b) => {
            const items = filtered.filter((c) => c.block === b.id);
            if (!items.length) return null;
            return (
              <div key={b.id}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                  <span className="text-[11px] font-black uppercase tracking-wide text-gray-600" style={{ fontFamily: "var(--font-display)" }}>{b.label}</span>
                  <span className="text-[10px] text-gray-400">{targetPct(b.id, stage)}% de referencia</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((c) => {
                    const isP = principal.includes(c.id), isS = secondary.includes(c.id);
                    const blocked = !isP && !isS && full;
                    return (
                      <button key={c.id} type="button" onClick={() => toggle(c.id)} disabled={blocked}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${isP ? "bg-[var(--granate)] text-white border-[var(--granate)]" : isS ? "bg-gray-700 text-white border-gray-700" : blocked ? "bg-white text-gray-300 border-gray-100" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
                        {(isP || isS) && <Check className="w-3 h-3" />}
                        {c.name}
                        <span className="text-[9px] font-black rounded px-1" style={{ background: PRIORITY[c.priority].bg, color: PRIORITY[c.priority].color }}>{PRIORITY[c.priority].short}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {!filtered.length && <p className="text-sm text-gray-400 text-center py-6">No hay contenidos con ese nombre en esta etapa.</p>}
          <p className="text-[10px] text-gray-400 pt-1">A = prioridad alta · M = media · B = baja (currículum de la etapa).</p>
        </div>

        <div className="p-3 border-t border-gray-100 flex items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap gap-1 min-w-0">
            {principal.map((id) => <ContentChip key={id} id={id} stage={stage} kind="principal" onRemove={() => toggle(id)} />)}
            {secondary.map((id) => <ContentChip key={id} id={id} stage={stage} kind="secondary" onRemove={() => toggle(id)} />)}
          </div>
          <Button variant="club" onClick={() => onOpenChange(false)} className="shrink-0">Listo</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
