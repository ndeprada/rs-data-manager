// Guardado automático de un formulario.
//  · Compara el contenido actual con lo último guardado y, si cambia, guarda 0,8 s después del último cambio.
//  · Los guardados van en cola, de uno en uno, para que dos cambios seguidos no se pisen.
//  · Si se sale de la pestaña (o se oculta la página) con algo sin guardar, se guarda en ese momento.
//  · state: idle (nada pendiente) · pending · saving · saved · error  → se muestra con <SaveStatus />.
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * value   objeto serializable con TODO lo que se guarda (se compara como JSON)
 * enabled false hasta que los datos del servidor ya están cargados en el formulario (así no se guarda lo vacío)
 * save    async (value) => … guarda en el servidor; si lanza un error, el estado pasa a «error»
 */
export function useAutosave({ value, enabled, save, delay = 800 }) {
  const [state, setState] = useState("idle");
  const snap = JSON.stringify(value);
  const latest = useRef({ value, snap, save });
  latest.current = { value, snap, save };
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const savedSnap = useRef(snap); // lo último guardado (o cargado del servidor)
  const chain = useRef(Promise.resolve());
  const inflight = useRef(0);
  const failed = useRef(false);
  const mounted = useRef(true);
  const timer = useRef(null);

  const isDirty = () => enabledRef.current && latest.current.snap !== savedSnap.current;

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (!isDirty()) return chain.current;
    inflight.current += 1;
    if (mounted.current) setState("saving");
    chain.current = chain.current
      .then(async () => {
        const { value: v, snap: s, save: doSave } = latest.current;
        if (s === savedSnap.current) return; // ya lo guardó un guardado anterior
        await doSave(v);
        savedSnap.current = s;
      })
      .then(() => {}, (err) => { failed.current = true; console.error("Autoguardado:", err); })
      .then(() => {
        inflight.current -= 1;
        if (inflight.current > 0 || !mounted.current) return;
        setState(failed.current ? "error" : isDirty() ? "pending" : "saved");
        failed.current = false;
      });
    return chain.current;
  }, []);

  // Cuando se carga lo que hay en el servidor: eso cuenta como «ya guardado»
  const reset = useCallback((loadedValue) => {
    savedSnap.current = JSON.stringify(loadedValue);
    setState("idle");
  }, []);

  useEffect(() => {
    if (!enabled || snap === savedSnap.current) return undefined;
    setState("pending");
    timer.current = setTimeout(flush, delay);
    return () => clearTimeout(timer.current);
  }, [snap, enabled]);

  useEffect(() => {
    mounted.current = true;
    const onHide = () => { if (document.visibilityState === "hidden" && isDirty()) flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      mounted.current = false;
      if (isDirty()) flush();
    };
  }, []);

  return { state, flush, reset };
}
