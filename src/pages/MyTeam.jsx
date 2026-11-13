// Mi equipo · Panel. Rediseño del 13/11/2026 con el diseño «rs2» (maqueta «Maqueta Mi equipo · RS Manager», aprobada por
// Nacho: «ok»). Piezas en src/components/myteam/MyTeamCards.jsx; cálculos puros en src/lib/myTeamStats.js.
import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { useSelectedTeam } from "@/lib/useSelectedTeam";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import CreateEventDialog from "@/components/myteam/CreateEventDialog";
import AddPlayerDialog from "@/components/team/AddPlayerDialog";
import EditEventDialog from "@/components/myteam/EditEventDialog";
import TeamAlerts from "@/components/myteam/TeamAlerts";
import CalendarSubscribe from "@/components/calendar/CalendarSubscribe";
import { getCategoryLabel } from "@/components/fcfCategories";
import { TeamSelectTrigger } from "@/components/myteam/TeamPageHeader";
import { isCancelled } from "@/lib/eventCancel";
import { useMatchStatus } from "@/lib/matchStatus";
import { useTrainingStatus } from "@/lib/trainingStatus";
import { useSquadRows } from "@/lib/useSquadRows";
import { seasonRecord, attendanceSummary } from "@/lib/dashboardStats";
import { findRival, playerAttendance, unavailable } from "@/lib/myTeamStats";
import { playerFullName } from "@/lib/playerName";
import { Page, RS } from "@/components/rs2/kit";
import { NextMatchBand, KpiRow, TeamWeek, MiniStanding, SquadCompact, MatchesCard, TeamLeaders, MATCH_TYPES } from "@/components/myteam/MyTeamCards";
import { useT } from "@/i18n";

const PILL_MAX = 4; // con más equipos para elegir, desplegable en vez de botones

export default function MyTeam() {
  const t = useT();
  const { selectedTeamId, selectTeam, isCoordinator, canSwitch, teamIds: myTeamIds } = useSelectedTeam();
  const { canManageTeam } = useTeamAccess();

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: convocs = [] } = useQuery({ queryKey: ["convocatorias_all"], queryFn: () => base44.entities.Convocatoria.list() });
  const { data: standing } = useQuery({
    queryKey: ["fcf-standing", selectedTeamId],
    queryFn: async () => {
      const r = await fetch(`/api/sync-fcf?standings=${selectedTeamId}`, { credentials: "include" });
      if (!r.ok) throw new Error("error");
      return r.json();
    },
    enabled: !!selectedTeamId,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
  const { pending: pendingMatches } = useMatchStatus();
  const { pending: pendingTr } = useTrainingStatus();
  const { rows, guests } = useSquadRows(selectedTeamId);

  const [createEventDate, setCreateEventDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);

  const team = teams.find((x) => x.id === selectedTeamId);
  const canManage = !!selectedTeamId && canManageTeam(selectedTeamId);
  const teamPlayers = players.filter((p) => p.team_id === selectedTeamId && p.status !== "baja");
  const teamEvents = useMemo(() => events.filter((e) => e.team_id === selectedTeamId), [events, selectedTeamId]);
  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const cancelledIds = useMemo(() => new Set(teamEvents.filter(isCancelled).map((e) => e.id)), [teamEvents]);

  const now = new Date();
  const matches = teamEvents.filter((e) => MATCH_TYPES.includes(e.type));
  const upcoming = matches.filter((e) => new Date(e.date) >= now && !isCancelled(e)).sort((a, b) => new Date(a.date) - new Date(b.date));
  const next = upcoming[0];
  const nextConv = next ? convocs.find((c) => c.event_id === next.id) : null;
  const played = matches.filter((e) => e.score_home != null && e.score_away != null);
  const lastPlayed = matches.filter((e) => new Date(e.date) < now).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
  const rec = seasonRecord(played);

  const standRows = standing?.rows || [];
  const me = standRows.find((r) => r.teamId === standing?.ourTeamId) || null;
  const rival = next?.opponent ? findRival(standRows.filter((r) => r.teamId !== standing?.ourTeamId), next.opponent) : null;

  const att = useMemo(() => attendanceSummary(attendance, eventsById, { now, skip: cancelledIds, inScope: (id) => id === selectedTeamId, minRecords: 3 }),
    [attendance, eventsById, cancelledIds, selectedTeamId]);  
  const lowAtt = useMemo(() => playerAttendance(attendance, eventsById, { now, playerIds: teamPlayers.map((p) => p.id), skip: cancelledIds })
    .filter((x) => x.rate < 80).slice(0, 2)
    .map((x) => ({ ...x, name: playerFullName(players.find((p) => p.id === x.player_id) || {}) })),
  [attendance, eventsById, teamPlayers.length, cancelledIds]);  

  const out = unavailable({ players: teamPlayers, injuries: rows.map((r) => r.injury).filter(Boolean), conv: nextConv });
  const outById = new Map(out.map((u) => [u.player.id, u]));
  const squad = {
    total: rows.length,
    available: rows.length - out.length,
    injured: out.filter((u) => u.reason === "lesion" || u.reason === "enfermo").length,
    sanctioned: out.filter((u) => u.reason === "sancion").length,
    other: out.filter((u) => !["lesion", "enfermo", "sancion"].includes(u.reason)).length,
    guests: guests.length,
  };

  const switchable = teams.filter((x) => isCoordinator || (myTeamIds || []).includes(x.id));

  if (!selectedTeamId) {
    return (
      <Page testId="myteam">
        <div className="rs2-wrap flex flex-col" style={{ gap: 12, maxWidth: 1440 }}>
          <h1 style={{ margin: 0 }}><span className="rs2-display" style={{ fontSize: 34, color: RS.granate }}>{t("Mi Equipo")}</span></h1>
          {isCoordinator ? (
            <div className="rs2-card" style={{ padding: 32, textAlign: "center" }}>
              <Shield className="w-10 h-10 mx-auto mb-3" style={{ color: RS.faint }} />
              <p style={{ color: RS.muted, marginBottom: 16 }}>{t("Selecciona un equipo para ver su panel")}</p>
              <div className="flex justify-center">
                <Select value="" onValueChange={selectTeam}>
                  <TeamSelectTrigger />
                  <SelectContent>{teams.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          ) : <p style={{ color: RS.muted }}>{t("No tienes un equipo asignado. Contacta con el coordinador.")}</p>}
        </div>
      </Page>
    );
  }

  const kicker = [t("Mi equipo"), getCategoryLabel(team?.category), standing?.competition && [standing.competition, standing.group].filter(Boolean).join(" "), team?.coach && t("Entrenador: {name}", { name: team.coach })].filter(Boolean).join(" · ");

  return (
    <Page testId="myteam">
      <div className="rs2-wrap flex flex-col" style={{ gap: 12, maxWidth: 1440 }}>
        <EditEventDialog open={!!editingEvent} onOpenChange={(o) => { if (!o) setEditingEvent(null); }} event={editingEvent} />
        <CreateEventDialog open={!!createEventDate} onOpenChange={(o) => { if (!o) setCreateEventDate(null); }} date={createEventDate} teamId={selectedTeamId} />
        <AddPlayerDialog open={addPlayerOpen} onOpenChange={setAddPlayerOpen} teamId={selectedTeamId} />

        {/* Cabecera */}
        <div className="flex flex-wrap items-end" style={{ gap: 12 }}>
          <div className="min-w-0">
            <p className="rs2-label truncate" style={{ letterSpacing: ".14em", textTransform: "uppercase" }}>{kicker}</p>
            <h1 style={{ margin: "2px 0 0" }}><span className="rs2-display" style={{ fontSize: 34, color: RS.granate }}>{team?.name || "—"}</span></h1>
          </div>
          <div className="flex flex-wrap items-center" style={{ marginLeft: "auto", gap: 8 }}>
            {canSwitch && switchable.length > 1 && (switchable.length <= PILL_MAX ? (
              <div className="flex" style={{ gap: 4, background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 999, padding: 3 }} role="group" aria-label={t("Equipo")} data-testid="team-switch">
                {switchable.map((x) => (
                  <button key={x.id} type="button" onClick={() => selectTeam(x.id)} aria-pressed={x.id === selectedTeamId}
                    style={{ fontSize: 12, fontWeight: x.id === selectedTeamId ? 700 : 400, padding: "5px 12px", borderRadius: 999, border: 0, background: x.id === selectedTeamId ? RS.granate : "none", color: x.id === selectedTeamId ? "#fff" : RS.ink2 }}>{x.name}</button>
                ))}
              </div>
            ) : (
              <Select value={selectedTeamId} onValueChange={(v) => v && selectTeam(v)}>
                <TeamSelectTrigger />
                <SelectContent>{switchable.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
              </Select>
            ))}
            <CalendarSubscribe teamId={selectedTeamId} teamName={team?.name} />
          </div>
        </div>

        {/* Pendientes, horario y cumpleaños */}
        <TeamAlerts teamId={selectedTeamId} players={teamPlayers} />

        {/* Próximo partido */}
        <NextMatchBand next={next} team={team} conv={nextConv} squadSize={rows.length} us={me} rival={rival} out={out} canManage={canManage} />

        {/* Datos */}
        <KpiRow rec={rec} standing={standing} me={me} att={att} lowAtt={lowAtt} squad={squad} />

        {/* Semana + clasificación */}
        <div className="flex flex-wrap items-start" style={{ gap: 12 }}>
          <TeamWeek events={teamEvents} attendance={attendance} pendingTr={pendingTr} canManage={canManage} onCreate={setCreateEventDate} onEdit={setEditingEvent} />
          <MiniStanding standing={standing} />
        </div>

        {/* Plantilla + partidos y líderes */}
        <div className="flex flex-wrap items-start" style={{ gap: 12 }}>
          <SquadCompact rows={rows} outById={outById} canManage={canManage} onAddPlayer={() => setAddPlayerOpen(true)} />
          <div className="flex flex-col" style={{ flex: "1 1 320px", minWidth: 0, gap: 12 }}>
            <MatchesCard played={lastPlayed} upcoming={upcoming.slice(0, 3)} pending={pendingMatches} />
            <TeamLeaders rows={rows} />
          </div>
        </div>
      </div>
    </Page>
  );
}
