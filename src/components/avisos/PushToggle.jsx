import React, { useEffect, useState } from "react";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { pushState, enablePush, disablePush } from "@/lib/push";

// Botón para activar los avisos en este móvil/ordenador. Explica qué falta si no se puede.
export default function PushToggle() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => pushState().then(setState);
  useEffect(() => { refresh(); }, []);

  const toggle = async () => {
    setBusy(true); setError("");
    try {
      if (state === "on") await disablePush(); else await enablePush();
    } catch (e) { setError(e.message || "No se pudo cambiar"); }
    await refresh();
    setBusy(false);
  };

  if (!state) return null;

  const box = "bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3";
  if (state === "needs_install") {
    return (
      <div className={box}>
        <Smartphone className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500">Para recibir avisos en iPhone, primero instala la app: <b>Compartir → «Añadir a pantalla de inicio»</b> y ábrela desde el icono.</p>
      </div>
    );
  }
  if (state === "unsupported") {
    return <div className={box}><BellOff className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" /><p className="text-xs text-gray-500">Este navegador no admite avisos. Prueba con Chrome (Android) o con la app instalada (iPhone).</p></div>;
  }
  if (state === "denied") {
    return <div className={box}><BellOff className="w-5 h-5 text-red-400 shrink-0 mt-0.5" /><p className="text-xs text-gray-500">Has bloqueado las notificaciones para esta app. Actívalas en los ajustes del navegador o del móvil.</p></div>;
  }
  const on = state === "on";
  return (
    <div className={box}>
      {on ? <Bell className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--granate)" }} /> : <BellOff className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900">{on ? "Avisos activados en este dispositivo" : "Avisos desactivados"}</p>
        <p className="text-xs text-gray-400">{on ? "Recibirás los avisos del club en este móvil." : "Actívalos para recibir los avisos del club en este móvil."}</p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <button onClick={toggle} disabled={busy}
        className={`shrink-0 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-full disabled:opacity-40 ${on ? "border border-gray-200 text-gray-500" : "text-white"}`}
        style={on ? undefined : { background: "var(--granate)" }}>
        {busy ? "..." : on ? "Desactivar" : "Activar"}
      </button>
    </div>
  );
}
