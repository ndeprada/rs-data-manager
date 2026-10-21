import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Layers, BarChart2 } from "lucide-react";
import TaskLibrary from "@/components/methodology/TaskLibrary";
import SessionsHome from "@/components/sessions/SessionsHome";
import ContentControl from "@/components/sessions/ContentControl";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

import { PageTitle } from "@/components/common/PageHeader";
export default function Methodology() {
  const { isCoordinator, teamIds, selectedTeamId, perms } = useTeamAccess();

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  // Coordinadores ven todos los equipos, entrenadores solo los suyos
  const visibleTeams = isCoordinator || perms.allTeams
    ? teams
    : teams.filter(t => teamIds.includes(t.id));

  return (
    <div className="space-y-4">
      <PageTitle
        before={
          <Link to="/MyTeam" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium mb-2">
            <ArrowLeft className="w-4 h-4" /> Volver a Mi Equipo
          </Link>
        }
        kicker="Mi Equipo"
        title="Metodología"
        subtitle="Tus sesiones de entrenamiento, el control de lo que se trabaja y la biblioteca de tareas"
      />

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions" className="gap-1.5" style={{ fontFamily: "var(--font-display)" }}>
            <Layers className="w-3.5 h-3.5" /> Sesiones
          </TabsTrigger>
          <TabsTrigger value="control" className="gap-1.5" style={{ fontFamily: "var(--font-display)" }}>
            <BarChart2 className="w-3.5 h-3.5" /> Control de contenidos
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5" style={{ fontFamily: "var(--font-display)" }}>
            <BookOpen className="w-3.5 h-3.5" /> Biblioteca de Tareas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-4">
          <SessionsHome teams={visibleTeams} isCoordinator={isCoordinator} defaultTeamId={selectedTeamId} />
        </TabsContent>

        <TabsContent value="control" className="mt-4">
          <ContentControl teams={visibleTeams} isCoordinator={isCoordinator} defaultTeamId={selectedTeamId} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <TaskLibrary teams={visibleTeams} isCoordinator={isCoordinator} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
