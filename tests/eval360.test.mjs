import assert from 'node:assert/strict';
import { AREAS, areasFor, computeAverages, GK_TACTICAL_ITEMS, GK_TECH_ITEMS } from '../src/lib/eval360.js';

// Jugador de campo: igual que siempre
assert.equal(areasFor('central'), AREAS);
assert.equal(computeAverages({ tactica: { presion: 8, transiciones: 6 } }, areasFor('central')).tactica, 7);

// Portero: la táctica es la suya, no la de campo, y cada ítem lleva su competencia del catálogo
const gk = areasFor('portero');
const tact = gk.find((a) => a.key === 'tactica');
assert.equal(tact.items, GK_TACTICAL_ITEMS);
assert.equal(tact.pendingReview, true);
assert.equal(GK_TACTICAL_ITEMS.length, 8);
assert.ok(!tact.items.some((i) => ['presion', 'colocacion', 'transiciones', 'desmarques'].includes(i.id)));
assert.ok(GK_TACTICAL_ITEMS.every((i) => i.competency && i.competency.length > 20), 'cada ítem enlaza con una competencia del catálogo');
assert.equal(new Set([...GK_TACTICAL_ITEMS, ...GK_TECH_ITEMS].map((i) => i.id)).size, GK_TACTICAL_ITEMS.length + GK_TECH_ITEMS.length, 'ids únicos');
assert.equal(gk.find((a) => a.key === 'tecnica').items, GK_TECH_ITEMS);
assert.equal(gk.find((a) => a.key === 'fisica').items, AREAS.find((a) => a.key === 'fisica').items);

// Evaluación antigua de un portero: las notas de criterios que ya no existen no puntúan, pero siguen en los datos
const old = { tecnica: { gk_pies: 8, gk_posicionamiento: 2 }, tactica: { presion: 9, transiciones: 9 }, fisica: { velocidad: 6 } };
const avg = computeAverages(old, gk);
assert.equal(avg.tecnica, 8);          // gk_posicionamiento ya no es técnico
assert.equal(avg.tactica, null);       // las notas tácticas de jugador de campo no cuentan
assert.equal(avg.fisica, 6);
assert.equal(avg.overall, 7);
assert.equal(old.tactica.presion, 9);  // no se borra nada

// Evaluación nueva
const nuevo = { tactica: { gk_t_salida: 7, gk_posicionamiento: 9, gk_reinicio: 8 } };
assert.equal(computeAverages(nuevo, gk).tactica, 8);
