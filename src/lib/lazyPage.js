import { lazy } from "react";

// Carga una pantalla solo cuando se entra en ella (la app arranca más rápido).
// Si tras publicar una versión nueva el archivo antiguo ya no existe, se recarga la página una vez para coger los nuevos.
const FLAG = "rs_chunk_reload";
export function lazyPage(factory) {
  return lazy(async () => {
    try {
      const mod = await factory();
      try { sessionStorage.removeItem(FLAG); } catch { /* sin almacenamiento */ }
      return mod;
    } catch (e) {
      let tried = false;
      try { tried = sessionStorage.getItem(FLAG) === "1"; } catch { /* sin almacenamiento */ }
      if (!tried) {
        try { sessionStorage.setItem(FLAG, "1"); } catch { /* sin almacenamiento */ }
        window.location.reload();
        return new Promise(() => {}); // la página se recarga: no se sigue
      }
      throw e;
    }
  });
}
