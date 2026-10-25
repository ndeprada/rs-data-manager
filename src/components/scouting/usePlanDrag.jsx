import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CHIP } from "./squadPlanUi";

// Arrastrar a una persona del plan a otro puesto del campo. Con el ratón se agarra desde cualquier punto de la ficha; con el dedo, desde el asa
// (así el resto de la ficha sigue sirviendo para desplazar la página). Los puestos se marcan con `data-zone-drop="<clave>"`.
// Un toque o un clic sin movimiento no arrastra nada (abre la ficha como siempre).
const THRESHOLD = 6;

function zoneAt(x, y) {
  if (typeof document === "undefined" || !document.elementsFromPoint) return null;
  for (const el of document.elementsFromPoint(x, y)) {
    const z = el.closest?.("[data-zone-drop]");
    if (z) return z.getAttribute("data-zone-drop");
  }
  return null;
}

/** El contenedor que se desplaza con la página (o la propia página) a partir de un elemento. */
function scrollerOf(el) {
  for (let n = el?.parentElement; n && n !== document.body; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return document.scrollingElement || document.documentElement;
}
const EDGE = 64; // px del borde de la pantalla a partir de los que el arrastre desplaza la página
const MAX_STEP = 16;

/** onDrop(item, zoneKey) se llama al soltar sobre un puesto distinto del que ya tiene la persona. */
export function usePlanDrag({ onDrop, disabled = false }) {
  const [drag, setDrag] = useState(null); // {item, x, y, over}
  const live = useRef(null);
  const justDragged = useRef(false);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const cleanup = useRef(() => {});
  useEffect(() => () => cleanup.current(), []);

  const grab = useCallback((e, item) => {
    if (disabled || (e.button != null && e.button > 0)) return;
    const st = { item, x0: e.clientX, y0: e.clientY, on: false, x: e.clientX, y: e.clientY };
    live.current = st;
    const prevSelect = document.body.style.userSelect;
    const scroller = scrollerOf(e.target);
    let raf = 0;
    // Cerca del borde de arriba o de abajo, el arrastre desplaza la página (si no, en el móvil no se podría llegar a un puesto lejano)
    const autoScroll = () => {
      raf = 0;
      if (!st.on) return;
      const isDoc = scroller === document.scrollingElement || scroller === document.documentElement;
      const r = isDoc ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
      const top = Math.max(0, r.top), bottom = Math.min(window.innerHeight, r.bottom);
      let step = 0;
      if (st.y < top + EDGE) step = -Math.ceil(((top + EDGE - st.y) / EDGE) * MAX_STEP);
      else if (st.y > bottom - EDGE) step = Math.ceil(((st.y - (bottom - EDGE)) / EDGE) * MAX_STEP);
      if (!step) return;
      const before = scroller.scrollTop;
      scroller.scrollTop = before + Math.max(-MAX_STEP, Math.min(MAX_STEP, step));
      if (scroller.scrollTop !== before) setDrag({ item, x: st.x, y: st.y, over: zoneAt(st.x, st.y) });
      raf = requestAnimationFrame(autoScroll);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      document.body.style.userSelect = prevSelect;
      live.current = null;
    };
    const move = (ev) => {
      if (!st.on) {
        if (Math.hypot(ev.clientX - st.x0, ev.clientY - st.y0) < THRESHOLD) return;
        st.on = true;
        document.body.style.userSelect = "none";
      }
      st.x = ev.clientX; st.y = ev.clientY;
      setDrag({ item, x: ev.clientX, y: ev.clientY, over: zoneAt(ev.clientX, ev.clientY) });
      if (!raf) raf = requestAnimationFrame(autoScroll);
    };
    const up = (ev) => {
      const moved = st.on;
      stop();
      cleanup.current = () => {};
      if (!moved) return;
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 80);
      setDrag(null);
      const over = zoneAt(ev.clientX, ev.clientY);
      if (over && over !== item.zone) onDropRef.current(item, over);
    };
    const cancel = () => { stop(); cleanup.current = () => {}; setDrag(null); };
    cleanup.current = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }, [disabled]);

  /** ¿Acaba de terminar un arrastre? (entonces el «clic» que lo sigue no debe abrir la ficha) */
  const wasDrag = useCallback(() => justDragged.current, []);
  return { drag, grab, wasDrag };
}

/** La ficha que sigue al puntero mientras se arrastra. */
export function DragGhost({ drag }) {
  if (!drag || typeof document === "undefined") return null;
  const it = drag.item;
  return createPortal(
    <div
      data-testid="plan-drag-ghost"
      className={`fixed z-[200] pointer-events-none rounded-md border px-2 py-1 text-[12px] font-semibold shadow-xl ${CHIP[it.status] || CHIP.continua} ${drag.over ? "ring-2 ring-white" : ""}`}
      style={{ left: drag.x + 14, top: drag.y + 10, maxWidth: 220 }}
    >
      {it.name}
    </div>,
    document.body,
  );
}
