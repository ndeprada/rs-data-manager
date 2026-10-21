// Evento en varios equipos a la vez (una celebración del club, una reunión de todos los equipos de fútbol 7…): se crea una
// copia en cada equipo, todas con el mismo club_event_id, para que cada equipo lo vea en su calendario y en el de su móvil.
export const CLUB_EVENT_TYPE = "evento_club";

export const isClubEvent = (ev) => !!ev?.club_event_id;

// Copias del evento (una por equipo) a partir de los datos comunes
export function clubEventCopies(base, teams, groupId) {
  const seen = new Set();
  return (teams || []).filter((t) => t?.id && !seen.has(t.id) && seen.add(t.id)).map((t) => ({ ...base, team_id: t.id, club_event_id: groupId }));
}

// Las demás copias del mismo evento de club (incluida la propia)
export const clubSiblings = (events, ev) => (isClubEvent(ev) ? (events || []).filter((e) => e.club_event_id === ev.club_event_id) : []);

// Selecciones rápidas de equipos: todos, solo fútbol 11 o solo fútbol 7. `isF7` decide a qué formato pertenece cada equipo.
export function teamSets(teams, isF7) {
  const list = (teams || []).filter((t) => t?.id);
  const ids = (arr) => arr.map((t) => t.id);
  return [
    { key: "all", label: "Todos", ids: ids(list) },
    { key: "f11", label: "Fútbol 11", ids: ids(list.filter((t) => !isF7(t))) },
    { key: "f7", label: "Fútbol 7", ids: ids(list.filter((t) => isF7(t))) },
  ].filter((s) => s.ids.length > 0);
}

// A quién llega el evento, en pocas palabras: «Todo el club», «Juvenil A, Cadet S16 A» o «5 equipos»
export function scopeLabel(selected, allTeams, maxNames = 3) {
  const sel = (selected || []).filter((t) => t?.id);
  if (sel.length === 0) return "";
  if (allTeams?.length > 1 && sel.length >= allTeams.length) return "Todo el club";
  if (sel.length <= maxNames) return sel.map((t) => t.name).join(", ");
  return `${sel.length} equipos`;
}
