// Herramientas → Vídeo: análisis de partidos (etiquetar, playlist, editor con dibujos y seguimiento de jugadores).
// El editor es JavaScript propio (src/components/video/rsVideo.js) montado dentro de la página; el vídeo se abre
// desde el ordenador y no se sube a ningún sitio. Sus textos están en español en todos los idiomas (como la pizarra).
import { useEffect, useRef } from "react";
import { mountRSVideo } from "@/components/video/rsVideo.js";
import "@/components/video/rsVideo.css";

export default function VideoAnalysis() {
  const ref = useRef(null);
  useEffect(() => {
    const app = mountRSVideo(ref.current, { storagePrefix: "rsv" });
    return () => app.destroy();
  }, []);
  return (
    <div
      ref={ref}
      data-testid="video-analysis"
      className="w-full h-[calc(100dvh-88px)] lg:h-[calc(100dvh-32px)] min-h-[520px]"
    />
  );
}
