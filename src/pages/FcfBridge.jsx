// Puente entre la intranet de la FCF y la base de datos de Planificación → Scouting (27/10/2026).
// La intranet abre esta página en una ventana (con un clic en el botón que el lector pone en la intranet) y le pasa las
// actas leídas por mensajes entre ventanas; esta página las guarda con la sesión de quien está conectado
// (api/club.js?a=fcf_import, solo dirección, coordinación y administración) y contesta cuántas se han guardado.
// Solo acepta mensajes que vengan de https://intranet.fcf.cat.
import React, { useEffect, useRef, useState } from "react";
import { Database, CheckCircle2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { PageTitle } from "@/components/common/PageHeader";

const FCF_ORIGIN = "https://intranet.fcf.cat";

export default function FcfBridge() {
  const { perms } = useTeamAccess();
  const allowed = !!perms.administration;
  const [stats, setStats] = useState({ batches: 0, saved: 0, skipped: 0, errors: 0, last: null });
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    if (!allowed) return undefined;
    const reply = (src, msg) => { try { src?.postMessage(msg, FCF_ORIGIN); } catch { /* ventana cerrada */ } };
    const onMessage = (ev) => {
      if (ev.origin !== FCF_ORIGIN) return;
      const d = ev.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "rs-fcf-ping") { reply(ev.source, { type: "rs-fcf-ready" }); return; }
      if (d.type !== "rs-fcf-batch" || !Array.isArray(d.actas)) return;
      // De uno en uno, en el orden en que llegan
      queue.current = queue.current.then(async () => {
        try {
          const r = await base44.club.fcfImport(d.actas.slice(0, 60));
          setStats((s) => ({ ...s, batches: s.batches + 1, saved: s.saved + (r.saved || 0), skipped: s.skipped + (r.skipped || 0), last: new Date() }));
          reply(ev.source, { type: "rs-fcf-ack", id: d.id, ok: true, saved: r.saved, skipped: r.skipped });
        } catch (e) {
          setStats((s) => ({ ...s, errors: s.errors + 1, last: new Date() }));
          reply(ev.source, { type: "rs-fcf-ack", id: d.id, ok: false, error: String(e?.message || e) });
        }
      });
    };
    window.addEventListener("message", onMessage);
    // Avisar a la intranet de que ya se puede enviar
    reply(window.opener, { type: "rs-fcf-ready" });
    return () => window.removeEventListener("message", onMessage);
  }, [allowed]);

  if (!allowed) {
    return <div className="bg-white border border-gray-200 rounded-xl p-8 text-sm text-gray-500">Solo dirección y coordinación pueden cargar datos de la FCF.</div>;
  }

  return (
    <div className="space-y-4 max-w-xl">
      <PageTitle kicker="Planificación · Scouting" title="Carga de datos FCF" subtitle="Deja esta ventana abierta mientras se leen las actas en la intranet" />
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4" data-testid="fcf-bridge">
        <div className="flex items-center gap-2 text-sm">
          <Database className="w-5 h-5 text-[var(--granate)]" />
          {stats.batches ? <span>Recibiendo actas de la intranet FCF</span> : <span>Esperando a la intranet FCF…</span>}
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-[#FBF8F8] p-3"><div className="text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>{stats.saved}</div><div className="text-xs text-gray-500">actas guardadas</div></div>
          <div className="rounded-lg bg-[#FBF8F8] p-3"><div className="text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>{stats.batches}</div><div className="text-xs text-gray-500">lotes</div></div>
          <div className="rounded-lg bg-[#FBF8F8] p-3"><div className="text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>{stats.errors}</div><div className="text-xs text-gray-500">errores</div></div>
        </div>
        {stats.last && (
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            {stats.errors ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
            Último lote: {stats.last.toLocaleTimeString("es-ES")}
          </p>
        )}
      </div>
    </div>
  );
}
