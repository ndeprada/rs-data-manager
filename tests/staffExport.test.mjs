import assert from 'node:assert/strict';
import { csvCell, toCsv, exportFileName, staffPrintHtml } from '../src/lib/staffExport.js';

// Celdas normales, con separador, comillas y saltos de línea
assert.equal(csvCell('Marta Soler'), 'Marta Soler');
assert.equal(csvCell('Juvenil A; Primer Equipo'), '"Juvenil A; Primer Equipo"');
assert.equal(csvCell('Dice "hola"'), '"Dice ""hola"""');
assert.equal(csvCell('a\nb'), '"a\nb"');
assert.equal(csvCell(null), '');
assert.equal(csvCell(41), '41');

// Teléfonos legítimos no se tocan; las fórmulas sí se neutralizan
assert.equal(csvCell('+34 600 111 222'), '+34 600 111 222');
assert.equal(csvCell('600111222'), '600111222');
assert.equal(csvCell('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
assert.equal(csvCell('@SUMA(A1)'), "'@SUMA(A1)");
assert.equal(csvCell('+cmd|calc'), "'+cmd|calc");
assert.equal(csvCell('-2+3+cmd'), "'-2+3+cmd");

// CSV completo con «;» y saltos de Windows
assert.equal(toCsv(['Nombre', 'Edad'], [['Ana', 30], ['Luis; Jr', '']]), 'Nombre;Edad\r\nAna;30\r\n"Luis; Jr";');

// Nombre de archivo con fecha
assert.equal(exportFileName('personal-racing-sarria', new Date(2026, 9, 5)), 'personal-racing-sarria-2026-10-05.csv');

// HTML de impresión: escapa texto, pone «—» en vacíos y cuenta personas
const html = staffPrintHtml({ header: ['Nombre', 'Email'], rows: [['<b>Ana</b>', ''], ['Luis', 'l@x.es']], title: 'Personal', subtitle: 'Todos los equipos', logoUrl: 'https://x/logo.png' });
assert.ok(html.includes('&lt;b&gt;Ana&lt;/b&gt;'));
assert.ok(!html.includes('<b>Ana</b>'));
assert.ok(html.includes('<td>—</td>'));
assert.ok(html.includes('2 personas'));
assert.ok(staffPrintHtml({ header: ['N'], rows: [['a']], title: 't', subtitle: 's' }).includes('1 persona<'));
