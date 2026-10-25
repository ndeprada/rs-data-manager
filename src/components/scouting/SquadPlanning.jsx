import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Binoculars, ChevronsUp, Eye, FileDown, Target } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import {
  nextSeason, buildPlan, zoneByKey, zoneTitle, moveChange, withMovedItem, playerPatch, isBlankPlayerPatch, GROUPS,
} from "@/lib/squadPlan";
import SquadPitch from "./SquadPitch";
import { usePlanDrag, DragGhost } from "./usePlanDrag";
import { ItemDialog, ZoneDialog, AddTargetDialog, ItemRow } from "./SquadPlanDialogs";
import { DOT, LEAVE_TAG } from "./squadPlanUi";

// Scouting → Planificación: plantilla prevista de cada equipo para la temporada siguiente, en un campo a escala con todos los puestos a la vista
// (ataque a la derecha, o arriba en el móvil). Los jugadores actuales continúan salvo que se marque «duda» o «se va» (baja del club o baja propia);
// los jugadores de las listas de Scouting entran como objetivo o como jugador seguido; cualquier puesto se puede marcar «a reforzar» y la gente se
// arrastra de un puesto a otro (solo en el plan: la ficha del jugador no cambia). Lógica pura en `src/lib/squadPlan.js`.
// Los textos de Scouting siguen en español (traducción pendiente, bloque 5).

function Stat({ label, value, tone, sub }) {
  const cls = {
    green: "text-emerald-700 bg-emerald-50 border-emerald-200", amber: "text-amber-700 bg-amber-50 border-amber-200", red: "text-red-700 bg-red-50 border-red-200",
    sky: "text-sky-700 bg-sky-50 border-sky-200", indigo: "text-indigo-700 bg-indigo-50 border-indigo-200",
  }[tone];
  return (
    <div className={`rounded-xl border px-2 py-2 text-center ${cls}`}>
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

  const { data: teams = [], isLoading: loadingTeams } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const team = teams.find((t) => t.id === teamId) || teams[0] || null;
  const tid = team?.id || null;
  const isF7 = teamPlaysF7(team);

  const { data: players = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ["squad-plan-players", tid], enabled: !!tid, queryFn: () => base44.entities.Player.filter({ team_id: tid }),
  });
  const { data: scouted = [] } = useQuery({ queryKey: ["scouted_players"], queryFn: () => base44.entities.ScoutedPlayer.list("-created_date", 500) });
  const entriesKey = ["squad-plan", tid, season];
  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: entriesKey, enabled: !!tid, queryFn: () => base44.entities.SquadPlanEntry.filter({ team_id: tid, season }),
  });

  const plan = useMemo(() => buildPlan({ players, scouted, entries }), [players, scouted, entries]);
  const taken = useMemo(() => new Set(entries.filter((e) => e.kind === "scout").map((e) => e.ref_id)), [entries]);
  const objetivos = plan.items.filter((i) => i.status === "objetivo");
  const seguidos = plan.items.filter((i) => i.status === "seguido");
  const { total, groups, sinPosicion } = plan.summary;

  const refresh = () => qc.invalidateQueries({ queryKey: entriesKey });
  const fail = (err) => toast({ title: "No se ha podido guardar", description: err?.message || "Inténtalo de nuevo.", variant: "destructive" });
  const E = base44.entities.SquadPlanEntry;

  const savePlayer = useMutation({
    mutationFn: async ({ item, values }) => {
      const patch = playerPatch(values);
      if (isBlankPlayerPatch(patch)) return item.entryId ? E.delete(item.entryId) : null;
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
  const busy = savePlayer.isPending || saveScout.isPending || removeScout.isPending || addScout.isPending || setNeed.isPending;

  const openAdd = (zone = null) => { setAddZone(zone); setAddOpen(true); };
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
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={makePdf} disabled={!team || loading || pdfBusy} data-testid="plan-pdf">
            <FileDown className="w-4 h-4 mr-1.5" /> {pdfBusy ? "Creando…" : "PDF"}
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
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2" data-testid="plan-stats">
            <Stat label="Continúan" value={total.continua} tone="green" />
            <Stat label="Dudas" value={total.duda} tone="amber" />
            <Stat label="Bajas" value={total.sale} tone="red" sub={bajasSub} />
            <Stat label="Objetivos" value={total.objetivo} tone="sky" />
            <Stat label="Seguidos" value={total.seguido} tone="indigo" />
          </div>

          <SquadPitch zones={plan.zones} isF7={isF7} drag={drag} onZone={(z) => setZoneOpen(z.key)} onAdd={openAdd} onItem={(it) => setItemOpen(it.key)} onGrab={grab} wasDrag={wasDrag} />
          <Legend />
          <p className="text-center text-[11px] text-gray-400 -mt-1" data-testid="plan-hint">
            Toca a un jugador para ver su ficha del plan. Para colocarlo en otro puesto, arrástralo (con el ratón, o desde el asa ⠿ en el móvil): solo cambia en el plan, no en su ficha.
          </p>

          <div className="grid gap-4 lg:grid-cols-3 items-start">
            <Card>
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-bold text-sm text-gray-900">Plantilla prevista {season}</h3>
                <span className="text-2xl font-black tabular-nums" style={{ color: "var(--granate)" }} data-testid="plan-total">{total.prevista}</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-2">Continúan + objetivos. Las dudas, las bajas y los jugadores seguidos no cuentan.</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="text-left font-bold py-1">Línea</th><th className="font-bold">Cont.</th><th className="font-bold">Dudas</th><th className="font-bold">Bajas</th><th className="font-bold">Obj.</th><th className="font-bold">Seg.</th><th className="font-bold">Prev.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...GROUPS.map((g) => [g, groups[g]]), ...(sinPosicion.continua + sinPosicion.duda + sinPosicion.sale + sinPosicion.objetivo + sinPosicion.seguido > 0 ? [["Sin posición", sinPosicion]] : [])].map(([g, r]) => (
                    <tr key={g} className="text-center tabular-nums" data-testid={`group-${g}`}>
                      <td className="text-left font-semibold text-gray-700 py-1">{g}</td>
                      <td>{r.continua}</td><td className="text-amber-700">{r.duda || "·"}</td><td className="text-red-600">{r.sale || "·"}</td>
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
      {zoneForDialog && !itemOpen && !addOpen && (
        <ZoneDialog key={zoneForDialog.key} zone={zoneForDialog} busy={busy} onClose={() => setZoneOpen(null)} onItem={(i) => setItemOpen(i.key)} onAdd={openAdd}
          onNeed={(zone, on, note) => setNeed.mutate({ zone, on, note })} />
      )}
      {itemForDialog && (
        <ItemDialog key={itemForDialog.key} item={itemForDialog} busy={busy} onClose={() => setItemOpen(null)}
          onSavePlayer={(item, values) => savePlayer.mutate({ item, values })}
          onSaveScout={(item, patch) => saveScout.mutate({ item, patch })}
          onRemoveScout={(item) => removeScout.mutate(item)} />
      )}
      {addOpen && (
        <AddTargetDialog scouted={scouted} taken={taken} zone={addZone} busy={busy} onClose={() => { setAddOpen(false); setAddZone(null); }}
          onPick={(p, role) => addScout.mutate({ p, zone: addZone, role })} />
      )}
    </div>
  );
}
