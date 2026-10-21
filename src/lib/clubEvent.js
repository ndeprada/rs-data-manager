// Evento de todo el club (una celebración, una reunión general…): se crea una copia en cada equipo, todas con el mismo
// club_event_id, para que cada equipo lo vea en su calendario y en el de su móvil sin tocar nada más.
export const CLUB_EVENT_TYPE = "evento_club";
export const CLUB_ALL = "__all__"; // valor del selector de equipo: «Todos los equipos del club»

export const isClubEvent = (ev) => !!ev?.club_event_id;

// Copias del evento (una por equipo) a partir de los datos comunes
export function clubEventCopies(base, teams, groupId) {
  const seen = new Set();
  return (teams || []).filter((t) => t?.id && !seen.has(t.id) && seen.add(t.id)).map((t) => ({ ...base, team_id: t.id, club_event_id: groupId }));
}

// Las demás copias del mismo evento de club (incluida la propia)
export const clubSiblings = (events, ev) => (isClubEvent(ev) ? (events || []).filter((e) => e.club_event_id === ev.club_event_id) : []);
