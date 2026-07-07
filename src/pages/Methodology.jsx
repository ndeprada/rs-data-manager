import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Layers, BarChart2 } from "lucide-react";
import TaskLibrary from "@/components/methodology/TaskLibrary";
import SessionList from "@/components/methodology/SessionList";
import MethodologyStats from "@/components/methodology/MethodologyStats";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function Methodology() {
  const { isCoordinator, teamIds, selectedTeamId } = useTeamAccess();

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  // Coordinadores ven todos los equipos, entrenadores solo los suyos
  const visibleTeams = isCoordinator
    ? teams
    : teams.filter(t => teamIds.includes(t.id));

  return (
    <div className="space-y-4">
      <div>
        <h1 style={{ color: "var(--granate)", fontFamily: "var(--font-display)" }}>
          Metodología
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Biblioteca de tareas, planificación de sesiones y análisis del trabajo</p>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList className="bg-gray-100 border border-gray-200">
          <TabsTrigger value="sessions" className="data-[state=active]:bg-white text-xs font-bold uppercase tracking-wide gap-1.5" style={{ fontFamily: "var(--font-display)" }}>
            <Layers className="w-3.5 h-3.5" /> Sesiones
          </TabsTrigger>
          <TabsTrigger value="tasks" className="data-[state=active]:bg-white text-xs font-bold uppercase tracking-wide gap-1.5" style={{ fontFamily: "var(--font-display)" }}>
            <BookOpen className="w-3.5 h-3.5" /> Biblioteca de Tareas
          </TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:bg-white text-xs font-bold uppercase tracking-wide gap-1.5" style={{ fontFamily: "var(--font-display)" }}>
            <BarChart2 className="w-3.5 h-3.5" /> Análisis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-4">
          <SessionList teams={visibleTeams} isCoordinator={isCoordinator} defaultTeamId={selectedTeamId} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <TaskLibrary teams={visibleTeams} isCoordinator={isCoordinator} />
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <MethodologyStats teams={visibleTeams} isCoordinator={isCoordinator} selectedTeamId={selectedTeamId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}