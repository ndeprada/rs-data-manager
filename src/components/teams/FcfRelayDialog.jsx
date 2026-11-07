// «Actualizar desde la FCF» (07/11/2026): la FCF ya no deja leer al servidor, así que los datos los trae el navegador (src/lib/fcfRelay.js).
// La ventana explica los pasos (marcador «RS Manager · FCF» la primera vez, abrir la web de la FCF y pulsar el marcador allí) y enseña
// cómo va. La misma pieza (FcfRelayPanel) la usa la página /FcfRelay cuando el marcador se pulsa en una pestaña de la FCF abierta a mano.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Loader2, ExternalLink, Bookmark } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/i18n";
import { FCF_STATUS_KEY } from "@/lib/fcfAutoSync";
import { FCF_HOME, RELAY_WINDOW, bookmarkletCode, isFcfOrigin, relayPost, runRelay } from "@/lib/fcfRelay";

const BATCH = 25;
const WAIT_MS = 120_000;

/** Conecta con la pestaña de la FCF y hace las vueltas. */
export function useFcfRelay() {
  const qc = useQueryClient();
  const [st, setSt] = useState({ state: "idle" });
  const peer = useRef(null);
  const opened = useRef(null);
  const busy = useRef(false);
  const pending = useRef(new Map());

  const ask = useCallback((urls) => new Promise((resolve, reject) => {
    const p = peer.current;
    if (!p?.win || p.win.closed) { reject(new Error("Se ha cerrado la pestaña de la FCF")); return; }
    const id = Math.random().toString(36).slice(2);
    const timer = setTimeout(() => { pending.current.delete(id); reject(new Error("La FCF tarda demasiado en contestar")); }, WAIT_MS);
    pending.current.set(id, (out) => { clearTimeout(timer); resolve(out); });
    try { p.win.postMessage({ t: "rs-relay-get", id, urls }, p.origin); }
    catch (e) { clearTimeout(timer); pending.current.delete(id); reject(e); }
  }), []);

  const fetchUrls = useCallback(async (urls) => {
    const out = [];
    for (let i = 0; i < urls.length; i += BATCH) out.push(...(await ask(urls.slice(i, i + BATCH))));
    return out;
  }, [ask]);

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setSt({ state: "running", step: { job: "sync", phase: "server", round: 1 } });
    try {
      const result = await runRelay({ post: relayPost, fetchUrls, onStep: (step) => setSt({ state: "running", step }) });
      setSt({ state: "done", result });
      qc.invalidateQueries();
      qc.invalidateQueries({ queryKey: FCF_STATUS_KEY });
      try { opened.current && !opened.current.closed && opened.current.close(); } catch { /* otra ventana */ }
    } catch (e) {
      setSt({ state: "error", error: e?.message || String(e) });
    } finally {
      busy.current = false;
    }
  }, [fetchUrls, qc]);

  useEffect(() => {
    const onMsg = (ev) => {
      if (!isFcfOrigin(ev.origin)) return;
      const d = ev.data || {};
      if (d.t === "rs-relay-hello") {
        peer.current = { win: ev.source, origin: ev.origin };
        if (!busy.current) start();
      } else if (d.t === "rs-relay-got") {
        const done = pending.current.get(d.id);
        if (done) { pending.current.delete(d.id); done(Array.isArray(d.out) ? d.out : []); }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [start]);

  const openFcf = useCallback(() => {
    opened.current = window.open(FCF_HOME, RELAY_WINDOW);
    setSt((s) => (s.state === "running" ? s : { state: "waiting" }));
  }, []);

  // Página abierta por el marcador: la pestaña de la FCF es la que la abrió
  const pingOpener = useCallback(() => {
    const o = window.opener;
    if (!o) return false;
    for (const origin of ["https://www.fcf.cat", "https://fcf.cat"]) { try { o.postMessage({ t: "rs-relay-ping" }, origin); } catch { /* otra web */ } }
    setSt((s) => (s.state === "idle" ? { state: "waiting" } : s));
    return true;
  }, []);

  return { st, openFcf, pingOpener, retry: start, connected: () => !!peer.current?.win && !peer.current.win.closed };
}

/** Cómo va: espera, vueltas, resultado o error */
export function FcfRelayStatus({ st, onRetry }) {
  const t = useT();
  if (st.state === "idle") return null;
  if (st.state === "waiting") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-testid="relay-waiting">
        <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin" aria-hidden="true" />
        <span>{t("Esperando a la web de la FCF… En esa pestaña, pulsa el marcador «RS Manager · FCF».")}</span>
      </div>
    );
  }
  if (st.state === "running") {
    const s = st.step || {};
    const text = s.job === "standings"
      ? t("Clasificaciones y rivales… (vuelta {n})", { n: s.round || 1 })
      : s.phase === "fcf" ? t("Leyendo en la FCF {n} datos del club…", { n: s.count || 0 })
        : s.phase === "save" ? t("Guardando {n} datos…", { n: s.count || 0 })
          : t("Comprobando qué falta… (vuelta {n})", { n: s.round || 1 });
    return (
      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800" data-testid="relay-running">
        <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin" aria-hidden="true" />
        <span>{text}</span>
      </div>
    );
  }
  if (st.state === "done") {
    const s = st.result?.sync || {};
    return (
      <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900" data-testid="relay-done">
        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          {t("Hecho. Partidos nuevos: {a} · actualizados: {b} · jugadores nuevos: {c} · equipos nuevos: {d}.", { a: s.matches_created || 0, b: s.matches_updated || 0, c: s.players_created || 0, d: s.teams_created || 0 })}
          {s.errors?.length ? " " + t("Avisos: {n}", { n: s.errors.length }) : ""}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900" data-testid="relay-error">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{t("No se pudo actualizar: {error}", { error: st.error })}</span>
      {onRetry && <button type="button" onClick={onRetry} className="underline font-semibold">{t("Reintentar")}</button>}
    </div>
  );
}

/** El marcador para arrastrar a la barra (React no deja poner javascript: en el href: se pone a mano) */
export function RelayBookmark() {
  const t = useT();
  const ref = useRef(null);
  useEffect(() => { ref.current?.setAttribute("href", bookmarkletCode(window.location.origin)); }, []);
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
  const { st, openFcf, retry, connected } = useFcfRelay();
  const busy = st.state === "running";
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
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
              <RelayBookmark />
              <p className="text-xs text-gray-500">{t("Si no ves la barra: Cmd + Mayús + B en Mac, Ctrl + Mayús + B en Windows.")}</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 shrink-0 rounded-full bg-gray-100 grid place-items-center font-bold text-gray-700">2</span>
            <div>
              <button type="button" onClick={openFcf} disabled={busy} data-testid="relay-open-fcf"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50">
                <ExternalLink className="w-4 h-4" aria-hidden="true" /> {t("Abrir la web de la FCF")}
              </button>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 shrink-0 rounded-full bg-gray-100 grid place-items-center font-bold text-gray-700">3</span>
            <p>{t("En la pestaña de la FCF, pulsa el marcador «RS Manager · FCF». Esta ventana hace el resto (tarda un minuto) y cierra la pestaña al terminar.")}</p>
          </li>
        </ol>
        <FcfRelayStatus st={st} onRetry={connected() ? retry : openFcf} />
      </DialogContent>
    </Dialog>
  );
}
