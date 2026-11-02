import assert from 'node:assert/strict';
import { pageBreaks } from '../src/components/sessions/sessionPdf.js';

// Todo cabe en una hoja
assert.deepEqual(pageBreaks([{ top: 0, bottom: 100 }, { top: 110, bottom: 300 }], 1000, 300), [0]);
// La tercera tarea no cabe: la hoja 2 empieza justo en ella
assert.deepEqual(pageBreaks([{ top: 0, bottom: 400 }, { top: 410, bottom: 900 }, { top: 910, bottom: 1400 }], 1000, 1400), [0, 910]);
// Un bloque más alto que una hoja se corta por donde toque
assert.deepEqual(pageBreaks([{ top: 0, bottom: 100 }, { top: 120, bottom: 2300 }], 1000, 2300), [0, 120, 1120, 2120]);
// Hoja exacta
assert.deepEqual(pageBreaks([{ top: 0, bottom: 1000 }], 1000, 1000), [0]);
console.log('sessionPdf ok');
