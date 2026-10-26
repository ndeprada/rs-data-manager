import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Binoculars, ChevronsUp, Eye, FileDown, Network, Target } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { playerFullName } from "@/lib/playerName";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import {
  nextSeason, buildPlan, buildPassSummary, zoneByKey, zoneTitle, moveChange, withMovedItem, playerPatch, isBlankPlayerPatch, GROUPS,
} from "@/lib/squadPlan";
import SquadPitch from "./SquadPitch";
import { usePlanDrag, DragGhost } from "./usePlanDrag";
import { ItemDialog, ZoneDialog, AddTargetDialog, AddClubDialog, ItemRow } from "./SquadPlanDialogs";
import { ClubPassesDialog } from "./SquadPasses";
import { DOT, LEAVE_TAG, PASS_TAG } from "./squadPlanUi";

// Scouting → Planificación: plantilla prevista de cada equipo para la temporada siguiente, en un campo a escala con todos los puestos a la vista
// (ataque a la derecha, o arriba en el móvil). Los jugadores actuales continúan salvo que se marque «duda» o «se va» (baja del club o baja propia);
// los jugadores de las listas de Scouting entran como objetivo o como jugador seguido; cualquier puesto se puede marcar «a reforzar» y la gente se
// arrastra de un puesto a otro (solo en el plan: la ficha del jugador no cambia). Un jugador puede pasar a otro equipo del club («Pasa a X» en su
// equipo y «Viene de X» en el equipo destino, también solo en el plan). Lógica pura en `src/lib/squadPlan.js`.
// Los textos de Scouting siguen en español (traducción pendiente, bloque 5).

function Stat({ label, value, tone, sub }) {
  const cls = {
    green: "text-emerald-700 bg-emerald-50 border-emerald-200", amber: "text-amber-700 bg-amber-50 border-amber-200", red: "text-red-700 bg-red-50 border-red-200",
    sky: "text-sky-700 bg-sky-50 border-sky-200", indigo: "text-indigo-700 bg-indigo-50 border-indigo-200", teal: "text-teal-700 bg-teal-50 border-teal-200",
  }[tone];
  return (
    <div className={`rounded-xl border px-2 py-1.5 text-center ${cls}`}>
      <div className="text-xl font-black leading-none tabular-nums" data-testid={`stat-${tone}`}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide mt-1">{label}</div>
      {sub !== undefined && <div className="text-[10px] leading-tight mt-0.5 opacity-80" data-testid={`stat-${tone}-sub`}>{sub}</div>}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-gray-600" data-testid="plan-legend">
      <span className="inline-flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${DOT.continua}`} />Continúa</span>
      <span className="inline-flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${DOT.duda}`} />Duda</span>
      <span className="inline-flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${DOT.sale}`} />Se va:
        <span className={`rounded px-1 text-[9px] font-extrabold uppercase ${LEAVE_TAG}`}>Baja del club</span>
        <span className={`rounded px-1 text-[9px] font-extrabold uppercase ${LEAVE_TAG}`}>Baja propia</span>
      </span>
      <span className="inline-flex items-center gap-1"><Target className="w-3 h-3 text-sky-600" />Objetivo de scouting</span>
      <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3 text-indigo-500" />Jugador seguido</span>
      <span className="inline-flex items-center gap-1"><ChevronsUp className="w-3 h-3 text-fuchsia-600" />Puesto a reforzar</span>
      <span>↔ Puesto cambiado</span>
      <span className="inline-flex items-center gap-1"><span className={`rounded px-1 text-[9px] font-extrabold uppercase ${PASS_TAG}`}>Pasa a / Viene de</span>otro equipo del club</span>
      <span className="text-red-700 font-bold">✚ Lesionado</span>
    </div>
  );
}

const Card = ({ children, className = "" }) => <div className={`bg-white border border-gray-200 rounded-2xl p-3 shadow-sm ${className}`}>{children}</div>;

export default function SquadPlanning() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const season = nextSeason(CURRENT_SEASON);
  const [teamId, setTeamId] = useState(null);
  const [zoneOpen, setZoneOpen] = useState(null);
  const [itemOpen, setItemOpen] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addZone, setAddZone] = useState(null);
  const [clubOpen, setClubOpen] = useState(false);
  const [clubZone, setClubZone] = useState(null);
  const [passesOpen, setPassesOpen] = useState(false);

  const { data: teams = [], isLoading: loadingTeams } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const team = teams.find((t) => t.id === teamId) || teams[0] || null;
  const tid = team?.id || null;
  const isF7 = teamPlaysF7(team);

  const { data: players = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ["squad-plan-players", tid], enabled: !!tid, queryFn: () => base44.entities.Player.filter({ team_id: tid }),
  });
  const { data: scouted = [] } = useQuery({ queryKey: ["scouted_players"], queryFn: () => base44.entities.ScoutedPlayer.list("-created_date", 500) });
  const entriesKey = ["squad-plan", tid, season];
  const E = base44.entities.SquadPlanEntry;
  // Registros de este equipo + los de otros equipos que pasan a este («viene de…»)
  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: entriesKey, enabled: !!tid,
    queryFn: async () => {
      const [own, incoming] = await Promise.all([E.filter({ team_id: tid, season }), E.filter({ to_team_id: tid, season })]);
      const seen = new Set(own.map((e) => e.id));
      return [...own, ...incoming.filter((e) => !seen.has(e.id))];
    },
  });
  // Los jugadores que llegan de otros equipos (solo hacen falta cuando hay pases hacia este equipo)
  const arrivalIds = useMemo(
    () => entries.filter((e) => e.kind === "player" && e.to_team_id === tid && e.team_id && e.team_id !== tid).map((e) => e.ref_id).sort(),
    [entries, tid],
  );
  const { data: arrivals = [] } = useQuery({
    queryKey: ["squad-plan-arrivals", arrivalIds.join(",")], enabled: arrivalIds.length > 0, placeholderData: (prev) => prev,
    queryFn: async () => (await Promise.all(arrivalIds.map((id) => base44.entities.Player.filter({ id })))).flat(),
  });
  // Para «Traer de otro equipo» y «Pases del club»: todos los jugadores del club y los pases ya hechos esta temporada (solo se piden al abrir esas ventanas)
  const clubData = clubOpen || passesOpen;
  const { data: clubPlayers = [], isLoading: loadingClubPlayers } = useQuery({ queryKey: ["players"], enabled: clubData, queryFn: () => base44.entities.Player.list() });
  const { data: seasonEntries = [], isLoading: loadingSeasonEntries } = useQuery({
    queryKey: ["squad-plan-passes", season], enabled: clubData, queryFn: () => E.filter({ season, kind: "player" }),
  });
  const passes = useMemo(() => new Map(seasonEntries.filter((e) => e.to_team_id).map((e) => [e.ref_id, e.to_team_id])), [seasonEntries]);
  const passSummary = useMemo(() => buildPassSummary({ entries: seasonEntries, players: clubPlayers, teams }), [seasonEntries, clubPlayers, teams]);

  const plan = useMemo(
    () => buildPlan({ players, scouted, entries, arrivals: arrivalIds.length ? arrivals : [], teams, teamId: tid }),
    [players, scouted, entries, arrivals, arrivalIds.length, teams, tid],
  );
  const taken = useMemo(() => new Set(entries.filter((e) => e.kind === "scout").map((e) => e.ref_id)), [entries]);
  const objetivos = plan.items.filter((i) => i.status === "objetivo");
  const seguidos = plan.items.filter((i) => i.status === "seguido");
  const pases = [...plan.items.filter((i) => i.pass === "in"), ...plan.items.filter((i) => i.pass === "out")];
  const { total, groups, sinPosicion } = plan.summary;

  const refresh = () => { // este equipo y los demás (un pase afecta a dos planes) y el resumen de pases del club
    qc.invalidateQueries({ queryKey: ["squad-plan"] });
    qc.invalidateQueries({ queryKey: ["squad-plan-passes"] });
  };
  const fail = (err) => toast({ title: "No se ha podido guardar", description: err?.message || "Inténtalo de nuevo.", variant: "destructive" });

  const savePlayer = useMutation({
    mutationFn: async ({ item, values }) => {
      const patch = playerPatch(values);
      if (item.pass !== "in" && isBlankPlayerPatch(patch)) return item.entryId ? E.delete(item.entryId) : null;
      if (item.entryId) return E.update(item.entryId, patch);
      return E.create({ season, team_id: tid, kind: "player", ref_id: item.id, ...patch });
    },
    onSuccess: () => { refresh(); setItemOpen(null); },
    onError: fail,
  });
  const saveScout = useMutation({
    mutationFn: ({ item, patch }) => E.update(item.entryId, { ...patch, note: String(patch.note || "").trim() }),
    onSuccess: () => { refresh(); setItemOpen(null); },
    onError: fail,
  });
  const removeScout = useMutation({
    mutationFn: (item) => E.delete(item.entryId),
    onSuccess: () => { refresh(); setItemOpen(null); toast({ title: "Quitado del plan." }); },
    onError: fail,
  });
  const addScout = useMutation({
    mutationFn: ({ p, zone, role }) => E.create({
      season, team_id: tid, kind: "scout", ref_id: p.id, role, position: zone?.pos || p.position || null, side: zone?.side || null, note: "",
    }),
    onSuccess: (_d, { role }) => { refresh(); setAddOpen(false); setAddZone(null); setZoneOpen(null); toast({ title: role === "seguido" ? "Jugador seguido añadido al plan." : "Objetivo añadido al plan." }); },
    onError: fail,
  });
  // Quien llega de otro equipo vuelve a quedarse en el suyo: se quita el pase y el puesto que se le había dado aquí
  const cancelPass = useMutation({
    mutationFn: (item) => (item.note ? E.update(item.entryId, { to_team_id: null, status: "continua", leave: null, position: null, side: null }) : E.delete(item.entryId)),
    onSuccess: (_d, item) => { refresh(); setItemOpen(null); toast({ title: `Pase cancelado: ${item.name} sigue en ${item.passTeam.name}.` }); },
    onError: fail,
  });
  // Traer a un jugador de otro equipo: se anota el pase en su registro (se crea si no lo tenía)
  const addClub = useMutation({
    mutationFn: async ({ p, zone }) => {
      const found = await E.filter({ season, kind: "player", ref_id: p.id });
      const existing = found.find((e) => e.team_id === p.team_id) || found[0] || null;
      const place = zone ? { position: zone.pos, side: zone.side || null } : { position: null, side: null };
      if (existing) return E.update(existing.id, { to_team_id: tid, status: existing.status === "duda" ? "duda" : "continua", leave: null, ...place });
      return E.create({ season, team_id: p.team_id, kind: "player", ref_id: p.id, status: "continua", leave: null, note: "", to_team_id: tid, ...place });
    },
    onSuccess: (_d, { p }) => {
      refresh(); setClubOpen(false); setClubZone(null); setZoneOpen(null);
      toast({ title: `${playerFullName(p)} viene de ${teams.find((t) => t.id === p.team_id)?.name || "otro equipo"}.` });
    },
    onError: fail,
  });
  const setNeed = useMutation({
    mutationFn: async ({ zone, on, note }) => {
      const n = String(note || "").trim();
      if (!on) return zone.need?.entryId ? E.delete(zone.need.entryId) : null;
      if (zone.need?.entryId) return E.update(zone.need.entryId, { note: n });
      return E.create({ season, team_id: tid, kind: "need", ref_id: zone.key, position: zone.pos, side: zone.side || null, note: n });
    },
    onSuccess: (_d, { on, zone }) => { refresh(); if (!on) toast({ title: `${zoneTitle(zone)}: ya no está a reforzar.` }); },
    onError: fail,
  });
  // Colocar a alguien en otro puesto (arrastrando): el campo lo enseña al instante y luego se confirma con el servidor
  const moveItem = useMutation({
    mutationFn: async ({ item, zone }) => {
      const ch = moveChange(item, zone);
      if (ch.kind === "scout") return E.update(item.entryId, ch.patch);
      if (ch.blank) return item.entryId ? E.delete(item.entryId) : null;
      if (item.entryId) return E.update(item.entryId, ch.patch);
      return E.create({ season, team_id: tid, kind: "player", ref_id: item.id, ...ch.patch });
    },
    onMutate: async ({ item, zone }) => {
      await qc.cancelQueries({ queryKey: entriesKey });
      const prev = qc.getQueryData(entriesKey);
      qc.setQueryData(entriesKey, (old = []) => withMovedItem(old, item, zone));
      return { prev };
    },
    onError: (err, _vars, ctx) => { if (ctx?.prev) qc.setQueryData(entriesKey, ctx.prev); fail(err); },
    onSettled: refresh,
  });
  const { drag, grab, wasDrag } = usePlanDrag({
    disabled: moveItem.isPending,
    onDrop: (item, zoneKey) => { const zone = zoneByKey(zoneKey); if (zone) moveItem.mutate({ item, zone }); },
  });

  // PDF del campograma (el módulo con jsPDF se carga solo al pedirlo, para no engordar Scouting)
  const [pdfBusy, setPdfBusy] = useState(false);
  const makePdf = async () => {
    setPdfBusy(true);
    try {
      const { downloadSquadPlanPDF } = await import("@/lib/squadPlanPdf");
      await downloadSquadPlanPDF({ team, season, isF7, plan, logoUrl: team?.logo_url || CLUB_LOGO_URL });
    } catch (err) {
      toast({ title: "No se ha podido crear el PDF", description: err?.message || "Inténtalo de nuevo.", variant: "destructive" });
    } finally { setPdfBusy(false); }
  };
  const [passesPdfBusy, setPassesPdfBusy] = useState(false);
  const makePassesPdf = async () => {
    setPassesPdfBusy(true);
    try {
      const { downloadClubPassesPDF } = await import("@/lib/squadPassesPdf");
      await downloadClubPassesPDF({ season, summary: passSummary, logoUrl: CLUB_LOGO_URL });
    } catch (err) {
      toast({ title: "No se ha podido crear el PDF", description: err?.message || "Inténtalo de nuevo.", variant: "destructive" });
    } finally { setPassesPdfBusy(false); }
  };
  // Tocar un pase del resumen: se va al plan del equipo al que llega y se abre ahí su ventana (el plan se carga solo)
  const openPassFromSummary = (row) => { setTeamId(row.to.id); setItemOpen(row.key); setZoneOpen(null); setPassesOpen(false); };
  const busy = savePlayer.isPending || saveScout.isPending || removeScout.isPending || addScout.isPending || setNeed.isPending || cancelPass.isPending || addClub.isPending;

  const openAdd = (zone = null) => { setAddZone(zone); setAddOpen(true); };
  const openClub = (zone = null) => { setClubZone(zone); setClubOpen(true); };
  const loading = loadingTeams || (tid && (loadingPlayers || loadingEntries));
  const rest = total.sale - total.club - total.propia;
  const bajasSub = total.sale === 0 ? "ninguna" : [`${total.club} club`, `${total.propia} propia`, rest > 0 ? `${rest} sin concretar` : null].filter(Boolean).join(" · ");
  const zoneForDialog = zoneOpen ? plan.zones.find((z) => z.key === zoneOpen) : null;
  const itemForDialog = itemOpen ? plan.items.find((i) => i.key === itemOpen) : null;

  return (
    <div className="space-y-4" data-testid="squad-planning">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-56">
          <Select value={tid || undefined} onValueChange={(v) => v && setTeamId(v)}>
            <SelectTrigger data-testid="plan-team"><SelectValue placeholder="Equipo" /></SelectTrigger>
            <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <span className="text-xs font-bold uppercase tracking-wide text-gray-500 bg-gray-100 rounded-full px-2.5 py-1" data-testid="plan-season">Temporada {season}</span>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={makePdf} disabled={!team || loading || pdfBusy} data-testid="plan-pdf">
            <FileDown className="w-4 h-4 mr-1.5" /> {pdfBusy ? "Creando…" : "PDF"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPassesOpen(true)} data-testid="plan-passes-open">
            <Network className="w-4 h-4 mr-1.5" /> Pases del club
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => openClub(null)} disabled={!team} className="border-teal-300 text-teal-800 hover:bg-teal-50" data-testid="plan-add-club">
            <ArrowRightLeft className="w-4 h-4 mr-1.5" /> Traer de otro equipo
          </Button>
          <Button type="button" size="sm" onClick={() => openAdd(null)} style={{ background: "var(--granate)" }} className="text-white" data-testid="plan-add">
            <Binoculars className="w-4 h-4 mr-1.5" /> Añadir de scouting
          </Button>
        </div>
      </div>

      {!team ? (
        <p className="text-sm text-gray-400 py-10 text-center">{loadingTeams ? "Cargando equipos…" : "No hay equipos."}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" data-testid="plan-stats">
            <Stat label="Continúan" value={total.continua} tone="green" />
            <Stat label="Dudas" value={total.duda} tone="amber" />
            <Stat label="Bajas" value={total.sale} tone="red" sub={bajasSub} />
            <Stat label="Objetivos" value={total.objetivo} tone="sky" />
            <Stat label="Seguidos" value={total.seguido} tone="indigo" />
            <Stat label="Pases" value={total.llega + total.pasa} tone="teal" sub={total.llega + total.pasa === 0 ? "ninguno" : [total.llega ? `${total.llega} llegan` : null, total.pasa ? `${total.pasa} pasan` : null].filter(Boolean).join(" · ")} />
          </div>

          <SquadPitch zones={plan.zones} isF7={isF7} drag={drag} onZone={(z) => setZoneOpen(z.key)} onAdd={openAdd} onItem={(it) => setItemOpen(it.key)} onGrab={grab} wasDrag={wasDrag} />
          <Legend />
          <p className="text-center text-[11px] text-gray-400 -mt-1" data-testid="plan-hint">
            Toca a un jugador para ver su ficha del plan. Para colocarlo en otro puesto, arrástralo (con el ratón, o desde el asa ⠿ en el móvil); para pasarlo a otro equipo, ábrelo y elige el equipo. Todo esto solo cambia en el plan, no en su ficha.
          </p>

          <div className="grid gap-4 lg:grid-cols-3 items-start">
            <Card>
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-bold text-sm text-gray-900">Plantilla prevista {season}</h3>
                <span className="text-2xl font-black tabular-nums" style={{ color: "var(--granate)" }} data-testid="plan-total">{total.prevista}</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-2">Continúan (y los que llegan de otro equipo) + objetivos. Las dudas, las bajas, los que pasan a otro equipo y los jugadores seguidos no cuentan.</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="text-left font-bold py-1">Línea</th><th className="font-bold">Cont.</th><th className="font-bold">Dudas</th><th className="font-bold">Bajas</th><th className="font-bold">Pasa</th><th className="font-bold">Obj.</th><th className="font-bold">Seg.</th><th className="font-bold">Prev.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...GROUPS.map((g) => [g, groups[g]]), ...(sinPosicion.continua + sinPosicion.duda + sinPosicion.sale + sinPosicion.pasa + sinPosicion.objetivo + sinPosicion.seguido > 0 ? [["Sin posición", sinPosicion]] : [])].map(([g, r]) => (
                    <tr key={g} className="text-center tabular-nums" data-testid={`group-${g}`}>
                      <td className="text-left font-semibold text-gray-700 py-1">{g}</td>
                      <td>{r.continua}</td><td className="text-amber-700">{r.duda || "·"}</td><td className="text-red-600">{r.sale || "·"}</td><td className="text-teal-700">{r.pasa || "·"}</td>
                      <td className="text-sky-700">{r.objetivo || "·"}</td><td className="text-indigo-600">{r.seguido || "·"}</td>
                      <td className="font-black">{r.prevista}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card>
              <h3 className="font-bold text-sm text-gray-900 mb-1 flex items-center gap-1.5"><Target className="w-4 h-4 text-sky-600" />Objetivos de scouting · {objetivos.length}</h3>
              {objetivos.length === 0 ? (
                <p className="text-xs text-gray-400 py-1">Pulsa «+» en un puesto del campo o «Añadir de scouting» para elegir a un jugador observado.</p>
              ) : (
                <div className="divide-y divide-gray-50" data-testid="plan-targets">{objetivos.map((it) => <ItemRow key={it.key} item={it} onOpen={(i) => setItemOpen(i.key)} />)}</div>
              )}
              <h3 className="font-bold text-sm text-gray-900 mt-3 mb-1 flex items-center gap-1.5"><Eye className="w-4 h-4 text-indigo-500" />Jugadores seguidos · {seguidos.length}</h3>
              {seguidos.length === 0 ? (
                <p className="text-xs text-gray-400 py-1">Los jugadores que sigues pero aún no son un objetivo salen aquí.</p>
              ) : (
                <div className="divide-y divide-gray-50" data-testid="plan-followed">{seguidos.map((it) => <ItemRow key={it.key} item={it} onOpen={(i) => setItemOpen(i.key)} />)}</div>
              )}
            </Card>

            <div className="space-y-4">
              <Card>
                <h3 className="font-bold text-sm text-gray-900 mb-1 flex items-center gap-1.5"><ArrowRightLeft className="w-4 h-4 text-teal-600" />Pases entre equipos · {pases.length}</h3>
                {pases.length === 0 ? (
                  <p className="text-xs text-gray-400 py-1">Abre un jugador y elige otro equipo, o pulsa «Traer de otro equipo». Solo cambia en el plan.</p>
                ) : (
                  <div className="divide-y divide-gray-50" data-testid="plan-passes">{pases.map((it) => <ItemRow key={it.key} item={it} onOpen={(i) => setItemOpen(i.key)} />)}</div>
                )}
              </Card>
              <Card>
                <h3 className="font-bold text-sm text-gray-900 mb-1 flex items-center gap-1.5"><ChevronsUp className="w-4 h-4 text-fuchsia-600" />Puestos a reforzar · {plan.needs.length}</h3>
                {plan.needs.length === 0 ? (
                  <p className="text-xs text-gray-400 py-1">Abre un puesto del campo y márcalo «a reforzar» para que salga aquí.</p>
                ) : (
                  <div className="divide-y divide-gray-50" data-testid="plan-needs">
                    {plan.needs.map((z) => (
                      <button key={z.key} type="button" onClick={() => setZoneOpen(z.key)} data-testid={`need-row-${z.key}`} className="w-full flex items-baseline gap-2 py-1.5 text-left text-sm hover:bg-gray-50 rounded-lg px-1">
                        <span className="font-semibold text-fuchsia-800">{zoneTitle(z)}</span>
                        {z.need.note && <span className="text-xs text-gray-500 min-w-0 break-words">{z.need.note}</span>}
                        <span className="text-xs text-gray-400 ml-auto shrink-0 tabular-nums">{z.items.filter((i) => i.status === "continua" || i.status === "objetivo").length} previstos</span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              {plan.unplaced.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3" data-testid="plan-unplaced">
                  <h3 className="font-bold text-sm text-amber-900 mb-1">Sin posición · {plan.unplaced.length}</h3>
                  <p className="text-[11px] text-amber-800 mb-1">No salen en el campo. Pulsa en uno y elige su puesto (solo en este plan), o asigna su posición en su ficha (Jugadores).</p>
                  <div className="divide-y divide-amber-100">{plan.unplaced.map((it) => <ItemRow key={it.key} item={it} onOpen={(i) => setItemOpen(i.key)} />)}</div>
                </div>
              )}
              {plan.orphans > 0 && <p className="text-[11px] text-gray-400">{plan.orphans} objetivo{plan.orphans > 1 ? "s" : ""} ya no está{plan.orphans > 1 ? "n" : ""} en Scouting y no se cuenta{plan.orphans > 1 ? "n" : ""}.</p>}
              {!loading && players.length === 0 && <p className="text-xs text-gray-400">Este equipo no tiene jugadores todavía.</p>}
            </div>
          </div>
        </>
      )}

      <DragGhost drag={drag} />
      {zoneForDialog && !itemOpen && !addOpen && !clubOpen && (
        <ZoneDialog key={zoneForDialog.key} zone={zoneForDialog} busy={busy} onClose={() => setZoneOpen(null)} onItem={(i) => setItemOpen(i.key)} onAdd={openAdd} onAddClub={openClub}
          onNeed={(zone, on, note) => setNeed.mutate({ zone, on, note })} />
      )}
      {itemForDialog && (
        <ItemDialog key={itemForDialog.key} item={itemForDialog} team={team} teams={teams} busy={busy} onClose={() => setItemOpen(null)} onCancelPass={(item) => cancelPass.mutate(item)}
          onSavePlayer={(item, values) => savePlayer.mutate({ item, values })}
          onSaveScout={(item, patch) => saveScout.mutate({ item, patch })}
          onRemoveScout={(item) => removeScout.mutate(item)} />
      )}
      {addOpen && (
        <AddTargetDialog scouted={scouted} taken={taken} zone={addZone} busy={busy} onClose={() => { setAddOpen(false); setAddZone(null); }}
          onPick={(p, role) => addScout.mutate({ p, zone: addZone, role })} />
      )}
      {passesOpen && (
        <ClubPassesDialog summary={passSummary} loading={loadingClubPlayers || loadingSeasonEntries} season={season} onClose={() => setPassesOpen(false)}
          onOpen={openPassFromSummary} onPdf={makePassesPdf} pdfBusy={passesPdfBusy} />
      )}
      {clubOpen && (
        <AddClubDialog players={clubPlayers} teams={teams} team={team} zone={clubZone} passes={passes} busy={busy}
          onClose={() => { setClubOpen(false); setClubZone(null); }} onPick={(p) => addClub.mutate({ p, zone: clubZone })} />
      )}
    </div>
  );
}
