// Avisos push, historial de avisos y vinculación de familiares.
// Una sola función (el plan de Vercel limita el número de funciones). Se elige la acción con ?a=...
import webpush from 'web-push';
import { query, db } from './_lib/db.js';
import { seasonStatus, closeSeason, reopenSeason, HttpError } from './_lib/season.js';
import { createBackup, listBackups, getBackupGz, snapshotNow, gzipSnapshot } from './_lib/backup.js';
import { rivalReport } from './_lib/fcfRival.js';
import { requireUser } from './_lib/auth.js';
import { isAdmin, coachTeamIdsOf } from './_lib/access.js';

const COORD = ['director', 'director_deportivo', 'coordinador_general', 'coordinador_f7', 'coordinador_f11'];
const STAFF = [...COORD, 'entrenador', 'entrenador_porteros', 'preparador_fisico', 'psicologo', 'fisioterapeuta'];
const RELATIONS = ['padre', 'madre', 'tutor', 'otro_familiar'];

const isCoord = (u) => isAdmin(u) || COORD.includes(u.app_role);
const canSend = (u) => isCoord(u) || u.app_role === 'entrenador';
const isApprovedUser = (d) => d.role === 'admin' || d.access_status === 'approved' || (!d.access_status && !!d.app_role);

// Claves VAPID (identifican al servidor ante los móviles). Se usan las de las variables de entorno si existen;
// si no, se generan una vez y se guardan en la base de datos (entidad PushConfig, no accesible desde la app).
let vapid = null;
async function setupVapid() {
  if (vapid) return vapid.publicKey;
  let keys = null;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const read = async () => (await query(`select data from entities where entity_type = 'PushConfig' order by created_at asc limit 1`)).rows[0]?.data;
    keys = await read();
    if (!keys) {
      await query(`insert into entities (entity_type, data) values ('PushConfig', $1::jsonb)`, [JSON.stringify(webpush.generateVAPIDKeys())]);
      keys = await read(); // si dos peticiones generaron a la vez, gana la más antigua
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:ndeprada@gmail.com', keys.publicKey, keys.privateKey);
  vapid = keys;
  return keys.publicKey;
}

const byType = async (type) => (await query(`select id, data from entities where entity_type = $1`, [type])).rows;
const teamIdsOfUser = (d) => [...(d.team_ids || []), ...(d.team_id ? [d.team_id] : []), ...(d.secondary_team_ids || [])];

// ── Destinatarios ────────────────────────────────────────────────────────────
// audience: { all_club, team_ids[], player_ids[], user_ids[], groups: ['jugadores','familiares','tecnico'] }
async function resolveRecipients(sender, audience = {}) {
  const groups = new Set(audience.groups || []);
  let teamIds = new Set(audience.team_ids || []);
  const explicitPlayers = new Set(audience.player_ids || []);
  const extraUsers = new Set(audience.user_ids || []);

  // Un entrenador solo puede escribir a sus equipos
  if (!isCoord(sender)) {
    const mine = new Set(coachTeamIdsOf(sender));
    teamIds = new Set([...teamIds].filter((t) => mine.has(t)));
    if (audience.all_club) teamIds = mine;
    if (teamIds.size === 0 && explicitPlayers.size === 0) return { ids: new Set(), users: [] };
  }

  const [users, players, links] = await Promise.all([byType('User'), byType('Player'), byType('GuardianLink')]);
  const allClub = !!audience.all_club && isCoord(sender);
  const targetPlayers = new Set();
  if (explicitPlayers.size) explicitPlayers.forEach((p) => targetPlayers.add(p));
  else players.forEach((p) => { if (allClub || teamIds.has(p.data.team_id)) targetPlayers.add(p.id); });

  const out = new Set(extraUsers);
  for (const u of users) {
    const d = u.data;
    if (!isApprovedUser(d)) continue;
    // También cuenta el cuerpo técnico que además es jugador (player_id vinculado)
    if (groups.has('jugadores') && (d.app_role === 'jugador' || STAFF.includes(d.app_role)) && d.player_id && targetPlayers.has(d.player_id)) out.add(u.id);
    if (groups.has('tecnico') && (STAFF.includes(d.app_role) || d.role === 'admin')) {
      if (allClub) out.add(u.id);
      else if (teamIdsOfUser(d).some((t) => teamIds.has(t))) out.add(u.id);
    }
  }
  if (groups.has('familiares')) {
    const approved = new Map(users.filter((u) => isApprovedUser(u.data)).map((u) => [u.id, u]));
    for (const l of links) {
      if (l.data.status === 'approved' && targetPlayers.has(l.data.player_id) && approved.has(l.data.user_id)) out.add(l.data.user_id);
    }
  }
  out.delete(sender.id);
  return { ids: out, users };
}

async function pushTo(userIds, payload) {
  if (userIds.length === 0 || !(await setupVapid())) return { sent: 0, failed: 0, devices: 0 };
  const { rows } = await query(
    `select id, data from entities where entity_type = 'PushSubscription' and data ->> 'user_id' = any($1)`, [userIds]
  );
  let sent = 0, failed = 0;
  const dead = [];
  await Promise.all(rows.map(async (r) => {
    try {
      await webpush.sendNotification({ endpoint: r.data.endpoint, keys: r.data.keys }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
      sent++;
    } catch (e) {
      failed++;
      if (e.statusCode === 404 || e.statusCode === 410) dead.push(r.id);
    }
  }));
  if (dead.length) await query(`delete from entities where id = any($1::uuid[])`, [dead]);
  return { sent, failed, devices: rows.length };
}

// ── Vínculos de familiares ───────────────────────────────────────────────────
async function promoteGuardian(userId) {
  const { rows } = await query(`select data from entities where entity_type = 'User' and id = $1`, [userId]);
  const d = rows[0]?.data;
  if (!d) return false;
  if (d.role === 'admin' || (d.app_role && d.app_role !== 'familiar')) return true; // ya tiene otra función: solo se añade el vínculo
  await query(
    `update entities set data = data || $2::jsonb, updated_at = now() where entity_type = 'User' and id = $1`,
    [userId, JSON.stringify({ app_role: 'familiar', person_type: 'familiar', access_status: 'approved', app_role_pending: null })]
  );
  return true;
}

const playerCard = (p, teams) => ({
  id: p.id,
  name: `${p.data.first_name || ''} ${p.data.last_name || ''}`.trim(),
  team: teams.get(p.data.team_id) || '',
  team_id: p.data.team_id || null,
  birth_year: p.data.birth_year || null,
});
const teamMap = async () => new Map((await byType('Team')).map((t) => [t.id, t.data.name]));

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  const a = req.query.a;
  const body = req.body || {};

  try {
    // ── Avisos push ─────────────────────────────────────────────
    if (a === 'vapid') {
      return res.status(200).json({ key: await setupVapid() });
    }

    if (a === 'subscribe' && req.method === 'POST') {
      const sub = body.subscription;
      if (!sub?.endpoint || !sub?.keys) return res.status(400).json({ error: 'bad_subscription' });
      await query(`delete from entities where entity_type = 'PushSubscription' and data ->> 'endpoint' = $1`, [sub.endpoint]);
      await query(
        `insert into entities (entity_type, data) values ('PushSubscription', $1::jsonb)`,
        [JSON.stringify({ user_id: user.id, endpoint: sub.endpoint, keys: sub.keys, ua: String(req.headers['user-agent'] || '').slice(0, 200) })]
      );
      return res.status(200).json({ ok: true });
    }

    if (a === 'unsubscribe' && req.method === 'POST') {
      await query(`delete from entities where entity_type = 'PushSubscription' and data ->> 'endpoint' = $1 and data ->> 'user_id' = $2`, [body.endpoint, user.id]);
      return res.status(200).json({ ok: true });
    }

    if (a === 'my_push') {
      const { rows } = await query(`select count(*)::int as n from entities where entity_type = 'PushSubscription' and data ->> 'user_id' = $1`, [user.id]);
      return res.status(200).json({ devices: rows[0].n, configured: true });
    }

    if (a === 'inbox') {
      const { rows } = await query(
        `select id, data, created_at from entities where entity_type = 'Notice' and data -> 'recipient_ids' ? $1 order by created_at desc limit 40`, [user.id]
      );
      return res.status(200).json(rows.map((r) => ({ id: r.id, title: r.data.title, body: r.data.body, url: r.data.url, sender_name: r.data.sender_name, created_date: r.created_at })));
    }

    if (a === 'history') {
      if (!canSend(user)) return res.status(403).json({ error: 'forbidden' });
      const mine = isCoord(user) ? '' : `and data ->> 'sender_id' = $1`;
      const { rows } = await query(
        `select id, data, created_at from entities where entity_type = 'Notice' ${mine} order by created_at desc limit 100`, isCoord(user) ? [] : [user.id]
      );
      return res.status(200).json(rows.map((r) => ({
        id: r.id, title: r.data.title, body: r.data.body, sender_name: r.data.sender_name, audience_label: r.data.audience_label,
        recipients: (r.data.recipient_ids || []).length, sent: r.data.sent || 0, devices: r.data.devices || 0, created_date: r.created_at,
      })));
    }

    if ((a === 'preview' || a === 'send') && req.method === 'POST') {
      if (!canSend(user)) return res.status(403).json({ error: 'forbidden' });
      const { ids } = await resolveRecipients(user, body.audience);
      const list = [...ids];
      const { rows } = list.length
        ? await query(`select distinct data ->> 'user_id' as u from entities where entity_type = 'PushSubscription' and data ->> 'user_id' = any($1)`, [list])
        : { rows: [] };
      if (a === 'preview') return res.status(200).json({ recipients: list.length, with_push: rows.length });

      const title = String(body.title || '').trim().slice(0, 100);
      const text = String(body.body || '').trim().slice(0, 600);
      if (!title || !text) return res.status(400).json({ error: 'title_and_body_required' });
      if (list.length === 0) return res.status(400).json({ error: 'no_recipients' });
      const url = typeof body.url === 'string' && body.url.startsWith('/') ? body.url : '/Avisos';
      const delivery = await pushTo(list, { title, body: text, url });
      const { rows: ins } = await query(
        `insert into entities (entity_type, data) values ('Notice', $1::jsonb) returning id`,
        [JSON.stringify({
          title, body: text, url, sender_id: user.id, sender_name: user.full_name || user.email,
          audience: body.audience || {}, audience_label: String(body.audience_label || '').slice(0, 200),
          recipient_ids: list, sent: delivery.sent, failed: delivery.failed, devices: delivery.devices,
        })]
      );
      return res.status(200).json({ id: ins[0].id, recipients: list.length, ...delivery });
    }

    // ── Familiares ──────────────────────────────────────────────
    if (a === 'players_search') {
      const q = String(req.query.q || '').trim().toLowerCase();
      if (q.length < 3) return res.status(200).json([]);
      const [players, teams] = await Promise.all([byType('Player'), teamMap()]);
      const out = players
        .filter((p) => p.data.status !== 'baja' && `${p.data.first_name || ''} ${p.data.last_name || ''}`.toLowerCase().includes(q))
        .slice(0, 8).map((p) => playerCard(p, teams));
      return res.status(200).json(out);
    }

    if (a === 'link_request' && req.method === 'POST') {
      const { player_id, relationship } = body;
      if (!player_id || !RELATIONS.includes(relationship)) return res.status(400).json({ error: 'bad_request' });
      if (isAdmin(user) || STAFF.includes(user.app_role) || user.app_role === 'jugador') return res.status(400).json({ error: 'not_a_guardian_account' });
      const { rows: pl } = await query(`select id from entities where entity_type = 'Player' and id = $1`, [player_id]);
      if (!pl[0]) return res.status(404).json({ error: 'player_not_found' });
      const { rows: ex } = await query(`select id from entities where entity_type = 'GuardianLink' and data ->> 'user_id' = $1 and data ->> 'player_id' = $2`, [user.id, player_id]);
      if (!ex[0]) {
        await query(`insert into entities (entity_type, data) values ('GuardianLink', $1::jsonb)`,
          [JSON.stringify({ user_id: user.id, player_id, relationship, status: 'pending', requested_at: new Date().toISOString() })]);
      }
      if (!user.app_role) {
        await query(`update entities set data = data || $2::jsonb, updated_at = now() where entity_type = 'User' and id = $1`,
          [user.id, JSON.stringify({ person_type: 'familiar', app_role_pending: 'familiar', access_status: 'pending' })]);
      }
      return res.status(200).json({ ok: true });
    }

    if (a === 'my_links') {
      const [{ rows: links }, players, teams] = await Promise.all([
        query(`select id, data from entities where entity_type = 'GuardianLink' and data ->> 'user_id' = $1`, [user.id]), byType('Player'), teamMap(),
      ]);
      const pm = new Map(players.map((p) => [p.id, p]));
      return res.status(200).json(links.map((l) => ({
        id: l.id, status: l.data.status, relationship: l.data.relationship,
        player: pm.get(l.data.player_id) ? playerCard(pm.get(l.data.player_id), teams) : null,
      })));
    }

    // Vínculos de un jugador (admin, o el propio jugador)
    if (a === 'player_links') {
      const playerId = req.query.player_id;
      if (!(isAdmin(user) || (user.player_id && user.player_id === playerId))) return res.status(403).json({ error: 'forbidden' });
      const [{ rows: links }, users] = await Promise.all([
        query(`select id, data from entities where entity_type = 'GuardianLink' and data ->> 'player_id' = $1`, [playerId]), byType('User'),
      ]);
      const um = new Map(users.map((u) => [u.id, u.data]));
      const { rows: em } = links.length ? await query(`select id, email from auth_users where id = any($1::uuid[])`, [links.map((l) => l.data.user_id)]) : { rows: [] };
      const emails = new Map(em.map((e) => [e.id, e.email]));
      return res.status(200).json(links.map((l) => ({
        id: l.id, status: l.data.status, relationship: l.data.relationship, user_id: l.data.user_id,
        name: um.get(l.data.user_id)?.full_name || '', email: emails.get(l.data.user_id) || '', phone: um.get(l.data.user_id)?.phone || '',
      })));
    }

    // Solicitudes pendientes de todos los jugadores (para la pantalla de solicitudes del admin)
    if (a === 'pending_links') {
      if (!isAdmin(user)) return res.status(403).json({ error: 'forbidden' });
      const [{ rows: links }, users, players, teams] = await Promise.all([
        query(`select id, data from entities where entity_type = 'GuardianLink' and data ->> 'status' = 'pending'`), byType('User'), byType('Player'), teamMap(),
      ]);
      const um = new Map(users.map((u) => [u.id, u.data]));
      const pm = new Map(players.map((p) => [p.id, p]));
      const { rows: em } = links.length ? await query(`select id, email from auth_users where id = any($1::uuid[])`, [links.map((l) => l.data.user_id)]) : { rows: [] };
      const emails = new Map(em.map((e) => [e.id, e.email]));
      return res.status(200).json(links.map((l) => ({
        id: l.id, relationship: l.data.relationship, user_id: l.data.user_id,
        name: um.get(l.data.user_id)?.full_name || '', email: emails.get(l.data.user_id) || '',
        player: pm.get(l.data.player_id) ? playerCard(pm.get(l.data.player_id), teams) : null,
      })));
    }

    if (a === 'link_decision' && req.method === 'POST') {
      const { link_id, decision } = body;
      const { rows } = await query(`select id, data from entities where entity_type = 'GuardianLink' and id = $1`, [link_id]);
      const link = rows[0];
      if (!link) return res.status(404).json({ error: 'not_found' });
      const isOwnPlayer = !!user.player_id && user.player_id === link.data.player_id;
      if (!isAdmin(user) && !isOwnPlayer) return res.status(403).json({ error: 'forbidden' });
      if (decision === 'remove' || decision === 'reject') {
        await query(`delete from entities where id = $1`, [link_id]);
        return res.status(200).json({ ok: true });
      }
      if (decision !== 'approve') return res.status(400).json({ error: 'bad_decision' });
      await query(`update entities set data = data || $2::jsonb, updated_at = now() where id = $1`,
        [link_id, JSON.stringify({ status: 'approved', decided_by: user.id, decided_at: new Date().toISOString() })]);
      await promoteGuardian(link.data.user_id);
      return res.status(200).json({ ok: true });
    }

    // El admin vincula directamente a cualquier usuario registrado con un jugador
    if (a === 'link_create' && req.method === 'POST') {
      if (!isAdmin(user)) return res.status(403).json({ error: 'forbidden' });
      const { user_id, player_id, relationship } = body;
      if (!user_id || !player_id || !RELATIONS.includes(relationship)) return res.status(400).json({ error: 'bad_request' });
      const { rows: tu } = await query(`select data from entities where entity_type = 'User' and id = $1`, [user_id]);
      const t = tu[0]?.data;
      if (!t) return res.status(404).json({ error: 'user_not_found' });
      if (t.role === 'admin' || (t.app_role && t.app_role !== 'familiar')) return res.status(400).json({ error: 'user_has_other_role' });
      const { rows: ex } = await query(`select id from entities where entity_type = 'GuardianLink' and data ->> 'user_id' = $1 and data ->> 'player_id' = $2`, [user_id, player_id]);
      if (ex[0]) await query(`update entities set data = data || $2::jsonb, updated_at = now() where id = $1`, [ex[0].id, JSON.stringify({ status: 'approved', relationship })]);
      else await query(`insert into entities (entity_type, data) values ('GuardianLink', $1::jsonb)`,
        [JSON.stringify({ user_id, player_id, relationship, status: 'approved', decided_by: user.id, decided_at: new Date().toISOString() })]);
      await promoteGuardian(user_id);
      return res.status(200).json({ ok: true });
    }

    // ── Cierre de temporada (coordinación) ──────────────────────
    if (a === 'season_status') {
      if (!isCoord(user)) return res.status(403).json({ error: 'forbidden' });
      return res.status(200).json(await seasonStatus(db, String(req.query.season || '')));
    }
    if (a === 'season_close' && req.method === 'POST') {
      if (!isCoord(user)) return res.status(403).json({ error: 'forbidden' });
      // Antes de cerrar de verdad se guarda una copia completa; si no se puede guardar, no se cierra.
      if (!body.dry) {
        try { await createBackup(db, { kind: 'pre_close', note: `Antes de cerrar ${String(body.season || '')}` }); }
        catch (e) { console.error(e); return res.status(500).json({ error: 'backup_failed', message: 'No se pudo guardar la copia de seguridad previa, así que no se ha cerrado nada.' }); }
      }
      const out = await closeSeason(db, { season: String(body.season || ''), standings: body.standings || {}, dry: !!body.dry, userName: user.full_name || user.email || '' });
      return res.status(200).json(out);
    }
    if (a === 'season_reopen' && req.method === 'POST') {
      if (!isCoord(user)) return res.status(403).json({ error: 'forbidden' });
      return res.status(200).json(await reopenSeason(db, { season: String(body.season || '') }));
    }

    // ── Informe del rival (cuerpo técnico) ──────────────────────
    if (a === 'rival') {
      if (!isAdmin(user) && !STAFF.includes(user.app_role)) return res.status(403).json({ error: 'forbidden' });
      const id = String(req.query.event_id || '');
      if (!id) return res.status(400).json({ error: 'event_id' });
      try { return res.status(200).json(await rivalReport(id)); }
      catch (e) { console.error('rival', e); return res.status(200).json({ available: false, reason: 'fcf_error' }); }
    }

    // ── Copias de seguridad (coordinación) ──────────────────────
    if (a === 'backup_list') {
      if (!isCoord(user)) return res.status(403).json({ error: 'forbidden' });
      return res.status(200).json(await listBackups(db));
    }
    if (a === 'backup_create' && req.method === 'POST') {
      if (!isCoord(user)) return res.status(403).json({ error: 'forbidden' });
      return res.status(200).json(await createBackup(db, { kind: 'manual', note: user.full_name || user.email || '' }));
    }
    if (a === 'backup_download') {
      if (!isCoord(user)) return res.status(403).json({ error: 'forbidden' });
      // Con id: una copia guardada. Sin id: los datos de ahora mismo.
      let gz, day = new Date().toISOString().slice(0, 10);
      if (req.query.id) {
        const row = await getBackupGz(db, Number(req.query.id));
        if (!row) return res.status(404).json({ error: 'not_found' });
        gz = row.data; day = new Date(row.created_at).toISOString().slice(0, 10);
      } else {
        gz = await gzipSnapshot(await snapshotNow(db));
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Disposition', `attachment; filename="rs-manager-copia-${day}.json"`);
      res.setHeader('Content-Length', gz.length);
      return res.status(200).end(gz);
    }

    return res.status(404).json({ error: 'unknown_action' });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message });
    console.error(err);
    return res.status(500).json({ error: 'club_failed', message: err.message });
  }
}
