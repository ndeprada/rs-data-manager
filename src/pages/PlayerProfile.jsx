import JerseyBack from "@/components/player/JerseyBack";
import { birthYearOf } from "@/lib/birthYear";
import { countCleanSheets, useCleanSheetData } from "@/lib/cleanSheet";
import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, BarChart2, BookOpen, Clock, HeartPulse,
  Camera, Loader2, Pencil, Trash2, User,
  Shield, Phone, Mail,
  Plus, LayoutGrid, IdCard, FileText, History
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MatchStatsSection from "../components/player/MatchStatsSection";
import AttendanceHistorySection from "../components/player/AttendanceHistorySection";
import PDISection from "../components/player/PDISection";
import PDIPlanSection from "../components/player/PDIPlanSection";
import Evaluation360Section from "../components/player/Evaluation360Section";
import InjurySection from "../components/player/InjurySection";
import PlayerPerformancePanel from "../components/player/PlayerPerformancePanel";
import GuardianContactCard from "../components/player/GuardianContactCard";
import DocumentsSection from "../components/player/DocumentsSection";
import TrainingLoadSection from "../components/player/TrainingLoadSection";
import PlayerSeasonHistorySection from "../components/player/PlayerSeasonHistorySection";
import { MiniPitch, FootIndicator } from "../components/player/PlayerPositionBadges";
import PlayerSummaryTab from "../components/player/PlayerSummaryTab";
import PlayerInfoCards from "../components/player/PlayerInfoCards";
import AddPlayerDialog from "@/components/team/AddPlayerDialog";
import ImageCropDialog from "@/components/ImageCropDialog";
import InjuryRegistrationDialog from "@/components/player/InjuryRegistrationDialog";
import { playerFirstName, playerFullName } from "@/lib/playerName";

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
  const [editDialogOpen, setEditDialogOpen] = useState(urlParams.get("edit") === "1");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState(null);
  const [injuryDialogOpen, setInjuryDialogOpen] = useState(false);
  const [tab, setTab] = useState("resumen");

  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: staffList = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.StaffMember.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries"], queryFn: () => base44.entities.Injury.list() });
  const { data: matchStats = [] } = useQuery({ queryKey: ["matchstats", playerId], queryFn: () => base44.entities.MatchStats.filter({ player_id: playerId }, "date"), enabled: !!playerId });
  const { data: convocatorias = [] } = useQuery({ queryKey: ["convocatorias"], queryFn: () => base44.entities.Convocatoria.list() });

  const player = players.find((p) => p.id === playerId);
  const { events: allEvents, allStats: allMatchStats } = useCleanSheetData(player?.position === "portero");
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
    isGK ? { label: "Porter. a 0", value: countCleanSheets(matchStats, allEvents, allMatchStats) } : { label: "Asist.", value: totalAssists },
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
    { value: "documents", icon: <FileText className="w-3.5 h-3.5" />, label: "Documentos" },
    { value: "historial", icon: <History className="w-3.5 h-3.5" />, label: "Historial" },
  ];
  const tabContentClass = "mt-0 focus-visible:outline-none focus-visible:ring-0";

  return (
    <div className="min-h-screen" style={{ background: "#f8f7f5" }}>
      {/* ── CABECERA COMPACTA ── */}
      <div style={{ background: "linear-gradient(135deg, #6b1f28 0%, #3d0d13 100%)" }}>
        <div className="px-4 sm:px-6 pt-3 pb-4">
          <div className="flex items-center justify-between mb-3">
            <Link to="/Players" onClick={(e) => { if (window.history.state?.idx > 0) { e.preventDefault(); navigate(-1); } }} className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Volver
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
                <div className="w-16 h-16 min-w-[64px] rounded-xl overflow-hidden border-2" style={{ borderColor: "rgba(230,126,34,0.6)" }}>
                  {player.photo_url ? (
                    <img src={player.photo_url} alt={player.first_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <User className="w-7 h-7 text-white/30" />
                    </div>
                  )}
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" aria-label="Cambiar foto">
                  {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>

              {player.jersey_number && <JerseyBack number={player.jersey_number} goalkeeper={player.position === "portero"} />}

              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                  <span style={{ color: "#e67e22" }}>{playerFirstName(player)}</span>{" "}
                  <span className="text-white">{player.last_name}</span>
                </h1>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-white/70">
                  {team && <span className="inline-flex items-center gap-1"><Shield className="w-3 h-3" style={{ color: "#e67e22" }} />{team.name}</span>}
                  {player.position && <span>· {POSITION_LABELS[player.position] || player.position}{player.secondary_position ? ` / ${POSITION_LABELS[player.secondary_position] || player.secondary_position}` : ""}</span>}
                  {age && <span>· Nac. {age}</span>}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.bg} ${st.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                  </span>
                </div>
              </div>
              {(player.position || player.laterality) && (
                <div className="flex items-center gap-3 shrink-0 ml-1">
                  {player.position && <MiniPitch position={player.position} secondaryPosition={player.secondary_position} laterality={player.laterality} />}
                  <FootIndicator laterality={player.laterality} />
                </div>
              )}
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
                  className="flex-1 min-w-0 rounded-none border-b-2 border-transparent px-1.5 sm:px-2 py-3 text-xs font-semibold text-gray-500 transition-all gap-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-[#6b1f28] data-[state=active]:text-[#6b1f28]"
                >
                  {t.icon}
                  <span className="hidden md:inline">{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="resumen" className={tabContentClass}>
            <PlayerSummaryTab
              team={team}
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
              <Evaluation360Section player={player} playerId={playerId} />
              <PDIPlanSection player={player} team={team} />
              <details className="bg-white border border-gray-200 rounded-2xl shadow-sm">
                <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-gray-600">Evaluaciones antiguas (texto libre)</summary>
                <div className="px-4 pb-4">
                  <PDISection readOnly playerId={playerId} playerName={`${playerFullName(player)}`} playerEmail={player.email} />
                </div>
              </details>
            </div>
          </TabsContent>

          <TabsContent value="injuries" className={tabContentClass}>
            <div className="space-y-4">
              <Button onClick={() => setInjuryDialogOpen(true)} className="text-white w-full" style={{ background: "var(--granate)" }}>
                <Plus className="w-4 h-4 mr-2" /> Registrar lesión
              </Button>
              <InjurySection
                playerId={playerId}
                playerName={`${playerFullName(player)}`}
                playerEmail={player.email}
                staffEmails={staffEmails}
              />
            </div>
          </TabsContent>

          <TabsContent value="documents" className={tabContentClass}>
            <DocumentsSection playerId={playerId} />
          </TabsContent>

          <TabsContent value="historial" className={tabContentClass}>
            <PlayerSeasonHistorySection playerId={playerId} />
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
            <AlertDialogDescription>Se eliminará a {playerFullName(player)} y todos sus datos. Esta acción no se puede deshacer.</AlertDialogDescription>
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