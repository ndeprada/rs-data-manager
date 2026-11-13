// Lecturas ligeras de entidades (13/11/2026, pantalla Personal): pedir solo algunos campos (`fields`) y solo
// los registros desde una fecha (`gte`), para no bajar documentos enteros (p. ej. sesiones con sus dibujos)
// cuando la pantalla solo necesita contar. Sin importaciones: se prueba en Node (tests/entityQuery.test.mjs).

// Campos que se devuelven siempre: los usan los filtros de permisos del servidor (quién puede ver qué)
export const KEEP_KEYS = ['owner_id', 'staff_id', 'status', 'kind', 'visibility', 'shared', 'team_id', 'event_id', 'player_id', 'archived_season'];
const safe = (k) => String(k || '').replace(/[^a-zA-Z0-9_]/g, '');

/** «a,b,c» → ['a','b','c', …KEEP_KEYS] sin repetir (máx. 30 campos); vacío o raro = null (documento entero) */
export function parseFields(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const keys = raw.split(',').map(safe).filter(Boolean).slice(0, 30);
  if (!keys.length) return null;
  return [...new Set([...keys, ...KEEP_KEYS])];
}

/** Expresión SQL de la columna `data` con solo esos campos (los que faltan no salen) */
export function selectData(fields) {
  if (!fields?.length) return 'data';
  return `jsonb_strip_nulls(jsonb_build_object(${fields.map((k) => `'${k}', data -> '${k}'`).join(', ')}))`;
}

/** `{"date":"2026-10-14"}` → [['date','2026-10-14']]: registros con ese campo (texto) mayor o igual. Máx. 3. */
export function parseGte(raw) {
  if (!raw || typeof raw !== 'string') return [];
  let obj;
  try { obj = JSON.parse(raw); } catch { return []; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  return Object.entries(obj).map(([k, v]) => [safe(k), String(v ?? '')]).filter(([k, v]) => k && v).slice(0, 3);
}
