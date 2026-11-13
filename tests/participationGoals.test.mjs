import assert from 'node:assert/strict';
import { goalsOf, goalsFor, goalState, playerGoals, cleanGoals, goalsBehind, DEFAULT_GOALS } from '../src/lib/participationGoals.js';

const f7 = { id: 'a', name: 'Aleví S12 A', category: 'alevi_s12' };
const f11 = { id: 'b', name: 'Cadet S16 A', category: 'cadet_primera_divisio_s16' };
const g0 = goalsOf(null);
assert.deepEqual(goalsFor(f7, g0), { format: 'f7', ...DEFAULT_GOALS.f7 });
assert.deepEqual(goalsFor(f11, g0), { format: 'f11', ...DEFAULT_GOALS.f11 });
assert.equal(cleanGoals({ starts: '0', full: 'x' }, 'f11'), null);
assert.deepEqual(cleanGoals({ starts: '6', q3: 4 }, 'f11'), { starts: 6 }); // q3 no es de F11

// Equipo de rendimiento y equipo con objetivos propios; el club sin objetivos de F11
const g1 = goalsOf({ goals: { f11: null }, team_goals: { b: { off: true }, a: { full: 5, q3: 6, format: 'f7' } } });
assert.equal(goalsFor(f11, g1), null);
assert.deepEqual(goalsFor(f7, g1), { format: 'f7', full: 5, q3: 6 });
assert.equal(goalsFor({ id: 'c', name: 'Juvenil B', category: 'juvenil' }, g1), null);

// Estados: 30 partidos, 10 jugados
const s = { played: 10, remaining: 20 };
assert.equal(goalState(8, 8, s), 'done');
assert.equal(goalState(3, 8, s), 'ok');       // ritmo: floor(8·10/30) = 2
assert.equal(goalState(1, 8, s), 'behind');
assert.equal(goalState(1, 8, { played: 25, remaining: 5 }), 'impossible');

const list = playerGoals({ titular: 1, full: 4, q3plus: 0 }, goalsFor(f11, g0), s);
assert.deepEqual(list.map((x) => [x.key, x.value, x.state]), [['starts', 1, 'behind'], ['full', 4, 'ok']]);
assert.equal(goalsBehind(list), true);
console.log('participationGoals ok');
{
  const { seasonPace } = await import('../src/lib/participationGoals.js');
  const ev = [
    { team_id: 'a', type: 'partido_liga', date: '2026-10-01T10:00' }, { team_id: 'a', type: 'partido_liga', date: '2026-12-01T10:00' },
    { team_id: 'a', type: 'partido_liga', date: '2026-12-08T10:00', postponed: true }, { team_id: 'a', type: 'partido_amistoso', date: '2026-12-09T10:00' },
    { team_id: 'b', type: 'partido_liga', date: '2026-12-01T10:00' },
  ];
  assert.deepEqual(seasonPace(ev, 'a', new Date('2026-11-13T10:00')), { played: 1, remaining: 1 });
}
