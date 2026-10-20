import assert from 'node:assert/strict';
import { statTeamResolver, statsOfTeam } from '../src/lib/teamStats.js';

const events = [{ id: 'e9', team_id: 'S9A' }, { id: 'e10', team_id: 'S10A' }];
const players = [{ id: 'lucas', team_id: 'S9A' }, { id: 'pau', team_id: 'S10A' }];
const stats = [
  { id: 1, event_id: 'e9', player_id: 'lucas', goals: 1 },   // con su equipo
  { id: 2, event_id: 'e10', player_id: 'lucas', goals: 2 },  // invitado en el Sub-10 A
  { id: 3, event_id: 'e10', player_id: 'pau', goals: 0 },
  { id: 4, event_id: 'borrado', player_id: 'pau', goals: 1 }, // partido que ya no existe: cae en el equipo del jugador
];
const teamOf = statTeamResolver(events, players);

// Equipo de origen: solo lo jugado con su equipo
assert.deepEqual(statsOfTeam(stats, 'S9A', teamOf).map((s) => s.id), [1]);
// Equipo secundario: lo del invitado aparece aquí, junto a lo de sus jugadores
assert.deepEqual(statsOfTeam(stats, 'S10A', teamOf).map((s) => s.id), [2, 3, 4]);
// Sin datos no falla
assert.deepEqual(statsOfTeam(undefined, 'S9A', statTeamResolver(undefined, undefined)), []);
assert.equal(statTeamResolver([], [])({ event_id: 'x', player_id: 'y' }), null);
