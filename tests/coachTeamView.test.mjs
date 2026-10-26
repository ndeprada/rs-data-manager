import assert from 'node:assert/strict';
import {
  ALL_TEAMS, NO_TEAM, matchesTeamView, teamViewOptions, isMultiTeam, resolveTeamView, defaultTeamFor, teamAverages,
} from '../src/lib/coachTeamView.js';

const obs = (team_id, v) => ({ team_id, area: 'habitos', scores: { hab_puntualidad: v, hab_vestuario: v } });

// ── Qué entra en cada vista ──
const a = { team_id: 'S12A' };
const b = { team_id: 'S13B' };
const none = {};
assert.equal(matchesTeamView(a, ALL_TEAMS), true);
assert.equal(matchesTeamView(none, ALL_TEAMS), true, 'el conjunto lo incluye todo');
assert.equal(matchesTeamView(a, undefined), true);
assert.equal(matchesTeamView(a, 'S12A'), true);
assert.equal(matchesTeamView(b, 'S12A'), false);
assert.equal(matchesTeamView(none, 'S12A'), false, 'lo que no lleva equipo no cuenta en un equipo');
assert.equal(matchesTeamView(none, NO_TEAM), true);
assert.equal(matchesTeamView(a, NO_TEAM), false);

// ── Equipos que se ofrecen ──
assert.deepEqual(teamViewOptions({ teamIds: ['S12A', 'S13B'], items: [a, b, none] }), { teamList: ['S12A', 'S13B'], untagged: 1 });
assert.deepEqual(teamViewOptions({ teamIds: ['S12A'], items: [{ team_id: 'OLD' }] }).teamList, ['S12A', 'OLD'], 'un equipo que ya no lleva pero tiene datos sigue saliendo');
assert.deepEqual(teamViewOptions({ teamIds: ['S12A'], items: [{ team_id: 'OLD' }], known: ['S12A'] }).teamList, ['S12A'], 'un equipo borrado no sale');
assert.deepEqual(teamViewOptions({ teamIds: ['S12A', 'S12A', ''], items: [] }), { teamList: ['S12A'], untagged: 0 }, 'sin repetidos ni vacíos');

// ── Solo se divide si lleva más de un equipo ──
assert.equal(isMultiTeam(['S12A']), false);
assert.equal(isMultiTeam(['S12A', 'S12A']), false);
assert.equal(isMultiTeam(['S12A', 'S13B']), true);
assert.equal(isMultiTeam([]), false);

// ── La vista elegida ──
const ctx = { multi: true, teamList: ['S12A', 'S13B'], untagged: 0 };
assert.equal(resolveTeamView('S13B', ctx), 'S13B');
assert.equal(resolveTeamView(null, ctx), ALL_TEAMS);
assert.equal(resolveTeamView('OTRO', ctx), ALL_TEAMS, 'un equipo que ya no está vuelve al conjunto');
assert.equal(resolveTeamView(NO_TEAM, ctx), ALL_TEAMS, 'sin nada «sin equipo» no hay vista');
assert.equal(resolveTeamView(NO_TEAM, { ...ctx, untagged: 2 }), NO_TEAM);
assert.equal(resolveTeamView('S13B', { ...ctx, multi: false }), ALL_TEAMS, 'con un solo equipo no se divide');

// ── Equipo con el que se abre una evaluación nueva ──
assert.equal(defaultTeamFor('S13B', ['S12A', 'S13B']), 'S13B');
assert.equal(defaultTeamFor(ALL_TEAMS, ['S12A', 'S13B']), '', 'en el conjunto no se elige equipo por él');
assert.equal(defaultTeamFor(NO_TEAM, ['S12A', 'S13B']), '');
assert.equal(defaultTeamFor('OTRO', ['S12A', 'S13B']), '');

// ── Media por equipo ──
const all = [obs('S12A', 4), obs('S12A', 2), obs('S13B', 1), obs(null, 3)];
const avgs = teamAverages(all, 'habitos', ['S12A', 'S13B', 'S14C']);
assert.deepEqual(avgs.map((x) => x.id), ['S12A', 'S13B'], 'el equipo sin observaciones no sale');
assert.equal(avgs[0].avg, 3, '(4 + 2) / 2');
assert.equal(avgs[0].count, 2);
assert.equal(avgs[1].avg, 1);
assert.deepEqual(teamAverages([], 'habitos', ['S12A']), []);

console.log('coachTeamView OK');
