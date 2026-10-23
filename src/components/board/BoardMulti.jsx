import React from "react";
import { BringToFront, ChevronDown, ChevronUp, Copy, Minus, Plus, SendToBack, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isCarried, teamsOf } from "@/lib/board";
import { ChipGlyph } from "./BoardSvg";
import { ColorPick, Row, Toggle } from "./BoardControls";

// Panel de varios elementos a la vez (selección múltiple) y botones de capas (orden de dibujo), que también se usan con uno solo.

const PLURAL = {
  token: ["ficha", "fichas"], ball: ["balón", "balones"], cone: ["cono", "conos"], goal: ["portería", "porterías"], pole: ["pica", "picas"],
  hurdle: ["valla", "vallas"], ladder: ["escalera", "escaleras"], dummy: ["maniquí", "maniquíes"], arrow: ["flecha", "flechas"],
  zone: ["zona", "zonas"], link: ["conector", "conectores"], text: ["texto", "textos"],
};
export const describeSelection = (els) => {
  const n = {};
  for (const e of els) n[e.k] = (n[e.k] || 0) + 1;
  return Object.entries(n).map(([k, c]) => `${c} ${(PLURAL[k] || [k, k])[c === 1 ? 0 : 1]}`).join(", ");
};

const btn = "h-7 px-2 gap-1 text-xs";

/** Orden de capas: al frente · subir un nivel · bajar un nivel · al fondo */
export function LayerButtons({ onLayer }) {
  const items = [
    { id: "front", label: "Al frente", icon: BringToFront, title: "Poner encima de todo" },
    { id: "up", label: "Subir", icon: ChevronUp, title: "Subir un nivel: pasa por encima de lo que lo tapa" },
    { id: "down", label: "Bajar", icon: ChevronDown, title: "Bajar un nivel: pasa por debajo de lo que tiene debajo" },
    { id: "back", label: "Al fondo", icon: SendToBack, title: "Poner debajo de todo" },
  ];
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Capas">
      <span className="text-[11px] font-semibold text-gray-600">Capas</span>
      {items.map(({ id, label, icon: Icon, title }) => (
        <Button key={id} type="button" size="sm" variant="outline" className={btn} onClick={() => onLayer(id)} title={title}>
          <Icon className="w-3.5 h-3.5" /> {label}
        </Button>
      ))}
    </div>
  );
}

// Más / menos con un valor en medio (para el tamaño y la separación)
function Step({ label, onLess, onMore, lessTitle, moreTitle }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <span className="text-[11px] font-semibold text-gray-600">{label}</span>
      <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" onClick={onLess} title={lessTitle} aria-label={lessTitle}><Minus className="w-3.5 h-3.5" /></Button>
      <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" onClick={onMore} title={moreTitle} aria-label={moreTitle}><Plus className="w-3.5 h-3.5" /></Button>
    </div>
  );
}

/**
 * els       elementos elegidos (dos o más)
 * frames    número de fotogramas (para «Solo aquí»)
 * onTeam / onColor / onFeet / onResize(factor) / onSpread(factor) / onLayer(dónde) / onDup / onDel(soloAquí) / onClear
 */
export default function MultiPanel({ els, board, look, frames, onTeam, onColor, onFeet, onResize, onSpread, onLayer, onDup, onDel, onClear }) {
  const tokens = els.filter((e) => e.k === "token");
  const teams = teamsOf(board);
  const teamOfAll = tokens.length && tokens.every((t) => t.team === tokens[0].team) ? tokens[0].team : null;
  const allFeet = tokens.length > 0 && tokens.every((t) => t.feet);
  const sizable = els.some((e) => e.k !== "zone" && e.k !== "link");
  const spreadable = els.filter((e) => e.k !== "link").length > 1;
  const colorable = look !== "bn";
  const carried = els.some(isCarried);
  return (
    <div className="rounded-lg border px-2 py-1.5 space-y-1.5 bg-amber-50 border-amber-200" data-testid="board-multi">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">{els.length} elegidos</span>
        <span className="text-[11px] text-amber-800 flex-1 min-w-[100px]">{describeSelection(els)} · arrastra cualquiera para moverlos juntos</span>
        <Button type="button" size="sm" variant="outline" className={btn} onClick={onClear} title="Dejar de elegir"><X className="w-3.5 h-3.5" /> Soltar</Button>
      </div>
      {(tokens.length > 0 || colorable) && (
        <Row>
          {tokens.length > 0 && (
            <div className="flex gap-1 items-center" role="group" aria-label="Equipo de las fichas elegidas">
              <span className="text-[11px] font-semibold text-gray-600">Equipo</span>
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={`Pasar las ${tokens.length} fichas a ${t.name}`}
                  aria-label={t.name}
                  aria-pressed={teamOfAll === t.id}
                  onClick={() => onTeam(t.id)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${teamOfAll === t.id ? "border-gray-900" : "border-transparent"}`}
                >
                  <ChipGlyph board={board} el={{ team: t.id }} look={look} size={20} />
                </button>
              ))}
            </div>
          )}
          {colorable && <ColorPick value="" onChange={onColor} label="Color de todo" wide />}
          {tokens.length > 0 && <Toggle on={allFeet} onChange={onFeet} title="Pies en todas las fichas elegidas">Pies</Toggle>}
        </Row>
      )}
      <Row>
        {sizable && <Step label="Tamaño" onLess={() => onResize(1 / 1.15)} onMore={() => onResize(1.15)} lessTitle="Más pequeño" moreTitle="Más grande" />}
        {spreadable && <Step label="Separación" onLess={() => onSpread(1 / 1.15)} onMore={() => onSpread(1.15)} lessTitle="Juntar" moreTitle="Separar" />}
        <LayerButtons onLayer={onLayer} />
      </Row>
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <Button type="button" size="sm" variant="outline" className={btn} onClick={onDup} title="Duplicar todo lo elegido"><Copy className="w-3.5 h-3.5" /> Duplicar</Button>
        {carried && frames > 1 && <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onDel(true)} title="Quitar solo de este fotograma">Solo aquí</Button>}
        <Button type="button" size="sm" variant="outline" className={`${btn} text-red-600`} onClick={() => onDel(false)} title={carried && frames > 1 ? "Quitar de todos los fotogramas" : "Quitar"}><Trash2 className="w-3.5 h-3.5" /> Quitar</Button>
      </div>
    </div>
  );
}
