import React from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2, ChevronRight } from "lucide-react";
import { getCategoryLabel } from "@/components/fcfCategories";

const RESULT_COLORS = {
  win: "bg-green-100 text-green-800",
  draw: "bg-amber-100 text-amber-800",
  loss: "bg-red-100 text-red-800",
};

const TEAM_ROLE_SHORT = {
  primer_entrenador: "1er Entrenador",
  segundo_entrenador: "2º Entrenador",
  preparador_fisico: "Prep. Físico",
  entrenador_porteros: "Ent. Porteros",
  coordinador: "Coordinador",
  delegado: "Delegado",
  fisio: "Fisio",
  analista: "Analista",
  asistente: "Asistente",
};

export default function TeamsTable({ teams = [], players = [], events = [], staff = [], assignments = [], onEdit, onDelete }) {
  const getPlayerCount = (teamId) => {
    return players.filter((p) => p.team_id === teamId).length;
  };

  const getTeamStaff = (teamId) => {
    const teamAssignments = assignments.filter(a => a.team_id === teamId && a.active !== false);
    return teamAssignments
      .map(a => {
        const member = staff.find(s => s.id === a.staff_member_id);
        if (!member) return null;
        return { ...member, team_role: a.team_role };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const order = Object.keys(TEAM_ROLE_SHORT);
        return order.indexOf(a.team_role) - order.indexOf(b.team_role);
      });
  };

  const getTeamResults = (teamId) => {
    return events
      .filter((e) => e.team_id === teamId && e.type?.includes("partido") && e.score_home !== undefined && e.score_away !== undefined)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)
      .map((e) => {
        const isHome = e.is_home;
        let result;
        if (e.score_home > e.score_away) result = isHome ? "win" : "loss";
        else if (e.score_home < e.score_away) result = isHome ? "loss" : "win";
        else result = "draw";
        return { result, score: `${e.score_home}-${e.score_away}`, date: e.date };
      });
  };

  const getStats = (teamId) => {
    const teamMatches = events.filter(
      (e) => e.team_id === teamId && e.type?.includes("partido") && e.score_home !== undefined && e.score_away !== undefined
    );
    const wins = teamMatches.filter((e) => e.score_home > e.score_away).length;
    const draws = teamMatches.filter((e) => e.score_home === e.score_away).length;
    const losses = teamMatches.filter((e) => e.score_home < e.score_away).length;
    return { matches: teamMatches.length, wins, draws, losses };
  };

  return (
    <div className="overflow-x-auto border border-gray-200 rounded" style={{ borderRadius: "4px" }}>
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700" style={{ fontFamily: "var(--font-display)" }}>
              Equipo
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700" style={{ fontFamily: "var(--font-display)" }}>
              Categoría
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700" style={{ fontFamily: "var(--font-display)" }}>
              Cuerpo Técnico
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-700" style={{ fontFamily: "var(--font-display)" }}>
              Jugadores
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-700" style={{ fontFamily: "var(--font-display)" }}>
              Récord
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-700" style={{ fontFamily: "var(--font-display)" }}>
              Últimos Resultados
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-700" style={{ fontFamily: "var(--font-display)" }}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, idx) => {
            const playerCount = getPlayerCount(team.id);
            const stats = getStats(team.id);
            const results = getTeamResults(team.id);
            const teamStaff = getTeamStaff(team.id);

            return (
              <tr key={team.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {/* Team Name */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link to={`/TeamDetail?id=${team.id}`} className="flex items-center gap-2 group">
                    <img
                      src="https://media.base44.com/images/public/69b72e4f23c3602504953d0d/442c01da9_Escudo_Granate.png"
                      alt="Escudo"
                      className="w-6 h-6 object-contain"
                    />
                    <span className="font-semibold text-gray-900 group-hover:underline">{team.name}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
                  </Link>
                </td>

                {/* Category */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-xs font-bold text-gray-700" style={{ fontFamily: "var(--font-display)" }}>
                    {getCategoryLabel(team.category)}
                  </span>
                </td>

                {/* Staff */}
                <td className="px-4 py-3">
                  {teamStaff.length === 0 ? (
                    <span className="text-gray-400 text-xs">Sin asignar</span>
                  ) : (
                    <div className="space-y-0.5">
                      {teamStaff.map(m => (
                        <div key={m.id} className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-gray-900">{m.first_name} {m.last_name}</span>
                          {m.team_role && (
                            <span className="text-[10px] text-gray-400">· {TEAM_ROLE_SHORT[m.team_role] || m.team_role}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </td>

                {/* Player Count */}
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <span className="text-sm font-bold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
                    {playerCount}
                  </span>
                </td>

                {/* Record */}
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <span className="text-sm font-bold text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
                    {stats.wins}V - {stats.draws}E - {stats.losses}D
                  </span>
                </td>

                {/* Last Results */}
                <td className="px-4 py-3 text-center">
                  {results.length > 0 ? (
                    <div className="flex items-center justify-center gap-1">
                      {results.map((r, i) => (
                        <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${RESULT_COLORS[r.result]}`} title={r.score}>
                          {r.result === "win" ? "V" : r.result === "draw" ? "E" : "D"}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Sin partidos</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onEdit(team)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(team.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}