// Año de nacimiento: lo importante en fútbol base. Se usa birth_year o, si no existe, el año de birth_date.
export function birthYearOf(p) {
  if (!p) return null;
  if (p.birth_year) return Number(p.birth_year);
  if (p.birth_date) { const y = parseInt(String(p.birth_date).slice(0, 4), 10); return isNaN(y) ? null : y; }
  return null;
}
