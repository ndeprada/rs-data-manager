import { birthYearOf } from "@/lib/birthYear";
import { countCleanSheets } from "@/lib/cleanSheet";
import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, BarChart2, BookOpen, Clock, HeartPulse,
  Camera, Loader2, Pencil, Trash2, User,
  Shield, Phone, Mail,
  Plus, LayoutGrid, MoreHorizontal
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MatchStatsSection from "../components/player/MatchStatsSection";
import AttendanceHistorySection from "../components/player/AttendanceHistorySection";
import PDISection from "../components/player/PDISection";
import PDIPlanSection from "../components/player/PDIPlanSection";
import InjurySection from "../components/player/InjurySection";
import PlayerPerformancePanel from "../components/player/PlayerPerformancePanel";
import GuardianContactCard from "../components/player/GuardianContactCard";
import DocumentsSection from "../components/player/DocumentsSection";
import TrainingLoadSection from "../components/player/TrainingLoadSection";
import PlayerSeasonHistorySection from "../components/player/PlayerSeasonHistorySection";
import PlayerSummaryTab from "../components/player/PlayerSummaryTab";
import PlayerInfoCards from "../components/player/PlayerInfoCards";
import AddPlayerDialog from "@/components/team/AddPlayerDialog";
import ImageCropDialog from "@/components/ImageCropDialog";
import InjuryRegistrationDialog from "@/components/player/InjuryRegistrationDialog";

const POSITION_LABELS = {
  portero: "Portero", lateral: "Lateral", central: "Central", libre: "Libre",
  mediocentro: "Mediocentro", interior: "Interior", delantero_centro: "Delantero", extremo: "Extremo"
};
const LATERALITY_LABELS = { diestro: "Diestro", zurdo: "Zurdo", ambidiestro: "Ambidiestro" };

const STATUS_CONFIG = {
  activo:    { label: "Activo",    dot: "bg-green-400",  text: "text-green-700",  bg: "bg-green-50 border-green-200" },
  lesionado: { label: "Lesionado", dot: "bg-orange-400", text: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  baja:      { label: "Baja",      dot: "bg-red-400",    text: "text-red-700",    bg: "bg-red-50 border-red-200" },
};

export default function PlayerProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const playerId = urlParams.get("id");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState(null);
  const [injuryDialogOpen, setInjuryDialogOpen] = useState(false);
  const [tab, setTab] = useState("resumen");
  const [moreSection, setMoreSection] = useState("ficha");

  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: staffList = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.StaffMember.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries"], queryFn: () => base44.entities.Injury.list() });
  const { data: matchStats = [] } = useQuery({ queryKey: ["matchstats", playerId], queryFn: () => base44.entities.MatchStats.filter({ player_id: playerId }, "date"), enabled: !!playerId });
  const { data: allEvents = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list() });
  const { data: convocatorias = [] } = useQuery({ queryKey: ["convocatorias"], queryFn: () => base44.entities.Convocatoria.list() });

  const player = players.find((p) => p.id === playerId);
  const team = teams.find((t) => t.id === player?.team_id);
  const teamStaff = staffList.filter((s) => s.team_id === player?.team_id && s.email);
  const staffEmails = teamStaff.map((s) => s.email);

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Player.delete(playerId),
    onSuccess: () => navigate("/Players"),
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setSelectedImageSrc(reader.result); setCropDialogOpen(true); };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = async (croppedBlob) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: croppedBlob });
    await base44.entities.Player.update(playerId, { photo_url: file_url });
    queryClient.invalidateQueries({ queryKey: ["players"] });
    setUploading(false);
    // return resolved so ImageCropDialog can close after completion
  };

  if (!player) return (
    <div className="text-center py-20">
      <p className="text-gray-500">Jugador no encontrado</p>
      <Link to="/Players" className="text-sm font-medium mt-2 inline-block" style={{ color: "var(--granate)" }}>← Volver a jugadores</Link>
    </div>
  );

  // Computed stats
  const playerAttendance = attendance.filter((a) => a.player_id === playerId);
  const totalTrainings = playerAttendance.length;
  const presentTrainings = playerAttendance.filter((a) => a.status !== "absent").length;
  const attendancePct = totalTrainings > 0 ? Math.round((presentTrainings / totalTrainings) * 100) : null;
  const partidos = matchStats.length;
  const totalGoals = matchStats.reduce((s, r) => s + (r.goals || 0), 0);
  const totalAssists = matchStats.reduce((s, r) => s + (r.assists || 0), 0);
  const totalMins = matchStats.reduce((s, r) => s + (r.minutes_played || 0), 0);
  const ratedStats = matchStats.filter((r) => r.rating);
  const avgRating = ratedStats.length > 0 ? (ratedStats.reduce((s, r) => s + r.rating, 0) / ratedStats.length).toFixed(1) : null;
  const totalConvocatorias = convocatorias.filter((c) => Array.isArray(c.player_ids) && c.player_ids.includes(playerId)).length;
  const yellowCards = matchStats.reduce((s, r) => s + (r.yellow_cards || 0), 0);
  const redCards = matchStats.reduce((s, r) => s + (r.red_cards || 0), 0);
  const playerInjuries = injuries.filter((i) => i.player_id === playerId);
  const activeInjuries = playerInjuries.filter((i) => i.status !== "alta");
  const st = STATUS_CONFIG[player.status] || STATUS_CONFIG.activo;
  const age = birthYearOf(player);
  const convPct = totalConvocatorias > 0 && partidos > 0 ? Math.round((partidos / totalConvocatorias) * 100) : null;

  const isGK = player.position === "portero";
  const heroStats = [
    { label: "PJ", value: partidos },
    { label: "Min", value: totalMins > 0 ? `${totalMins.toLocaleString("es-ES")}'` : "0'" },
    { label: "Goles", value: totalGoals },
    isGK ? { label: "Porter. a 0", value: countCleanSheets(matchStats, allEvents) } : { label: "Asist.", value: totalAssists },
    { label: "Tarj.", value: yellowCards + redCards },
    { label: "Asist. entr.", value: attendancePct !== null ? `${attendancePct}%` : "—" },
    { label: "Nota", value: avgRating || "—" },
  ];
  const nextInjury = activeInjuries[0];
  const tabs = [
    { value: "resumen", icon: <LayoutGrid className="w-3.5 h-3.5" />, label: "Resumen" },
    { value: "stats", icon: <BarChart2 className="w-3.5 h-3.5" />, label: "Partidos" },
    { value: "entrenos", icon: <Clock className="w-3.5 h-3.5" />, label: "Entrenos" },
    { value: "pdi", icon: <BookOpen className="w-3.5 h-3.5" />, label: "PDI" },
    { value: "injuries", icon: <HeartPulse className="w-3.5 h-3.5" />, label: "Médico" },
    { value: "mas", icon: <MoreHorizontal className="w-3.5 h-3.5" />, label: "Más" },
  ];
  const tabContentClass = "mt-0 focus-visible:outline-none focus-visible:ring-0";

  return (
    <div className="min-h-screen" style={{ background: "#f8f7f5" }}>
      {/* ── CABECERA COMPACTA ── */}
      <div style={{ background: "linear-gradient(135deg, #6b1f28 0%, #3d0d13 100%)" }}>
        <div className="px-4 sm:px-6 pt-3 pb-4">
          <div className="flex items-center justify-between mb-3">
            <Link to="/Players" className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Jugadores
            </Link>
            <div className="flex gap-2">
              <button onClick={() => setEditDialogOpen(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-white/80 hover:text-white border border-white/20 hover:border-white/40 transition-all">
                <Pencil className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Editar</span>
              </button>
              <button onClick={() => setDeleteConfirm(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-red-300 hover:text-red-200 border border-red-400/30 hover:border-red-400/60 transition-all">
                <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Eliminar</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative group shrink-0">
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2" style={{ borderColor: "rgba(230,126,34,0.6)" }}>
                  {player.photo_url ? (
                    <img src={player.photo_url} alt={player.first_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <User className="w-7 h-7 text-white/30" />
                    </div>
                  )}
                </div>
                {player.jersey_number && (
                  <div className="absolute -bottom-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-md flex items-center justify-center text-[11px] font-black text-white border border-white/20" style={{ background: "#e67e22" }}>
                    {player.jersey_number}
                  </div>
                )}
                <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" aria-label="Cambiar foto">
                  {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>

              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                  <span style={{ color: "#e67e22" }}>{player.first_name}</span>{" "}
                  <span className="text-white">{player.last_name}</span>
                </h1>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-white/70">
                  {team && <span className="inline-flex items-center gap-1"><Shield className="w-3 h-3" style={{ color: "#e67e22" }} />{team.name}</span>}
                  {player.position && <span>· {POSITION_LABELS[player.position] || player.position}{player.secondary_position ? ` / ${POSITION_LABELS[player.secondary_position] || player.secondary_position}` : ""}</span>}
                  {player.laterality && <span>· {LATERALITY_LABELS[player.laterality]}</span>}
                  {age && <span>· Nac. {age}</span>}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.bg} ${st.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-3 text-center shrink-0">
              {heroStats.map(({ label, value }) => (
                <div key={label} className="px-1">
                  <p className="text-base sm:text-lg font-black text-white leading-none">{value}</p>
                  <p className="text-[10px] text-white/50 mt-1 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {nextInjury && (
          <button onClick={() => setTab("injuries")} className="w-full flex items-center gap-2 px-4 sm:px-6 py-1.5 text-xs text-left" style={{ background: "#fef2f2", color: "#b91c1c" }}>
            <HeartPulse className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              Lesión activa{nextInjury.type ? `: ${nextInjury.type}` : ""}{nextInjury.body_part ? ` · ${nextInjury.body_part}` : ""}
              {nextInjury.expected_return ? ` · alta prevista ${new Date(nextInjury.expected_return).toLocaleDateString("es", { day: "numeric", month: "short" })}` : ""}
              {activeInjuries.length > 1 ? ` (+${activeInjuries.length - 1})` : ""}
            </span>
          </button>
        )}
      </div>

      {/* ── PESTAÑAS ── */}
      <div className="px-4 sm:px-6 py-4">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
            <TabsList className="w-full bg-transparent p-0 h-auto border-b border-gray-100 flex rounded-none overflow-x-auto">
              {tabs.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="flex-1 min-w-0 rounded-none border-b-2 border-transparent px-3 py-3 text-xs font-semibold text-gray-500 transition-all gap-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-[#6b1f28] data-[state=active]:text-[#6b1f28]"
                >
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="resumen" className={tabContentClass}>
            <PlayerSummaryTab
              player={player}
              playerId={playerId}
              matchStats={matchStats}
              attendance={playerAttendance}
              injuries={playerInjuries}
              onGoTab={setTab}
            />
          </TabsContent>

          <TabsContent value="stats" className={tabContentClass}>
            <div className="space-y-4">
              <PlayerPerformancePanel playerId={playerId} />
              <MatchStatsSection playerId={playerId} isGoalkeeper={player.position === "portero"} />
            </div>
          </TabsContent>

          <TabsContent value="entrenos" className={tabContentClass}>
            <div className="space-y-4">
              <AttendanceHistorySection attendance={playerAttendance} injuries={playerInjuries} />
              <TrainingLoadSection playerId={playerId} />
            </div>
          </TabsContent>

          <TabsContent value="pdi" className={tabContentClass}>
            <div className="space-y-6">
              <PDIPlanSection player={player} />
              <PDISection playerId={playerId} playerName={`${player.first_name} ${player.last_name}`} playerEmail={player.email} />
            </div>
          </TabsContent>

          <TabsContent value="injuries" className={tabContentClass}>
            <div className="space-y-4">
              <Button onClick={() => setInjuryDialogOpen(true)} className="text-white w-full" style={{ background: "var(--granate)" }}>
                <Plus className="w-4 h-4 mr-2" /> Registrar lesión
              </Button>
              <InjurySection
                playerId={playerId}
                playerName={`${player.first_name} ${player.last_name}`}
                playerEmail={player.email}
                staffEmails={staffEmails}
              />
            </div>
          </TabsContent>

          <TabsContent value="mas" className={tabContentClass}>
            <div className="flex gap-2 mb-4">
              {[
                { value: "ficha", label: "Ficha" },
                { value: "documents", label: "Documentos" },
                { value: "historial", label: "Historial" },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => setMoreSection(s.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${moreSection === s.value ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                  style={moreSection === s.value ? { background: "#6b1f28" } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {moreSection === "ficha" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PlayerInfoCards player={player} />
                <div className="space-y-4">
                  {(player.phone || player.email) && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Contacto del jugador</p>
                      {player.phone && <a href={`tel:${player.phone}`} className="flex items-center gap-2 text-sm text-gray-700"><Phone className="w-3.5 h-3.5 text-gray-400" />{player.phone}</a>}
                      {player.email && <a href={`mailto:${player.email}`} className="flex items-center gap-2 text-sm text-gray-700"><Mail className="w-3.5 h-3.5 text-gray-400" />{player.email}</a>}
                    </div>
                  )}
                  <GuardianContactCard player={player} />
                </div>
              </div>
            )}
            {moreSection === "documents" && <DocumentsSection playerId={playerId} />}
            {moreSection === "historial" && <PlayerSeasonHistorySection playerId={playerId} />}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <ImageCropDialog open={cropDialogOpen} onOpenChange={setCropDialogOpen} imageSrc={selectedImageSrc} onConfirm={handleCropConfirm} isLoading={uploading} />
      <AddPlayerDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} teamId={player.team_id} editingPlayer={player} />
      {injuryDialogOpen && <InjuryRegistrationDialog playerId={playerId} onClose={() => setInjuryDialogOpen(false)} />}

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar jugador?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará a {player.first_name} {player.last_name} y todos sus datos. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}