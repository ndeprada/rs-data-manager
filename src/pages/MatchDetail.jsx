import React, { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2, Users, FileText, Map, Pencil, Upload, MapPin, Calendar } from "lucide-react";
import { CLUB_LOGO_URL, CLUB_LOGO_URL_WHITE } from "@/lib/clubConfig";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import ConvocationTab from "@/components/match/ConvocationTab";
import ActaTab from "@/components/match/ActaTab";
import TacticaTab from "@/components/match/TacticaTab";
import EditEventDialog from "@/components/myteam/EditEventDialog";
import { playerFullName } from "@/lib/playerName";

function Shield({ src, name, canUpload, onUpload }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onUpload(file_url);
    setUploading(false);
  };

  return (
    <div className="flex flex-col items-center gap-1 relative group">
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex items-center justify-center border-2 border-white/20 bg-white/10 relative">
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-contain p-1.5" />
        ) : (
          <span className="text-3xl font-black text-white/30" style={{ fontFamily: "var(--font-display)" }}>
            {name?.[0] || "?"}
          </span>
        )}
        {canUpload && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 rounded-2xl"
              title="Subir escudo del rival"
            >
              {uploading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Upload className="w-4 h-4 text-white" /><span className="text-[9px] text-white font-bold uppercase tracking-wide">Subir</span></>
              }
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </>
        )}
      </div>
      <p className="text-[10px] uppercase tracking-wider text-white/55 font-bold text-center max-w-[110px] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
        {name}
      </p>
    </div>
  );
}

export default function MatchDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const params = new URLSearchParams(location.search);
  const eventId = params.get("id");
  const teamId = params.get("teamId");

  const [activeTab, setActiveTab] = useState("convocatoria");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => base44.entities.Event.filter({ id: eventId }).then(evts => evts[0] ?? null),
    enabled: !!eventId,
  });

  const { data: players = [] } = useQuery({
    queryKey: ["teamPlayers", teamId],
    queryFn: () => base44.entities.Player.filter({ team_id: teamId }),
    enabled: !!teamId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });
  const team = teams.find(t => t.id === teamId);

  const { data: convocation } = useQuery({
    queryKey: ["convocatoria", eventId],
    queryFn: () => base44.entities.Convocatoria.filter({ event_id: eventId }).then(d => d[0] || null),
    enabled: !!eventId,
  });

  const updateLogoMutation = useMutation({
    mutationFn: (data) => base44.entities.Event.update(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: () => base44.entities.Event.delete(eventId),
    onSuccess: () => navigate(-1),
  });

  if (eventLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Partido no encontrado</p>
        <Button onClick={() => navigate(-1)} className="mt-4">Volver</Button>
      </div>
    );
  }

  const eventDate = event.date ? new Date(event.date) : null;
  const scoreHome = event.score_home;
  const scoreAway = event.score_away;
  const hasScore = scoreHome !== null && scoreHome !== undefined && scoreAway !== null && scoreAway !== undefined;
  const diff = hasScore ? Number(scoreHome) - Number(scoreAway) : null;
  const resultLabel  = diff !== null ? (diff > 0 ? "VICTORIA" : diff < 0 ? "DERROTA" : "EMPATE") : null;
  const resultBg     = diff !== null ? (diff > 0 ? "rgba(22,163,74,0.18)" : diff < 0 ? "rgba(220,38,38,0.18)" : "rgba(202,138,4,0.18)") : null;
  const resultBorder = diff !== null ? (diff > 0 ? "rgba(22,163,74,0.5)"  : diff < 0 ? "rgba(220,38,38,0.5)"  : "rgba(202,138,4,0.5)")  : null;
  const resultText   = diff !== null ? (diff > 0 ? "#4ade80" : diff < 0 ? "#f87171" : "#fbbf24") : null;

  const isHome = event.is_home !== false;
  const ourTeamName  = team?.name || "Nosotros";
  const rivalName    = event.opponent || "Rival";
  const ourLogoUrl   = team?.logo_url || CLUB_LOGO_URL_WHITE;
  const rivalLogoUrl = event.opponent_logo_url;

  const displayLeft  = isHome ? scoreHome : scoreAway;
  const displayRight = isHome ? scoreAway : scoreHome;

  const goalEvents = event.goal_events || [];
  const ourGoals   = goalEvents.filter(g => g.team === "home").sort((a, b) => a.minute - b.minute);
  const theirGoals = goalEvents.filter(g => g.team === "away").sort((a, b) => a.minute - b.minute);

  const typeLabel = event.type === "partido_liga" ? "Liga" : event.type === "partido_amistoso" ? "Amistoso" : "Torneo";

  const TABS = [
    { key: "convocatoria", label: "Convocatoria",        icon: Users },
    { key: "acta",         label: "Acta",                icon: FileText },
    { key: "tactica",      label: "Preparación partido", icon: Map },
  ];

  return (
    <div className="space-y-0">
      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden rounded-2xl mb-4" style={{ background: "linear-gradient(160deg, #4a1219 0%, #2a0a0e 60%, #1a0608 100%)" }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full blur-3xl opacity-15" style={{ background: "radial-gradient(circle, #e67e22, transparent)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 15% 85%, rgba(107,31,40,0.35) 0%, transparent 55%)" }} />

        <div className="relative px-4 pt-3 pb-3">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-white/60 hover:text-white text-xs font-semibold transition-colors">
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-white/15 text-white/55">
                {typeLabel}
              </span>
              <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white border border-white/15 hover:border-white/30 transition-all">
                <Pencil className="w-3 h-3" /> Editar
              </button>
              <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-red-400/80 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* ── MARCADOR COMPACTO: [equipo + goleadores] [resultado] [equipo + goleadores] ── */}
          {(() => {
            const ours = ourGoals.map((g, i) => {
              const scorer = players.find(p => p.id === g.player_id);
              return { k: "o" + i, minute: g.minute, label: scorer ? `${playerFullName(scorer)}` : (g.goal_type === "gol_propio" ? "Propia puerta" : "—") };
            });
            const theirs = theirGoals.map((g, i) => {
              const ev = (event.match_events || []).find(e => e.id === g.id);
              return { k: "t" + i, minute: g.minute, label: ev?.fcfName || "" };
            });
            const leftList = isHome ? ours : theirs;
            const rightList = isHome ? theirs : ours;
            const leftShield = isHome
              ? <Shield src={ourLogoUrl} name={ourTeamName} canUpload={false} onUpload={() => {}} />
              : <Shield src={rivalLogoUrl} name={rivalName} canUpload={true} onUpload={(url) => updateLogoMutation.mutate({ opponent_logo_url: url })} />;
            const rightShield = isHome
              ? <Shield src={rivalLogoUrl} name={rivalName} canUpload={true} onUpload={(url) => updateLogoMutation.mutate({ opponent_logo_url: url })} />
              : <Shield src={ourLogoUrl} name={ourTeamName} canUpload={false} onUpload={() => {}} />;
            return (
              <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 items-start">
                <div className="flex flex-col items-center gap-1.5 min-w-0">
                  {leftShield}
                  <div className="flex flex-col items-center gap-0.5 w-full">
                    {leftList.map(g => (
                      <span key={g.k} className="text-[10px] text-white/60 leading-snug text-center">⚽ {g.label} <span className="text-white/35">{g.minute}'</span></span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5 pt-2">
                  <div className="flex items-center gap-1">
                    <span className="text-5xl font-black text-white leading-none" style={{ fontFamily: "var(--font-display)" }}>{hasScore ? displayLeft : "–"}</span>
                    <span className="text-xl font-black leading-none text-white/20">:</span>
                    <span className="text-5xl font-black text-white leading-none" style={{ fontFamily: "var(--font-display)" }}>{hasScore ? displayRight : "–"}</span>
                  </div>
                  {resultLabel ? (
                    <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border" style={{ color: resultText, background: resultBg, borderColor: resultBorder }}>{resultLabel}</span>
                  ) : (
                    <span className="text-[9px] text-white/30 uppercase tracking-wider">Sin resultado</span>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1.5 min-w-0">
                  {rightShield}
                  <div className="flex flex-col items-center gap-0.5 w-full">
                    {rightList.map(g => (
                      <span key={g.k} className="text-[10px] text-white/60 leading-snug text-center"><span className="text-white/35">{g.minute}'</span> ⚽ {g.label}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Meta info */}
          <div className="flex items-center justify-center gap-4 mt-2 flex-wrap">
            {eventDate && (
              <div className="flex items-center gap-1.5 text-white/40 text-[11px]">
                <Calendar className="w-3.5 h-3.5" />
                <span>{format(eventDate, "EEE d MMM yyyy · HH:mm", { locale: es })}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-1.5 text-white/40 text-[11px]">
                <MapPin className="w-3.5 h-3.5" />
                <span>{event.location}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                isActive ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
              }`}
              style={isActive ? { background: "var(--granate)" } : {}}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── CONTENT ── */}
      {activeTab === "convocatoria" && (
        <ConvocationTab eventId={eventId} teamId={teamId} event={event} players={players} team={team} />
      )}
      {activeTab === "acta" && (
        <ActaTab eventId={eventId} teamId={teamId} event={event} players={players} />
      )}
      {activeTab === "tactica" && (
        <TacticaTab
          event={event}
          players={players}
          convocadoIds={convocation?.player_ids || []}
          starterIds={convocation?.starters || []}
          footballFormat={event?.football_format}
        />
      )}

      {/* ── DIALOGS ── */}
      <EditEventDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) queryClient.invalidateQueries({ queryKey: ["event", eventId] });
        }}
        event={event}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar partido?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteEventMutation.mutate()} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}