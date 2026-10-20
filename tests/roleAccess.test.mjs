import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { makeRoleAccess } from '../api/_lib/access.js';

const pg = new PGlite();
await pg.exec(`
  create table entities (id uuid primary key default gen_random_uuid(), entity_type text not null, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  create table auth_users (id uuid primary key, email text not null);
`);
const add = async (type, data) => (await pg.query(`insert into entities (entity_type, data) values ($1, $2::jsonb) returning id`, [type, JSON.stringify(data)])).rows[0].id;
const addUser = async (email, data) => {
  const id = (await pg.query(`insert into entities (entity_type, data) values ('User', $1::jsonb) returning id`, [JSON.stringify(data)])).rows[0].id;
  await pg.query(`insert into auth_users (id, email) values ($1, $2)`, [id, email]);
  return { id, email, ...data };
};

const staffAna = await add('StaffMember', { first_name: 'Ana', last_name: 'Pérez', email: 'ana@club.es' });
const staffLuis = await add('StaffMember', { first_name: 'Luis', last_name: 'Gil', email: 'luis@club.es' });
const ana = await addUser('ana@club.es', { full_name: 'Ana Pérez', app_role: 'entrenador', access_status: 'approved' });
const luis = await addUser('luis@club.es', { full_name: 'Luis Gil', app_role: 'entrenador', access_status: 'approved' });
const armand = await addUser('armand@club.es', { full_name: 'Armand Vallés', app_role: 'psicologo', access_status: 'approved' });
const portero = await addUser('gk@club.es', { full_name: 'Entrenador Porteros', app_role: 'entrenador_porteros', access_status: 'approved' });
const fisio = await addUser('fisio@club.es', { full_name: 'Fisio Club', app_role: 'fisioterapeuta', access_status: 'approved' });
const admin = await addUser('admin@club.es', { full_name: 'Nacho', role: 'admin', app_role: 'director_deportivo', access_status: 'approved' });
const jugador = await addUser('j@club.es', { full_name: 'Jugador', app_role: 'jugador', access_status: 'approved' });

const fbAnaSent = await add('CoachFeedback', { staff_id: staffAna, status: 'enviado', text: 'Buen trabajo' });
const fbAnaDraft = await add('CoachFeedback', { staff_id: staffAna, status: 'borrador', text: 'Borrador' });
const fbLuisSent = await add('CoachFeedback', { staff_id: staffLuis, status: 'enviado', text: 'De Luis' });

const { checkRoleWriteAccess: write, roleFilterDocs: read } = makeRoleAccess((t, p) => pg.query(t, p));
const feedback = async () => (await pg.query(`select id, data from entities where entity_type = 'CoachFeedback'`)).rows.map((r) => ({ id: r.id, ...r.data }));

// Lecturas del feedback a entrenadores
assert.deepEqual((await read(ana, 'CoachFeedback', await feedback())).map((d) => d.id), [fbAnaSent], 'Ana solo ve lo enviado y suyo');
assert.deepEqual((await read(luis, 'CoachFeedback', await feedback())).map((d) => d.id), [fbLuisSent]);
assert.equal((await read(armand, 'CoachFeedback', await feedback())).length, 3, 'psicología lo ve todo, también borradores');
assert.equal((await read(admin, 'CoachFeedback', await feedback())).length, 3);

// Escrituras
assert.equal((await write(ana, 'CoachFeedback', 'PUT', { replies: [{ text: 'Gracias' }] }, fbAnaSent)).ok, true, 'Ana contesta a su feedback');
assert.equal((await write(ana, 'CoachFeedback', 'PUT', { replies: [] }, fbAnaDraft)).ok, false, 'no toca un borrador');
assert.equal((await write(ana, 'CoachFeedback', 'PUT', { replies: [] }, fbLuisSent)).ok, false, 'ni el de otro');
assert.equal((await write(ana, 'CoachFeedback', 'DELETE', {}, fbAnaSent)).ok, false);
assert.equal((await write(ana, 'CoachFeedback', 'POST', { staff_id: staffAna })).ok, false);
assert.equal((await write(armand, 'CoachFeedback', 'POST', { staff_id: staffLuis })).ok, true, 'psicología escribe feedback a entrenadores');
assert.equal((await write(armand, 'CoachFeedback', 'DELETE', {}, fbLuisSent)).ok, true);
assert.equal((await write(admin, 'CoachFeedback', 'DELETE', {}, fbLuisSent)).ok, true);

// Médico y evaluaciones de jugadores
const injuries = [{ id: 'i1', player_id: 'p1' }];
assert.equal((await read(portero, 'Injury', injuries)).length, 0, 'el entrenador de porteros no ve lesiones');
assert.equal((await read(armand, 'Injury', injuries)).length, 1, 'psicología las ve');
assert.equal((await read(fisio, 'Injury', injuries)).length, 1);
assert.equal((await read(fisio, 'Evaluation360', [{ id: 'e1' }])).length, 0, 'el fisio no ve evaluaciones del jugador');
assert.equal((await read(ana, 'Injury', injuries)).length, 1);
assert.equal((await write(armand, 'Injury', 'POST', { player_id: 'p1' })).ok, false, 'psicología solo lee lo médico');
assert.equal((await write(fisio, 'Injury', 'POST', { player_id: 'p1' })).ok, true);
assert.equal((await write(fisio, 'PDIGoal', 'POST', { player_id: 'p1' })).ok, false);
assert.equal((await write(portero, 'Evaluation360', 'POST', { player_id: 'p1' })).ok, true, 'porteros evalúa');
assert.equal((await write(ana, 'PlayerDocument', 'POST', {})).ok, true);

// Lo que no es de personal pasa tal cual: el jugador se filtra por su propia vía
assert.equal((await read(jugador, 'Injury', injuries)).length, 1);
assert.equal((await write(jugador, 'Injury', 'POST', {})).ok, true, 'la regla del jugador (solo lectura) la pone otra comprobación');
assert.equal((await read(portero, 'Event', [{ id: 'x' }])).length, 1);

console.log('roleAccess ok');
