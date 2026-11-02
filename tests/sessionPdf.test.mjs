import assert from 'node:assert/strict';
import { packPages, pageBreaks } from '../src/components/sessions/sessionPdf.js';

// Cortes por píxeles (se sigue usando en pruebas antiguas)
assert.deepEqual(pageBreaks([{ top: 0, bottom: 100 }, { top: 110, bottom: 300 }], 1000, 300), [0]);
assert.deepEqual(pageBreaks([{ top: 0, bottom: 400 }, { top: 410, bottom: 900 }, { top: 910, bottom: 1400 }], 1000, 1400), [0, 910]);

// Reparto de bloques en hojas
const B = (h, o = {}) => ({ h, gap: 10, ...o });
assert.deepEqual(packPages([B(100), B(200), B(300)], 1000), [[0, 1, 2]]);
// el tercero no cabe: pasa entero a la hoja 2
assert.deepEqual(packPages([B(400), B(400), B(400)], 1000), [[0, 1], [2]]);
// un título pegado al siguiente no se queda solo al final de una hoja
assert.deepEqual(packPages([B(500), B(400), B(30, { stick: true, gap: 6 }), B(300)], 1000), [[0, 1], [2, 3]]);
// un bloque más alto que una hoja ocupa su hoja
assert.deepEqual(packPages([B(100), B(1500), B(100)], 1000), [[0], [1], [2]]);
assert.deepEqual(packPages([], 1000), [[]]);
console.log('sessionPdf ok');
