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
