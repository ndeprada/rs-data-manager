import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "react-router-dom";
import { ArrowLeft, Mail, Phone, Shield, Upload, Loader, Edit2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { useAuth } from "@/lib/AuthContext";
import CoachPDISection from "@/components/coach/CoachPDISection";
import CoachMatchNotesSection from "@/components/coach/CoachMatchNotesSection";
import ImageCropDialog from "@/components/ImageCropDialog";
import CoachTeamAssignments from "@/components/coach/CoachTeamAssignments";

const ROLE_LABELS = {
  entrenador: "Entrenador",
  ayudante: "Ayudante",
  preparador_fisico: "Preparador Físico",
  portero_coach: "Portero Coach",
  medico: "Médico",
  fisioterapeuta: "Fisioterapeuta",
  coordinador: "Coordinador",
  otro: "Otro",
  coordinador_general: "Coordinador General",
  coordinador_f7: "Coordinador F7",
  coordinador_f11: "Coordinador F11",
  entrenador_porteros: "Entrenador de Porteros",
  psicologo: "Psicólogo",
};

export default function CoachProfile() {
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const staffId = urlParams.get("id");
  const userId = urlParams.get("userId"); // Usuario registrado con rol de staff

  const { isCoordinator, isCoordinatorGeneral, coordType, teamIds } = useTeamAccess();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [photoLoading, setPhotoLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState(null);

  const { data: staff = [], isLoading: isLoadingStaff } = useQuery({
    queryKey: ["staff"],
    queryFn: () => base44.entities.StaffMember.list(),
  });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  // Assignments del miembro actual (se carga después de conocer staffId)
  const { data: memberAssignments = [] } = useQuery({
    queryKey: ["team_staff_assignments", staffId || `user_${userId}`],
    queryFn: async () => {
      if (staffId) {
        return base44.entities.TeamStaffAssignment.filter({ staff_member_id: staffId, active: true });
      }
      // Para usuarios, buscar por staff_member vinculado
      const u = users.find(u => u.id === userId);
      if (!u) return [];
      // Intentar por staff_member_id si está enlazado
      if (u.staff_member_id) {
        return base44.entities.TeamStaffAssignment.filter({ staff_member_id: u.staff_member_id, active: true });
      }
      // Buscar staff por email
      const staffResults = await base44.entities.StaffMember.filter({ email: u.email });
      if (staffResults[0]) {
        return base44.entities.TeamStaffAssignment.filter({ staff_member_id: staffResults[0].id, active: true });
      }
      return [];
    },
    enabled: !!(staffId || userId) && users.length > 0,
  });

  const TEAM_ROLE_LABELS = {
    primer_entrenador: "1er Entrenador",
    segundo_entrenador: "2º Entrenador",
    preparador_fisico: "Prep. Físico",
    entrenador_porteros: "Ent. Porteros",
    coordinador: "Coordinador",
    delegado: "Delegado",
    fisio: "Fisio",
    analista: "Analista",
    asistente: "Asistente",
  };

  // Equipos asignados via TeamStaffAssignment
  const assignedTeams = memberAssignments
    .map(a => {
      const t = teams.find(t => t.id === a.team_id);
      if (!t) return null;
      return { ...t, team_role: a.team_role, assignment_id: a.id };
    })
    .filter(Boolean);

  const isLoading = isLoadingStaff || isLoadingUsers;

  // Construir el objeto `member` según si es StaffMember o User
  const rawMember = staffId
    ? staff.find(s => s.id === staffId)
    : (() => {
        const u = users.find(u => u.id === userId);
        if (!u) return null;
        const teamIdsList = u.team_ids || (u.team_id ? [u.team_id] : []);
        return {
          id: `user_${u.id}`,
          _userId: u.id,
          _isUser: true,
          _originalFullName: u.full_name || "",
          first_name: u.full_name?.split(" ")[0] || u.full_name || "",
          last_name: u.full_name?.split(" ").slice(1).join(" ") || "",
          role: u.app_role,
          team_id: teamIdsList[0] || "",
          team_ids: teamIdsList,
          photo_url: u.photo_url || null,
          phone: u.phone || null,
          email: u.email,
          notes: u.notes || null,
        };
      })();

  const member = rawMember;
  const team = teams.find(t => t.id === member?.team_id);

  const isOwnProfile = user?.email && member?.email?.toLowerCase() === user.email.toLowerCase();

  // Coordinador F7 solo ve entrenadores de equipos F7, etc.
  const F7_CATEGORIES = ["f7", "f7", "benjami", "alevin", "prebenjami", "benjamin"]; // detect by category string
  const isF7Team = (t) => {
    if (!t) return false;
    const cat = (t.category || "").toLowerCase();
    return cat.includes("alevin") || cat.includes("benjamin") || cat.includes("benjami") || cat.includes("prebenjami") || cat.includes("ludica") || cat.includes("f7");
  };
  const isF11Team = (t) => {
    if (!t) return false;
    const cat = (t.category || "").toLowerCase();
    return !isF7Team(t) && (cat.includes("juvenil") || cat.includes("cadet") || cat.includes("infantil") || cat.includes("primera") || cat.includes("segona") || cat.includes("tercera") || cat.includes("preferent") || cat.includes("lliga") || cat.includes("copa") || cat.includes("divisio") || cat.includes("nacional") || cat.includes("federal") || cat.includes("f11"));
  };

  const coordCanSeeTeam = () => {
    if (isCoordinatorGeneral) return true;
    if (coordType === "coordinador_f7") return isF7Team(team);
    if (coordType === "coordinador_f11") return isF11Team(team);
    return false;
  };

  const canView = isOwnProfile || coordCanSeeTeam();
  const canEdit = isOwnProfile || coordCanSeeTeam();
  // Coordinadores ven PDI y obs. de partidos
  const canViewReports = isCoordinatorGeneral || (isCoordinator && coordCanSeeTeam());
  // Solo coordinador de la etapa correspondiente (o general/admin) puede crear evaluaciones
  const canEvaluate = isCoordinatorGeneral || (isCoordinator && coordCanSeeTeam());
  // El entrenador siempre ve su propia pestaña PDI (para ver informes publicados y dejar feedback)
  const showPDITab = canViewReports || isOwnProfile;

  const updatePhotoMutation = useMutation({
    mutationFn: async (file) => {
      setPhotoLoading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (member?._isUser) {
        await base44.entities.User.update(member._userId, { photo_url: file_url });
      } else {
        await base44.entities.StaffMember.update(staffId, { photo_url: file_url });
      }
      return file_url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setPhotoLoading(false);
      toast({ title: "Foto actualizada correctamente." });
    },
    onError: (err) => {
      setPhotoLoading(false);
      toast({ title: "Error al subir la foto", description: err.message, variant: "destructive" });
    },
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImageSrc(reader.result);
        setCropDialogOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropConfirm = async (croppedBlob) => {
    return new Promise((resolve, reject) => {
      updatePhotoMutation.mutate(croppedBlob, { onSuccess: resolve, onError: reject });
    });
  };

  const updateInfoMutation = useMutation({
    mutationFn: async (data) => {
      const firstName = data.first_name?.trim() || "";
      const lastName = data.last_name?.trim() || "";

      if (member?._isUser) {
        // 1. Update User — only mutable fields (full_name and email are platform read-only)
        await base44.entities.User.update(member._userId, {
          phone: data.phone || null,
          notes: data.notes || null,
          birth_date: data.birth_date || null,
        });

        // 2. Find linked StaffMember by EMAIL (staff_member_id may be null)
        const staffResults = await base44.entities.StaffMember.filter({ email: member.email });
        const linkedStaff = staffResults[0] || null;

        const staffPayload = {
          first_name: firstName || member.first_name || "",
          last_name: lastName || member.last_name || "",
          phone: data.phone || null,
          birth_date: data.birth_date || null,
          notes: data.notes || null,
          email: member.email,
        };

        if (linkedStaff) {
          await base44.entities.StaffMember.update(linkedStaff.id, staffPayload);
        } else {
          // Create StaffMember and link it back to User
          const newStaff = await base44.entities.StaffMember.create({
            ...staffPayload,
            role: member.role || "entrenador",
            team_id: member.team_id || null,
          });
          await base44.entities.User.update(member._userId, { staff_member_id: newStaff.id });
        }
      } else {
        // Direct StaffMember update
        await base44.entities.StaffMember.update(staffId, {
          first_name: firstName,
          last_name: lastName,
          phone: data.phone || null,
          birth_date: data.birth_date || null,
          notes: data.notes || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditDialogOpen(false);
      toast({ title: "Perfil actualizado", description: "Los cambios se han guardado correctamente." });
    },
    onError: (err) => {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenEditDialog = () => {
    setEditForm({
      first_name: member.first_name || "",
      last_name: member.last_name || "",
      birth_date: member.birth_date || "",
      phone: member.phone || "",
      email: member.email || "",
      notes: member.notes || "",
      role: member.role || "",
      team_ids: member.team_ids || [],
      role_assignments: member.role_assignments || [],
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    updateInfoMutation.mutate(editForm);
  };



  if (isLoading) return (
    <div className="flex items-center justify-center p-12">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
    </div>
  );

  if (!member) return (
    <div className="p-12 text-center">
      <p className="text-gray-400">Perfil no encontrado.</p>
      <Link to="/Coaches" className="text-sm mt-3 inline-block" style={{ color: "var(--granate)" }}>← Volver a Entrenadores</Link>
    </div>
  );

  if (!canView) return (
    <div className="p-12 text-center">
      <p className="text-gray-400">No tienes acceso a este perfil.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link to="/Coaches" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver a Entrenadores
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
        <div className="h-2 w-full" style={{ background: "var(--granate)" }} />
        <div className="p-6 flex flex-wrap gap-6 items-start">
          <div className="relative group">
            {member.photo_url ? (
              <img src={member.photo_url} alt={`${member.first_name} ${member.last_name}`} className="w-28 h-28 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-28 h-28 rounded-full flex items-center justify-center text-white font-black text-5xl shrink-0"
                style={{ background: "var(--granate)", fontFamily: "var(--font-display)" }}>
                {member.first_name?.[0]}{member.last_name?.[0]}
              </div>
            )}
            {canEdit && (
              <label className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={photoLoading} className="hidden" />
                {photoLoading ? (
                  <Loader className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-white" />
                )}
              </label>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-black uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
                  {member.first_name} {member.last_name}
                </h1>
                <p className="text-sm font-bold uppercase tracking-wide mt-0.5" style={{ color: "var(--naranja)", fontFamily: "var(--font-display)" }}>
                  {ROLE_LABELS[member.role] || member.role}
                </p>
              </div>
              {canEdit && (
                <button onClick={handleOpenEditDialog} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Editar perfil">
                  <Edit2 className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            {assignedTeams.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {assignedTeams.map(t => (
                  <div key={t.assignment_id} className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Shield className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{t.name}</span>
                    {t.team_role && (
                      <span className="text-xs text-gray-400">· {TEAM_ROLE_LABELS[t.team_role] || t.team_role}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : team && (
              <div className="flex items-center gap-1.5 mt-2">
                <Shield className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-sm text-gray-600">{team.name}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-4 mt-3">
              {member.phone && (
                <a href={`tel:${member.phone}`} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
                  <Phone className="w-3.5 h-3.5 text-gray-400" /> {member.phone}
                </a>
              )}
              {member.email && (
                <a href={`mailto:${member.email}`} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
                  <Mail className="w-3.5 h-3.5 text-gray-400" /> {member.email}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={showPDITab ? "pdi" : "notes"}>
        <TabsList className="bg-gray-100 border border-gray-200">
          {showPDITab && (
            <TabsTrigger value="pdi" className="data-[state=active]:bg-white text-xs font-bold uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
              PDI · Plan Desarrollo Individual
            </TabsTrigger>
          )}
          {canViewReports && (
            <TabsTrigger value="matches" className="data-[state=active]:bg-white text-xs font-bold uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
              Obs. Partidos
            </TabsTrigger>
          )}
          {member.notes && (
            <TabsTrigger value="notes" className="data-[state=active]:bg-white text-xs font-bold uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
              Info
            </TabsTrigger>
          )}
        </TabsList>

        {showPDITab && (
        <TabsContent value="pdi" className="mt-4">
          <CoachPDISection staffId={member._isUser ? `user_${member._userId}` : staffId} canEvaluate={canEvaluate} canView={canViewReports} isOwnProfile={isOwnProfile} />
        </TabsContent>
        )}

        <TabsContent value="matches" className="mt-4">
          <CoachMatchNotesSection staffId={member._isUser ? `user_${member._userId}` : staffId} teamId={member.team_id} isCoordinator={canViewReports} />
        </TabsContent>

        {member.notes && (
          <TabsContent value="notes" className="mt-4">
            <div className="bg-white border border-gray-200 p-5 shadow-sm" style={{ borderRadius: "4px" }}>
              <p className="text-sm text-gray-700 leading-relaxed">{member.notes}</p>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Crop Dialog */}
      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageSrc={selectedImageSrc}
        onConfirm={handleCropConfirm}
        isLoading={photoLoading}
      />



      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Editar perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Nombre</label>
                <Input
                  value={editForm.first_name || ""}
                  onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                  className="border-gray-200"
                  placeholder="Nombre"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Apellidos</label>
                <Input
                  value={editForm.last_name || ""}
                  onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                  className="border-gray-200"
                  placeholder="Apellidos"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Fecha de nacimiento</label>
              <Input
                type="date"
                value={editForm.birth_date || ""}
                onChange={e => setEditForm({ ...editForm, birth_date: e.target.value })}
                className="border-gray-200"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Teléfono</label>
              <Input
                value={editForm.phone || ""}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                className="border-gray-200"
                placeholder="+34 6XX XXX XXX"
                type="tel"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Email</label>
              <Input
                value={editForm.email || ""}
                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                className="border-gray-200"
                placeholder="correo@ejemplo.com"
                type="email"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Notas / Biografía</label>
              <Textarea
                value={editForm.notes || ""}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                className="border-gray-200"
                placeholder="Información adicional, especialidades, formación..."
                rows={3}
              />
            </div>

            {isCoordinator && (
              <CoachTeamAssignments
                assignments={editForm.role_assignments || []}
                teams={teams}
                onChange={(assignments) => setEditForm({ ...editForm, role_assignments: assignments })}
              />
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateInfoMutation.isPending}
                className="flex-1 text-white"
                style={{ background: "var(--granate)" }}
              >
                {updateInfoMutation.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}