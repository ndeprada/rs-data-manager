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
const coord = await addUser('coord@club.es', { full_name: 'Coordinador', app_role: 'coordinador_general', access_status: 'approved' });
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

// Pierna no hábil (ficha del jugador): la escriben entrenadores y coordinación, con un valor de 1 a 5 o vacío
assert.equal((await write(ana, 'Player', 'PUT', { weak_foot_rating: 4 }, 'p1')).ok, true, 'un entrenador la valora');
assert.equal((await write(ana, 'Player', 'PUT', { weak_foot_rating: null }, 'p1')).ok, true, 'y puede quitarla');
assert.equal((await write(admin, 'Player', 'PUT', { weak_foot_rating: 2 }, 'p1')).ok, true, 'la coordinación también');
assert.equal((await write(ana, 'Player', 'PUT', { weak_foot_rating: 6 }, 'p1')).ok, false, 'más de 5 no vale');
assert.equal((await write(ana, 'Player', 'PUT', { weak_foot_rating: 0 }, 'p1')).ok, false);
assert.equal((await write(ana, 'Player', 'PUT', { weak_foot_rating: '4' }, 'p1')).ok, false, 'solo números');
assert.equal((await write(armand, 'Player', 'PUT', { weak_foot_rating: 3 }, 'p1')).ok, false, 'psicología no edita fichas');
assert.equal((await write(portero, 'Player', 'PUT', { weak_foot_rating: 3 }, 'p1')).ok, false, 'ni el entrenador de porteros');
assert.equal((await write(fisio, 'Player', 'PUT', { weak_foot_rating: 3 }, 'p1')).ok, false);
assert.equal((await write(armand, 'Player', 'PUT', { phone: '600000000' }, 'p1')).ok, true, 'el resto de la ficha no cambia de reglas');
assert.equal((await read(armand, 'Player', [{ id: 'p1', weak_foot_rating: 3 }]))[0].weak_foot_rating, 3, 'el resto del cuerpo técnico la ve');

// Evento de todo el club (una copia por equipo con club_event_id): solo coordinación lo crea o lo cambia
const clubCopy = { title: 'Fiesta del club', type: 'evento_club', team_id: 't1', club_event_id: 'g1' };
assert.equal((await write(coord, 'Event', 'POST', clubCopy)).ok, true, 'coordinación crea el evento de club');
assert.equal((await write(admin, 'Event', 'POST', clubCopy)).ok, true);
assert.equal((await write(ana, 'Event', 'POST', clubCopy)).ok, false, 'un entrenador no');
assert.equal((await write(ana, 'Event', 'PUT', { club_event_id: 'g1' }, 'e1')).ok, false);
assert.equal((await write(ana, 'Event', 'POST', { title: 'Entreno', type: 'entrenamiento', team_id: 't1' })).ok, true, 'sus eventos normales siguen igual');
assert.equal((await write(ana, 'Event', 'PUT', { cancelled: true, cancel_reason: 'lluvia' }, 'e1')).ok, true, 'cancelar (también una copia de club) sigue abierto');
assert.equal((await write(ana, 'Event', 'DELETE', {}, 'e1')).ok, true);

// Lo que no es de personal pasa tal cual: el jugador se filtra por su propia vía
assert.equal((await read(jugador, 'Injury', injuries)).length, 1);
assert.equal((await write(jugador, 'Injury', 'POST', {})).ok, true, 'la regla del jugador (solo lectura) la pone otra comprobación');
assert.equal((await read(portero, 'Event', [{ id: 'x' }])).length, 1);

// Sesiones de entrenamiento (CoachSession): personales; la coordinación las lee todas; solo su autor las cambia
const sAna = await add('CoachSession', { owner_id: ana.id, team_id: 't1', date: '2026-10-21' });
const sLuis = await add('CoachSession', { owner_id: luis.id, team_id: 't2', date: '2026-10-21' });
const sessions = async () => (await pg.query(`select id, data from entities where entity_type = 'CoachSession'`)).rows.map((r) => ({ id: r.id, ...r.data }));
assert.deepEqual((await read(ana, 'CoachSession', await sessions())).map((d) => d.id), [sAna], 'cada entrenador ve solo las suyas');
assert.deepEqual((await read(luis, 'CoachSession', await sessions())).map((d) => d.id), [sLuis]);
assert.equal((await read(coord, 'CoachSession', await sessions())).length, 2, 'la coordinación ve todas');
assert.equal((await read(admin, 'CoachSession', await sessions())).length, 2);
assert.equal((await read(portero, 'CoachSession', await sessions())).length, 0, 'otras funciones solo ven las suyas');
assert.equal((await write(ana, 'CoachSession', 'POST', { owner_id: ana.id, team_id: 't1' })).ok, true, 'crea la suya');
assert.equal((await write(ana, 'CoachSession', 'POST', { owner_id: luis.id, team_id: 't1' })).ok, false, 'no la crea a nombre de otro');
assert.equal((await write(ana, 'CoachSession', 'POST', { team_id: 't1' })).ok, false, 'sin autor no vale');
assert.equal((await write(ana, 'CoachSession', 'PUT', { obj_atk: 'x' }, sAna)).ok, true, 'cambia la suya');
assert.equal((await write(ana, 'CoachSession', 'PUT', { obj_atk: 'x' }, sLuis)).ok, false, 'no cambia la de otro');
assert.equal((await write(ana, 'CoachSession', 'PUT', { owner_id: luis.id }, sAna)).ok, false, 'no la cede a otro');
assert.equal((await write(ana, 'CoachSession', 'DELETE', {}, sLuis)).ok, false);
assert.equal((await write(ana, 'CoachSession', 'DELETE', {}, sAna)).ok, true);
assert.equal((await write(coord, 'CoachSession', 'PUT', { obj_atk: 'x' }, sLuis)).ok, false, 'la coordinación lee pero no cambia las de otros');
assert.equal((await write(coord, 'CoachSession', 'POST', { owner_id: coord.id })).ok, true, 'sí crea las suyas');
assert.equal((await write(admin, 'CoachSession', 'PUT', { obj_atk: 'x' }, sLuis)).ok, true, 'administración puede todo');

console.log('roleAccess ok');
