// Jugadores de un partido: la plantilla del equipo + los invitados (jugadores de otros equipos del club que están
// convocados, alineados o aparecen en el acta). Sin los invitados, un jugador del Sub-9 convocado con el Sub-10
// desaparecería del acta, del post-partido y de la pizarra aunque estuviera convocado.

export function matchPlayerIds(convocation, event) {
  const ids = new Set();
  const add = (v) => { if (v && typeof v === "string") ids.add(v); };
  (convocation?.player_ids || []).forEach(add);
  (convocation?.starters || []).forEach(add);
  for (const e of event?.match_events || []) { add(e.playerId); add(e.playerIn); add(e.playerOut); add(e.assistId); }
  for (const g of event?.goal_events || []) { add(g.player_id); add(g.assist_player_id); }
  return ids;
}

export function withGuests(teamPlayers, allPlayers, ids) {
  const team = teamPlayers || [];
  if (!ids?.size || !allPlayers?.length) return team;
  const have = new Set(team.map((p) => p.id));
  const guests = allPlayers.filter((p) => ids.has(p.id) && !have.has(p.id));
  return guests.length ? [...team, ...guests] : team;
}
