import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useT } from "@/i18n";

// Avisa cuando hay una versión nueva de la app publicada, para no seguir trabajando con una pantalla antigua.
// Compara el archivo principal que está cargado con el que sirve ahora el servidor.
const entryOf = (html) => (html.match(/assets\/index-[\w-]+\.js/) || [])[0] || null;

export default function UpdateNotice() {
  const t = useT();
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const cur = document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute("src")?.replace(/^\//, "");
    if (!cur) return undefined; // en desarrollo no hay archivo con código de versión
    let stop = false;
    const check = async () => {
      if (stop || document.visibilityState !== "visible") return;
      try {
        const html = await fetch(`/?v=${Date.now()}`, { cache: "no-store" }).then((r) => r.text());
        const now = entryOf(html);
        if (now && now !== cur && !stop) setStale(true);
      } catch { /* sin conexión: se vuelve a comprobar luego */ }
    };
    const timer = setInterval(check, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", check);
    return () => { stop = true; clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, []);

  if (!stale) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100vw-2rem)]">
      <button type="button" onClick={() => window.location.reload()}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-white text-xs font-bold"
        style={{ background: "var(--granate)" }}>
        <RefreshCw className="w-3.5 h-3.5 shrink-0" /> {t("Hay una versión nueva de la app. Pulsa para actualizar")}
      </button>
    </div>
  );
}
