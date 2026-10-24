import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AUTO_CHECK_GAP_MS, FCF_STATUS_KEY, requestAutoSync } from "@/lib/fcfAutoSync";

let lastCheck = 0;

/**
 * No dibuja nada. Al abrir la app (y al volver a ella pasado un rato) pregunta al servidor si toca sincronizar con la FCF;
 * si toca, lo hace él en segundo plano y, al terminar, la app recarga sus datos. Si no toca, no pasa nada.
 * Si falla, no molesta: queda anotado y se ve en la línea «Última sincronización» de Equipos.
 */
export default function AutoFcfSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const check = async () => {
      const now = Date.now();
      if (now - lastCheck < AUTO_CHECK_GAP_MS) return;
      lastCheck = now;
      try {
        const j = await requestAutoSync();
        if (j?.status) queryClient.setQueryData(FCF_STATUS_KEY, j.status);
        if (j?.ran && j.ok) queryClient.invalidateQueries();
      } catch { /* sin conexión o sin permiso: se intentará en la próxima apertura */ }
    };
    check();
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [queryClient]);
  return null;
}
