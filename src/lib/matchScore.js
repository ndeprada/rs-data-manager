// Marcador de un partido.
// Convención de los datos: score_home = goles de NUESTRO equipo, score_away = goles del rival (no «local»/«visitante»);
// is_home indica si jugamos en casa (false = jugamos fuera).
// Para enseñar un marcador junto a los dos equipos se usa el orden de cualquier resultado de fútbol: local - visitante.
// Si jugamos fuera, el rival es el local y su gol va primero (Bufalá 2 - 1 Racing Sarrià).

export const playsAway = (m) => m?.is_home === false;

/** { ours, theirs, left, right, away } o null si el partido no tiene resultado. `left`/`right` van en orden local-visitante. */
export function scoreParts(m) {
  if (!m || (m.score_home == null && m.score_away == null)) return null;
  const ours = Number(m.score_home ?? 0);
  const theirs = Number(m.score_away ?? 0);
  const away = playsAway(m);
  return { ours, theirs, left: away ? theirs : ours, right: away ? ours : theirs, away };
}

/** Texto para el tooltip: «Bufalà 2 - 1 Nosotros» (o «Nosotros 3 - 1 Rival» en casa). undefined si no hay resultado. */
export function scoreTitle(m, ourName, t = (s) => s) {
  const p = scoreParts(m);
  if (!p) return undefined;
  const rival = m.opponent || t("Rival");
  const us = ourName || t("Nosotros");
  return p.away ? `${rival} ${p.left} - ${p.right} ${us}` : `${us} ${p.left} - ${p.right} ${rival}`;
}

/** «2 - 1» en orden local-visitante (o null si no hay resultado) */
export function scoreText(m, sep = " - ") {
  const p = scoreParts(m);
  return p ? `${p.left}${sep}${p.right}` : null;
}
