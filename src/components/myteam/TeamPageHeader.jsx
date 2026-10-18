import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useSelectedTeam } from "@/lib/useSelectedTeam";
import { getCategoryLabel } from "@/components/fcfCategories";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/common/PageHeader";

// Selector de equipo con el estilo del club (borde granate)
export const TeamSelectTrigger = ({ placeholder }) => (
  <SelectTrigger className="w-52 h-9 font-bold text-[13px] text-[#73000A] border border-[#73000A] bg-white hover:bg-[#FDF2F4] [&>span]:text-[#73000A] [&>svg]:text-[#73000A] [&>svg]:opacity-100"><SelectValue placeholder={placeholder} /></SelectTrigger>
);

// Cabecera común de las subsecciones de Mi Equipo: volver, etiqueta, título, subtítulo (equipo · categoría)
// y a la derecha el selector de equipo + controles propios de cada pantalla (children).
export default function TeamPageHeader({ title, children }) {
  const { selectedTeamId, selectTeam, isCoordinator, canSwitch, teamIds: myTeamIds } = useSelectedTeam();
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const team = teams.find((t) => t.id === selectedTeamId);
  return (
    <PageHeader
      before={
        <Link to="/MyTeam" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium mb-2">
          <ArrowLeft className="w-4 h-4" /> Volver a Mi Equipo
        </Link>
      }
      kicker="Mi Equipo"
      title={title}
      subtitle={[team?.name, team && getCategoryLabel(team.category)].filter(Boolean).join(" · ")}
      actions={
        <>
          {children}
          {canSwitch && (
            <Select value={selectedTeamId} onValueChange={selectTeam}>
              <TeamSelectTrigger />
              <SelectContent>{teams.filter((t) => isCoordinator || (myTeamIds || []).includes(t.id)).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </>
      }
    />
  );
}
