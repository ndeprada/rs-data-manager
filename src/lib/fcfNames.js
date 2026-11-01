// Nombres tal como vienen de la FCF («PUIG MAS, JAN», «ESCOLA PIA SARRIÀ S.E. "A"», «CADET SEGONA DIVISIÓ S15»)
// pasados a una forma legible. Sin importaciones de la app (tests en tests/fcfNames.test.mjs).
const KEEP = /^(S\d{1,2}|[IVX]+|"[A-Z]"|[A-Z]\.([A-Z]\.)*[A-Z]?\.?)$/;
const SMALL = new Set(['de', 'del', 'la', 'les', 'el', 'i', 'y', 'dels']);

export function titleCase(s) {
  if (!s) return '';
  return String(s).trim().split(/\s+/).map((w, i) => {
    const low = w.toLocaleLowerCase('es');
    if (i > 0 && SMALL.has(low)) return low;
    if (KEEP.test(w) && (w.length <= 3 || w.includes('.') || w.startsWith('"'))) return w;
    // Siglas con puntos y comas («U.E.,CF.», «C.F.»): se quedan en mayúsculas
    if (/^[A-Z.,]+$/.test(w) && w.includes('.') && w.replace(/[.,]/g, '').length <= 5) return w;
    return low.replace(/(^|[-'’(])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('es'));
  }).join(' ');
}

export function fcfNameParts(name) {
  const [last, first] = String(name || '').split(',').map((x) => x.trim());
  return { first_name: titleCase(first || ''), last_name: titleCase(last || '') };
}

export function fcfDisplayName(name) {
  const { first_name, last_name } = fcfNameParts(name);
  return [first_name, last_name].filter(Boolean).join(' ') || titleCase(name);
}

export const shortComp = (c) => titleCase(c);

// Los equipos de la FCF llevan la letra al final («CAN BUXERES, F.C. A», «SANT ANDREU, U.E F»; en algunas actas, «CLUB "B"»)
const TEAM_LETTER = /\s+["'«]?([A-Z])["'»]?$/;
const plain = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
/** Letra del equipo (A, B, C…) o null. */
export const teamLetter = (team) => plain(team).trim().match(TEAM_LETTER)?.[1] || null;
/** Club de un equipo, sin la letra, los acentos ni la puntuación: para saber si un jugador ha cambiado de club. */
export const clubOf = (team) => plain(team).trim().replace(TEAM_LETTER, '').replace(/[.,'"«»]/g, ' ').replace(/\s+/g, ' ').trim();

// Procedencia (equipo de la temporada anterior) comparada con su equipo actual (02/11/2026, Nacho: «continúan, promocionados
// o fichados»): 'none' = sin actas · 'same' = mismo equipo · 'up' = sube de otro equipo del club (de una categoría inferior,
// p. ej. del cadete al juvenil, o de un equipo con letra posterior, del «C» al «A») · 'club' = otro equipo del club que no es
// una subida · 'new' = viene de otro club. `lvl` = edad de la categoría (S15 = 15, juvenil = 17).
export function originKind(prev, team, lvl = null) {
  if (!prev?.team) return 'none';
  if (clubOf(prev.team) !== clubOf(team)) return 'new';
  // (el cadete A y el juvenil A del mismo club se llaman igual: manda la categoría)
  const a = Number(prev.lvl), b = Number(lvl);
  if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 && a !== b) return a < b ? 'up' : 'club';
  if (plain(prev.team).trim() === plain(team).trim()) return 'same';
  const la = teamLetter(prev.team), lb = teamLetter(team);
  if (la && lb && la !== lb) return lb < la ? 'up' : 'club';
  return 'club';
}
