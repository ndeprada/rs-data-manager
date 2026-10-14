import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, ArrowLeft } from "lucide-react";
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
      <Link to="/MyTeam" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" /> Volver a Mi Equipo
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1" style={{ fontFamily: "var(--font-display)" }}>Mi Equipo</p>
          <h1 className="text-3xl font-black uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Plantilla</h1>
        </div>
        {canSwitch && (
          <Select value={selectedTeamId} onValueChange={selectTeam}>
            <SelectTrigger className="w-56 h-10 font-bold uppercase tracking-wide text-[13px] text-white border-2 border-[#FF6E00] bg-[#73000A] hover:bg-[#36000D] shadow-md [&>span]:text-white [&>svg]:text-[#FF6E00] [&>svg]:opacity-100"><SelectValue placeholder="Seleccionar equipo" /></SelectTrigger>
            <SelectContent>{teams.filter(t => isCoordinator || (myTeamIds || []).includes(t.id)).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
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
