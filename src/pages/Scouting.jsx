import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ScoutedPlayersList from "@/components/scouting/ScoutedPlayersList.jsx";
import ObservedTeamsList from "@/components/scouting/ObservedTeamsList";
import FollowUpsList from "@/components/scouting/FollowUpsList";

import { PageTitle } from "@/components/common/PageHeader";
export default function Scouting() {
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
      </Tabs>
    </div>
  );
}