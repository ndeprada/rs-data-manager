import assert from 'node:assert/strict';
import { buildGuestIndex, tokensKey } from '../api/_lib/rosterMatch.js';

const team = (id, season = '2026-2027') => ({ id, data: { season } });
const pl = (id, first, last, team_id, extra = {}) => ({ id, data: { first_name: first, last_name: last, team_id, status: 'activo', ...extra } });
// Igual que fcfPlayerKey: "APELLIDOS, NOMBRE"
const fcf = (nombre) => tokensKey(String(nombre).replace(',', ' '));

const teams = [team('s9a'), team('s10a'), team('s10b'), team('s11a'), team('viejo', '2025-2026')];
const players = [
  pl('lucas', 'Lucas', 'Gimeno Navarro', 's9a', { birth_year: 2018 }),
  pl('pau', 'Pau', 'Garcia Mora', 's10a'),
  pl('pau2', 'Pau', 'Garcia Mora', 'viejo'),            // misma persona en otra temporada: no cuenta
  pl('marcel', 'Marcel', 'De Haro Segarra', 's10a'),
  pl('marcel2', 'Marcel', 'De Haro Segarra', 's10b'),    // en dos equipos a la vez: ambiguo
  pl('marc', 'Marc', '', 's9a'),                         // un solo nombre: nunca se empareja
  pl('baja', 'Joan', 'Soler Pons', 's9a', { status: 'baja' }),
  pl('arch', 'Nil', 'Roca Vidal', 's9a', { archived_season: '2025-2026' }),
];
const idx = buildGuestIndex(players, teams);

// El caso real: el acta del Sub-10 A lista a un jugador del Sub-9 A
assert.equal(idx.find('s10a', fcf('GIMENO NAVARRO, LUCAS')), 'lucas');
// Da igual mayúsculas, tildes y el orden de nombre/apellidos
assert.equal(idx.find('s10a', fcf('gímeno navarro, lúcas')), 'lucas');
assert.equal(idx.find('s10a', fcf('LUCAS GIMENO NAVARRO')), 'lucas');
// No se busca a sí mismo: en su propio equipo ya lo encuentra la plantilla
assert.equal(idx.find('s9a', fcf('GIMENO NAVARRO, LUCAS')), '');
// Otra temporada, bajas y archivados no son candidatos
assert.equal(idx.find('s11a', fcf('GARCIA MORA, PAU')), 'pau', 'el de la temporada anterior no cuenta');
assert.equal(idx.find('viejo', fcf('GARCIA MORA, PAU')), '', 'un equipo de otra temporada no recibe invitados de esta');
assert.equal(idx.find('s10a', fcf('SOLER PONS, JOAN')), '');
assert.equal(idx.find('s10a', fcf('ROCA VIDAL, NIL')), '');
// Si hay dos posibles personas no se adivina
assert.equal(idx.find('s11a', fcf('DE HARO SEGARRA, MARCEL')), '');
// Con un solo nombre no hay forma fiable
assert.equal(idx.find('s10a', fcf('MARC')), '');
// Nadie con ese nombre
assert.equal(idx.find('s10a', fcf('NADIE, NINGUN')), '');

// Un jugador recién creado en esta sincronización también se reconoce en otro equipo
idx.add(fcf('RIBAS CASAS, ARNAU'), '@new0', 's10a');
assert.equal(idx.find('s11a', fcf('RIBAS CASAS, ARNAU')), '@new0');
assert.equal(idx.find('s10a', fcf('RIBAS CASAS, ARNAU')), '');
