import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, ArrowLeft } from "lucide-react";
import TeamPageHeader from "@/components/myteam/TeamPageHeader";
import { useSelectedTeam } from "@/lib/useSelectedTeam";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AddPlayerDialog from "@/components/team/AddPlayerDialog";
import TeamSquadTable from "@/components/team/TeamSquadTable";

// Plantilla: misma tabla (y mismas estadísticas) que el resumen del equipo.
export default function Squad() {
  const { selectedTeamId, selectTeam, canSwitch, isCoordinator, teamIds: myTeamIds } = useSelectedTeam();
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });

  return (
    <div className="space-y-4">
      <TeamPageHeader title="Plantilla"></TeamPageHeader>
      {selectedTeamId ? (
        <TeamSquadTable teamId={selectedTeamId} onAddPlayer={() => setAddPlayerOpen(true)} />
      ) : (
        <div className="bg-white border border-gray-200 p-12 text-center" style={{ borderRadius: "4px" }}>
          <Users className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>Selecciona un equipo</p>
        </div>
      )}
      <AddPlayerDialog open={addPlayerOpen} onOpenChange={setAddPlayerOpen} teamId={selectedTeamId} />
    </div>
  );
}
