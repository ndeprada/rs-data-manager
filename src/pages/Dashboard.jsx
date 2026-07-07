import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Shield, Users, Activity, Swords, ChevronRight, Trophy, TrendingUp, Users2, HeartPulse } from "lucide-react";
import { format, isAfter, startOfDay, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import InteractiveCalendar from "../components/dashboard/InteractiveCalendar";
import KeyMetrics from "../components/dashboard/KeyMetrics";
import FCFClassificationsPanel from "../components/dashboard/FCFClassificationsPanel";
import WeekendAgenda from "../components/dashboard/WeekendAgenda";
import { useTeamAccess } from "@/lib/TeamAccessContext";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico", "sesion_teorica", "sesion_video"];
const isMatch = (type) => MATCH_TYPES.includes(type);

export default function Dashboard() {
  const navigate = useNavigate();
  const { isCoordinator } = useTeamAccess();

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date", 300) });
  const { data: fields = [] } = useQuery({ queryKey: ["fields"], queryFn: () => base44.entities.Field.list() });

  const today = startOfDay(new Date());

  const upcomingEvents = events
    .filter(e => isAfter(new Date(e.date), today))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const activePlayers = players.filter(p => p.status === "activo").length;
  const injuredPlayers = players.filter(p => p.status === "lesionado").length;

  // Próximo partido
  const nextMatch = upcomingEvents.find(e => isMatch(e.type));
  const nextMatchTeam = nextMatch ? teams.find(t => t.id === nextMatch.team_id) : null;

  // Victorias este mes
  const thisMonth = new Date();
  const monthMatches = events.filter(e => isMatch(e.type) && isSameMonth(new Date(e.date), thisMonth));
  const victories = monthMatches.filter(m => {
    const home = m.score_home ?? null;
    const away = m.score_away ?? null;
    if (home === null || away === null) return false;
    return (m.is_home !== false && home > away) || (m.is_home === false && away > home);
  }).length;

  // Asistencia media
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const presentCount = attendance.filter(a => a.status !== "absent").length;
  const attendanceRate = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : null;

  // Récord acumulado del equipo principal (Juvenil A)
  const mainTeam = teams.find(t => t.name === "Juvenil A");
  const mainTeamMatches = mainTeam ? events.filter(e => isMatch(e.type) && e.team_id === mainTeam.id && e.score_home !== undefined && e.score_away !== undefined) : [];
  const mainTeamVictories = mainTeamMatches.filter(m => (m.is_home !== false && m.score_home > m.score_away) || (m.is_home === false && m.score_away > m.score_home)).length;
  const mainTeamDraws = mainTeamMatches.filter(m => m.score_home === m.score_away).length;
  const mainTeamLosses = mainTeamMatches.length - mainTeamVictories - mainTeamDraws;

  // Últimos 3 partidos con resultados
  const completedMatches = events
    .filter(e => isMatch(e.type) && e.score_home !== undefined && e.score_away !== undefined)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  // Estadísticas: máximo goleador, asistente y más minutos
  const { data: matchStats = [] } = useQuery({ queryKey: ["matchstats"], queryFn: () => base44.entities.MatchStats.list() });
  const playerStatsMap = new Map();
  matchStats.forEach(ms => {
    if (!playerStatsMap.has(ms.player_id)) {
      playerStatsMap.set(ms.player_id, { goals: 0, assists: 0, minutes: 0 });
    }
    const stats = playerStatsMap.get(ms.player_id);
    stats.goals += ms.goals || 0;
    stats.assists += ms.assists || 0;
    stats.minutes += ms.minutes_played || 0;
  });

  const topScorer = Array.from(playerStatsMap.entries())
    .map(([playerId, stats]) => ({ playerId, ...stats, player: players.find(p => p.id === playerId) }))
    .filter(p => p.player)
    .sort((a, b) => b.goals - a.goals)[0];

  const topAssister = Array.from(playerStatsMap.entries())
    .map(([playerId, stats]) => ({ playerId, ...stats, player: players.find(p => p.id === playerId) }))
    .filter(p => p.player)
    .sort((a, b) => b.assists - a.assists)[0];

  const topMinutes = Array.from(playerStatsMap.entries())
    .map(([playerId, stats]) => ({ playerId, ...stats, player: players.find(p => p.id === playerId) }))
    .filter(p => p.player)
    .sort((a, b) => b.minutes - a.minutes)[0];

  // Redirect non-coordinators to MyTeam
  if (!isCoordinator) {
    return (
      <div className="text-center py-20">
        <Shield className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500">Esta sección es solo para coordinadores y administradores.</p>
        <Link to="/MyTeam" className="mt-4 inline-block text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-sm text-white" style={{ background: "var(--granate)", fontFamily: "var(--font-display)" }}>
          Ir a Mi Equipo →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── HERO (COMPACTO) ── */}
      <div className="rounded-sm overflow-hidden on-dark h-24 flex items-center" style={{ background: "var(--granate)" }}>
        <div className="px-4 md:px-6 py-4 flex items-center gap-4 w-full">
          <div className="flex-1">
            <p className="text-white/60 text-xs tracking-[0.2em] uppercase" style={{ fontFamily: "var(--font-display)" }}>Temporada 2025–2026</p>
            <h1 className="text-2xl font-black text-white leading-none on-dark" style={{ fontFamily: "var(--font-display)" }}>Panel de Control</h1>
          </div>
          <div className="hidden sm:grid grid-cols-4 gap-4 shrink-0">
            {[
              { icon: Shield, label: "Equipos", value: teams.length },
              { icon: Users2, label: "Jugadores", value: players.length },
              { icon: Activity, label: "Activos", value: activePlayers },
              { icon: HeartPulse, label: "Lesionados", value: injuredPlayers },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <Icon className="w-4 h-4 text-white/70" />
                <p className="text-lg font-black text-white leading-none" style={{ fontFamily: "var(--font-display)" }}>{value}</p>
                <p className="text-[9px] text-white/50 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3 TARJETAS DE RESUMEN ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Próximo partido */}
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4" style={{ color: "var(--granate)" }} />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600">Próximo Partido</p>
          </div>
          {nextMatch ? (
            <>
              <p className="font-black text-gray-900 mb-1" style={{ fontFamily: "var(--font-display)" }}>{nextMatch.title}</p>
              <p className="text-xs text-gray-500">{nextMatchTeam?.name || "—"}</p>
              <p className="text-xs font-bold mt-2" style={{ color: "var(--granate)" }}>
                {format(new Date(nextMatch.date), "EEE d MMM · HH:mm", { locale: es })}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400">Sin próximos partidos</p>
          )}
        </div>

        {/* Temporada (Juvenil A) */}
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4" style={{ color: "var(--granate)" }} />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600">Temporada</p>
          </div>
          <p className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
            {mainTeamVictories}–{mainTeamDraws}–{mainTeamLosses}
          </p>
          <p className="text-xs text-gray-400 mt-1">{mainTeam?.name || "Juvenil A"}</p>
        </div>

        {/* Asistencia media */}
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users2 className="w-4 h-4" style={{ color: "var(--granate)" }} />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600">Asistencia</p>
          </div>
          <p className="text-3xl font-black" style={{ fontFamily: "var(--font-display)", color: attendanceRate >= 80 ? "#16a34a" : attendanceRate >= 60 ? "var(--naranja)" : "#dc2626" }}>
            {attendanceRate !== null ? `${attendanceRate}%` : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-1">Media de entrenamientos</p>
        </div>
      </div>

      {/* ── KEY METRICS ── */}
      <KeyMetrics events={events} teams={teams} />

      {/* ── ESTADÍSTICAS DESTACADAS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {topScorer && (
          <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Máximo goleador</p>
            <p className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{topScorer.goals}</p>
            <p className="text-xs text-gray-500 mt-1">{topScorer.player.first_name} {topScorer.player.last_name}</p>
          </div>
        )}
        {topAssister && (
          <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Máximo asistente</p>
            <p className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{topAssister.assists}</p>
            <p className="text-xs text-gray-500 mt-1">{topAssister.player.first_name} {topAssister.player.last_name}</p>
          </div>
        )}
        {topMinutes && (
          <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">Más minutos</p>
            <p className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{topMinutes.minutes}'</p>
            <p className="text-xs text-gray-500 mt-1">{topMinutes.player.first_name} {topMinutes.player.last_name}</p>
          </div>
        )}
      </div>

      {/* ── LISTA COMPACTA DE EVENTOS FUTUROS ── */}
      {upcomingEvents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm uppercase" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--granate)" }}>Próximos eventos</h2>
            <Link to="/Calendar" className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--granate)", fontFamily: "var(--font-display)" }}>Ver todos →</Link>
          </div>
          <div className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-sm">
            <div className="divide-y divide-gray-50">
              {upcomingEvents.slice(0, 10).map(ev => {
                const team = teams.find(t => t.id === ev.team_id);
                const match = isMatch(ev.type);
                const eventType = match ? "partido" : "entrenamiento";
                const pillColor = match ? "var(--granate)" : ev.type === "entrenamiento" || ev.type === "entrenamiento_fisico" ? "var(--naranja)" : "#9ca3af";
                return (
                  <button key={ev.id}
                    onClick={() => match ? navigate(`/MatchDetail?id=${ev.id}&teamId=${ev.team_id}`) : navigate(`/Calendar`)}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left group">
                    <div className="text-center w-12 shrink-0">
                      <p className="text-sm font-black leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{format(new Date(ev.date), "d")}</p>
                      <p className="text-[9px] uppercase text-gray-400 font-bold">{format(new Date(ev.date), "MMM", { locale: es })}</p>
                    </div>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: pillColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate" style={{ fontFamily: "var(--font-display)" }}>{ev.title}</p>
                      <p className="text-xs text-gray-500">{team?.name}{ev.opponent ? ` · vs ${ev.opponent}` : ""}</p>
                    </div>
                    <p className="text-xs font-bold text-gray-400 shrink-0">{format(new Date(ev.date), "HH:mm")}</p>
                    <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-gray-400 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── RESULTADOS RECIENTES ── */}
      {completedMatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm uppercase" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--granate)" }}>Resultados recientes</h2>
          </div>
          <div className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-sm">
            <div className="divide-y divide-gray-50">
              {completedMatches.map(m => {
                const team = teams.find(t => t.id === m.team_id);
                const isWin = (m.is_home !== false && m.score_home > m.score_away) || (m.is_home === false && m.score_away > m.score_home);
                const isDraw = m.score_home === m.score_away;
                return (
                  <div key={m.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                    <div className="text-center w-12 shrink-0">
                      <p className="text-sm font-black leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{format(new Date(m.date), "d")}</p>
                      <p className="text-[9px] uppercase text-gray-400 font-bold">{format(new Date(m.date), "MMM", { locale: es })}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900" style={{ fontFamily: "var(--font-display)" }}>{m.title}</p>
                      <p className="text-xs text-gray-500">{team?.name} {m.opponent ? `vs ${m.opponent}` : ""}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-black text-lg ${isWin ? "text-green-600" : isDraw ? "text-gray-400" : "text-red-600"}`} style={{ fontFamily: "var(--font-display)" }}>
                        {m.score_home}–{m.score_away}
                      </p>
                      <p className={`text-xs font-bold ${isWin ? "text-green-600" : isDraw ? "text-gray-400" : "text-red-600"}`}>
                        {isWin ? "Victoria" : isDraw ? "Empate" : "Derrota"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── AGENDA SEMANAL ── */}
      <WeekendAgenda events={events} teams={teams} fields={fields} />

      {/* ── CALENDAR ── */}
      <InteractiveCalendar events={events} teams={teams} />

      {/* ── TEAMS ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-base uppercase" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--granate)" }}>Equipos</h2>
          <Link to="/Teams" className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--granate)", fontFamily: "var(--font-display)" }}>Gestionar →</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {teams.map(team => {
            const teamPlayers = players.filter(p => p.team_id === team.id);
            return (
              <Link key={team.id} to={`/TeamDetail?id=${team.id}`}
                className="bg-white border border-gray-200 p-3 hover:shadow-md transition-all group shadow-sm"
                style={{ borderRadius: "4px", borderTop: "3px solid var(--granate)" }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 flex items-center justify-center" style={{ background: "var(--granate-pale)", borderRadius: "4px" }}>
                    <Shield className="w-4 h-4" style={{ color: "var(--granate)" }} />
                  </div>
                  <div>
                    <p className="font-black text-gray-900 uppercase text-sm" style={{ fontFamily: "var(--font-display)" }}>{team.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{team.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{teamPlayers.length}</span>
                  <span className="text-xs text-gray-400 uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>jugadores</span>
                  {team.coach && <span className="text-xs text-gray-400 ml-auto truncate">· {team.coach}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── FCF ── */}
      <FCFClassificationsPanel teams={teams} />
    </div>
  );
}