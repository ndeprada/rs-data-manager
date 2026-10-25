import assert from 'node:assert/strict';
import {
  nextSeason, buildPlan, summarize, sideOfLaterality, birthYearOf, hasSides, groupOf, ZONES, zoneByKey,
  zoneKeyOf, zoneTitle, movePatch, playerPatch, isBlankPlayerPatch, moveChange, withMovedItem, LEAVE, ROLE,
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
const cells = new Set(ZONES.map((z) => `${z.line}${z.lane}`));
assert.equal(cells.size, ZONES.length, 'cada puesto ocupa una casilla distinta (línea × carril) del campo');
for (const z of ZONES) assert.ok(z.line >= 0 && z.line <= 5 && ['l', 'c', 'r'].includes(z.lane), `el puesto ${z.key} tiene línea y carril`);
assert.ok(zoneByKey('portero').line < zoneByKey('central').line && zoneByKey('central').line < zoneByKey('delantero_centro').line, 'de la portería al ataque: portero, defensas, delanteros');
assert.ok(zoneByKey('lateral_l').lane === 'l' && zoneByKey('lateral_r').lane === 'r' && zoneByKey('central').lane === 'c');
assert.equal(zoneTitle(zoneByKey('lateral_l')), 'Lateral izquierdo');
assert.equal(zoneTitle(zoneByKey('extremo_r')), 'Extremo derecho');
assert.equal(zoneTitle(zoneByKey('delantero_centro')), 'Delantero centro');
assert.equal(zoneKeyOf('lateral', 'l'), 'lateral_l');
assert.equal(zoneKeyOf('central', null), 'central');
assert.equal(zoneKeyOf('lateral', null), null, 'un lateral sin lado no tiene puesto');
assert.equal(zoneKeyOf('raro', 'l'), null);
assert.ok(zoneByKey('portero').y > zoneByKey('central').y && zoneByKey('central').y > zoneByKey('delantero_centro').y, 'ataque arriba: portero abajo, delanteros arriba');
assert.ok(zoneByKey('lateral_l').x < 50 && zoneByKey('lateral_r').x > 50, 'izquierda del equipo a la izquierda de la pantalla');

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
const B = (o) => ({ continua: 0, duda: 0, sale: 0, club: 0, propia: 0, objetivo: 0, seguido: 0, prevista: 0, ...o });
assert.deepEqual(s.total, B({ continua: 7, duda: 1, sale: 1, objetivo: 2, prevista: 9 }));
assert.deepEqual(s.groups.Porteros, B({ duda: 1 }));
assert.deepEqual(s.groups.Defensas, B({ continua: 5, sale: 1, objetivo: 1, prevista: 6 }));
assert.deepEqual(s.groups.Delanteros, B({ continua: 1, objetivo: 1, prevista: 2 }));
assert.deepEqual(s.sinPosicion, B({ continua: 1, prevista: 1 }));
assert.equal(summarize([]).total.prevista, 0);

// Sin datos no falla
const empty = buildPlan();
assert.equal(empty.items.length, 0);
assert.equal(empty.zones.length, ZONES.length);
assert.equal(empty.summary.total.prevista, 0);

// Un registro de plan con un estado desconocido se lee como «continúa»
assert.equal(buildPlan({ players: [P('x', 'A', 'B', 'central')], entries: [{ kind: 'player', ref_id: 'x', status: 'raro' }] }).items[0].status, 'continua');


// ── PDF: listas y plantilla completa ─────────────────────────────────────────────────────────────────────
{
  const { pdfLists, squadByGroup, statusLabel } = await import('../src/lib/squadPlan.js');
  const players = [
    { id: 'g1', first_name: 'Pau', last_name: 'Gil', position: 'portero', birth_year: 2014, status: 'activo' },
    { id: 'c1', first_name: 'Eric', last_name: 'Soler', position: 'central', birth_year: 2014, status: 'activo' },
    { id: 'c2', first_name: 'Aleix', last_name: 'Bosch', position: 'central', birth_year: 2013, status: 'activo' },
    { id: 'm1', first_name: 'Dani', last_name: 'Puig', position: 'mediocentro', birth_year: 2014, status: 'activo' },
    { id: 'x1', first_name: 'Iván', last_name: 'Ruiz', birth_year: 2014, status: 'activo' },
  ];
  const scouted = [{ id: 's1', first_name: 'Joan', last_name: 'Pons', position: 'extremo', birth_year: 2014, laterality: 'zurdo', decision: 'fichar' }];
  const entries = [
    { id: 'e1', kind: 'player', ref_id: 'c1', status: 'duda', note: 'Valorar en enero' },
    { id: 'e2', kind: 'player', ref_id: 'm1', status: 'sale' },
    { id: 'e3', kind: 'scout', ref_id: 's1', position: 'extremo', side: null },
  ];
  const plan = buildPlan({ players, scouted, entries });
  const L = pdfLists(plan);
  assert.deepEqual(L.objetivos.map((i) => i.id), ['s1']);
  assert.deepEqual(L.dudas.map((i) => i.id), ['c1']);
  assert.deepEqual(L.salen.map((i) => i.id), ['m1']);
  assert.deepEqual(L.sinPosicion.map((i) => i.id), ['x1'], 'sin posición no sale en el campo pero sí en su lista');
  assert.equal(statusLabel(plan.items.find((i) => i.id === 'c1')), 'Duda');
  assert.equal(statusLabel(plan.items.find((i) => i.id === 'g1')), 'Continúa');
  assert.equal(statusLabel(plan.items.find((i) => i.id === 's1')), 'Objetivo');

  const lines = squadByGroup(plan.items);
  assert.deepEqual(lines.map((l) => l.group), ['Porteros', 'Defensas', 'Medios', 'Delanteros', 'Sin posición']);
  assert.deepEqual(lines[1].items.map((i) => i.id), ['c2', 'c1'], 'dentro de la línea, por puesto y estado: continúa antes que duda');
  assert.deepEqual(squadByGroup([]).length, 0, 'sin gente no hay líneas');
  assert.equal(squadByGroup(plan.items).reduce((n, l) => n + l.items.length, 0), plan.items.length, 'no se pierde a nadie');

}

// ── Baja del club / baja propia, objetivo / seguido, puesto a reforzar y jugadores colocados a mano ─────────────────────────────
{
  const { statusLabel, pdfLists } = await import('../src/lib/squadPlan.js');
  const mk = (id, position, extra = {}) => ({ id, first_name: id.toUpperCase(), last_name: 'Test', position, status: 'activo', birth_year: 2014, ...extra });
  const players = [mk('a', 'central'), mk('b', 'central'), mk('c', 'central'), mk('d', 'lateral', { laterality: 'diestro' }), mk('e', null), mk('f', 'portero')];
  const scouted = [
    { id: 's1', first_name: 'Biel', last_name: 'Casas', position: 'central', birth_year: 2014, decision: 'fichar' },
    { id: 's2', first_name: 'Joan', last_name: 'Pons', position: 'central', birth_year: 2014, decision: 'seguir_viendo' },
    { id: 's3', first_name: 'Lluc', last_name: 'Mas', position: 'extremo', laterality: 'zurdo', birth_year: 2014 },
  ];
  const entries = [
    { id: 'e1', kind: 'player', ref_id: 'a', status: 'sale', leave: 'club' },
    { id: 'e2', kind: 'player', ref_id: 'b', status: 'sale', leave: 'propia', note: 'Se muda a Girona' },
    { id: 'e3', kind: 'player', ref_id: 'c', status: 'sale' },
    { id: 'e4', kind: 'player', ref_id: 'd', status: 'duda', leave: 'club' },
    { id: 'e5', kind: 'scout', ref_id: 's1', position: 'central', role: 'objetivo' },
    { id: 'e6', kind: 'scout', ref_id: 's2', position: 'central', role: 'seguido' },
    { id: 'e7', kind: 'scout', ref_id: 's3', position: 'extremo' },
  ];
  const plan = buildPlan({ players, scouted, entries });
  const it = (id) => plan.items.find((i) => i.id === id);

  // Baja del club / baja propia: las dos son «se va» (rojo), pero se distinguen
  assert.equal(it('a').status, 'sale'); assert.equal(it('a').leave, 'club');
  assert.equal(it('b').status, 'sale'); assert.equal(it('b').leave, 'propia');
  assert.equal(it('c').status, 'sale'); assert.equal(it('c').leave, null, 'se va sin concretar');
  assert.equal(it('d').leave, null, 'el tipo de baja solo cuenta si se va');
  assert.equal(statusLabel(it('a')), 'Baja del club');
  assert.equal(statusLabel(it('b')), 'Baja propia');
  assert.equal(statusLabel(it('c')), 'Se va');
  assert.equal(LEAVE.club.label, 'Baja del club');
  const t = plan.summary.total;
  assert.deepEqual([t.sale, t.club, t.propia], [3, 1, 1], 'tres se van: uno del club, uno propio y uno sin concretar');
  assert.equal(buildPlan({ players, entries: [{ id: 'x', kind: 'player', ref_id: 'a', status: 'sale', leave: 'raro' }] }).items.find((i) => i.id === 'a').leave, null, 'tipo de baja desconocido = sin concretar');

  // Objetivo / seguido: el seguido no cuenta en la plantilla prevista
  assert.equal(it('s1').status, 'objetivo'); assert.equal(it('s1').role, 'objetivo');
  assert.equal(it('s2').status, 'seguido'); assert.equal(it('s2').role, 'seguido');
  assert.equal(it('s3').role, 'objetivo', 'sin tipo guardado (planes anteriores) = objetivo');
  assert.equal(statusLabel(it('s1')), 'Objetivo'); assert.equal(statusLabel(it('s2')), 'Seguido');
  assert.equal(ROLE.seguido.label, 'Jugador seguido');
  assert.deepEqual([t.objetivo, t.seguido], [2, 1]);
  assert.equal(t.prevista, 4, 'prevista = continúan (e y f) + objetivos (s1 y s3); la duda, los que se van y el seguido no cuentan');
  const centrals = plan.zones.find((z) => z.key === 'central').items.map((i) => i.key);
  assert.deepEqual(centrals.slice(-2), ['s:s1', 's:s2'], 'en el puesto: jugadores, luego objetivos y al final los seguidos');
  const L = pdfLists(plan);
  assert.deepEqual(L.objetivos.map((i) => i.id), ['s1', 's3']);
  assert.deepEqual(L.seguidos.map((i) => i.id), ['s2']);
  assert.deepEqual(L.salen.map((i) => i.id), ['a', 'b', 'c'], 'los que se van: primero baja del club, luego propia, luego sin concretar');

  // Jugador colocado a mano en otro puesto
  const moved = buildPlan({
    players: [mk('m1', 'central'), mk('m2', null), mk('m3', 'lateral', { laterality: 'zurdo' }), mk('m4', 'central')],
    entries: [
      { id: 'q1', kind: 'player', ref_id: 'm1', status: 'continua', position: 'lateral', side: 'r' },
      { id: 'q2', kind: 'player', ref_id: 'm2', status: 'continua', position: 'mediocentro' },
      { id: 'q3', kind: 'player', ref_id: 'm3', status: 'duda', position: 'lateral', side: 'r' },
      { id: 'q4', kind: 'player', ref_id: 'm4', status: 'continua', position: 'inventada' },
    ],
  });
  const mv = (id) => moved.items.find((i) => i.id === id);
  assert.equal(mv('m1').zone, 'lateral_r'); assert.equal(mv('m1').moved, true); assert.equal(mv('m1').naturalPosition, 'central');
  assert.equal(mv('m2').zone, 'mediocentro', 'un jugador sin posición en su ficha se coloca eligiendo puesto'); assert.equal(mv('m2').moved, true);
  assert.equal(moved.unplaced.length, 0);
  assert.equal(mv('m3').zone, 'lateral_r', 'el lado guardado gana a su lateralidad (zurdo) cuando se coloca a mano');
  assert.equal(mv('m4').zone, 'central', 'una posición guardada que no existe se ignora'); assert.equal(mv('m4').moved, false);
  assert.equal(moved.zones.find((z) => z.key === 'lateral_r').items.length, 2);
  assert.deepEqual([moved.summary.groups.Defensas.continua, moved.summary.groups.Defensas.duda], [2, 1], 'el grupo cuenta la posición colocada, no la de la ficha');
  assert.equal(moved.summary.groups.Medios.continua, 1);

  // Objetivo colocado a mano
  const sm = buildPlan({ scouted: [scouted[0]], entries: [{ id: 'z', kind: 'scout', ref_id: 's1', position: 'mediocentro', side: null }] });
  assert.equal(sm.items[0].zone, 'mediocentro'); assert.equal(sm.items[0].moved, true);

  // Puestos a reforzar
  const need = buildPlan({
    players: [mk('n1', 'central')],
    entries: [
      { id: 'r1', kind: 'need', ref_id: 'central', note: 'Un zurdo' },
      { id: 'r2', kind: 'need', ref_id: 'lateral_l' },
      { id: 'r3', kind: 'need', ref_id: 'puesto_inexistente' },
    ],
  });
  assert.deepEqual(need.needs.map((z) => z.key), ['lateral_l', 'central'], 'por orden de campo (ZONES), sin los que no existen');
  assert.deepEqual(need.zones.find((z) => z.key === 'central').need, { entryId: 'r1', note: 'Un zurdo' });
  assert.equal(need.zones.find((z) => z.key === 'portero').need, null);
  assert.equal(need.items.length, 1, 'reforzar un puesto no añade ni quita gente');
  assert.equal(need.zones.find((z) => z.key === 'central').items.length, 1);
  assert.deepEqual(pdfLists(need).refuerzos.map((z) => z.key), ['lateral_l', 'central']);

  // Qué se guarda al colocar a alguien en un puesto
  const plCentral = { kind: 'player', source: { position: 'central', laterality: 'diestro' } };
  assert.deepEqual(movePatch(plCentral, zoneByKey('lateral_l')), { position: 'lateral', side: 'l' });
  assert.deepEqual(movePatch(plCentral, zoneByKey('central')), { position: null, side: null }, 'volver a su puesto de la ficha borra el ajuste');
  const plLat = { kind: 'player', source: { position: 'lateral', laterality: 'zurdo' } };
  assert.deepEqual(movePatch(plLat, zoneByKey('lateral_l')), { position: null, side: null }, 'su lado natural (zurdo = izquierdo) es su puesto');
  assert.deepEqual(movePatch(plLat, zoneByKey('lateral_r')), { position: 'lateral', side: 'r' });
  assert.deepEqual(movePatch({ kind: 'scout', source: { position: 'central' } }, zoneByKey('extremo_r')), { position: 'extremo', side: 'r' });
  assert.deepEqual(movePatch({ kind: 'scout', source: { position: 'central' } }, zoneByKey('central')), { position: 'central', side: null }, 'un objetivo siempre guarda su puesto');

  // Registro de un jugador del club
  assert.deepEqual(playerPatch({ status: 'sale', leave: 'club', position: 'lateral', side: 'r', note: '  Se va al Barça ' }), { status: 'sale', leave: 'club', position: 'lateral', side: 'r', note: 'Se va al Barça' });
  assert.deepEqual(playerPatch({ status: 'duda', leave: 'club' }), { status: 'duda', leave: null, position: null, side: null, note: '' });
  assert.deepEqual(playerPatch({ status: 'raro', position: 'central', side: 'l' }), { status: 'continua', leave: null, position: 'central', side: 'l', note: '' }, 'el lado se guarda tal cual (el campograma lo ignora si el puesto no tiene lados)');
  assert.equal(playerPatch({ status: 'continua', position: 'inventada', side: 'l' }).side, null, 'sin puesto válido no hay lado');
  assert.equal(isBlankPlayerPatch(playerPatch({})), true);
  assert.equal(isBlankPlayerPatch(playerPatch({ note: 'algo' })), false);
  assert.equal(isBlankPlayerPatch(playerPatch({ position: 'central' })), false);
  assert.equal(isBlankPlayerPatch(playerPatch({ status: 'duda' })), false);
  // Pintar el cambio al instante: los registros tal y como quedan al colocar a alguien
  {
    const base = buildPlan({ players: [mk('u1', 'central'), mk('u2', 'central', { laterality: 'zurdo' })], scouted, entries: [
      { id: 'k1', kind: 'player', ref_id: 'u2', status: 'duda', note: 'ojo' },
      { id: 'k2', kind: 'scout', ref_id: 's1', position: 'central', role: 'objetivo' },
      { id: 'k3', kind: 'need', ref_id: 'central' },
    ] });
    const E0 = [
      { id: 'k1', kind: 'player', ref_id: 'u2', status: 'duda', note: 'ojo' },
      { id: 'k2', kind: 'scout', ref_id: 's1', position: 'central', role: 'objetivo' },
      { id: 'k3', kind: 'need', ref_id: 'central' },
    ];
    const u1 = base.items.find((i) => i.id === 'u1'), u2 = base.items.find((i) => i.id === 'u2'), s1 = base.items.find((i) => i.id === 's1');
    const e1 = withMovedItem(E0, u1, zoneByKey('lateral_r'));
    assert.equal(e1.length, E0.length + 1, 'jugador sin registro: se crea uno provisional');
    const made = e1.find((e) => e.ref_id === 'u1');
    assert.equal(made.id, 'tmp-u1'); assert.equal(made.position, 'lateral'); assert.equal(made.side, 'r'); assert.equal(made.status, 'continua');
    assert.equal(buildPlan({ players: [mk('u1', 'central')], entries: e1 }).items[0].zone, 'lateral_r', 'y con él el campograma ya lo pinta en el puesto nuevo');
    const e2 = withMovedItem(E0, u2, zoneByKey('lateral_l'));
    const upd = e2.find((e) => e.id === 'k1');
    assert.deepEqual([upd.status, upd.note, upd.position, upd.side], ['duda', 'ojo', 'lateral', 'l'], 'jugador con registro: conserva su estado y su nota');
    const e3 = withMovedItem(e2, buildPlan({ players: [mk('u2', 'central', { laterality: 'zurdo' })], entries: e2 }).items[0], zoneByKey('central'));
    assert.equal(e3.find((e) => e.id === 'k1').position, null, 'volver a su puesto de la ficha quita el ajuste pero conserva el estado');
    const e4 = withMovedItem([{ id: 'k9', kind: 'player', ref_id: 'u1', status: 'continua', position: 'lateral', side: 'r' }], buildPlan({ players: [mk('u1', 'central')], entries: [{ id: 'k9', kind: 'player', ref_id: 'u1', status: 'continua', position: 'lateral', side: 'r' }] }).items[0], zoneByKey('central'));
    assert.equal(e4.length, 0, 'si al volver el registro ya no dice nada, desaparece');
    assert.equal(moveChange(buildPlan({ players: [mk('u1', 'central')] }).items[0], zoneByKey('central')).blank, true);
    const e5 = withMovedItem(E0, s1, zoneByKey('mediocentro'));
    assert.deepEqual([e5.find((e) => e.id === 'k2').position, e5.find((e) => e.id === 'k2').side], ['mediocentro', null], 'objetivo: cambia su puesto');
    assert.equal(e5.find((e) => e.id === 'k3').kind, 'need', 'los puestos a reforzar no se tocan');
  }
}
console.log('squadPlan ok');
