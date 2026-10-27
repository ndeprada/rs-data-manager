import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ScoutedPlayersList from "@/components/scouting/ScoutedPlayersList.jsx";
import ObservedTeamsList from "@/components/scouting/ObservedTeamsList";
import FollowUpsList from "@/components/scouting/FollowUpsList";
import SquadPlanning from "@/components/scouting/SquadPlanning";
import FcfDatabase from "@/components/scouting/FcfDatabase";
import { useTeamAccess } from "@/lib/TeamAccessContext";

import { PageTitle } from "@/components/common/PageHeader";

// Planificación (27/10/2026, pedido por Nacho): dos apartados.
//  · Plantillas: el campograma de la temporada siguiente (antes la pestaña «Planificación» de Scouting).
//  · Scouting: la fuente de jugadores (observados, equipos, seguimientos y la base de datos de la FCF).
// Plantillas y Base de datos FCF: solo dirección y coordinación (el servidor también lo exige).
const TOP_CLS = "data-[state=active]:bg-[var(--granate)] data-[state=active]:text-white px-4";
const FONT = { fontFamily: "var(--font-display)" };

export default function Scouting() {
  const { perms } = useTeamAccess();
  const admin = !!perms.administration;
  return (
    <div className="space-y-4">
      <PageTitle kicker="Herramientas" title="Planificación" subtitle="Plantillas de la próxima temporada y scouting" />

      <Tabs defaultValue={admin ? "plantillas" : "scouting"}>
        {admin && (
          <TabsList className="mb-1">
            <TabsTrigger value="plantillas" className={TOP_CLS} style={FONT} data-testid="tab-planning">Plantillas</TabsTrigger>
            <TabsTrigger value="scouting" className={TOP_CLS} style={FONT} data-testid="tab-scouting">Scouting</TabsTrigger>
          </TabsList>
        )}

        {admin && (
          <TabsContent value="plantillas" className="mt-4">
            <SquadPlanning />
          </TabsContent>
        )}

        <TabsContent value="scouting" className="mt-3">
          <Tabs defaultValue="players">
            <TabsList>
              <TabsTrigger value="players" style={FONT}>Jugadores</TabsTrigger>
              {admin && <TabsTrigger value="fcf" style={FONT} data-testid="tab-fcf">Base de datos FCF</TabsTrigger>}
              <TabsTrigger value="teams" style={FONT}>Equipos Observados</TabsTrigger>
              <TabsTrigger value="followups" style={FONT}>Seguimientos</TabsTrigger>
            </TabsList>
            <TabsContent value="players" className="mt-4"><ScoutedPlayersList /></TabsContent>
            {admin && <TabsContent value="fcf" className="mt-4"><FcfDatabase /></TabsContent>}
            <TabsContent value="teams" className="mt-4"><ObservedTeamsList /></TabsContent>
            <TabsContent value="followups" className="mt-4"><FollowUpsList /></TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
