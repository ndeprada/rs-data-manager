import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, RotateCcw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PlayerName from "@/components/common/PlayerName";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actaMinutes } from "@/lib/matchDuration";
import { useT, msg } from "@/i18n";
import { RS } from "@/components/rs2/kit";
import { F as clubFont } from "@/lib/brand";
import { subTimes } from "@/lib/actaView";

const POS = { portero: msg("POR"), central: msg("DFC"), libre: msg("LIB"), lateral: msg("LAT"), mediocentro: msg("MC"), interior: msg("INT"), mediapunta: msg("MP"), extremo: msg("EXT"), delantero_centro: msg("DC") };

// Valores de un jugador: los que has corregido a mano, o los que salen de los eventos del acta.
export function playerLine(p, stat, matchEvents, starterIds, matchMinutes) {
  const mine = matchEvents.filter((e) => e.team === "home");
  const fromEvents = {
    goals: mine.filter((e) => e.type === "goal" && e.playerId === p.id).length,
    assists: mine.filter((e) => e.type === "goal" && e.assistId === p.id).length,
    yellow: mine.filter((e) => e.type === "card" && e.playerId === p.id && e.cardColor === "yellow").length,
    yellow2: mine.filter((e) => e.type === "card" && e.playerId === p.id && e.cardColor === "yellow2").length,
    red: mine.filter((e) => e.type === "card" && e.playerId === p.id && e.cardColor === "red").length,
  };
  const isStarter = starterIds.includes(p.id);

  if (stat?.manual) {
    return {
      manual: true, starter: stat.starter ?? isStarter,
      minutes: stat.minutes_played ?? null,
      goals: stat.goals || 0, assists: stat.assists || 0,
      yellow: stat.yellow_cards || 0, yellow2: stat.double_yellow_card || 0, red: stat.red_cards || 0,
    };
  }
  // Minutos según el acta: titular sin cambios = partido completo, suplente sin cambios = 0 (sin guion: 0 minutos)
  const minutes = actaMinutes(p.id, starterIds, matchEvents, matchMinutes, stat?.minutes_played || 0);
  return {
    manual: false, starter: isStarter, minutes,
    goals: fromEvents.goals,
    assists: fromEvents.assists || stat?.assists || 0,
    yellow: fromEvents.yellow, yellow2: fromEvents.yellow2, red: fromEvents.red,
  };
}

// Columnas de la tabla (13/11/2026, maqueta del Acta): la posición va en su columna y cada jugador ocupa una línea
const COLS = { pos: 40, sub: 70, min: 44, n: 34, edit: 26 };
const Num = ({ v, children }) => (
  <span className="text-center text-[13px] tabular-nums shrink-0" style={{ width: COLS.n, fontWeight: v ? 700 : 400, color: v ? RS.ink : "#C9BDBE" }}>
    {v ? (children || v) : "–"}
  </span>
);
const CardMark = ({ red }) => <span className="inline-block rounded-[2px] align-[-1px]" style={{ width: 9, height: 12, background: red ? "#DC2626" : "#FACC15" }} />;

function Row({ p, line, onEdit, sub, minimum, perf }) {
  const t = useT();
  const missing = line.starter && !line.minutes;
  const benched = !line.starter && !line.minutes;
  // Por debajo del mínimo por partido (14/11/2026): 25' en F11, la mitad del partido en F7; solo con el partido jugado
  const below = minimum != null && !missing && (line.minutes || 0) < minimum;
  const subLabel = sub.into !== null && sub.out !== null ? `${sub.into}’–${sub.out}’` : sub.into !== null ? t("entra {m}’", { m: sub.into }) : sub.out !== null ? t("sale {m}’", { m: sub.out }) : "";
  return (
    <div className="flex items-center gap-1.5 px-2 hover:bg-[#FBF7F6]" style={{ height: 30, borderTop: `1px solid ${RS.lineSoft}`, opacity: benched ? 0.55 : 1, background: missing ? "#FFF8F1" : undefined }} data-testid={`lineup-row-${p.id}`}>
      <span className="w-6 text-right shrink-0" style={{ fontFamily: clubFont.title, fontSize: 15, lineHeight: 1, color: RS.granate }}>{p.jersey_number ?? ""}</span>
      <span className="flex-1 min-w-0 truncate text-[13px] font-bold" style={{ color: RS.ink }}>
        <PlayerName player={p} />{line.manual && <span className="ml-1.5 text-[10px] font-bold text-green-700">{t("editado")}</span>}
      </span>
      <span className="shrink-0 text-[11px] font-bold" style={{ width: COLS.pos, color: RS.muted }}>{POS[p.position] ? t(POS[p.position]) : "—"}</span>
      <span className="shrink-0 text-[11px] whitespace-nowrap" style={{ width: COLS.sub, color: sub.into !== null && sub.out === null ? "#15803D" : "#9A3412" }}>{subLabel}</span>
      <span className="shrink-0 text-center text-[13px] tabular-nums" style={{ width: COLS.min }}
        title={below ? (perf ? t("Por debajo del mínimo por partido ({m}’, orientativo)", { m: minimum }) : t("Por debajo del mínimo por partido ({m}’)", { m: minimum })) : line.minutes ? "" : line.starter ? t("Sin minutos: pulsa el lápiz para apuntarlos") : t("No ha entrado en ningún cambio: 0 minutos")}
        data-below={below ? "1" : undefined}>
        {missing
          ? <span className="inline-block w-full rounded font-bold" style={{ color: "#B91C1C", background: "#FEF2F2" }}>?</span>
          : below
            ? <span className="inline-block w-full rounded font-bold" style={{ color: perf ? "#92400E" : "#B45309", background: perf ? "#FEF9EC" : "#FEF3C7" }}>{line.minutes || 0}’</span>
            : <span style={{ fontWeight: line.minutes ? 700 : 400, color: line.minutes ? RS.ink : "#C9BDBE" }}>{line.minutes || 0}’</span>}
      </span>
      <Num v={line.goals} />
      <Num v={line.assists} />
      <Num v={line.yellow}>{line.yellow ? <span title={t("Amarillas")}><CardMark />{line.yellow > 1 ? line.yellow : ""}</span> : null}</Num>
      <Num v={line.red + line.yellow2}>{line.red + line.yellow2 ? <span title={line.yellow2 ? t("2ª amarilla") : t("Roja")}><CardMark red /></span> : null}</Num>
      <button type="button" onClick={() => onEdit(p)} title={t("Corregir datos")} aria-label={t("Corregir datos")} className="shrink-0 flex justify-center hover:text-gray-800" style={{ width: COLS.edit, color: RS.muted }}>
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Group({ title, rows, onEdit, subs, minimum, perf }) {
  const t = useT();
  if (rows.length === 0) return null;
  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ borderLeft: `3px solid ${RS.naranja}`, background: RS.head, color: RS.muted }}>
        <span className="flex-1" style={{ fontFamily: clubFont.title, fontSize: 13, letterSpacing: ".02em", color: RS.granateDark }}>{title} · {rows.length}</span>
        <span style={{ width: COLS.pos }}>{t("Pos.")}</span>
        <span style={{ width: COLS.sub }}>{t("Cambio")}</span>
        <span className="text-center" style={{ width: COLS.min }}>{t("Min")}</span>
        <span className="text-center" style={{ width: COLS.n }}>{t("Gol")}</span>
        <span className="text-center" style={{ width: COLS.n }}>{t("As.")}</span>
        <span className="text-center" style={{ width: COLS.n }}>{t("Am.")}</span>
        <span className="text-center" style={{ width: COLS.n }}>{t("Roja")}</span>
        <span style={{ width: COLS.edit }} />
      </div>
      {rows.map(({ p, line }) => <Row key={p.id} p={p} line={line} onEdit={onEdit} sub={subs(p.id)} minimum={minimum} perf={perf} />)}
    </div>
  );
}

export default function LineupSummary({ eventId, event, convocation, convocados, starterIds, matchEvents, matchMinutes, onRecompute, minimum: minIn = null, perf = false }) {
  const t = useT();
  const qc = useQueryClient();
  const { data: stats = [] } = useQuery({
    queryKey: ["matchstats-event", eventId],
    queryFn: () => base44.entities.MatchStats.filter({ event_id: eventId }),
    enabled: !!eventId,
  });
  const [edit, setEdit] = useState(null); // { p, form }
  const [saving, setSaving] = useState(false);

  const lines = convocados.map((p) => ({ p, line: playerLine(p, stats.find((s) => s.player_id === p.id), matchEvents, starterIds, matchMinutes) }));
  const titulares = lines.filter((r) => r.line.starter);
  const suplentes = lines.filter((r) => !r.line.starter);
  const tot = (k) => lines.reduce((a, r) => a + (r.line[k] || 0), 0);
  // El mínimo por partido solo se mira con el partido ya jugado
  const played = !!event?.date && new Date(event.date) <= new Date();
  const minimum = played && minIn ? minIn : null;
  const belowRows = minimum == null ? [] : lines.filter((r) => !(r.line.starter && !r.line.minutes) && (r.line.minutes || 0) < minimum);

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

  const subs = (id) => subTimes(id, matchEvents);
  return (
    <div className="bg-white rounded-xl overflow-hidden pb-1" style={{ border: `1px solid ${RS.line}` }} data-testid="acta-lineup-card">
      <div className="px-4 pt-3 pb-1 flex items-center gap-x-3 gap-y-2 flex-wrap">
        <span className="flex items-center gap-1.5"><span style={{ width: 3, height: 14, background: RS.naranja, borderRadius: 2 }} /><span style={{ fontFamily: clubFont.title, fontSize: 17, lineHeight: 1, color: RS.granate }}>{t("Alineación y resumen por jugador")}</span></span>
        <span className="flex gap-1.5 text-[12px] tabular-nums" style={{ color: RS.ink2 }}>
          <span className="rounded-full px-2 py-0.5" style={{ background: RS.head }}>⚽ {tot("goals")}</span>
          <span className="rounded-full px-2 py-0.5" style={{ background: RS.head }}>{t("{n} asist.", { n: tot("assists") })}</span>
          <span className="rounded-full px-2 py-0.5" style={{ background: RS.head }}><CardMark /> {tot("yellow")}</span>
          <span className="rounded-full px-2 py-0.5" style={{ background: RS.head }}><CardMark red /> {tot("red") + tot("yellow2")}</span>
        </span>
        {starterIds.length > 0 && onRecompute && (
          <Button variant="outline" size="sm" className="h-7 text-xs border-gray-200 ml-auto" disabled={saving} title={t("Volver a calcular los minutos de todos desde el acta (lo corregido a mano no se toca)")}
            onClick={async () => { setSaving(true); try { await onRecompute(); refresh(); } finally { setSaving(false); } }}>
            <RotateCcw className="w-3 h-3 mr-1" /> {t("Recalcular minutos")}
          </Button>
        )}
      </div>
      {belowRows.length > 0 && (
        <p className="mx-4 mt-1 px-2 py-1.5 rounded text-[11px]" style={{ color: "#92400E", background: "#FEF3C7" }} data-testid="acta-below-min">
          <b>{belowRows.length === 1
            ? t("1 convocado por debajo del mínimo de {m}’:", { m: minimum })
            : t("{n} convocados por debajo del mínimo de {m}’:", { n: belowRows.length, m: minimum })}</b>{" "}
          {belowRows.map((r) => `${r.p.nickname || r.p.first_name} ${String(r.p.last_name || "").split(" ")[0]} (${r.line.minutes || 0}’)`).join(" · ")}
          {perf && <span style={{ opacity: 0.8 }}> · {t("orientativo en esta etapa")}</span>}
        </p>
      )}
      {!event?.match_duration && (
        <p className="mx-4 mt-1 px-2 py-1.5 rounded text-[11px] text-orange-700 bg-orange-50">
          {t("Duración supuesta: {matchMinutes}' (la habitual de este equipo). Si este partido ha sido distinto, cámbiala en «Formato y resultado»: se guarda sola y los minutos se recalculan.", { matchMinutes })}
        </p>
      )}
      <div className="px-2">
        <Group title={t("Titulares")} rows={titulares} onEdit={openEdit} subs={subs} minimum={minimum} perf={perf} />
        <Group title={t("Suplentes")} rows={suplentes} onEdit={openEdit} subs={subs} minimum={minimum} perf={perf} />
      </div>
      <p className="px-4 pt-2 text-[11px]" style={{ color: RS.muted }}>{t("Titular sin cambios = partido completo; suplente sin cambios = 0’. El lápiz corrige a mano cualquier dato.")}</p>
      {titulares.length === 0 && (
        <p className="px-5 py-3 text-[11px] text-orange-600 bg-orange-50 border-t border-orange-100">{t("No hay titulares marcados en la convocatoria: todos aparecen como suplentes. Puedes marcarlos con el lápiz.")}</p>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => { if (!o) setEdit(null); }}>
        <DialogContent className="bg-white border-gray-200 max-w-sm">
          <DialogHeader><DialogTitle>{edit ? `${edit.p.first_name} ${edit.p.last_name}` : ""}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{t("En el partido")}</p>
                  <Select value={edit.form.starter} onValueChange={(v) => setF("starter", v)}>
                    <SelectTrigger className="h-9 border-gray-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">{t("Titular")}</SelectItem>
                      <SelectItem value="0">{t("Suplente")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <F label={t("Minutos")} k="minutes" w="w-24" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <F label={t("Goles")} k="goals" />
                <F label={t("Asistencias de gol")} k="assists" />
                <F label={t("Amarillas")} k="yellow" />
                <F label={t("2ª amarilla")} k="yellow2" />
                <F label={t("Roja")} k="red" />
              </div>
              <p className="text-[10px] text-gray-400">{t("Lo que apuntes aquí se mantiene aunque cambien los eventos o se vuelva a sincronizar con la FCF.")}</p>
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                {stats.find((s) => s.player_id === edit.p.id)?.manual && (
                  <Button variant="outline" size="sm" onClick={restore} disabled={saving} title={t("Volver a calcular desde los eventos")}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> {t("Automático")}
                  </Button>
                )}
                <div className="flex-1" />
                <Button variant="outline" onClick={() => setEdit(null)}>{t("Cancelar")}</Button>
                <Button variant="club" onClick={save} disabled={saving}>{saving ? t("Guardando…") : t("Guardar")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
