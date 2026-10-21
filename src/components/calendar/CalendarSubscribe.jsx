import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Copy, Check, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useT } from "@/i18n";

// Botón para llevar el calendario de un equipo (entrenos y partidos) al calendario del móvil.
// El enlace es privado por equipo; se actualiza solo cuando cambian los eventos en la app.
export default function CalendarSubscribe({ teamId, teamName, className = "" }) {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["ics_link", teamId],
    queryFn: () => base44.club.icsLink(teamId),
    enabled: open && !!teamId,
    staleTime: Infinity,
  });
  const url = data?.url;
  const webcal = url ? url.replace(/^https?:/, "webcal:") : null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt(t("Copia este enlace:"), url); }
  };
  const renew = async () => {
    if (!confirmNew) { setConfirmNew(true); return; }
    setBusy(true);
    try { const r = await base44.club.icsRotate(teamId); qc.setQueryData(["ics_link", teamId], r); setConfirmNew(false); }
    finally { setBusy(false); }
  };

  if (!teamId) return null;
  return (
    <>
      <Button variant="outline" size="sm" className={`h-8 text-xs border-gray-200 bg-white ${className}`} onClick={() => setOpen(true)} title={t("Llevar el calendario del equipo al móvil")}>
        <CalendarPlus className="w-3.5 h-3.5 mr-1.5" /> {t("Calendario en el móvil")}
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirmNew(false); }}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black">{t("Calendario en el móvil")}</DialogTitle>
            <DialogDescription>
              {teamName ? t("{team}: entrenos y partidos en tu calendario. Se actualiza solo cuando cambian en la app.", { team: teamName }) : t("Entrenos y partidos en tu calendario. Se actualiza solo cuando cambian en la app.")}
            </DialogDescription>
          </DialogHeader>

          {isLoading && <p className="text-sm text-gray-400 py-4 text-center">{t("Preparando enlace…")}</p>}
          {isError && <p className="text-sm text-red-600">{t("No se pudo generar el enlace. Puede que no tengas permiso sobre este equipo.")}</p>}
          {url && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a href={webcal}>
                  <Button variant="club" className="w-full"><CalendarPlus className="w-4 h-4 mr-1.5" /> {t("Añadir al calendario")}</Button>
                </a>
                <Button variant="clubOutline" onClick={copy}>
                  {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />} {copied ? t("Enlace copiado") : t("Copiar enlace")}
                </Button>
              </div>
              <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-4">
                <li><b>{t("iPhone o Mac:")}</b> {t("pulsa «Añadir al calendario» y confirma la suscripción.")}</li>
                <li><b>{t("Android o Google Calendar:")}</b> {t("copia el enlace; en calendar.google.com ve a «Otros calendarios» → «Desde URL» y pégalo. Google puede tardar unas horas en reflejar los cambios.")}</li>
              </ul>
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-[11px] text-gray-400">{t("Es un enlace privado: quien lo tenga puede ver las fechas, horas y campos del equipo (nunca datos de jugadores). Si se comparte sin querer, genera uno nuevo.")}</p>
                <Button variant="ghost" size="sm" className={`h-7 px-2 text-xs ${confirmNew ? "text-red-600 hover:text-red-700" : "text-gray-500"}`} onClick={renew} disabled={busy}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${busy ? "animate-spin" : ""}`} />
                  {confirmNew ? t("Confirmar: el enlace actual dejará de funcionar") : t("Generar enlace nuevo")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
