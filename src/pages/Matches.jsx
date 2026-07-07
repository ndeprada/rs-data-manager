import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Swords, ChevronRight, MapPin, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const TYPE_LABELS = {
  partido_amistoso: "Amistoso",
  partido_liga: "Liga",
  torneo: "Torneo",
};

const RESULT_COLORS = {
  victoria: "bg-green-100 text-green-700 border-green-200",
  derrota: "bg-red-100 text-red-700 border-red-200",
  empate: "bg-yellow-100 text-yellow-700 border-yellow-200",
  pendiente: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function Matches() {
  const navigate = useNavigate();
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date", 300),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });
  const { data: allStats = [] } = useQuery({
    queryKey: ["matchStats"],
    queryFn: () => base44.entities.MatchStats.list("-date", 500),
  });

  const matches = events.filter((e) => MATCH_TYPES.includes(e.type));

  const filtered = matches
    .filter((m) => filterTeam === "all" || m.team_id === filterTeam)
    .filter((m) => filterType === "all" || m.type === filterType)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const getResult = (event) => {
    if (!event.score_home && !event.score_away) return "pendiente";
    const h = Number(event.score_home ?? 0);
    const a = Number(event.score_away ?? 0);
    if (h > a) return "victoria";
    if (h < a) return "derrota";
    return "empate";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Gestión</p>
          <h1>Partidos</h1>
          <p className="text-gray-400 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>Historial y gestión de partidos</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-44 border-gray-200 bg-white"><SelectValue placeholder="Equipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los equipos</SelectItem>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36 border-gray-200 bg-white"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MATCH_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: filtered.length, color: "var(--granate)" },
          { label: "Victorias", value: filtered.filter(m => getResult(m) === "victoria").length, color: "#16a34a" },
          { label: "Derrotas", value: filtered.filter(m => getResult(m) === "derrota").length, color: "#dc2626" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded p-4 text-center shadow-sm">
            <div className="text-2xl font-bold" style={{ color: s.color, fontFamily: "var(--font-display)" }}>{s.value}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Matches list */}
      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Swords className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No hay partidos registrados.<br />Crea eventos de tipo partido en el Calendario.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((match) => {
              const team = teams.find((t) => t.id === match.team_id);
              const result = getResult(match);
              const isPast = new Date(match.date) < new Date();
              return (
                <button
                  key={match.id}
                  onClick={() => navigate(`/MatchDetail?id=${match.id}&teamId=${match.team_id}`)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left group"
                >
                  {/* Date */}
                  <div className="w-14 text-center shrink-0">
                    <div className="text-xl font-bold leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
                      {format(new Date(match.date), "d")}
                    </div>
                    <div className="text-[10px] uppercase text-gray-400 tracking-wide">
                      {format(new Date(match.date), "MMM", { locale: es })}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {format(new Date(match.date), "yyyy")}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-10 bg-gray-200 shrink-0" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{TYPE_LABELS[match.type] || match.type}</span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className="text-[10px] text-gray-400">{team?.name || "—"}</span>
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{match.title}</p>
                    {match.opponent && (
                      <p className="text-sm text-gray-500 truncate">vs {match.opponent}</p>
                    )}
                    {match.location && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />{match.location}
                      </p>
                    )}
                  </div>

                  {/* Score / Result */}
                  <div className="shrink-0 text-right">
                    {isPast && (match.score_home !== undefined && match.score_home !== null) ? (
                      <div>
                        <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                          {match.score_home} - {match.score_away}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${RESULT_COLORS[result]}`}>
                          {result}
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400">
                        {format(new Date(match.date), "HH:mm")}
                      </div>
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}