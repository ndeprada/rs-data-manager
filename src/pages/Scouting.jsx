import React from "react";
import SquadPlanning from "@/components/scouting/SquadPlanning";
import { Page, TopBar, SubNav } from "@/components/rs2/kit";
import ScoutingHome from "@/components/planning/ScoutingHome";
import ScoutDatabase from "@/components/planning/ScoutDatabase";
import ScoutTeams from "@/components/planning/ScoutTeams";
import ScoutReports from "@/components/planning/ScoutReports";
import ScoutAlerts from "@/components/planning/ScoutAlerts";
import ScoutPlayer from "@/components/planning/ScoutPlayer";
import { useAlerts, usePlanningNav, useIsPlanningAdmin } from "@/components/planning/useScouting";

// Planificación (27-28/10/2026, pedido por Nacho; diseño y contenido de las maquetas que aprobó):
//  · Plantillas: el campograma de la temporada siguiente (solo dirección y coordinación).
//  · Scouting: Resumen · Base de datos · Equipos y grupos · Informes · Alertas, y la ficha de cada jugador.
// La pantalla se elige con la dirección (?t=…&s=…) para que «atrás» funcione y se pueda enlazar.
export default function Scouting() {
  const admin = useIsPlanningAdmin();
  const { get, go } = usePlanningNav();
  const top = admin && get("t") !== "scouting" && (get("t") === "plantillas" || !get("s")) ? "plantillas" : "scouting";
  const sub = get("s") || "resumen";
  const alerts = useAlerts(admin && top === "scouting");

  const subs = [
    { key: "resumen", label: "Resumen" },
    { key: "bd", label: "Base de datos" },
    { key: "equipos", label: "Equipos y grupos" },
    { key: "informes", label: "Informes" },
    ...(admin ? [{ key: "alertas", label: "Alertas", badge: alerts.fresh.length }] : []),
  ];
  const activeSub = sub === "jugador" ? null : sub;

  return (
    <Page testId="planning-page">
      <TopBar title="Planificación" active={top}
        tabs={admin ? [{ key: "plantillas", label: "Plantillas", testId: "tab-planning" }, { key: "scouting", label: "Scouting", testId: "tab-scouting" }] : [{ key: "scouting", label: "Scouting", testId: "tab-scouting" }]}
        onTab={(k) => go(k === "plantillas" ? { t: "plantillas", s: null } : { t: "scouting", s: "resumen" })}>
        {top === "scouting" && <SubNav label="Scouting" items={subs} active={activeSub} onChange={(k) => go({ t: "scouting", s: k })} />}
      </TopBar>
      <div className="rs2-wrap">
        {top === "plantillas" ? <SquadPlanning /> : (
          <>
            {sub === "resumen" && <ScoutingHome />}
            {sub === "bd" && <ScoutDatabase />}
            {sub === "equipos" && <ScoutTeams />}
            {sub === "informes" && <ScoutReports />}
            {sub === "alertas" && admin && <ScoutAlerts />}
            {sub === "jugador" && <ScoutPlayer />}
          </>
        )}
      </div>
    </Page>
  );
}
