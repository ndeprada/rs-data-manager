// Herramientas → Vídeo: análisis de partidos (etiquetar, playlist, editor con dibujos y seguimiento de jugadores).
// El editor es JavaScript propio (src/components/video/rsVideo.js) montado dentro de la página; el vídeo se abre
// desde el ordenador y no se sube a ningún sitio. Sus textos están en español en todos los idiomas (como la pizarra).
// Las tablas de etiquetas se guardan en RS Manager (entidad VideoTagSet): cada persona tiene las suyas y puede
// compartirlas con el club; las compartidas las ve todo el personal y solo las cambia su autor o coordinación.
import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { permissionsOf } from "@/lib/permissions";
import { mountRSVideo } from "@/components/video/rsVideo.js";
import "@/components/video/rsVideo.css";

export default function VideoAnalysis() {
  const ref = useRef(null);
  const { user } = useAuth();
  const userId = user?.id;
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    if (!userId) return undefined;
    const u = userRef.current;
    const perms = permissionsOf(u);
    const E = base44.entities.VideoTagSet;
    const tagStore = {
      me: { id: u.id, name: u.full_name || u.email || "", admin: !!(perms.isAdmin || perms.administration) },
      list: () => E.list(),
      create: (data) => E.create(data),
      update: (id, data) => E.update(id, data),
      remove: (id) => E.delete(id),
    };
    const app = mountRSVideo(ref.current, { storagePrefix: "rsv", tagStore });
    return () => app.destroy();
  }, [userId]);

  return (
    <div
      ref={ref}
      data-testid="video-analysis"
      className="w-full h-[calc(100dvh-88px)] lg:h-[calc(100dvh-32px)] min-h-[520px]"
    />
  );
}
