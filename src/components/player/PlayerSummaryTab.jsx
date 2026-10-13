import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronRight } from "lucide-react";
import { isCleanSheet, useCleanSheetData } from "@/lib/cleanSheet";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import PlayerAttributesBar from "./PlayerAttributesBar";
import GuardianContactCard from "./GuardianContactCard";
import PlayerInfoCards from "./PlayerInfoCards";

const REASON_LABEL = {
  lesion: "Lesión", enfermo: "Enfermo", clase: "Clase", examen: "Examen",
  viaje: "Viaje", familiar: "Familiar", permiso: "Permiso", otro: "Otro",
};
const INJURY_TYPE = { muscular: "Muscular", osea: "Ósea", ligamento: "Ligamento", tendon: "Tendón", contusion: "Contusión", otro: "Otro" };
const INJURY_BODY = {
  tobillo: "tobillo", rodilla: "rodilla", muslo: "muslo", gemelo: "gemelo", isquiotibial: "isquiotibial",
  cadera: "cadera", espalda: "espalda", hombro: "hombro", brazo: "brazo", cabeza: "cabeza", otro: "otro",
};

function resultOf(stat, events) {
  const ev = stat.event_id ? events.find((e) => e.id === stat.event_id) : null;
  if (!ev || ev.score_home == null || ev.score_away == null) return null;
  const my = ev.score_home, their = ev.score_away;
  if (my > their) return { label: "V", bg: "#16a34a", score: `${my}-${their}` };
  if (my < their) return { label: "D", bg: "#dc2626", score: `${my}-${their}` };
  return { label: "E", bg: "#ea580c", score: `${my}-${their}` };
}

function Card({ title, onMore, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{title}</p>
        {onMore && (
          <button onClick={onMore} className="text-[11px] font-semibold flex items-center gap-0.5" style={{ color: "#6b1f28" }}>
            Ver más <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export default function PlayerSummaryTab({ team, player, playerId, matchStats, attendance, injuries, onGoTab }) {
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list() });
  const { allStats } = useCleanSheetData(player.position === "portero");
  const { data: goals = [] } = useQuery({
    queryKey: ["pdi_goals", playerId],
    queryFn: () => base44.entities.PDIGoal.filter({ player_id: playerId }, "-created_date"),
  });

  // Forma
  const recent = [...matchStats].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const results = recent.map((s) => resultOf(s, events));

  // Entrenos últimos 30 días
  const since = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const last30 = attendance.filter((a) => a.status && (a.date || "") >= since);
  const nPresent = last30.filter((a) => a.status === "present").length;
  const nApart = last30.filter((a) => a.status === "apart").length;
  const nAbsent = last30.filter((a) => a.status === "absent").length;
  const pct = last30.length > 0 ? Math.round(((nPresent + nApart) / last30.length) * 100) : null;
  const reasonCount = {};
  last30.filter((a) => a.status === "absent" && a.absence_reason).forEach((a) => {
    reasonCount[a.absence_reason] = (reasonCount[a.absence_reason] || 0) + 1;
  });
  const topReason = Object.entries(reasonCount).sort((a, b) => b[1] - a[1])[0];
  const pctColor = pct === null ? "#9ca3af" : pct >= 80 ? "#16a34a" : pct >= 60 ? "#ea580c" : "#dc2626";

  // Médico
  const activeInjuries = injuries.filter((i) => i.status !== "alta");
  const lastInjury = [...injuries].sort((a, b) => new Date(b.injury_date) - new Date(a.injury_date))[0];

  // PDI
  const pending = goals.filter((g) => g.status !== "mejorado");

  const fmt = (d) => (d ? format(new Date(d), "d MMM", { locale: es }) : "");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr_1fr] gap-3">
        {/* Forma */}
        <Card title="Forma · últimos partidos" onMore={() => onGoTab("stats")}>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-400">Sin partidos registrados.</p>
          ) : (
            <>
              <div className="flex gap-1.5 mb-2">
                {results.map((r, i) => (
                  <div key={i} className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white"
                    style={{ background: r ? r.bg : "#e5e7eb", color: r ? "white" : "#9ca3af" }}>
                    {r ? r.label : "—"}
                  </div>
                ))}
              </div>
              <div className="divide-y divide-gray-100">
                {recent.slice(0, 3).map((s, i) => {
                  const ev = s.event_id ? events.find((e) => e.id === s.event_id) : null;
                  const crest = "w-5 h-5 object-contain shrink-0";
                  const away = ev?.is_home === false;
                  const ours = <img src={team?.logo_url || CLUB_LOGO_URL} alt="" className={crest} loading="lazy" referrerPolicy="no-referrer" />;
                  const rival = ev?.opponent_logo_url
                    ? <img src={ev.opponent_logo_url} alt="" className={crest} loading="lazy" referrerPolicy="no-referrer" />
                    : <span className={crest} />;
                  const score = ev && ev.score_home != null && ev.score_away != null
                    ? (away ? `${ev.score_away}-${ev.score_home}` : `${ev.score_home}-${ev.score_away}`)
                    : "—";
                  return (
                    <div key={s.id} className="flex items-center py-1 text-xs gap-1.5">
                      {away ? rival : ours}
                      <span className="font-bold text-gray-700 shrink-0 w-9 text-center">{score}</span>
                      {away ? ours : rival}
                      <span className="font-medium text-gray-800 truncate flex-1 min-w-0">{s.opponent || "Rival"}</span>
                      <span className="text-gray-400 shrink-0">
                        {s.minutes_played ? `${s.minutes_played}'` : ""}
                        {s.goals > 0 ? ` · ${s.goals} gol${s.goals > 1 ? "es" : ""}` : ""}
                        {s.assists > 0 ? ` · ${s.assists} asist.` : ""}
                        {player.position === "portero" && isCleanSheet(s, events, allStats) ? " · P0" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        <PlayerInfoCards player={player} />
        <PlayerAttributesBar playerId={playerId} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Entrenos */}
        <Card title="Entrenos · últimos 30 días" onMore={() => onGoTab("entrenos")}>
          {pct === null ? (
            <p className="text-sm text-gray-400">Sin sesiones registradas.</p>
          ) : (
            <>
              <p className="text-2xl font-black leading-none" style={{ color: pctColor }}>{pct}%</p>
              <div className="h-1.5 bg-gray-100 rounded-full mt-2 mb-3 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pctColor }} />
              </div>
              <p className="text-xs text-gray-500">{nPresent} asiste · {nApart} a parte · {nAbsent} no asiste</p>
              {topReason && (
                <p className="text-xs text-gray-400 mt-1">
                  Motivo más frecuente: {REASON_LABEL[topReason[0]] || topReason[0]} ({topReason[1]})
                </p>
              )}
            </>
          )}
        </Card>

        {/* Médico */}
        <Card title="Estado médico" onMore={() => onGoTab("injuries")}>
          {activeInjuries.length > 0 ? (
            <div className="space-y-2">
              {activeInjuries.slice(0, 2).map((i) => (
                <div key={i.id}>
                  <p className="text-sm font-semibold text-gray-800">
                    {INJURY_TYPE[i.type] || i.type}{i.body_part ? ` · ${INJURY_BODY[i.body_part] || i.body_part}` : ""}
                    {i.severity ? <span className="text-xs font-normal text-gray-400"> · {i.severity}</span> : null}
                  </p>
                  <p className="text-xs text-gray-400">
                    Desde {fmt(i.injury_date)}{i.expected_return ? ` · alta prevista ${fmt(i.expected_return)}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-green-700">Sin lesiones activas</p>
              {lastInjury && (
                <p className="text-xs text-gray-400 mt-1">
                  Última: {INJURY_TYPE[lastInjury.type] || lastInjury.type}, {fmt(lastInjury.injury_date)}
                </p>
              )}
            </>
          )}
        </Card>

        {/* PDI */}
        <Card title="PDI · a mejorar" onMore={() => onGoTab("pdi")} className="md:col-span-2">
          {pending.length === 0 ? (
            <p className="text-sm text-gray-400">Sin objetivos pendientes.</p>
          ) : (
            <div className="space-y-2">
              {pending.slice(0, 3).map((g) => (
                <div key={g.id}>
                  <p className="text-sm text-gray-800 line-clamp-2">{g.objective || g.competency_text}</p>
                  {g.period && <p className="text-[11px] text-gray-400">{g.period}</p>}
                </div>
              ))}
              {pending.length > 3 && <p className="text-[11px] text-gray-400">+{pending.length - 3} más</p>}
            </div>
          )}
        </Card>

      </div>
      <GuardianContactCard player={player} />
    </div>
  );
}
