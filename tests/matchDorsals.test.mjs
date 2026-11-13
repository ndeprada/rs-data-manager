import test from "node:test";
import assert from "node:assert/strict";
import { matchDorsalOf, withMatchDorsals, dorsalClashes, freeDorsals, cleanMatchDorsals } from "../src/lib/matchDorsals.js";
import { matchDorsalsOnChips } from "../src/lib/setPieceBoard.js";

const A = { id: "a", team_id: "t1", jersey_number: 7 }, B = { id: "b", team_id: "t1", jersey_number: 9 };
const J = { id: "j", team_id: "t2", jersey_number: "7" }, K = { id: "k", team_id: "t2", jersey_number: 9 };

test("dorsales repetidos: se cambia el del jugador de otro equipo", () => {
  const c = dorsalClashes([A, B, J, K], {}, "t1");
  assert.deepEqual(c.map((x) => x.dorsal), ["7", "9"]);
  assert.deepEqual(c[0].change.map((p) => p.id), ["j"]);
  assert.deepEqual(dorsalClashes([A, B, J, K], { j: "23", k: "24" }, "t1"), []);
  // dos del mismo equipo: el último
  assert.deepEqual(dorsalClashes([A, { id: "c", team_id: "t1", jersey_number: 7 }], {}, "t1")[0].change.map((p) => p.id), ["c"]);
});

test("dorsal del partido sobre la ficha", () => {
  assert.equal(matchDorsalOf(J, { j: "23" }), "23");
  assert.equal(matchDorsalOf(J, {}), "7");
  const [a, j] = withMatchDorsals([A, J], { j: "23" });
  assert.equal(a, A);
  assert.equal(j.jersey_number, "23");
  assert.equal(j.own_jersey_number, "7");
  assert.deepEqual(freeDorsals([A, B, J], {}, 3), ["2", "3", "4"]);
  assert.deepEqual(cleanMatchDorsals({ j: "2a3", a: "7", x: "5" }, ["a", "j"], [A, J]), { j: "23" });
  // sin la lista de jugadores no se quita nada de los convocados
  assert.deepEqual(cleanMatchDorsals({ j: "23" }, ["j"], []), { j: "23" });
});

test("balón parado: la ficha con el dorsal de su ficha pasa al del partido", () => {
  const board = { frames: [{ id: "f", els: [{ id: "c", k: "token", player_id: "j", inner: "7" }, { id: "d", k: "token", player_id: "a", inner: "7" }] }] };
  const out = matchDorsalsOnChips(board, withMatchDorsals([A, J], { j: "23" }));
  assert.equal(out.frames[0].els[0].inner, "23");
  assert.equal(out.frames[0].els[1].inner, "7");
});
