import React, { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CLUB_LOGO_URL_WHITE } from "@/lib/clubConfig";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import ConvocationTab from "@/components/match/ConvocationTab";
import ActaTab from "@/components/match/ActaTab";
import TacticaTab from "@/components/match/TacticaTab";
import PostMatchTab from "@/components/match/PostMatchTab";
import EditEventDialog from "@/components/myteam/EditEventDialog";
import { MatchHeader, MatchStepsNav } from "@/components/match/MatchHeader";
import { matchPlayerIds, withGuests } from "@/lib/matchPlayers";
import { Page } from "@/components/rs2/kit";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT } from "@/i18n";
import { matchFormat, minPlayersOf } from "@/lib/matchFormat";
import { pendingReasons } from "@/lib/matchStatus";
import { matchSteps, matchPlayed, STEP_KEYS } from "@/lib/matchSteps";
import { findRival } from "@/lib/myTeamStats";

export default function MatchDetail() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const mobile = useIsMobile();
  const params = new URLSearchParams(location.search);
  const { canManageTeam } = useTeamAccess();
  const eventId = params.get("id");
  const teamId = params.get("teamId");

  const [activeTab, setActiveTabState] = useState(STEP_KEYS.includes(params.get("tab")) ? params.get("tab") : null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // El paso elegido queda en la dirección (?tab=) para volver al mismo sitio
  const setActiveTab = (key) => {
    setActiveTabState(key);
    const q = new URLSearchParams(location.search);
    q.set("tab", key);
    navigate({ search: q.toString() }, { replace: true });
  };

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => base44.entities.Event.filter({ id: eventId }).then(evts => evts[0] ?? null),
    enabled: !!eventId,
  });

  const { data: teamPlayers = [] } = useQuery({
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
  const { data: plan } = useQuery({
    queryKey: ["matchplan", eventId],
    queryFn: () => base44.entities.MatchPlan.filter({ event_id: eventId }).then(d => d[0] || null),
    enabled: !!eventId,
  });
  const { data: evStats = [] } = useQuery({
    queryKey: ["matchstats-event", eventId],
    queryFn: () => base44.entities.MatchStats.filter({ event_id: eventId }),
    enabled: !!eventId,
  });
  // Clasificación de la FCF (para el puesto y la racha del rival)
  const { data: standing } = useQuery({
    queryKey: ["fcf-standing", teamId],
    queryFn: async () => {
      const r = await fetch(`/api/sync-fcf?standings=${teamId}`, { credentials: "include" });
      if (!r.ok) throw new Error("error");
      return r.json();
    },
    enabled: !!teamId,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  // Jugadores del partido = plantilla + invitados de otros equipos del club (convocados, titulares o en el acta)
  const guestIds = useMemo(() => matchPlayerIds(convocation, event), [convocation, event]);
  const needsGuests = [...guestIds].some((id) => !teamPlayers.some((p) => p.id === id));
  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
    enabled: needsGuests,
  });
  const players = useMemo(() => withGuests(teamPlayers, allPlayers, guestIds), [teamPlayers, allPlayers, guestIds]);

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

  const steps = useMemo(() => {
    if (!event) return [];
    const now = new Date();
    const pending = matchPlayed(event, now) ? pendingReasons(event, convocation, evStats, team) : [];
    return matchSteps({ event, conv: convocation, plan, stats: evStats, pending, minPlayers: minPlayersOf(event, team), now });
  }, [event, convocation, plan, evStats, team]);

  if (eventLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[var(--granate)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">{t("Partido no encontrado")}</p>
        <Button onClick={() => navigate(-1)} className="mt-4">{t("Volver")}</Button>
      </div>
    );
  }

  // Sin paso elegido en la dirección: se abre el que toca ahora
  const tab = activeTab || steps.find((s) => s.state === "now")?.key || (matchPlayed(event) ? "acta" : "convocatoria");
  const canManage = canManageTeam(teamId);
  const standRows = standing?.rows || [];
  const rival = event.opponent ? findRival(standRows.filter((r) => r.teamId !== standing?.ourTeamId), event.opponent) : null;

  return (
    <Page testId="match-detail">
      <div className="rs2-wrap flex flex-col" style={{ gap: 12, maxWidth: 1440, paddingBottom: mobile ? 90 : undefined }}>
        <MatchHeader
          event={event} team={team} players={players} mobile={mobile}
          ourLogo={team?.logo_url || CLUB_LOGO_URL_WHITE} rival={rival} canManage={canManage}
          onBack={() => navigate(-1)}
          onSheet={() => setActiveTab("tactica")}
          onEdit={() => setEditOpen(true)}
          onDelete={() => setConfirmDelete(true)}
          onRivalLogo={(url) => updateLogoMutation.mutate({ opponent_logo_url: url })}
        />

        <MatchStepsNav steps={steps} active={tab} onChange={setActiveTab} mobile={mobile} />

        {!canManage && (
          <div className="px-3 py-2 rounded-md text-xs font-semibold border border-orange-200 bg-orange-50 text-orange-800">
            {t("Solo lectura: solo los entrenadores de este equipo, la Dirección Deportiva y la administración pueden gestionar la convocatoria, el acta y la táctica.")}
          </div>
        )}
        <div {...(!canManage ? { inert: "", style: { pointerEvents: "none", opacity: 0.92 } } : {})}>
          {tab === "convocatoria" && (
            <ConvocationTab eventId={eventId} teamId={teamId} event={event} players={players} team={team} />
          )}
          {tab === "acta" && (
            <ActaTab eventId={eventId} teamId={teamId} event={event} players={players} team={team} onGoto={setActiveTab} />
          )}
          {tab === "tactica" && (
            <TacticaTab
              event={event}
              players={players}
              convocadoIds={convocation?.player_ids || []}
              starterIds={convocation?.starters || []}
              footballFormat={matchFormat(event, team)}
              team={team}
            />
          )}
          {tab === "postpartido" && (
            <PostMatchTab eventId={eventId} teamId={teamId} event={event} players={players} convocation={convocation} team={team} />
          )}
        </div>
      </div>

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
            <AlertDialogTitle>{t("¿Eliminar partido?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Esta acción no se puede deshacer.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteEventMutation.mutate()} className="bg-red-600 hover:bg-red-700 text-white">{t("Eliminar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
