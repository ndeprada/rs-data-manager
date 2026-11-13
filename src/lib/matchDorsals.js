// Dorsales de un partido (13/11/2026, Nacho: «cuando convoco jugadores de otro equipo… coincide que tienen un dorsal que ya
// lo tiene algún jugador del primer equipo que está convocado… quiero que me avises y pueda asignarle un nuevo dorsal»).
// El dorsal de un partido se guarda en la convocatoria (`Convocatoria.match_dorsals = { [player_id]: "23" }`) y solo vale
// para ese partido: la ficha del jugador no cambia. Sin importaciones de la app (se prueba en Node).

const clean = (v) => String(v ?? "").trim();

// Dorsal que lleva en este partido (el del partido si se ha puesto; si no, el de su ficha)
export const matchDorsalOf = (p, dorsals) => clean(dorsals?.[p?.id]) || clean(p?.jersey_number);

// Los jugadores con el dorsal del partido puesto en `jersey_number` (y el de su ficha en `own_jersey_number`)
export function withMatchDorsals(players, dorsals) {
  if (!dorsals || !Object.keys(dorsals).length) return players;
  return (players || []).map((p) => {
    const d = clean(dorsals[p.id]);
    return d && d !== clean(p.jersey_number) ? { ...p, jersey_number: d, own_jersey_number: p.jersey_number ?? null } : p;
  });
}

// Dorsales repetidos entre los convocados: [{ dorsal, players: [...] }]. En cada uno, `change` es a quién conviene
// cambiárselo: los que vienen de otro equipo (`ownTeamId` distinto); si todos son del equipo, el último.
export function dorsalClashes(convocados, dorsals, ownTeamId) {
  const by = new Map();
  for (const p of convocados || []) {
    const d = matchDorsalOf(p, dorsals);
    if (!d) continue;
    if (!by.has(d)) by.set(d, []);
    by.get(d).push(p);
  }
  const out = [];
  for (const [dorsal, list] of by) {
    if (list.length < 2) continue;
    const guests = list.filter((p) => ownTeamId && p.team_id !== ownTeamId);
    const change = guests.length ? (guests.length === list.length ? list.slice(1) : guests) : list.slice(1);
    out.push({ dorsal, players: list, change });
  }
  return out.sort((a, b) => (Number(a.dorsal) || 999) - (Number(b.dorsal) || 999));
}

// Dorsales libres entre los convocados (del 1 al 99), los más bajos primero
export function freeDorsals(convocados, dorsals, n = 6) {
  const used = new Set((convocados || []).map((p) => matchDorsalOf(p, dorsals)).filter(Boolean));
  const out = [];
  for (let i = 2; i <= 99 && out.length < n; i++) if (!used.has(String(i))) out.push(String(i));
  return out;
}

// Lo que se guarda: solo los convocados (`ids`), solo números de 1 a 3 cifras y, si se conoce al jugador, solo si cambia
// el de su ficha (sin la lista de jugadores cargada no se quita nada)
export function cleanMatchDorsals(dorsals, ids, players = []) {
  const byId = new Map((players || []).map((p) => [p.id, p]));
  const out = {};
  for (const id of ids || []) {
    const d = clean(dorsals?.[id]).replace(/[^0-9]/g, "").slice(0, 3);
    if (!d) continue;
    const p = byId.get(id);
    if (p && d === clean(p.jersey_number)) continue;
    out[id] = d;
  }
  return out;
}
