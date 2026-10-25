import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Binoculars, Plus, Search, Star, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import FootballField from "@/components/tactics/FootballField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { playerFullName, matchesPlayerSearch } from "@/lib/playerName";
import {
  nextSeason, buildPlan, visibleZones, STATUS, STATUS_KEYS, POSITION_LABEL, POSITIONS, GROUPS, hasSides,
} from "@/lib/squadPlan";

// Scouting → Planificación: plantilla prevista de cada equipo para la temporada siguiente, en campograma (ataque hacia arriba, izquierda y
// derecha del equipo). Los jugadores actuales continúan salvo que se marque «duda» o «se va»; los objetivos salen de las listas de Scouting.
// Lógica pura en `src/lib/squadPlan.js`. Los textos de Scouting siguen en español (traducción pendiente, bloque 5).

// Hasta 3 fichas por puesto; si hay más, se enseñan 2 y «+N más» (así un puesto nunca pisa al de debajo, ni en móvil)
const MAX_CHIPS = 3;
const CHIP = {
  continua: "bg-white/95 border-emerald-500 text-gray-900",
  duda: "bg-amber-100 border-amber-500 text-amber-950",
  sale: "bg-red-100 border-red-400 text-red-900 line-through opacity-85",
  objetivo: "bg-sky-100 border-sky-500 border-dashed text-sky-950",
};
const DOT = { continua: "bg-emerald-500", duda: "bg-amber-500", sale: "bg-red-500", objetivo: "bg-sky-500" };
const DECISION = {
  fichar: { label: "Fichar", cls: "bg-green-50 text-green-700 border-green-200" },
  seguir_viendo: { label: "Seguir viendo", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  descartar: { label: "Descartar", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};
const STATUS_BTN = {
  continua: "border-emerald-500 bg-emerald-50 text-emerald-800",
  duda: "border-amber-500 bg-amber-50 text-amber-800",
  sale: "border-red-500 bg-red-50 text-red-800",
};

const labelOf = (it) => (it.kind === "scout" ? "Objetivo de scouting" : STATUS[it.status]?.label || "");
const zoneTitle = (z) => `${POSITION_LABEL[z.pos]}${z.side ? (z.side === "l" ? " izquierdo" : " derecho") : ""}`;

function Chip({ item, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      data-testid={`chip-${item.key}`}
      title={`${item.name}${item.year ? ` · ${item.year}` : ""} · ${labelOf(item)}${item.injured ? " · lesionado" : ""}`}
      className={`w-full h-[18px] flex items-center gap-1 rounded border px-1 text-[10px] leading-none text-left shadow-sm ${CHIP[item.status] || CHIP.continua}`}
    >
      {item.kind === "scout" ? <Binoculars className="w-2.5 h-2.5 shrink-0" /> : <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[item.status]}`} />}
      <span className="truncate font-semibold flex-1">{item.name}</span>
      {item.injured && <span className="text-[9px] shrink-0" aria-label="lesionado">✚</span>}
      {item.year && <span className="text-[9px] tabular-nums opacity-70 shrink-0">{item.year}</span>}
    </button>
  );
}

function ZoneBox({ zone, onZone, onItem }) {
  const shown = zone.items.length <= MAX_CHIPS ? zone.items : zone.items.slice(0, MAX_CHIPS - 1);
  const more = zone.items.length - shown.length;
  const empty = zone.items.length === 0;
  return (
    <div data-testid={`zone-${zone.key}`} className="absolute" style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.w}%`, transform: "translateX(-50%)" }}>
      <button
        type="button"
        onClick={() => onZone(zone)}
        data-testid={`zone-head-${zone.key}`}
        className={`w-full h-[15px] flex items-center justify-between gap-1 rounded px-1.5 text-[9px] leading-none font-bold uppercase tracking-wide text-white ${empty ? "border border-dashed border-white/70 bg-black/20" : "bg-black/35"}`}
      >
        <span className="truncate">{zone.label}</span>
        {empty ? <Plus className="w-3 h-3 shrink-0" /> : <span className="tabular-nums shrink-0">{zone.items.length}</span>}
      </button>
      {!empty && (
        <div className="mt-0.5 space-y-0.5">
          {shown.map((it) => <Chip key={it.key} item={it} onOpen={onItem} />)}
          {more > 0 && (
            <button type="button" onClick={() => onZone(zone)} className="w-full h-[15px] rounded bg-black/40 px-1 text-[9px] leading-none font-semibold text-white" data-testid={`zone-more-${zone.key}`}>
              +{more} más
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  const cls = { green: "text-emerald-700 bg-emerald-50 border-emerald-200", amber: "text-amber-700 bg-amber-50 border-amber-200", red: "text-red-700 bg-red-50 border-red-200", sky: "text-sky-700 bg-sky-50 border-sky-200" }[tone];
  return (
    <div className={`rounded-xl border px-2 py-2 text-center ${cls}`}>
      <div className="text-xl font-black leading-none tabular-nums" data-testid={`stat-${tone}`}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

function ItemRow({ item, onOpen }) {
  const pos = item.position ? POSITION_LABEL[item.position] : "Sin posición";
  return (
    <button type="button" onClick={() => onOpen(item)} className="w-full flex items-center gap-2 py-1.5 text-left text-sm hover:bg-gray-50 rounded-lg px-1" data-testid={`row-${item.key}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[item.status]}`} />
      <span className={`font-semibold truncate ${item.status === "sale" ? "line-through text-gray-400" : "text-gray-900"}`}>{item.name}</span>
      {item.year && <span className="text-xs text-gray-400 tabular-nums">{item.year}</span>}
      <span className="text-xs text-gray-500 ml-auto shrink-0">{pos}</span>
      {item.kind === "scout" && DECISION[item.decision] && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${DECISION[item.decision].cls}`}>{DECISION[item.decision].label}</span>
      )}
    </button>
  );
}

/** Ventana de una persona del plan: estado y nota (jugador del club) o posición, lado y nota (objetivo de scouting). */
function ItemDialog({ item, onClose, onSavePlayer, onSaveScout, onRemoveScout, busy }) {
  const [status, setStatus] = useState(item.status);
  const [note, setNote] = useState(item.note || "");
  const [position, setPosition] = useState(item.position || "");
  const [side, setSide] = useState(item.side || "auto");
  const isScout = item.kind === "scout";
  const s = item.source || {};
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="plan-item-dialog">
        <DialogHeader>
          <DialogTitle>{playerFullName(s)}</DialogTitle>
          <DialogDescription>
            {[item.year ? `Nacido en ${item.year}` : null, item.position ? POSITION_LABEL[item.position] : "Sin posición", isScout ? (item.club || null) : (item.injured ? "Lesionado" : null)].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!isScout ? (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Próxima temporada</div>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_KEYS.map((k) => (
                  <button key={k} type="button" data-testid={`status-${k}`} onClick={() => setStatus(k)}
                    className={`rounded-lg border-2 px-2 py-2 text-sm font-bold ${status === k ? STATUS_BTN[k] : "border-gray-200 text-gray-500"}`}>{STATUS[k].label}</button>
                ))}
              </div>
              {!item.position && <p className="text-xs text-amber-700 mt-2">Sin posición en su ficha: no sale en el campo. Asígnasela en Jugadores para colocarlo.</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {DECISION[item.decision] && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${DECISION[item.decision].cls}`}>{DECISION[item.decision].label}</span>}
                {item.rating > 0 && <span className="inline-flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`w-3.5 h-3.5 ${i <= item.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />)}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Posición en el plan</div>
                  <Select value={position || undefined} onValueChange={(v) => v && setPosition(v)}>
                    <SelectTrigger data-testid="scout-position"><SelectValue placeholder="Elegir" /></SelectTrigger>
                    <SelectContent>{POSITIONS.map((p) => <SelectItem key={p} value={p}>{POSITION_LABEL[p]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {hasSides(position) && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Lado</div>
                    <Select value={side} onValueChange={(v) => v && setSide(v)}>
                      <SelectTrigger data-testid="scout-side"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Según su ficha</SelectItem>
                        <SelectItem value="l">Izquierda</SelectItem>
                        <SelectItem value="r">Derecha</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Nota</div>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: sube a un equipo superior, ficha por otro club, valorar en enero…" data-testid="plan-note" />
          </div>
          <div className="flex items-center justify-between gap-2">
            {isScout ? (
              <Button type="button" variant="outline" className="text-red-600 border-red-200" onClick={() => onRemoveScout(item)} disabled={busy} data-testid="plan-remove">
                <Trash2 className="w-4 h-4 mr-1.5" /> Quitar del plan
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="button" disabled={busy || (isScout && !position)} data-testid="plan-save"
                onClick={() => (isScout ? onSaveScout(item, { position, side: side === "auto" ? null : side, note }) : onSavePlayer(item, { status, note }))}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Lista de un puesto (para ver todos los que hay y para añadir un objetivo de scouting en él). */
function ZoneDialog({ zone, onClose, onItem, onAdd }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="plan-zone-dialog">
        <DialogHeader>
          <DialogTitle>{zoneTitle(zone)}</DialogTitle>
          <DialogDescription>{zone.items.length ? `${zone.items.length} en este puesto` : "Nadie en este puesto todavía"}</DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
          {zone.items.map((it) => <ItemRow key={it.key} item={it} onOpen={onItem} />)}
        </div>
        <Button type="button" onClick={() => onAdd(zone)} data-testid="zone-add-target" style={{ background: "var(--granate)" }} className="text-white">
          <Binoculars className="w-4 h-4 mr-1.5" /> Añadir objetivo de scouting aquí
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Elegir un jugador de las listas de Scouting para el plan de este equipo. */
function AddTargetDialog({ scouted, taken, zone, onClose, onPick, busy }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("activos");
  const rows = useMemo(() => {
    const list = scouted.filter((p) => {
      if (search && !matchesPlayerSearch(p, search) && !String(p.current_club || "").toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "activos") return p.decision !== "descartar";
      if (filter === "todos") return true;
      return p.decision === filter;
    });
    const samePos = (p) => (zone && p.position === zone.pos ? 0 : 1);
    return list.sort((a, b) => samePos(a) - samePos(b) || (b.rating || 0) - (a.rating || 0) || playerFullName(a).localeCompare(playerFullName(b), "es"));
  }, [scouted, search, filter, zone]);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg" data-testid="plan-add-dialog">
        <DialogHeader>
          <DialogTitle>Añadir objetivo de scouting</DialogTitle>
          <DialogDescription>{zone ? `Se colocará como ${zoneTitle(zone).toLowerCase()}.` : "Se colocará en su posición de scouting."}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input className="pl-8" placeholder="Buscar por nombre o club…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="add-search" />
          </div>
          <Select value={filter} onValueChange={(v) => v && setFilter(v)}>
            <SelectTrigger className="w-36" data-testid="add-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="activos">Sin descartados</SelectItem>
              <SelectItem value="fichar">Fichar</SelectItem>
              <SelectItem value="seguir_viendo">Seguir viendo</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100" data-testid="add-list">
          {rows.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">{scouted.length === 0 ? "Todavía no hay jugadores en la pestaña Jugadores de Scouting." : "Ningún jugador con ese filtro."}</p>}
          {rows.map((p) => {
            const inPlan = taken.has(p.id);
            const yr = Number(p.birth_year) || Number(String(p.birth_date || "").slice(0, 4)) || null;
            return (
              <button key={p.id} type="button" disabled={inPlan || busy} onClick={() => onPick(p)} data-testid={`add-${p.id}`}
                className="w-full flex items-center gap-2 py-2 px-1 text-left text-sm hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent">
                <span className="font-semibold truncate text-gray-900">{playerFullName(p)}</span>
                {yr && <span className="text-xs text-gray-400 tabular-nums">{yr}</span>}
                <span className="text-xs text-gray-500 truncate">{[p.position ? POSITION_LABEL[p.position] : null, p.current_club].filter(Boolean).join(" · ")}</span>
                {inPlan ? <span className="ml-auto text-[10px] font-bold text-sky-700">En el plan</span> : DECISION[p.decision] && (
                  <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${DECISION[p.decision].cls}`}>{DECISION[p.decision].label}</span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SquadPlanning() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const season = nextSeason(CURRENT_SEASON);
  const [teamId, setTeamId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(null);
  const [itemOpen, setItemOpen] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addZone, setAddZone] = useState(null);

  const { data: teams = [], isLoading: loadingTeams } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const team = teams.find((t) => t.id === teamId) || teams[0] || null;
  const tid = team?.id || null;
  const isF7 = teamPlaysF7(team);
  const format = isF7 ? "f7" : "f11";

  const { data: players = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ["squad-plan-players", tid], enabled: !!tid, queryFn: () => base44.entities.Player.filter({ team_id: tid }),
  });
  const { data: scouted = [] } = useQuery({ queryKey: ["scouted_players"], queryFn: () => base44.entities.ScoutedPlayer.list("-created_date", 500) });
  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["squad-plan", tid, season], enabled: !!tid, queryFn: () => base44.entities.SquadPlanEntry.filter({ team_id: tid, season }),
  });

  const plan = useMemo(() => buildPlan({ players, scouted, entries }), [players, scouted, entries]);
  const zones = useMemo(() => visibleZones(plan, format, showAll), [plan, format, showAll]);
  const taken = useMemo(() => new Set(entries.filter((e) => e.kind === "scout").map((e) => e.ref_id)), [entries]);
  const targets = plan.items.filter((i) => i.kind === "scout");
  const { total, groups, sinPosicion } = plan.summary;

  const refresh = () => qc.invalidateQueries({ queryKey: ["squad-plan", tid, season] });
  const fail = (err) => toast({ title: "No se ha podido guardar", description: err?.message || "Inténtalo de nuevo.", variant: "destructive" });
  const E = base44.entities.SquadPlanEntry;

  const savePlayer = useMutation({
    mutationFn: async ({ item, status, note }) => {
      const blank = status === "continua" && !note.trim();
      if (item.entryId) return blank ? E.delete(item.entryId) : E.update(item.entryId, { status, note: note.trim() });
      if (blank) return null;
      return E.create({ season, team_id: tid, kind: "player", ref_id: item.id, status, note: note.trim() });
    },
    onSuccess: () => { refresh(); setItemOpen(null); },
    onError: fail,
  });
  const saveScout = useMutation({
    mutationFn: ({ item, patch }) => E.update(item.entryId, { ...patch, note: patch.note.trim() }),
    onSuccess: () => { refresh(); setItemOpen(null); },
    onError: fail,
  });
  const removeScout = useMutation({
    mutationFn: (item) => E.delete(item.entryId),
    onSuccess: () => { refresh(); setItemOpen(null); toast({ title: "Quitado del plan." }); },
    onError: fail,
  });
  const addScout = useMutation({
    mutationFn: ({ p, zone }) => E.create({
      season, team_id: tid, kind: "scout", ref_id: p.id, position: zone?.pos || p.position || null, side: zone?.side || null, note: "",
    }),
    onSuccess: () => { refresh(); setAddOpen(false); setAddZone(null); setZoneOpen(null); toast({ title: "Objetivo añadido al plan." }); },
    onError: fail,
  });
  const busy = savePlayer.isPending || saveScout.isPending || removeScout.isPending || addScout.isPending;

  const openAdd = (zone = null) => { setAddZone(zone); setAddOpen(true); };
  // Un puesto vacío abre directamente la lista de scouting; uno con gente abre su lista (ver a todos y añadir)
  const handleZone = (zone) => (zone.items.length === 0 ? openAdd(zone) : setZoneOpen(zone));
  const loading = loadingTeams || (tid && (loadingPlayers || loadingEntries));

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
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAll((v) => !v)} data-testid="plan-showall">{showAll ? "Ocultar puestos vacíos" : "Todos los puestos"}</Button>
          <Button type="button" size="sm" onClick={() => openAdd(null)} style={{ background: "var(--granate)" }} className="text-white" data-testid="plan-add">
            <Binoculars className="w-4 h-4 mr-1.5" /> Añadir de scouting
          </Button>
        </div>
      </div>

      {!team ? (
        <p className="text-sm text-gray-400 py-10 text-center">{loadingTeams ? "Cargando equipos…" : "No hay equipos."}</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2" data-testid="plan-stats">
            <Stat label="Continúan" value={total.continua} tone="green" />
            <Stat label="Dudas" value={total.duda} tone="amber" />
            <Stat label="Se van" value={total.sale} tone="red" />
            <Stat label="Objetivos" value={total.objetivo} tone="sky" />
          </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] items-start">
          <div>
            <div className="relative max-w-md mx-auto" data-testid="plan-pitch">
              <FootballField f7={isF7} />
              <div className="absolute inset-0">
                {zones.map((z) => <ZoneBox key={z.key} zone={z} onZone={handleZone} onItem={setItemOpen} />)}
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500">
              {STATUS_KEYS.map((k) => <span key={k} className="inline-flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${DOT[k]}`} />{STATUS[k].label}</span>)}
              <span className="inline-flex items-center gap-1"><Binoculars className="w-3 h-3 text-sky-600" />Objetivo de scouting</span>
              <span>✚ Lesionado</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="font-bold text-sm text-gray-900">Plantilla prevista {season}</h3>
                <span className="text-2xl font-black tabular-nums" style={{ color: "var(--granate)" }} data-testid="plan-total">{total.prevista}</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-2">Continúan + objetivos. Las dudas y los que se van no cuentan.</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="text-left font-bold py-1">Línea</th><th className="font-bold">Cont.</th><th className="font-bold">Dudas</th><th className="font-bold">Van</th><th className="font-bold">Obj.</th><th className="font-bold">Prev.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...GROUPS.map((g) => [g, groups[g]]), ...(sinPosicion.prevista + sinPosicion.duda + sinPosicion.sale + sinPosicion.objetivo > 0 ? [["Sin posición", sinPosicion]] : [])].map(([g, r]) => (
                    <tr key={g} className="text-center tabular-nums" data-testid={`group-${g}`}>
                      <td className="text-left font-semibold text-gray-700 py-1">{g}</td>
                      <td>{r.continua}</td><td className="text-amber-700">{r.duda || "·"}</td><td className="text-red-600">{r.sale || "·"}</td><td className="text-sky-700">{r.objetivo || "·"}</td>
                      <td className="font-black">{r.prevista}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
              <h3 className="font-bold text-sm text-gray-900 mb-1">Objetivos de scouting · {targets.length}</h3>
              {targets.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">Toca un puesto del campo o «Añadir de scouting» para elegir a un jugador observado.</p>
              ) : (
                <div className="divide-y divide-gray-50" data-testid="plan-targets">{targets.map((it) => <ItemRow key={it.key} item={it} onOpen={setItemOpen} />)}</div>
              )}
            </div>

            {plan.unplaced.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3" data-testid="plan-unplaced">
                <h3 className="font-bold text-sm text-amber-900 mb-1">Sin posición · {plan.unplaced.length}</h3>
                <p className="text-[11px] text-amber-800 mb-1">No salen en el campo. Asigna su posición en su ficha (Jugadores) o, si es un objetivo, elígela aquí.</p>
                <div className="divide-y divide-amber-100">{plan.unplaced.map((it) => <ItemRow key={it.key} item={it} onOpen={setItemOpen} />)}</div>
              </div>
            )}
            {plan.orphans > 0 && <p className="text-[11px] text-gray-400">{plan.orphans} objetivo{plan.orphans > 1 ? "s" : ""} ya no está{plan.orphans > 1 ? "n" : ""} en Scouting y no se cuenta{plan.orphans > 1 ? "n" : ""}.</p>}
            {!loading && players.length === 0 && <p className="text-xs text-gray-400">Este equipo no tiene jugadores todavía.</p>}
          </div>
        </div>
        </>
      )}

      {zoneOpen && !itemOpen && !addOpen && (
        <ZoneDialog zone={plan.zones.find((z) => z.key === zoneOpen.key) || zoneOpen} onClose={() => setZoneOpen(null)} onItem={setItemOpen} onAdd={openAdd} />
      )}
      {itemOpen && (
        <ItemDialog key={itemOpen.key} item={plan.items.find((i) => i.key === itemOpen.key) || itemOpen} busy={busy} onClose={() => setItemOpen(null)}
          onSavePlayer={(item, v) => savePlayer.mutate({ item, ...v })}
          onSaveScout={(item, patch) => saveScout.mutate({ item, patch })}
          onRemoveScout={(item) => removeScout.mutate(item)} />
      )}
      {addOpen && <AddTargetDialog scouted={scouted} taken={taken} zone={addZone} busy={busy} onClose={() => { setAddOpen(false); setAddZone(null); }} onPick={(p) => addScout.mutate({ p, zone: addZone })} />}
    </div>
  );
}
