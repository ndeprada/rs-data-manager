import assert from 'node:assert/strict';
import {
  nextSeason, buildPlan, summarize, visibleZones, isCoreZone, sideOfLaterality, birthYearOf, hasSides, groupOf, ZONES, zoneByKey,
} from '../src/lib/squadPlan.js';

// ── Temporada siguiente ─────────────────────────────────────────────────────────────────────────────────────────────────────
assert.equal(nextSeason('2026-2027'), '2027-2028');
assert.equal(nextSeason('2099-2100'), '2100-2101');
assert.equal(nextSeason(''), '', 'sin temporada no se inventa nada');
assert.equal(nextSeason('26-27'), '');

// ── Lateralidad, año de nacimiento, grupos ─────────────────────────────────────────────────────────────────────────────────
assert.equal(sideOfLaterality('zurdo'), 'l');
assert.equal(sideOfLaterality('Diestro'), 'r');
assert.equal(sideOfLaterality('ambidiestro'), null);
assert.equal(sideOfLaterality(undefined), null);
assert.equal(birthYearOf({ birth_year: 2014 }), 2014);
assert.equal(birthYearOf({ birth_date: '2013-05-02' }), 2013, 'jugador de scouting: el año de su fecha de nacimiento');
assert.equal(birthYearOf({ birth_year: '2012' }), 2012);
assert.equal(birthYearOf({}), null);
assert.equal(birthYearOf({ birth_year: 12 }), null, 'un año de dos cifras no es válido');
assert.equal(hasSides('lateral'), true);
assert.equal(hasSides('central'), false);
assert.equal(groupOf('libre'), 'Defensas');
assert.equal(groupOf('mediapunta'), 'Medios');
assert.equal(groupOf('extremo'), 'Delanteros');
assert.equal(groupOf(null), null);

// ── Puestos del campograma ─────────────────────────────────────────────────────────────────────────────────────────────────
assert.equal(new Set(ZONES.map((z) => z.key)).size, ZONES.length, 'claves de puesto únicas');
for (const z of ZONES) assert.ok(z.x - z.w / 2 >= 0 && z.x + z.w / 2 <= 100, `el puesto ${z.key} cabe a lo ancho del campo`);
assert.ok(zoneByKey('portero').y > zoneByKey('central').y && zoneByKey('central').y > zoneByKey('delantero_centro').y, 'ataque arriba: portero abajo, delanteros arriba');
assert.ok(zoneByKey('lateral_l').x < 50 && zoneByKey('lateral_r').x > 50, 'izquierda del equipo a la izquierda de la pantalla');
assert.equal(isCoreZone('f11', 'mediocentro'), true);
assert.equal(isCoreZone('f7', 'mediocentro'), false);
assert.equal(isCoreZone('f7', 'mediapunta'), true);
assert.equal(isCoreZone('f11', 'mediapunta'), false);

// ── Plantilla prevista ─────────────────────────────────────────────────────────────────────────────────────────────────────
const P = (id, first, last, position, extra = {}) => ({ id, first_name: first, last_name: last, position, status: 'activo', birth_year: 2014, ...extra });
const players = [
  P('p1', 'Pau', 'García', 'portero'),
  P('p2', 'Leo', 'Martí', 'lateral', { laterality: 'zurdo' }),
  P('p3', 'Marc', 'Roca', 'lateral', { laterality: 'diestro' }),
  P('p4', 'Nil', 'Vidal', 'lateral'),
  P('p5', 'Pol', 'Ferrer', 'lateral'),
  P('p6', 'Eric', 'Soler', 'delantero_centro', { birth_year: 2013 }),
  P('p7', 'Aleix', 'Bosch', 'central'),
  P('p8', 'Dani', 'Puig', 'central', { status: 'baja' }),
  P('p9', 'Iván', 'Sala', null),
  P('p10', 'Teo', 'Rius', 'central', { status: 'lesionado' }),
];
const scouted = [
  { id: 's1', first_name: 'Biel', last_name: 'Casas', position: 'central', birth_date: '2014-03-01', decision: 'fichar', rating: 4, current_club: 'CE Europa' },
  { id: 's2', first_name: 'Joan', last_name: 'Pons', position: 'extremo', laterality: 'zurdo', birth_year: 2014, decision: 'seguir_viendo' },
];
const entries = [
  { id: 'e1', kind: 'player', ref_id: 'p3', status: 'sale', note: 'Se va al Barça' },
  { id: 'e2', kind: 'player', ref_id: 'p1', status: 'duda' },
  { id: 'e3', kind: 'scout', ref_id: 's1', position: 'central' },
  { id: 'e4', kind: 'scout', ref_id: 's2', position: 'extremo', side: 'r' },
  { id: 'e5', kind: 'scout', ref_id: 'borrado', position: 'portero' },
];
const plan = buildPlan({ players, scouted, entries });
const zone = (k) => plan.zones.find((z) => z.key === k);
const names = (k) => zone(k).items.map((i) => i.key);

assert.equal(plan.items.some((i) => i.id === 'p8'), false, 'los jugadores dados de baja no cuentan');
assert.equal(plan.orphans, 1, 'un objetivo cuyo jugador de scouting ya no existe se ignora y se cuenta');
assert.deepEqual(names('portero'), ['p:p1']);
assert.equal(zone('portero').items[0].status, 'duda', 'el estado sale del registro del plan');
assert.equal(plan.items.find((i) => i.id === 'p2').status, 'continua', 'sin registro, continúa');
assert.equal(plan.items.find((i) => i.id === 'p3').note, 'Se va al Barça');

// Laterales: el zurdo a la izquierda, el diestro a la derecha, y los que no tienen dato se reparten al lado con menos gente
assert.ok(names('lateral_l').includes('p:p2'), 'zurdo → lateral izquierdo');
assert.ok(names('lateral_r').includes('p:p3'), 'diestro → lateral derecho');
assert.equal(names('lateral_l').length + names('lateral_r').length, 4);
assert.equal(names('lateral_l').length, 2, 'los dos sin dato se reparten: 2 y 2');
assert.equal(names('lateral_r').length, 2);

// Centrales: jugadores actuales primero (por estado) y luego el objetivo; el lesionado sigue contando y se marca
assert.deepEqual(names('central'), ['p:p7', 'p:p10', 's:s1']);
assert.equal(zone('central').items[1].injured, true);
assert.equal(zone('central').items[2].kind, 'scout');
assert.equal(zone('central').items[2].status, 'objetivo');
assert.equal(zone('central').items[2].year, 2014, 'el año del objetivo sale de su fecha de nacimiento');
assert.equal(zone('central').items[2].decision, 'fichar');

// El objetivo con lado guardado manda sobre su lateralidad
assert.deepEqual(names('extremo_r'), ['s:s2'], 'el lado elegido en el plan gana a la lateralidad de la ficha');
assert.deepEqual(names('extremo_l'), []);

// Sin posición: fuera del campo pero contado
assert.deepEqual(plan.unplaced.map((i) => i.key), ['p:p9']);

// Resumen: continúan + objetivos = plantilla prevista; las dudas y los que se van, aparte
const s = plan.summary;
assert.deepEqual(s.total, { continua: 7, duda: 1, sale: 1, objetivo: 2, prevista: 9 });
assert.deepEqual(s.groups.Porteros, { continua: 0, duda: 1, sale: 0, objetivo: 0, prevista: 0 });
assert.deepEqual(s.groups.Defensas, { continua: 5, duda: 0, sale: 1, objetivo: 1, prevista: 6 });
assert.deepEqual(s.groups.Delanteros, { continua: 1, duda: 0, sale: 0, objetivo: 1, prevista: 2 });
assert.deepEqual(s.sinPosicion, { continua: 1, duda: 0, sale: 0, objetivo: 0, prevista: 1 });
assert.equal(summarize([]).total.prevista, 0);

// Puestos visibles: los básicos del formato y los demás solo con gente (o todos)
const keysF11 = visibleZones(plan, 'f11').map((z) => z.key);
assert.ok(keysF11.includes('portero') && keysF11.includes('mediocentro'), 'F11: puestos básicos aunque estén vacíos');
assert.ok(!keysF11.includes('mediapunta') && !keysF11.includes('libre'), 'F11: mediapunta y libre, solo si hay alguien');
const keysF7 = visibleZones(plan, 'f7').map((z) => z.key);
assert.ok(keysF7.includes('mediapunta') && !keysF7.includes('mediocentro'), 'F7: mediapunta básica, mediocentro no');
assert.equal(visibleZones(plan, 'f7', true).length, ZONES.length, 'con «todos los puestos», todos');

// Sin datos no falla
const empty = buildPlan();
assert.equal(empty.items.length, 0);
assert.equal(empty.zones.length, ZONES.length);
assert.equal(empty.summary.total.prevista, 0);

// Un registro de plan con un estado desconocido se lee como «continúa»
assert.equal(buildPlan({ players: [P('x', 'A', 'B', 'central')], entries: [{ kind: 'player', ref_id: 'x', status: 'raro' }] }).items[0].status, 'continua');

console.log('squadPlan ok');
