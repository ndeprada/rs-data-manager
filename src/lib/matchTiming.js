// Cuándo termina un partido y cuándo toca avisar de que falta la convocatoria.
// Sin dependencias de la app para poder probarlo solo.

const HOUR = 3600 * 1000;

// Horas antes del partido a partir de las cuales se avisa de que no hay convocatoria.
export const CONVOCATORIA_WARN_HOURS = 24;

export function endOfMatch(ev) {
  return ev.end_date ? new Date(ev.end_date) : new Date(new Date(ev.date).getTime() + 2 * HOUR);
}

export function isFinished(ev, now = new Date()) {
  return endOfMatch(ev) < now;
}

// Aviso de "partido sin convocatoria":
//   'soon'   → faltan 24 h o menos (o el partido está en juego) y no hay convocatoria
//   'played' → el partido ya se ha disputado y no se hizo convocatoria
//   null     → no hay nada que avisar (hay convocatoria, o el partido está todavía lejos)
export function convocatoriaAlert(ev, hasConvocatoria, now = new Date()) {
  if (hasConvocatoria) return null;
  const start = new Date(ev.date).getTime();
  if (Number.isNaN(start)) return null;
  if (isFinished(ev, now)) return "played";
  return start - now.getTime() <= CONVOCATORIA_WARN_HOURS * HOUR ? "soon" : null;
}
