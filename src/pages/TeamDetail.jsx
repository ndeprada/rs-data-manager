import React, { useState } from "react";
import { getCategoryLabel } from "@/components/fcfCategories";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Users, ArrowLeft, MapPin, Plus, Pencil, Trash2, UserCog, ExternalLink, TrendingUp, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format, isAfter, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AddPlayerDialog from "@/components/team/AddPlayerDialog";
import AddStaffDialog from "@/components/team/AddStaffDialog";
import TeamStaffSection from "@/components/team/TeamStaffSection";
import WeeklyCalendar from "@/components/myteam/WeeklyCalendar";

const EVENT_TYPES = [
  { value: "entrenamiento", label: "Entrenamiento" },
  { value: "partido_liga", label: "Partido de liga" },
  { value: "partido_amistoso", label: "Partido amistoso" },
  { value: "torneo", label: "Torneo" },
  { value: "entrenamiento_fisico", label: "Entrenamiento físico" },
  { value: "sesion_teorica", label: "Sesión teórica" },
  { value: "sesion_video", label: "Sesión de vídeo" },
  { value: "reunion_equipo", label: "Reunión de equipo" },
  { value: "concentracion", label: "Concentración" },
  { value: "cena_equipo", label: "Cena de equipo" },
];

const isMatchType = (type) => ["partido_amistoso", "partido_liga", "torneo"].includes(type);

const STATUS_STYLES = {
  activo: { label: "Activo", bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  lesionado: { label: "Lesionado", bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  baja: { label: "Baja", bg: "#fdf2f4", color: "#8B1A2B", border: "#fecdd3" },
};

const POSITIONS = {
  portero: "Portero", lateral: "Lateral", central: "Central", libre: "Libre",
  mediocentro: "Mediocentro", interior: "Interior", delantero_centro: "Delantero Centro", extremo: "Extremo",
};

const STAFF_ROLES = {
  entrenador: "Entrenador", ayudante: "Ayudante", preparador_fisico: "Preparador Físico",
  portero_coach: "Entrenador de Porteros", medico: "Médico", fisioterapeuta: "Fisioterapeuta",
  coordinador: "Coordinador", otro: "Otro",
};



const POSITION_GROUPS = ["portero", "lateral", "central", "libre", "mediocentro", "interior", "delantero_centro", "extremo"];

export default function TeamDetail() {
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
  const [eventForm, setEventForm] = useState({ title: "", type: "entrenamiento", date: "", location: "", opponent: "" });

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: staffList = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.StaffMember.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date", 200) });
  const { data: matchStats = [] } = useQuery({ queryKey: ["matchStats"], queryFn: () => base44.entities.MatchStats.list("-date", 500) });

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
  const recentMatches = events
    .filter((e) => e.team_id === teamId && ["partido_liga", "partido_amistoso", "torneo"].includes(e.type))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  // Estadísticas por jugador
  const playerStatsMap = {};
  teamPlayers.forEach((p) => {
    const stats = matchStats.filter((ms) => ms.player_id === p.id);
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

  const teamEvents = events
    .filter((e) => e.team_id === teamId && isAfter(new Date(e.date), startOfDay(new Date())))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 10);

  if (!team) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Equipo no encontrado</p>
        <Link to="/Teams" className="text-sm font-medium mt-2 inline-block" style={{ color: "var(--granate)" }}>← Volver a equipos</Link>
      </div>
    );
  }

  const openEditPlayer = (player) => { setEditingPlayer(player); setPlayerDialogOpen(true); };
  const openEditStaff = (staff) => { setEditingStaff(staff); setStaffDialogOpen(true); };

  return (
    <div className="space-y-8">
      <div>
        <Link to="/Teams" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4 font-medium">
          <ArrowLeft className="w-4 h-4" /> Volver a equipos
        </Link>
        <div className="flex items-center gap-4">
          <img src="https://media.base44.com/images/public/69b72e4f23c3602504953d0d/442c01da9_Escudo_Granate.png" alt="Escudo" className="w-14 h-14 object-contain shrink-0" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">{team.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1">
              <span>{getCategoryLabel(team.category)}</span>
              {team.coach && <span>· Entrenador: {team.coach}</span>}
              {team.season && <span>· {team.season}</span>}
              {team.fcf_group_url && (
                <a href={team.fcf_group_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                  style={{ color: "var(--granate)" }}>
                  <ExternalLink className="w-3.5 h-3.5" /> Grup FCF
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Jugadores", value: teamPlayers.length },
          { label: "Activos", value: teamPlayers.filter(p => p.status === "activo").length },
          { label: "Próx. eventos", value: teamEvents.length },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-2xl p-5 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Próximos Eventos - WeeklyCalendar */}
      <WeeklyCalendar events={teamEvents} teamId={teamId} />

      {/* Últimos Partidos */}
      {recentMatches.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-lg text-gray-900">Últimos Partidos</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentMatches.map((match) => (
              <div key={match.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{match.title}</p>
                    {match.opponent && (
                      <p className="text-sm text-gray-500 mt-0.5">vs <span className="font-medium">{match.opponent}</span></p>
                    )}
                    {match.location && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{match.location}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{format(new Date(match.date), "d MMM", { locale: es })}</p>
                    <p className="text-xs text-gray-400">{format(new Date(match.date), "HH:mm")}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estadísticas de Jugadores */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gray-400" />
          <h2 className="font-semibold text-lg text-gray-900">Estadísticas de Jugadores</h2>
        </div>
        {teamPlayers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay jugadores en este equipo</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500">
                  <th className="text-left font-medium px-5 py-3">Jugador</th>
                  <th className="text-center font-medium px-3 py-3 whitespace-nowrap">Partidos</th>
                  <th className="text-center font-medium px-3 py-3 whitespace-nowrap">Goles</th>
                  <th className="text-center font-medium px-3 py-3 whitespace-nowrap">Asistencias</th>
                  <th className="text-center font-medium px-3 py-3 whitespace-nowrap">Minutos</th>
                  <th className="text-center font-medium px-3 py-3 whitespace-nowrap">Valoración</th>
                  <th className="text-center font-medium px-3 py-3 whitespace-nowrap">Amarillas</th>
                  <th className="text-center font-medium px-3 py-3 whitespace-nowrap">Rojas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teamPlayers.map((player) => {
                  const stats = playerStatsMap[player.id];
                  return (
                    <tr key={player.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link to={`/PlayerProfile?id=${player.id}`} className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "var(--granate)" }}>
                            {player.jersey_number || (player.first_name?.[0] + (player.last_name?.[0] || ""))}
                          </div>
                          <span className="font-medium text-gray-900 group-hover:underline">{player.first_name} {player.last_name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-gray-900">{stats.matches}</td>
                      <td className="px-3 py-3 text-center text-gray-900">{stats.goals}</td>
                      <td className="px-3 py-3 text-center text-gray-900">{stats.assists}</td>
                      <td className="px-3 py-3 text-center text-gray-600">{stats.minutesPlayed}</td>
                      <td className="px-3 py-3 text-center font-medium" style={{ color: stats.avgRating !== "—" ? (parseFloat(stats.avgRating) >= 4 ? "var(--granate)" : "#666") : "#999" }}>
                        {stats.avgRating}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {stats.yellowCards > 0 && <span className="inline-block w-4 h-4 bg-yellow-400 rounded text-xs text-white font-bold">{stats.yellowCards}</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {stats.redCards > 0 && <span className="inline-block w-4 h-4 bg-red-600 rounded text-xs text-white font-bold">{stats.redCards}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Players */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-lg text-gray-900">Plantilla</h2>
          </div>
          <Button size="sm" onClick={() => { setEditingPlayer(null); setPlayerDialogOpen(true); }} className="text-white" style={{ background: "var(--granate)" }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Añadir jugador
          </Button>
        </div>
        {teamPlayers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay jugadores en este equipo</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {POSITION_GROUPS.map((pos) => {
              const groupPlayers = teamPlayers.filter((p) => p.position === pos);
              if (groupPlayers.length === 0) return null;
              return (
                <div key={pos}>
                  <div className="px-5 py-2 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{POSITIONS[pos]}</p>
                  </div>
                  {groupPlayers.map((player) => {
                    const st = STATUS_STYLES[player.status] || STATUS_STYLES.activo;
                    return (
                      <div key={player.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group">
                        <Link to={`/PlayerProfile?id=${player.id}`} className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "var(--granate)" }}>
                          {player.jersey_number || (player.first_name?.[0] + (player.last_name?.[0] || ""))}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link to={`/PlayerProfile?id=${player.id}`} className="font-medium text-gray-900 hover:underline">
                            {player.first_name} {player.last_name}
                          </Link>
                          {player.secondary_position && (
                            <p className="text-xs text-gray-400">{POSITIONS[player.secondary_position]} (2ª pos.){player.laterality ? ` · ${player.laterality}` : ""}</p>
                          )}
                        </div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border" style={{ background: st.bg, color: st.color, borderColor: st.border }}>
                          {st.label}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditPlayer(player)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDeletePlayer(player.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {teamPlayers.filter(p => !p.position).length > 0 && (
              <div>
                <div className="px-5 py-2 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sin posición</p>
                </div>
                {teamPlayers.filter(p => !p.position).map((player) => {
                  const st = STATUS_STYLES[player.status] || STATUS_STYLES.activo;
                  return (
                    <div key={player.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group">
                      <Link to={`/PlayerProfile?id=${player.id}`} className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "var(--granate)" }}>
                        {player.first_name?.[0]}{player.last_name?.[0]}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/PlayerProfile?id=${player.id}`} className="font-medium text-gray-900 hover:underline">{player.first_name} {player.last_name}</Link>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border" style={{ background: st.bg, color: st.color, borderColor: st.border }}>
                        {st.label}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditPlayer(player)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeletePlayer(player.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Team Staff Section - Vincular staff existente */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <UserCog className="w-5 h-5 text-gray-400" />
          <h2 className="font-semibold text-lg text-gray-900">Cuerpo Técnico del Equipo</h2>
        </div>
        <TeamStaffSection teamId={teamId} />
      </div>



      {/* Dialog crear evento */}
      <Dialog open={newEventOpen} onOpenChange={setNewEventOpen}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle>Nuevo Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateEvent} className="space-y-4">
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} required placeholder="Ej: Entrenamiento martes" />
            </div>
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={eventForm.type} onValueChange={(v) => setEventForm({ ...eventForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha y hora *</Label>
              <Input type="datetime-local" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Lugar</Label>
              <Input value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} placeholder="Ej: Camp Municipal" />
            </div>
            {isMatchType(eventForm.type) && (
              <div className="space-y-1">
                <Label>Rival</Label>
                <Input value={eventForm.opponent} onChange={(e) => setEventForm({ ...eventForm, opponent: e.target.value })} placeholder="Nombre del equipo rival" />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setNewEventOpen(false)}>Cancelar</Button>
              <Button type="submit" className="text-white" style={{ background: "var(--granate)" }}>Crear evento</Button>
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
            <AlertDialogTitle>¿Eliminar jugador?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletePlayerMutation.mutate(deletePlayer)} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteStaff} onOpenChange={(open) => { if (!open) setDeleteStaff(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar miembro?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteStaffMutation.mutate(deleteStaff)} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}