import { sortTeams, compareTeams, isF7Team, teamRank } from "@/lib/teamOrder";
import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Shield, UserCog, Swords, MapPin, Trophy, ClipboardCheck } from "lucide-react";
import { format, startOfDay, addDays, isSameDay, differenceInMinutes, startOfWeek, endOfDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import FCFClassificationsPanel from "../components/dashboard/FCFClassificationsPanel";
import WeekendAgenda from "../components/dashboard/WeekendAgenda";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { playerFullName } from "@/lib/playerName";
import { useCountedStats } from "@/lib/matchStatus";
import { useTrainingStatus } from "@/lib/trainingStatus";
import { usePendingUsers } from "@/lib/pendingUsers";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico", "sesion_teorica", "sesion_video"];
const isMatch = (t) => MATCH_TYPES.includes(t);
const FORM = { G: ["V", "#16a34a"], E: ["E", "#ea580c"], P: ["D", "#dc2626"] };
const display = { fontFamily: "var(--font-display)" };

const card = "bg-white border border-gray-200 shadow-sm";
const cardStyle = { borderRadius: "6px" };
const Title = ({ children, right }) => (
  <div className="flex items-center justify-between px-4 pt-3 pb-2">
    <h2 className="text-xs font-black uppercase tracking-[0.12em]" style={{ ...display, color: "var(--granate)" }}>{children}</h2>
    {right}
  </div>
);

function groupOf(team) {
  const n = (team.name || "").toLowerCase();
  if (n.includes("primer")) return "Primer equipo";
  if (n.includes("juvenil")) return "Juvenil";
  if (n.includes("cadet")) return "Cadete";
  if (n.includes("infantil")) return "Infantil";
  return "Fútbol 7";
}
const GROUPS = ["Todos", "Primer equipo", "Juvenil", "Cadete", "Infantil", "Fútbol 7"];

function Countdown({ date }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const mins = Math.max(0, differenceInMinutes(new Date(date), now));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return (
    <div className="flex gap-2 shrink-0">
      {[[d, "días"], [h, "horas"], [m, "min"]].map(([v, l]) => (
        <div key={l} className="rounded-lg px-3 pt-1.5 pb-1 text-center" style={{ background: "rgba(255,255,255,0.12)" }}>
          <p className="text-2xl font-black leading-none text-white" style={display}>{String(v).padStart(2, "0")}</p>
          <p className="text-[9px] uppercase tracking-widest text-white/65 mt-0.5">{l}</p>
        </div>
      ))}
    </div>
  );
}

function MatchButtons({ ev, mine, light }) {
  const base = `/MatchDetail?id=${ev.id}&teamId=${ev.team_id}`;
  const primary = light ? { background: "#fff", color: "var(--granate)" } : { background: "var(--granate)", color: "#fff" };
  const secondary = light ? { border: "1px solid #fff", color: "#fff" } : { border: "1px solid #e5e7eb", color: "#111827" };
  return (
    <div className="flex flex-wrap gap-2">
      {mine ? (
        <>
          <Link to={`${base}&tab=tactica`} className="text-sm font-bold px-3.5 py-1.5 rounded-md" style={primary}>Preparar partido</Link>
          <Link to={`${base}&tab=convocatoria`} className="text-sm font-semibold px-3.5 py-1.5 rounded-md" style={secondary}>Ver convocatoria</Link>
        </>
      ) : (
        <Link to={base} className="text-sm font-semibold px-3.5 py-1.5 rounded-md" style={secondary}>Ver partido</Link>
      )}
    </div>
  );
}

function TeamCard({ team, count }) {
  const { data } = useQuery({
    queryKey: ["fcf-standing", team.id],
    queryFn: async () => {
      const r = await fetch(`/api/sync-fcf?standings=${team.id}`, { credentials: "include" });
      if (!r.ok) throw new Error("error");
      return r.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
  const rows = data?.rows || [];
  const me = rows.find((r) => r.teamId === data?.ourTeamId);
  const form = (me?.form || []).slice().reverse().slice(-5);
  return (
    <Link to={`/TeamDetail?id=${team.id}`} className="bg-white border border-gray-200 px-2.5 py-1.5 hover:shadow-md transition-shadow flex flex-col gap-0.5 min-w-0" style={{ borderRadius: "6px", borderLeft: "3px solid var(--granate)" }}>
      <div className="flex items-baseline gap-1.5 min-w-0">
        <p className="font-black text-gray-900 uppercase text-[12px] leading-tight truncate" style={display}>{team.name}</p>
        <span className="ml-auto text-[9px] text-gray-400 shrink-0">{count} jug.</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-lg font-black leading-none" style={{ ...display, color: "var(--granate)" }}>{me ? `${me.pos}º` : "—"}</span>
        <span className="text-[10px] text-gray-500">{me ? `${me.pts} pts` : ""}</span>
        <div className="ml-auto flex gap-0.5">
          {form.map((f, i) => (
            <span key={i} className="w-3.5 h-3.5 rounded-[3px] text-[8px] font-black text-white flex items-center justify-center" style={{ background: (FORM[f] || ["?", "#9ca3af"])[1] }}>{(FORM[f] || ["?"])[0]}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function Leaders({ title, items }) {
  return (
    <div className={`${card} overflow-hidden`} style={cardStyle}>
      <Title>{title}</Title>
      <div className="pb-2">
        {items.map((it) => (
          <div key={it.label} className="px-4 py-1.5 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{it.label}</p>
              {it.row ? (
                <p className="text-[13px] font-semibold text-gray-900 truncate">
                  <Link to={`/PlayerProfile?id=${it.row.player.id}`} className="hover:underline">{playerFullName(it.row.player)}</Link>
                  {it.team && <span className="text-[10px] text-gray-400 font-normal ml-1.5">{it.team}</span>}
                </p>
              ) : <p className="text-[13px] text-gray-300">—</p>}
            </div>
            <p className="text-xl font-black shrink-0" style={{ ...display, color: "var(--granate)" }}>{it.row ? it.value : ""}<span className="text-[10px] text-gray-400 font-medium ml-1">{it.row ? it.unit : ""}</span></p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isCoordinator, coachTeamIds, canManageTeam } = useTeamAccess();
  const pendingUsers = usePendingUsers(isCoordinator);
  const [tab, setTab] = useState("equipos");
  const [group, setGroup] = useState("Todos");

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: fields = [] } = useQuery({ queryKey: ["fields"], queryFn: () => base44.entities.Field.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: rawStats = [] } = useQuery({ queryKey: ["matchstats"], queryFn: () => base44.entities.MatchStats.list() });
  const matchStats = useCountedStats(rawStats);
  const { pending: pendingTrainings } = useTrainingStatus();

  const myIds = useMemo(() => new Set(coachTeamIds || []), [coachTeamIds]);
  const hasMine = myIds.size > 0;
  // Coordinación ve todo el club; el resto de la agenda/asistencia, solo sus equipos
  const scopeIds = isCoordinator || !hasMine ? null : myIds;
  const inScope = (teamId) => !scopeIds || scopeIds.has(teamId);
  const myPendingTr = [...pendingTrainings.values()].filter((e) => inScope(e.team_id)).sort((a, b) => new Date(b.date) - new Date(a.date));
  const teamName = (id) => teams.find((t) => t.id === id)?.name || "";
  const now = new Date();
  const today = startOfDay(now);

  const upcoming = events.filter((e) => new Date(e.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));
  const nextClub = upcoming.find((e) => isMatch(e.type));
  const nextMine = hasMine ? upcoming.find((e) => isMatch(e.type) && myIds.has(e.team_id)) : null;
  const nextIsMine = nextClub && nextMine && nextClub.id === nextMine.id;

  // Temporada: mis equipos (si entreno) o todo el club
  const recordIds = hasMine ? myIds : null;
  const played = events.filter((e) => isMatch(e.type) && e.score_home != null && e.score_away != null && (!recordIds || recordIds.has(e.team_id)));
  const wins = played.filter((m) => m.score_home > m.score_away).length;
  const draws = played.filter((m) => m.score_home === m.score_away).length;
  const losses = played.length - wins - draws;
  const recordLabel = hasMine ? (myIds.size === 1 ? teamName([...myIds][0]) : "Mis equipos") : "Todo el club";

  const attScope = attendance.filter((a) => !scopeIds || events.find((e) => e.id === a.event_id && scopeIds.has(e.team_id)) || (a.team_id && scopeIds.has(a.team_id)));
  const present = attScope.filter((a) => a.status !== "absent").length;
  const attRate = attScope.length ? Math.round((present / attScope.length) * 100) : null;
  const attColor = attRate >= 80 ? "#16a34a" : attRate >= 60 ? "var(--naranja)" : "#dc2626";

  const activePlayers = players.filter((p) => p.status === "activo").length;
  const injured = players.filter((p) => p.status === "lesionado").length;

  // Resultados del último fin de semana (viernes a domingo ya jugados), de todos los equipos en su ámbito
  const lastSunday = (() => { const d = startOfDay(now), w = d.getDay(); return w === 0 ? d : w === 6 ? addDays(d, 1) : subDays(d, w); })();
  const weekendStart = subDays(lastSunday, 2); // viernes
  const recent = events
    .filter((e) => isMatch(e.type) && e.score_home != null && e.score_away != null && inScope(e.team_id)
      && new Date(e.date) >= weekendStart && new Date(e.date) <= endOfDay(lastSunday))
    .sort((a, b) => compareTeams(teams.find((t) => t.id === a.team_id) || {}, teams.find((t) => t.id === b.team_id) || {}) || new Date(a.date) - new Date(b.date));
  const isF7 = (e) => { const t = teams.find((x) => x.id === e.team_id); return t ? isF7Team(t) : (e.football_format === "f7" || e.football_format === "f5"); };
  const rankOf = (e) => teamRank(teams.find((x) => x.id === e.team_id));
  const weekendLabel = `${format(subDays(lastSunday, 1), "d", { locale: es })}–${format(lastSunday, "d MMM", { locale: es })}`;

  // Semana actual completa (lunes a domingo)
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEvents = events.filter((e) => inScope(e.team_id) && new Date(e.date) >= weekStart && new Date(e.date) < addDays(weekStart, 7)).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Líderes por modalidad (F7 / F11)
  const formatByEvent = useMemo(() => new Map(events.map((e) => [e.id, isF7(e) ? "f7" : "f11"])), [events, teams]);
  const leadersFor = (fmt) => {
    const acc = new Map();
    matchStats.forEach((ms) => {
      if ((formatByEvent.get(ms.event_id) || "f11") !== fmt) return;
      const a = acc.get(ms.player_id) || { goals: 0, assists: 0, minutes: 0 };
      a.goals += ms.goals || 0; a.assists += ms.assists || 0; a.minutes += ms.minutes_played || 0;
      acc.set(ms.player_id, a);
    });
    const rows = [...acc.entries()].map(([id, v]) => ({ ...v, player: players.find((p) => p.id === id) })).filter((r) => r.player);
    const top = (k) => { const r = [...rows].sort((a, b) => b[k] - a[k])[0]; return r && r[k] > 0 ? r : null; };
    const g = top("goals"), a = top("assists"), m = top("minutes");
    return [
      { label: "Goleador", row: g, value: g?.goals, unit: "goles", team: g && teamName(g.player.team_id) },
      { label: "Asistente", row: a, value: a?.assists, unit: "asist.", team: a && teamName(a.player.team_id) },
      { label: "Más minutos", row: m, value: m ? `${m.minutes}'` : "", unit: "", team: m && teamName(m.player.team_id) },
    ];
  };

  const sortedTeams = useMemo(() => sortTeams(teams), [teams]);
  const shownTeams = sortedTeams.filter((t) => group === "Todos" || groupOf(t) === group);

  const weekendEvents = events.filter((e) => inScope(e.team_id));

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400" style={display}>Temporada 2025–2026</p>
          <h1 className="text-3xl font-black leading-none" style={{ ...display, color: "var(--granate)" }}>Panel de control</h1>
        </div>
        {myPendingTr.length > 0 && (
          <Link to={`/MyTeam/Attendance?eventId=${myPendingTr[0].id}`} className={`${pendingUsers.length > 0 ? "" : "ml-auto"} flex items-center gap-2 px-3 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors`} style={{ borderRadius: "6px" }} title="Entrenamientos ya hechos sin asistencia">
            <ClipboardCheck className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-800">{myPendingTr.length} entreno{myPendingTr.length !== 1 ? "s" : ""} sin gestionar</span>
            <span className="text-xs font-bold text-amber-700">Pasar lista →</span>
          </Link>
        )}
        {pendingUsers.length > 0 && (
          <Link to="/Accesos" className="ml-auto flex items-center gap-2 px-3 py-2 border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors" style={{ borderRadius: "6px" }}>
            <UserCog className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-bold text-orange-800">{pendingUsers.length} usuario{pendingUsers.length !== 1 ? "s" : ""} pendiente{pendingUsers.length !== 1 ? "s" : ""}</span>
            <span className="text-xs font-bold text-orange-700">Revisar →</span>
          </Link>
        )}
      </div>

      {/* Próximo partido + temporada/asistencia */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {nextClub ? (
            <div className="rounded-xl px-4 py-3 md:px-5 md:py-3 flex flex-col md:flex-row md:items-center gap-3 md:gap-5 on-dark" style={{ background: "linear-gradient(135deg, var(--granate) 0%, var(--granate-dark) 100%)" }}>
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">{nextIsMine ? "Próximo partido del club · es de tus equipos" : "Próximo partido del club"}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <Swords className="w-5 h-5 text-white/80 shrink-0" />
                  <p className="text-xl font-black text-white leading-tight" style={display}>{nextClub.title}</p>
                </div>
                <p className="text-sm text-white/85 flex items-center gap-4 flex-wrap">
                  <span className="font-bold capitalize">{format(new Date(nextClub.date), "EEE d MMM · HH:mm", { locale: es })}</span>
                  <span>{teamName(nextClub.team_id)}</span>
                  {nextClub.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{nextClub.location}</span>}
                </p>
                <MatchButtons ev={nextClub} mine={canManageTeam(nextClub.team_id)} light />
              </div>
              <Countdown date={nextClub.date} />
            </div>
          ) : (
            <div className={`${card} p-6 text-sm text-gray-400`} style={cardStyle}>Sin partidos programados.</div>
          )}

          {nextMine && !nextIsMine && (
            <div className={`${card} p-4 flex items-center gap-4 flex-wrap`} style={{ ...cardStyle, borderLeft: "4px solid var(--naranja)" }}>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Mi próximo partido · {teamName(nextMine.team_id)}</p>
                <p className="font-black text-gray-900 text-lg leading-tight" style={display}>{nextMine.title}</p>
                <p className="text-xs font-bold mt-0.5 capitalize" style={{ color: "var(--granate)" }}>{format(new Date(nextMine.date), "EEEE d MMM · HH:mm", { locale: es })}</p>
              </div>
              <MatchButtons ev={nextMine} mine />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className={`${card} p-4`} style={cardStyle}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Temporada · {recordLabel}</p>
            <div className="flex items-end gap-2" style={display}>
              <span className="text-4xl font-black text-green-600 leading-none">{wins}</span><span className="text-[10px] text-gray-400 mb-1">V</span>
              <span className="text-4xl font-black text-gray-500 leading-none ml-1">{draws}</span><span className="text-[10px] text-gray-400 mb-1">E</span>
              <span className="text-4xl font-black text-red-600 leading-none ml-1">{losses}</span><span className="text-[10px] text-gray-400 mb-1">D</span>
            </div>
          </div>
          <div className={`${card} p-4`} style={cardStyle}>
            <div className="flex items-baseline justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Asistencia media{hasMine && !isCoordinator ? " · mis equipos" : ""}</p>
              <p className="text-2xl font-black" style={{ ...display, color: attRate == null ? "#9ca3af" : attColor }}>{attRate == null ? "—" : `${attRate}%`}</p>
            </div>
            <div className="h-2 rounded-full bg-gray-100 mt-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${attRate || 0}%`, background: attColor }} /></div>
          </div>
        </div>
      </div>

      {/* Datos del club */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[["Equipos", teams.length], ["Jugadores", players.length], ["Activos", activePlayers], ["Lesionados", injured]].map(([l, v]) => (
          <div key={l} className={`${card} px-4 py-3`} style={cardStyle}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{l}</p>
            <p className="text-2xl font-black" style={{ ...display, color: "var(--granate)" }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Planificación semanal */}
      <div className={card} style={cardStyle}>
        <Title right={<Link to="/Calendar" className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--granate)", ...display }}>Calendario completo →</Link>}>
          Planificación semanal{!isCoordinator && hasMine ? " · mis equipos" : ""} · {format(weekDays[0], "d MMM", { locale: es })} – {format(weekDays[6], "d MMM", { locale: es })}
        </Title>
        <div className="grid grid-cols-7 gap-1 sm:gap-3 px-2 sm:px-4 pb-4">
          {weekDays.map((d) => {
            const k = format(d, "yyyy-MM-dd");
            const evs = weekEvents.filter((e) => format(new Date(e.date), "yyyy-MM-dd") === k);
            const sorted = [...evs.filter((e) => isMatch(e.type)), ...evs.filter((e) => !isMatch(e.type))];
            const isToday = isSameDay(d, today);
            return (
              <div key={k} className="space-y-1.5 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest capitalize" style={{ ...display, color: isToday ? "var(--naranja)" : "#6b7280" }}>
                  <span className="sm:hidden">{format(d, "EEEEE d", { locale: es })}</span>
                  <span className="hidden sm:inline">{isToday ? "Hoy · " : ""}{format(d, "EEE d", { locale: es })}</span>
                </p>
                {sorted.length === 0 && <p className="text-[11px] text-gray-300 pl-1">—</p>}
                {sorted.slice(0, 4).map((e) => {
                  const m = isMatch(e.type);
                  const content = (
                    <div className="rounded-md px-1 sm:px-2.5 py-1 sm:py-1.5 hover:brightness-95 transition" style={{ background: m ? "var(--granate-pale)" : "#f9fafb", outline: isToday ? "1px solid var(--naranja)" : undefined }}>
                      <p className="text-[9px] sm:text-[10px] font-bold" style={{ color: m ? "var(--granate)" : "var(--naranja)" }}>{format(new Date(e.date), "HH:mm")}</p>
                      <p className="text-[9px] sm:text-xs font-semibold text-gray-900 leading-tight line-clamp-3 sm:line-clamp-2 break-words">{m ? (e.opponent ? `${teamName(e.team_id)} vs ${e.opponent}` : e.title) : (e.title || "Entrenamiento")}</p>
                      {!m && <p className="text-[8px] sm:text-[10px] text-gray-500 leading-tight break-words">{teamName(e.team_id)}</p>}
                    </div>
                  );
                  return m ? <Link key={e.id} to={`/MatchDetail?id=${e.id}&teamId=${e.team_id}`} className="block">{content}</Link> : <div key={e.id}>{content}</div>;
                })}
                {sorted.length > 4 && <Link to="/Calendar" className="block text-[11px] font-bold pl-1" style={{ color: "var(--granate)" }}>+{sorted.length - 4} más</Link>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Resultados del último fin de semana */}
      <div className={`${card} overflow-hidden`} style={cardStyle}>
        <Title right={<span className="text-[11px] font-bold text-gray-400">{recent.length} partidos</span>}>Resultados del fin de semana · {weekendLabel}</Title>
        {recent.length === 0 ? <p className="px-4 pb-3 text-sm text-gray-400">Todavía no hay resultados de ese fin de semana.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-3 md:divide-x divide-gray-100">
            {[["Primer Equipo y Juvenil", recent.filter((m) => !isF7(m) && rankOf(m) <= 1)], ["Cadete e Infantil · F11", recent.filter((m) => !isF7(m) && rankOf(m) > 1)], ["Fútbol 7", recent.filter(isF7)]].map(([label, list]) => (
              <div key={label} className="pb-1.5 min-w-0">
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-black uppercase tracking-widest text-gray-400" style={display}>{label} · {list.length}</p>
                {list.length === 0 && <p className="px-3 pb-1 text-sm text-gray-300">—</p>}
                {list.map((m) => {
                  const win = m.score_home > m.score_away, draw = m.score_home === m.score_away;
                  const c = win ? "#16a34a" : draw ? "#6b7280" : "#dc2626";
                  return (
                    <Link key={m.id} to={`/MatchDetail?id=${m.id}&teamId=${m.team_id}`} className="px-3 py-[3px] flex items-center gap-2 hover:bg-gray-50 min-w-0">
                      <span className="w-4 h-4 rounded-[3px] text-[9px] font-black text-white flex items-center justify-center shrink-0" style={{ background: c }}>{win ? "V" : draw ? "E" : "D"}</span>
                      <p className="text-[12px] font-semibold text-gray-900 truncate min-w-0 flex-1">{teamName(m.team_id)} <span className="font-normal text-[10px] text-gray-400">vs {m.opponent || "—"}</span></p>
                      <span className="text-[13px] font-black shrink-0" style={{ ...display, color: c }}>{m.score_home}–{m.score_away}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Leaders title="Líderes · Fútbol 7" items={leadersFor("f7")} />
        <Leaders title="Líderes · Fútbol 11" items={leadersFor("f11")} />
      </div>

      {/* Equipos / clasificación / agenda */}
      <div className={`${card} overflow-hidden`} style={cardStyle}>
        <div className="flex border-b border-gray-200 px-3 overflow-x-auto">
          {[["equipos", `Equipos y clasificación · ${teams.length}`], ["fcf", "Clasificaciones completas"], ["agenda", "Agenda fin de semana"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className="px-3 py-2.5 text-[13px] whitespace-nowrap border-b-[3px] -mb-px transition-colors"
              style={{ borderColor: tab === k ? "var(--granate)" : "transparent", color: tab === k ? "var(--granate)" : "#6b7280", fontWeight: tab === k ? 700 : 500, ...display }}>{l}</button>
          ))}
        </div>
        {tab === "equipos" && (
          <div className="p-3 space-y-3">
            <div className="flex gap-1.5 flex-wrap">
              {GROUPS.map((g) => (
                <button key={g} onClick={() => setGroup(g)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={group === g ? { background: "var(--granate)", color: "#fff" } : { background: "#f3f4f6", color: "#6b7280" }}>{g}</button>
              ))}
              <Link to="/Teams" className="ml-auto text-[11px] font-bold uppercase tracking-wider self-center" style={{ color: "var(--granate)", ...display }}>Gestionar →</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-1.5">
              {shownTeams.map((t) => <TeamCard key={t.id} team={t} count={players.filter((p) => p.team_id === t.id).length} />)}
            </div>
          </div>
        )}
        {tab === "fcf" && <div className="p-3"><FCFClassificationsPanel teams={sortedTeams} /></div>}
        {tab === "agenda" && <div className="p-3"><WeekendAgenda events={weekendEvents} teams={teams} fields={fields} /></div>}
      </div>
    </div>
  );
}
