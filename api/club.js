// Avisos push, historial de avisos y vinculación de familiares.
// Una sola función (el plan de Vercel limita el número de funciones). Se elige la acción con ?a=...
import webpush from 'web-push';
import { query, db } from './_lib/db.js';
import { seasonStatus, closeSeason, reopenSeason, HttpError } from './_lib/season.js';
import { createBackup, listBackups, getBackupGz, snapshotNow, gzipSnapshot } from './_lib/backup.js';
import { rivalReport } from './_lib/fcfRival.js';
import { cleanDuplicates } from './_lib/dedupe.js';
import { feedFor, readConfig, tokenFor, rotateToken, isUuid } from './_lib/ics.js';
import { requireUser } from './_lib/auth.js';
import { permissionsOf, DIRECCION } from '../src/lib/permissions.js';
import { readClubBrand, saveClubBrand } from './_lib/clubBrand.js';
import { ensureSchema, importActas, searchPlayers, playerDetail, meta as fcfMeta, yearCounts, groupTeams, teamSquad, alerts as fcfAlerts, actaIds } from './_lib/fcfDb.js';
import { isAdmin, coachTeamIdsOf } from './_lib/access.js';
import { originProposals, originPatch } from './_lib/fcfOrigins.js';
import { DEFAULT_BRAND } from '../src/lib/brand.js';
import { COORD, STAFF, isApprovedUser, teamIdsOfUser, reachableUserIds, searchPeople, MAX_INDIVIDUALS } from './_lib/recipients.js';
import {
  cleanSendAt, withNoticeParam, inboxItem, historyItem, historyStats, markRead, markAllRead, unreadCount, noticeData, dispatchDue,
  resendUnread, describeRecipients, unreadByTeam, canManageNotice, editPatch, cleanTemplate, templateVisible, templateEditable, INBOX_LIMIT,
} from './_lib/notices.js';

const RELATIONS = ['padre', 'madre', 'tutor', 'otro_familiar'];

const isCoord = (u) => isAdmin(u) || COORD.includes(u.app_role);
const canSend = (u) => isCoord(u) || u.app_role === 'entrenador';
// A quién puede escribir de forma individual: coordinación a cualquiera; un entrenador, solo a gente de sus equipos
const senderScope = (u) => ({ id: u.id, coord: isCoord(u), teams: coachTeamIdsOf(u) });

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

// ── Destinatarios ────────────────────────────────────────────────────────────
// audience: { all_club, team_ids[], player_ids[], user_ids[], groups: ['jugadores','familiares','tecnico'] }
// user_ids = personas concretas (aviso individual): solo llegan a quien el remitente puede alcanzar.
async function resolveRecipients(sender, audience = {}) {
  const groups = new Set(audience.groups || []);
  let teamIds = new Set(audience.team_ids || []);
  const explicitPlayers = new Set(audience.player_ids || []);
  const wantedUsers = [...new Set((Array.isArray(audience.user_ids) ? audience.user_ids : []).filter((x) => typeof x === 'string'))].slice(0, MAX_INDIVIDUALS);

  // Un entrenador solo puede escribir a sus equipos
  if (!isCoord(sender)) {
    const mine = new Set(coachTeamIdsOf(sender));
    teamIds = new Set([...teamIds].filter((t) => mine.has(t)));
    if (audience.all_club) teamIds = mine;
    if (teamIds.size === 0 && explicitPlayers.size === 0 && wantedUsers.length === 0) return { ids: new Set(), users: [] };
  }

  const [users, players, links] = await Promise.all([byType('User'), byType('Player'), byType('GuardianLink')]);
  const reach = reachableUserIds(senderScope(sender), { users, players, links });
  const extraUsers = new Set(wantedUsers.filter((id) => reach.has(id)));
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

// Avisos programados que ya tocan (los lanza la tarea de GitHub cada pocos minutos y también al abrir Avisos)
const loadUserById = async (id) => {
  const { rows } = await query(`select e.id, e.data, a.email from entities e left join auth_users a on a.id = e.id where e.id = $1 and e.entity_type = 'User'`, [id]);
  return rows[0] ? { id: rows[0].id, email: rows[0].email, ...rows[0].data } : null;
};
const dispatchNow = () => dispatchDue({ query }, {
  loadUser: loadUserById,
  canSend: (u) => isApprovedUser(u) && canSend(u),
  resolve: async (u, audience) => [...(await resolveRecipients(u, audience)).ids],
  push: pushTo,
}).catch(() => ({ claimed: 0, sent: 0 }));

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

const originOf = (req) => `https://${req.headers['x-forwarded-host'] || req.headers.host}`;

// Calendario suscribible: lo piden las apps de calendario, sin sesión; el código secreto del enlace hace de llave.
async function icsFeed(req, res) {
  try {
    const out = await feedFor(db, String(req.query.team || ''), String(req.query.t || '').replace(/\.ics$/i, ''), originOf(req));
    if (!out) return res.status(404).send('Not found');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="calendario.ics"');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(out.text);
  } catch (e) {
    console.error('ics', e);
    return res.status(500).send('Error');
  }
}

export default async function handler(req, res) {
  if (req.query.a === 'ics') return icsFeed(req, res);
  // Aspecto del club (nombre, escudo, colores, tipografías): público, lo necesita también la pantalla de acceso
  if (req.query.a === 'brand' && req.method === 'GET') {
    try {
      return res.status(200).json({ brand: await readClubBrand() });
    } catch (e) {
      console.error('brand', e);
      return res.status(500).json({ error: 'brand_failed' });
    }
  }
  // Envía los avisos programados que ya tocan. Es pública a propósito: solo envía lo que ya debía salir.
  if (req.query.a === 'dispatch') return res.status(200).json(await dispatchNow());
  const user = await requireUser(req, res);
  if (!user) return;
  const a = req.query.a;
  const body = req.body || {};

  try {
    // Configuración del club: solo administración y dirección
    if (a === 'brand_save' && req.method === 'POST') {
      if (!(isAdmin(user) || DIRECCION.includes(user.app_role))) return res.status(403).json({ error: 'forbidden' });
      return res.status(200).json({ brand: await saveClubBrand(body.brand, user) });
    }

    // ── Base de datos FCF (Planificación → Scouting): solo dirección, coordinación y administración ──
    // Las actas llegan desde el navegador de quien las lee en la intranet de la FCF a través de la página /FcfBridge de la
    // app (mensajes entre ventanas), así que se guardan con su sesión: no hace falta ninguna clave.
    // Equipo de procedencia desde las actas de la FCF (13/11/2026): GET = ver la propuesta; POST = guardarla.
    // Solo rellena las fichas sin procedencia o con una puesta antes por este proceso (lo escrito a mano no se toca).
    if (a === 'fcf_origins') {
      if (!permissionsOf(user).administration) return res.status(403).json({ error: 'forbidden' });
      await ensureSchema(db);
      const { rows: players } = await query(`select id, data from entities where entity_type = 'Player'`);
      const brand = await readClubBrand();
      const rows = await originProposals(db, players, { clubName: brand.fcfName || DEFAULT_BRAND.fcfName });
      let written = 0;
      if (req.method === 'POST') {
        const only = Array.isArray(body.ids) ? new Set(body.ids.map(String)) : null;
        const list = rows.filter((r) => !only || only.has(String(r.id))).map((r) => ({ id: r.id, patch: originPatch(r) })).filter((x) => x.patch);
        if (list.length) {
          const { rowCount } = await query(
            `update entities e set data = e.data || v.patch, updated_at = now()
             from jsonb_to_recordset($1::jsonb) as v(id uuid, patch jsonb) where e.id = v.id and e.entity_type = 'Player'`, [JSON.stringify(list)]
          );
          written = rowCount;
        }
      }
      const count = (st) => rows.filter((r) => r.status === st).length;
      return res.status(200).json({ written, total: rows.length, ok: count('ok'), sin_anterior: count('sin_anterior'), sin_fcf: count('sin_fcf'), dudoso: count('dudoso'), manual: count('manual'), rows });
    }

    // Trayectoria de un jugador del club según las actas de la FCF (pestaña Historial de su ficha, 14/11/2026).
    // La ve el personal y el propio jugador; solo si su ficha ya está vinculada a la FCF (fcf_player_id).
    if (a === 'player_career') {
      const pid = String(req.query.player || '');
      if (!isUuid(pid)) return res.status(400).json({ error: 'bad_player' });
      if (!(isAdmin(user) || STAFF.includes(user.app_role) || user.player_id === pid)) return res.status(403).json({ error: 'forbidden' });
      const { rows } = await query(`select data->>'fcf_player_id' as fid from entities where entity_type = 'Player' and id = $1`, [pid]);
      const fid = rows[0]?.fid;
      if (!fid) return res.status(200).json({ linked: false, seasons: [] });
      await ensureSchema(db);
      const d = await playerDetail(db, fid);
      return res.status(200).json({ linked: !!d, fcf_id: fid, seasons: d?.seasons || [] });
    }

    if (['fcf_meta', 'fcf_search', 'fcf_player', 'fcf_import', 'fcf_years', 'fcf_group_teams', 'fcf_team', 'fcf_alerts', 'fcf_acta_ids'].includes(a)) {
      if (!permissionsOf(user).administration) return res.status(403).json({ error: 'forbidden' });
      await ensureSchema(db);
      if (a === 'fcf_import') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
        const actas = Array.isArray(body.actas) ? body.actas.slice(0, 60) : [];
        return res.status(200).json(await importActas(db, actas));
      }
      if (a === 'fcf_meta') return res.status(200).json(await fcfMeta(db));
      if (a === 'fcf_search') return res.status(200).json(await searchPlayers(db, req.query));
      if (a === 'fcf_years') return res.status(200).json(await yearCounts(db, req.query.season));
      if (a === 'fcf_group_teams') return res.status(200).json(await groupTeams(db, req.query));
      if (a === 'fcf_alerts') return res.status(200).json(await fcfAlerts(db, req.query.season));
      if (a === 'fcf_acta_ids') return res.status(200).json({ ids: await actaIds(db, req.query) });
      if (a === 'fcf_team') {
        const t = await teamSquad(db, req.query);
        return t ? res.status(200).json(t) : res.status(404).json({ error: 'not_found' });
      }
      const p = await playerDetail(db, req.query.id);
      return p ? res.status(200).json(p) : res.status(404).json({ error: 'not_found' });
    }

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

    // Cuántos usuarios esperan aprobación (aviso del menú y del Panel): solo un número, no la lista de usuarios
    if (a === 'pending_count') {
      if (!isCoord(user)) return res.status(200).json({ n: 0 });
      const { rows } = await query(`select count(*)::int as n from entities where entity_type = 'User' and data ->> 'access_status' = 'pending'`);
      return res.status(200).json({ n: rows[0].n });
    }

    if (a === 'my_push') {
      const { rows } = await query(`select count(*)::int as n from entities where entity_type = 'PushSubscription' and data ->> 'user_id' = $1`, [user.id]);
      return res.status(200).json({ devices: rows[0].n, configured: true });
    }

    if (a === 'inbox') {
      await dispatchNow();
      const { rows } = await query(
        `select id, data, created_at from entities where entity_type = 'Notice' and data -> 'recipient_ids' ? $1 order by created_at desc limit ${INBOX_LIMIT}`, [user.id]
      );
      return res.status(200).json(rows.map((r) => inboxItem(r, user.id)));
    }

    if (a === 'unread_count') return res.status(200).json({ n: await unreadCount({ query }, user.id) });
    if (a === 'notice_read' && req.method === 'POST') return res.status(200).json({ n: await markRead({ query }, user.id, body.ids) });
    if (a === 'notice_read_all' && req.method === 'POST') return res.status(200).json({ n: await markAllRead({ query }, user.id) });

    if (a === 'history') {
      if (!canSend(user)) return res.status(403).json({ error: 'forbidden' });
      await dispatchNow();
      const mine = isCoord(user) ? '' : `and data ->> 'sender_id' = $1`;
      const { rows } = await query(
        `select id, data, created_at from entities where entity_type = 'Notice' ${mine} order by created_at desc limit 150`, isCoord(user) ? [] : [user.id]
      );
      const items = rows.map(historyItem).filter((n) => n.status !== 'cancelado');
      return res.status(200).json({ items, stats: historyStats(items) });
    }

    // Quién lo ha leído y quién no (solo quien lo envió o coordinación)
    if (a === 'notice_people') {
      const { rows } = await query(`select data from entities where entity_type = 'Notice' and id = $1`, [String(req.query.id || '')]);
      const d = rows[0]?.data;
      if (!d) return res.status(404).json({ error: 'not_found' });
      if (!canManageNotice(d, user, isCoord(user))) return res.status(403).json({ error: 'forbidden' });
      const [users, players, links, teams] = await Promise.all([byType('User'), byType('Player'), byType('GuardianLink'), teamMap()]);
      const people = describeRecipients(d.recipient_ids || [], { users, players, links, teams });
      const read = new Set(d.read_ids || []);
      const unread = people.filter((p) => !read.has(p.id));
      const byName = (x, y) => x.team.localeCompare(y.team, 'es') || x.name.localeCompare(y.name, 'es');
      return res.status(200).json({ tracked: d.track_read === true, unread: unread.sort(byName), read: people.filter((p) => read.has(p.id)).sort(byName), by_team: unreadByTeam(unread) });
    }

    if (a === 'notice_resend' && req.method === 'POST') {
      try {
        return res.status(200).json(await resendUnread({ query }, { id: String(body.id || ''), user, coord: isCoord(user), push: pushTo }));
      } catch (e) {
        const code = e.message === 'not_found' ? 404 : e.message === 'forbidden' ? 403 : 400;
        return res.status(code).json({ error: e.message });
      }
    }

    // Corregir un aviso (enviado o programado): solo quien lo envió o coordinación
    if (a === 'notice_edit' && req.method === 'POST') {
      const { rows } = await query(`select data from entities where entity_type = 'Notice' and id = $1`, [String(body.id || '')]);
      const d = rows[0]?.data;
      if (!d) return res.status(404).json({ error: 'not_found' });
      if (!canManageNotice(d, user, isCoord(user))) return res.status(403).json({ error: 'forbidden' });
      let patch;
      try { patch = editPatch(d, body); } catch (e) { return res.status(400).json({ error: e.message }); }
      if (!patch) return res.status(200).json({ ok: true, unchanged: true });
      if (patch.audience) {
        const sender = d.sender_id === user.id ? user : (await loadUserById(d.sender_id)) || user;
        const { ids } = await resolveRecipients(sender, patch.audience);
        if (!ids.size) return res.status(400).json({ error: 'no_recipients' });
        patch.expected = ids.size;
      }
      await query(`update entities set data = data || $2::jsonb, updated_at = now() where id = $1 and data ->> 'status' = $3`, [body.id, JSON.stringify(patch), d.status || 'enviado']);
      return res.status(200).json({ ok: true });
    }

    // Avisos programados: cancelar o enviar ya
    if ((a === 'schedule_cancel' || a === 'schedule_now') && req.method === 'POST') {
      const { rows } = await query(`select data from entities where entity_type = 'Notice' and id = $1`, [String(body.id || '')]);
      const d = rows[0]?.data;
      if (!d || d.status !== 'programado') return res.status(404).json({ error: 'not_found' });
      if (!canManageNotice(d, user, isCoord(user))) return res.status(403).json({ error: 'forbidden' });
      if (a === 'schedule_cancel') {
        await query(`delete from entities where id = $1 and data ->> 'status' = 'programado'`, [body.id]);
        return res.status(200).json({ ok: true });
      }
      await query(`update entities set data = data || jsonb_build_object('send_at', $2::text) where id = $1 and data ->> 'status' = 'programado'`, [body.id, new Date().toISOString()]);
      return res.status(200).json(await dispatchNow());
    }

    // Plantillas de avisos
    if (a === 'templates') {
      if (!canSend(user)) return res.status(403).json({ error: 'forbidden' });
      const rows = await byType('NoticeTemplate');
      const coord = isCoord(user);
      return res.status(200).json(rows.filter((r) => templateVisible(r.data, user, coord))
        .map((r) => ({ id: r.id, ...r.data, editable: templateEditable(r.data, user, coord) }))
        .sort((x, y) => x.name.localeCompare(y.name, 'es')));
    }
    if ((a === 'template_save' || a === 'template_delete') && req.method === 'POST') {
      if (!canSend(user)) return res.status(403).json({ error: 'forbidden' });
      const coord = isCoord(user);
      let current = null;
      if (body.id) {
        const { rows } = await query(`select data from entities where entity_type = 'NoticeTemplate' and id = $1`, [String(body.id)]);
        current = rows[0]?.data || null;
        if (!current) return res.status(404).json({ error: 'not_found' });
        if (!templateEditable(current, user, coord)) return res.status(403).json({ error: 'forbidden' });
      }
      if (a === 'template_delete') {
        if (!current) return res.status(400).json({ error: 'id_required' });
        await query(`delete from entities where id = $1`, [body.id]);
        return res.status(200).json({ ok: true });
      }
      let clean;
      try { clean = cleanTemplate(body); } catch { return res.status(400).json({ error: 'bad_template' }); }
      if (current) {
        await query(`update entities set data = data || $2::jsonb, updated_at = now() where id = $1`, [body.id, JSON.stringify(clean)]);
        return res.status(200).json({ id: body.id, ...current, ...clean });
      }
      const data = { ...clean, owner_id: user.id, owner_name: user.full_name || user.email, shared: coord };
      const { rows } = await query(`insert into entities (entity_type, data) values ('NoticeTemplate', $1::jsonb) returning id`, [JSON.stringify(data)]);
      return res.status(200).json({ id: rows[0].id, ...data });
    }

    // Cuántas personas (a las que puede escribir) no tienen los avisos activados en ningún móvil
    if (a === 'push_coverage') {
      if (!canSend(user)) return res.status(403).json({ error: 'forbidden' });
      const [users, players, links] = await Promise.all([byType('User'), byType('Player'), byType('GuardianLink')]);
      const reach = reachableUserIds(senderScope(user), { users, players, links });
      const { rows } = await query(`select distinct data ->> 'user_id' as u from entities where entity_type = 'PushSubscription'`);
      const withPush = new Set(rows.map((r) => r.u));
      const without = [...reach].filter((id) => !withPush.has(id)).length;
      return res.status(200).json({ people: reach.size, without_push: without });
    }

    // Buscador de personas para un aviso individual (nombre, función y equipo; sin correos ni teléfonos)
    if (a === 'people') {
      if (!canSend(user)) return res.status(403).json({ error: 'forbidden' });
      const q = String(req.query.q || '');
      if (q.trim().length < 2) return res.status(200).json([]);
      const [users, players, links, teams] = await Promise.all([byType('User'), byType('Player'), byType('GuardianLink'), teamMap()]);
      const reach = reachableUserIds(senderScope(user), { users, players, links });
      const found = searchPeople(q, { users, players, links, teams, reach });
      const { rows: subs } = found.length
        ? await query(`select distinct data ->> 'user_id' as u from entities where entity_type = 'PushSubscription' and data ->> 'user_id' = any($1)`, [found.map((f) => f.id)])
        : { rows: [] };
      const pushUsers = new Set(subs.map((r) => r.u));
      return res.status(200).json(found.map((f) => ({ ...f, has_push: pushUsers.has(f.id) })));
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
      const text = String(body.body || '').trim().slice(0, 1800); // la convocatoria con listas de jugadores supera los 600
      if (!title || !text) return res.status(400).json({ error: 'title_and_body_required' });
      let scheduled;
      try { scheduled = cleanSendAt(body.send_at); } catch { return res.status(400).json({ error: 'bad_send_at' }); }
      if (!scheduled && list.length === 0) return res.status(400).json({ error: 'no_recipients' });
      const url = typeof body.url === 'string' && body.url.startsWith('/') ? body.url : '/Avisos';
      const base = noticeData({ title, body: text, url, kind: body.kind, audience: body.audience, audience_label: body.audience_label, sender: user, scheduled });
      const { rows: ins } = await query(
        `insert into entities (entity_type, data) values ('Notice', $1::jsonb) returning id`,
        [JSON.stringify(scheduled ? { ...base, expected: list.length } : { ...base, recipient_ids: list, sent: 0, failed: 0, devices: 0 })]
      );
      const id = ins[0].id;
      if (scheduled) return res.status(200).json({ id, scheduled, recipients: list.length });
      const delivery = await pushTo(list, { title, body: text, url: withNoticeParam(url, id), notice_id: id });
      await query(`update entities set data = data || $2::jsonb where id = $1`, [id, JSON.stringify(delivery)]);
      return res.status(200).json({ id, recipients: list.length, ...delivery });
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

    // Qué jugadores tienen cuenta vinculada (propia o de un familiar). Solo cifras por jugador, sin datos personales.
    if (a === 'player_accounts') {
      if (!isCoord(user)) return res.status(403).json({ error: 'forbidden' });
      const [users, links] = await Promise.all([byType('User'), byType('GuardianLink')]);
      const approved = new Map(users.filter((u) => isApprovedUser(u.data)).map((u) => [u.id, u.data]));
      const own = {}, family = {}, pending = {};
      for (const u of users) {
        const pid = u.data.player_id;
        if (pid && isApprovedUser(u.data)) own[pid] = (own[pid] || 0) + 1;
      }
      for (const l of links) {
        const pid = l.data.player_id;
        if (!pid) continue;
        if (l.data.status === 'approved' && approved.has(l.data.user_id)) family[pid] = (family[pid] || 0) + 1;
        else if (l.data.status === 'pending') pending[pid] = (pending[pid] || 0) + 1;
      }
      return res.status(200).json({ own, family, pending });
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
      catch (e) {
        if (e?.code === 'fcf_blocked' || e?.code === 'fcf_missing') return res.status(200).json({ available: false, reason: 'fcf_blocked' });
        console.error('rival', e); return res.status(200).json({ available: false, reason: 'fcf_error' });
      }
    }

    // ── Calendario suscribible por equipo (cuerpo técnico del equipo y coordinación) ──
    if (a === 'ics_link' || (a === 'ics_rotate' && req.method === 'POST')) {
      const teamId = String(req.query.team_id || body.team_id || '');
      if (!isUuid(teamId)) return res.status(400).json({ error: 'team_id' });
      const mine = isCoord(user) || (STAFF.includes(user.app_role) && teamIdsOfUser(user).includes(teamId)) || coachTeamIdsOf(user).includes(teamId);
      if (!mine) return res.status(403).json({ error: 'forbidden' });
      const cfg = a === 'ics_rotate' ? await rotateToken(db, teamId) : await readConfig(db);
      return res.status(200).json({ url: `${originOf(req)}/cal/${teamId}/${tokenFor(cfg, teamId)}.ics` });
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

    // ── Limpieza de duplicados (coordinación): vista previa y aplicar, siempre con copia de seguridad antes ──
    if (a === 'dupes_preview') {
      if (!isCoord(user)) return res.status(403).json({ error: 'forbidden' });
      return res.status(200).json(await cleanDuplicates(db, { dry: true }));
    }
    if (a === 'dupes_apply' && req.method === 'POST') {
      if (!isCoord(user)) return res.status(403).json({ error: 'forbidden' });
      try { await createBackup(db, { kind: 'manual', note: `Antes de limpiar duplicados (${user.full_name || user.email || ''})` }); }
      catch (e) { console.error(e); return res.status(500).json({ error: 'backup_failed', message: 'No se pudo guardar la copia de seguridad previa, así que no se ha cambiado nada.' }); }
      return res.status(200).json(await cleanDuplicates(db, { dry: false }));
    }

    return res.status(404).json({ error: 'unknown_action' });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message });
    console.error(err);
    return res.status(500).json({ error: 'club_failed', message: err.message });
  }
}
