import assert from 'node:assert/strict';
import { weakFootRating, weakFootColor, weakFootLabel, weakSide, weakFootText, isValidWeakFoot, WEAK_FOOT_LEVELS } from '../src/lib/weakFoot.js';

// Valoración vigente: el ambidiestro siempre 5; el resto, lo guardado (1–5) o nada
assert.equal(weakFootRating({ laterality: 'ambidiestro' }), 5, 'ambidiestro = 5 estrellas sin rellenar');
assert.equal(weakFootRating({ laterality: 'ambidiestro', weak_foot_rating: 2 }), 5, 'ambidiestro manda sobre lo guardado');
assert.equal(weakFootRating({ laterality: 'diestro', weak_foot_rating: 3 }), 3);
assert.equal(weakFootRating({ laterality: 'zurdo', weak_foot_rating: 1 }), 1);
assert.equal(weakFootRating({ laterality: 'diestro' }), null, 'sin valorar');
assert.equal(weakFootRating({ laterality: 'diestro', weak_foot_rating: null }), null, 'valoración quitada');
assert.equal(weakFootRating({ laterality: 'diestro', weak_foot_rating: 9 }), null, 'valor fuera de rango');
assert.equal(weakFootRating({ laterality: 'diestro', weak_foot_rating: 2.5 }), null);
assert.equal(weakFootRating(null), null);

// Validación del valor que se guarda
assert.deepEqual([0, 1, 5, 6, '3', 3.5, null].map(isValidWeakFoot), [false, true, true, false, false, false, false]);

// Pie malo según la lateralidad
assert.equal(weakSide('diestro'), 'left');
assert.equal(weakSide('zurdo'), 'right');
assert.equal(weakSide('ambidiestro'), null, 'el ambidiestro no tiene pie malo');
assert.equal(weakSide(undefined), null);

// Escala verde → rojo con su nombre
assert.equal(weakFootColor(5), '#22c55e');
assert.equal(weakFootColor(1), '#ef4444');
assert.equal(new Set(Object.values(WEAK_FOOT_LEVELS).map((l) => l.color)).size, 5, 'cada nivel su color');
assert.equal(weakFootColor(null), null);
assert.equal(weakFootLabel(5), 'Ambidiestro');
assert.equal(weakFootLabel(1), 'Muy floja');
assert.equal(weakFootText(4), 'Pierna no hábil: Muy buena (4/5)');
assert.equal(weakFootText(null), 'Pierna no hábil: sin valorar');

console.log('weakFoot ok');
