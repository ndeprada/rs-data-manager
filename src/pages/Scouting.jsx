import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ScoutedPlayersList from "@/components/scouting/ScoutedPlayersList.jsx";
import ObservedTeamsList from "@/components/scouting/ObservedTeamsList";
import FollowUpsList from "@/components/scouting/FollowUpsList";

export default function Scouting() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Herramientas</p>
        <h1>Scouting</h1>
        <p className="text-gray-400 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>Observación y seguimiento de jugadores</p>
      </div>

      <Tabs defaultValue="players">
        <TabsList className="bg-gray-100 border border-gray-200 h-auto flex-wrap">
          <TabsTrigger value="players" className="data-[state=active]:bg-white text-xs font-bold uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
            Jugadores
          </TabsTrigger>
          <TabsTrigger value="teams" className="data-[state=active]:bg-white text-xs font-bold uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
            Equipos Observados
          </TabsTrigger>
          <TabsTrigger value="followups" className="data-[state=active]:bg-white text-xs font-bold uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
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