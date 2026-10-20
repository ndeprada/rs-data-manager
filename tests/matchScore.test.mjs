import assert from 'node:assert/strict';
import { scoreParts, scoreText, scoreTitle, playsAway } from '../src/lib/matchScore.js';

// Jugamos fuera: Bufalá (local) 2 - 1 Racing Sarrià. En los datos, nuestros goles = 1 y los del rival = 2.
const fuera = { is_home: false, score_home: 1, score_away: 2 };
assert.equal(scoreText(fuera), '2 - 1');
assert.deepEqual(scoreParts(fuera), { ours: 1, theirs: 2, left: 2, right: 1, away: true });

// Athletic Sant Just (local) 0 - 4 Racing Sarrià: ganamos fuera
assert.equal(scoreText({ is_home: false, score_home: 4, score_away: 0 }), '0 - 4');

// En casa el orden no cambia; si is_home falta se entiende que jugamos en casa
assert.equal(scoreText({ is_home: true, score_home: 3, score_away: 1 }), '3 - 1');
assert.equal(scoreText({ score_home: 3, score_away: 1 }), '3 - 1');
assert.equal(playsAway({}), false);
assert.equal(playsAway({ is_home: false }), true);

// Separador y empates
assert.equal(scoreText({ is_home: false, score_home: 2, score_away: 2 }, '–'), '2–2');
// Un 0 es un resultado, no «sin resultado»
assert.equal(scoreText({ is_home: false, score_home: 0, score_away: 0 }), '0 - 0');
// Sin resultado
assert.equal(scoreText({ is_home: false }), null);
assert.equal(scoreText({ score_home: null, score_away: null }), null);
assert.equal(scoreText(null), null);
// Si solo falta un lado se toma como 0 (igual que el resto de la app)
assert.equal(scoreText({ is_home: false, score_home: 2, score_away: null }), '0 - 2');

// Texto del tooltip: quién es local y quién visitante
assert.equal(scoreTitle({ is_home: false, score_home: 1, score_away: 2, opponent: 'Bufalà' }, 'Juvenil A'), 'Bufalà 2 - 1 Juvenil A');
assert.equal(scoreTitle({ is_home: true, score_home: 3, score_away: 1, opponent: 'Gavà' }, 'Juvenil A'), 'Juvenil A 3 - 1 Gavà');
assert.equal(scoreTitle({ is_home: false, score_home: 0, score_away: 0 }), 'Rival 0 - 0 Nosotros');
assert.equal(scoreTitle({ is_home: false }), undefined);
