// Registro de la última sincronización con la FCF (una sola fila en la base) y regla de la sincronización automática.
// - Se anota al empezar y al terminar cada sincronización: la manual (botón de Equipos), la de cada noche y la automática al abrir la app.
// - La automática solo arranca si la última terminó hace más de 3 horas; si falló, se reintenta pasados 30 minutos
//   (así un corte de la FCF no hace que cada persona que abra la app vuelva a llamarla).
// Es una fila-«entidad» como el candado (syncLock.js): la API genérica no la entrega a quien no es administrador (club_private).

import { acquireSyncLock, releaseSyncLock } from './syncLock.js';

export const OK_INTERVAL_MS = 3 * 60 * 60 * 1000;
export const FAIL_RETRY_MS = 30 * 60 * 1000;
// Igual que la caducidad del candado: una sincronización «en marcha» más vieja que esto se cortó sin terminar
export const RUNNING_MS = 3 * 60 * 1000;

const ROW = `(select id from entities where entity_type = 'FcfSyncStatus' order by created_at, id limit 1)`;
const NOT_STAFF = ['jugador', 'familiar'];

/** Quién puede consultar el estado y lanzar la sincronización automática: dirección y personal del club (no jugadores ni familias). */
export const canUseAutoSync = (u) => !!u && (u.role === 'admin' || (!!u.app_role && !NOT_STAFF.includes(u.app_role) && (u.access_status === 'approved' || !u.access_status)));

const stamp = (s) => Date.parse(s?.finished_at || s?.last_attempt_at || '');

/** ¿Toca sincronizar sola? (función pura: el estado guardado y la hora actual) */
export function shouldAutoSync(status, now = Date.now()) {
  const at = stamp(status);
  if (!Number.isFinite(at)) return true;
  const age = now - at;
  if (status.in_progress) return age > FAIL_RETRY_MS; // en marcha (el candado ya lo protege) o cortada: no insistir hasta pasado un rato
  return age > (status.ok ? OK_INTERVAL_MS : FAIL_RETRY_MS);
}

/** Lo que ve la app: estado normalizado (nunca / en marcha / bien / falló) con las fechas necesarias para mostrarlo. */
export function publicStatus(s, now = Date.now()) {
  if (!s || !Number.isFinite(Date.parse(s.last_attempt_at || ''))) {
    return { state: 'never', last_ok_at: s?.last_ok_at || null, last_ok_source: s?.last_ok_source || null };
  }
  const running = !!s.in_progress;
  const state = running ? (now - Date.parse(s.last_attempt_at) <= RUNNING_MS ? 'running' : 'failed') : (s.ok ? 'ok' : 'failed');
  return {
    state,
    source: s.source || null,
    at: running ? s.last_attempt_at : (s.finished_at || s.last_attempt_at),
    last_ok_at: s.last_ok_at || null,
    last_ok_source: s.last_ok_source || null,
    warnings: s.warnings || 0,
    error: state === 'failed' ? (running ? 'La sincronización no llegó a terminar' : (s.error || null)) : null,
    stats: s.stats || null,
  };
}

export async function readSyncStatus(db) {
  const r = await db.query(`select data from entities where entity_type = 'FcfSyncStatus' order by created_at, id limit 1`);
  return r.rows[0]?.data || null;
}

async function saveSyncStatus(db, data) {
  await db.query(`insert into entities (entity_type, data) select 'FcfSyncStatus', '{}'::jsonb where not exists (select 1 from entities where entity_type = 'FcfSyncStatus')`);
  await db.query(`update entities set data = $1::jsonb, updated_at = now() where id = ${ROW}`, [JSON.stringify(data)]);
}

const STAT_KEYS = ['teams_created', 'teams_updated', 'players_created', 'matches_created', 'matches_updated'];
const short = (m) => String(m ?? '').slice(0, 300);

/** Sincroniza dejando constancia en el registro. Anotar el estado nunca rompe la sincronización. */
export async function runTrackedSync(db, source, syncFn, clock = () => new Date()) {
  const startedAt = clock();
  let prev = null;
  try {
    prev = await readSyncStatus(db);
    await saveSyncStatus(db, { in_progress: true, last_attempt_at: startedAt.toISOString(), source, last_ok_at: prev?.last_ok_at || null, last_ok_source: prev?.last_ok_source || null });
  } catch (e) { console.error('estado de sincronización (inicio)', e); }

  let result;
  try {
    const stats = await syncFn();
    result = { ok: true, stats };
  } catch (e) {
    console.error(e);
    result = { ok: false, error: e.message };
  }

  try {
    const endedAt = clock().toISOString();
    const data = {
      in_progress: false, last_attempt_at: startedAt.toISOString(), finished_at: endedAt, source, ok: result.ok,
      last_ok_at: result.ok ? endedAt : (prev?.last_ok_at || null),
      last_ok_source: result.ok ? source : (prev?.last_ok_source || null),
    };
    if (result.ok) {
      data.warnings = result.stats?.errors?.length || 0;
      data.stats = Object.fromEntries(STAT_KEYS.map((k) => [k, result.stats?.[k] || 0]));
    } else {
      data.error = short(result.error);
    }
    await saveSyncStatus(db, data);
  } catch (e) { console.error('estado de sincronización (fin)', e); }
  return result;
}

/**
 * «Sincroniza solo si toca» (lo que pide la app al abrirse). Devuelve el cuerpo de la respuesta:
 * { ran: false, … } si no tocaba o ya había otra en marcha; { ran: true, ok, … } si sincronizó.
 * Comprueba dos veces si toca: otra persona pudo terminar justo antes de que consiguiéramos el candado.
 */
export async function runAutoSync(db, syncFn, clock = () => new Date()) {
  const notDue = async () => {
    const s = await readSyncStatus(db);
    const now = clock().getTime();
    return shouldAutoSync(s, now) ? null : { ran: false, status: publicStatus(s, now) };
  };
  const early = await notDue();
  if (early) return early;
  if (!(await acquireSyncLock(db))) return { ran: false, reason: 'running', status: publicStatus(await readSyncStatus(db), clock().getTime()) };
  try {
    const again = await notDue();
    if (again) return again;
    const r = await runTrackedSync(db, 'auto', syncFn, clock);
    const status = publicStatus(await readSyncStatus(db), clock().getTime());
    return r.ok ? { ran: true, ok: true, ...r.stats, status } : { ran: true, ok: false, error: r.error, status };
  } finally {
    try { await releaseSyncLock(db); } catch (e) { console.error('liberar candado', e); }
  }
}
