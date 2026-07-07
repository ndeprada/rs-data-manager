import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, ExternalLink, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

const POSITIONS = ["portero","central","lateral","extremo","mediapunta","libre","mediocentro","interior","delantero_centro"];
const POS_LABELS = { portero:"Portero", central:"Central", lateral:"Lateral", extremo:"Extremo", mediapunta:"Mediapunta", libre:"Libre", mediocentro:"Mediocentro", interior:"Interior", delantero_centro:"Delantero centro" };

const EMPTY_TEAM = { name:"", letter:"", category:"", division:"", group:"", fcf_url:"", season:"", coach:"", observed:false, observation_date:"", standout_players:"", notes:"" };
const EMPTY_PLAYER = { name:"", position:"", laterality:"", birth_year:"", rating:0, notes:"" };

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button" onClick={() => onChange(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)}>
          <Star className={`w-4 h-4 ${i <= (hover || value) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

export default function ObservedTeamsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamForm, setTeamForm] = useState(EMPTY_TEAM);
  const [deleteTeamId, setDeleteTeamId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [playerFormOpen, setPlayerFormOpen] = useState(null); // teamId
  const [playerForm, setPlayerForm] = useState(EMPTY_PLAYER);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [deletePlayerId, setDeletePlayerId] = useState(null);

  const { data: teams = [] } = useQuery({ queryKey: ["observed_teams"], queryFn: () => base44.entities.ObservedTeam.list("-created_date", 200) });
  const { data: players = [] } = useQuery({ queryKey: ["observed_team_players"], queryFn: () => base44.entities.ObservedTeamPlayer.list() });

  const teamCreate = useMutation({
    mutationFn: (data) => base44.entities.ObservedTeam.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["observed_teams"] }); setTeamFormOpen(false); toast({ title: "Equipo añadido." }); },
    onError: err => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const teamUpdate = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ObservedTeam.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["observed_teams"] }); setTeamFormOpen(false); setEditingTeam(null); toast({ title: "Equipo actualizado." }); },
    onError: err => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const teamDelete = useMutation({
    mutationFn: (id) => base44.entities.ObservedTeam.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["observed_teams"] }); setDeleteTeamId(null); },
  });

  const playerCreate = useMutation({
    mutationFn: (data) => base44.entities.ObservedTeamPlayer.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["observed_team_players"] }); setPlayerFormOpen(null); setPlayerForm(EMPTY_PLAYER); toast({ title: "Jugador añadido." }); },
  });
  const playerUpdate = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ObservedTeamPlayer.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["observed_team_players"] }); setPlayerFormOpen(null); setEditingPlayer(null); setPlayerForm(EMPTY_PLAYER); toast({ title: "Jugador actualizado." }); },
  });
  const playerDelete = useMutation({
    mutationFn: (id) => base44.entities.ObservedTeamPlayer.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["observed_team_players"] }); setDeletePlayerId(null); },
  });

  const openTeamEdit = (t) => { setEditingTeam(t); setTeamForm({ ...EMPTY_TEAM, ...t }); setTeamFormOpen(true); };
  const openTeamNew = () => { setEditingTeam(null); setTeamForm(EMPTY_TEAM); setTeamFormOpen(true); };
  const handleTeamSave = (e) => {
    e.preventDefault();
    const data = { ...teamForm, observed: !!teamForm.observed };
    if (editingTeam) teamUpdate.mutate({ id: editingTeam.id, data });
    else teamCreate.mutate(data);
  };

  const openPlayerForm = (teamId, player = null) => {
    setPlayerFormOpen(teamId);
    setEditingPlayer(player);
    setPlayerForm(player ? { ...EMPTY_PLAYER, ...player } : { ...EMPTY_PLAYER });
  };
  const handlePlayerSave = (e) => {
    e.preventDefault();
    const data = { ...playerForm, team_id: playerFormOpen, birth_year: playerForm.birth_year ? Number(playerForm.birth_year) : null, rating: playerForm.rating || 0 };
    if (editingPlayer) playerUpdate.mutate({ id: editingPlayer.id, data });
    else playerCreate.mutate(data);
  };

  const set = (setter) => (field, val) => setter(f => ({ ...f, [field]: val }));
  const setT = set(setTeamForm);
  const setP = set(setPlayerForm);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openTeamNew} className="text-white" style={{ background: "var(--granate)" }}>
          <Plus className="w-4 h-4 mr-2" /> Añadir equipo
        </Button>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>No hay equipos observados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map(t => {
            const teamPlayers = players.filter(p => p.team_id === t.id);
            const isExp = expandedId === t.id;
            return (
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-lg shrink-0" style={{ background: "var(--granate)", fontFamily: "var(--font-display)" }}>
                    {t.letter || t.name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{t.name}</p>
                    <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 mt-0.5">
                      {t.category && <span>{t.category}</span>}
                      {t.division && <span>· {t.division}</span>}
                      {t.group && <span>· {t.group}</span>}
                      {t.coach && <span>· {t.coach}</span>}
                      {t.observed && <span className="text-green-600 font-medium">● Observado</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setExpandedId(isExp ? null : t.id)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                      {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openTeamEdit(t)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteTeamId(t.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {isExp && (
                  <div className="px-5 pb-5 border-t border-gray-100 pt-4 bg-gray-50 space-y-4">
                    {t.notes && <p className="text-sm text-gray-600">{t.notes}</p>}
                    {t.standout_players && <p className="text-sm text-gray-600"><span className="font-medium">Destacados: </span>{t.standout_players}</p>}
                    {t.fcf_url && (
                      <a href={t.fcf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: "var(--granate)" }}>
                        <ExternalLink className="w-3 h-3" /> Ver en FCF
                      </a>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Jugadores del equipo ({teamPlayers.length})</p>
                        <Button size="sm" variant="outline" onClick={() => openPlayerForm(t.id)} className="text-xs h-7">
                          <Plus className="w-3 h-3 mr-1" /> Añadir
                        </Button>
                      </div>
                      {teamPlayers.length === 0 ? (
                        <p className="text-xs text-gray-400">No hay jugadores registrados</p>
                      ) : (
                        <div className="space-y-1">
                          {teamPlayers.map(pl => (
                            <div key={pl.id} className="flex items-center gap-3 text-sm bg-white border border-gray-100 rounded-lg px-3 py-2">
                              <span className="font-medium text-gray-900 flex-1">{pl.name}</span>
                              {pl.position && <span className="text-xs text-gray-500">{POS_LABELS[pl.position]}</span>}
                              {pl.birth_year && <span className="text-xs text-gray-400">{pl.birth_year}</span>}
                              {pl.rating > 0 && <span className="flex items-center gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`w-3 h-3 ${i <= pl.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />)}</span>}
                              <button onClick={() => openPlayerForm(t.id, pl)} className="p-1 hover:bg-gray-100 rounded text-gray-400"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setDeletePlayerId(pl.id)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Team form dialog */}
      <Dialog open={teamFormOpen} onOpenChange={open => { setTeamFormOpen(open); if (!open) setEditingTeam(null); }}>
        <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{editingTeam ? "Editar equipo" : "Nuevo equipo observado"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTeamSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label className="text-xs">Nombre *</Label><Input value={teamForm.name} onChange={e => setT("name", e.target.value)} required /></div>
              <div><Label className="text-xs">Letra</Label><Input value={teamForm.letter} onChange={e => setT("letter", e.target.value)} placeholder="A" /></div>
              <div><Label className="text-xs">Entrenador</Label><Input value={teamForm.coach} onChange={e => setT("coach", e.target.value)} /></div>
              <div><Label className="text-xs">Categoría</Label><Input value={teamForm.category} onChange={e => setT("category", e.target.value)} /></div>
              <div><Label className="text-xs">División</Label><Input value={teamForm.division} onChange={e => setT("division", e.target.value)} /></div>
              <div><Label className="text-xs">Grupo</Label><Input value={teamForm.group} onChange={e => setT("group", e.target.value)} /></div>
              <div><Label className="text-xs">Temporada</Label><Input value={teamForm.season} onChange={e => setT("season", e.target.value)} /></div>
              <div className="col-span-2"><Label className="text-xs">Enlace FCF</Label><Input value={teamForm.fcf_url} onChange={e => setT("fcf_url", e.target.value)} placeholder="https://..." /></div>
              <div><Label className="text-xs">Fecha observación</Label><Input type="date" value={teamForm.observation_date} onChange={e => setT("observation_date", e.target.value)} /></div>
              <div className="flex items-center gap-2 mt-5">
                <input type="checkbox" id="obs_check" checked={!!teamForm.observed} onChange={e => setT("observed", e.target.checked)} className="w-4 h-4" />
                <label htmlFor="obs_check" className="text-sm text-gray-700">Observado</label>
              </div>
              <div className="col-span-2"><Label className="text-xs">Jugadores destacados</Label><Input value={teamForm.standout_players} onChange={e => setT("standout_players", e.target.value)} /></div>
              <div className="col-span-2"><Label className="text-xs">Notas</Label><Textarea rows={3} value={teamForm.notes} onChange={e => setT("notes", e.target.value)} /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setTeamFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={teamCreate.isPending || teamUpdate.isPending} className="text-white" style={{ background: "var(--granate)" }}>
                {(teamCreate.isPending || teamUpdate.isPending) ? "Guardando..." : editingTeam ? "Guardar" : "Añadir"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Player form dialog */}
      <Dialog open={!!playerFormOpen} onOpenChange={open => { if (!open) { setPlayerFormOpen(null); setEditingPlayer(null); setPlayerForm(EMPTY_PLAYER); }}}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{editingPlayer ? "Editar jugador" : "Añadir jugador al equipo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePlayerSave} className="space-y-3">
            <div><Label className="text-xs">Nombre *</Label><Input value={playerForm.name} onChange={e => setP("name", e.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Posición</Label>
                <Select value={playerForm.position} onValueChange={v => setP("position", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{POSITIONS.map(p => <SelectItem key={p} value={p}>{POS_LABELS[p]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Lateralidad</Label>
                <Select value={playerForm.laterality} onValueChange={v => setP("laterality", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diestro">Diestro</SelectItem>
                    <SelectItem value="zurdo">Zurdo</SelectItem>
                    <SelectItem value="ambidiestro">Ambidiestro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Año nacimiento</Label><Input type="number" value={playerForm.birth_year} onChange={e => setP("birth_year", e.target.value)} /></div>
              <div>
                <Label className="text-xs">Valoración</Label>
                <div className="mt-1"><StarPicker value={playerForm.rating} onChange={v => setP("rating", v)} /></div>
              </div>
            </div>
            <div><Label className="text-xs">Notas</Label><Textarea rows={2} value={playerForm.notes} onChange={e => setP("notes", e.target.value)} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setPlayerFormOpen(null)}>Cancelar</Button>
              <Button type="submit" disabled={playerCreate.isPending || playerUpdate.isPending} className="text-white" style={{ background: "var(--granate)" }}>
                {(playerCreate.isPending || playerUpdate.isPending) ? "Guardando..." : editingPlayer ? "Guardar" : "Añadir"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTeamId} onOpenChange={open => { if (!open) setDeleteTeamId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar equipo?</AlertDialogTitle><AlertDialogDescription>Se eliminará el equipo y sus jugadores.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => teamDelete.mutate(deleteTeamId)} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletePlayerId} onOpenChange={open => { if (!open) setDeletePlayerId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar jugador?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => playerDelete.mutate(deletePlayerId)} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}