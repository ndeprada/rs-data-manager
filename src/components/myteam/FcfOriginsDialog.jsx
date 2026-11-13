// Rellenar el equipo de procedencia de todos los jugadores del club con las actas de la FCF ya cargadas (13/11/2026).
// Primero se ve qué se va a poner; al confirmar se guarda. Lo escrito a mano en la ficha no se toca.
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RS } from "@/components/rs2/kit";
import { useT } from "@/i18n";

const short = (s) => (s ? `${String(s).slice(2, 4)}-${String(s).slice(7, 9)}` : "");

export default function FcfOriginsDialog({ open, onOpenChange }) {
  const t = useT();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [tab, setTab] = useState("ok");
  const { data, isLoading, error } = useQuery({ queryKey: ["fcf-origins"], queryFn: () => base44.club.fcfOrigins(), enabled: open, staleTime: 0 });
  const apply = async () => {
    setBusy(true);
    try {
      const r = await base44.club.applyFcfOrigins();
      setDone(r.written);
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["fcf-origins"] });
    } finally { setBusy(false); }
  };
  const rows = (data?.rows || []).filter((r) => r.status === tab);
  const TABS = [["ok", t("Con procedencia")], ["sin_anterior", t("Primer año en la FCF")], ["sin_fcf", t("No están en la FCF")], ["dudoso", t("Dudosos")], ["manual", t("Escrita a mano")]];
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setDone(null); }}>
      <DialogContent className="max-w-2xl" data-testid="fcf-origins-dialog">
        <DialogHeader><DialogTitle>{t("Procedencia desde la FCF")}</DialogTitle></DialogHeader>
        <p style={{ fontSize: 12.5, color: RS.muted, margin: 0 }}>
          {t("Busca a cada jugador del club en las actas de la FCF cargadas y pone el equipo en el que jugó la temporada anterior (o la última en la que aparece). Lo escrito a mano en la ficha no se cambia.")}
        </p>
        {isLoading && <p style={{ fontSize: 13 }}>{t("Buscando en las actas…")}</p>}
        {error && <p style={{ fontSize: 13, color: "#b91c1c" }}>{t("No se ha podido consultar la FCF.")}</p>}
        {data && (
          <>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {TABS.map(([k, label]) => (
                <button key={k} type="button" onClick={() => setTab(k)} data-testid={`origins-tab-${k}`}
                  style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, border: `1px solid ${tab === k ? RS.granate : RS.line}`, background: tab === k ? RS.granate : "#fff", color: tab === k ? "#fff" : RS.ink2 }}>
                  {label} · {data[k] ?? 0}
                </button>
              ))}
            </div>
            <div style={{ maxHeight: 340, overflowY: "auto", border: `1px solid ${RS.line}`, borderRadius: 8 }}>
              <table className="w-full" style={{ fontSize: 12.5, borderCollapse: "collapse" }}>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: `1px solid ${RS.line}` }}>
                      <td style={{ padding: "4px 8px", fontWeight: 600 }}>{r.name}</td>
                      <td style={{ padding: "4px 8px", color: RS.ink2 }}>
                        {r.status === "ok" && <>{r.origin.team}{!r.origin.last_season && <span style={{ color: RS.muted }}> ({short(r.origin.season)})</span>}<span style={{ color: RS.muted }}> · {r.origin.competition}</span></>}
                        {r.status === "manual" && r.current}
                        {r.status === "dudoso" && <span style={{ color: RS.muted }}>{t("{n} jugadores con este nombre en la FCF", { n: r.options })}</span>}
                        {r.status === "sin_anterior" && <span style={{ color: RS.muted }}>{t("Solo aparece esta temporada")}</span>}
                      </td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td style={{ padding: 10, color: RS.muted }}>—</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between" style={{ gap: 8 }}>
              <span style={{ fontSize: 12.5, color: done != null ? "#15803d" : RS.muted }} data-testid="origins-done">
                {done != null ? t("Guardado en {n} fichas.", { n: done }) : t("{n} fichas recibirán su procedencia.", { n: data.ok })}
              </span>
              <button type="button" onClick={apply} disabled={busy || !data.ok} data-testid="origins-apply"
                style={{ fontSize: 13, fontWeight: 700, padding: "7px 14px", borderRadius: 8, border: 0, background: RS.granate, color: "#fff", opacity: busy || !data.ok ? 0.5 : 1 }}>
                {busy ? t("Guardando…") : t("Guardar procedencias")}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
