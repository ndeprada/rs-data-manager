// Reconocer en el acta de la FCF a jugadores del club que juegan con OTRO equipo del club.
//
// Caso típico: un jugador del Sub-9 A es convocado un fin de semana con el Sub-10 A. El acta del Sub-10 A lo lista y,
// si solo se busca en la plantilla del Sub-10 A, parece un jugador nuevo y se le crea una ficha duplicada.
// Aquí se busca también entre el resto de jugadores del club (misma temporada) por nombre y apellidos.

export const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
export const norm = (s) => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Mismos nombre y apellidos en cualquier orden, sin tildes ni mayúsculas
export const tokensKey = (s) => norm(s).split(' ').filter(Boolean).sort().join(' ');

// Con un solo nombre ("Marc", "Nicolás", "Jugador/a") no hay forma fiable de saber si es la misma persona.
const MIN_TOKENS = 2;

export function buildGuestIndex(playerRows, teamRows) {
  const seasonOf = new Map(teamRows.map((r) => [r.id, clean(r.data.season)]));
  const byKey = new Map(); // clave -> [{ id, team_id }]

  const add = (key, id, teamId) => {
    if (!key || key.split(' ').length < MIN_TOKENS) return;
    if (!byKey.has(key)) byKey.set(key, []);
    const list = byKey.get(key);
    if (!list.some((c) => c.id === id)) list.push({ id, team_id: teamId });
  };

  for (const r of playerRows) {
    const d = r.data || {};
    if (d.archived_season || d.status === 'baja') continue;
    add(tokensKey(`${d.first_name || ''} ${d.last_name || ''}`), r.id, d.team_id);
  }

  return {
    // Jugador de otro equipo del club (misma temporada) con ese nombre. Solo si hay uno: con dos o más
    // coincidencias no se adivina y se devuelve '' (el llamador hará lo de siempre).
    find(teamId, key) {
      const list = byKey.get(key);
      if (!list) return '';
      const season = seasonOf.get(teamId) || '';
      const others = list.filter((c) => c.team_id !== teamId && (!season || !seasonOf.get(c.team_id) || seasonOf.get(c.team_id) === season));
      return others.length === 1 ? others[0].id : '';
    },
    // Para jugadores recién creados en esta misma sincronización (aún sin guardar)
    add,
  };
}
