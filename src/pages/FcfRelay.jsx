// Página que abre el marcador «RS Manager · FCF» cuando se pulsa en una pestaña de la FCF que no se abrió desde la app.
// Se presenta a esa pestaña y hace la actualización (src/components/teams/FcfRelayDialog.jsx, src/lib/fcfRelay.js).
import React, { useEffect } from "react";
import { useT } from "@/i18n";
import { PageTitle } from "@/components/common/PageHeader";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { FcfRelayStatus, useFcfRelay } from "@/components/teams/FcfRelayDialog";

export default function FcfRelay() {
  const t = useT();
  const { appRole, isAdmin } = useTeamAccess();
  const { st, pingOpener, retry, connected } = useFcfRelay();
  useEffect(() => {
    if (!pingOpener()) return undefined;
    const id = setInterval(() => { if (!connected()) pingOpener(); else clearInterval(id); }, 1000);
    return () => clearInterval(id);
  }, [pingOpener, connected]);
  const staff = !!isAdmin || (!!appRole && !["jugador", "familiar"].includes(appRole));
  return (
    <div className="max-w-xl space-y-4" data-testid="relay-page">
      <PageTitle title={t("Actualizar desde la FCF")} />
      {!staff ? (
        <p className="text-sm text-gray-600">{t("Solo el personal del club puede actualizar los datos de la FCF.")}</p>
      ) : !window.opener && st.state === "idle" ? (
        <p className="text-sm text-gray-600">{t("Abre esta página desde la web de la FCF con el marcador «RS Manager · FCF» (Equipos → Actualizar desde la FCF lo explica).")}</p>
      ) : (
        <>
          <FcfRelayStatus st={st} onRetry={connected() ? retry : null} />
          {st.state === "done" && <p className="text-sm text-gray-600">{t("Ya puedes cerrar esta pestaña y la de la FCF.")}</p>}
        </>
      )}
    </div>
  );
}
