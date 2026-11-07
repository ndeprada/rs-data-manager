// «Actualizar desde la FCF» (07/11/2026): la FCF ya no deja leer al servidor, así que los datos los trae el navegador desde la propia web
// de la FCF con el marcador «RS Manager · FCF» (src/lib/fcfRelay.js + public/fcf-relay.js). Esta ventana da el marcador (con la llave
// personal de quien la abre) y explica los pasos; mientras está abierta, la línea de la última sincronización se actualiza sola.
import React, { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Bookmark, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/i18n";
import { FCF_STATUS_KEY } from "@/lib/fcfAutoSync";
import { FCF_HOME, bookmarkletCode } from "@/lib/fcfRelay";
import FcfSyncLine from "@/components/teams/FcfSyncLine";

async function fetchKey() {
  const r = await fetch("/api/sync-fcf?relay=key", { credentials: "include" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.key) throw new Error(j.error || `Error ${r.status}`);
  return j.key;
}

/** El marcador para arrastrar a la barra (React no deja poner javascript: en el href: se pone a mano) */
export function RelayBookmark({ relayKey }) {
  const t = useT();
  const ref = useRef(null);
  useEffect(() => { if (relayKey) ref.current?.setAttribute("href", bookmarkletCode(window.location.origin, relayKey)); }, [relayKey]);
  return (
    <a ref={ref} href="#" onClick={(e) => e.preventDefault()} draggable="true" data-testid="relay-bookmark"
      title={t("Arrástralo a la barra de marcadores")}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-white shadow-sm cursor-grab select-none"
      style={{ background: "#73000A" }}>
      <Bookmark className="w-4 h-4" aria-hidden="true" /> RS Manager · FCF
    </a>
  );
}

export default function FcfRelayDialog({ open, onOpenChange }) {
  const t = useT();
  const qc = useQueryClient();
  const { data: key, isLoading, error } = useQuery({ queryKey: ["fcf-relay-key"], queryFn: fetchKey, enabled: open, staleTime: Infinity, retry: 1 });
  // Mientras la ventana está abierta, se mira cada 10 s si ya terminó (la actualización se ve en la pestaña de la FCF)
  useEffect(() => {
    if (!open) return undefined;
    const id = setInterval(() => qc.invalidateQueries({ queryKey: FCF_STATUS_KEY }), 10_000);
    return () => clearInterval(id);
  }, [open, qc]);
  const close = (v) => { onOpenChange(v); if (!v) qc.invalidateQueries(); };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg" data-testid="relay-dialog">
        <DialogTitle>{t("Actualizar desde la FCF")}</DialogTitle>
        <p className="text-sm text-gray-600">
          {t("La FCF ya no deja que la app lea sus datos por su cuenta. Se traen desde tu navegador, con la web de la FCF abierta: equipos, jugadores, partidos, actas, clasificaciones y rivales.")}
        </p>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="w-6 h-6 shrink-0 rounded-full bg-gray-100 grid place-items-center font-bold text-gray-700">1</span>
            <div className="space-y-1.5">
              <p><b>{t("Solo la primera vez:")}</b> {t("arrastra este botón a tu barra de marcadores.")}</p>
              {key ? <RelayBookmark relayKey={key} />
                : isLoading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" aria-hidden="true" />
                  : error ? <p className="text-red-700">{t("No se pudo preparar el marcador: {error}", { error: error.message })}</p> : null}
              <p className="text-xs text-gray-500">{t("Si no ves la barra: Cmd + Mayús + B en Mac, Ctrl + Mayús + B en Windows.")}</p>
              <p className="text-xs text-gray-500">{t("El marcador es personal: lleva tu permiso para actualizar. No lo compartas.")}</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 shrink-0 rounded-full bg-gray-100 grid place-items-center font-bold text-gray-700">2</span>
            <div>
              <a href={FCF_HOME} target="_blank" rel="noopener" data-testid="relay-open-fcf"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-semibold text-gray-800 hover:bg-gray-50">
                <ExternalLink className="w-4 h-4" aria-hidden="true" /> {t("Abrir la web de la FCF")}
              </a>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 shrink-0 rounded-full bg-gray-100 grid place-items-center font-bold text-gray-700">3</span>
            <p>{t("En la web de la FCF, pulsa el marcador «RS Manager · FCF». Abajo a la derecha verás cómo va (tarda un minuto); al terminar, la línea de aquí abajo se actualiza.")}</p>
          </li>
        </ol>
        <div className="pt-1"><FcfSyncLine /></div>
      </DialogContent>
    </Dialog>
  );
}
