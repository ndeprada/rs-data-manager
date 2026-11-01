import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { boardView } from "@/lib/board";
import { load3d } from "./load3d";

/**
 * Vista 3D de un fotograma (solo ver): mismas props de encuadre que Board (camera, frame, aspect, fullView, viewOverride).
 * Ocupa el ancho del contenedor con la proporción de lo que se ve (como el SVG del 2D) y se vuelve a dibujar al cambiar
 * el dibujo, los elementos o el tamaño. El motor (three.js) se carga la primera vez.
 */
const Board3DView = forwardRef(function Board3DView({ board, els, camera, frame = 0, aspect = null, fullView = false, viewOverride = null, className = "", style, label = "Vista 3D", fill = false, sel = null, draft = null, canvasStyle = null, ...events }, ref) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const [box, setBox] = useState(null);
  const [ready, setReady] = useState(false);
  const { vb } = boardView(board, { camera, frame, aspect, fullView, viewOverride });
  const ar = vb[2] / vb[3];

  // tamaño disponible
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // lo que se dibuja: siempre lo último que llega (si llegan cambios mientras dibuja, se dibuja una vez más al acabar)
  const latest = useRef(null);
  latest.current = { board, els, opts: { camera, frame, aspect, fullView, viewOverride, sel, draft } };
  const busy = useRef(false);
  const again = useRef(false);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => {
    if (!box || !box.w) return;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(async function draw() {
      if (busy.current) { again.current = true; return; }
      busy.current = true;
      try {
        const lib = await load3d();
        const c = canvas.current;
        if (!c) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let w = box.w, h = fill ? box.h : w / ar;
        if (fill && w / h > ar) w = h * ar; else if (fill) h = w / ar;
        if (!fill && style?.maxHeight && h > style.maxHeight) { h = style.maxHeight; w = h * ar; }
        const pw = Math.max(2, Math.round(w * dpr)), ph = Math.max(2, Math.round(h * dpr));
        if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
        c.style.width = `${Math.round(w)}px`;
        c.style.height = `${Math.round(h)}px`;
        const cur = latest.current;
        const pending = lib.drawBoard3D(c, cur.board, cur.els, cur.opts);
        setReady(true);
        if (pending) pending.then(() => { again.current = false; raf.current = requestAnimationFrame(draw); });
      } catch (e) {
        console.warn("Vista 3D", e);
      } finally {
        busy.current = false;
        if (again.current) { again.current = false; raf.current = requestAnimationFrame(draw); }
      }
    });
  }, [box, board, els, camera, frame, aspect, fullView, viewOverride, ar, fill, style?.maxHeight, sel, draft]);

  // Para dibujar en 3D (editor): puntero → campo, qué hay debajo y dónde cae en pantalla un punto del campo
  const libRef = useRef(null);
  useEffect(() => { load3d().then((l) => { libRef.current = l; }); }, []);
  const px = (e) => { const c = canvas.current, r = c.getBoundingClientRect(); return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height }; };
  useImperativeHandle(ref, () => ({
    ground: (e) => { const l = libRef.current; if (!l || !canvas.current) return null; const q = px(e); return l.groundAt(canvas.current, q.x, q.y); },
    pickable: (el) => Boolean(libRef.current?.pickable3D(el)),
    pick: (list, e) => { const l = libRef.current; if (!l || !canvas.current) return null; const q = px(e); return l.pickAt(canvas.current, list, q.x, q.y); },
    toScreen: (x, y, h = 0) => {
      const l = libRef.current, c = canvas.current;
      if (!l || !c) return null;
      const q = l.projectAt(c, x, y, h);
      if (!q) return null;
      const r = c.getBoundingClientRect();
      return { x: r.left + (q.x * r.width) / c.width, y: r.top + (q.y * r.height) / c.height };
    },
  }), []);

  return (
    <div ref={wrap} className={`${className} flex items-center justify-center`} style={{ ...style, ...(fill ? {} : { aspectRatio: String(ar) }), position: "relative" }} role="img" aria-label={label} data-testid="board-3d">
      <canvas ref={canvas} style={{ display: "block", maxWidth: "100%", ...(canvasStyle || {}) }} {...events} />
      {!ready && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-white/80">Cargando 3D…</span>}
    </div>
  );
});
export default Board3DView;
