import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, TrendingUp, RefreshCw, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { getCategoryLabel } from "@/components/fcfCategories";

const RESULT_COLORS = {
  W: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", label: "V" },
  D: { bg: "#fefce8", color: "#ca8a04", border: "#fde68a", label: "E" },
  L: { bg: "#fdf2f4", color: "#8B1A2B", border: "#fecdd3", label: "D" },
};

async function fetchTeamStanding(fcfUrl) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Visita esta URL de la Federació Catalana de Futbol: ${fcfUrl}
    
Extrae los siguientes datos de la clasificación del grupo:
1. El nombre del equipo principal o el equipo que gestiona este grupo (busca el equipo con más relevancia o el que aparece destacado)
2. La posición en la clasificación de ese equipo (número de posición)
3. Los puntos totales del equipo
4. El número de partidos jugados (PJ), ganados (PG), empatados (PE), perdidos (PP)
5. Los últimos 5 resultados en orden cronológico (W=victoria, D=empate, L=derrota)
6. El nombre del grupo/competición

Si no puedes determinar cuál es el equipo del club, devuelve los datos del equipo en primera posición.
Si la página no está disponible o no hay datos de clasificación, devuelve null en todos los campos.`,
    add_context_from_internet: true,
    response_json_schema: {
      type: "object",
      properties: {
        team_name: { type: "string" },
        position: { type: "number" },
        points: { type: "number" },
        played: { type: "number" },
        won: { type: "number" },
        drawn: { type: "number" },
        lost: { type: "number" },
        last_results: {
          type: "array",
          items: { type: "string", enum: ["W", "D", "L"] }
        },
        competition_name: { type: "string" },
        available: { type: "boolean" }
      }
    }
  });
  return result;
}

export default function FCFTeamStanding({ team }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["fcf-standing", team.id, refreshKey],
    queryFn: () => fetchTeamStanding(team.fcf_group_url),
    staleTime: 1000 * 60 * 30, // 30 min cache
    retry: 1,
  });

  const positionColor = data?.position <= 3
    ? "var(--granate)"
    : data?.position <= 6
    ? "var(--naranja)"
    : "#6b7280";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="https://media.base44.com/images/public/69b72e4f23c3602504953d0d/442c01da9_Escudo_Granate.png"
            alt="Escudo"
            className="w-8 h-8 object-contain shrink-0"
          />
          <div className="min-w-0">
            <Link to={`/TeamDetail?id=${team.id}`} className="font-semibold text-gray-900 hover:underline text-sm truncate block">
              {team.name}
            </Link>
            <p className="text-xs text-gray-400 truncate">{getCategoryLabel(team.category)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <a
            href={team.fcf_group_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Ver en FCF"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-8 bg-gray-100 rounded-lg w-1/2" />
            <div className="h-4 bg-gray-100 rounded w-3/4" />
            <div className="flex gap-1 mt-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-6 w-6 bg-gray-100 rounded-full" />)}
            </div>
          </div>
        ) : isError || data?.available === false ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>No se pudieron cargar los datos. <button onClick={() => setRefreshKey(k => k + 1)} className="underline hover:text-gray-600">Reintentar</button></span>
          </div>
        ) : data ? (
          <>
            {/* Position + Points */}
            <div className="flex items-end gap-4 mb-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Posición</p>
                <p className="text-3xl font-bold" style={{ color: positionColor }}>
                  {data.position ? `${data.position}º` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Puntos</p>
                <p className="text-3xl font-bold text-gray-800">{data.points ?? "—"}</p>
              </div>
              {data.played != null && (
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-400">PJ {data.played}</p>
                  <p className="text-xs text-gray-500">
                    {data.won}G · {data.drawn}E · {data.lost}P
                  </p>
                </div>
              )}
            </div>

            {/* Competition name */}
            {data.competition_name && (
              <p className="text-xs text-gray-400 mb-3 truncate">{data.competition_name}</p>
            )}

            {/* Last results */}
            {data.last_results?.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Últimos resultados</p>
                <div className="flex gap-1">
                  {data.last_results.map((r, i) => {
                    const s = RESULT_COLORS[r] || RESULT_COLORS.D;
                    return (
                      <span
                        key={i}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border"
                        style={{ background: s.bg, color: s.color, borderColor: s.border }}
                      >
                        {s.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-400 py-2">Sin datos disponibles</div>
        )}
      </div>
    </div>
  );
}