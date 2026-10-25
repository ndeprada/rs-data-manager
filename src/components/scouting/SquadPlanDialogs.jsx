import React, { useMemo, useState } from "react";
import { Binoculars, ChevronsUp, Eye, Search, Star, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { playerFullName, matchesPlayerSearch } from "@/lib/playerName";
import {
  STATUS, STATUS_KEYS, LEAVE, LEAVE_KEYS, ROLE, ROLE_KEYS, POSITION_LABEL, ZONES, zoneByKey, zoneTitle, movePatch,
} from "@/lib/squadPlan";
import { DOT, STATUS_BTN, DECISION, LEAVE_TAG } from "./squadPlanUi";

// Ventanas de la Planificación: una persona del plan, un puesto (lista, a reforzar) y elegir a un jugador de Scouting.

const AUTO = "auto";
const LANE_ORDER = { l: 0, c: 1, r: 2 };
const ZONES_BY_LINE = [...ZONES].sort((a, b) => a.line - b.line || LANE_ORDER[a.lane] - LANE_ORDER[b.lane]); // de la portería al ataque

function ZoneSelect({ value, onChange, autoLabel, testid }) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger data-testid={testid}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={AUTO}>{autoLabel}</SelectItem>
        {ZONES_BY_LINE.map((z) => <SelectItem key={z.key} value={z.key}>{zoneTitle(z)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

const Label = ({ children }) => <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">{children}</div>;

/** Fila de una persona del plan en las listas. */
export function ItemRow({ item, onOpen }) {
  const pos = item.position ? POSITION_LABEL[item.position] : "Sin posición";
  return (
    <button type="button" onClick={() => onOpen(item)} className="w-full flex items-center gap-2 py-1.5 text-left text-sm hover:bg-gray-50 rounded-lg px-1" data-testid={`row-${item.key}`}>
      {item.status === "seguido" ? <Eye className="w-3.5 h-3.5 shrink-0 text-indigo-500" /> : item.status === "objetivo" ? <Target className="w-3.5 h-3.5 shrink-0 text-sky-600" /> : <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[item.status]}`} />}
      <span className={`font-semibold min-w-0 break-words ${item.status === "sale" ? "line-through text-gray-400" : "text-gray-900"}`}>{item.name}</span>
      {item.year && <span className="text-xs text-gray-400 tabular-nums shrink-0">{item.year}</span>}
      <span className="text-xs text-gray-500 ml-auto shrink-0">{pos}</span>
      {item.kind === "scout" && DECISION[item.decision] && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${DECISION[item.decision].cls}`}>{DECISION[item.decision].label}</span>
      )}
      {item.status === "sale" && item.leave && <span className={`text-[9px] font-extrabold uppercase px-1 rounded shrink-0 ${LEAVE_TAG}`}>{LEAVE[item.leave].label}</span>}
    </button>
  );
}

/** Ventana de una persona del plan: estado, tipo de baja, puesto y nota (jugador del club) o tipo, puesto y nota (jugador de scouting). */
export function ItemDialog({ item, onClose, onSavePlayer, onSaveScout, onRemoveScout, busy }) {
  const isScout = item.kind === "scout";
  const [status, setStatus] = useState(item.status);
  const [leave, setLeave] = useState(item.leave || null);
  const [role, setRole] = useState(isScout ? item.status : "objetivo");
  const [note, setNote] = useState(item.note || "");
  const [zoneKey, setZoneKey] = useState(isScout ? item.zone || AUTO : item.moved ? item.zone || AUTO : AUTO);
  const s = item.source || {};
  const natural = item.naturalPosition ? POSITION_LABEL[item.naturalPosition] : null;
  const autoLabel = isScout
    ? (natural ? `Según su ficha de scouting (${natural})` : "Sin puesto (no sale en el campo)")
    : (natural ? `Según su ficha (${natural})` : "Sin puesto (no sale en el campo)");

  const save = () => {
    const mv = zoneKey === AUTO ? { position: null, side: null } : (isScout ? { position: zoneByKey(zoneKey).pos, side: zoneByKey(zoneKey).side || null } : movePatch(item, zoneByKey(zoneKey)));
    if (isScout) onSaveScout(item, { role, ...mv, note });
    else onSavePlayer(item, { status, leave, ...mv, note });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto" data-testid="plan-item-dialog">
        <DialogHeader>
          <DialogTitle>{playerFullName(s)}</DialogTitle>
          <DialogDescription>
            {[item.year ? `Nacido en ${item.year}` : null, natural || "Sin posición", isScout ? (item.club || null) : (item.injured ? "Lesionado" : null)].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!isScout ? (
            <div>
              <Label>Próxima temporada</Label>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_KEYS.map((k) => (
                  <button key={k} type="button" data-testid={`status-${k}`} onClick={() => setStatus(k)}
                    className={`rounded-lg border-2 px-2 py-2 text-sm font-bold ${status === k ? STATUS_BTN[k] : "border-gray-200 text-gray-500"}`}>{STATUS[k].label}</button>
                ))}
              </div>
              {status === "sale" && (
                <div className="mt-2.5" data-testid="leave-picker">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Tipo de baja</div>
                  <div className="grid grid-cols-2 gap-2">
                    {LEAVE_KEYS.map((k) => (
                      <button key={k} type="button" data-testid={`leave-btn-${k}`} onClick={() => setLeave(leave === k ? null : k)}
                        className={`rounded-lg border-2 px-2 py-1.5 text-sm font-bold ${leave === k ? STATUS_BTN.sale : "border-gray-200 text-gray-500"}`}>{LEAVE[k].label}</button>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">Baja del club: lo decide el club (no renueva). Baja propia: se va el jugador o su familia.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {DECISION[item.decision] && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${DECISION[item.decision].cls}`}>{DECISION[item.decision].label}</span>}
                {item.rating > 0 && <span className="inline-flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`w-3.5 h-3.5 ${i <= item.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />)}</span>}
              </div>
              <div>
                <Label>En el plan es…</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_KEYS.map((k) => (
                    <button key={k} type="button" data-testid={`role-${k}`} onClick={() => setRole(k)}
                      className={`rounded-lg border-2 px-2 py-2 text-sm font-bold ${role === k ? STATUS_BTN[k] : "border-gray-200 text-gray-500"}`}>{ROLE[k].label}</button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">Los objetivos cuentan en la plantilla prevista; los jugadores seguidos, no.</p>
              </div>
            </div>
          )}
          <div>
            <Label>Puesto en el plan</Label>
            <ZoneSelect value={zoneKey} onChange={setZoneKey} autoLabel={autoLabel} testid="plan-zone" />
            {!isScout && !item.position && zoneKey === AUTO && <p className="text-xs text-amber-700 mt-1.5">Sin posición en su ficha: no sale en el campo. Elige un puesto para colocarlo (solo en este plan).</p>}
            {!isScout && item.moved && zoneKey !== AUTO && <p className="text-[11px] text-gray-500 mt-1.5">Colocado a mano: en su ficha de jugador no cambia nada.</p>}
          </div>
          <div>
            <Label>Nota</Label>
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
              <Button type="button" disabled={busy} data-testid="plan-save" onClick={save}>Guardar</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Lista de un puesto: ver a todos los que hay, marcarlo «a reforzar» y añadir a un jugador de scouting. */
export function ZoneDialog({ zone, onClose, onItem, onAdd, onNeed, busy }) {
  const [note, setNote] = useState(zone.need?.note || "");
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="plan-zone-dialog">
        <DialogHeader>
          <DialogTitle>{zoneTitle(zone)}</DialogTitle>
          <DialogDescription>{zone.items.length ? `${zone.items.length} en este puesto` : "Nadie en este puesto todavía"}</DialogDescription>
        </DialogHeader>
        {zone.items.length > 0 && (
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {zone.items.map((it) => <ItemRow key={it.key} item={it} onOpen={onItem} />)}
          </div>
        )}
        <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/70 p-2.5 space-y-2" data-testid="zone-need-box">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-bold text-fuchsia-900 flex items-center gap-1.5"><ChevronsUp className="w-4 h-4" /> Puesto a reforzar</div>
              <p className="text-[11px] text-fuchsia-800/80">Marca los puestos donde hace falta incorporar jugadores.</p>
            </div>
            <Button type="button" size="sm" variant={zone.need ? "outline" : "default"} disabled={busy} data-testid="zone-need-toggle"
              className={zone.need ? "border-fuchsia-300 text-fuchsia-800" : "bg-fuchsia-600 hover:bg-fuchsia-700 text-white"}
              onClick={() => onNeed(zone, !zone.need, note)}>
              {zone.need ? "Quitar" : "Marcar"}
            </Button>
          </div>
          {zone.need && (
            <div className="flex gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qué falta (opcional): ej. un central zurdo" data-testid="zone-need-note" />
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onNeed(zone, true, note)} data-testid="zone-need-save">Guardar</Button>
            </div>
          )}
        </div>
        <Button type="button" onClick={() => onAdd(zone)} data-testid="zone-add-target" style={{ background: "var(--granate)" }} className="text-white">
          <Binoculars className="w-4 h-4 mr-1.5" /> Añadir de scouting aquí
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Elegir un jugador de las listas de Scouting para el plan de este equipo, como objetivo o como jugador seguido. */
export function AddTargetDialog({ scouted, taken, zone, onClose, onPick, busy }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("activos");
  const [role, setRole] = useState("objetivo");
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
          <DialogTitle>Añadir de scouting</DialogTitle>
          <DialogDescription>{zone ? `Se colocará como ${zoneTitle(zone).toLowerCase()}.` : "Se colocará en su posición de scouting."}</DialogDescription>
        </DialogHeader>
        <div>
          <Label>Añadir como…</Label>
          <div className="grid grid-cols-2 gap-2">
            {ROLE_KEYS.map((k) => (
              <button key={k} type="button" data-testid={`add-role-${k}`} onClick={() => setRole(k)}
                className={`rounded-lg border-2 px-2 py-1.5 text-sm font-bold ${role === k ? STATUS_BTN[k] : "border-gray-200 text-gray-500"}`}>{ROLE[k].label}</button>
            ))}
          </div>
        </div>
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
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-100" data-testid="add-list">
          {rows.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">{scouted.length === 0 ? "Todavía no hay jugadores en la pestaña Jugadores de Scouting." : "Ningún jugador con ese filtro."}</p>}
          {rows.map((p) => {
            const inPlan = taken.has(p.id);
            const yr = Number(p.birth_year) || Number(String(p.birth_date || "").slice(0, 4)) || null;
            return (
              <button key={p.id} type="button" disabled={inPlan || busy} onClick={() => onPick(p, role)} data-testid={`add-${p.id}`}
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

