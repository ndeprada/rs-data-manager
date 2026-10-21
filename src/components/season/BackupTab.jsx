import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, DatabaseBackup, Save, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useT, useLocaleTag, msg } from "@/i18n";

const KIND = { auto: msg("Automática (noche)"), manual: msg("Manual"), pre_close: msg("Antes de cerrar temporada") };
const fmtDate = (d, tag) => new Date(d).toLocaleString(tag, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Copias de seguridad de los datos del club: descarga inmediata, copia guardada en el servidor y lista de las últimas.
export default function BackupTab() {
  const t = useT();
  const tag = useLocaleTag();
  const qc = useQueryClient();
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);
  const { data: list = [], isLoading } = useQuery({ queryKey: ["backups"], queryFn: () => base44.club.backupList() });

  const run = async (key, fn, okText) => {
    setBusy(key); setNotice(null);
    try { await fn(); setNotice({ ok: true, text: okText }); qc.invalidateQueries({ queryKey: ["backups"] }); }
    catch (e) { setNotice({ ok: false, text: e.message || t("No se pudo completar") }); }
    setBusy("");
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 shadow-sm p-4 space-y-3" style={{ borderRadius: "4px" }}>
        <div className="flex items-start gap-3">
          <DatabaseBackup className="w-5 h-5 mt-0.5" style={{ color: "var(--granate)" }} />
          <div className="text-sm text-gray-600 space-y-1">
            <p className="font-bold text-gray-900">{t("Copias de seguridad")}</p>
            <p>{t("Cada noche se guarda una copia automática (las últimas 14) y otra justo antes de cerrar una temporada. Aquí puedes descargar una copia al momento o guardar una más.")}</p>
            <p className="text-xs text-gray-400">{t("Incluyen todos los datos de la app (equipos, jugadores, partidos, asistencia…). No incluyen contraseñas ni las fotos y archivos subidos, que se conservan aparte.")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="club" onClick={() => run("dl", () => base44.club.backupDownload(), t("Copia descargada en tu ordenador."))} disabled={!!busy}>
            {busy === "dl" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />} {t("Descargar copia ahora")}
          </Button>
          <Button variant="clubOutline" onClick={() => run("save", () => base44.club.backupCreate(), t("Copia guardada en el servidor."))} disabled={!!busy}>
            {busy === "save" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />} {t("Guardar copia en el servidor")}
          </Button>
        </div>
        {notice && <p className={`text-xs font-semibold ${notice.ok ? "text-green-700" : "text-red-600"}`}>{notice.text}</p>}
      </div>

      <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
          {t("Copias guardadas en el servidor")}
        </div>
        {isLoading ? (
          <p className="p-6 text-center text-sm text-gray-400">{t("Cargando…")}</p>
        ) : list.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">{t("Todavía no hay copias guardadas. La primera automática se guardará esta noche.")}</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map((b) => (
              <div key={b.id} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{fmtDate(b.created_at, tag)}</p>
                  <p className="text-gray-400 truncate">{KIND[b.kind] ? t(KIND[b.kind]) : b.kind}{b.note && b.kind === "manual" ? ` · ${b.note}` : ""}{b.note && b.kind === "pre_close" ? ` · ${b.note}` : ""} · {t("{n} registros", { n: b.entity_count.toLocaleString(tag) })} · {fmtSize(b.size_bytes)}</p>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!!busy}
                  onClick={() => run(`dl${b.id}`, () => base44.club.backupDownload(b.id), t("Copia descargada en tu ordenador."))}>
                  {busy === `dl${b.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-[11px] text-gray-400">{t("Para recuperar datos de una copia, pídeselo a quien gestiona la app: la restauración no se hace desde aquí para evitar accidentes.")}</p>
    </div>
  );
}
