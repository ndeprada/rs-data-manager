import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Historial de correcciones y valoraciones del entrenador, partido a partido (se escriben en Post-partido)
export default function PlayerCorrectionsSection({ playerId, teamId }) {
  const { data: stats = [] } = useQuery({
    queryKey: ["matchstats", "corrections", playerId],
    queryFn: () => base44.entities.MatchStats.filter({ player_id: playerId }),
    enabled: !!playerId,
  });
  const rows = stats
    .filter((s) => (s.notes || "").trim() || s.rating)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (!rows.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <p className="text-sm font-bold text-gray-900">Correcciones y valoraciones <span className="text-gray-400 font-normal">({rows.length})</span></p>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((s) => (
          <div key={s.id} className="px-5 py-3 flex gap-3">
            <div className="w-28 shrink-0">
              <p className="text-xs font-bold text-gray-700">{s.date ? format(new Date(s.date), "d MMM yyyy", { locale: es }) : "—"}</p>
              <p className="text-[11px] text-gray-400 truncate">{s.opponent ? `vs ${s.opponent}` : ""}</p>
              {s.rating > 0 && (
                <span className="inline-flex mt-0.5">
                  {[1, 2, 3].map((i) => <Star key={i} className={`w-3 h-3 ${i <= s.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {(s.notes || "").trim()
                ? <p className="text-sm text-gray-800 whitespace-pre-wrap">{s.notes}</p>
                : <p className="text-sm text-gray-300">Solo valoración</p>}
              {s.event_id && (
                <Link to={`/MatchDetail?id=${s.event_id}&teamId=${teamId}&tab=postpartido`} className="text-[11px] text-blue-600 hover:underline">Ver análisis del partido</Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
