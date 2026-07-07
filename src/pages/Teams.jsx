import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Plus, List, Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import TeamsTable from "@/components/teams/TeamsTable";
import TeamStaffSection from "@/components/team/TeamStaffSection";
import { FCF_CATEGORIES, FCF_CATEGORY_GROUPS, getCategoryLabel } from "@/components/fcfCategories";

const emptyForm = { name: "", category: "", coach_id: "", season: "", fcf_group_url: "" };

// Orden de categorías por edad (mayor a menor) usando FCF_CATEGORIES
const CATEGORY_AGE_ORDER = FCF_CATEGORIES.map(cat => cat.value);

// Extrae números del nombre para ordenar correctamente (ej: "Cadete S16A" -> [16, 'A'])
const extractNameParts = (name) => {
  const parts = [];
  const regex = /(\d+|[A-Z])/g;
  let match;
  while ((match = regex.exec(name)) !== null) {
    const part = match[1];
    parts.push(isNaN(part) ? part : parseInt(part));
  }
  return parts;
};

const sortTeamsByAge = (teams) => {
  return [...teams].sort((a, b) => {
    const indexA = CATEGORY_AGE_ORDER.indexOf(a.category);
    const indexB = CATEGORY_AGE_ORDER.indexOf(b.category);
    // Si no encuentra la categoría, la pone al final
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    // Si están en la misma categoría, ordena por nombre
    if (indexA === indexB) {
      const partsA = extractNameParts(a.name);
      const partsB = extractNameParts(b.name);
      // Compara parte a parte (números se comparan numéricamente)
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const partA = partsA[i] ?? '';
        const partB = partsB[i] ?? '';
        if (typeof partA === 'number' && typeof partB === 'number') {
          if (partA !== partB) return partA - partB;
        } else {
          const cmp = String(partA).localeCompare(String(partB), 'es');
          if (cmp !== 0) return cmp;
        }
      }
      return 0;
    }
    return indexA - indexB;
  });
};

const AGE_GROUPS = {
  "SENIOR": ["primera_federacio", "segona_federacio", "tercera_federacio", "lliga_elit"],
  "JUVENIL": ["lliga_nacional_juvenil", "preferent_juvenils", "juvenil_primera_divisio", "juvenil_segona_divisio", "copa_catalunya_masculina_24_25", "copa_catalunya_masculina"],
  "CADETE S16": ["divisio_honor_cadet_s16", "preferent_cadet_s16", "cadet_primera_divisio_s16", "cadet_segona_divisio_s16"],
  "CADETE S15": ["divisio_honor_cadet_s15", "preferent_cadet_s15", "cadet_primera_divisio_s15", "cadet_segona_divisio_s15"],
  "INFANTIL S14": ["divisio_honor_infantil_s14", "preferent_infantil_s14", "infantil_primera_divisio_s14", "infantil_segona_divisio_s14"],
  "INFANTIL S13": ["divisio_honor_infantil_s13", "preferent_infantil_s13", "infantil_primera_divisio_s13", "infantil_segona_divisio_s13"],
  "ALEVÍN S12": ["preferent_alevin_s12", "primera_divisio_alevin_s12", "segona_divisio_alevin_s12", "tercera_divisio_alevin_s12"],
  "ALEVÍN S11": ["preferent_alevin_s11", "primera_divisio_alevin_s11", "fase_ascens_terres_ebre_primera_divisio_alevin_s11", "segona_divisio_alevin_s11", "tercera_divisio_alevin_s11"],
  "BENJAMÍN S10": ["preferent_benjamin_s10", "primera_divisio_benjamin_s10", "segona_divisio_benjamin_s10", "tercera_divisio_benjamin_s10"],
  "BENJAMÍN S9": ["preferent_benjamin_s9", "primera_divisio_benjamin_s9", "segona_divisio_benjamin_s9", "tercera_divisio_benjamin_s9"],
  "PRE-BENJAMÍN": ["torneig_prebenjami_s8", "prebenjami_s8", "prebenjami_s7", "copa_girona_prebenjami_s7", "torneig_prebenjami_s7", "torneig_penyes_fc_barcelona", "ludica_infantil_futbol_7", "ludica_alevin"],
};

const groupTeamsByAge = (teams) => {
  const grouped = {};
  Object.keys(AGE_GROUPS).forEach(group => {
    grouped[group] = teams.filter(t => AGE_GROUPS[group].includes(t.category));
  });
  return grouped;
};

export default function Teams() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [viewMode, setViewMode] = useState("list");

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list(),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: () => base44.entities.StaffMember.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: allAssignments = [] } = useQuery({
    queryKey: ["team_staff_assignments"],
    queryFn: () => base44.entities.TeamStaffAssignment.filter({ active: true }),
  });

  // Entrenadores: StaffMembers + usuarios registrados con rol entrenador aprobados
  const staffEmails = new Set(staff.map(s => s.email).filter(Boolean));
  const coachUsers = users.filter(u =>
    ["entrenador"].includes(u.app_role) &&
    u.access_status === "approved" &&
    !staffEmails.has(u.email)
  ).map(u => ({
    id: `user_${u.id}`,
    first_name: u.full_name?.split(" ")[0] || u.full_name || "",
    last_name: u.full_name?.split(" ").slice(1).join(" ") || "",
    role: "entrenador",
    _isUser: true,
  }));
  const allCoaches = [
    ...staff.filter(s => s.role === "entrenador"),
    ...coachUsers,
  ];

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Team.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["teams"] }); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Team.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["teams"] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Team.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["teams"] }); setDeleteId(null); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditingTeam(null); setForm(emptyForm); };

  const openEdit = (team) => {
    setEditingTeam(team);
    const coachStaff = staff.find(s => s.id === team.coach_id);
    setForm({ 
      name: team.name, 
      category: team.category, 
      coach_id: team.coach_id || "", 
      season: team.season || "", 
      fcf_group_url: team.fcf_group_url || "" 
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTeam) {
      updateMutation.mutate({ id: editingTeam.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
         <div>
           <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Administración</p>
           <h1>Equipos</h1>
           <p className="text-gray-400 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>Gestión de equipos del club</p>
         </div>
         <div className="flex items-center gap-2">
           <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
             <button
               onClick={() => setViewMode("list")}
               className={`p-2 rounded transition-colors ${viewMode === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
               title="Vista lista"
             >
               <List className="w-4 h-4" />
             </button>
             <button
               onClick={() => setViewMode("cards")}
               className={`p-2 rounded transition-colors ${viewMode === "cards" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
               title="Vista tarjetas"
             >
               <Grid3x3 className="w-4 h-4" />
             </button>
           </div>
           <Button
             onClick={() => { setForm(emptyForm); setDialogOpen(true); }}
             className="text-white shadow-sm"
             style={{ background: "var(--granate)" }}
           >
             <Plus className="w-4 h-4 mr-2" /> Nuevo Equipo
           </Button>
         </div>
       </div>

      {isLoading ? (
        <div className="bg-white border border-gray-200 p-8 text-center animate-pulse" style={{ borderRadius: "4px" }}>
          <p className="text-gray-400">Cargando...</p>
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center shadow-sm" style={{ borderRadius: "4px" }}>
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No hay equipos registrados</p>
          <p className="text-gray-400 text-sm mt-1">Crea tu primer equipo para empezar</p>
        </div>
      ) : viewMode === "list" ? (
        <TeamsTable
          teams={sortTeamsByAge(teams)}
          players={players}
          events={events}
          staff={staff}
          assignments={allAssignments}
          onEdit={openEdit}
          onDelete={setDeleteId}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(groupTeamsByAge(teams)).map(([groupName, groupTeams]) => (
            groupTeams.length > 0 && (
              <div key={groupName}>
                <h2 className="font-bold text-sm uppercase mb-3 px-1" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
                  {groupName}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupTeams.map(team => {
                    const teamPlayers = players.filter(p => p.team_id === team.id);
                    const teamMatches = events.filter(e => e.team_id === team.id && e.score_home !== undefined && e.score_away !== undefined);
                    const wins = teamMatches.filter(m => (m.is_home !== false && m.score_home > m.score_away) || (m.is_home === false && m.score_away > m.score_home)).length;
                    const draws = teamMatches.filter(m => m.score_home === m.score_away).length;
                    const losses = teamMatches.length - wins - draws;
                    return (
                      <div key={team.id}
                        className="bg-white border border-gray-200 p-4 hover:shadow-md transition-all group rounded-sm cursor-pointer"
                        onClick={() => queryClient.setQueryData(['teamDetail'], team)}
                        style={{ borderTop: "3px solid var(--granate)" }}>
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-8 h-8 flex items-center justify-center" style={{ background: "var(--granate-pale)", borderRadius: "4px" }}>
                            <Shield className="w-4 h-4" style={{ color: "var(--granate)" }} />
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-gray-900 uppercase text-sm" style={{ fontFamily: "var(--font-display)" }}>{team.name}</p>
                            <p className="text-xs text-gray-400 capitalize">{team.category}</p>
                          </div>
                        </div>
                        <div className="space-y-2 pt-2 border-t border-gray-100">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500">Jugadores:</span>
                            <span className="font-bold text-gray-900">{teamPlayers.length}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500">Récord:</span>
                            <span className="font-bold" style={{ color: "var(--granate)" }}>{wins}–{draws}–{losses}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900">{editingTeam ? "Editar Equipo" : "Nuevo Equipo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700">Nombre del equipo *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="border-gray-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Categoria FCF *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar categoria" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {Object.entries(FCF_CATEGORY_GROUPS).map(([group, cats]) => (
                    <React.Fragment key={group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">{group}</div>
                      {cats.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Temporada</Label>
              <Input value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} placeholder="2025-2026" className="border-gray-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">Enlace grup FCF (resultats / classificació)</Label>
              <Input value={form.fcf_group_url} onChange={(e) => setForm({ ...form, fcf_group_url: e.target.value })} placeholder="https://www.fcf.cat/competicio/..." className="border-gray-200" />
              <p className="text-xs text-gray-400">Pega aquí el enlace al grupo de tu equipo en fcf.cat</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" className="text-white" style={{ background: "var(--granate)" }}>
                {editingTeam ? "Guardar datos" : "Crear"}
              </Button>
            </div>
          </form>

          {/* Cuerpo técnico — solo visible al editar un equipo existente */}
          {editingTeam && (
            <div className="border-t border-gray-100 pt-4 mt-2">
              <TeamStaffSection teamId={editingTeam.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar equipo?</AlertDialogTitle>
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