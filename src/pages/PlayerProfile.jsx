import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, BarChart2, BookOpen, Clock, HeartPulse, TrendingUp,
  FileText, Camera, Loader2, Zap, Pencil, Trash2, User,
  Shield, MapPin, Star, Phone, Mail,
  Activity, Calendar, Plus, History
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MatchStatsSection from "../components/player/MatchStatsSection";
import AttendanceHistorySection from "../components/player/AttendanceHistorySection";
import PDISection from "../components/player/PDISection";
import InjurySection from "../components/player/InjurySection";
import PlayerPerformancePanel from "../components/player/PlayerPerformancePanel";
import GuardianContactCard from "../components/player/GuardianContactCard";
import DocumentsSection from "../components/player/DocumentsSection";
import TrainingLoadSection from "../components/player/TrainingLoadSection";
import MedicalStatusWidget from "../components/player/MedicalStatusWidget";
import PlayerSeasonHistorySection from "../components/player/PlayerSeasonHistorySection";
import PlayerSidePanel from "../components/player/PlayerSidePanel";
import PlayerInfoCards from "../components/player/PlayerInfoCards";
import PlayerAttributesBar from "../components/player/PlayerAttributesBar";
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

  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: staffList = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.StaffMember.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries"], queryFn: () => base44.entities.Injury.list() });
  const { data: matchStats = [] } = useQuery({ queryKey: ["matchstats", playerId], queryFn: () => base44.entities.MatchStats.filter({ player_id: playerId }, "date"), enabled: !!playerId });
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
  const age = player.birth_date ? Math.floor((new Date() - new Date(player.birth_date)) / (365.25 * 24 * 3600 * 1000)) : null;
  const convPct = totalConvocatorias > 0 && partidos > 0 ? Math.round((partidos / totalConvocatorias) * 100) : null;

  return (
    <div className="min-h-screen" style={{ background: "#f8f7f5" }}>
      {/* ── HERO BANNER ── */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #6b1f28 0%, #3d0d13 60%, #1a0508 100%)" }}>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-5" style={{ background: "#e67e22", transform: "translate(30%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-5" style={{ background: "#e67e22", transform: "translate(-30%, 30%)" }} />

        <div className="relative px-6 pt-5 pb-0">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <Link to="/Players" className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Jugadores
            </Link>
            <div className="flex gap-2">
              <button
                onClick={() => setEditDialogOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white border border-white/20 hover:border-white/40 transition-all"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
              <button
                onClick={() => setDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-300 hover:text-red-200 border border-red-400/30 hover:border-red-400/60 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </button>
            </div>
          </div>

          {/* Main profile card */}
          <div className="flex flex-col lg:flex-row items-start lg:items-end gap-6 pb-6">
            {/* Photo */}
            <div className="relative group shrink-0">
              <div className="w-28 h-28 lg:w-36 lg:h-36 rounded-2xl overflow-hidden border-4 shadow-2xl" style={{ borderColor: "rgba(230,126,34,0.6)" }}>
                {player.photo_url ? (
                  <img src={player.photo_url} alt={player.first_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <User className="w-14 h-14 text-white/30" />
                  </div>
                )}
              </div>
              {player.jersey_number && (
                <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-lg border-2 border-white/20" style={{ background: "#e67e22" }}>
                  {player.jersey_number}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploading ? <Loader2 className="w-7 h-7 text-white animate-spin" /> : <Camera className="w-7 h-7 text-white" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight">
                  <span style={{ color: "#e67e22" }}>{player.first_name}</span>{" "}
                  <span className="text-white">{player.last_name}</span>
                </h1>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${st.bg} ${st.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                </span>
                {activeInjuries.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                    <HeartPulse className="w-3 h-3" /> {activeInjuries.length} lesión activa
                  </span>
                )}
              </div>

              {/* Tags row */}
              <div className="flex flex-wrap gap-2 mb-4">
                {team && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white/90 border border-white/15" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <Shield className="w-3 h-3" style={{ color: "#e67e22" }} /> {team.name}
                  </span>
                )}
                {player.position && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white/90 border border-white/15" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <MapPin className="w-3 h-3" style={{ color: "#e67e22" }} /> {POSITION_LABELS[player.position] || player.position}
                  </span>
                )}
                {player.secondary_position && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-white/60 border border-white/10" style={{ background: "rgba(255,255,255,0.05)" }}>
                    {POSITION_LABELS[player.secondary_position] || player.secondary_position}
                  </span>
                )}
                {player.laterality && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs text-white/60 border border-white/10" style={{ background: "rgba(255,255,255,0.05)" }}>
                    {LATERALITY_LABELS[player.laterality]}
                  </span>
                )}
                {age && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs text-white/60 border border-white/10" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <Calendar className="w-3 h-3" /> {age} años
                  </span>
                )}
              </div>

              {/* Contact */}
              <div className="flex flex-wrap gap-4">
                {player.phone && (
                  <a href={`tel:${player.phone}`} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors">
                    <Phone className="w-3 h-3" /> {player.phone}
                  </a>
                )}
                {player.email && (
                  <a href={`mailto:${player.email}`} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors">
                    <Mail className="w-3 h-3" /> {player.email}
                  </a>
                )}
              </div>
            </div>

            {/* Hero quick-stats (right side) */}
            <div className="flex lg:flex-col gap-3 lg:gap-2 shrink-0 lg:pb-1">
              {avgRating && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10" style={{ background: "rgba(230,126,34,0.15)" }}>
                  <Star className="w-4 h-4" style={{ color: "#e67e22" }} />
                  <div>
                    <p className="text-lg font-black text-white leading-none">{avgRating}</p>
                    <p className="text-[10px] text-white/50">valoración</p>
                  </div>
                </div>
              )}
              {attendancePct !== null && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <Activity className="w-4 h-4 text-white/50" />
                  <div>
                    <p className="text-lg font-black text-white leading-none">{attendancePct}%</p>
                    <p className="text-[10px] text-white/50">asistencia</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-4 sm:grid-cols-7 border-t border-white/10">
            {[
              { label: "Convoc.", value: totalConvocatorias, icon: "📋" },
              { label: "Partidos", value: partidos, icon: "⚽" },
              { label: "Goles", value: totalGoals, icon: "🎯" },
              { label: "Asist.", value: totalAssists, icon: "🅰️" },
              { label: "Minutos", value: totalMins > 0 ? `${totalMins}'` : "0'", icon: "⏱️" },
              { label: "Amarillas", value: yellowCards, icon: "🟨" },
              { label: "Rojas", value: redCards, icon: "🟥" },
            ].map(({ label, value, icon }, i) => (
              <div key={label} className={`px-3 py-3 text-center border-r border-white/10 last:border-0 ${i >= 4 ? "hidden sm:block" : ""}`}>
                <p className="text-xs mb-1">{icon}</p>
                <p className="text-lg font-black text-white leading-none">{value}</p>
                <p className="text-[10px] text-white/45 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div className="px-6 pt-5 pb-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Partidos jugados */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#fdf2f4" }}>
              <span className="text-xl">⚽</span>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-black text-gray-900 leading-none">{partidos}</p>
              <p className="text-xs text-gray-400 mt-0.5">Partidos jugados</p>
              {partidos > 0 && totalConvocatorias > 0 && (
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: "#6b1f28" }}>
                  {Math.round((partidos / totalConvocatorias) * 100)}% de convoc.
                </p>
              )}
            </div>
          </div>

          {/* Minutos totales — naranja */}
          <div className="bg-white border border-orange-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#fef3e2" }}>
              <span className="text-xl">⏱️</span>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-black leading-none" style={{ color: "#e67e22" }}>
                {totalMins > 0 ? totalMins.toLocaleString("es-ES") : "0"}
                <span className="text-base font-bold text-gray-400 ml-0.5">'</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Minutos totales</p>
              {partidos > 0 && (
                <p className="text-[10px] font-semibold text-orange-500 mt-0.5">
                  ~{Math.round(totalMins / partidos)}' / partido
                </p>
              )}
            </div>
          </div>

          {/* Goles + Asistencias */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#fdf2f4" }}>
              <span className="text-xl">🎯</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-gray-900 leading-none">{totalGoals}</p>
                <span className="text-sm text-gray-400 font-medium">/ {totalAssists}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Goles / Asistencias</p>
              {partidos > 0 && (
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: "#6b1f28" }}>
                  {(totalGoals + totalAssists)} participaciones
                </p>
              )}
            </div>
          </div>

          {/* Asistencia entrenamientos */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: attendancePct === null ? "#f9fafb" : attendancePct >= 80 ? "#f0fdf4" : attendancePct >= 60 ? "#fff7ed" : "#fdf2f4" }}>
              <span className="text-xl">📅</span>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-black leading-none" style={{ color: attendancePct === null ? "#9ca3af" : attendancePct >= 80 ? "#16a34a" : attendancePct >= 60 ? "#ea580c" : "#dc2626" }}>
                {attendancePct !== null ? `${attendancePct}%` : "—"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Asistencia entrenos</p>
              {totalTrainings > 0 && (
                <p className="text-[10px] font-semibold mt-0.5 text-gray-400">
                  {presentTrainings}/{totalTrainings} sesiones
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT: two-column layout ── */}
      <div className="px-6 py-6">
        <div className="flex flex-col xl:flex-row gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="xl:w-80 shrink-0 space-y-4">
            <PlayerSidePanel playerId={playerId} matchStats={matchStats} playerInjuries={playerInjuries} />
            <GuardianContactCard player={player} compact />
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Personal data + field position */}
            <PlayerInfoCards player={player} />

            {/* Attributes bar */}
            <PlayerAttributesBar playerId={playerId} />

            {/* Medical widget — solo si hay lesiones activas */}
            {activeInjuries.length > 0 && (
              <MedicalStatusWidget playerId={playerId} />
            )}

            {/* Tabs */}
            <Tabs defaultValue="rendimiento">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
                <TabsList className="w-full bg-transparent p-0 h-auto border-b border-gray-100 flex flex-wrap rounded-none">
                  {[
                    { value: "rendimiento", icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Rendimiento" },
                    { value: "stats", icon: <BarChart2 className="w-3.5 h-3.5" />, label: "Partidos" },
                    { value: "attendance", icon: <Clock className="w-3.5 h-3.5" />, label: "Asistencia" },
                    { value: "pdi", icon: <BookOpen className="w-3.5 h-3.5" />, label: "PDI" },
                    { value: "injuries", icon: <HeartPulse className="w-3.5 h-3.5" />, label: "Médico" },
                    { value: "documents", icon: <FileText className="w-3.5 h-3.5" />, label: "Docs" },
                    { value: "carga", icon: <Zap className="w-3.5 h-3.5" />, label: "Carga" },
                    { value: "historial", icon: <History className="w-3.5 h-3.5" />, label: "Historial" },
                  ].map(tab => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex-1 min-w-0 rounded-none border-b-2 border-transparent px-3 py-3 text-xs font-semibold text-gray-500 transition-all gap-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                      style={{"--active-color": "#6b1f28"}}
                    >
                      {tab.icon}
                      <span className="hidden sm:inline">{tab.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <TabsContent value="rendimiento" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <PlayerPerformancePanel playerId={playerId} />
              </TabsContent>
              <TabsContent value="stats" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <MatchStatsSection playerId={playerId} />
              </TabsContent>
              <TabsContent value="attendance" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <AttendanceHistorySection
                  attendance={attendance.filter((a) => a.player_id === playerId)}
                  injuries={injuries.filter((i) => i.player_id === playerId)}
                />
              </TabsContent>
              <TabsContent value="pdi" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <PDISection playerId={playerId} playerName={`${player.first_name} ${player.last_name}`} playerEmail={player.email} />
              </TabsContent>
              <TabsContent value="injuries" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
               <div className="space-y-4">
                 <Button
                   onClick={() => setInjuryDialogOpen(true)}
                   className="text-white w-full"
                   style={{ background: "var(--granate)" }}
                 >
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
              <TabsContent value="documents" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <DocumentsSection playerId={playerId} />
              </TabsContent>
              <TabsContent value="carga" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                 <TrainingLoadSection playerId={playerId} />
              </TabsContent>
              <TabsContent value="historial" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <PlayerSeasonHistorySection playerId={playerId} />
              </TabsContent>
              </Tabs>
          </div>
        </div>
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