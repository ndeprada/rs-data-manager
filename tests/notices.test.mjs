import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import {
  cleanSendAt, withNoticeParam, inboxItem, historyItem, historyStats, markRead, markAllRead, unreadCount, noticeData,
  dispatchDue, resendUnread, describeRecipients, unreadByTeam, cleanTemplate, templateVisible, templateEditable, kindOf,
} from '../api/_lib/notices.js';

const pg = new PGlite();
await pg.exec(`create table entities (id uuid primary key default gen_random_uuid(), entity_type text not null, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());`);
const db = { query: (t, p) => pg.query(t, p) };
const add = async (type, data) => (await pg.query(`insert into entities (entity_type, data) values ($1, $2::jsonb) returning id`, [type, JSON.stringify(data)])).rows[0].id;
const get = async (id) => (await pg.query(`select id, data, created_at from entities where id=$1`, [id])).rows[0];

const NOW = new Date('2026-11-13T18:00:00Z');

// Hora programada
assert.equal(cleanSendAt('', NOW), null);
assert.equal(cleanSendAt('2026-11-14T08:00:00+01:00', NOW), '2026-11-14T07:00:00.000Z');
assert.throws(() => cleanSendAt('2026-11-13T17:00:00Z', NOW), /bad_send_at/);
assert.throws(() => cleanSendAt('2027-03-01T08:00:00Z', NOW), /bad_send_at/);
assert.throws(() => cleanSendAt('mañana', NOW), /bad_send_at/);

// Dirección con el aviso
assert.equal(withNoticeParam('/Avisos', 'x'), '/Avisos?aviso=x');
assert.equal(withNoticeParam('/MatchDetail?id=1&tab=convocatoria#top', 'x'), '/MatchDetail?id=1&tab=convocatoria&aviso=x#top');
assert.equal(withNoticeParam('https://otra.web', 'x'), '/Avisos?aviso=x');
assert.equal(kindOf('raro'), 'general');

// Lectura: los avisos antiguos (sin track_read) cuentan como leídos
const sender = { id: 'u-coord', full_name: 'Nacho' };
const old = await add('Notice', { title: 'Viejo', body: 'x', recipient_ids: ['u1', 'u2'] });
const n1 = await add('Notice', { ...noticeData({ title: 'Uno', body: 'b', kind: 'urgente', sender }), recipient_ids: ['u1', 'u2', 'u3'] });
const n2 = await add('Notice', { ...noticeData({ title: 'Dos', body: 'b', sender }), recipient_ids: ['u1'] });
assert.equal(inboxItem(await get(old), 'u1').read, true);
assert.equal(inboxItem(await get(n1), 'u1').read, false);
assert.equal(inboxItem(await get(n1), 'u1').kind, 'urgente');
assert.equal(await unreadCount(db, 'u1'), 2);
assert.equal(await markRead(db, 'u1', [n1]), 1);
assert.equal(await markRead(db, 'u1', [n1]), 0, 'no se apunta dos veces');
assert.equal(await markRead(db, 'u9', [n1]), 0, 'quien no es destinatario no cuenta');
assert.equal(await unreadCount(db, 'u1'), 1);
assert.equal(await markAllRead(db, 'u1'), 1);
assert.equal(await unreadCount(db, 'u1'), 0);
await markRead(db, 'u2', [n1]);
let h = historyItem(await get(n1));
assert.deepEqual([h.tracked, h.read, h.unread, h.recipients], [true, 2, 1, 3]);
assert.deepEqual([historyItem(await get(old)).tracked, historyItem(await get(old)).read], [false, null]);

// Resumen
const items = [historyItem(await get(n1)), historyItem(await get(n2)), historyItem(await get(old))];
const st = historyStats(items, new Date());
assert.equal(st.week, 3);
assert.equal(st.week_urgent, 1);
assert.equal(st.read_pct, 75); // 2/3 + 1/1 = 3 de 4

// Reenvío a quien no lo ha leído
const pushed = [];
const push = async (ids, payload) => { pushed.push({ ids, payload }); return { sent: ids.length, failed: 0, devices: ids.length }; };
const r = await resendUnread(db, { id: n1, user: sender, coord: false, push, now: NOW });
assert.deepEqual(pushed[0].ids, ['u3']);
assert.match(pushed[0].payload.title, /^Recordatorio: Uno/);
assert.match(pushed[0].payload.url, new RegExp(`aviso=${n1}`));
assert.equal(r.to, 1);
await assert.rejects(resendUnread(db, { id: n1, user: sender, coord: false, push, now: new Date(NOW.getTime() + 60_000) }), /too_soon/);
await assert.rejects(resendUnread(db, { id: n1, user: { id: 'otro' }, coord: false, push, now: new Date(NOW.getTime() + 3600_000) }), /forbidden/);
await assert.rejects(resendUnread(db, { id: old, user: sender, coord: true, push, now: NOW }), /untracked/);

// Programados: se envían cuando toca, una sola vez, y con los destinatarios de ese momento
const s1 = await add('Notice', noticeData({ title: 'Prog', body: 'b', sender, audience: { team_ids: ['t1'] }, scheduled: '2026-11-13T17:59:00.000Z' }));
const s2 = await add('Notice', noticeData({ title: 'Futuro', body: 'b', sender, scheduled: '2026-11-14T08:00:00.000Z' }));
const s3 = await add('Notice', noticeData({ title: 'Sin remitente', body: 'b', sender: { id: 'borrado' }, scheduled: '2026-11-13T10:00:00.000Z' }));
const deps = {
  loadUser: async (id) => (id === 'u-coord' ? sender : null),
  canSend: () => true,
  resolve: async (u, aud) => (aud.team_ids?.[0] === 't1' ? ['u1', 'u5'] : []),
  push,
};
const [a1, a2] = await Promise.all([dispatchDue(db, deps, NOW), dispatchDue(db, deps, NOW)]);
assert.equal(a1.sent + a2.sent, 1, 'solo una vez aunque se llame a la vez');
const sent1 = (await get(s1)).data;
assert.equal(sent1.status, 'enviado');
assert.deepEqual(sent1.recipient_ids, ['u1', 'u5']);
assert.ok(!('claimed_at' in sent1));
assert.equal((await get(s2)).data.status, 'programado');
assert.equal((await get(s3)).data.status, 'fallido');
assert.equal(historyItem(await get(s2)).status, 'programado');
assert.equal((await dispatchDue(db, deps, NOW)).claimed, 0);

// Quién es cada destinatario
const people = describeRecipients(['a', 'b', 'c', 'd'], {
  users: [
    { id: 'a', data: { full_name: 'Ana', app_role: 'jugador', player_id: 'p1' } },
    { id: 'b', data: { full_name: 'Bea', app_role: 'familiar' } },
    { id: 'c', data: { full_name: 'Carlos', app_role: 'entrenador', team_ids: ['t2'] } },
  ],
  players: [{ id: 'p1', data: { first_name: 'Ana', last_name: 'Ruiz', team_id: 't1' } }, { id: 'p2', data: { first_name: 'Leo', last_name: 'Gil', team_id: 't2' } }],
  links: [{ data: { status: 'approved', user_id: 'b', player_id: 'p2' } }],
  teams: new Map([['t1', 'Juvenil A'], ['t2', 'Cadete B']]),
});
assert.deepEqual(people.map((p) => [p.kind, p.team]), [['jugador', 'Juvenil A'], ['familiar', 'Cadete B'], ['tecnico', 'Cadete B'], ['otro', '']]);
assert.equal(people[1].child, 'Leo Gil');
assert.deepEqual(unreadByTeam(people)[0], { team: 'Cadete B', n: 2 });

// Plantillas
assert.throws(() => cleanTemplate({ name: '', title: 'x' }), /bad_template/);
assert.deepEqual(cleanTemplate({ name: ' Lluvia ', title: 'Entreno cancelado', body: 'Hoy no', kind: 'urgente' }), { name: 'Lluvia', title: 'Entreno cancelado', body: 'Hoy no', kind: 'urgente' });
assert.equal(templateVisible({ owner_id: 'x', shared: false }, { id: 'y' }, false), false);
assert.equal(templateVisible({ owner_id: 'x', shared: true }, { id: 'y' }, false), true);
assert.equal(templateEditable({ owner_id: 'x', shared: true }, { id: 'y' }, false), false);
assert.equal(templateEditable({ owner_id: 'x' }, { id: 'y' }, true), true);

console.log('notices ok');
