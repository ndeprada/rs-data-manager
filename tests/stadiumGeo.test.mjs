import test from "node:test";
import assert from "node:assert/strict";
import { BS, cornerStairs, rowSeats, sideStairs, stairQuads, standRows, roundRect, STAIR_W, SEAT } from "../src/lib/stadiumGeo.js";

const F11 = { w: 68, h: 105 };

test("estadio: escaleras en cada lado (centro, repartidas y al final) y en las esquinas", () => {
  const s = sideStairs(34);
  assert.ok(s.includes(0));
  assert.equal(s[0], -34 + STAIR_W / 2);
  assert.equal(s[s.length - 1], 34 - STAIR_W / 2);
  assert.deepEqual(cornerStairs(0), [45]);
  assert.equal(cornerStairs(1).length, 3);
  // escaleras de un tramo: 4 lados + 4 esquinas
  const low = stairQuads(F11, BS.track, BS.track + BS.row, 0);
  assert.equal(low.length, sideStairs(34).length * 2 + sideStairs(52.5).length * 2 + 4);
});

test("estadio: los asientos no pisan las escaleras y hay asientos en las esquinas", () => {
  const d = BS.track + 0.7;
  const seats = rowSeats(F11, d, 0);
  assert.ok(seats.length > 200);
  assert.ok(seats.some((s) => s.part >= 1000), "asientos en las esquinas");
  // ningún asiento del lado de arriba dentro de una escalera
  for (const s of seats.filter((x) => x.part < 100)) {
    const t = (s.a.x + s.b.x) / 2 - 34;
    for (const c of sideStairs(34)) assert.ok(Math.abs(t - c) >= STAIR_W / 2 + 0.3, `asiento en t=${t} pisa la escalera ${c}`);
  }
  // columnas alineadas: mismas posiciones en dos filas del mismo lado
  const xs = (dd) => rowSeats(F11, dd, 0).filter((x) => x.part < 100).map((x) => ((x.a.x + x.b.x) / 2).toFixed(3));
  assert.deepEqual(xs(BS.track + 0.7), xs(BS.track + 5.5));
  // en las esquinas, separados al menos un asiento
  const corner = seats.filter((x) => x.part >= 1000 && x.part < 1010);
  for (let i = 1; i < corner.length; i++) {
    const a = corner[i - 1], b = corner[i];
    if (a.part !== b.part) continue;
    const pa = { x: (a.a.x + a.b.x) / 2, y: (a.a.y + a.b.y) / 2 }, pb = { x: (b.a.x + b.b.x) / 2, y: (b.a.y + b.b.y) / 2 };
    assert.ok(Math.hypot(pa.x - pb.x, pa.y - pb.y) > SEAT * 0.95);
  }
});

test("estadio: filas, degradado y esquinas con centro en el banderín", () => {
  const rows = standRows();
  assert.equal(rows.length, BS.lowRows + BS.upRows);
  assert.ok(rows.every((r, i) => !i || r.t >= rows[i - 1].t), "de delante (oscuro) a atrás (claro)");
  const ring = roundRect(F11, 10, 18);
  assert.equal(ring.length, 72);
  // el primer punto de la esquina de arriba a la derecha está a 10 m del banderín (68, 0)
  assert.ok(Math.abs(Math.hypot(ring[0].x - 68, ring[0].y) - 10) < 1e-9);
});
