import assert from 'node:assert/strict';
import test from 'node:test';
import {
  tacticsBoardFormat, f7PageFormation, F7_PAGE_FORMATIONS, FORMATION_KEYS_F7, tokenLabel, freePositionsToBoard, boardOfTactic, fieldsFor,
} from '../src/lib/tacticsBoard.js';
import { FORMATION_POSITIONS, FORMATIONS_F7, F7_SLOT_ROLES } from '../src/lib/matchFormations.js';
import { fieldOf, normalizeBoard } from '../src/lib/board.js';

const s12 = { name: 'Aleví S12 A' };
const s14 = { name: 'Cadet S16 A', category: 'cadet_s16' };

// ── Formato de una pizarra: manda la formación que ya tiene guardada; si no se reconoce, la etapa del equipo ─────────────────
assert.equal(tacticsBoardFormat({ formation: '3-1-2' }, s14), 'f7', 'una pizarra de siete se ve de siete aunque el equipo sea de once');
assert.equal(tacticsBoardFormat({ formation: '4-4-2' }, s12), 'f11', 'una pizarra de once de un S12 no se cambia sola (solo cuando se elige un sistema de siete)');
assert.equal(tacticsBoardFormat({ formation: '4-3-3' }, s12), 'f11');
assert.equal(tacticsBoardFormat({ formation: 'inventada' }, s12), 'f7', 'sin formación reconocible, la etapa del equipo');
assert.equal(tacticsBoardFormat({ formation: 'inventada' }, s14), 'f11');
assert.equal(tacticsBoardFormat({}, null), 'f11');

// ── Sistemas de siete con el formato de la página: portería propia ARRIBA, huecos del mismo orden que en la pestaña del partido ─────
assert.deepEqual(FORMATION_KEYS_F7, ['3-1-2', '3-1-2 puntas', '3-2-1', '2-3-1']);
for (const key of FORMATIONS_F7) {
  const f = F7_PAGE_FORMATIONS[key];
  assert.equal(f.positions.length, 7, `${key}: portero + 6`);
  assert.equal(f.positions[0].key, 'gk');
  assert.equal(f.positions[0].label, 'POR');
  assert.equal(new Set(f.positions.map((p) => p.key)).size, 7, `${key}: claves de hueco distintas`);
  assert.ok(f.positions.every((p) => p.label), `${key}: todos los huecos con su posición`);
  FORMATION_POSITIONS[key].forEach(([x, y], i) => {
    assert.equal(f.positions[i].x, x, `${key}[${i}]: misma x que en el partido`);
    assert.equal(f.positions[i].y, 100 - y, `${key}[${i}]: y invertida (esta página tiene la portería arriba)`);
  });
  assert.ok(f.positions[0].y <= 20 && f.positions.slice(1).every((p) => p.y > f.positions[0].y), `${key}: el portero es el que está más cerca de su portería`);
  assert.ok(Object.keys(F7_SLOT_ROLES).includes(key), `${key}: tiene papeles documentados`);
}
assert.deepEqual(f7PageFormation('3-1-2').positions.map((p) => p.label), ['POR', 'LAT', 'CEN', 'LAT', 'MP', 'EXT', 'EXT']);
assert.deepEqual(f7PageFormation('3-1-2 puntas').positions.map((p) => p.label), ['POR', 'LAT', 'CEN', 'LAT', 'MP', 'DC', 'DC']);
assert.deepEqual(f7PageFormation('3-2-1').positions.map((p) => p.label), ['POR', 'LAT', 'CEN', 'LAT', 'MC', 'MC', 'DC']);
assert.deepEqual(f7PageFormation('2-3-1').positions.map((p) => p.label), ['POR', 'CEN', 'CEN', 'MC', 'MC', 'MC', 'DC']);
assert.equal(f7PageFormation('3-1-2').label, '3-1-2 · Base');

// ── Nombre de la ficha ─────────────────────────────────────────────────────────────────────────────────────────────────────────
assert.equal(tokenLabel({ first_name: 'Pau', last_name: 'garcía López' }), 'Pau G.');
assert.equal(tokenLabel({ first_name: 'Pablo', nickname: 'Kiku', last_name: 'Carcasona' }), 'Kiku C.', 'el apodo sustituye al nombre');
assert.equal(tokenLabel({ first_name: 'Pau' }), 'Pau', 'sin apellido, solo el nombre');
assert.equal(tokenLabel({}), '?');

// ── Pizarra libre antigua → pizarra nueva ──────────────────────────────────────────────────────────────────────────────────────
const players = [
  { id: 'p1', first_name: 'Pau', last_name: 'Garcia', position: 'portero' },
  { id: 'p2', first_name: 'Leo', last_name: 'Martí', position: 'lateral' },
];
const old = [{ player_id: 'p1', x: 50, y: 10 }, { player_id: 'p2', x: 25, y: 50 }, { player_id: 'borrado', x: 10, y: 10 }];
{
  const b = freePositionsToBoard(old, players, { f7: true });
  const F7 = fieldOf('f7');
  assert.equal(b.field, 'f7');
  assert.equal(b.frames.length, 1);
  const els = b.frames[0].els;
  assert.equal(els.length, 2, 'un jugador que ya no está se descarta');
  assert.deepEqual(els.map((e) => [e.k, e.team, e.label]), [['token', 'gk', 'Pau G.'], ['token', 'a', 'Leo M.']]);
  assert.equal(els[0].x, 22.5, '50 % del ancho de 45 m');
  assert.equal(els[0].y, 6.5, '10 % del largo de 65 m');
  assert.equal(els[1].x, 11.3);
  assert.equal(els[1].y, 32.5);
  assert.ok(els.every((e) => e.x >= 0 && e.x <= F7.w && e.y >= 0 && e.y <= F7.h), 'dentro del campo');
  assert.equal(new Set(els.map((e) => e.id)).size, 2, 'cada ficha con su id');
}
{
  const b = freePositionsToBoard(old, players, { f7: false });
  assert.equal(b.field, 'full');
  assert.equal(b.frames[0].els[0].x, 34, '50 % de 68 m');
  assert.equal(b.frames[0].els[0].y, 10.5, '10 % de 105 m');
}
assert.equal(freePositionsToBoard([{ player_id: 'p1', x: 250, y: -30 }], players).frames[0].els[0].x, 68, 'los extremos se recortan al campo');

// ── Qué pizarra de jugadas se abre ──────────────────────────────────────────────────────────────────────────────────────────────
{
  const saved = { v: 2, field: 'half', look: 'color', orient: 'v', frames: [{ id: 'f1', els: [{ id: 'e1', k: 'token', x: 1, y: 2, team: 'b' }] }] };
  const tb = { board: saved, free_positions: old };
  assert.deepEqual(boardOfTactic(tb, { players, f7: true }), normalizeBoard(saved), 'la guardada manda sobre la antigua');
  const legacy = boardOfTactic({ free_positions: old }, { players, f7: true });
  assert.equal(legacy.field, 'f7');
  assert.equal(legacy.frames[0].els.length, 2);
  const blankF7 = boardOfTactic({}, { players, f7: true });
  assert.equal(blankF7.field, 'f7');
  assert.equal(blankF7.frames[0].els.length, 0);
  assert.equal(boardOfTactic({ free_positions: [] }, { players }).field, 'full', 'sin jugadores en la antigua, en blanco y de once');
  assert.equal(boardOfTactic(null, {}).field, 'full');
  // la conversión no toca los datos antiguos
  const before = JSON.stringify(old);
  boardOfTactic({ free_positions: old }, { players, f7: true });
  assert.equal(JSON.stringify(old), before);
}

// ── Campos que se ofrecen ──────────────────────────────────────────────────────────────────────────────────────────────────────
assert.deepEqual(fieldsFor(true, 'f7'), ['f7', 'free']);
assert.deepEqual(fieldsFor(false, 'full'), ['full', 'tq', 'half', 'free']);
assert.deepEqual(fieldsFor(true, 'full'), ['f7', 'free', 'full'], 'si la pizarra ya tenía otro campo, se sigue viendo');
assert.deepEqual(fieldsFor(false), ['full', 'tq', 'half', 'free']);

console.log('tacticsBoard ok');

test("Formación con la pizarra nueva: un hueco = una ficha, con jugador o vacía", async () => {
  const { formationBoard, formationStyleOf, SLOT_PREFIX, EMPTY_SLOT_COLOR } = await import("../src/lib/tacticsBoard.js");
  const formation = { positions: [{ key: "gk", label: "POR", x: 50, y: 6 }, { key: "lb", label: "LTD", x: 18, y: 25 }, { key: "st", label: "DC", x: 50, y: 80 }] };
  const players = [{ id: "p1", first_name: "Marc", last_name: "Serra", jersey_number: 9 }, { id: "p2", first_name: "Pau", last_name: "Vidal" }];
  const b = formationBoard({ formation, assignments: { st: { player_id: "p1" }, lb: { player_id: "p2" } }, players });
  const els = b.frames[0].els;
  assert.equal(b.field, "full");
  assert.equal(els.length, 3);
  const gk = els.find((e) => e.id === `${SLOT_PREFIX}gk`), st = els.find((e) => e.id === `${SLOT_PREFIX}st`), lb = els.find((e) => e.id === `${SLOT_PREFIX}lb`);
  assert.equal(gk.team, "gk");
  assert.equal(gk.color, EMPTY_SLOT_COLOR);
  assert.equal(gk.inner, "POR");
  assert.ok(gk.y > st.y, "el portero queda abajo: el ataque va hacia arriba");
  assert.equal(st.inner, "9");
  assert.equal(st.label, "Marc S.");
  assert.equal(lb.inner, "PV", "sin dorsal, sus iniciales");
  const f7 = formationBoard({ formation, f7: true, style: { view: "persp", look: "color", orient: "h" } });
  assert.equal(f7.field, "f7");
  assert.equal(f7.view, "persp");
  assert.equal(f7.orient, "h");
  assert.deepEqual(formationStyleOf(null), { look: "blanco", view: "flat", orient: "v" });
});
