import React from "react";
import { Copy, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DEFAULT_CHIP, chipOf, chipStyle, teamsOf } from "@/lib/board";
import { ChipGlyph } from "./BoardSvg";
import { ColorPick, NO_FILL, Row, Slider, Toggle } from "./BoardControls";

// Edición rápida de una ficha (doble clic o doble toque sobre ella, como en FM Studio): sus textos de arriba, dentro y abajo,
// equipo, color propio, peto, fondo de los textos, pies y tamaño. El panel de abajo queda para el equipo y todas las fichas.
const btn = "h-7 px-2 rounded-md border text-[11px] font-semibold bg-white text-gray-600 border-gray-200 hover:bg-gray-50 flex items-center gap-1";

export default function ChipQuickEdit({ el, board, look, patch, onClose, onDup, onDel, canDelHere = false, style }) {
  const teams = teamsOf(board);
  const base = chipOf(board);
  const pctOne = Math.round((base / DEFAULT_CHIP) * (Number(el.size) || 1) * 100);
  const own = el.color != null || el.pattern != null || el.color2 != null || el.stroke != null;
  const bn = look === "bn";
  const nameRef = React.useRef(null);
  React.useEffect(() => { nameRef.current?.focus(); nameRef.current?.select?.(); }, [el.id]);
  return (
    <div
      className="z-20 w-[300px] max-w-[calc(100%-8px)] rounded-xl border border-gray-200 bg-white shadow-xl p-2 space-y-1.5"
      style={style}
      data-testid="chip-quick"
      role="dialog"
      aria-label="Editar esta ficha"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5">
        <ChipGlyph board={board} el={el} look={look} size={20} />
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex-1">Esta ficha</span>
        <button type="button" onClick={onClose} className="h-6 w-6 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-500" aria-label="Cerrar" title="Cerrar"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="grid grid-cols-[1fr_56px] gap-1">
        <Input value={el.labelTop || ""} onChange={(e) => patch({ labelTop: e.target.value || undefined }, "labelTop")} placeholder="Texto arriba" className="h-7 text-xs" aria-label="Texto por arriba de la ficha" />
        <Input value={el.inner || ""} maxLength={3} onChange={(e) => patch({ inner: e.target.value || undefined }, "inner")} placeholder="Nº" className="h-7 text-xs text-center" aria-label="Texto dentro de la ficha" title="Dorsal o letra (hasta 3)" />
        <Input ref={nameRef} value={el.label || ""} onChange={(e) => patch({ label: e.target.value }, "label")} placeholder="Nombre (abajo)" className="h-7 text-xs col-span-2" aria-label="Nombre de la ficha" onKeyDown={(e) => { if (e.key === "Enter") onClose(); }} />
      </div>
      <div className="flex flex-wrap gap-1 items-center" role="group" aria-label="Equipo de esta ficha">
        {teams.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.name}
            aria-label={t.name}
            aria-pressed={el.team === t.id}
            onClick={() => patch({ team: t.id })}
            className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${el.team === t.id ? "border-gray-900" : "border-transparent"}`}
          >
            <ChipGlyph board={board} el={{ team: t.id }} look={look} size={20} />
          </button>
        ))}
      </div>
      <Row>
        <ColorPick value={el.bib || ""} onChange={(c) => patch({ bib: c || undefined })} label="Peto" auto="Sin peto" autoSwatch={NO_FILL} wide />
        {!bn && <ColorPick value={own ? chipStyle(board, el).color : ""} onChange={(c) => patch(c ? { color: c } : { color: undefined, pattern: undefined, color2: undefined, stroke: undefined })} label="Color" auto="El del equipo" autoSwatch={chipStyle(board, { team: el.team }).color} wide />}
        {(el.label || el.labelTop) && <ColorPick value={el.labelBg || ""} onChange={(c) => patch({ labelBg: c || undefined })} label="Fondo de los textos" auto="Sin fondo" autoSwatch={NO_FILL} wide />}
      </Row>
      <Row>
        <Toggle on={!!el.feet} onChange={(v) => patch({ feet: v || undefined })} title="Pies: marcan hacia dónde mira">Pies</Toggle>
        <Slider label="Tamaño" value={pctOne} min={40} max={250} step={5} onChange={(v) => patch({ size: Math.round(((v / 100) * DEFAULT_CHIP / base) * 100) / 100 }, "size")} fmt={(v) => `${v}%`} width="w-20" />
      </Row>
      <div className="flex flex-wrap items-center gap-1 pt-0.5">
        <button type="button" className={btn} onClick={onDup}><Copy className="w-3.5 h-3.5" /> Duplicar</button>
        {canDelHere && <button type="button" className={btn} onClick={() => onDel(true)} title="Quitar solo de este fotograma">Solo aquí</button>}
        <button type="button" className={`${btn} text-red-600`} onClick={() => onDel(false)}><Trash2 className="w-3.5 h-3.5" /> Quitar</button>
        <button type="button" className="h-7 px-3 rounded-md border text-[11px] font-semibold ml-auto bg-gray-900 text-white border-gray-900 hover:bg-gray-800" onClick={onClose}>Hecho</button>
      </div>
    </div>
  );
}
