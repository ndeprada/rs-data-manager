import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ScoutedPlayersList from "@/components/scouting/ScoutedPlayersList.jsx";
import ObservedTeamsList from "@/components/scouting/ObservedTeamsList";
import FollowUpsList from "@/components/scouting/FollowUpsList";
import SquadPlanning from "@/components/scouting/SquadPlanning";
import { useTeamAccess } from "@/lib/TeamAccessContext";

import { PageTitle } from "@/components/common/PageHeader";
export default function Scouting() {
  // Planificación de plantillas: solo dirección y coordinación (el servidor también lo exige)
  const { perms } = useTeamAccess();
  return (
    <div className="space-y-4">
      <PageTitle kicker="Herramientas" title="Scouting" subtitle="Observación y seguimiento de jugadores" />

      <Tabs defaultValue="players">
        <TabsList>
          <TabsTrigger value="players"  style={{ fontFamily: "var(--font-display)" }}>
            Jugadores
          </TabsTrigger>
          <TabsTrigger value="teams"  style={{ fontFamily: "var(--font-display)" }}>
            Equipos Observados
          </TabsTrigger>
          <TabsTrigger value="followups"  style={{ fontFamily: "var(--font-display)" }}>
            Seguimientos
          </TabsTrigger>
          {perms.administration && (
            <TabsTrigger value="planning" style={{ fontFamily: "var(--font-display)" }} data-testid="tab-planning">
              Planificación
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="players" className="mt-4">
          <ScoutedPlayersList />
        </TabsContent>

        <TabsContent value="teams" className="mt-4">
          <ObservedTeamsList />
        </TabsContent>

        <TabsContent value="followups" className="mt-4">
          <FollowUpsList />
        </TabsContent>

        {perms.administration && (
          <TabsContent value="planning" className="mt-4">
            <SquadPlanning />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}