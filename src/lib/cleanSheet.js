import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

// Portería a 0: el portero empezó de titular, jugó todo el partido (sus minutos
// igualan a los más altos registrados en ese partido) y el equipo no encajó gol.
// 0 minutos = no jugó. score_home = nuestros goles, score_away = goles del rival.
export function isCleanSheet(stat, events, allStats = []) {
  const ev = stat.event_id ? events.find((e) => e.id === stat.event_id) : null;
  if (!ev || ev.score_home == null || ev.score_away == null) return false;
  if (Number(ev.score_away) !== 0) return false;
  const mins = Number(stat.minutes_played) || 0;
  if (mins <= 0 || stat.starter === false) return false;
  const maxMins = Math.max(
    mins,
    ...allStats.filter((s) => s.event_id === stat.event_id).map((s) => Number(s.minutes_played) || 0)
  );
  return mins >= maxMins;
}

export function countCleanSheets(stats, events, allStats) {
  return stats.filter((s) => isCleanSheet(s, events, allStats)).length;
}

export function useCleanSheetData(enabled) {
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list(), enabled });
  const { data: allStats = [] } = useQuery({ queryKey: ["matchstats_all"], queryFn: () => base44.entities.MatchStats.list(), enabled });
  return { events, allStats };
}
