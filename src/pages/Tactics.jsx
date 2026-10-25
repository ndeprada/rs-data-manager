import React, { useState, useEffect, useMemo, useRef } from "react";
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
import BoardEditor from "@/components/board/BoardEditor";
import { sortRoster } from "@/components/sessions/sessionHelpers";
import { FORMATIONS, FORMATION_KEYS, FORMATION_KEYS_F7 } from "@/components/tactics/formations";
import { playerFullName } from "@/lib/playerName";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { tacticsBoardFormat, boardOfTactic, fieldsFor, tokenLabel } from "@/lib/tacticsBoard";
import { useTeamAccess } from "@/lib/TeamAccessContext";

import { PageTitle } from "@/components/common/PageHeader";
import { useT, useLocaleTag } from "@/i18n";
// Sistemas que se ofrecen para un equipo: los de fútbol 7 si es de S12 hacia abajo y los de fútbol 11 en los demás
const keysFor = (team) => (teamPlaysF7(team) ? FORMATION_KEYS_F7 : FORMATION_KEYS);
const BOARD_SAVE_MS = 600; // la pizarra de jugadas se guarda cuando se deja de tocar, no en cada movimiento del dedo

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
      selectBoard(created.id);
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

  // Al elegir equipo en «Nueva pizarra», la formación pasa a una del formato de ese equipo (la base de fútbol 7, o la de siempre en fútbol 11)
  const newFormationFor = (teamId, current) => {
    const keys = keysFor(teams.find((x) => x.id === teamId));
    return keys.includes(current) ? current : keys[0];
  };

  const activeBoard = boards.find((b) => b.id === activeBoardId);
  const activeTeam = activeBoard ? teams.find((x) => x.id === activeBoard.team_id) : null;
  const formation = activeBoard ? FORMATIONS[activeBoard.formation] : null;
  const boardPlayers = activeBoard
    ? players.filter((p) => p.team_id === activeBoard.team_id)
    : [];
  // Fútbol 7 o fútbol 11: el de la formación que ya tiene guardada la pizarra y, si no, el de la etapa del equipo
  const isF7 = activeBoard ? tacticsBoardFormat(activeBoard, activeTeam) === "f7" : false;
  const teamKeys = keysFor(activeTeam);
  // La formación que ya tiene la pizarra sigue en la lista aunque sea del otro formato (p. ej. una pizarra de once de un equipo de S12)
  const formationKeys = activeBoard && FORMATIONS[activeBoard.formation] && !teamKeys.includes(activeBoard.formation) ? [...teamKeys, activeBoard.formation] : teamKeys;
  const mixedFormat = !!activeBoard && teamPlaysF7(activeTeam) && !isF7;
  const totalSlots = formation?.positions.length || (isF7 ? 7 : 11);

  // ── Pizarra de jugadas (pizarra común de src/components/board) ─────────────────────────────────────────────────────────────
  // Mientras se dibuja se trabaja con una copia local (`draft`) y se guarda 600 ms después del último cambio, o al cambiar de pizarra.
  const [draft, setDraft] = useState(null); // { id, value }
  const pending = useRef(null); // lo que falta por guardar: { id, value }
  const timer = useRef(null);
  const mutateRef = useRef(null);
  mutateRef.current = updateMutation.mutate;
  const flush = () => {
    clearTimeout(timer.current);
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    // La lista ya refleja lo último, así que volver a la pizarra enseguida no enseña una versión vieja mientras llega la respuesta
    queryClient.setQueryData(["tacticsBoards"], (old) => (Array.isArray(old) ? old.map((b) => (b.id === p.id ? { ...b, board: p.value } : b)) : old));
    mutateRef.current({ id: p.id, data: { board: p.value } });
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);
  const selectBoard = (id) => { flush(); setDraft(null); setActiveBoardId(id); };
  const handleBoardChange = (value) => {
    if (!activeBoard) return;
    setDraft({ id: activeBoard.id, value });
    pending.current = { id: activeBoard.id, value };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), BOARD_SAVE_MS);
  };
  // Lo que enseña el editor: la copia local mientras se dibuja; si no, la guardada, y en su defecto la pizarra libre antigua ya convertida
  const savedBoard = activeBoard?.board;
  const legacyKey = activeBoard ? `${activeBoard.id}|${activeBoard.free_positions?.length || 0}|${players.length}|${isF7}` : "";
  const startBoard = useMemo(
    () => (activeBoard ? boardOfTactic(savedBoard ? { board: savedBoard } : activeBoard, { players: boardPlayers, f7: isF7 }) : null),
    [legacyKey, savedBoard],
  );
  const boardValue = draft && activeBoard && draft.id === activeBoard.id ? draft.value : startBoard;
  const roster = sortRoster(boardPlayers.filter((p) => p.status !== "baja")).map((p) => ({ id: p.id, label: tokenLabel(p) }));

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
    // Al cambiar de pizarra la lista de sistemas cambia y el desplegable avisa con un valor vacío: no es una elección de nadie
    if (!activeBoard || !newFormation) return;
    updateMutation.mutate({ id: activeBoard.id, data: { formation: newFormation, assignments: {} } });
  };

  const handleNotesChange = (notes) => {
    if (!activeBoard) return;
    updateMutation.mutate({ id: activeBoard.id, data: { notes } });
  };

  const handleLinkEvent = (eventId) => {
    if (!activeBoard) return;
    updateMutation.mutate({ id: activeBoard.id, data: { event_id: eventId || null } });
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
                      onClick={() => selectBoard(board.id)}
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
                    <SelectTrigger className={`h-8 text-sm border-gray-200 ${teamKeys === FORMATION_KEYS_F7 ? "w-56" : "w-32"}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {formationKeys.map((f) => (
                        <SelectItem key={f} value={f}>{t(FORMATIONS[f].label)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-gray-400 ml-auto">{t("{assignedCount}/{total} asignados", { assignedCount, total: totalSlots })}</span>
                </div>
                {mixedFormat && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2" style={{ borderRadius: "4px" }} data-testid="tactics-f11-note">
                    {t("Esta pizarra tiene un sistema de once. Si eliges uno de fútbol 7 pasa a siete y se vacían los jugadores asignados.")}
                  </p>
                )}
                <div className="max-w-sm mx-auto lg:max-w-md">
                  <FootballField f7={isF7}>
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

                {/* Pizarra común del club (fichas, flechas, zonas, textos y fotogramas para animar), con el campo del formato de la pizarra */}
                <div data-testid="tactics-board">
                  <BoardEditor
                    key={activeBoard.id}
                    value={boardValue}
                    onChange={handleBoardChange}
                    roster={roster}
                    fields={fieldsFor(isF7, boardValue?.field)}
                    filename={activeBoard.name || t("Pizarra Táctica")}
                    modes
                  />
                </div>
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
              <Select value={newForm.team_id} onValueChange={(v) => v && setNewForm({ ...newForm, team_id: v, formation: newFormationFor(v, newForm.formation) })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder={t("Seleccionar equipo")} /></SelectTrigger>
                <SelectContent>
                  {teams.filter((t) => canManageTeam(t.id)).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("Formación *")}</Label>
              <Select value={newForm.formation} onValueChange={(v) => v && setNewForm((f) => ({ ...f, formation: v }))}>
                <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {keysFor(teams.find((x) => x.id === newForm.team_id)).map((f) => (
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
            <AlertDialogAction onClick={() => { if (pending.current?.id === deleteId) { clearTimeout(timer.current); pending.current = null; } deleteMutation.mutate(deleteId); }} className="bg-red-600 hover:bg-red-700 text-white">
              {t("Eliminar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}