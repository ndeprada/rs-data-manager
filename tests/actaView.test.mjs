import assert from 'node:assert/strict';
import { periodsOf, periodOf, periodLabel, timelineRows, subTimes, subText, scoreText, eventCounts } from '../src/lib/actaView.js';

assert.deepEqual(periodsOf('2x45'), { n: 2, len: 45 });
assert.deepEqual(periodsOf('4x15'), { n: 4, len: 15 });
assert.deepEqual(periodsOf('', 80), { n: 2, len: 40 });
assert.equal(periodOf(45, { n: 2, len: 45 }), 0);
assert.equal(periodOf(46, { n: 2, len: 45 }), 1);
assert.equal(periodOf(93, { n: 2, len: 45 }), 1, 'descuento de la 2.ª');
assert.equal(periodOf(31, { n: 4, len: 15 }), 2);
assert.equal(periodLabel(1, 2), '2.ª parte');
assert.equal(periodLabel(2, 4), '3.er cuarto');
assert.equal(scoreText(2, 1, false), '1-2');

const evs = [
  { id: 'c', type: 'card', team: 'home', minute: 27 },
  { id: 'g1', type: 'goal', team: 'home', minute: 12 },
  { id: 'g2', type: 'goal', team: 'away', minute: 34 },
  { id: 's', type: 'sub', team: 'home', minute: 46, playerIn: 'p14', playerOut: 'p6' },
  { id: 's2', type: 'sub', team: 'home', minute: 80, playerIn: 'p16', playerOut: 'p14' },
  { id: 'g3', type: 'goal', team: 'home', minute: 67 },
];
const rows = timelineRows(evs, { duration: '2x45', isHome: false, played: true });
assert.deepEqual(rows.map((r) => r.kind), ['period', 'event', 'event', 'event', 'period', 'event', 'event', 'event', 'end']);
assert.equal(rows[0].score, null);
assert.equal(rows[1].score, '0-1', 'fuera: el rival va primero');
assert.equal(rows[3].rival, true);
assert.equal(rows[4].score, '1-1', 'marcador al empezar la 2.ª');
assert.equal(rows[8].score, '1-2');
assert.equal(timelineRows(evs, { duration: '2x45' }).at(-1).kind, 'event', 'sin jugar no hay «Final»');

assert.deepEqual(subTimes('p14', evs), { into: 46, out: 80 });
assert.equal(subText(subTimes('p14', evs)), '46’–80’');
assert.equal(subText(subTimes('p6', evs)), 'sale 46’');
assert.equal(subText(subTimes('p16', evs)), 'entra 80’');
assert.equal(subText(subTimes('x', evs)), '');
assert.deepEqual(eventCounts(evs), { goals: 3, subs: 2, cards: 1 });
console.log('actaView ok');
