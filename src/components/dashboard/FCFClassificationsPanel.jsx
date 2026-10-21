import React from "react";
import { TrendingUp } from "lucide-react";
import FCFTeamStanding from "./FCFTeamStanding";
import { useT } from "@/i18n";

export default function FCFClassificationsPanel({ teams }) {
  const t = useT();
  const teamsWithFCF = teams.filter((tm) => tm.fcf_group_url);

  if (teamsWithFCF.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
        <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">{t("Sin enlaces FCF vinculados")}</p>
        <p className="text-gray-400 text-sm mt-1">
          {t("Añade el enlace del grupo FCF a cada equipo para ver su clasificación aquí.")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gray-400" />
          <h2 className="font-semibold text-lg text-gray-900">{t("Clasificaciones FCF")}</h2>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
          {teamsWithFCF.length === 1 ? t("{n} equipo", { n: 1 }) : t("{n} equipos", { n: teamsWithFCF.length })}
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