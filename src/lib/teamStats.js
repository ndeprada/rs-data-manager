// Estadísticas por equipo: cada partido cuenta para el equipo CON EL QUE SE JUEGA.
// Lo que un jugador hace como invitado en otro equipo del club (p. ej. un Sub-9 que juega con el Sub-10) aparece en
// ese otro equipo y NO suma a las estadísticas de su equipo de origen, que solo cuenta sus propios partidos.

// Equipo al que pertenece una fila de estadísticas: el del partido; si no se conoce, el del jugador.
export function statTeamResolver(events, players) {
  const evTeam = new Map((events || []).map((e) => [e.id, e.team_id]));
  const plTeam = new Map((players || []).map((p) => [p.id, p.team_id]));
  return (s) => (s?.event_id && evTeam.get(s.event_id)) || plTeam.get(s?.player_id) || null;
}

// Filas de estadísticas de un equipo
export function statsOfTeam(stats, teamId, teamOf) {
  return (stats || []).filter((s) => teamOf(s) === teamId);
}
