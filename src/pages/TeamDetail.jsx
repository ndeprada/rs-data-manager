import TeamMatchesColumns from "@/components/team/TeamMatchesColumns";
import { isCancelled } from "@/lib/eventCancel";
import TeamSquadTable from "@/components/team/TeamSquadTable";
import TeamSeasonHistory from "@/components/team/TeamSeasonHistory";
import React, { useState } from "react";
import { getCategoryLabel } from "@/components/fcfCategories";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { isAfter, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AddPlayerDialog from "@/components/team/AddPlayerDialog";
import AddStaffDialog from "@/components/team/AddStaffDialog";
import TeamStaffSection from "@/components/team/TeamStaffSection";
import { useSelectedTeam } from "@/lib/useSelectedTeam";
import WeeklyCalendar from "@/components/myteam/WeeklyCalendar";
import CreateEventDialog from "@/components/myteam/CreateEventDialog";
import EditEventDialog from "@/components/myteam/EditEventDialog";
import { useCountedStats } from "@/lib/matchStatus";
import { statTeamResolver, statsOfTeam } from "@/lib/teamStats";
import { useT, msg } from "@/i18n";

const EVENT_TYPES = [
  { value: "entrenamiento", label: msg("Entrenamiento") },
  { value: "partido_liga", label: msg("Partido de liga") },
  { value: "partido_amistoso", label: msg("Partido amistoso") },
  { value: "torneo", label: msg("Torneo") },
  { value: "entrenamiento_fisico", label: msg("Entrenamiento físico") },
  { value: "sesion_teorica", label: msg("Sesión teórica") },
  { value: "sesion_video", label: msg("Sesión de vídeo") },
  { value: "reunion_equipo", label: msg("Reunión de equipo") },
  { value: "concentracion", label: msg("Concentración") },
  { value: "cena_equipo", label: msg("Cena de equipo") },
  { value: "evento_club", label: msg("Evento del club") },
];

const isMatchType = (type) => ["partido_amistoso", "partido_liga", "torneo"].includes(type);

const STATUS_STYLES = {
  activo: { label: msg("Activo"), bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  lesionado: { label: msg("Lesionado"), bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  baja: { label: msg("Baja"), bg: "#fdf2f4", color: "#73000A", border: "#fecdd3" },
};

const POSITIONS = {
  portero: msg("Portero"), lateral: msg("Lateral"), central: msg("Central"), libre: msg("Libre"),
  mediocentro: msg("Mediocentro"), interior: msg("Interior"), mediapunta: msg("Mediapunta"), delantero_centro: msg("Delantero Centro"), extremo: msg("Extremo"),
};

const STAFF_ROLES = {
  entrenador: msg("Entrenador"), ayudante: msg("Ayudante"), preparador_fisico: msg("Preparador Físico"),
  portero_coach: msg("Entrenador de Porteros"), medico: msg("Médico"), fisioterapeuta: msg("Fisioterapeuta"),
  coordinador: msg("Coordinador"), otro: msg("Otro"),
};



const POSITION_GROUPS = ["portero", "lateral", "central", "libre", "mediocentro", "interior", "mediapunta", "delantero_centro", "extremo"];

export default function TeamDetail() {
  const t = useT();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const teamId = urlParams.get("id");

  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);
  const [deletePlayer, setDeletePlayer] = useState(null);
  const [deleteStaff, setDeleteStaff] = useState(null);
  const [newEventOpen, setNewEventOpen] = useState(false);
  const { selectTeam } = useSelectedTeam();
  const [createEventDate, setCreateEventDate] = useState(null);
  const [editingWeekEvent, setEditingWeekEvent] = useState(null);
  const [eventForm, setEventForm] = useState({ title: "", type: "entrenamiento", date: "", location: "", opponent: "" });

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: staffList = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.StaffMember.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: raw_matchStats = [] } = useQuery({ queryKey: ["matchStats"], queryFn: () => base44.entities.MatchStats.list("-date", 500) });
  const matchStats = useCountedStats(raw_matchStats);

  const deletePlayerMutation = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["players"] }); setDeletePlayer(null); },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (id) => base44.entities.StaffMember.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff"] }); setDeleteStaff(null); },
  });

  const createEventMutation = useMutation({
    mutationFn: (data) => base44.entities.Event.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setNewEventOpen(false);
      setEventForm({ title: "", type: "entrenamiento", date: "", location: "", opponent: "" });
    },
  });

  const handleCreateEvent = (e) => {
    e.preventDefault();
    createEventMutation.mutate({ ...eventForm, team_id: teamId });
  };

  const team = teams.find((t) => t.id === teamId);
  const teamPlayers = players.filter((p) => p.team_id === teamId);
  const teamStaff = staffList.filter((s) => s.team_id === teamId);
  
  // Últimos partidos
  const teamMatchEvents = events
    .filter((e) => e.team_id === teamId && ["partido_liga", "partido_amistoso", "torneo"].includes(e.type));

  // Estadísticas por jugador
  // Solo cuentan los partidos jugados con este equipo (lo que hagan como invitados en otro equipo cuenta allí)
  const playerStatsMap = {};
  const teamOf = statTeamResolver(events, players);
  teamPlayers.forEach((p) => {
    const stats = statsOfTeam(matchStats.filter((ms) => ms.player_id === p.id), teamId, teamOf);
    playerStatsMap[p.id] = {
      matches: stats.length,
      goals: stats.reduce((sum, s) => sum + (s.goals || 0), 0),
      assists: stats.reduce((sum, s) => sum + (s.assists || 0), 0),
      yellowCards: stats.reduce((sum, s) => sum + (s.yellow_cards || 0), 0),
      redCards: stats.reduce((sum, s) => sum + (s.red_cards || 0), 0),
      avgRating: stats.length > 0 ? (stats.reduce((sum, s) => sum + (s.rating || 0), 0) / stats.length).toFixed(1) : "—",
      minutesPlayed: stats.reduce((sum, s) => sum + (s.minutes_played || 0), 0),
    };
  });

  // Todos los eventos del equipo (la previsión semanal navega por cualquier semana)
  const allTeamEvents = events.filter((e) => e.team_id === teamId);
  const teamEvents = allTeamEvents
    .filter((e) => isAfter(new Date(e.date), startOfDay(new Date())) && !isCancelled(e))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!team) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">{t("Equipo no encontrado")}</p>
        <Link to="/Teams" className="text-sm font-medium mt-2 inline-block" style={{ color: "var(--granate)" }}>{t("← Volver a equipos")}</Link>
      </div>
    );
  }

  const openEditPlayer = (player) => { setEditingPlayer(player); setPlayerDialogOpen(true); };
  const openEditStaff = (staff) => { setEditingStaff(staff); setStaffDialogOpen(true); };

  return (
    <div className="space-y-4">
      <div>
        <Link to="/Teams" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4 font-medium">
          <ArrowLeft className="w-4 h-4" /> {t("Volver a equipos")}
        </Link>
        <div className="flex items-center gap-4">
          <img src="https://media.base44.com/images/public/69b72e4f23c3602504953d0d/442c01da9_Escudo_Granate.png" alt={t("Escudo")} className="w-14 h-14 object-contain shrink-0" />
          <div>
            <h1 className="text-3xl leading-none">{team.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1">
              <span>{getCategoryLabel(team.category)}</span>
              {team.coach && <span>{t("· Entrenador: {coach}", { coach: team.coach })}</span>}
              {team.season && <span>· {team.season}</span>}
              <span>{t("· {n} jugadores", { n: teamPlayers.filter(p => p.status !== "baja").length })}</span>
              {team.fcf_group_url && (
                <a href={team.fcf_group_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                  style={{ color: "var(--granate)" }}>
                  <ExternalLink className="w-3.5 h-3.5" /> {t("Grup FCF")}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Próximos Eventos - WeeklyCalendar */}
      <WeeklyCalendar
        events={allTeamEvents}
        teamId={teamId}
        onDayClick={(day) => setCreateEventDate(day)}
        onEventClick={(ev) => {
          // Entrenamientos: abrir el control de asistencia de ese día; otros eventos: editar
          if (["entrenamiento", "entrenamiento_fisico", "sesion_teorica", "sesion_video"].includes(ev.type)) {
            selectTeam(ev.team_id || teamId);
            navigate(`/MyTeam/Attendance?eventId=${ev.id}`);
          } else {
            setEditingWeekEvent(ev);
          }
        }}
      />
      <CreateEventDialog
        open={!!createEventDate}
        onOpenChange={(open) => { if (!open) setCreateEventDate(null); }}
        date={createEventDate}
        teamId={teamId}
      />
      <EditEventDialog
        open={!!editingWeekEvent}
        onOpenChange={(open) => { if (!open) setEditingWeekEvent(null); }}
        event={editingWeekEvent}
      />

      {/* Últimos y próximos partidos (3 y 3) */}
      <TeamMatchesColumns matches={teamMatchEvents} onOpen={(m) => navigate(`/MatchDetail?id=${m.id}&teamId=${m.team_id}`)} />

      {/* Plantilla: datos + estadísticas en una sola tabla */}
      <TeamSquadTable teamId={teamId} onAddPlayer={() => { setEditingPlayer(null); setPlayerDialogOpen(true); }} />

      {/* Team Staff Section - Vincular staff existente */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <TeamStaffSection teamId={teamId} />
      </div>

      <TeamSeasonHistory teamId={teamId} />



      {/* Dialog crear evento */}
      <Dialog open={newEventOpen} onOpenChange={setNewEventOpen}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle>{t("Nuevo Evento")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateEvent} className="space-y-4">
            <div className="space-y-1">
              <Label>{t("Título *")}</Label>
              <Input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} required placeholder={t("Ej: Entrenamiento martes")} />
            </div>
            <div className="space-y-1">
              <Label>{t("Tipo *")}</Label>
              <Select value={eventForm.type} onValueChange={(v) => setEventForm({ ...eventForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(opt => <SelectItem key={opt.value} value={opt.value}>{t(opt.label)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("Fecha y hora *")}</Label>
              <Input type="datetime-local" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>{t("Lugar")}</Label>
              <Input value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} placeholder={t("Ej: Camp Municipal")} />
            </div>
            {isMatchType(eventForm.type) && (
              <div className="space-y-1">
                <Label>{t("Rival")}</Label>
                <Input value={eventForm.opponent} onChange={(e) => setEventForm({ ...eventForm, opponent: e.target.value })} placeholder={t("Nombre del equipo rival")} />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setNewEventOpen(false)}>{t("Cancelar")}</Button>
              <Button variant="club" type="submit">{t("Crear evento")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AddPlayerDialog
        open={playerDialogOpen}
        onOpenChange={(open) => { setPlayerDialogOpen(open); if (!open) setEditingPlayer(null); }}
        teamId={teamId}
        editingPlayer={editingPlayer}
      />

      <AddStaffDialog
        open={staffDialogOpen}
        onOpenChange={(open) => { setStaffDialogOpen(open); if (!open) setEditingStaff(null); }}
        teamId={teamId}
        editingStaff={editingStaff}
      />

      <AlertDialog open={!!deletePlayer} onOpenChange={(open) => { if (!open) setDeletePlayer(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("¿Eliminar jugador?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Esta acción no se puede deshacer.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletePlayerMutation.mutate(deletePlayer)} className="bg-red-600 hover:bg-red-700 text-white">{t("Eliminar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteStaff} onOpenChange={(open) => { if (!open) setDeleteStaff(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("¿Eliminar miembro?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Esta acción no se puede deshacer.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteStaffMutation.mutate(deleteStaff)} className="bg-red-600 hover:bg-red-700 text-white">{t("Eliminar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}