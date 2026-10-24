// Sincronización con la FCF sin pulsar el botón: la app avisa al servidor al abrirse y él decide si toca (api/sync-fcf.js, syncStatus.js).
export const FCF_STATUS_KEY = ["fcf-sync-status"];

async function callSyncApi(query) {
  const r = await fetch(`/api/sync-fcf?${query}`, { credentials: "include" });
  if (!r.ok) throw new Error(`sync-fcf ${r.status}`);
  return r.json();
}

/** Cuándo fue la última sincronización y cómo salió */
export const fetchFcfStatus = () => callSyncApi("status=1");
/** «Sincroniza solo si toca»: devuelve { ran, ok, status, … } */
export const requestAutoSync = () => callSyncApi("auto=1");

// Mientras la app sigue abierta, volver a ella pasado un rato también cuenta como «abrirla»; el servidor decide si toca de verdad
export const AUTO_CHECK_GAP_MS = 10 * 60 * 1000;

/** Fecha válida o null (evita errores de formato con datos raros) */
export const validDate = (iso) => {
  const ms = Date.parse(iso || "");
  return Number.isFinite(ms) ? new Date(ms) : null;
};
