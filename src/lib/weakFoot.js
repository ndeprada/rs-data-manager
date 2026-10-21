// Dominio de la pierna no hábil, al estilo del «pie malo» del FIFA: de 1 a 5 estrellas.
// Es una valoración interna del cuerpo técnico: el jugador no la recibe (ver playerView en api/_lib/access.js).
// Un jugador ambidiestro cuenta siempre con 5 estrellas, sin necesidad de rellenarlo.

import { msg, interpolate } from '../i18n/translate.js';

export const WEAK_FOOT_FIELD = 'weak_foot_rating';

export const WEAK_FOOT_LEVELS = {
  5: { label: msg('Ambidiestro'), hint: msg('Juega igual con las dos piernas'), color: '#22c55e' },
  4: { label: msg('Muy buena'), hint: msg('La usa con confianza y con calidad'), color: '#84cc16' },
  3: { label: msg('Normal'), hint: msg('Correcta: resuelve sin problemas'), color: '#eab308' },
  2: { label: msg('Floja'), hint: msg('La evita o pierde calidad'), color: '#f97316' },
  1: { label: msg('Muy floja'), hint: msg('Casi no la usa'), color: '#ef4444' },
};

export const isValidWeakFoot = (v) => Number.isInteger(v) && v >= 1 && v <= 5;

// Valoración vigente del jugador: 5 si es ambidiestro; si no, la guardada (1–5) o null si no se ha valorado
export function weakFootRating(player) {
  if (!player) return null;
  if (player.laterality === 'ambidiestro') return 5;
  const n = Number(player[WEAK_FOOT_FIELD]);
  return isValidWeakFoot(n) ? n : null;
}

export const weakFootColor = (rating) => WEAK_FOOT_LEVELS[rating]?.color || null;
export const weakFootLabel = (rating) => WEAK_FOOT_LEVELS[rating]?.label || '';

// Pie no hábil según la lateralidad: el diestro usa mal la izquierda y el zurdo la derecha
export function weakSide(laterality) {
  if (laterality === 'diestro') return 'left';
  if (laterality === 'zurdo') return 'right';
  return null;
}

// t = función de traducción (opcional): sin ella sale en español
export function weakFootText(rating, t = interpolate) {
  return isValidWeakFoot(rating)
    ? t('Pierna no hábil: {nivel} ({n}/5)', { nivel: t(weakFootLabel(rating)), n: rating })
    : t('Pierna no hábil: sin valorar');
}
