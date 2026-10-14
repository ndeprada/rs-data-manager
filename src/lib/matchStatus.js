import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Solo cuentan para estadísticas los partidos de liga y torneo (no amistosos),
// ya disputados y completamente cerrados (convocatoria, alineación y minutos).
export const STAT_TYPES = ["partido_liga", "torneo"];
export const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];

const minPlayers = (ev) => (ev.football_format === "f7" ? 7 : ev.football_format === "f5" ? 5 : 11);

export function isFinished(ev, now = new Date()) {
  const end = ev.end_date ? new Date(ev.end_date) : new Date(new Date(ev.date).getTime() + 2 * 3600 * 1000);
  return end < now;
}

// Motivos por los que un partido disputado sigue pendiente de gestionar.
export function pendingReasons(ev, conv, evStats) {
  const n = minPlayers(ev);
  const reasons = [];
  const called = conv?.player_ids?.length || 0;
  if (!conv || called === 0) reasons.push("Sin convocatoria");
  else if (called < n) reasons.push(`Convocados: ${called} (mín. ${n})`);
  const starters = conv?.starters || [];
  if (starters.length < n) reasons.push(starters.length ? `Alineación incompleta (${starters.length}/${n})` : "Sin alineación");
  else {
    const noMin = starters.filter((id) => !(evStats || []).some((s) => s.player_id === id && (s.minutes_played || 0) > 0)).length;
    if (noMin) reasons.push("Faltan minutos/cambios");
  }
  return reasons;
}

// Estado de todos los partidos (liga/torneo) ya disputados.
export function useMatchStatus() {
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: convocs = [] } = useQuery({ queryKey: ["convocatorias_all"], queryFn: () => base44.entities.Convocatoria.list() });
  const { data: stats = [] } = useQuery({ queryKey: ["matchstats_all"], queryFn: () => base44.entities.MatchStats.list() });
  return useMemo(() => {
    const now = new Date();
    const convBy = new Map(convocs.map((c) => [c.event_id, c]));
    const statsBy = new Map();
    for (const s of stats) { if (!statsBy.has(s.event_id)) statsBy.set(s.event_id, []); statsBy.get(s.event_id).push(s); }
    const counted = new Set(), pending = new Map();
    for (const ev of events) {
      if (!STAT_TYPES.includes(ev.type) || !isFinished(ev, now)) continue;
      const reasons = pendingReasons(ev, convBy.get(ev.id), statsBy.get(ev.id));
      if (reasons.length) pending.set(ev.id, reasons); else counted.add(ev.id);
    }
    return { counted, pending, events };
  }, [events, convocs, stats]);
}

// Deja solo las estadísticas de partidos contabilizables. Las sin partido asociado (entradas manuales antiguas) se mantienen.
export function useCountedStats(stats) {
  const { counted, events } = useMatchStatus();
  return useMemo(() => {
    const known = new Map(events.map((e) => [e.id, e]));
    return (stats || []).filter((s) => {
      if (!s.event_id || !known.has(s.event_id)) return true;
      return counted.has(s.event_id);
    });
  }, [stats, counted, events]);
}
