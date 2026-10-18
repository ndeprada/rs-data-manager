import pg from 'pg';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL no está configurada');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export async function query(text, params) {
  const client = getPool();
  return client.query(text, params);
}

// Adaptador con transacciones (lo usa el cierre de temporada; en las pruebas se sustituye por una base local).
export const db = {
  query,
  async tx(fn) {
    const c = await getPool().connect();
    try {
      await c.query('begin');
      const out = await fn({ query: (t, p) => c.query(t, p) });
      await c.query('commit');
      return out;
    } catch (e) {
      try { await c.query('rollback'); } catch { /* sin conexión */ }
      throw e;
    } finally {
      c.release();
    }
  },
};
