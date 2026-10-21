import React, { useState, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, StickyNote, Move, LayoutGrid, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import FootballField from "@/components/tactics/FootballField";
import PlayerToken from "@/components/tactics/PlayerToken";
import FreeDragField from "@/components/tactics/FreeDragField";
import { FORMATIONS, FORMATION_KEYS } from "@/components/tactics/formations";
import { playerFullName } from "@/lib/playerName";
import { useTeamAccess } from "@/lib/TeamAccessContext";

import { PageTitle } from "@/components/common/PageHeader";
import { useT, useLocaleTag } from "@/i18n";
export default function Tactics() {
  const t = useT();
  const tag = useLocaleTag();
  const queryClient = useQueryClient();
  // Las pizarras las crean y cambian los entrenadores del equipo, la Dirección Deportiva y la administración; el resto las consulta
  const { canManageTeam, perms } = useTeamAccess();
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [newBoardDialog, setNewBoardDialog] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", formation: "4-4-2", team_id: "" });

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: boards = [] } = useQuery({
    queryKey: ["tacticsBoards"],
    queryFn: () => base44.entities.TacticsBoard.list("-created_date", 50),
  });
  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.filter({ type: "entrenamiento" }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TacticsBoard.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["tacticsBoards"] });
      setActiveBoardId(created.id);
      setNewBoardDialog(false);
      setNewForm({ name: "", formation: "4-4-2", team_id: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TacticsBoard.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tacticsBoards"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TacticsBoard.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tacticsBoards"] });
      if (activeBoardId === deleteId) setActiveBoardId(null);
      setDeleteId(null);
    },
  });

  const activeBoard = boards.find((b) => b.id === activeBoardId);
  const formation = activeBoard ? FORMATIONS[activeBoard.formation] : null;
  const boardPlayers = activeBoard
    ? players.filter((p) => p.team_id === activeBoard.team_id)
    : [];

  const filteredBoards = selectedTeam === "all"
    ? boards
    : boards.filter((b) => b.team_id === selectedTeam);

  // Auto-select last board if none is selected
  useEffect(() => {
    if (!activeBoardId && filteredBoards.length > 0) {
      setActiveBoardId(filteredBoards[0].id);
    }
  }, [filteredBoards, activeBoardId]);

  const handleAssign = (posKey, playerId) => {
    if (!activeBoard) return;
    const assignments = { ...(activeBoard.assignments || {}) };
    if (playerId === null) {
      delete assignments[posKey];
    } else {
      assignments[posKey] = { player_id: playerId };
    }
    updateMutation.mutate({ id: activeBoard.id, data: { assignments } });
  };

  const handleFormationChange = (newFormation) => {
    if (!activeBoard) return;
    updateMutation.mutate({ id: activeBoard.id, data: { formation: newFormation, assignments: {} } });
  };

  const handleNotesChange = (notes) => {
    if (!activeBoard) return;
    updateMutation.mutate({ id: activeBoard.id, data: { notes } });
  };

  const handleFreePositionsChange = useCallback((newPositions) => {
    if (!activeBoard) return;
    updateMutation.mutate({ id: activeBoard.id, data: { free_positions: newPositions } });
  }, [activeBoard, updateMutation]);

  const handleLinkEvent = (eventId) => {
    if (!activeBoard) return;
    updateMutation.mutate({ id: activeBoard.id, data: { event_id: eventId || null } });
  };

  const addPlayerToField = (playerId) => {
    if (!activeBoard) return;
    const positions = activeBoard.free_positions || [];
    if (positions.find((p) => p.player_id === playerId)) return;
    const newPositions = [...positions, { player_id: playerId, x: 50, y: 50 }];
    updateMutation.mutate({ id: activeBoard.id, data: { free_positions: newPositions } });
  };

  const removePlayerFromField = (playerId) => {
    if (!activeBoard) return;
    const newPositions = (activeBoard.free_positions || []).filter((p) => p.player_id !== playerId);
    updateMutation.mutate({ id: activeBoard.id, data: { free_positions: newPositions } });
  };

  const assignedCount = activeBoard
    ? Object.keys(activeBoard.assignments || {}).length
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageTitle kicker={t("Herramientas")} title={t("Pizarra Táctica")} subtitle={t("Disposición táctica de los equipos")} />
        <div className="flex gap-3 items-center">
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-44 border-gray-200 bg-white"><SelectValue placeholder={t("Equipo")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todos")}</SelectItem>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {perms.manage !== "none" && (
            <Button variant="club" onClick={() => setNewBoardDialog(true)} className="shadow-md hover:shadow-lg transition-shadow" size="lg">
              <Plus className="w-5 h-5 mr-2" /> {t("Nueva pizarra")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar: list of boards */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
                {t("Pizarras guardadas")}
              </p>
            </div>
            {filteredBoards.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">{t("No hay pizarras")}</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredBoards.map((board) => {
                  const team = teams.find((t) => t.id === board.team_id);
                  const isActive = board.id === activeBoardId;
                  return (
                    <div
                      key={board.id}
                      className={`flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors ${isActive ? "bg-gray-50 border-l-4" : "hover:bg-gray-50"}`}
                      style={isActive ? { borderLeftColor: "var(--granate)" } : {}}
                      onClick={() => setActiveBoardId(board.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{board.name || board.formation}</p>
                        <p className="text-xs text-gray-400 truncate">{team?.name || "—"} · {board.formation}</p>
                      </div>
                      {canManageTeam(board.team_id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteId(board.id); }}
                          className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main: Tactics board */}
        {activeBoard ? (
          <div className="flex-1 space-y-4">
            {!canManageTeam(activeBoard.team_id) && (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-3 py-2" style={{ borderRadius: "4px" }}>
                {t("Solo lectura: las pizarras de este equipo las cambian sus entrenadores y la Dirección Deportiva.")}
              </p>
            )}
            <div className="space-y-4" {...(!canManageTeam(activeBoard.team_id) ? { inert: "", style: { opacity: 0.92 } } : {})}>
            {/* Toolbar */}
            <div className="bg-white border border-gray-200 shadow-sm flex flex-wrap items-center gap-4 px-5 py-3" style={{ borderRadius: "4px" }}>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-500 font-medium uppercase tracking-wider whitespace-nowrap">{t("Nombre")}</Label>
                <Input
                  className="h-8 w-40 text-sm border-gray-200"
                  value={activeBoard.name || ""}
                  onChange={(e) => updateMutation.mutate({ id: activeBoard.id, data: { name: e.target.value } })}
                  placeholder={t("Jornada / Partido")}
                />
              </div>
              <div className="ml-auto flex items-center gap-3">
                <button
                  onClick={() => setNotesOpen((o) => !o)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${notesOpen ? "bg-yellow-50 border-yellow-300 text-yellow-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                >
                  <StickyNote className="w-3.5 h-3.5" /> {t("Notas")}
                </button>
              </div>
            </div>

            {/* Notes */}
            {notesOpen && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <Label className="text-xs text-yellow-700 font-semibold mb-2 block">{t("Notas tácticas del entrenador")}</Label>
                <Textarea
                  className="bg-white border-yellow-200 text-sm"
                  rows={3}
                  value={activeBoard.notes || ""}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder={t("Instrucciones tácticas, estrategia, observaciones...")}
                />
              </div>
            )}

            <Tabs defaultValue="formation">
              <TabsList>
                <TabsTrigger value="formation" className="gap-1.5"><LayoutGrid className="w-3.5 h-3.5" /> {t("Formación")}</TabsTrigger>
                <TabsTrigger value="jugada" className="gap-1.5"><Move className="w-3.5 h-3.5" /> {t("Análisis de Jugadas")}</TabsTrigger>
              </TabsList>

              {/* ---- TAB: FORMATION ---- */}
              <TabsContent value="formation" className="space-y-4 mt-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-gray-500 font-medium uppercase tracking-wider whitespace-nowrap">{t("Formación")}</Label>
                  <Select value={activeBoard.formation} onValueChange={handleFormationChange}>
                    <SelectTrigger className="h-8 w-32 text-sm border-gray-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMATION_KEYS.map((f) => (
                        <SelectItem key={f} value={f}>{t(FORMATIONS[f].label)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-gray-400 ml-auto">{t("{assignedCount}/11 asignados", { assignedCount })}</span>
                </div>
                <div className="max-w-sm mx-auto lg:max-w-md">
                  <FootballField>
                    {formation?.positions.map((pos) => (
                      <PlayerToken
                        key={pos.key}
                        position={pos}
                        assignment={activeBoard.assignments?.[pos.key]}
                        players={boardPlayers}
                        onAssign={handleAssign}
                      />
                    ))}
                  </FootballField>
                </div>
                <div className="bg-white border border-gray-200 shadow-sm" style={{ borderRadius: "4px" }}>
                  <div className="px-5 py-3 border-b border-gray-100">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{t("Plantilla ({n})", { n: boardPlayers.filter((p) => p.status !== "baja").length })}</p>
                  </div>
                  <div className="px-5 py-4 flex flex-wrap gap-2">
                    {boardPlayers.filter((p) => p.status !== "baja").sort((a, b) => `${playerFullName(a)}`.localeCompare(`${playerFullName(b)}`)).map((p) => {
                      const isAssigned = Object.values(activeBoard.assignments || {}).some((a) => a.player_id === p.id);
                      return (
                        <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${isAssigned ? "bg-gray-100 border-gray-200 text-gray-400 line-through" : p.status === "lesionado" ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-white border-gray-200 text-gray-700"}`}>
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ background: isAssigned ? "#9ca3af" : "var(--granate)" }}>{p.first_name?.[0]}{p.last_name?.[0]}</span>
                          {playerFullName(p)}
                          {p.jersey_number && <span className="text-gray-400">#{p.jersey_number}</span>}
                          {p.status === "lesionado" && <span title={t("Lesionado")}>⚠️</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              {/* ---- TAB: JUGADA LIBRE ---- */}
              <TabsContent value="jugada" className="space-y-4 mt-4">
                {/* Link to event */}
                <div className="bg-white border border-gray-200 rounded p-3 flex flex-wrap items-center gap-3">
                  <LinkIcon className="w-4 h-4 text-gray-400 shrink-0" />
                  <Label className="text-xs text-gray-500 font-medium uppercase tracking-wider whitespace-nowrap">{t("Vincular entrenamiento")}</Label>
                  <Select value={activeBoard.event_id || "none"} onValueChange={(v) => handleLinkEvent(v === "none" ? null : v)}>
                    <SelectTrigger className="h-8 w-56 text-sm border-gray-200"><SelectValue placeholder={t("Sin vincular")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("Sin vincular")}</SelectItem>
                      {events.filter((e) => e.team_id === activeBoard.team_id).map((ev) => (
                        <SelectItem key={ev.id} value={ev.id}>{ev.title} — {new Date(ev.date).toLocaleDateString(tag)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {activeBoard.event_id && (
                    <span className="text-xs text-green-600 font-medium">{t("✓ Vinculado")}</span>
                  )}
                </div>

                <div className="flex gap-4">
                  {/* Field */}
                  <div className="flex-1 max-w-sm">
                    <FreeDragField
                      players={boardPlayers}
                      positions={activeBoard.free_positions || []}
                      onChange={handleFreePositionsChange}
                    />
                  </div>

                  {/* Player pool sidebar */}
                  <div className="w-48 shrink-0 bg-white border border-gray-200 rounded overflow-hidden self-start">
                    <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("Jugadores")}</p>
                    </div>
                    <div className="p-2 space-y-1 max-h-96 overflow-y-auto">
                      {boardPlayers.filter((p) => p.status !== "baja").map((p) => {
                        const onField = (activeBoard.free_positions || []).some((fp) => fp.player_id === p.id);
                        return (
                          <div key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${onField ? "bg-gray-100 text-gray-400" : "hover:bg-gray-50 text-gray-700 cursor-pointer"}`}
                            onClick={() => onField ? removePlayerFromField(p.id) : addPlayerToField(p.id)}
                          >
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ background: onField ? "#9ca3af" : "var(--granate)" }}>
                              {p.first_name?.[0]}{p.last_name?.[0]}
                            </span>
                            <span className="truncate">{playerFullName(p)}</span>
                            {onField && <span className="ml-auto text-red-400 text-[10px]">✕</span>}
                          </div>
                        );
                      })}
                      {boardPlayers.length === 0 && <p className="text-xs text-gray-400 p-2">{t("Sin jugadores")}</p>}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center">{t("Haz clic en un jugador para añadirlo al campo. Arrástralo para posicionarlo.")}</p>
              </TabsContent>
            </Tabs>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center min-h-64">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚽</span>
              </div>
              <p className="font-semibold text-gray-500">{t("Selecciona o crea una pizarra")}</p>
              <p className="text-sm text-gray-400 mt-1">{t("Elige una pizarra de la lista o crea una nueva")}</p>
              {perms.manage !== "none" && (
                <Button variant="club" onClick={() => setNewBoardDialog(true)} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" /> {t("Nueva pizarra")}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New board dialog */}
      <Dialog open={newBoardDialog} onOpenChange={(o) => { if (!o) setNewBoardDialog(false); }}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle>{t("Nueva Pizarra Táctica")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({ ...newForm, assignments: {} });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>{t("Nombre (opcional)")}</Label>
              <Input
                placeholder={t("Ej: Jornada 10 vs Rival")}
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                className="border-gray-200"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Equipo *")}</Label>
              <Select value={newForm.team_id} onValueChange={(v) => setNewForm({ ...newForm, team_id: v })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder={t("Seleccionar equipo")} /></SelectTrigger>
                <SelectContent>
                  {teams.filter((t) => canManageTeam(t.id)).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("Formación *")}</Label>
              <Select value={newForm.formation} onValueChange={(v) => setNewForm({ ...newForm, formation: v })}>
                <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATION_KEYS.map((f) => (
                    <SelectItem key={f} value={f}>{t(FORMATIONS[f].label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setNewBoardDialog(false)}>{t("Cancelar")}</Button>
              <Button variant="club" type="submit" disabled={!newForm.team_id}>
                {t("Crear pizarra")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("¿Eliminar pizarra?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Esta acción no se puede deshacer.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">
              {t("Eliminar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}