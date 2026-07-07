import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Star, Pencil, Trash2, Search, ChevronDown, ChevronUp, ExternalLink, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ScoutedPlayerForm from "./ScoutedPlayerForm";
import PlayerAttributesPanel from "./PlayerAttributesPanel";
import PlayerVideosTab from "./PlayerVideosTab";
import PlayerImagesTab from "./PlayerImagesTab";
import PlayerSeasonHistoryTab from "./PlayerSeasonHistoryTab";
import PlayerReportsTab from "./PlayerReportsTab";
import PlayerFollowUpsTab from "./PlayerFollowUpsTab";
import { useToast } from "@/components/ui/use-toast";

const POSITIONS = {
  portero: "Portero", central: "Central", lateral: "Lateral", extremo: "Extremo",
  mediapunta: "Mediapunta", libre: "Libre", mediocentro: "Mediocentro",
  interior: "Interior", delantero_centro: "Delantero centro",
};
const DECISIONS = {
  seguir_viendo: { label: "Seguir viendo", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  fichar:        { label: "Fichar",         cls: "bg-green-50 text-green-700 border-green-200" },
  descartar:     { label: "Descartar",      cls: "bg-gray-100 text-gray-500 border-gray-200" },
};
const CONTACT_LABELS = { no_contactado: "Sin contacto", interesado: "Interesado", no_interesado: "No interesado", valorando: "Valorando" };
const CONTACT_COLORS = { no_contactado: "text-gray-400", interesado: "text-green-600", no_interesado: "text-red-500", valorando: "text-yellow-600" };

function StarDisplay({ value }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
      ))}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-gray-400 shrink-0 w-28">{label}</span>
      <span className="text-gray-700 font-medium">{value}</span>
    </div>
  );
}

const TAB_TRIGGER_CLS = "data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-red-800 rounded-none text-xs font-bold uppercase tracking-wide py-3 whitespace-nowrap";
const FONT_DISPLAY = { fontFamily: "var(--font-display)" };

export default function ScoutedPlayersList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterDecision, setFilterDecision] = useState("all");
  const [filterPosition, setFilterPosition] = useState("all");
  const [filterModality, setFilterModality] = useState("all");
  const [sortBy, setSortBy] = useState("created_date");
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const { data: players = [] } = useQuery({
    queryKey: ["scouted_players"],
    queryFn: () => base44.entities.ScoutedPlayer.list("-created_date", 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ScoutedPlayer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouted_players"] });
      setFormOpen(false);
      toast({ title: "Jugador añadido correctamente." });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScoutedPlayer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouted_players"] });
      setFormOpen(false);
      setEditingPlayer(null);
      toast({ title: "Jugador actualizado correctamente." });
    },
    onError: (err) => toast({ title: "Error al guardar", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScoutedPlayer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scouted_players"] });
      setDeleteId(null);
      toast({ title: "Jugador eliminado." });
    },
  });

  const handleSave = (data) => {
    if (editingPlayer) updateMutation.mutate({ id: editingPlayer.id, data });
    else createMutation.mutate(data);
  };

  const openEdit = (p) => { setEditingPlayer(p); setFormOpen(true); };
  const openNew = () => { setEditingPlayer(null); setFormOpen(true); };

  let filtered = players.filter(p => {
    const name = `${p.first_name} ${p.last_name} ${p.current_club || ""}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filterDecision !== "all" && p.decision !== filterDecision) return false;
    if (filterPosition !== "all" && p.position !== filterPosition) return false;
    if (filterModality !== "all" && p.modality !== filterModality) return false;
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
    if (sortBy === "name") return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    if (sortBy === "observation_date") return (b.observation_date || "").localeCompare(a.observation_date || "");
    return 0;
  });

  const counts = {
    total: players.length,
    fichar: players.filter(p => p.decision === "fichar").length,
    seguir_viendo: players.filter(p => p.decision === "seguir_viendo").length,
    descartar: players.filter(p => p.decision === "descartar").length,
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total observados", value: counts.total, cls: "border-gray-200 bg-white" },
          { label: "Para fichar",      value: counts.fichar, cls: "border-green-200 bg-green-50" },
          { label: "Seguir viendo",    value: counts.seguir_viendo, cls: "border-blue-200 bg-blue-50" },
          { label: "Descartados",      value: counts.descartar, cls: "border-gray-200 bg-gray-50" },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`border rounded-xl p-4 text-center shadow-sm ${cls}`}>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o club..." className="pl-9" />
          </div>
          <Button onClick={openNew} className="text-white shrink-0" style={{ background: "var(--granate)" }}>
            <Plus className="w-4 h-4 mr-2" /> Añadir jugador
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <Select value={filterDecision} onValueChange={setFilterDecision}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Decisión" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las decisiones</SelectItem>
              <SelectItem value="fichar">Fichar</SelectItem>
              <SelectItem value="seguir_viendo">Seguir viendo</SelectItem>
              <SelectItem value="descartar">Descartar</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPosition} onValueChange={setFilterPosition}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Posición" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las posiciones</SelectItem>
              {Object.entries(POSITIONS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterModality} onValueChange={setFilterModality}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Modalidad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">F7 y F11</SelectItem>
              <SelectItem value="futbol_7">Fútbol 7</SelectItem>
              <SelectItem value="futbol_11">Fútbol 11</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_date">Más recientes</SelectItem>
              <SelectItem value="rating">Por valoración</SelectItem>
              <SelectItem value="name">Por nombre</SelectItem>
              <SelectItem value="observation_date">Por fecha observación</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <Star className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>No hay jugadores observados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const dec = DECISIONS[p.decision] || DECISIONS.seguir_viendo;
            const isExpanded = expandedId === p.id;
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex items-center gap-4">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0" style={{ background: "var(--granate)" }}>
                      {p.first_name?.[0]}{p.last_name?.[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-gray-900 text-base">{p.first_name} {p.last_name}</p>
                      {p.birth_date && <span className="text-xs text-gray-400">{new Date(p.birth_date).getFullYear()}</span>}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${dec.cls}`}>{dec.label}</span>
                      {p.contact_status && p.contact_status !== "no_contactado" && (
                        <span className={`text-xs font-medium ${CONTACT_COLORS[p.contact_status]}`}>● {CONTACT_LABELS[p.contact_status]}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-1">
                      {p.current_club && <span>🏟 {p.current_club}</span>}
                      {p.position && <span>📍 {POSITIONS[p.position] || p.position}</span>}
                      {p.secondary_position && <span className="text-gray-400">/ {POSITIONS[p.secondary_position]}</span>}
                      {p.category && <span>🏷 {p.category}</span>}
                      {p.laterality && <span>🦶 {p.laterality}</span>}
                      {p.modality && <span className="font-medium">{p.modality === "futbol_7" ? "F7" : "F11"}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {p.rating > 0 && <StarDisplay value={p.rating} />}
                      {p.tags?.length > 0 && p.tags.map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setExpandedId(isExpanded ? null : p.id)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteId(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <Tabs defaultValue="perfil" className="w-full">
                      <div className="overflow-x-auto">
                        <TabsList className="w-max min-w-full rounded-none bg-white border-b border-gray-200 h-auto px-4 justify-start gap-0">
                          {[
                            { value: "perfil",       label: "Perfil" },
                            { value: "atributos",    label: "Atributos" },
                            { value: "videos",       label: "Vídeos" },
                            { value: "imagenes",     label: "Imágenes" },
                            { value: "historial",    label: "Historial" },
                            { value: "informes",     label: "Informes" },
                            { value: "seguimientos", label: "Seguimientos" },
                          ].map(t => (
                            <TabsTrigger key={t.value} value={t.value} className={TAB_TRIGGER_CLS} style={FONT_DISPLAY}>
                              {t.label}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </div>

                      <TabsContent value="perfil" className="p-5 space-y-4 bg-gray-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2" style={FONT_DISPLAY}>Datos personales</p>
                            {p.nationality && <InfoRow label="Nacionalidad" value={p.nationality} />}
                            {p.birth_date && <InfoRow label="Nacimiento" value={new Date(p.birth_date).toLocaleDateString("es")} />}
                            {p.height_cm && <InfoRow label="Altura" value={`${p.height_cm} cm`} />}
                            {p.weight_kg && <InfoRow label="Peso" value={`${p.weight_kg} kg`} />}
                            {p.laterality && <InfoRow label="Lateralidad" value={p.laterality} />}
                          </div>
                          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2" style={FONT_DISPLAY}>Datos futbolísticos</p>
                            {p.current_club && <InfoRow label="Club" value={p.current_club} />}
                            {p.position && <InfoRow label="Posición" value={POSITIONS[p.position] || p.position} />}
                            {p.secondary_position && <InfoRow label="2ª posición" value={POSITIONS[p.secondary_position] || p.secondary_position} />}
                            {p.category && <InfoRow label="Categoría" value={p.category} />}
                            {p.league_group && <InfoRow label="Liga/Grupo" value={p.league_group} />}
                            {p.modality && <InfoRow label="Modalidad" value={p.modality === "futbol_7" ? "Fútbol 7" : "Fútbol 11"} />}
                          </div>
                          {(p.phone || p.parent_name || p.parent_phone) && (
                            <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2 shadow-sm">
                              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2" style={FONT_DISPLAY}>Contacto</p>
                              {p.phone && <InfoRow label="Teléfono jugador" value={p.phone} />}
                              {p.parent_name && <InfoRow label="Padre/Madre" value={p.parent_name} />}
                              {p.parent_phone && <InfoRow label="Teléfono familiar" value={p.parent_phone} />}
                              {p.contact_status && <InfoRow label="Estado" value={CONTACT_LABELS[p.contact_status]} />}
                              {p.contact_notes && <InfoRow label="Notas" value={p.contact_notes} />}
                            </div>
                          )}
                          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2" style={FONT_DISPLAY}>Observaciones</p>
                            {p.key_points && <div><p className="text-xs text-gray-400 mb-0.5">Puntos clave</p><p className="text-sm text-gray-700">{p.key_points}</p></div>}
                            {p.observations && <div><p className="text-xs text-gray-400 mb-0.5">Observaciones</p><p className="text-sm text-gray-700">{p.observations}</p></div>}
                            {p.match_observed && <InfoRow label="Partido observado" value={p.match_observed} />}
                            {p.observation_date && <InfoRow label="Fecha observación" value={new Date(p.observation_date).toLocaleDateString("es")} />}
                            {p.futbolbase_url && (
                              <a href={p.futbolbase_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: "var(--granate)" }}>
                                <ExternalLink className="w-3.5 h-3.5" /> Ver en Futbolbase
                              </a>
                            )}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="atributos" className="p-5 bg-gray-50">
                        <PlayerAttributesPanel player={p} />
                      </TabsContent>

                      <TabsContent value="videos" className="p-5 bg-gray-50">
                        <PlayerVideosTab playerId={p.id} />
                      </TabsContent>

                      <TabsContent value="imagenes" className="p-5 bg-gray-50">
                        <PlayerImagesTab playerId={p.id} />
                      </TabsContent>

                      <TabsContent value="historial" className="p-5 bg-gray-50">
                        <PlayerSeasonHistoryTab playerId={p.id} />
                      </TabsContent>

                      <TabsContent value="informes" className="p-5 bg-gray-50">
                        <PlayerReportsTab playerId={p.id} player={p} />
                      </TabsContent>

                      <TabsContent value="seguimientos" className="p-5 bg-gray-50">
                        <PlayerFollowUpsTab playerId={p.id} />
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ScoutedPlayerForm
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingPlayer(null); }}
        player={editingPlayer}
        onSave={handleSave}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar jugador?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}