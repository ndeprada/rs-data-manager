import assert from 'node:assert/strict';
import { cleanPostNotes, hasPostNotes, ratingAverages, ratingTrend, evalHistory, rivalNotesBefore, nextVsRival, trainingNotesFor } from '../src/lib/postMatch.js';

assert.deepEqual(cleanPostNotes({ good: [' a ', ''], improve: 'x' }), { good: ['a'], improve: [], training: [] });
assert.equal(hasPostNotes({ good: [], training: ['x'] }), true);

const avg = ratingAverages([{ player_id: 'p', event_id: 'e1', rating: 3 }, { player_id: 'p', event_id: 'e2', rating: 2 }, { player_id: 'p', event_id: 'e3', rating: 1 }, { player_id: 'p', event_id: 'e4', rating: 7 }], 'e3');
assert.deepEqual(avg.get('p'), { avg: 2.5, n: 2 });
assert.equal(ratingTrend(3, 2.5), 'up'); assert.equal(ratingTrend(2, 2.5), 'down'); assert.equal(ratingTrend(2, 2.2), 'eq'); assert.equal(ratingTrend(0, 2), null);

const ev = { id: 'e9', team_id: 't', date: '2026-11-08T11:00', opponent: 'CF Bellvitge', type: 'partido_liga' };
const evs = [
  { id: 'a', team_id: 't', date: '2026-10-01T11:00', type: 'partido_liga', team_eval: { actitud: 2 }, opponent: 'C.F. BELLVITGE "A"', analysis_notes_rival: 'Juegan 4-4-2' },
  { id: 'b', team_id: 't', date: '2026-10-08T11:00', type: 'partido_liga', team_eval: { actitud: 3 }, post_notes: { training: ['Ruptura'] } },
  { id: 'c', team_id: 'x', date: '2026-10-09T11:00', type: 'partido_liga', team_eval: { actitud: 1 } },
  { id: 'd', team_id: 't', date: '2027-03-14T11:00', type: 'partido_liga', opponent: 'Bellvitge' },
  ev,
];
assert.deepEqual(evalHistory(evs, ev, ['actitud']), { actitud: [2, 3] });
assert.deepEqual(rivalNotesBefore(evs, ev).map((e) => e.id), ['a']);
assert.equal(nextVsRival(evs, ev)?.id, 'd');
assert.deepEqual(trainingNotesFor(evs, 't', '2026-10-10'), { event: evs[1], items: ['Ruptura'] });
assert.equal(trainingNotesFor(evs, 't', '2026-10-05'), null);
console.log('postMatch ok');
