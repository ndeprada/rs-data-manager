import React, { useMemo, useState } from "react";
import { ArrowRightLeft, Binoculars, ChevronsUp, Eye, Search, Star, Target, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { playerFullName, matchesPlayerSearch } from "@/lib/playerName";
import { teamPlaysF7 } from "@/lib/matchFormat";
import {
  STATUS, STATUS_KEYS, PASS_STATUS_KEYS, LEAVE, LEAVE_KEYS, ROLE, ROLE_KEYS, POSITION_LABEL, zonesFor, zoneByKey, zoneKeyOf, zoneTitle, fitPosition, movePatch, passText, birthYearOf, bulkPassCandidates, bulkPassOps,
} from "@/lib/squadPlan";
import { DOT, STATUS_BTN, DECISION, LEAVE_TAG, PASS_TAG } from "./squadPlanUi";

// Ventanas de la Planificación: una persona del plan, un puesto (lista, a reforzar) y elegir a un jugador de Scouting.

const AUTO = "auto";
const LANE_ORDER = { l: 0, c: 1, r: 2 };
// Los puestos del campo de cada formato (11 o 7), de la portería al ataque
const ZONES_BY_LINE = { f11: [...zonesFor(false)], f7: [...zonesFor(true)] };
for (const k of Object.keys(ZONES_BY_LINE)) ZONES_BY_LINE[k].sort((a, b) => a.line - b.line || LANE_ORDER[a.lane] - LANE_ORDER[b.lane]);

function ZoneSelect({ value, onChange, autoLabel, testid, isF7 = false }) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger data-testid={testid}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={AUTO}>{autoLabel}</SelectItem>
        {ZONES_BY_LINE[isF7 ? "f7" : "f11"].map((z) => <SelectItem key={z.key} value={z.key}>{zoneTitle(z)}</SelectItem>)}
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
      <span className={`font-semibold min-w-0 break-words ${item.status === "sale" ? "line-through text-gray-400" : item.pass === "out" ? "text-gray-500" : "text-gray-900"}`}>{item.name}</span>
      {item.year && <span className="text-xs text-gray-400 tabular-nums shrink-0">{item.year}</span>}
      <span className="text-xs text-gray-500 ml-auto shrink-0">{pos}</span>
      {item.kind === "scout" && DECISION[item.decision] && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${DECISION[item.decision].cls}`}>{DECISION[item.decision].label}</span>
      )}
      {item.status === "sale" && item.leave && <span className={`text-[9px] font-extrabold uppercase px-1 rounded shrink-0 ${LEAVE_TAG}`}>{LEAVE[item.leave].label}</span>}
      {item.pass && <span className={`text-[9px] font-extrabold uppercase px-1 rounded shrink-0 ${PASS_TAG}`}>{passText(item)}</span>}
    </button>
  );
}

const STAY = "stay";

/**
 * Ventana de una persona del plan: estado, tipo de baja, equipo (pase a otro equipo del club), puesto y nota (jugador del club) o tipo, puesto y nota
 * (jugador de scouting). Quien llega de otro equipo (`pass:"in"`) solo cambia aquí su estado, su puesto y su nota, o cancela el pase.
 */
export function ItemDialog({ item, team, teams = [], onClose, onSavePlayer, onSaveScout, onRemoveScout, onCancelPass, busy }) {
  const isScout = item.kind === "scout";
  const incoming = item.pass === "in";
  const [toTeam, setToTeam] = useState(item.pass === "out" ? item.passTeam.id : null);
  const [status, setStatus] = useState(item.pass === "out" ? item.passStatus : item.status);
  // Quien pasa a otro equipo desde el suyo solo continúa o duda (sigue en el club); quien llega al destino también puede quedar como baja
  const statusKeys = !incoming && toTeam && status !== "sale" ? PASS_STATUS_KEYS : STATUS_KEYS;
  const [leave, setLeave] = useState(item.leave || item.passLeave || null);
  const [role, setRole] = useState(isScout ? item.status : "objetivo");
  const [note, setNote] = useState(item.note || "");
  const f7Of = (id) => teamPlaysF7(id ? teams.find((t) => t.id === id) : team); // formato del campo de un equipo (sin id, el de este plan)
  const [zoneKey, setZoneKey] = useState(
    isScout ? item.zone || AUTO
      : item.pass === "out" ? zoneKeyOf(item.passPosition, item.passSide, f7Of(item.passTeam.id)) || AUTO
        : item.moved ? item.zone || AUTO : AUTO,
  );
  const s = item.source || {};
  const otherTeams = teams.filter((t) => t.id !== team?.id);
  const destName = toTeam ? teams.find((t) => t.id === toTeam)?.name || "otro equipo" : null;
  // El puesto se elige en el campo del equipo donde jugará (con pase, el del destino: puede ser de siete y el de aquí de once, o al revés)
  const destF7 = f7Of(toTeam);
  const zonePick = zoneKey !== AUTO && !zonesFor(destF7).some((z) => z.key === zoneKey) ? AUTO : zoneKey; // un puesto que no existe en ese campo vuelve a «según su ficha»
  const pickTeam = (v) => { setToTeam(v === STAY ? null : v); if (v !== STAY && status === "sale") setStatus("continua"); };
  const natural = item.naturalPosition ? POSITION_LABEL[item.naturalPosition] : null;
  const fittedNatural = item.naturalPosition ? fitPosition(item.naturalPosition, destF7) : null; // en fútbol 7, interior/mediocentro… salen como otro puesto
  const naturalText = natural && fittedNatural !== item.naturalPosition ? `${natural} → ${POSITION_LABEL[fittedNatural]} en fútbol 7` : natural;
  const autoLabel = isScout
    ? (natural ? `Según su ficha de scouting (${naturalText})` : "Sin puesto (no sale en el campo)")
    : (natural ? `Según su ficha (${naturalText})` : "Sin puesto (no sale en el campo)");

  const save = () => {
    const zn = zoneByKey(zonePick, destF7);
    const mv = zonePick === AUTO ? { position: null, side: null } : (isScout ? { position: zn.pos, side: zn.side || null } : movePatch(item, zn, destF7));
    if (isScout) onSaveScout(item, { role, ...mv, note });
    else onSavePlayer(item, { status, leave, ...mv, note, ...(incoming ? {} : { toTeam: toTeam || null }) });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto" data-testid="plan-item-dialog">
        <DialogHeader>
          <DialogTitle>{playerFullName(s)}</DialogTitle>
          <DialogDescription>
            {[item.year ? `Nacido en ${item.year}` : null, natural || "Sin posición", isScout ? (item.club || null) : (item.injured ? "Lesionado" : null), incoming ? `Viene de ${item.passTeam.name}` : null].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {incoming && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-2.5" data-testid="pass-banner">
              <div className="text-sm font-bold text-teal-900 flex items-center gap-1.5"><ArrowRightLeft className="w-4 h-4" /> Viene de {item.passTeam.name}</div>
              <p className="text-[11px] text-teal-800 mt-0.5">Solo cuenta en el plan de {team?.name || "este equipo"}: en su ficha de jugador sigue en {item.passTeam.name}.</p>
            </div>
          )}
          {!isScout ? (
            <div>
              <Label>Próxima temporada</Label>
              <div className={`grid gap-2 ${statusKeys === PASS_STATUS_KEYS ? "grid-cols-2" : "grid-cols-3"}`}>
                {statusKeys.map((k) => (
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
                  <p className="text-[11px] text-gray-500 mt-1.5">Baja del club: lo decide el club (no renueva). Baja propia: se va el jugador o su familia.{incoming ? ` No cuenta en la plantilla prevista de ${team?.name || "este equipo"}; en ${item.passTeam.name} sigue saliendo como «Pasa a ${team?.name || "este equipo"}».` : ""}</p>
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
          {!isScout && !incoming && otherTeams.length > 0 && (
            <div data-testid="pass-box">
              <Label>Equipo la próxima temporada</Label>
              <Select value={toTeam || STAY} onValueChange={(v) => v && pickTeam(v)}>
                <SelectTrigger data-testid="plan-pass-team"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={STAY}>Sigue en {team?.name || "este equipo"}</SelectItem>
                  {otherTeams.map((t) => <SelectItem key={t.id} value={t.id}>Pasa a {t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {toTeam && <p className="text-[11px] text-teal-800 mt-1.5" data-testid="pass-hint">Sale de la plantilla prevista de {team?.name || "este equipo"} y entra en la de {destName}, donde saldrá como «viene de {team?.name || "este equipo"}». En su ficha de jugador no cambia nada.</p>}
            </div>
          )}
          <div>
            <Label>{destName ? `Puesto en ${destName}` : "Puesto en el plan"}</Label>
            <ZoneSelect value={zonePick} onChange={setZoneKey} autoLabel={autoLabel} testid="plan-zone" isF7={destF7} />
            {!isScout && !item.position && zonePick === AUTO && <p className="text-xs text-amber-700 mt-1.5">Sin posición en su ficha: no sale en el campo. Elige un puesto para colocarlo (solo en este plan).</p>}
            {!isScout && item.moved && zonePick !== AUTO && <p className="text-[11px] text-gray-500 mt-1.5">Colocado a mano: en su ficha de jugador no cambia nada.</p>}
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
            ) : incoming ? (
              <Button type="button" variant="outline" className="text-red-600 border-red-200" onClick={() => onCancelPass(item)} disabled={busy} data-testid="plan-cancel-pass">
                <Trash2 className="w-4 h-4 mr-1.5" /> Cancelar pase
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
export function ZoneDialog({ zone, onClose, onItem, onAdd, onAddClub, onNeed, busy }) {
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
        <Button type="button" variant="outline" onClick={() => onAddClub(zone)} data-testid="zone-add-club" className="border-teal-300 text-teal-800 hover:bg-teal-50">
          <ArrowRightLeft className="w-4 h-4 mr-1.5" /> Traer de otro equipo aquí
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Elegir un jugador de las listas de Scouting para el plan de este equipo, como objetivo o como jugador seguido. Se puede filtrar por nombre o club,
 * por decisión de scouting y por **años de nacimiento** (varios a la vez; solo salen los años que hay en la lista).
 */
export function AddTargetDialog({ scouted, taken, zone, onClose, onPick, busy }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("activos");
  const [role, setRole] = useState("objetivo");
  const [years, setYears] = useState(() => new Set()); // años de nacimiento elegidos (vacío = todos)
  const byDecision = useMemo(() => scouted.filter((p) => (filter === "activos" ? p.decision !== "descartar" : filter === "todos" ? true : p.decision === filter)), [scouted, filter]);
  const yearChips = useMemo(() => { // los años que hay entre los jugadores de ese filtro (más los elegidos), con cuántos son
    const count = new Map();
    byDecision.forEach((p) => { const y = birthYearOf(p) || 0; count.set(y, (count.get(y) || 0) + 1); });
    years.forEach((y) => { if (!count.has(y)) count.set(y, 0); });
    return [...count.entries()].sort((a, b) => (a[0] === 0) - (b[0] === 0) || a[0] - b[0]);
  }, [byDecision, years]);
  const toggleYear = (y) => setYears((cur) => { const next = new Set(cur); if (next.has(y)) next.delete(y); else next.add(y); return next; });
  const rows = useMemo(() => {
    const list = byDecision.filter((p) => {
      if (search && !matchesPlayerSearch(p, search) && !String(p.current_club || "").toLowerCase().includes(search.toLowerCase())) return false;
      return years.size === 0 || years.has(birthYearOf(p) || 0);
    });
    const samePos = (p) => (zone && fitPosition(p.position, !!zone.f7) === zone.pos ? 0 : 1);
    return list.sort((a, b) => samePos(a) - samePos(b) || (b.rating || 0) - (a.rating || 0) || playerFullName(a).localeCompare(playerFullName(b), "es"));
  }, [byDecision, search, years, zone]);
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
        {yearChips.length > 1 && (
          <div data-testid="add-years">
            <div className="flex items-center justify-between mb-1">
              <Label>Año de nacimiento</Label>
              {years.size > 0 && <button type="button" onClick={() => setYears(new Set())} className="-mt-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800" data-testid="add-years-clear">Quitar filtro</button>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {yearChips.map(([y, n]) => {
                const on = years.has(y);
                return (
                  <button key={y} type="button" aria-pressed={on} onClick={() => toggleYear(y)} data-testid={`add-year-${y || "sin"}`}
                    className={`rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums transition-colors ${on ? "border-[var(--granate)] bg-[var(--granate)] text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}>
                    {y || "Sin año"} <span className={on ? "text-white/70" : "text-gray-400"}>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {scouted.length > 0 && <p className="text-[11px] text-gray-400 -mb-1" data-testid="add-count">{rows.length} jugador{rows.length === 1 ? "" : "es"}{years.size > 0 ? ` de ${[...years].sort((a, b) => a - b).map((y) => y || "sin año").join(", ")}` : ""}</p>}
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-100" data-testid="add-list">
          {rows.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">{scouted.length === 0 ? "Todavía no hay jugadores en la pestaña Jugadores de Scouting." : "Ningún jugador con ese filtro."}</p>}
          {rows.map((p) => {
            const inPlan = taken.has(p.id);
            const yr = birthYearOf(p);
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


/**
 * Traer a un jugador de otro equipo del club al plan de este equipo («viene de…»). Solo cambia el plan: el jugador sigue en su equipo en su ficha.
 * `passes` = Map jugador → equipo al que ya pasa en el plan (para no pisar un pase hecho desde su equipo).
 */
export function AddClubDialog({ players, teams, team, zone, passes, onClose, onPick, busy }) {
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const nameOf = (id) => teams.find((t) => t.id === id)?.name || "Sin equipo";
  const others = teams.filter((t) => t.id !== team?.id);
  const rows = useMemo(() => {
    const list = players.filter((p) => p.team_id && p.team_id !== team?.id && p.status !== "baja"
      && (teamFilter === "all" || p.team_id === teamFilter) && (!search || matchesPlayerSearch(p, search)));
    const samePos = (p) => (zone && fitPosition(p.position, !!zone.f7) === zone.pos ? 0 : 1);
    return list.sort((a, b) => samePos(a) - samePos(b) || nameOf(a.team_id).localeCompare(nameOf(b.team_id), "es") || playerFullName(a).localeCompare(playerFullName(b), "es")).slice(0, 300);
  }, [players, search, teamFilter, zone, team, teams]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg" data-testid="plan-club-dialog">
        <DialogHeader>
          <DialogTitle>Traer de otro equipo</DialogTitle>
          <DialogDescription>
            {zone ? `Saldrá como ${zoneTitle(zone).toLowerCase()} en ${team?.name || "este equipo"}.` : `Saldrá en su puesto de la ficha en ${team?.name || "este equipo"}.`} Solo cambia en el plan: en su ficha de jugador sigue en su equipo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input className="pl-8" placeholder="Buscar por nombre…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="club-search" />
          </div>
          <Select value={teamFilter} onValueChange={(v) => v && setTeamFilter(v)}>
            <SelectTrigger className="w-40" data-testid="club-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los equipos</SelectItem>
              {others.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-100" data-testid="club-list">
          {rows.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">Ningún jugador con ese filtro.</p>}
          {rows.map((p) => {
            const to = passes?.get(p.id) || null;
            const here = to === team?.id;
            const elsewhere = !!to && !here;
            const yr = birthYearOf(p);
            return (
              <button key={p.id} type="button" disabled={here || elsewhere || busy} onClick={() => onPick(p)} data-testid={`club-${p.id}`}
                className="w-full flex items-center gap-2 py-2 px-1 text-left text-sm hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent">
                <span className="font-semibold truncate text-gray-900">{playerFullName(p)}</span>
                {yr && <span className="text-xs text-gray-400 tabular-nums">{yr}</span>}
                <span className="text-xs text-gray-500 truncate">{p.position ? POSITION_LABEL[p.position] : "Sin posición"}</span>
                {here ? <span className="ml-auto text-[10px] font-bold text-teal-700 shrink-0">Ya viene</span>
                  : elsewhere ? <span className="ml-auto text-[10px] font-bold text-gray-500 shrink-0">Ya pasa a {nameOf(to)}</span>
                    : <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${PASS_TAG}`}>{nameOf(p.team_id)}</span>}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}


/**
 * Pasar el equipo entero a otro equipo del club (propuesta inicial): se elige el equipo destino, se desmarca a quien no sigue y se crean todos los pases
 * de golpe. Solo cambia el plan; en su ficha de jugador no cambia nada. `plan` = plan del equipo actual; `onConfirm({ ops, dest })` guarda los pases.
 */
export function BulkPassDialog({ plan, team, teams, onClose, onConfirm, busy }) {
  const [dest, setDest] = useState("");
  const cands = useMemo(() => bulkPassCandidates(plan, dest || null), [plan, dest]);
  const [picked, setPicked] = useState(() => new Set(bulkPassCandidates(plan).filter((c) => c.checked).map((c) => c.id)));
  const others = teams.filter((t) => t.id !== team?.id);
  const destName = dest ? teams.find((t) => t.id === dest)?.name || "otro equipo" : "";
  const selectable = cands.filter((c) => !c.already);
  const n = selectable.filter((c) => picked.has(c.id)).length;
  const toggle = (id) => setPicked((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const tag = (c) => {
    if (c.already) return <span className="text-[10px] font-bold text-teal-700 shrink-0">Ya pasa aquí</span>;
    if (c.passTeam) return <span className="text-[10px] font-bold text-gray-500 shrink-0">Ya pasa a {c.passTeam.name}</span>;
    if (c.status === "sale") return <span className={`text-[9px] font-extrabold uppercase px-1 rounded shrink-0 ${LEAVE_TAG}`}>{LEAVE[c.leave]?.label || STATUS.sale.label}</span>;
    if (c.status === "duda") return <span className="text-[10px] font-bold uppercase text-amber-600 shrink-0">Duda</span>;
    return null;
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto" data-testid="plan-bulk-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-teal-600" /> Pasar el equipo entero</DialogTitle>
          <DialogDescription>
            Los jugadores de {team?.name || "este equipo"} que dejes marcados entran como propuesta en el plan del equipo que elijas. Solo cambia el plan: en su ficha de jugador no cambia nada. Luego podrás marcar bajas o añadir de scouting en el plan del destino.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label>Pasan a…</Label>
          <Select value={dest || undefined} onValueChange={(v) => v && setDest(v)}>
            <SelectTrigger data-testid="bulk-dest"><SelectValue placeholder="Elige el equipo de la próxima temporada" /></SelectTrigger>
            <SelectContent>{others.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Jugadores ({n} de {selectable.length})</Label>
            <div className="flex gap-1 -mt-1.5">
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPicked(new Set(selectable.map((c) => c.id)))} data-testid="bulk-all">Todos</Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPicked(new Set())} data-testid="bulk-none">Ninguno</Button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200" data-testid="bulk-list">
            {cands.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">Este equipo no tiene jugadores en el plan.</p>}
            {cands.map((c) => (
              <label key={c.id} data-testid={`bulk-row-${c.id}`} className={`flex items-center gap-2 px-2.5 py-1.5 text-sm ${c.already ? "opacity-50" : "cursor-pointer hover:bg-gray-50"}`}>
                <Checkbox checked={!c.already && picked.has(c.id)} disabled={c.already} onCheckedChange={() => toggle(c.id)} />
                <span className="font-semibold text-gray-900 truncate">{c.name}</span>
                {c.year && <span className="text-xs text-gray-400 tabular-nums">{c.year}</span>}
                <span className="text-xs text-gray-500 truncate">{c.position ? POSITION_LABEL[c.position] : "Sin posición"}</span>
                <span className="ml-auto">{tag(c)}</span>
              </label>
            ))}
          </div>
        </div>
        {dest && n > 0 && <p className="text-[11px] text-teal-800" data-testid="bulk-hint">En {team?.name || "este equipo"} se verán en gris como «Pasa a {destName}» (dejan de contar) y en {destName} saldrán como «viene de {team?.name || "este equipo"}», en su puesto de la ficha. Lo podrás deshacer jugador a jugador con «Cancelar pase».</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={!dest || n === 0 || busy} data-testid="bulk-confirm"
            onClick={() => onConfirm({ ops: bulkPassOps(cands, [...picked], dest), dest })}>
            {busy ? "Pasando…" : dest && n > 0 ? `Pasar ${n} jugador${n === 1 ? "" : "es"} a ${destName}` : "Pasar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
