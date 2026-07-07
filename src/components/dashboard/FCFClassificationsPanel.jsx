import React from "react";
import { TrendingUp, ExternalLink } from "lucide-react";
import FCFTeamStanding from "./FCFTeamStanding";

export default function FCFClassificationsPanel({ teams }) {
  const teamsWithFCF = teams.filter((t) => t.fcf_group_url);

  if (teamsWithFCF.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
        <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Sin enlaces FCF vinculados</p>
        <p className="text-gray-400 text-sm mt-1">
          Añade el enlace del grupo FCF a cada equipo para ver su clasificación aquí.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gray-400" />
          <h2 className="font-semibold text-lg text-gray-900">Clasificaciones FCF</h2>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
          {teamsWithFCF.length} equipo{teamsWithFCF.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {teamsWithFCF.map((team) => (
          <FCFTeamStanding key={team.id} team={team} />
        ))}
      </div>
    </div>
  );
}