import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";
import { animationDuration, boardSpeed, elsAtTime, isAnimation, normalizeBoard } from "@/lib/board";
import Board from "./BoardSvg";

/**
 * Vista de solo lectura de un dibujo. Si es una animación, un botón la reproduce (a la velocidad con que se guardó) y
 * vuelve al primer fotograma; si es una imagen, solo la muestra.
 */
export default function BoardPlayer({ board, className = "", style, label = "Dibujo de la tarea" }) {
  const b = useMemo(() => normalizeBoard(board), [board]);
  const speed = boardSpeed(b);
  const anim = isAnimation(b);
  const [t, setT] = useState(null);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => { cancelAnimationFrame(raf.current); setT(null); }, [b]);

  const play = () => {
    cancelAnimationFrame(raf.current);
    const total = animationDuration(b, { speed });
    const t0 = performance.now();
    setT(0);
    const tick = (now) => {
      const ms = now - t0;
      if (ms >= total) { setT(null); return; }
      setT(ms);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const els = t == null ? b.frames[0].els : elsAtTime(b, t, { speed });
  return (
    <div className="relative inline-flex max-w-full" style={{ height: style?.height }}>
      <Board board={b} els={els} className={className} style={style} label={label} />
      {anim && t == null && (
        <button
          type="button"
          onClick={play}
          aria-label="Reproducir la animación"
          title="Reproducir la animación"
          className="absolute left-1.5 bottom-1.5 h-7 px-2 rounded-full bg-black/70 text-white text-[11px] font-semibold flex items-center gap-1 hover:bg-black/85"
        >
          <Play className="w-3 h-3" /> Animación
        </button>
      )}
    </div>
  );
}
