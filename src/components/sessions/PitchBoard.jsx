import React from "react";
import BoardEditor from "@/components/board/BoardEditor";
import Board from "@/components/board/BoardSvg";
import { fieldOf, hasBoard, isStadium, normalizeBoard } from "@/lib/board";

// Dibujo de tareas de entrenamiento. Usa la pizarra común (src/components/board): fichas por equipo, balón, conos,
// porterías, flechas, zonas y textos, con fotogramas para animar. Los dibujos antiguos se abren como primer fotograma.
export { hasBoard };
export { FIELDS } from "@/lib/board";

/**
 * value    dibujo guardado o null
 * onChange (nuevoValor) => void
 * roster   [{ id, label }] nombres para añadir fichas con un toque
 */
export default function PitchBoard({ value, onChange, roster = [], filename = "tarea" }) {
  return <BoardEditor value={value} onChange={onChange} roster={roster} filename={filename} modes />;
}

// Vista de solo lectura (ficha impresa y vista previa): primer fotograma (o el indicado) en el modo visual del dibujo.
// En la ficha impresa (`print`) los modos de estadio salen en blanco: sin gradas y con poca tinta.
export function PitchView({ board, frame = 0, className = "", style, print = false }) {
  const raw = normalizeBoard(board);
  const b = print && isStadium(raw.look) ? { ...raw, look: "blanco" } : raw;
  const f = b.frames[Math.min(frame, b.frames.length - 1)];
  return <Board board={b} els={f.els} className={className} style={style} label="Dibujo de la tarea" />;
}

export const boardFieldOf = (b) => fieldOf(normalizeBoard(b).field);
