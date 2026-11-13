import assert from "node:assert/strict";
import { teamCohorts, proposeDestination, proposalsFor, projectTeam, lineCounts, squadWarnings, moveFlows, transferKpis, planToMoves, seasonChecklist, historySummary, nextSeasonOf, shortSeason, teamLetter } from "../src/lib/seasonView.js";

assert.equal(nextSeasonOf("2026-2027"), "2027-2028");
assert.equal(shortSeason("2027-2028"), "2027-28");
assert.equal(teamLetter({ name: "Aleví S12 A" }), "A");
assert.equal(teamLetter({ name: "Primer equipo" }), null);

const teams = [
  { id: "pe", name: "Primer equipo" }, { id: "ja", name: "Juvenil A" }, { id: "jb", name: "Juvenil B" },
  { id: "ca", name: "Cadete A" }, { id: "cb", name: "Cadete B" },
];
let n = 0;
const mk = (team, y, k, extra = {}) => Array.from({ length: k }, () => ({ id: `p${++n}`, team_id: team, birth_year: y, status: "activo", ...extra }));
const players = [
  ...mk("pe", 2000, 5), ...mk("pe", 2005, 5),
  ...mk("ja", 2008, 6), ...mk("ja", 2009, 6), ...mk("ja", 2010, 6),
  ...mk("jb", 2009, 7), ...mk("jb", 2010, 7),
  ...mk("ca", 2011, 18), ...mk("cb", 2012, 17), ...mk("cb", 2011, 1),
];
const coh = teamCohorts(players, teams);
assert.deepEqual([...coh.get("ja")].sort(), [2008, 2009, 2010]);
assert.deepEqual([...coh.get("cb")], [2012], "el que juega por arriba no cuenta");
const P = (team, y) => players.find((p) => p.team_id === team && p.birth_year === y);
const ctx = { teams, cohorts: coh };
assert.equal(proposeDestination(P("pe", 2000), ctx), "stay");
assert.equal(proposeDestination(P("ja", 2010), ctx), "stay", "1.º de juvenil sigue en su equipo");
assert.equal(proposeDestination(P("ja", 2008), ctx), "pe", "3.º de juvenil sube al primer equipo");
assert.equal(proposeDestination(P("ca", 2011), ctx), "ja", "cadete A → juvenil A (misma letra)");
assert.equal(proposeDestination(P("cb", 2012), ctx), "ca", "cadete B de 2012 → el equipo que tiene 2011");
assert.equal(proposeDestination(P("jb", 2010), ctx), "stay");
assert.equal(proposeDestination({ id: "x", team_id: "ca" }, ctx), null, "sin año no hay propuesta");
assert.equal(proposalsFor(players, teams).size, players.length);

const teamIds = new Set(teams.map((t) => t.id));
const a = P("ja", 2008), b = P("ca", 2011), c = P("jb", 2009);
const moves = { [a.id]: { to: "pe" }, [b.id]: { to: "ja" }, [c.id]: { to: "baja" }, x: { to: "borrado" } };
const pr = projectTeam("ja", players, moves, teamIds);
assert.equal(pr.leave.length, 1);
assert.equal(pr.arrive.length, 1);
assert.equal(pr.stay.length, 17);
assert.equal(pr.undecided.length, 17);
const k = transferKpis(players, moves, teamIds);
assert.deepEqual([k.decided, k.change, k.baja, k.undecided], [3, 2, 1, players.length - 3]);
assert.deepEqual(moveFlows(players, moves, teamIds).map((f) => `${f.from}>${f.to}`).sort(), ["ca>ja", "ja>pe"]);

assert.deepEqual(lineCounts([{ position: "portero" }, { position: "central" }, { position: "extremo" }, {}]), { POR: 1, DEF: 1, MED: 0, DEL: 1, none: 1 });
const w = squadWarnings([{ position: "portero" }, { position: "central" }]);
assert.deepEqual(w.map((x) => x.key), ["gk", "line", "line", "few"]);
assert.deepEqual(squadWarnings([]), []);

const plan = [
  { kind: "player", ref_id: P("cb", 2012).id, team_id: "cb", to_team_id: "ca", status: "continua" },
  { kind: "player", ref_id: c.id, team_id: "jb", to_team_id: "ja", status: "continua" },
  { kind: "player", ref_id: P("pe", 2005).id, team_id: "pe", status: "sale", leave: "propia" },
  { kind: "player", ref_id: P("ca", 2011).id, team_id: "ca", status: "duda" },
  { kind: "scout", ref_id: "s1" },
];
const pm = planToMoves(plan, players, moves, teamIds);
assert.deepEqual([pm.passes, pm.bajas, pm.already], [1, 1, 1]);
assert.equal(pm.moves[P("pe", 2005).id].to, "baja");

const cl = seasonChecklist({
  teams: [{ id: "t1", fcf_team_code: "x", coach: "Ana" }, { id: "t2" }],
  assignments: [{ team_id: "t2", active: true }],
  players: [{ team_id: "t1", jersey_number: 3 }, { team_id: "t2" }, { team_id: "t2", status: "baja" }],
  events: [{ type: "entrenamiento", team_id: "t1", date: "2027-09-01T19:00" }],
  rules: [], now: new Date("2027-07-01T10:00:00Z"),
});
assert.deepEqual(cl.map((x) => [x.key, x.done, x.n]), [["fcf", false, 1], ["staff", true, 2], ["dorsal", false, 1], ["trainings", false, 1], ["rules", false, 0]]);

const hs = historySummary([{ team_name: "A", standing: { pos: 1, g: 10, e: 2, p: 0 } }, { team_name: "B", record: { g: 2, e: 2, p: 8 } }]);
assert.deepEqual([hs.teams, hs.g, hs.e, hs.p, hs.winPct, hs.champions], [2, 12, 4, 8, 50, ["A"]]);
console.log("seasonView ok");
