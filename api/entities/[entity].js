import { query } from '../_lib/db.js';
import { requireUser } from '../_lib/auth.js';
import { ARCHIVABLE } from '../_lib/season.js';
import { checkEntityAccess, checkTeamWrite, checkRoleWriteAccess, roleFilterDocs, isPlayerUser, playerFilterDocs } from '../_lib/access.js';

function rowToDoc(row) {
  return {
    id: row.id,
    ...row.data,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function parseSort(sort) {
  if (!sort || typeof sort !== 'string') return null;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  return { field, desc };
}

export default async function handler(req, res) {
  const { entity } = req.query;
  if (!entity) {
    res.status(400).json({ error: 'entity requerido' });
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const access = checkEntityAccess(user, entity, req.method, req.body || {});
  if (!access.ok) {
    res.status(403).json({ error: access.error, field: access.field });
    return;
  }

  const tw = await checkTeamWrite(user, entity, req.method, req.body || {}, null);
  if (!tw.ok) { res.status(403).json({ error: tw.error }); return; }

  const rw = await checkRoleWriteAccess(user, entity, req.method, req.body || {}, null);
  if (!rw.ok) { res.status(403).json({ error: rw.error }); return; }

  if (req.method === 'GET') {
    try {
      const filterRaw = req.query.q;
      const filter = filterRaw ? JSON.parse(filterRaw) : {};
      const sortSpec = parseSort(req.query.sort);
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;

      const params = [entity];
      let where = `entity_type = $1`;
      Object.entries(filter).forEach(([key, value]) => {
        if (key === 'id') {
          params.push(String(value));
          where += ` and id::text = $${params.length}`;
          return;
        }
        params.push(JSON.stringify(value));
        where += ` and data -> '${key.replace(/[^a-zA-Z0-9_]/g, '')}' = $${params.length}::jsonb`;
      });

      // Datos de temporadas cerradas: no salen en los listados normales (archived=only|all para verlos;
      // si se pide un registro concreto —id, partido o temporada— tampoco se ocultan)
      if (ARCHIVABLE.has(entity)) {
        const mode = req.query.archived;
        if (mode === 'only') where += ` and coalesce(data->>'archived_season', '') <> ''`;
        else if (mode !== 'all' && !['id', 'event_id', 'archived_season'].some((k) => k in filter)) where += ` and coalesce(data->>'archived_season', '') = ''`;
      }

      let orderBy = 'created_at desc';
      if (sortSpec) {
        if (sortSpec.field === 'created_date') {
          orderBy = `created_at ${sortSpec.desc ? 'desc' : 'asc'}`;
        } else if (sortSpec.field === 'updated_date') {
          orderBy = `updated_at ${sortSpec.desc ? 'desc' : 'asc'}`;
        } else {
          const safeField = sortSpec.field.replace(/[^a-zA-Z0-9_]/g, '');
          orderBy = `data ->> '${safeField}' ${sortSpec.desc ? 'desc' : 'asc'}`;
        }
      }

      const player = isPlayerUser(user);
      let sql = `select id, data, created_at, updated_at from entities where ${where} order by ${orderBy}`;
      if (limit && !player) sql += ` limit ${parseInt(limit, 10)}`;

      const { rows } = await query(sql, params);
      let docs = rows.map(rowToDoc);
      docs = await roleFilterDocs(user, entity, docs);
      if (player) {
        docs = await playerFilterDocs(user, entity, docs);
        if (limit) docs = docs.slice(0, parseInt(limit, 10));
      }
      res.status(200).json(docs);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'list_failed', message: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const { rows } = await query(
        `insert into entities (entity_type, data) values ($1, $2::jsonb)
         returning id, data, created_at, updated_at`,
        [entity, JSON.stringify(body)]
      );
      res.status(201).json(rowToDoc(rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'create_failed', message: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'method_not_allowed' });
}
