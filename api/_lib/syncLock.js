// Evita que dos sincronizaciones con la FCF corran a la vez (la nocturna y un botón, o dos personas):
// las dos leerían la plantilla antes de que la otra termine y crearían jugadores duplicados.
// Es una fila-candado en la base (funciona aunque la conexión sea "pooled"); caduca sola a los 3 minutos por si una ejecución se corta.
const FREE = `(data->>'since') is null or (data->>'since')::timestamptz < now() - interval '3 minutes'`;
const LOCK_ROW = `(select id from entities where entity_type = 'FcfSyncLock' order by created_at, id limit 1)`;

export async function acquireSyncLock(db) {
  await db.query(`insert into entities (entity_type, data) select 'FcfSyncLock', '{}'::jsonb where not exists (select 1 from entities where entity_type = 'FcfSyncLock')`);
  const r = await db.query(`update entities set data = jsonb_build_object('since', now()::text), updated_at = now() where id = ${LOCK_ROW} and (${FREE})`);
  return r.rowCount === 1;
}

export async function releaseSyncLock(db) {
  await db.query(`update entities set data = '{}'::jsonb where id = ${LOCK_ROW}`);
}
