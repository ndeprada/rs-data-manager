import { birthYearOf } from "@/lib/birthYear";
import { countCleanSheets, useCleanSheetData } from "@/lib/cleanSheet";
import React, { useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { HeartPulse, Camera, Loader2, Pencil, Trash2, User, Plus } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import MatchStatsSection from "../components/player/MatchStatsSection";
import PlayerCorrectionsSection from "../components/player/PlayerCorrectionsSection";
import AttendanceHistorySection from "../components/player/AttendanceHistorySection";
import PDISection from "../components/player/PDISection";
import PDIPlanSection from "../components/player/PDIPlanSection";
import Evaluation360Section from "../components/player/Evaluation360Section";
import InjurySection from "../components/player/InjurySection";
import PlayerPerformancePanel from "../components/player/PlayerPerformancePanel";
import DocumentsSection from "../components/player/DocumentsSection";
import TrainingLoadSection from "../components/player/TrainingLoadSection";
import PlayerSeasonHistorySection from "../components/player/PlayerSeasonHistorySection";
import ProfileSummary from "../components/player/ProfileSummary";
import { getExtraPositions } from "@/lib/playerPositions";
import AddPlayerDialog from "@/components/team/AddPlayerDialog";
import ImageCropDialog from "@/components/ImageCropDialog";
import InjuryRegistrationDialog from "@/components/player/InjuryRegistrationDialog";
import { playerFirstName, playerFullName } from "@/lib/playerName";
import { useCountedStats, useMatchStatus } from "@/lib/matchStatus";
import { useParticipationContext } from "@/lib/useParticipation";
import { participationOf, playerLevel } from "@/lib/participation";
import { matchRows, seasonTotals, seasonStart, attendanceWindow, attendanceStrip, nextMatchFor, neighbours } from "@/lib/playerProfile";
import { usePlayerMode } from "@/lib/playerMode";
import { useAuth } from "@/lib/AuthContext";
import { INJURY_TYPE_LABELS, BODY_PART_LABELS, labelOf } from "@/lib/injuryLabels";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { Flag, countryOf } from "@/lib/countries";
import { Page, RS, YearBadge } from "@/components/rs2/kit";
import { WIN, LOSS } from "@/components/rs2/dashParts";
import { PlayerMatchesReadOnly, PlayerInjuriesReadOnly, PlayerDocumentsReadOnly, PlayerHistoryReadOnly } from "@/components/player/PlayerReadOnlySections";
import { useT, useFormat, msg } from "@/i18n";
import { useIsMobile } from "@/hooks/use-mobile";

const AMBER = "#B45309";
const POSITION_LABELS = {
  portero: msg("Portero"), lateral: msg("Lateral"), central: msg("Central"), libre: msg("Libre"),
  mediocentro: msg("Mediocentro"), interior: msg("Interior"), mediapunta: msg("Mediapunta"), delantero_centro: msg("Delantero"), extremo: msg("Extremo")
};
const LATERALITY_LABELS = { diestro: msg("Diestro"), zurdo: msg("Zurdo"), ambidiestro: msg("Ambidiestro") };
const STATUS_CONFIG = {
  activo:    { label: msg("Activo"),    bg: "#DCFCE7", fg: WIN },
  lesionado: { label: msg("Lesionado"), bg: "#FFEDD5", fg: "#C2410C" },
  baja:      { label: msg("Baja"),      bg: "#FEE2E2", fg: LOSS },
};
const ACCOUNT_LABEL = { own: msg("propia"), family: msg("familia"), pending: msg("pendiente"), none: msg("sin cuenta") };

export default function PlayerProfile() {
  const t = useT();
  const fmt = useFormat();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const isPlayerAccount = usePlayerMode();
  const { user: authUser } = useAuth();
  const { perms } = useTeamAccess();
  // Cuerpo técnico que también es jugador: "Mi ficha de jugador" abre su propia ficha en vista de jugador
  const ownPlayerView = !!authUser?.player_id && urlParams.get("as") === "player" && urlParams.get("id") === authUser.player_id;
  const playerMode = isPlayerAccount || ownPlayerView;
  // El jugador solo puede ver su propia ficha
  const playerId = playerMode ? authUser?.player_id : urlParams.get("id");
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
  const now = useMemo(() => new Date(), [playerId]);
  const mobile = useIsMobile();

  const { data: players = [], isFetched: playersFetched } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  // Un jugador dado de baja en un cierre de temporada no sale en el listado general: se pide su ficha directamente
  const inList = players.some((p) => p.id === playerId);
  const { data: archivedPlayer = null, isLoading: archLoading } = useQuery({
    queryKey: ["player_by_id", playerId],
    queryFn: async () => (await base44.entities.Player.filter({ id: playerId }))[0] || null,
    enabled: !!playerId && playersFetched && !inList,
  });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: staffList = [] } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.StaffMember.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries"], queryFn: () => base44.entities.Injury.list() });
  const { data: raw_matchStats = [] } = useQuery({ queryKey: ["matchstats", playerId], queryFn: () => base44.entities.MatchStats.filter({ player_id: playerId }, "date"), enabled: !!playerId });
  const matchStats = useCountedStats(raw_matchStats);
  const { data: convsAll = [] } = useQuery({ queryKey: ["convocatorias_all"], queryFn: () => base44.entities.Convocatoria.list() });
  const { data: statsAll = [] } = useQuery({ queryKey: ["matchstats_all"], queryFn: () => base44.entities.MatchStats.list() });
  const { counted, events: allEventsSorted } = useMatchStatus();
  const partCtx = useParticipationContext("liga");
  const { data: accounts = null } = useQuery({ queryKey: ["playerAccounts"], queryFn: () => base44.club.playerAccounts(), enabled: !!perms.editPlayers && !isPlayerAccount, retry: false });

  const player = players.find((p) => p.id === playerId) || archivedPlayer;
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

  if (!player && archLoading) return <p className="text-center py-20 text-sm text-gray-400">{t("Cargando…")}</p>;
  if (!player) return (
    <div className="text-center py-20">
      <p className="text-gray-500">{t("Jugador no encontrado")}</p>
      <Link to="/Players" className="text-sm font-medium mt-2 inline-block" style={{ color: "var(--granate)" }}>{t("← Volver a jugadores")}</Link>
    </div>
  );

  // Temporada con su equipo (partidos de liga cerrados) y entrenos
  const evById = new Map(allEventsSorted.map((e) => [e.id, e]));
  const playerAttendance = attendance.filter((a) => a.player_id === playerId);
  const playerInjuries = injuries.filter((i) => i.player_id === playerId);
  const activeInjuries = playerInjuries.filter((i) => i.status !== "alta");
  const rows = matchRows({ events: allEventsSorted, convs: convsAll, stats: statsAll, playerId, teamId: player.team_id, counted });
  const tot = seasonTotals(rows);
  const part = player.team_id ? participationOf(player, { ...partCtx, events: partCtx.events.filter((e) => e.team_id === player.team_id) }) : null;
  const pctMin = part && part.all.availMin ? part.all.pctAvail : null;
  const level = part ? playerLevel(part) : null;
  const attWin = attendanceWindow(playerAttendance, evById, { now });
  const attSeason = attendanceWindow(playerAttendance, evById, { now, since: seasonStart(now) });
  const attStrip = attendanceStrip(playerAttendance, evById, { now, n: 20 });
  const next = nextMatchFor({ events: allEventsSorted, convs: convsAll, teamId: player.team_id, playerId, now });
  const nb = neighbours(players, player);
  const isGK = player.position === "portero";
  const st = STATUS_CONFIG[player.status] || STATUS_CONFIG.activo;
  const year = birthYearOf(player);
  const acc = accounts ? (accounts.own?.[playerId] ? "own" : accounts.family?.[playerId] ? "family" : accounts.pending?.[playerId] ? "pending" : "none") : null;
  const nextInjury = activeInjuries[0];

  const tabs = [
    { value: "resumen", label: msg("Resumen") },
    { value: "stats", label: msg("Partidos"), n: tot.played || null },
    { value: "entrenos", label: msg("Entrenos"), n: playerAttendance.filter((a) => a.status).length || null },
    { value: "pdi", label: msg("PDI") },
    { value: "injuries", label: msg("Médico"), n: activeInjuries.length || null, alert: activeInjuries.length > 0 },
    { value: "documents", label: msg("Documentos") },
    { value: "historial", label: msg("Historial") },
  ];
  // Qué ve y qué puede cambiar cada función (el jugador ve su propia ficha como siempre)
  const can = (tab) => playerMode || perms.canSeePlayerTab(tab);
  const visibleTabs = tabs.filter((tb) => can(tb.value));
  const staffEdit = !playerMode && perms.editPlayers;
  // Pierna no hábil: valoración interna; el jugador no la ve, entrenadores y coordinación la editan
  const footMode = playerMode ? "hidden" : perms.editPlayers ? "edit" : "view";
  const posName = (p) => (POSITION_LABELS[p] ? t(POSITION_LABELS[p]) : p);
  const go = (p) => p && navigate(`/PlayerProfile?id=${p.id}`);

  const minColor = level === "alert" ? LOSS : level === "warn" ? AMBER : RS.granate;
  const attColor = attSeason.pct == null ? RS.faint : attSeason.pct >= 80 ? WIN : attSeason.pct >= 70 ? AMBER : LOSS;
  const kpis = [
    { k: "pj", n: tot.played, label: t("partidos"), sub: t("{tit} titular · {sup} suplente · de {n}", { tit: tot.starter, sup: tot.sub, n: tot.matches }) },
    { k: "min", n: pctMin == null ? "–" : `${pctMin}%`, label: t("de los minutos"), sub: t("{min}' jugados", { min: fmt.num(tot.minutes) }), color: minColor, bar: pctMin, title: level === "alert" ? t("Por debajo del mínimo de minutos del club") : undefined },
    { k: "goles", n: tot.goals, label: t("goles"), sub: tot.played ? t("{n} por partido", { n: fmt.num(Math.round((tot.goals / tot.played) * 100) / 100) }) : "" },
    isGK
      ? { k: "p0", n: countCleanSheets(matchStats, allEvents, allMatchStats), label: t("porterías a 0"), sub: "" }
      : { k: "asist", n: tot.assists, label: t("asistencias"), sub: t("{n} G+A", { n: tot.goals + tot.assists }) },
    { k: "tarj", n: tot.yellow, label: tot.yellow === 1 ? t("amarilla") : t("amarillas"), sub: tot.red === 1 ? t("1 roja") : t("{n} rojas", { n: tot.red }), color: RS.ink2 },
    { k: "entrenos", n: attSeason.pct == null ? "–" : `${attSeason.pct}%`, label: t("entrenos"), sub: attSeason.n ? t("{ok} de {n} · temporada", { ok: attSeason.present + attSeason.apart, n: attSeason.n }) : t("toda la temporada"), color: attColor, bar: attSeason.pct },
    ...(playerMode ? [] : [{ k: "nota", n: tot.rating == null ? "–" : fmt.num(tot.rating), label: t("valoración"), sub: tot.ratedN ? t("media de {n} partidos", { n: tot.ratedN }) : t("sin valorar"), color: AMBER }]),
  ];
  const chipDark = { fontSize: 12, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,.14)", whiteSpace: "nowrap" };
  const ph = mobile ? 62 : 86;
  const ghostBtn = { fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.3)", background: "none", color: "#fff", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" };
  const ini = `${player.first_name?.[0] || ""}${player.last_name?.[0] || ""}`.toUpperCase();
  const backTo = perms.players === "all" || playerMode ? "/Players" : "/MyTeam/Squad";

  return (
    <Page testId="player-profile">
      <div className="rs2-wrap flex flex-col" style={{ gap: 12, maxWidth: 1440 }}>
        {/* ── CABECERA ── */}
        <section className="rs2-band" style={{ borderRadius: 14, padding: mobile ? 12 : "14px 18px", overflow: "hidden" }} data-testid="profile-band">
          <div className="flex flex-wrap items-center" style={{ gap: mobile ? 14 : 18 }}>
            <div className="relative group shrink-0" style={{ width: ph, height: ph }}>
              <div style={{ width: ph, height: ph, borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,.12)", border: "2px solid rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {player.photo_url ? <img src={player.photo_url} alt={playerFullName(player)} className="w-full h-full object-cover" />
                  : <span className="rs2-display" style={{ fontSize: mobile ? 24 : 32, color: "rgba(255,255,255,.85)" }}>{ini || <User className="w-8 h-8" />}</span>}
              </div>
              {staffEdit && (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" style={{ borderRadius: 14 }} aria-label={t("Cambiar foto")}>
                  {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              {player.jersey_number && (
                <span className="rs2-display" data-testid="profile-dorsal" style={{ position: "absolute", right: -8, bottom: -8, background: RS.naranja, color: "#fff", fontSize: mobile ? 16 : 22, borderRadius: mobile ? 8 : 10, padding: mobile ? "3px 6px" : "5px 8px", border: `2px solid ${RS.granateDark}`, lineHeight: 1 }}>{player.jersey_number}</span>
              )}
            </div>

            <div style={{ flex: mobile ? "1 1 200px" : "1 1 320px", minWidth: 0 }}>
              <div className="flex flex-wrap items-center" style={{ gap: 6, fontSize: 12, color: "rgba(255,255,255,.8)" }}>
                <Link to={backTo} onClick={(e) => { if (!playerMode && window.history.state?.idx > 0) { e.preventDefault(); navigate(-1); } }} style={{ color: "#fff" }} data-testid="profile-back">‹ {perms.players === "all" || playerMode ? t("Jugadores") : t("Plantilla")}</Link>
                {team && <><span>·</span><span>{team.name}</span></>}
                {team?.category && team.category !== team.name && <span style={{ opacity: 0.8 }}>· {team.category}</span>}
              </div>
              <h1 style={{ margin: "4px 0 6px" }}>
                <span className="rs2-display" style={{ fontSize: mobile ? 28 : 38, lineHeight: 1, color: "#fff" }}><span className="rs2-display" style={{ color: RS.naranja }}>{playerFirstName(player)}</span> {player.last_name}</span>
              </h1>
              <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
                {player.position && <span style={{ ...chipDark, background: "#fff", color: RS.granate, fontWeight: 700 }}>{posName(player.position)}</span>}
                {getExtraPositions(player).length > 0 && <span style={chipDark}>{t("también")} {getExtraPositions(player).map((e) => posName(e.position)).join(" · ")}</span>}
                {year && <YearBadge year={year} sm />}
                {player.laterality && <span style={chipDark}>{LATERALITY_LABELS[player.laterality] ? t(LATERALITY_LABELS[player.laterality]) : player.laterality}</span>}
                {countryOf(player) && <span style={chipDark}><Flag player={player} /></span>}
                <span data-testid="profile-status" style={{ ...chipDark, fontWeight: 700, borderRadius: 999, background: st.bg, color: st.fg }}>● {t(st.label)}</span>
                {acc && <span style={chipDark} data-testid="profile-account">{t("Cuenta")}: {t(ACCOUNT_LABEL[acc])}</span>}
              </div>
            </div>

            <div className={mobile ? "flex flex-wrap items-center justify-between w-full" : "flex flex-col items-end"} style={{ gap: 8, marginLeft: "auto" }}>
              {!playerMode && nb.total > 1 && (
                <div className="flex" style={{ gap: 6 }}>
                  <button type="button" style={{ ...ghostBtn, opacity: nb.prev ? 1 : 0.4 }} disabled={!nb.prev} onClick={() => go(nb.prev)} data-testid="profile-prev" title={t("Jugador anterior de su equipo")}>‹ {nb.prev ? playerFirstName(nb.prev) : ""}</button>
                  <span style={{ fontSize: 11, alignSelf: "center", opacity: 0.75 }}>{nb.index + 1}/{nb.total}</span>
                  <button type="button" style={{ ...ghostBtn, opacity: nb.next ? 1 : 0.4 }} disabled={!nb.next} onClick={() => go(nb.next)} data-testid="profile-next-player" title={t("Jugador siguiente de su equipo")}>{nb.next ? playerFirstName(nb.next) : ""} ›</button>
                </div>
              )}
              {staffEdit && (
                <div className="flex" style={{ gap: 6 }}>
                  <button type="button" style={{ ...ghostBtn, background: "rgba(255,255,255,.1)", fontWeight: 600 }} onClick={() => setEditDialogOpen(true)} data-testid="profile-edit"><Pencil className="w-3.5 h-3.5" />{t("Editar")}</button>
                  <button type="button" style={{ ...ghostBtn, fontWeight: 600 }} onClick={() => setDeleteConfirm(true)} data-testid="profile-delete"><Trash2 className="w-3.5 h-3.5" />{t("Eliminar")}</button>
                </div>
              )}
            </div>
          </div>
        </section>

        {nextInjury && (
          <button type="button" onClick={() => can("injuries") && setTab("injuries")} className="flex items-center text-left" data-testid="profile-injury-bar"
            style={{ gap: 8, padding: "7px 12px", borderRadius: 10, fontSize: 12, background: "#FEF2F2", color: LOSS, border: "1px solid #FECACA" }}>
            <HeartPulse className="w-4 h-4 shrink-0" />
            <span className="truncate">
              <b>{t("Lesión activa")}</b>{nextInjury.type ? `: ${labelOf(INJURY_TYPE_LABELS, nextInjury.type, t).toLowerCase()}` : ""}{nextInjury.body_part ? ` · ${labelOf(BODY_PART_LABELS, nextInjury.body_part, t).toLowerCase()}` : ""}
              {nextInjury.expected_return ? ` · ${t("alta prevista")} ${new Date(nextInjury.expected_return).toLocaleDateString(fmt.tag, { day: "numeric", month: "short" })}` : ""}
              {activeInjuries.length > 1 ? ` (+${activeInjuries.length - 1})` : ""}
            </span>
          </button>
        )}

        {/* ── RESUMEN DE LA TEMPORADA ── */}
        <div className="grid" style={{ gridTemplateColumns: mobile ? "repeat(3, minmax(0, 1fr))" : "repeat(auto-fit, minmax(128px, 1fr))", gap: mobile ? 6 : 8 }} data-testid="profile-kpis">
          {kpis.map((k) => (
            <div key={k.k} className="rs2-card" style={{ padding: mobile ? "6px 8px" : "8px 12px", textAlign: mobile ? "center" : undefined }} data-testid={`profile-kpi-${k.k}`} title={k.title}>
              <div className={mobile ? "flex flex-col items-center" : "flex items-baseline"} style={{ gap: mobile ? 2 : 6 }}>
                <span className="rs2-display tabular-nums" style={{ fontSize: mobile ? 22 : 26, lineHeight: 1, color: k.color || RS.granate }}>{k.n}</span>
                <span style={{ fontSize: mobile ? 10 : 12, color: mobile ? RS.muted : RS.ink2 }}>{k.label}</span>
              </div>
              {k.sub && !mobile && <div style={{ fontSize: 11, color: RS.muted, marginTop: 2 }}>{k.sub}</div>}
              {k.bar != null && !mobile && <div style={{ height: 5, background: RS.lineSoft, borderRadius: 9, marginTop: 5, overflow: "hidden" }}><div style={{ width: `${Math.min(100, k.bar)}%`, height: "100%", background: k.color, borderRadius: 9 }} /></div>}
            </div>
          ))}
        </div>

        {/* ── PESTAÑAS ── */}
        <nav role="tablist" aria-label={t("Secciones de la ficha")} className="rs2-card flex" style={{ gap: 2, padding: 4, overflowX: "auto" }}>
          {visibleTabs.map((tb) => {
            const on = tab === tb.value;
            return (
              <button key={tb.value} type="button" role="tab" aria-selected={on} onClick={() => setTab(tb.value)} data-testid={`profile-tab-${tb.value}`}
                style={{ flex: 1, whiteSpace: "nowrap", fontSize: 13, fontWeight: on ? 700 : 500, padding: "7px 12px", borderRadius: 9, border: 0, background: on ? RS.granate : "none", color: on ? "#fff" : RS.ink2 }}>
                {t(tb.label)}{tb.n ? <span style={{ fontSize: 10, marginLeft: 5, opacity: 0.75, color: !on && tb.alert ? LOSS : undefined, fontWeight: tb.alert ? 800 : undefined }}>{tb.n}</span> : null}
              </button>
            );
          })}
        </nav>

        <div role="tabpanel">
          {tab === "resumen" && (
            <ProfileSummary player={player} team={team} footMode={footMode} rows={rows} next={next} attWin={attWin} attStrip={attStrip}
              injuries={playerInjuries} showFamilies={authUser?.role === "admin" || playerMode} showPdi={can("pdi")} can={can} onGoTab={(x) => can(x) && setTab(x)} />
          )}

          {tab === "stats" && (
            <div className="space-y-4">
              <PlayerPerformancePanel playerId={playerId} />
              {playerMode ? <PlayerMatchesReadOnly playerId={playerId} /> : <MatchStatsSection playerId={playerId} isGoalkeeper={isGK} readOnly={!staffEdit} />}
              {!playerMode && <PlayerCorrectionsSection playerId={playerId} teamId={player.team_id} />}
            </div>
          )}

          {tab === "entrenos" && (
            <div className="space-y-4">
              <AttendanceHistorySection attendance={playerAttendance} injuries={playerInjuries} />
              {!playerMode && perms.load !== "none" && <TrainingLoadSection playerId={playerId} />}
            </div>
          )}

          {tab === "pdi" && can("pdi") && (
            <div className="space-y-6">
              <Evaluation360Section player={player} playerId={playerId} team={team} />
              <PDIPlanSection player={player} team={team} />
              {!playerMode && <details className="bg-white border border-gray-200 rounded-2xl shadow-sm">
                <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-gray-600">{t("Evaluaciones antiguas (texto libre)")}</summary>
                <div className="px-4 pb-4">
                  <PDISection readOnly playerId={playerId} playerName={`${playerFullName(player)}`} playerEmail={player.email} />
                </div>
              </details>}
            </div>
          )}

          {tab === "injuries" && can("injuries") && (
            playerMode || perms.medical !== "edit" ? <PlayerInjuriesReadOnly playerId={playerId} /> : <div className="space-y-4">
              <Button variant="club" onClick={() => setInjuryDialogOpen(true)} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> {t("Registrar lesión")}
              </Button>
              <InjurySection playerId={playerId} playerName={`${playerFullName(player)}`} playerEmail={player.email} staffEmails={staffEmails} />
            </div>
          )}

          {tab === "documents" && can("documents") && (
            playerMode || perms.medical !== "edit" ? <PlayerDocumentsReadOnly playerId={playerId} /> : <DocumentsSection playerId={playerId} />
          )}

          {tab === "historial" && (!staffEdit ? <PlayerHistoryReadOnly playerId={playerId} /> : <PlayerSeasonHistorySection playerId={playerId} />)}
        </div>
      </div>

      {/* Dialogs */}
      <ImageCropDialog open={cropDialogOpen} onOpenChange={setCropDialogOpen} imageSrc={selectedImageSrc} onConfirm={handleCropConfirm} isLoading={uploading} />
      <AddPlayerDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} teamId={player.team_id} editingPlayer={player} />
      {injuryDialogOpen && <InjuryRegistrationDialog playerId={playerId} onClose={() => setInjuryDialogOpen(false)} />}

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("¿Eliminar jugador?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Se eliminará a {nombre} y todos sus datos. Esta acción no se puede deshacer.", { nombre: playerFullName(player) })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-red-600 hover:bg-red-700 text-white">{t("Eliminar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}