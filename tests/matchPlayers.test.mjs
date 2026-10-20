import assert from 'node:assert/strict';
import { matchPlayerIds, withGuests } from '../src/lib/matchPlayers.js';

const team = [{ id: 'a' }, { id: 'b' }];
const all = [{ id: 'a' }, { id: 'b' }, { id: 'lucas' }, { id: 'otro' }, { id: 'gol' }];
const conv = { player_ids: ['a', 'lucas', 'prueba_1'], starters: ['lucas'] };
const ev = { match_events: [{ playerId: 'gol', playerIn: 'b', playerOut: '', assistId: undefined }], goal_events: [{ player_id: 'gol', assist_player_id: '' }] };

const ids = matchPlayerIds(conv, ev);
assert.deepEqual([...ids].sort(), ['a', 'b', 'gol', 'lucas', 'prueba_1']);
// Los invitados convocados o del acta se añaden, sin repetir a los de la plantilla; los que no están en el partido no
const res = withGuests(team, all, ids);
assert.deepEqual(res.map((p) => p.id), ['a', 'b', 'lucas', 'gol']);
// Sin invitados devuelve la misma lista (misma referencia, sin renders de más)
assert.equal(withGuests(team, all, new Set(['a'])), team);
assert.equal(withGuests(team, [], ids), team);
assert.deepEqual([...matchPlayerIds(null, null)], []);
