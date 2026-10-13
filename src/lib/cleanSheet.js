// Portería a 0: el portero jugó y su equipo no encajó ningún gol en el partido.
// score_home = nuestros goles, score_away = goles del rival.
export function isCleanSheet(stat, events) {
  const ev = stat.event_id ? events.find((e) => e.id === stat.event_id) : null;
  if (!ev || ev.score_home == null || ev.score_away == null) return false;
  const played = stat.minutes_played != null && stat.minutes_played !== ""
    ? Number(stat.minutes_played) > 0
    : stat.starter !== false;
  return played && Number(ev.score_away) === 0;
}

export function countCleanSheets(stats, events) {
  return stats.filter((s) => isCleanSheet(s, events)).length;
}
