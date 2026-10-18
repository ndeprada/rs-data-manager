import TeamMatchesColumns from "@/components/team/TeamMatchesColumns";
import TeamSquadTable from "@/components/team/TeamSquadTable";
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
import TeamAlerts from "@/components/myteam/TeamAlerts";
import CalendarSubscribe from "@/components/calendar/CalendarSubscribe";
import { getCategoryLabel } from "@/components/fcfCategories";
import TeamSummary from "@/components/myteam/TeamSummary";
import { useCountedStats } from "@/lib/matchStatus";

import PageHeader, { PageTitle } from "@/components/common/PageHeader";
import { TeamSelectTrigger } from "@/components/myteam/TeamPageHeader";
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
  const { selectedTeamId, selectTeam, isCoordinator, canSwitch, teamIds: myTeamIds } = useSelectedTeam();

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: raw_matchStats = [] } = useQuery({ queryKey: ["matchStats"], queryFn: () => base44.entities.MatchStats.list("-date", 500) });
  const matchStats = useCountedStats(raw_matchStats);

  const [createEventDate, setCreateEventDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
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
        <PageTitle kicker="Club" title="Mi Equipo" />
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
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        kicker="Mi Equipo"
        title={selectedTeam?.name || "—"}
        subtitle={[getCategoryLabel(selectedTeam?.category), selectedTeam?.coach].filter(Boolean).join(" · ")}
        actions={
          <>
            <CalendarSubscribe teamId={selectedTeamId} teamName={selectedTeam?.name} />
            {canSwitch && (
              <Select value={selectedTeamId} onValueChange={selectTeam}>
                <TeamSelectTrigger />
                <SelectContent>{teams.filter(t => isCoordinator || (myTeamIds || []).includes(t.id)).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </>
        }
      />

      <TeamAlerts teamId={selectedTeamId} players={teamPlayers} />

      {selectedTeam && <TeamSummary team={selectedTeam} events={teamEvents} players={players} matchStats={matchStats} />}

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

      <AddPlayerDialog open={addPlayerOpen} onOpenChange={setAddPlayerOpen} teamId={selectedTeamId} />

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

      {/* Últimos y próximos partidos (3 y 3) */}
      <TeamMatchesColumns matches={teamEvents.filter(e => MATCH_TYPES.includes(e.type))} onOpen={(m) => navigate(`/MatchDetail?id=${m.id}&teamId=${m.team_id}`)} />

      {/* Plantilla: datos + estadísticas en una sola tabla */}
      <TeamSquadTable teamId={selectedTeamId} onAddPlayer={() => setAddPlayerOpen(true)} />
    </div>
  );
}