import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Mail, Phone, Shield, Upload, Loader, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { useAuth } from "@/lib/AuthContext";
import CoachPDISection from "@/components/coach/CoachPDISection";
import CoachMatchNotesSection from "@/components/coach/CoachMatchNotesSection";
import CoachFeedbackSection from "@/components/coach/CoachFeedbackSection";
import CoachEval360Section from "@/components/coach/CoachEval360Section";
import CoachMethodSection from "@/components/coach/CoachMethodSection";

const SHOW_PDI_TAB = false;
import ImageCropDialog from "@/components/ImageCropDialog";
import TeamRolesEditor from "@/components/access/TeamRolesEditor";
import { TEAM_ROLES } from "@/lib/staffRoles";
import { syncAssignments, syncUserTeamsForStaff, buildLinks, deleteStaffPerson, revokedAccess } from "@/lib/staffLink";
import { useT, msg } from "@/i18n";

const ROLE_LABELS = {
  entrenador: msg("Entrenador"),
  ayudante: msg("Ayudante"),
  preparador_fisico: msg("Preparador Físico"),
  portero_coach: msg("Portero Coach"),
  medico: msg("Médico"),
  fisioterapeuta: msg("Fisioterapeuta"),
  coordinador: msg("Coordinador"),
  otro: msg("Otro"),
  coordinador_general: msg("Coordinador General"),
  director: msg("Director"),
  director_deportivo: msg("Director Deportivo"),
  coordinador_f7: msg("Coordinador F7"),
  coordinador_f11: msg("Coordinador F11"),
  entrenador_porteros: msg("Entrenador de Porteros"),
  psicologo: msg("Técnico · Área psicología"),
};

export default function CoachProfile() {
  const t = useT();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const staffId = urlParams.get("id");
  const userId = urlParams.get("userId"); // Usuario registrado con rol de staff

  const { isCoordinator, isCoordinatorGeneral, coordType, teamIds, perms } = useTeamAccess();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
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
    primer_entrenador: msg("1er Entrenador"),
    segundo_entrenador: msg("2º Entrenador"),
    preparador_fisico: msg("Prep. Físico"),
    entrenador_porteros: msg("Ent. Porteros"),
    coordinador: msg("Coordinador"),
    delegado: msg("Delegado"),
    fisio: msg("Fisio"),
    analista: msg("Analista"),
    asistente: msg("Asistente"),
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

  const isOwnProfile =
    (user?.email && member?.email?.toLowerCase() === user.email.toLowerCase()) ||
    (!!staffId && !!user?.staff_member_id && user.staff_member_id === staffId);

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

  // Eliminar a una persona del cuerpo técnico: solo administración, nunca a uno mismo ni a otros administradores
  // (a un administrador con ficha sí se le puede quitar la ficha: conserva su acceso).
  const liveUsers = users.filter(u => u.access_status !== "deleted");
  const staffLinks = staffId ? buildLinks(liveUsers, staff) : null;
  const linkedUser = staffLinks ? liveUsers.find(u => staffLinks.get(u.id)?.id === staffId) || null : null;
  const targetUser = member?._isUser ? users.find(u => u.id === member._userId) : null;
  const canDelete = user?.role === "admin" && !isOwnProfile && (
    !!staffId && !!member ||
    (!!targetUser && targetUser.role !== "admin")
  );

  // Área de psicología: ve a todos los entrenadores y les da feedback y evaluaciones (sin tocar sus datos personales)
  const reviewsAllCoaches = perms.coaches === 'all' && perms.evalCoaches;
  const canView = isOwnProfile || coordCanSeeTeam() || reviewsAllCoaches;
  const canEdit = isOwnProfile || coordCanSeeTeam();
  // Coordinadores ven PDI y obs. de partidos
  const canViewReports = isCoordinatorGeneral || (isCoordinator && coordCanSeeTeam()) || reviewsAllCoaches;
  // Solo coordinador de la etapa correspondiente (o general/admin, o el área de psicología) puede crear evaluaciones
  const canEvaluate = isCoordinatorGeneral || (isCoordinator && coordCanSeeTeam()) || reviewsAllCoaches;
  // PDI en stand-by (decisión de Nacho): más adelante será consecuencia de la Evaluación 360. Los datos y el código se conservan.
  const showPDITab = SHOW_PDI_TAB && (canViewReports || isOwnProfile);
  const showFeedbackTab = canViewReports || isOwnProfile;

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
      toast({ title: t("Foto actualizada correctamente.") });
    },
    onError: (err) => {
      setPhotoLoading(false);
      toast({ title: t("Error al subir la foto"), description: err.message, variant: "destructive" });
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
      let savedStaffId = null;

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
          savedStaffId = linkedStaff.id;
        } else {
          // Create StaffMember and link it back to User
          const newStaff = await base44.entities.StaffMember.create({
            ...staffPayload,
            role: member.role || "entrenador",
            team_id: member.team_id || null,
          });
          await base44.entities.User.update(member._userId, { staff_member_id: newStaff.id });
          savedStaffId = newStaff.id;
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
        savedStaffId = staffId;
      }

      // Equipos y rol en cada uno (solo coordinación)
      if (isCoordinator && savedStaffId && Array.isArray(data.role_assignments)) {
        const existing = await base44.entities.TeamStaffAssignment.filter({ staff_member_id: savedStaffId, active: true });
        await syncAssignments(savedStaffId, data.role_assignments, existing);
        await syncUserTeamsForStaff(savedStaffId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["team_staff_assignments"] });
      setEditDialogOpen(false);
      toast({ title: t("Perfil actualizado"), description: t("Los cambios se han guardado correctamente.") });
    },
    onError: (err) => {
      toast({ title: t("Error al guardar"), description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (member._isUser) {
        await base44.entities.User.update(member._userId, revokedAccess(targetUser));
        return { accessRevoked: true, assignments: 0 };
      }
      return deleteStaffPerson({ staffId, linkedUser });
    },
    onSuccess: () => {
      ["staff", "users", "team_staff_assignments"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      setDeleteOpen(false);
      toast({ title: t("Eliminado del personal"), description: `${member.first_name} ${member.last_name}`.trim() });
      navigate("/Coaches");
    },
    onError: (err) => {
      toast({ title: t("No se ha podido eliminar"), description: err.message, variant: "destructive" });
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
      role_assignments: memberAssignments.map(a => ({ team_id: a.team_id, team_role: a.team_role || "" })),
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    updateInfoMutation.mutate(editForm);
  };



  if (isLoading) return (
    <div className="flex items-center justify-center p-12">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-[var(--granate)] rounded-full animate-spin" />
    </div>
  );

  if (!member) return (
    <div className="p-12 text-center">
      <p className="text-gray-400">{t("Perfil no encontrado.")}</p>
      <Link to="/Coaches" className="text-sm mt-3 inline-block" style={{ color: "var(--granate)" }}>{t("← Volver a Entrenadores")}</Link>
    </div>
  );

  if (!canView) return (
    <div className="p-12 text-center">
      <p className="text-gray-400">{t("No tienes acceso a este perfil.")}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link to="/Coaches" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("Volver a Entrenadores")}
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
                  {ROLE_LABELS[member.role] ? t(ROLE_LABELS[member.role]) : member.role}
                </p>
              </div>
              {canEdit && (
                <button onClick={handleOpenEditDialog} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title={t("Editar perfil")}>
                  <Edit2 className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            {assignedTeams.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {assignedTeams.map(tm => (
                  <div key={tm.assignment_id} className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Shield className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{tm.name}</span>
                    {tm.team_role && (
                      <span className="text-xs text-gray-400">· {TEAM_ROLE_LABELS[tm.team_role] ? t(TEAM_ROLE_LABELS[tm.team_role]) : tm.team_role}</span>
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
          {canDelete && (
            <button type="button" onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50 rounded-full px-3 py-1.5 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> {member._isUser ? t("Quitar acceso") : t("Eliminar del personal")}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={showFeedbackTab ? "feedback" : "notes"}>
        <TabsList>
          {showFeedbackTab && (
            <TabsTrigger value="feedback"  style={{ fontFamily: "var(--font-display)" }}>
              {t("Feedback")}
            </TabsTrigger>
          )}
          {showFeedbackTab && (
            <TabsTrigger value="eval360"  style={{ fontFamily: "var(--font-display)" }}>
              {t("Evaluación 360")}
            </TabsTrigger>
          )}
          {showPDITab && (
            <TabsTrigger value="pdi"  style={{ fontFamily: "var(--font-display)" }}>
              {t("PDI · Plan Desarrollo Individual")}
            </TabsTrigger>
          )}
          {canViewReports && (
            <TabsTrigger value="matches"  style={{ fontFamily: "var(--font-display)" }}>
              {t("Notas privadas")}
            </TabsTrigger>
          )}
          {member.notes && (
            <TabsTrigger value="notes"  style={{ fontFamily: "var(--font-display)" }}>
              {t("Info")}
            </TabsTrigger>
          )}
        </TabsList>

        {showFeedbackTab && (
          <TabsContent value="feedback" className="mt-4">
            <CoachFeedbackSection
              staffId={member._isUser ? `user_${member._userId}` : staffId}
              teamIds={[...new Set([...(memberAssignments || []).map(a => a.team_id), member.team_id].filter(Boolean))]}
              canWrite={canViewReports}
              isOwnProfile={!!isOwnProfile}
              author={{ id: user?.id, name: user?.full_name }}
            />
          </TabsContent>
        )}

        {showFeedbackTab && (
          <TabsContent value="eval360" className="mt-4 space-y-8">
            <CoachEval360Section
              staffId={member._isUser ? `user_${member._userId}` : staffId}
              teamIds={[...new Set([...(memberAssignments || []).map(a => a.team_id), member.team_id].filter(Boolean))]}
              canEvaluate={canEvaluate}
              isOwnProfile={!!isOwnProfile}
              author={{ id: user?.id, name: user?.full_name }}
            />
            <CoachMethodSection
              staffId={member._isUser ? `user_${member._userId}` : staffId}
              ownerUserId={member._isUser ? member._userId : linkedUser?.id}
              teamIds={[...new Set([...(memberAssignments || []).map(a => a.team_id), member.team_id].filter(Boolean))]}
              canEvaluate={canEvaluate}
              canSeeData={canEvaluate && !!(perms?.isAdmin || perms?.administration)}
              isOwnProfile={!!isOwnProfile}
              author={{ id: user?.id, name: user?.full_name }}
            />
          </TabsContent>
        )}

        {showPDITab && (
        <TabsContent value="pdi" className="mt-4">
          <CoachPDISection staffId={member._isUser ? `user_${member._userId}` : staffId} canEvaluate={canEvaluate} canView={canViewReports} isOwnProfile={isOwnProfile} />
        </TabsContent>
        )}

        {canViewReports && (
        <TabsContent value="matches" className="mt-4">
          <CoachMatchNotesSection staffId={member._isUser ? `user_${member._userId}` : staffId} teamId={member.team_id} isCoordinator={canViewReports} />
        </TabsContent>
        )}

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



      {/* Eliminar del personal */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
              {member._isUser ? t("¿Quitar el acceso a {name}?", { name: `${member.first_name} ${member.last_name}` }) : t("¿Eliminar del personal a {name}?", { name: `${member.first_name} ${member.last_name}` })}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-gray-600 space-y-2">
                {member._isUser ? (
                  <p>{t("Dejará de poder entrar en la aplicación. Podrás recuperarlo desde Accesos → «Eliminados».")}</p>
                ) : (
                  <>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>{t("Desaparece de Entrenadores y de los equipos{teams}.", { teams: assignedTeams.length > 0 ? ` (${assignedTeams.map(tm => tm.name).join(", ")})` : "" })}</li>
                      {linkedUser && (linkedUser.role === "admin"
                        ? <li>{t("Conserva su acceso como administrador.")}</li>
                        : <li>{t("Se le quita el acceso a la aplicación ({email}).", { email: linkedUser.email })}</li>)}
                      <li>{t("Lo que ya se escribió sobre él (feedback, evaluaciones, PDI y notas) no se borra, pero queda sin ficha.")}</li>
                    </ul>
                    <p className="font-bold text-red-600">{t("Esta acción no se puede deshacer.")}</p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); deleteMutation.mutate(); }} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700 text-white">
              {deleteMutation.isPending ? t("Eliminando...") : member._isUser ? t("Quitar acceso") : t("Eliminar definitivamente")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{t("Editar perfil")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">{t("Nombre")}</label>
                <Input
                  value={editForm.first_name || ""}
                  onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                  className="border-gray-200"
                  placeholder={t("Nombre")}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">{t("Apellidos")}</label>
                <Input
                  value={editForm.last_name || ""}
                  onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                  className="border-gray-200"
                  placeholder={t("Apellidos")}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">{t("Fecha de nacimiento")}</label>
              <Input
                type="date"
                value={editForm.birth_date || ""}
                onChange={e => setEditForm({ ...editForm, birth_date: e.target.value })}
                className="border-gray-200"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">{t("Teléfono")}</label>
              <Input
                value={editForm.phone || ""}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                className="border-gray-200"
                placeholder={t("+34 6XX XXX XXX")}
                type="tel"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">{t("Email")}</label>
              <Input
                value={editForm.email || ""}
                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                className="border-gray-200"
                placeholder={t("correo@ejemplo.com")}
                type="email"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">{t("Notas / Biografía")}</label>
              <Textarea
                value={editForm.notes || ""}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                className="border-gray-200"
                placeholder={t("Información adicional, especialidades, formación...")}
                rows={3}
              />
            </div>

            {isCoordinator && (
              <TeamRolesEditor
                value={editForm.role_assignments || []}
                teams={teams}
                roleOptions={TEAM_ROLES}
                label={t("Equipos y rol en cada uno")}
                onChange={(assignments) => setEditForm({ ...editForm, role_assignments: assignments })}
              />
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1">
                {t("Cancelar")}
              </Button>
              <Button variant="club"
                onClick={handleSaveEdit}
                disabled={updateInfoMutation.isPending}
                className="flex-1"
              >
                {updateInfoMutation.isPending ? t("Guardando...") : t("Guardar cambios")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}