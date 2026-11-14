import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { splitFullName, proposalFor, splitKeys, nameProposals } from '../api/_lib/nameSplit.js';
import { ensureSchema } from '../api/_lib/fcfDb.js';

// ── Partir el nombre completo de la plantilla FCF ──
assert.deepEqual(splitFullName('JOAN ABANTE GARCIA'), { first: 'Joan', last: 'Abante Garcia' });
assert.deepEqual(splitFullName('JOAN ABANTE DE PRADA'), { first: 'Joan', last: 'Abante De Prada' }, 'el primer apellido no va al nombre');
assert.deepEqual(splitFullName('MARIA DE LA FUENTE GIL'), { first: 'Maria', last: 'De La Fuente Gil' });
assert.deepEqual(splitFullName('JOAN MARC PUIG MAS'), { first: 'Joan Marc', last: 'Puig Mas' }, 'nombre compuesto');
assert.deepEqual(splitFullName('POL FONT'), { first: 'Pol', last: 'Font' });
assert.deepEqual(splitFullName('ARNAU PUIG I CADAFALCH ROS'), { first: 'Arnau', last: 'Puig I Cadafalch Ros' });
assert.deepEqual(splitFullName('ADAM EL AMRANI'), { first: 'Adam', last: 'El Amrani' }, 'un solo apellido con partícula');

// ── Propuesta con el nombre de la FCF («APELLIDOS, NOMBRE») ──
assert.deepEqual(proposalFor({ first_name: 'Joan Abante', last_name: 'de Prada' }, 'ABANTE DE PRADA, JOAN'), { first_name: 'Joan', last_name: 'Abante de Prada' }, 'respeta mayúsculas de la ficha');
assert.equal(proposalFor({ first_name: 'Joan', last_name: 'Abante de Prada' }, 'ABANTE DE PRADA, JOAN'), null, 'ya está bien');
assert.equal(proposalFor({ first_name: 'Joan', last_name: 'Abante' }, 'ABANTE DE PRADA, JOAN'), null, 'palabras distintas: no se toca');
assert.deepEqual(proposalFor({ first_name: 'Joan', last_name: 'Marc Puig Mas' }, 'PUIG MAS, JOAN MARC'), { first_name: 'Joan Marc', last_name: 'Puig Mas' }, 'también al revés');
assert.deepEqual(proposalFor({ first_name: 'Martí', last_name: 'Àlvarez Ros' }, 'ALVAREZ ROS, MARTI'), null, 'acentos distintos no cuentan');
assert.deepEqual(splitKeys({ first_name: 'Joan Abante', last_name: 'de Prada' }), ['abante de prada, joan', 'de prada, joan abante', 'prada, joan abante de']);

// ── Revisión de todas las fichas ──
const db = new PGlite();
await ensureSchema(db);
const fp = [['1', 'ABANTE DE PRADA, JOAN'], ['2', 'PUIG MAS, JAN'], ['3', 'RUIZ DEL OLMO, PAU'], ['4', 'GIL, ARNAU ROS'], ['5', 'ROS GIL, ARNAU']];
for (const [id, name] of fp) await db.query(`insert into fcf_players (id, name, name_norm) values ($1, $2, lower($2))`, [id, name]);
const players = [
  { id: 'a', data: { first_name: 'Joan Abante', last_name: 'De Prada', fcf_player_id: '1', team_id: 't1' } }, // vinculada, mal
  { id: 'b', data: { first_name: 'Jan', last_name: 'Puig Mas', fcf_player_id: '2' } }, // bien
  { id: 'c', data: { first_name: 'Pau Ruiz', last_name: 'Del Olmo' } }, // sin vincular, un único corte en la FCF
  { id: 'd', data: { first_name: 'Arnau', last_name: 'Ros Gil' } }, // dos cortes posibles en la FCF: no se adivina
  { id: 'e', data: { first_name: 'Joan Abante', last_name: 'De Prada', archived: true, fcf_player_id: '1' } },
];
const rows = await nameProposals(db, players);
assert.deepEqual(rows.map((r) => [r.id, r.source, r.proposed.first_name, r.proposed.last_name]), [
  ['a', 'vinculada', 'Joan', 'Abante De Prada'],
  ['c', 'nombre', 'Pau', 'Ruiz Del Olmo'],
]);
console.log('nameSplit ok');
