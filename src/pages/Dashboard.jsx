import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Shield, UserCog, Swords, MapPin, Trophy } from "lucide-react";
import { format, startOfDay, addDays, isSameDay, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import MiniCalendar from "../components/dashboard/MiniCalendar";
import FCFClassificationsPanel from "../components/dashboard/FCFClassificationsPanel";
import WeekendAgenda from "../components/dashboard/WeekendAgenda";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { playerFullName } from "@/lib/playerName";
import { useCountedStats } from "@/lib/matchStatus";
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
        <div key={l} className="rounded-lg px-3.5 pt-2 pb-1.5 text-center" style={{ background: "rgba(255,255,255,0.12)" }}>
          <p className="text-3xl font-black leading-none text-white" style={display}>{String(v).padStart(2, "0")}</p>
          <p className="text-[9px] uppercase tracking-widest text-white/65 mt-1">{l}</p>
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
          <Link to={`${base}&tab=tactica`} className="text-sm font-bold px-4 py-2 rounded-md" style={primary}>Preparar partido</Link>
          <Link to={`${base}&tab=convocatoria`} className="text-sm font-semibold px-4 py-2 rounded-md" style={secondary}>Ver convocatoria</Link>
        </>
      ) : (
        <Link to={base} className="text-sm font-semibold px-4 py-2 rounded-md" style={secondary}>Ver partido</Link>
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
    <Link to={`/TeamDetail?id=${team.id}`} className="bg-white border border-gray-200 p-3 hover:shadow-md transition-shadow flex flex-col gap-1.5" style={{ borderRadius: "6px", borderLeft: "3px solid var(--granate)" }}>
      <p className="font-black text-gray-900 uppercase text-[13px] leading-tight truncate" style={display}>{team.name}</p>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-black leading-none" style={{ ...display, color: "var(--granate)" }}>{me ? `${me.pos}º` : "—"}</span>
        <span className="text-[11px] text-gray-500 mb-0.5">{me ? `${me.pts} pts` : ""}</span>
        <span className="ml-auto text-[10px] text-gray-400 mb-0.5">{count} jug.</span>
      </div>
      <div className="flex gap-0.5 h-4">
        {form.map((f, i) => (
          <span key={i} className="w-4 h-4 rounded-[3px] text-[9px] font-black text-white flex items-center justify-center" style={{ background: (FORM[f] || ["?", "#9ca3af"])[1] }}>{(FORM[f] || ["?"])[0]}</span>
        ))}
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
  const { isCoordinator, coachTeamIds } = useTeamAccess();
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

  const myIds = useMemo(() => new Set(coachTeamIds || []), [coachTeamIds]);
  const hasMine = myIds.size > 0;
  // Coordinación ve todo el club; el resto de la agenda/asistencia, solo sus equipos
  const scopeIds = isCoordinator || !hasMine ? null : myIds;
  const inScope = (teamId) => !scopeIds || scopeIds.has(teamId);
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

  const recent = events
    .filter((e) => isMatch(e.type) && e.score_home != null && e.score_away != null)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  // Esta semana: próximos 4 días con actividad (7 días vista)
  const weekEvents = upcoming.filter((e) => inScope(e.team_id) && new Date(e.date) < addDays(today, 7));
  const dayKeys = [...new Set(weekEvents.map((e) => format(new Date(e.date), "yyyy-MM-dd")))].slice(0, 4);

  // Líderes por modalidad (F7 / F11)
  const formatByEvent = useMemo(() => new Map(events.map((e) => [e.id, e.football_format === "f7" || e.football_format === "f5" ? "f7" : "f11"])), [events]);
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

  const sortedTeams = useMemo(() => [...teams].sort((a, b) => (a.name || "").localeCompare(b.name || "", "es", { numeric: true })), [teams]);
  const shownTeams = sortedTeams.filter((t) => group === "Todos" || groupOf(t) === group);

  const calEvents = events.filter((e) => inScope(e.team_id));
  const weekendEvents = events.filter((e) => inScope(e.team_id));

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400" style={display}>Temporada 2025–2026</p>
          <h1 className="text-3xl font-black leading-none" style={{ ...display, color: "var(--granate)" }}>Panel de control</h1>
        </div>
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
            <div className="rounded-xl p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5 on-dark" style={{ background: "linear-gradient(135deg, var(--granate) 0%, var(--granate-dark) 100%)" }}>
              <div className="flex-1 min-w-0 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">{nextIsMine ? "Próximo partido del club · es de tus equipos" : "Próximo partido del club"}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <Swords className="w-7 h-7 text-white/80 shrink-0" />
                  <p className="text-2xl font-black text-white leading-tight" style={display}>{nextClub.title}</p>
                </div>
                <p className="text-sm text-white/85 flex items-center gap-4 flex-wrap">
                  <span className="font-bold capitalize">{format(new Date(nextClub.date), "EEE d MMM · HH:mm", { locale: es })}</span>
                  <span>{teamName(nextClub.team_id)}</span>
                  {nextClub.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{nextClub.location}</span>}
                </p>
                <MatchButtons ev={nextClub} mine={myIds.has(nextClub.team_id) || isCoordinator} light />
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

      {/* Esta semana + calendario */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${card} lg:col-span-2`} style={cardStyle}>
          <Title right={<Link to="/Calendar" className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--granate)", ...display }}>Calendario completo →</Link>}>
            Esta semana{!isCoordinator && hasMine ? " · mis equipos" : ""}
          </Title>
          {dayKeys.length === 0 ? <p className="px-4 pb-4 text-sm text-gray-400">Sin eventos en los próximos días.</p> : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 pb-4">
              {dayKeys.map((k) => {
                const d = new Date(`${k}T00:00:00`);
                const evs = weekEvents.filter((e) => format(new Date(e.date), "yyyy-MM-dd") === k);
                const sorted = [...evs.filter((e) => isMatch(e.type)), ...evs.filter((e) => !isMatch(e.type))];
                return (
                  <div key={k} className="space-y-1.5 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest capitalize" style={{ ...display, color: isSameDay(d, today) ? "var(--naranja)" : "#6b7280" }}>
                      {isSameDay(d, today) ? "Hoy · " : ""}{format(d, "EEE d", { locale: es })}
                    </p>
                    {sorted.slice(0, 3).map((e) => {
                      const m = isMatch(e.type);
                      const content = (
                        <div className="rounded-md px-2.5 py-1.5 hover:brightness-95 transition" style={{ background: m ? "var(--granate-pale)" : "#f9fafb" }}>
                          <p className="text-[10px] font-bold" style={{ color: m ? "var(--granate)" : "var(--naranja)" }}>{format(new Date(e.date), "HH:mm")}</p>
                          <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2">{m ? (e.opponent ? `${teamName(e.team_id)} vs ${e.opponent}` : e.title) : (e.title || "Entrenamiento")}</p>
                          {!m && <p className="text-[10px] text-gray-500">{teamName(e.team_id)}</p>}
                        </div>
                      );
                      return m ? <Link key={e.id} to={`/MatchDetail?id=${e.id}&teamId=${e.team_id}`} className="block">{content}</Link> : <div key={e.id}>{content}</div>;
                    })}
                    {sorted.length > 3 && <Link to="/Calendar" className="block text-[11px] font-bold pl-1" style={{ color: "var(--granate)" }}>+{sorted.length - 3} más</Link>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <MiniCalendar events={calEvents} />
      </div>

      {/* Resultados + líderes F7 / F11 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${card} overflow-hidden`} style={cardStyle}>
          <Title>Resultados recientes</Title>
          <div className="pb-2">
            {recent.length === 0 && <p className="px-4 pb-3 text-sm text-gray-400">Todavía no hay resultados.</p>}
            {recent.map((m) => {
              const win = m.score_home > m.score_away, draw = m.score_home === m.score_away;
              const c = win ? "#16a34a" : draw ? "#6b7280" : "#dc2626";
              return (
                <Link key={m.id} to={`/MatchDetail?id=${m.id}&teamId=${m.team_id}`} className="px-4 py-1.5 flex items-center gap-3 hover:bg-gray-50">
                  <span className="w-5 h-5 rounded text-[10px] font-black text-white flex items-center justify-center shrink-0" style={{ background: c }}>{win ? "V" : draw ? "E" : "D"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{teamName(m.team_id)}</p>
                    <p className="text-[11px] text-gray-500 truncate">vs {m.opponent || "—"}</p>
                  </div>
                  <span className="text-lg font-black shrink-0" style={{ ...display, color: c }}>{m.score_home}–{m.score_away}</span>
                </Link>
              );
            })}
          </div>
        </div>
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
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
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
