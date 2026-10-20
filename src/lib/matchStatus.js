import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePlayerMode } from "@/lib/playerMode";
import { isFinished } from "@/lib/matchTiming";

// Las estadísticas principales y las alertas de "pendiente de gestionar" son solo de partidos de liga
// (competición oficial), ya disputados y completamente cerrados (convocatoria, alineación y minutos).
// Torneos y amistosos no generan alerta (solo un aviso gris) y tienen sus estadísticas aparte.
export const STAT_TYPES = ["partido_liga"];
export const STAT_SCOPES = [
  { value: "liga", label: "Liga", types: ["partido_liga"] },
  { value: "torneo", label: "Torneos", types: ["torneo"] },
  { value: "amistoso", label: "Amistosos", types: ["partido_amistoso"] },
];
export const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];

const minPlayers = (ev) => (ev.football_format === "f7" ? 7 : ev.football_format === "f5" ? 5 : 11);

export { isFinished };

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
  const playerMode = usePlayerMode();
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: convocs = [] } = useQuery({ queryKey: ["convocatorias_all"], queryFn: () => base44.entities.Convocatoria.list() });
  const { data: stats = [] } = useQuery({ queryKey: ["matchstats_all"], queryFn: () => base44.entities.MatchStats.list() });
  return useMemo(() => {
    const now = new Date();
    const convBy = new Map(convocs.map((c) => [c.event_id, c]));
    const statsBy = new Map();
    for (const s of stats) { if (!statsBy.has(s.event_id)) statsBy.set(s.event_id, []); statsBy.get(s.event_id).push(s); }
    const counted = new Set(), pending = new Map(), soft = new Map(), countedOther = new Set();
    for (const ev of events) {
      if (!isFinished(ev, now)) continue;
      if (ev.type === "torneo" || ev.type === "partido_amistoso") {
        // Sin alerta: cuentan en sus propias estadísticas y, si falta algo, solo se avisa en gris
        countedOther.add(ev.id);
        if (!playerMode) { const r = pendingReasons(ev, convBy.get(ev.id), statsBy.get(ev.id)); if (r.length) soft.set(ev.id, r); }
        continue;
      }
      if (!STAT_TYPES.includes(ev.type)) continue;
      // El jugador no ve las estadísticas de sus compañeros: el servidor le indica si el partido está cerrado
      if (playerMode) { if (ev.stats_closed) counted.add(ev.id); else pending.set(ev.id, ["Pendiente de cerrar"]); continue; }
      const reasons = pendingReasons(ev, convBy.get(ev.id), statsBy.get(ev.id));
      if (reasons.length) pending.set(ev.id, reasons); else counted.add(ev.id);
    }
    return { counted, pending, soft, countedOther, events };
  }, [events, convocs, stats, playerMode]);
}

// Deja solo las estadísticas del tipo de partido pedido (por defecto, liga cerrada). Las sin partido asociado
// (entradas manuales antiguas) se mantienen solo en liga.
export function useCountedStats(stats, scope = "liga") {
  const { counted, countedOther, events } = useMatchStatus();
  return useMemo(() => {
    const known = new Map(events.map((e) => [e.id, e]));
    const types = (STAT_SCOPES.find((x) => x.value === scope) || STAT_SCOPES[0]).types;
    return (stats || []).filter((s) => {
      const ev = s.event_id ? known.get(s.event_id) : null;
      if (!ev) return scope === "liga";
      if (!types.includes(ev.type)) return false;
      return scope === "liga" ? counted.has(ev.id) : countedOther.has(ev.id);
    });
  }, [stats, counted, countedOther, events, scope]);
}
