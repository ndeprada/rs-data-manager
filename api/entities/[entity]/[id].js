import { query } from '../../_lib/db.js';
import { requireUser } from '../../_lib/auth.js';

function rowToDoc(row) {
  return {
    id: row.id,
    ...row.data,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

export default async function handler(req, res) {
  const { entity, id } = req.query;

  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const { rows } = await query(
      `select id, data, created_at, updated_at from entities where entity_type = $1 and id = $2`,
      [entity, id]
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(200).json(rowToDoc(rows[0]));
    return;
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const patch = req.body || {};
      const { rows } = await query(
        `update entities
            set data = data || $3::jsonb,
                updated_at = now()
          where entity_type = $1 and id = $2
          returning id, data, created_at, updated_at`,
        [entity, id, JSON.stringify(patch)]
      );
      if (!rows[0]) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(200).json(rowToDoc(rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'update_failed', message: err.message });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      await query(`delete from entities where entity_type = $1 and id = $2`, [entity, id]);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'delete_failed', message: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'method_not_allowed' });
}
