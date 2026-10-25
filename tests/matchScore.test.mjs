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

// Resultado para nosotros (score_home = nuestros goles, da igual si jugamos en casa o fuera)
import { matchResult, playedResult } from '../src/lib/matchScore.js';
assert.equal(matchResult({ is_home: false, score_home: 4, score_away: 0 }), 'victoria');
assert.equal(matchResult({ is_home: true, score_home: 0, score_away: 3 }), 'derrota');
assert.equal(matchResult({ is_home: false, score_home: 2, score_away: 2 }), 'empate');
assert.equal(matchResult({ score_home: 0, score_away: 0 }), 'empate');
assert.equal(matchResult({ score_home: '2', score_away: '1' }), 'victoria'); // marcadores guardados como texto
assert.equal(matchResult({ is_home: false }), null);
assert.equal(matchResult(null), null);

// Solo cuenta en la tarjeta si es un partido ya jugado, no suspendido y con marcador
const ahora = new Date('2026-10-25T12:00');
const jugado = { type: 'partido_liga', date: '2026-10-24T10:00', score_home: 3, score_away: 1 };
assert.equal(playedResult(jugado, ahora), 'victoria');
assert.equal(playedResult({ ...jugado, type: 'torneo', score_home: 0, score_away: 1 }, ahora), 'derrota');
assert.equal(playedResult({ ...jugado, type: 'partido_amistoso', score_away: 3 }, ahora), 'empate');
assert.equal(playedResult({ ...jugado, date: '2026-10-26T10:00' }, ahora), null); // aún no se ha jugado
assert.equal(playedResult({ ...jugado, cancelled: true }, ahora), null); // suspendido
assert.equal(playedResult({ ...jugado, type: 'entrenamiento' }, ahora), null); // no es un partido
assert.equal(playedResult({ type: 'partido_liga', date: '2026-10-24T10:00' }, ahora), null); // sin marcador
assert.equal(playedResult({ ...jugado, date: undefined }, ahora), null);
assert.equal(playedResult(null, ahora), null);
