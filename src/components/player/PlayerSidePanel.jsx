import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { HeartPulse, Trophy } from "lucide-react";

const INJURY_TYPE_LABELS = {
  muscular: "Muscular", osea: "Ósea", ligamento: "Ligamento",
  tendon: "Tendón", contusion: "Contusión", otro: "Otro"
};
const INJURY_BODY_LABELS = {
  tobillo: "Tobillo", rodilla: "Rodilla", muslo: "Muslo", gemelo: "Gemelo",
  isquiotibial: "Isquiotibial", cadera: "Cadera", espalda: "Espalda",
  hombro: "Hombro", brazo: "Brazo", cabeza: "Cabeza", otro: "Otro"
};
const SEVERITY_LABELS = { leve: "Leve", moderada: "Moderada", grave: "Grave" };

function getMatchResult(stat, events) {
  const event = stat.event_id ? events.find(e => e.id === stat.event_id) : null;
  if (!event) return null;
  const homeGoals = event.score_home ?? null;
  const awayGoals = event.score_away ?? null;
  if (homeGoals === null || awayGoals === null) return null;
  const isHome = event.is_home !== false;
  const myGoals = isHome ? homeGoals : awayGoals;
  const theirGoals = isHome ? awayGoals : homeGoals;
  if (myGoals > theirGoals) return { label: "V", bg: "#16a34a", score: `${myGoals}-${theirGoals}` };
  if (myGoals < theirGoals) return { label: "D", bg: "#dc2626", score: `${myGoals}-${theirGoals}` };
  return { label: "E", bg: "#ea580c", score: `${myGoals}-${theirGoals}` };
}

export default function PlayerSidePanel({ playerId, matchStats, playerInjuries }) {
  const [tab, setTab] = useState("partidos");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list(),
  });

  const recentMatches = [...matchStats]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  const sortedInjuries = [...playerInjuries]
    .sort((a, b) => new Date(b.injury_date) - new Date(a.injury_date));

  const activeInjuriesCount = playerInjuries.filter(i => i.status !== "alta").length;

  // Form string: last 5 results
  const last5 = recentMatches.slice(0, 5).map(s => getMatchResult(s, events));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Form strip */}
      {last5.some(Boolean) && (
        <div className="px-4 pt-3 pb-2 border-b border-gray-100">
          <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-2">Últimos 5 resultados</p>
          <div className="flex gap-1.5">
            {last5.map((r, i) => (
              <div key={i} className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white shadow-sm"
                style={{ background: r ? r.bg : "#e5e7eb", color: r ? "white" : "#9ca3af" }}>
                {r ? r.label : "—"}
              </div>
            ))}
            {/* Fill remaining */}
            {Array.from({ length: Math.max(0, 5 - last5.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="w-7 h-7 rounded-lg bg-gray-100" />
            ))}
          </div>
        </div>
      )}

      {/* Tab header */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setTab("partidos")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2"
          style={tab === "partidos"
            ? { borderBottomColor: "#6b1f28", color: "#6b1f28" }
            : { borderBottomColor: "transparent", color: "#9ca3af" }}
        >
          <Trophy className="w-3.5 h-3.5" />
          Partidos
        </button>
        <button
          onClick={() => setTab("lesiones")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2"
          style={tab === "lesiones"
            ? { borderBottomColor: "#6b1f28", color: "#6b1f28" }
            : { borderBottomColor: "transparent", color: "#9ca3af" }}
        >
          <HeartPulse className="w-3.5 h-3.5" />
          Médico
          {activeInjuriesCount > 0 && (
            <span className="ml-0.5 w-4 h-4 rounded-full text-white text-[9px] font-black flex items-center justify-center" style={{ background: "#dc2626" }}>
              {activeInjuriesCount}
            </span>
          )}
        </button>
      </div>

      {/* Partidos */}
      {tab === "partidos" && (
        <div>
          {recentMatches.length === 0 ? (
            <div className="py-10 text-center">
              <Trophy className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Sin partidos registrados</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentMatches.map((stat) => {
                const result = getMatchResult(stat, events);
                return (
                  <div key={stat.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                    {/* Result pill */}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white shrink-0 shadow-sm"
                      style={{ background: result ? result.bg : "#e5e7eb" }}>
                      {result ? result.label : <span className="text-gray-400">—</span>}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate leading-tight">
                        {stat.opponent || "Rival"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-gray-400">
                          {stat.date ? format(new Date(stat.date), "d MMM", { locale: es }) : "—"}
                        </span>
                        {result?.score && (
                          <span className="text-[10px] font-bold text-gray-500">{result.score}</span>
                        )}
                        {stat.minutes_played != null && stat.minutes_played > 0 && (
                          <span className="text-[10px] text-gray-400">{stat.minutes_played}'</span>
                        )}
                      </div>
                    </div>

                    {/* Event badges */}
                    <div className="flex items-center gap-1 shrink-0">
                      {stat.goals > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "#fdf2f4", color: "#6b1f28" }}>
                          ⚽{stat.goals}
                        </span>
                      )}
                      {stat.assists > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700">
                          🅰️{stat.assists}
                        </span>
                      )}
                      {stat.yellow_cards > 0 && (
                        <span className="w-3.5 h-4.5 rounded-sm inline-block" style={{ background: "#fbbf24", width: 10, height: 14, borderRadius: 2 }} title="Tarjeta amarilla" />
                      )}
                      {(stat.red_cards > 0 || stat.double_yellow_card > 0) && (
                        <span className="inline-block rounded-sm" style={{ background: "#ef4444", width: 10, height: 14, borderRadius: 2 }} title="Tarjeta roja" />
                      )}
                      {stat.rating && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600">
                          ★{stat.rating}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lesiones */}
      {tab === "lesiones" && (
        <div>
          {sortedInjuries.length === 0 ? (
            <div className="py-10 text-center">
              <HeartPulse className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Sin lesiones registradas</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sortedInjuries.map((injury) => {
                const isActive = injury.status !== "alta";
                return (
                  <div key={injury.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <p className="text-xs font-semibold text-gray-800 leading-tight">
                            {INJURY_TYPE_LABELS[injury.type] || injury.type}
                            {injury.body_part ? ` · ${INJURY_BODY_LABELS[injury.body_part]}` : ""}
                          </p>
                          {injury.severity && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              injury.severity === "grave" ? "bg-red-100 text-red-700"
                              : injury.severity === "moderada" ? "bg-orange-100 text-orange-700"
                              : "bg-green-100 text-green-700"
                            }`}>
                              {SEVERITY_LABELS[injury.severity]}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px] text-gray-400">
                          {injury.injury_date && (
                            <span>{format(new Date(injury.injury_date), "d MMM yyyy", { locale: es })}</span>
                          )}
                          {injury.expected_return && isActive && (
                            <span>→ {format(new Date(injury.expected_return), "d MMM", { locale: es })}</span>
                          )}
                          {injury.actual_return && !isActive && (
                            <span className="text-green-600 font-semibold">Alta {format(new Date(injury.actual_return), "d MMM", { locale: es })}</span>
                          )}
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        injury.status === "activa" ? "bg-red-100 text-red-700"
                        : injury.status === "recuperacion" ? "bg-orange-100 text-orange-700"
                        : "bg-green-100 text-green-700"
                      }`}>
                        {injury.status === "activa" ? "Activa" : injury.status === "recuperacion" ? "Recup." : "Alta"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}