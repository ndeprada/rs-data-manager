import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { F7_FIELD, f7Markings } from "../src/lib/pitchGeometry.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("F7: medidas reglamentarias (FCF/RFEF)", () => {
  assert.equal(F7_FIELD.width, 45);
  assert.equal(F7_FIELD.length, 65);
  assert.equal(F7_FIELD.offsideLine, 12);
  assert.equal(F7_FIELD.areaWidth, F7_FIELD.goalWidth + 2 * 9); // 9 m desde cada poste
  assert.equal(F7_FIELD.goalAreaWidth, F7_FIELD.goalWidth + 2 * 3); // 3 m desde cada poste
  assert.equal(F7_FIELD.areaDepth, 9);
  assert.equal(F7_FIELD.goalAreaDepth, 3);
  assert.equal(F7_FIELD.penaltySpot, 9);
  assert.equal(F7_FIELD.centreRadius, 6);
});

test("f7Markings: escala del campo de la alineación (rectángulo 276 × 396)", () => {
  const f = f7Markings(12, 12, 276, 396);
  const sy = 396 / 65, sx = 276 / 45;
  near(f.offside, 12 * sy);
  near(f.area.d, 9 * sy);
  near(f.area.w, 24 * sx);
  near(f.goalArea.d, 3 * sy);
  near(f.goalArea.w, 12 * sx);
  near(f.spot, 9 * sy);
  near(f.area.x + f.area.w / 2, 150); // centradas
  near(f.goalArea.x + f.goalArea.w / 2, 150);
  assert.equal(f.centre.x, 150);
  assert.equal(f.centre.y, 210);
});

test("f7Markings: la línea de fuera de juego queda por delante del área y de la mitad del campo", () => {
  const f = f7Markings(0, 0, 276, 396);
  assert.ok(f.offside > f.area.d, "la línea de fuera de juego está más adelantada que el área");
  assert.ok(f.offside < 396 / 2, "no llega a la línea de medio campo");
  assert.ok(f.offside > f.spot, "el punto de penalti queda entre la meta y la línea");
  assert.ok(f.centre.r < 396 / 2 - f.offside, "el círculo central no toca la línea de fuera de juego");
});

test("F7: las medidas coinciden con las de la pizarra (BoardSvg.jsx)", () => {
  const src = readFileSync(new URL("../src/components/board/BoardSvg.jsx", import.meta.url), "utf8");
  const m = src.match(/f7:\s*\{([^}]*)\}/);
  assert.ok(m, "no se encuentra SPEC.f7 en BoardSvg.jsx");
  const spec = Object.fromEntries([...m[1].matchAll(/(\w+):\s*([\d.]+)/g)].map(([, k, v]) => [k, Number(v)]));
  assert.equal(spec.aw, F7_FIELD.areaWidth);
  assert.equal(spec.ah, F7_FIELD.areaDepth);
  assert.equal(spec.gw, F7_FIELD.goalAreaWidth);
  assert.equal(spec.gh, F7_FIELD.goalAreaDepth);
  assert.equal(spec.goalW, F7_FIELD.goalWidth);
  assert.equal(spec.spot, F7_FIELD.penaltySpot);
  assert.equal(spec.circle, F7_FIELD.centreRadius);
  assert.equal(spec.offside, F7_FIELD.offsideLine);
});
