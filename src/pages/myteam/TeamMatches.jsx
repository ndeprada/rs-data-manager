import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Swords, ChevronRight, MapPin, ArrowLeft, Home, Plane, CheckCircle, Clock } from "lucide-react";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSelectedTeam } from "@/lib/useSelectedTeam";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const TYPE_LABELS = { partido_amistoso: "Amistoso", partido_liga: "Liga", torneo: "Torneo" };
const RESULT_COLORS = {
  victoria: "bg-green-50 text-green-700 border-green-200",
  derrota: "bg-red-50 text-red-700 border-red-200",
  empate: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

export default function TeamMatches() {
  const navigate = useNavigate();
  const { selectedTeamId, selectTeam, isCoordinator, canSwitch } = useSelectedTeam();
  const [filterType, setFilterType] = useState("all");

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date", 300) });

  const matches = events
    .filter(e => e.team_id === selectedTeamId && MATCH_TYPES.includes(e.type))
    .filter(e => filterType === "all" || e.type === filterType)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const getResult = (e) => {
    if (e.score_home === null || e.score_home === undefined) return null;
    const h = Number(e.score_home ?? 0), a = Number(e.score_away ?? 0);
    if (h > a) return "victoria"; if (h < a) return "derrota"; return "empate";
  };

  const wins = matches.filter(m => getResult(m) === "victoria").length;
  const draws = matches.filter(m => getResult(m) === "empate").length;
  const losses = matches.filter(m => getResult(m) === "derrota").length;

  return (
    <div className="space-y-4">
      <Link to="/MyTeam" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" /> Volver a Mi Equipo
      </Link>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Mi Equipo</p>
          <h1 className="text-2xl font-black uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Partidos</h1>
        </div>
        <div className="flex gap-3 flex-wrap">
          {canSwitch && (
            <Select value={selectedTeamId} onValueChange={selectTeam}>
              <SelectTrigger className="w-48 border-gray-200 bg-white"><SelectValue placeholder="Equipo" /></SelectTrigger>
              <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36 border-gray-200 bg-white"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MATCH_TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Partidos", value: matches.length, color: "var(--granate)" },
          { label: "Victorias", value: wins, color: "#16a34a" },
          { label: "Empates", value: draws, color: "#b45309" },
          { label: "Derrotas", value: losses, color: "#dc2626" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 p-3 text-center shadow-sm" style={{ borderRadius: "4px" }}>
            <p className="text-xl font-black" style={{ fontFamily: "var(--font-display)", color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
        {matches.length === 0 ? (
          <div className="p-12 text-center">
            <Swords className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>Sin partidos registrados</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {matches.map(m => {
              const result = getResult(m);
              const isPast = new Date(m.date) < new Date();
              return (
                <button key={m.id} onClick={() => navigate(`/MatchDetail?id=${m.id}&teamId=${m.team_id}`)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left group">
                  <div className="w-10 text-center shrink-0">
                    <p className="text-lg font-black leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{format(new Date(m.date), "d")}</p>
                    <p className="text-[10px] uppercase text-gray-400">{format(new Date(m.date), "MMM", { locale: es })}</p>
                    <p className="text-[10px] text-gray-300">{format(new Date(m.date), "yyyy")}</p>
                  </div>
                  <div className="w-px h-12 bg-gray-100 shrink-0" />
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    {/* Shields + home/away icon */}
                    {(() => {
                      const isHome = m.is_home !== false;
                      const team = teams.find(t => t.id === m.team_id);
                      const ourLogo = team?.logo_url || CLUB_LOGO_URL;
                      const OurShield = () => ourLogo
                        ? <img src={ourLogo} alt="Nuestro equipo" className="w-9 h-9 object-contain" />
                        : <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "var(--granate)" }}>N</div>;
                      const RivalShield = () => m.opponent_logo_url
                        ? <img src={m.opponent_logo_url} alt={m.opponent} className="w-9 h-9 object-contain" />
                        : <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "#9ca3af" }}>R</div>;
                      return (
                        <div className="flex items-center gap-1 shrink-0">
                          {isHome
                            ? <Home className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            : <Plane className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          }
                          {isHome ? <OurShield /> : <RivalShield />}
                          <span className="text-xs text-gray-300 font-bold">vs</span>
                          {isHome ? <RivalShield /> : <OurShield />}
                        </div>
                      );
                    })()}

                    {/* Match Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400" style={{ fontFamily: "var(--font-display)" }}>{TYPE_LABELS[m.type]}</span>
                      </div>
                      <p className="font-bold text-gray-900 truncate text-sm" style={{ fontFamily: "var(--font-display)" }}>{m.title}</p>
                      {m.location && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{m.location}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {isPast && result ? (
                      <div>
                        <p className="text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>{m.score_home} - {m.score_away}</p>
                        <span className={`text-[10px] font-bold uppercase border px-2 py-0.5 rounded-sm ${RESULT_COLORS[result]}`}>{result}</span>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span className="text-[10px] text-green-600 font-semibold">Gestionado</span>
                        </div>
                      </div>
                    ) : isPast ? (
                      <div className="text-right">
                        <p className="text-sm text-gray-400">{format(new Date(m.date), "HH:mm")}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <Clock className="w-3 h-3 text-orange-400" />
                          <span className="text-[10px] text-orange-500 font-semibold">Pendiente</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">{format(new Date(m.date), "HH:mm")}</p>
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