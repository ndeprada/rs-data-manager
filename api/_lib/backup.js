// Copias de seguridad de los datos de la app (tabla `entities`).
// Se guardan comprimidas en la tabla `backups` (se crea sola la primera vez).
// No incluyen: contraseñas (auth_users), claves de los avisos push ni los archivos/fotos subidos (están en Vercel Blob,
// aquí solo queda su enlace).
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export const EXCLUDED_TYPES = ['PushSubscription', 'PushConfig'];
// Cuántas copias se conservan de cada tipo
export const KEEP = { auto: 14, manual: 10, pre_close: 6 };

let ensured = false;
export async function ensureBackupTable(db) {
  if (ensured) return;
  await db.query(`create table if not exists backups (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    kind text not null,
    note text,
    entity_count int not null default 0,
    size_bytes int not null default 0,
    counts jsonb not null default '{}'::jsonb,
    data bytea not null
  )`);
  ensured = true;
}

// Foto completa de los datos ahora mismo (objeto JSON)
export async function snapshotNow(db) {
  const { rows } = await db.query(
    `select id, entity_type, data, created_at, updated_at from entities where entity_type <> all($1::text[]) order by entity_type, created_at`,
    [EXCLUDED_TYPES]
  );
  const counts = {};
  for (const r of rows) counts[r.entity_type] = (counts[r.entity_type] || 0) + 1;
  return { version: 1, created_at: new Date().toISOString(), counts, entities: rows };
}

export async function gzipSnapshot(snap) {
  return gzip(Buffer.from(JSON.stringify(snap)));
}

// Guarda una copia en el servidor y borra las más antiguas de su tipo
export async function createBackup(db, { kind = 'manual', note = '' } = {}) {
  await ensureBackupTable(db);
  const snap = await snapshotNow(db);
  const gz = await gzipSnapshot(snap);
  const { rows } = await db.query(
    `insert into backups (kind, note, entity_count, size_bytes, counts, data) values ($1, $2, $3, $4, $5::jsonb, $6) returning id, created_at`,
    [kind, note || null, snap.entities.length, gz.length, JSON.stringify(snap.counts), gz]
  );
  const keep = KEEP[kind] ?? 10;
  await db.query(
    `delete from backups where kind = $1 and id not in (select id from backups where kind = $1 order by created_at desc, id desc limit $2)`,
    [kind, keep]
  );
  return { id: Number(rows[0].id), created_at: rows[0].created_at, kind, entity_count: snap.entities.length, size_bytes: gz.length };
}

export async function listBackups(db) {
  await ensureBackupTable(db);
  const { rows } = await db.query(`select id, created_at, kind, note, entity_count, size_bytes from backups order by created_at desc, id desc limit 60`);
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

export async function getBackupGz(db, id) {
  await ensureBackupTable(db);
  const { rows } = await db.query(`select data, created_at, kind from backups where id = $1`, [id]);
  return rows[0] || null;
}

// Restaura una copia (solo se usa a mano, nunca desde la app):
//  - mode 'merge' (por defecto): devuelve cada fila de la copia a su estado de entonces (la crea si falta) y no borra nada.
//  - types: lista opcional de entidades a restaurar (p. ej. ['Player','Event']); si se indica y replace=true,
//    además borra las filas de esos tipos que no existían en la copia.
export async function restoreSnapshot(db, snap, { types = null, replace = false } = {}) {
  const only = types ? new Set(types) : null;
  const rows = snap.entities.filter((r) => !only || only.has(r.entity_type));
  const out = { restored: 0, deleted: 0 };
  await db.tx(async (t) => {
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const part = rows.slice(i, i + CHUNK);
      await t.query(
        `insert into entities (id, entity_type, data, created_at, updated_at)
         select x.id, x.entity_type, x.data, x.created_at, x.updated_at
         from jsonb_to_recordset($1::jsonb) as x(id uuid, entity_type text, data jsonb, created_at timestamptz, updated_at timestamptz)
         on conflict (id) do update set entity_type = excluded.entity_type, data = excluded.data, created_at = excluded.created_at, updated_at = excluded.updated_at`,
        [JSON.stringify(part)]
      );
      out.restored += part.length;
    }
    if (replace && only) {
      const keep = rows.map((r) => r.id);
      const del = await t.query(`delete from entities where entity_type = any($1::text[]) and not (id = any($2::uuid[]))`, [[...only], keep]);
      out.deleted = del.rowCount || 0;
    }
  });
  return out;
}

export async function parseGz(buf) {
  return JSON.parse((await gunzip(buf)).toString('utf8'));
}
