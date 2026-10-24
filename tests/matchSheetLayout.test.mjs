import assert from 'node:assert/strict';
import * as jspdfMod from 'jspdf';
import { FORMATION_POSITIONS } from '../src/lib/matchFormations.js';
import { lineupLayout, firstSurname, fitText, LINEUP } from '../src/lib/matchSheetLayout.js';

const jsPDF = jspdfMod.jsPDF || jspdfMod.default?.jsPDF || jspdfMod.default;
const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
const widthOf = (text, pt, bold) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(pt); return doc.getTextWidth(text); };
const ph = 148, pw = (ph * 300) / 420; // el campo tal como se dibuja en la hoja

// Primer apellido: salta partículas y no se inventa nada con apellidos vacíos
assert.equal(firstSurname('García Pérez'), 'García');
assert.equal(firstSurname('de la Torre Sans'), 'de la Torre');
assert.equal(firstSurname('Fernández'), 'Fernández');
assert.equal(firstSurname(''), '');
assert.equal(firstSurname(undefined), '');

// fitText: lo que cabe se queda en el tamaño pedido; lo que no, baja hasta el mínimo y, si aun así no cabe, se acorta con un punto
const big = fitText('Ana', 30, widthOf, true, 10, 6.5);
assert.deepEqual(big, { text: 'Ana', size: 10 });
const mid = fitText('Maximiliano', 17, widthOf, true, 10, 6.5);
assert.ok(mid.size < 10 && mid.size >= 6.5 && mid.text === 'Maximiliano', 'baja el tamaño antes de cortar');
assert.ok(widthOf(mid.text, mid.size, true) <= 17 + 1e-6);
const cut = fitText('Maximiliano Bartolomé', 12, widthOf, true, 10, 6.5);
assert.equal(cut.size, 6.5);
assert.ok(cut.text.endsWith('.') && widthOf(cut.text, cut.size, true) <= 12 + 1e-6, 'acorta con punto');

// Nombres de peor caso (largos y compuestos) en las 13 formaciones: nada se pisa, todo cabe en el campo y se lee mejor que antes
const WORST = [
  ['Maximiliano', 'Fernández de la Vega'], ['Joan Pau', 'Rodríguez Gil'], ['Bartolomé', 'Puigdomènech'], ['Alessandro', 'Casanovas'],
  ['Cristian', 'Domínguez'], ['Guillermo', 'Hernández'], ['Sebastián', 'Villanueva'], ['Maximiliano', 'Giménez'],
  ['Christopher', 'Montserrat'], ['Francisco', 'Valdivieso'], ['Maximilià', 'Bassols'],
];
const rect = (b) => ({ x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 });
const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const circleBox = (L) => ({ x0: L.cx - L.r, x1: L.cx + L.r, y0: L.cy - L.r, y1: L.cy + L.r });

const formations = Object.keys(FORMATION_POSITIONS);
assert.equal(formations.length, 13);
for (const f of formations) {
  const positions = FORMATION_POSITIONS[f];
  const slots = positions.map((_, i) => ({ id: `p${i}`, first_name: WORST[i % WORST.length][0], last_name: WORST[i % WORST.length][1] }));
  const out = lineupLayout(slots, positions, pw, ph, widthOf);
  assert.equal(out.length, positions.length, f);
  const boxes = out.map((L) => [circleBox(L), rect(L.box)]);
  out.forEach((L, i) => {
    assert.equal(L.r, LINEUP.r, `${f}: radio`);
    assert.ok(L.size >= LINEUP.minPt && L.size <= LINEUP.namePt, `${f} #${i}: tamaño ${L.size}`);
    assert.ok(L.size > 6.6, `${f} #${i}: más grande que antes (6,6) → ${L.size}`);
    const [c, b] = boxes[i];
    assert.ok(c.x0 >= 0 && c.x1 <= pw && c.y0 >= 0, `${f} #${i}: círculo dentro del campo`);
    assert.ok(b.x0 >= 0 && b.x1 <= pw && b.y1 <= ph, `${f} #${i}: nombre dentro del campo (${b.x0.toFixed(1)}..${b.x1.toFixed(1)}, y1 ${b.y1.toFixed(1)})`);
    out.forEach((M, j) => {
      if (j <= i) return;
      const [c2, b2] = boxes[j];
      assert.ok(!hit(b, b2), `${f}: nombres ${i} y ${j} se pisan`);
      assert.ok(!hit(b, c2), `${f}: nombre ${i} pisa el círculo ${j}`);
      assert.ok(!hit(b2, c), `${f}: nombre ${j} pisa el círculo ${i}`);
      assert.ok(!hit(c, c2), `${f}: círculos ${i} y ${j} se pisan`);
    });
  });
}

// Con nombres normales casi todos salen al tamaño máximo; los huecos vacíos solo dibujan el círculo
const simple = FORMATION_POSITIONS['4-3-3'].map((_, i) => ({ id: `s${i}`, first_name: 'Pau', last_name: 'Garcia' }));
assert.ok(lineupLayout(simple, FORMATION_POSITIONS['4-3-3'], pw, ph, widthOf).every((L) => L.size === LINEUP.namePt));
const withGap = [...simple]; withGap[3] = null;
const gapOut = lineupLayout(withGap, FORMATION_POSITIONS['4-3-3'], pw, ph, widthOf);
assert.equal(gapOut[3].empty, true);
assert.equal(gapOut[3].lines, undefined);

// El apodo sustituye al nombre; las dos líneas llevan el mismo tamaño
const nick = lineupLayout([{ id: 'k', first_name: 'Enrique', nickname: 'Kiku', last_name: 'Carcasona Andreu' }], [[50, 50]], pw, ph, widthOf)[0];
assert.equal(nick.lines[0].text, 'Kiku');
assert.equal(nick.lines[1].text, 'Carcasona');
console.log('matchSheetLayout OK');
