// Misma regla que la sincronización con la FCF: solo en el primer equipo el acta trae todos los cambios,
// así que solo ahí los minutos se calculan solos.
const SLUGS = new Set(['primera_federacio', 'segona_federacio', 'tercera_federacio', 'lliga_elit', 'copa_catalunya_masculina_24_25', 'copa_catalunya_masculina', 'copa_lleida', 'primera_catalana', 'segona_catalana', 'tercera_catalana', 'quarta_catalana']);
export const isPrimerEquipo = (team) => !!team && (SLUGS.has(String(team.category || '')) || /^primer equip/i.test(String(team.name || '')));
