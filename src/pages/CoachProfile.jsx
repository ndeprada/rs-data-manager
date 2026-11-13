import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Mail, Phone, Upload, Loader, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { useAuth } from "@/lib/AuthContext";
import CoachPDISection from "@/components/coach/CoachPDISection";
import CoachMatchNotesSection from "@/components/coach/CoachMatchNotesSection";
import CoachFeedbackSection from "@/components/coach/CoachFeedbackSection";
import CoachEval360Areas from "@/components/coach/CoachEval360Areas";
import CoachSummaryTab from "@/components/coach/CoachSummaryTab";
import CoachAbsencesFines from "@/components/coach/CoachAbsencesFines";
import { Page, RS } from "@/components/rs2/kit";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { compareTeams } from "@/lib/teamOrder";

const SHOW_PDI_TAB = false;
import ImageCropDialog from "@/components/ImageCropDialog";
import TeamRolesEditor from "@/components/access/TeamRolesEditor";
import { TEAM_ROLES } from "@/lib/staffRoles";
import { syncAssignments, syncUserTeamsForStaff, buildLinks, deleteStaffPerson, revokedAccess } from "@/lib/staffLink";
import { stageSeesCoach } from "@/lib/coachStage";
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

  const { isCoordinator, isCoordinatorGeneral, coordType, perms } = useTeamAccess();
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
  const { data: memberAssignments = [], isLoading: isLoadingAssignments } = useQuery({
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

  // Los equipos de la persona deciden si un coordinador de etapa puede verla: hasta que se cargan no se decide el acceso
  const isLoading = isLoadingStaff || isLoadingUsers || isLoadingAssignments;

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

  const isOwnProfile =
    (user?.email && member?.email?.toLowerCase() === user.email.toLowerCase()) ||
    (!!staffId && !!user?.staff_member_id && user.staff_member_id === staffId);

  // Coordinador F7 solo ve entrenadores que llevan algún equipo F7, y el de F11 los que llevan alguno de F11.
  // Se miran TODOS los equipos de la persona (puede llevar uno de F7 y otro de F11), no solo el primero.
  const coachTeamIds = assignedTeams.length > 0
    ? assignedTeams.map(tm => tm.id)
    : (member?.team_ids?.length ? member.team_ids : (member?.team_id ? [member.team_id] : []));
  const coachTeams = coachTeamIds.map(id => teams.find(tm => tm.id === id)).filter(Boolean);

  const coordCanSeeTeam = () => {
    if (isCoordinatorGeneral) return true;
    return stageSeesCoach(coordType, coachTeams);
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
  // Ausencias y multas (13/11/2026): solo coordinación y dirección (también en el servidor)
  const showAbsences = canViewReports && !!(perms?.isAdmin || perms?.administration);

  // Ids con los que se guardan sus datos (feedback, 360, ausencias…): su ficha y, si tiene usuario, «user_<id>»
  const storageId = member?._isUser ? `user_${member._userId}` : staffId;
  const personIds = useMemo(() => [...new Set([storageId, linkedUser ? `user_${linkedUser.id}` : null].filter(Boolean))], [storageId, linkedUser]);
  const profileTeams = useMemo(() => {
    const list = assignedTeams.length ? assignedTeams.map((tm) => ({ tm, a: { team_role: tm.team_role } })) : coachTeams.map((tm) => ({ tm, a: {} }));
    return list.sort((x, y) => compareTeams(x.tm, y.tm));
  }, [assignedTeams, coachTeams]);
  const profileTeamIds = [...new Set([...profileTeams.map((x) => x.tm.id), member?.team_id].filter(Boolean))];
  const { data: fbItems = [] } = useQuery({
    queryKey: ["coachFeedback", storageId],
    queryFn: () => base44.entities.CoachFeedback.filter({ staff_id: storageId }),
    enabled: !!storageId && showFeedbackTab,
  });
  const fbCount = fbItems.filter((i) => canViewReports || i.status === "enviado").length;
  // El propio entrenador ve sus ausencias y multas solo si coordinación las ha hecho visibles (el servidor solo le da las suyas)
  const { data: ownShares = [] } = useQuery({
    queryKey: ["coachAdminShare", "own", storageId],
    queryFn: () => base44.entities.CoachAdminShare.list(),
    enabled: !!isOwnProfile && !showAbsences,
  });
  const absencesForCoach = !showAbsences && !!isOwnProfile && ownShares.some((d) => d.visible === true && personIds.includes(d.staff_id));
  const [tabPick, setTabPick] = useState(() => urlParams.get("tab"));
  const [newFb, setNewFb] = useState(0);

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

  const roleText = ROLE_LABELS[member.role] ? t(ROLE_LABELS[member.role]) : member.role;
  const tabs = [
    canViewReports && { k: "resumen", label: `${t("Resumen")} ★` },
    showFeedbackTab && { k: "feedback", label: fbCount ? `${t("Feedback")} · ${fbCount}` : t("Feedback") },
    showFeedbackTab && { k: "eval360", label: t("Evaluación 360") },
    (showAbsences || absencesForCoach) && { k: "ausencias", label: t("Ausencias y multas") },
    showPDITab && { k: "pdi", label: t("PDI · Plan Desarrollo Individual") },
    canViewReports && { k: "matches", label: t("Notas privadas") },
    member.notes && { k: "notes", label: t("Info") },
  ].filter(Boolean);
  const tab = tabs.some((x) => x.k === tabPick) ? tabPick : tabs[0]?.k;
  const go = (k) => { setTabPick(k); window.scrollTo?.({ top: 0, behavior: "smooth" }); };
  const access = targetUser || linkedUser;
  const bandBtn = (onClick, children, light, testId) => (
    <button type="button" onClick={onClick} data-testid={testId}
      style={{ fontSize: 13, fontWeight: 700, padding: "7px 14px", borderRadius: 8, border: light ? 0 : "1px solid rgba(255,255,255,.55)", background: light ? "#fff" : "transparent", color: light ? RS.granate : "#fff", whiteSpace: "nowrap" }}>{children}</button>
  );

  return (
    <Page testId="coach-profile">
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: "14px clamp(10px, 2vw, 22px) 28px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Cabecera */}
        <div data-testid="coach-band" className="flex flex-wrap items-center" style={{ gap: "12px 18px", padding: "16px 18px", borderRadius: 14, color: "#fff", background: `linear-gradient(110deg, ${RS.granateDark}, ${RS.granate})` }}>
          <div className="relative group shrink-0">
            {member.photo_url ? (
              <img src={member.photo_url} alt={`${member.first_name} ${member.last_name}`} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div className="rs2-display" style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
                {member.first_name?.[0]}{member.last_name?.[0]}
              </div>
            )}
            {canEdit && (
              <label className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" title={t("Cambiar foto")}>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={photoLoading} className="hidden" />
                {photoLoading ? <Loader className="w-5 h-5 text-white animate-spin" /> : <Upload className="w-5 h-5 text-white" />}
              </label>
            )}
          </div>
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <Link to="/Coaches" style={{ fontSize: 12, color: "rgba(255,255,255,.8)" }}>‹ {t("Personal")}</Link>
            <h1 style={{ margin: "2px 0 0", lineHeight: 1 }}>
              <span className="rs2-display" style={{ fontSize: "clamp(26px, 4vw, 36px)", color: "#fff" }}>{member.first_name} </span>
              <span className="rs2-display" style={{ fontSize: "clamp(26px, 4vw, 36px)", color: RS.naranja }}>{member.last_name}</span>
            </h1>
            <div className="flex flex-wrap items-center" style={{ gap: "2px 8px", fontSize: 13, marginTop: 6, color: "rgba(255,255,255,.92)" }}>
              <span>{roleText}</span>
              {profileTeams.map(({ tm, a }) => (
                <span key={tm.id}>· {tm.name} <span style={{ opacity: .75 }}>({[a?.team_role && (TEAM_ROLE_LABELS[a.team_role] ? t(TEAM_ROLE_LABELS[a.team_role]) : a.team_role), teamPlaysF7(tm) ? "F7" : "F11"].filter(Boolean).join(", ")})</span></span>
              ))}
              {member.phone && <a href={`tel:${member.phone}`} style={{ color: "#fff" }}>· <Phone className="inline w-3.5 h-3.5" /> {member.phone}</a>}
              {member.email && <a href={`mailto:${member.email}`} style={{ color: "#fff", wordBreak: "break-all" }}>· <Mail className="inline w-3.5 h-3.5" /> {member.email}</a>}
              {access && <span>· {access.role === "admin" || access.access_status === "approved" || (!access.access_status && access.app_role) ? `✓ ${t("acceso a la app")}` : t("sin acceso a la app")}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center" style={{ gap: 8, marginLeft: "auto" }}>
            {canViewReports && bandBtn(() => { go("feedback"); setNewFb((n) => n + 1); }, `+ ${t("Feedback")}`, true, "band-feedback")}
            {canEvaluate && bandBtn(() => go("eval360"), t("Evaluar 360"), false, "band-360")}
            {showAbsences && bandBtn(() => go("ausencias"), t("Ausencia o multa"), false, "band-absence")}
            {canEdit && (
              <button type="button" onClick={handleOpenEditDialog} title={t("Editar perfil")} aria-label={t("Editar perfil")} style={{ padding: 8, borderRadius: 8, color: "#fff" }}><Edit2 className="w-4 h-4" /></button>
            )}
            {canDelete && (
              <button type="button" onClick={() => setDeleteOpen(true)} title={member._isUser ? t("Quitar acceso") : t("Eliminar del personal")} aria-label={member._isUser ? t("Quitar acceso") : t("Eliminar del personal")} style={{ padding: 8, borderRadius: 8, color: "#fff" }}><Trash2 className="w-4 h-4" /></button>
            )}
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex" style={{ gap: 6, overflowX: "auto", paddingBottom: 2 }} role="tablist">
          {tabs.map((x) => (
            <button key={x.k} type="button" role="tab" aria-selected={tab === x.k} onClick={() => setTabPick(x.k)} data-testid={`coach-tab-${x.k}`}
              style={{ fontSize: 13, fontWeight: 600, padding: "6px 13px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0, border: `1px solid ${tab === x.k ? RS.granate : RS.line}`, background: tab === x.k ? RS.granate : "#fff", color: tab === x.k ? "#fff" : RS.ink2 }}>
              {x.label}
            </button>
          ))}
        </div>

        {tab === "resumen" && <CoachSummaryTab ids={personIds} teams={profileTeams} admin={showAbsences} onTab={go} />}

        {tab === "feedback" && (
          <CoachFeedbackSection
            staffId={storageId}
            teamIds={profileTeamIds}
            canWrite={canViewReports}
            isOwnProfile={!!isOwnProfile}
            author={{ id: user?.id, name: user?.full_name }}
            newSignal={newFb}
          />
        )}

        {tab === "eval360" && (
          <CoachEval360Areas
            staffId={storageId}
            ownerUserId={member._isUser ? member._userId : linkedUser?.id}
            teamIds={profileTeamIds}
            canEvaluate={canEvaluate}
            canSeeData={canEvaluate && !!(perms?.isAdmin || perms?.administration)}
            isOwnProfile={!!isOwnProfile}
            author={{ id: user?.id, name: user?.full_name }}
          />
        )}

        {tab === "ausencias" && <CoachAbsencesFines staffId={storageId} ids={personIds} teams={profileTeams} author={{ id: user?.id, name: user?.full_name }} readOnly={!showAbsences} />}

        {tab === "pdi" && <CoachPDISection staffId={storageId} canEvaluate={canEvaluate} canView={canViewReports} isOwnProfile={isOwnProfile} />}

        {tab === "matches" && <CoachMatchNotesSection staffId={storageId} teamId={member.team_id} isCoordinator={canViewReports} />}

        {tab === "notes" && (
          <div className="rs2-card" style={{ padding: 16 }}>
            <p className="text-sm text-gray-700 leading-relaxed">{member.notes}</p>
          </div>
        )}
      </div>

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
    </Page>
  );
}
