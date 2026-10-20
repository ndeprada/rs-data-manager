// Limpieza de duplicados (solo administración, con vista previa y copia de seguridad previa en el endpoint):
//  1. Fichas de jugador duplicadas por la sincronización de actas: un jugador de otro equipo del club (con sus datos
//     reales) y una copia "pelada" (solo nombre, equipo y dorsal) creada al salir en un acta de otro equipo.
//     Se unen: todo lo que apuntaba a la copia pasa a la ficha original y la copia se borra.
//  2. Estadísticas de partido repetidas (mismo partido y mismo jugador): se funden en una sola fila conservando lo que
//     se haya escrito a mano (minutos, notas, valoración…).
//  3. Convocatorias repetidas del mismo partido: se deja una, la última editada. Si dos copias de una convocatoria
//     no coinciden en los jugadores, se dejan sin tocar y se avisa.
//
// Todo ocurre en una transacción. Con dry=true se calcula exactamente lo mismo y se deshace al final (vista previa).
import { tokensKey } from './rosterMatch.js';

// Campos que trae una ficha creada solo por la sincronización de actas
const BARE_KEYS = new Set(['first_name', 'last_name', 'team_id', 'status', 'fcf_imported', 'jersey_number']);
const ROW_KEYS = new Set(['id', 'created_date', 'updated_date']);
const hasBirth = (d) => !!(d.birth_year || d.birth_date);
const isBare = (d) => !hasBirth(d) && Object.keys(d).every((k) => BARE_KEYS.has(k) || d[k] === '' || d[k] == null);
const fullName = (d) => `${d.first_name || ''} ${d.last_name || ''}`.replace(/\s+/g, ' ').trim();

// Un valor "con contenido": lo que alguien ha escrito o marcado (no vacío, no 0, no false)
export function meaningful(v) {
  if (v === undefined || v === null || v === '' || v === 0 || v === false) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

// Funde varias filas (ordenadas de la más antigua a la más reciente): por cada campo, el último valor con contenido.
export function mergeData(rows) {
  const out = {};
  const conflicts = [];
  // Los datos guardados pueden traer copiados el id y las fechas de la fila (las envía la pantalla al guardar):
  // nunca se funden, porque el id de una fila borrada haría que la fila que queda se sirviera con un id que ya no existe.
  const keys = new Set(rows.flatMap((r) => Object.keys(r.data)).filter((k) => !ROW_KEYS.has(k)));
  for (const k of keys) {
    let last;
    const seen = [];
    for (const r of rows) {
      if (!(k in r.data)) continue;
      last = r.data[k];
      if (meaningful(r.data[k]) && !seen.some((x) => JSON.stringify(x) === JSON.stringify(r.data[k]))) seen.push(r.data[k]);
    }
    out[k] = seen.length ? seen[seen.length - 1] : last;
    if (seen.length > 1) conflicts.push({ field: k, values: seen });
  }
  return { data: out, conflicts };
}

const sameSet = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x));
const uniq = (arr) => [...new Set(arr)];
const byUpdated = (a, b) => new Date(a.updated_at) - new Date(b.updated_at) || new Date(a.created_at) - new Date(b.created_at);

// Parejas (original, copia) entre los jugadores del club
export function findPlayerCopies(players, teams) {
  const season = new Map(teams.map((t) => [t.id, t.data.season || '']));
  const groups = new Map();
  for (const p of players) {
    const d = p.data;
    if (d.archived_season) continue;
    const key = tokensKey(fullName(d));
    if (!key || key.split(' ').length < 2) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const pairs = [];
  for (const list of groups.values()) {
    if (list.length !== 2) continue; // con 3 o más no se adivina
    const [x, y] = list;
    if (!x.data.team_id || x.data.team_id === y.data.team_id) continue;
    const sx = season.get(x.data.team_id), sy = season.get(y.data.team_id);
    if (sx && sy && sx !== sy) continue;
    const copy = [x, y].find((p) => isBare(p.data) && p.data.fcf_imported);
    const orig = [x, y].find((p) => p !== copy);
    if (!copy || !orig || !hasBirth(orig.data) || orig.data.status === 'baja') continue;
    pairs.push({ keep: orig, drop: copy });
  }
  return pairs;
}

async function loadAll(t, type) {
  return (await t.query(`select id, data, created_at, updated_at from entities where entity_type = $1`, [type])).rows;
}

// Para la vista previa: se hace todo y se deshace lanzando esto al final de la transacción
class DryRun extends Error {
  constructor(result) { super('dry'); this.result = result; }
}

export async function cleanDuplicates(db, { dry = true } = {}) {
  try {
    return await db.tx(async (t) => {
      const result = await run(t);
      if (dry) throw new DryRun(result);
      return { ...result, dry: false };
    });
  } catch (e) {
    if (e instanceof DryRun) return { ...e.result, dry: true };
    throw e;
  }
}

async function run(t) {
  const [players, teams, events] = await Promise.all([loadAll(t, 'Player'), loadAll(t, 'Team'), loadAll(t, 'Event')]);
  const teamName = new Map(teams.map((x) => [x.id, x.data.name || '']));
  const evInfo = new Map(events.map((e) => [e.id, `${e.data.title || e.data.opponent || 'Partido'}${e.data.date ? ` (${String(e.data.date).slice(0, 10)})` : ''}`]));

  // 1. Jugadores duplicados
  const pairs = findPlayerCopies(players, teams);
  const playersOut = [];
  for (const { keep, drop } of pairs) {
    const moved = await t.query(
      `update entities set data = replace(data::text, $1, $2)::jsonb, updated_at = now()
        where id <> $3 and data::text like '%' || $1 || '%' returning entity_type`,
      [drop.id, keep.id, drop.id]);
    const refs = {};
    for (const r of moved.rows) refs[r.entity_type] = (refs[r.entity_type] || 0) + 1;
    playersOut.push({ name: fullName(keep.data), keep: { id: keep.id, team: teamName.get(keep.data.team_id) || '' }, drop: { id: drop.id, team: teamName.get(drop.data.team_id) || '' }, refs });
  }

  // 2. Estadísticas repetidas (también las que acaban de coincidir al unir jugadores)
  const stats = (await loadAll(t, 'MatchStats')).sort(byUpdated);
  const statGroups = new Map();
  for (const s of stats) {
    if (!s.data.event_id || !s.data.player_id) continue;
    const k = `${s.data.event_id}|${s.data.player_id}`;
    if (!statGroups.has(k)) statGroups.set(k, []);
    statGroups.get(k).push(s);
  }
  let statDeleted = 0, statGroupsN = 0;
  const statEvents = new Set();
  const conflicts = [];
  for (const rows of statGroups.values()) {
    if (rows.length < 2) continue;
    const { data, conflicts: c } = mergeData(rows);
    const keepRow = rows[rows.length - 1];
    statGroupsN += 1; statDeleted += rows.length - 1; statEvents.add(keepRow.data.event_id);
    if (c.length) conflicts.push({ kind: 'estadísticas', event: evInfo.get(keepRow.data.event_id) || '', fields: c.map((x) => x.field) });
    await t.query(`update entities set data = $2::jsonb, updated_at = now() where id = $1`, [keepRow.id, JSON.stringify(data)]);
    await t.query(`delete from entities where id = any($1::uuid[])`, [rows.slice(0, -1).map((r) => r.id)]);
  }

  // 3. Convocatorias repetidas
  const convs = (await loadAll(t, 'Convocatoria')).sort(byUpdated);
  const convGroups = new Map();
  for (const c of convs) {
    if (!c.data.event_id) continue;
    if (!convGroups.has(c.data.event_id)) convGroups.set(c.data.event_id, []);
    convGroups.get(c.data.event_id).push(c);
  }
  let convDeleted = 0;
  const convFixed = [], convSkipped = [];
  for (const [eventId, rows] of convGroups) {
    // Tras unir jugadores puede haber un mismo jugador dos veces dentro de una convocatoria
    for (const r of rows) {
      const ids = uniq(r.data.player_ids || []), st = uniq(r.data.starters || []);
      if (ids.length !== (r.data.player_ids || []).length || st.length !== (r.data.starters || []).length) {
        r.data = { ...r.data, player_ids: ids, starters: st };
        await t.query(`update entities set data = $2::jsonb, updated_at = now() where id = $1`, [r.id, JSON.stringify(r.data)]);
      }
    }
    if (rows.length < 2) continue;
    const differ = (k) => rows.some((a) => rows.some((b) => (a.data[k] || []).length && (b.data[k] || []).length && !sameSet(a.data[k], b.data[k])));
    if (differ('player_ids') || differ('starters')) {
      convSkipped.push({ event: evInfo.get(eventId) || eventId, why: 'Las copias de la convocatoria no tienen los mismos jugadores (se revisará cuando se decida lo de los jugadores repetidos).' });
      continue;
    }
    const { data } = mergeData(rows);
    const keepRow = rows[rows.length - 1];
    await t.query(`update entities set data = $2::jsonb, updated_at = now() where id = $1`, [keepRow.id, JSON.stringify(data)]);
    await t.query(`delete from entities where id = any($1::uuid[])`, [rows.slice(0, -1).map((r) => r.id)]);
    convDeleted += rows.length - 1;
    convFixed.push(evInfo.get(eventId) || eventId);
  }

  // 4. Las fichas copia, ya sin nada que apunte a ellas
  if (pairs.length) await t.query(`delete from entities where id = any($1::uuid[]) and entity_type = 'Player'`, [pairs.map((p) => p.drop.id)]);

  return {
    players: playersOut,
    stats: { groups: statGroupsN, deleted: statDeleted, matches: statEvents.size },
    convocatorias: { deleted: convDeleted, matches: convFixed, skipped: convSkipped },
    conflicts,
  };
}
