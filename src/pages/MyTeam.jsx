import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isAfter, startOfDay, startOfWeek, endOfWeek, addDays, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate, Link } from "react-router-dom";
import { Shield, ChevronRight, Pencil, Trash2, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useSelectedTeam } from "@/lib/useSelectedTeam";
import FCFClassificationsPanel from "@/components/dashboard/FCFClassificationsPanel";
import WeeklyCalendar from "@/components/myteam/WeeklyCalendar";
import CreateEventDialog from "@/components/myteam/CreateEventDialog";
import AddPlayerDialog from "@/components/team/AddPlayerDialog";
import EditEventDialog from "@/components/myteam/EditEventDialog";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico", "sesion_teorica", "sesion_video"];
const RESULT_COLORS = {
  victoria: "text-green-700 bg-green-50 border-green-200",
  derrota: "text-red-700 bg-red-50 border-red-200",
  empate: "text-yellow-700 bg-yellow-50 border-yellow-200",
};

export default function MyTeam() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedTeamId, selectTeam, isCoordinator } = useSelectedTeam();

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date", 100) });
  const { data: matchStats = [] } = useQuery({ queryKey: ["matchStats"], queryFn: () => base44.entities.MatchStats.list("-date", 500) });

  const [createEventDate, setCreateEventDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [deletePlayerId, setDeletePlayerId] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["players"] }); setDeletePlayerId(null); },
  });

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { locale: es });
  const weekEnd = endOfWeek(today, { locale: es });

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const teamPlayers = players.filter(p => p.team_id === selectedTeamId && p.status !== "baja");

  const teamEvents = events.filter(e => e.team_id === selectedTeamId);

  // Semana en curso o próxima semana (la que tenga entrenamientos)
  const curWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const nextWeekStart = addDays(curWeekEnd, 1);
  const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });

  const curWeekTrainings = teamEvents.filter(e =>
    TRAINING_TYPES.includes(e.type) &&
    new Date(e.date) >= today &&
    new Date(e.date) <= curWeekEnd
  );
  const weekRangeStart = curWeekTrainings.length > 0 ? today : nextWeekStart;
  const weekRangeEnd = curWeekTrainings.length > 0 ? curWeekEnd : nextWeekEnd;

  const thisWeekTrainings = teamEvents.filter(e =>
    TRAINING_TYPES.includes(e.type) &&
    new Date(e.date) >= weekRangeStart &&
    new Date(e.date) <= weekRangeEnd
  ).sort((a, b) => new Date(a.date) - new Date(b.date));

  const nextMatch = teamEvents
    .filter(e => MATCH_TYPES.includes(e.type) && isAfter(new Date(e.date), today))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  const recentMatches = teamEvents
    .filter(e => MATCH_TYPES.includes(e.type) && !isAfter(new Date(e.date), today))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const getResult = (event) => {
    if (event.score_home === null || event.score_home === undefined) return null;
    const h = Number(event.score_home ?? 0), a = Number(event.score_away ?? 0);
    if (h > a) return "victoria"; if (h < a) return "derrota"; return "empate";
  };

  // Player stats aggregation
  const playerWithStats = teamPlayers.map(p => {
    const stats = matchStats.filter(s => s.player_id === p.id);
    const goals = stats.reduce((acc, s) => acc + (s.goals || 0), 0);
    const assists = stats.reduce((acc, s) => acc + (s.assists || 0), 0);
    const matches = stats.length;
    return { ...p, goals, assists, matches };
  }).sort((a, b) => b.goals - a.goals || b.assists - a.assists);

  if (!selectedTeamId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-black uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Mi Equipo</h1>
        {isCoordinator ? (
          <div className="bg-white border border-gray-200 rounded p-8 text-center">
            <Shield className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 mb-4">Selecciona un equipo para ver su panel</p>
            <div className="flex justify-center">
              <Select value="" onValueChange={selectTeam}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Seleccionar equipo..." /></SelectTrigger>
                <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">No tienes un equipo asignado. Contacta con el coordinador.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1" style={{ fontFamily: "var(--font-display)" }}>Mi Equipo</p>
          <h1 className="text-3xl md:text-4xl font-black uppercase leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
            {selectedTeam?.name || "—"}
          </h1>
          <p className="text-xs text-gray-400 capitalize mt-1">{selectedTeam?.category} · {selectedTeam?.coach}</p>
        </div>
        {isCoordinator && (
          <Select value={selectedTeamId} onValueChange={selectTeam}>
            <SelectTrigger className="w-56 border-gray-200 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      {/* Previsión semanal en columnas */}
      <WeeklyCalendar
        events={teamEvents}
        teamId={selectedTeamId}
        onDayClick={(day) => setCreateEventDate(day)}
        onEventClick={(ev) => {
          if (TRAINING_TYPES.includes(ev.type)) {
            navigate(`/MyTeam/Attendance?eventId=${ev.id}`);
          } else if (!MATCH_TYPES.includes(ev.type)) {
            setEditingEvent(ev);
          }
        }}
      />

      <EditEventDialog
        open={!!editingEvent}
        onOpenChange={(open) => { if (!open) setEditingEvent(null); }}
        event={editingEvent}
      />

      <CreateEventDialog
        open={!!createEventDate}
        onOpenChange={(open) => { if (!open) setCreateEventDate(null); }}
        date={createEventDate}
        teamId={selectedTeamId}
      />

      <AddPlayerDialog
        open={!!editingPlayer}
        onOpenChange={(open) => { if (!open) setEditingPlayer(null); }}
        teamId={selectedTeamId}
        editingPlayer={editingPlayer}
      />

      <AlertDialog open={!!deletePlayerId} onOpenChange={open => { if (!open) setDeletePlayerId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar jugador?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deletePlayerId)} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FCF Classifications for this team */}
      {selectedTeam?.fcf_group_url && <FCFClassificationsPanel teams={[selectedTeam]} />}

      {/* Recent Results */}
      {recentMatches.length > 0 && (
        <div className="bg-white border border-gray-200 shadow-sm" style={{ borderRadius: "4px" }}>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-black text-base uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Últimos resultados</h2>
            <Link to="/MyTeam/Matches" className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--granate)", fontFamily: "var(--font-display)" }}>Ver todos →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentMatches.map(m => {
              const result = getResult(m);
              return (
                <button key={m.id} onClick={() => navigate(`/MatchDetail?id=${m.id}&teamId=${m.team_id}`)}
                  className="w-full px-5 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left group">
                  <div className="w-10 text-center shrink-0">
                    <p className="text-lg font-black leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{format(new Date(m.date), "d")}</p>
                    <p className="text-[10px] uppercase text-gray-400">{format(new Date(m.date), "MMM", { locale: es })}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate" style={{ fontFamily: "var(--font-display)" }}>{m.opponent ? `vs ${m.opponent}` : m.title}</p>
                    <p className="text-xs text-gray-400">{m.location || "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {result ? (
                      <>
                        <p className="text-xl font-black" style={{ fontFamily: "var(--font-display)" }}>{m.score_home} - {m.score_away}</p>
                        <span className={`text-[10px] font-bold uppercase border px-2 py-0.5 rounded-sm ${RESULT_COLORS[result]}`}>{result}</span>
                      </>
                    ) : <p className="text-xs text-gray-400">Pendiente</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Players list */}
      <div className="bg-white border border-gray-200 shadow-sm" style={{ borderRadius: "4px" }}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-black text-base uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Plantilla</h2>
          <Link to="/MyTeam/Squad" className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--granate)", fontFamily: "var(--font-display)" }}>Ver completo →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                <th className="text-left px-5 py-2.5 font-bold">#</th>
                <th className="text-left px-3 py-2.5 font-bold">Jugador</th>
                <th className="text-left px-3 py-2.5 font-bold hidden sm:table-cell">Posición</th>
                <th className="text-center px-3 py-2.5 font-bold">PJ</th>
                <th className="text-center px-3 py-2.5 font-bold">Goles</th>
                <th className="text-center px-3 py-2.5 font-bold hidden md:table-cell">Asist.</th>
                <th className="text-center px-3 py-2.5 font-bold hidden sm:table-cell">Estado</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {playerWithStats.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-black text-gray-400" style={{ fontFamily: "var(--font-display)" }}>{p.jersey_number || "—"}</td>
                  <td className="px-3 py-3">
                    <Link to={`/PlayerProfile?id=${p.id}`} className="flex items-center gap-2 group">
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded flex items-center justify-center overflow-hidden border border-gray-200" style={{ background: "var(--granate-pale)" }}>
                          {p.photo_url ? (
                            <img src={p.photo_url} alt={p.first_name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        {p.jersey_number && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center text-[9px] font-black leading-none" style={{ background: "var(--granate)", fontFamily: "var(--font-display)" }}>
                            {p.jersey_number}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-gray-900 group-hover:underline" style={{ fontFamily: "var(--font-display)" }}>{p.first_name} {p.last_name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell text-xs text-gray-500 capitalize">{p.position || "—"}</td>
                  <td className="px-3 py-3 text-center font-black" style={{ fontFamily: "var(--font-display)" }}>{p.matches}</td>
                  <td className="px-3 py-3 text-center font-black" style={{ fontFamily: "var(--font-display)", color: p.goals > 0 ? "var(--granate)" : "inherit" }}>{p.goals}</td>
                  <td className="px-3 py-3 text-center hidden md:table-cell font-bold text-gray-600">{p.assists}</td>
                  <td className="px-3 py-3 text-center hidden sm:table-cell">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border ${
                      p.status === "activo" ? "bg-green-50 text-green-700 border-green-200" :
                      p.status === "lesionado" ? "bg-red-50 text-red-700 border-red-200" :
                      "bg-gray-50 text-gray-500 border-gray-200"
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditingPlayer(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeletePlayerId(p.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}