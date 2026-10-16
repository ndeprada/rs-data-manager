import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, RotateCcw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PlayerName from "@/components/common/PlayerName";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcMinutesPlayed } from "@/components/match/ActaTab";

const POS = { portero: "POR", central: "DFC", libre: "LIB", lateral: "LAT", mediocentro: "MC", interior: "INT", extremo: "EXT", delantero_centro: "DC" };

// Valores de un jugador: los que has corregido a mano, o los que salen de los eventos del acta.
export function playerLine(p, stat, matchEvents, starterIds, matchMinutes, isPrimer = false) {
  const mine = matchEvents.filter((e) => e.team === "home");
  const fromEvents = {
    goals: mine.filter((e) => e.type === "goal" && e.playerId === p.id).length,
    assists: mine.filter((e) => e.type === "goal" && e.assistId === p.id).length,
    yellow: mine.filter((e) => e.type === "card" && e.playerId === p.id && e.cardColor === "yellow").length,
    yellow2: mine.filter((e) => e.type === "card" && e.playerId === p.id && e.cardColor === "yellow2").length,
    red: mine.filter((e) => e.type === "card" && e.playerId === p.id && e.cardColor === "red").length,
  };
  const hasSubs = mine.some((e) => e.type === "sub" && (e.playerIn === p.id || e.playerOut === p.id));
  const isStarter = starterIds.includes(p.id);
  const computedMins = isStarter || hasSubs ? calcMinutesPlayed(p.id, starterIds, matchEvents, matchMinutes) : 0;

  if (stat?.manual) {
    return {
      manual: true, starter: stat.starter ?? isStarter,
      minutes: stat.minutes_played ?? null,
      goals: stat.goals || 0, assists: stat.assists || 0,
      yellow: stat.yellow_cards || 0, yellow2: stat.double_yellow_card || 0, red: stat.red_cards || 0,
    };
  }
  // Minutos: el dato guardado; si no, el calculado con los cambios. Sin cambios en el acta no se inventa nada.
  // Primer equipo: el acta trae todos los cambios, así que el titular sin cambio juega todo el partido.
  let minutes = isPrimer && (isStarter || hasSubs) ? computedMins : (stat?.minutes_played > 0 ? stat.minutes_played : (hasSubs && computedMins > 0 ? computedMins : null));
  if (isPrimer && !minutes && !isStarter && !hasSubs) minutes = null;
  return {
    manual: false, starter: isStarter, minutes,
    goals: fromEvents.goals,
    assists: fromEvents.assists || stat?.assists || 0,
    yellow: fromEvents.yellow, yellow2: fromEvents.yellow2, red: fromEvents.red,
  };
}

const Num = ({ v, icon }) => (
  <span className={`w-9 text-center text-xs tabular-nums ${v ? "font-bold text-gray-800" : "text-gray-300"}`}>
    {v ? <>{v}{icon}</> : "–"}
  </span>
);

function Row({ p, line, onEdit }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50/60 group">
      <span className="w-6 text-[10px] font-bold text-gray-400 shrink-0 text-center">{p.jersey_number || ""}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-900 truncate leading-tight"><PlayerName player={p} /></p>
        <p className="text-[10px] text-gray-400 leading-tight">{POS[p.position] || "—"}{line.manual && <span className="ml-1.5 text-green-600 font-bold">editado</span>}</p>
      </div>
      <span className={`w-10 text-center text-xs tabular-nums ${line.minutes ? "font-bold text-gray-800" : "text-gray-300"}`} title={line.minutes ? "" : "Sin datos de minutos: pulsa el lápiz para apuntarlos"}>
        {line.minutes ? `${line.minutes}'` : "—"}
      </span>
      <Num v={line.goals} icon="⚽" />
      <Num v={line.assists} icon="🅰️" />
      <span className="w-9 text-center text-xs">{line.yellow ? <span title="Amarillas">🟨{line.yellow > 1 ? line.yellow : ""}</span> : <span className="text-gray-300">–</span>}</span>
      <span className="w-9 text-center text-xs">{line.red + line.yellow2 ? <span title={line.yellow2 ? "2ª amarilla" : "Roja"}>🟥</span> : <span className="text-gray-300">–</span>}</span>
      <button onClick={() => onEdit(p)} title="Corregir datos" className="text-gray-300 hover:text-gray-700 shrink-0">
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Group({ title, rows, onEdit }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-y border-gray-100 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
        <span className="flex-1">{title} · {rows.length}</span>
        <span className="w-10 text-center">Min</span>
        <span className="w-9 text-center">Gol</span>
        <span className="w-9 text-center">Asis</span>
        <span className="w-9 text-center">Am.</span>
        <span className="w-9 text-center">Roja</span>
        <span className="w-3.5" />
      </div>
      <div className="divide-y divide-gray-50">
        {rows.map(({ p, line }) => <Row key={p.id} p={p} line={line} onEdit={onEdit} />)}
      </div>
    </div>
  );
}

export default function LineupSummary({ eventId, event, convocation, convocados, starterIds, matchEvents, matchMinutes, isPrimer, onRecompute }) {
  const qc = useQueryClient();
  const { data: stats = [] } = useQuery({
    queryKey: ["matchstats-event", eventId],
    queryFn: () => base44.entities.MatchStats.filter({ event_id: eventId }),
    enabled: !!eventId,
  });
  const [edit, setEdit] = useState(null); // { p, form }
  const [saving, setSaving] = useState(false);

  const lines = convocados.map((p) => ({ p, line: playerLine(p, stats.find((s) => s.player_id === p.id), matchEvents, starterIds, matchMinutes, isPrimer) }));
  const titulares = lines.filter((r) => r.line.starter);
  const suplentes = lines.filter((r) => !r.line.starter);
  const tot = (k) => lines.reduce((a, r) => a + (r.line[k] || 0), 0);

  const openEdit = (p) => {
    const l = lines.find((r) => r.p.id === p.id).line;
    setEdit({ p, form: { starter: l.starter ? "1" : "0", minutes: l.minutes ?? "", goals: l.goals, assists: l.assists, yellow: l.yellow, yellow2: l.yellow2, red: l.red } });
  };
  const setF = (k, v) => setEdit((e) => ({ ...e, form: { ...e.form, [k]: v } }));
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["matchstats-event", eventId] });
    qc.invalidateQueries({ queryKey: ["matchstats"] });
    qc.invalidateQueries({ queryKey: ["convocatoria", eventId] });
  };

  const save = async () => {
    setSaving(true);
    try {
      const { p, form } = edit;
      const n = (v) => Math.max(0, Number(v) || 0);
      const existing = stats.find((s) => s.player_id === p.id);
      const starter = form.starter === "1";
      const payload = {
        ...(existing || {}),
        player_id: p.id, event_id: eventId,
        date: existing?.date || event?.date?.split("T")[0] || new Date().toISOString().split("T")[0],
        opponent: existing?.opponent ?? (event?.opponent || ""),
        starter, manual: true,
        minutes_played: form.minutes === "" ? 0 : n(form.minutes),
        goals: n(form.goals), assists: n(form.assists),
        yellow_cards: n(form.yellow), double_yellow_card: n(form.yellow2), red_cards: n(form.red),
      };
      if (existing) await base44.entities.MatchStats.update(existing.id, payload);
      else await base44.entities.MatchStats.create(payload);
      if (convocation && starter !== starterIds.includes(p.id)) {
        const next = starter ? [...starterIds, p.id] : starterIds.filter((id) => id !== p.id);
        await base44.entities.Convocatoria.update(convocation.id, { starters: next });
      }
      refresh();
      setEdit(null);
    } finally { setSaving(false); }
  };

  const restore = async () => {
    setSaving(true);
    try {
      const existing = stats.find((s) => s.player_id === edit.p.id);
      if (existing) await base44.entities.MatchStats.update(existing.id, { ...existing, manual: false });
      await onRecompute?.();
      refresh();
      setEdit(null);
    } finally { setSaving(false); }
  };

  if (convocados.length === 0) return null;
  const F = ({ label, k, w = "w-full" }) => (
    <div className={w}>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{label}</p>
      <Input type="number" min="0" value={edit.form[k]} onChange={(e) => setF(k, e.target.value)} className="h-9 border-gray-200" />
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-gray-900">Alineación y resumen por jugador</p>
          <p className="text-[11px] text-gray-400">Los datos salen de los eventos del acta. Con el lápiz puedes corregir cualquier dato de un jugador a mano.</p>
        </div>
        <p className="text-[11px] text-gray-500 tabular-nums">{tot("goals")} ⚽ · {tot("assists")} 🅰️ · {tot("yellow")} 🟨 · {tot("red") + tot("yellow2")} 🟥</p>
      </div>
      <Group title="Titulares" rows={titulares} onEdit={openEdit} />
      <Group title="Suplentes" rows={suplentes} onEdit={openEdit} />
      {titulares.length === 0 && (
        <p className="px-5 py-3 text-[11px] text-orange-600 bg-orange-50 border-t border-orange-100">No hay titulares marcados en la convocatoria: todos aparecen como suplentes. Puedes marcarlos con el lápiz.</p>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => { if (!o) setEdit(null); }}>
        <DialogContent className="bg-white border-gray-200 max-w-sm">
          <DialogHeader><DialogTitle>{edit ? `${edit.p.first_name} ${edit.p.last_name}` : ""}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">En el partido</p>
                  <Select value={edit.form.starter} onValueChange={(v) => setF("starter", v)}>
                    <SelectTrigger className="h-9 border-gray-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Titular</SelectItem>
                      <SelectItem value="0">Suplente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <F label="Minutos" k="minutes" w="w-24" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <F label="Goles" k="goals" />
                <F label="Asistencias" k="assists" />
                <F label="Amarillas" k="yellow" />
                <F label="2ª amarilla" k="yellow2" />
                <F label="Roja" k="red" />
              </div>
              <p className="text-[10px] text-gray-400">Lo que apuntes aquí se mantiene aunque cambien los eventos o se vuelva a sincronizar con la FCF.</p>
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                {stats.find((s) => s.player_id === edit.p.id)?.manual && (
                  <Button variant="outline" size="sm" onClick={restore} disabled={saving} title="Volver a calcular desde los eventos">
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Automático
                  </Button>
                )}
                <div className="flex-1" />
                <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
                <Button onClick={save} disabled={saving} className="text-white" style={{ background: "var(--granate)" }}>{saving ? "Guardando…" : "Guardar"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
