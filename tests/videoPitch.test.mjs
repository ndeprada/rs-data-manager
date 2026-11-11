// Análisis de vídeo · calibración del campo: la homografía recupera la perspectiva de una cámara simulada,
// mide distancias en metros y avisa de la precisión.
import { test } from "node:test";
import assert from "node:assert/strict";
import { landmarks, pitchOf, pitchLines, markLines, homography, applyH, invertH, solveCal, groundDist, circleImg, groundRectImg, lineImg, calQuality, fmtM } from "../src/lib/videoPitch.js";

// «Cámara» de prueba: perspectiva de una cámara alta en la banda (metros → imagen 0..1)
const CAM = [[0.0062, 0.0021, 0.08], [0.0004, 0.0102, 0.18], [0.00001, 0.0021, 1]];
const shoot = (g) => { const q = applyH(CAM, g); return { x: q.x, y: q.y }; };

test("calibración: con 4 puntos recupera la cámara y mide distancias en metros", () => {
  const p = pitchOf({ field: "f11" }); const lm = Object.fromEntries(landmarks(p).map((l) => [l.k, l]));
  const keys = ["gia", "gib", "ma", "mc"];
  const cal = { field: "f11", pairs: keys.map((k) => ({ k, ...shoot(lm[k]) })) };
  const sol = solveCal(cal, 1);
  assert.ok(sol, "se resuelve");
  assert.equal(sol.err, null); // con 4 no se puede comprobar
  // otro punto del campo cae donde la cámara de verdad
  const s = shoot(lm.si), q = applyH(sol.H, lm.si);
  assert.ok(Math.hypot(q.x - s.x, q.y - s.y) < 1e-6);
  // distancia entre el punto de penalti y el centro del campo: 52,5 − 11 = 41,5 m
  assert.ok(Math.abs(groundDist(sol, shoot(lm.si), shoot(lm.mc)) - 41.5) < 1e-3);
  assert.equal(fmtM(41.5), "42 m"); assert.equal(fmtM(7.25), "7,3 m");
});

test("calibración: con 5 o más puntos da la precisión y detecta un punto mal puesto", () => {
  const p = pitchOf({ field: "f11" }); const lm = Object.fromEntries(landmarks(p).map((l) => [l.k, l]));
  const keys = ["gia", "gib", "pia", "ma", "mc", "si"];
  const good = solveCal({ field: "f11", pairs: keys.map((k) => ({ k, ...shoot(lm[k]) })) }, 1);
  assert.ok(good.err < 0.01); assert.equal(calQuality(good).level, "good");
  const pairs = keys.map((k) => ({ k, ...shoot(lm[k]) })); pairs[5] = { ...pairs[5], x: pairs[5].x + 0.05 };
  const bad = solveCal({ field: "f11", pairs }, 1);
  assert.ok(bad.err > 1.5, `error ${bad.err}`); assert.equal(calQuality(bad).level, "bad");
});

test("calibración: faltan puntos, puntos en línea o claves que no existen", () => {
  assert.equal(solveCal({ pairs: [] }), null);
  assert.equal(calQuality(null).level, "none");
  const p = pitchOf({}); const lm = Object.fromEntries(landmarks(p).map((l) => [l.k, l]));
  // cuatro puntos en la misma línea (la banda de arriba) no valen
  const line = ["cia", "ma", "cda"].map((k) => ({ k, ...shoot(lm[k]) }));
  assert.equal(solveCal({ pairs: [...line, { k: "zzz", x: 0.5, y: 0.5 }] }, 1), null);
  assert.equal(homography([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }], [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]), null);
});

test("calibración: medidas del campo, fútbol 7 y dibujos en el césped", () => {
  assert.equal(pitchOf({ field: "f7" }).len, 65);
  assert.equal(pitchOf({ field: "f11", len: 100, wid: 64 }).wid, 64);
  assert.equal(pitchOf({ field: "f11", len: "x" }).len, 105);
  const p7 = pitchOf({ field: "f7" });
  assert.ok(landmarks(p7).every((l) => l.x >= 0 && l.x <= 65 && l.y >= 0 && l.y <= 45));
  assert.ok(!landmarks(p7).some((l) => l.k.startsWith("a")), "en F7 no hay arco del área");
  assert.ok(pitchLines(p7).some((l) => l.every((q) => Math.abs(q.x - 12) < 1e-9)), "línea de fuera de juego a 12 m");
  assert.equal(markLines(pitchOf({}), "carriles5").length, 4);
  assert.equal(markLines(pitchOf({}), "zonas18").length, 6);
  assert.equal(markLines(pitchOf({}), "").length, 0);
  const lm = Object.fromEntries(landmarks(pitchOf({})).map((l) => [l.k, l]));
  const sol = solveCal({ pairs: ["gia", "gib", "ma", "mc"].map((k) => ({ k, ...shoot(lm[k]) })) }, 1);
  // un círculo de 9,15 m alrededor del centro pasa por los puntos del círculo central
  const circ = circleImg(sol, lm.mc, 9.15, 4); const top = shoot(lm.mca);
  assert.ok(circ.some((q) => Math.hypot(q.x - top.x, q.y - top.y) < 1e-6));
  // un rectángulo del césped tiene sus lados paralelos a las líneas del campo
  const r = groundRectImg(sol, shoot({ x: 20, y: 10 }), shoot({ x: 40, y: 30 }));
  assert.ok(Math.hypot(r[1].x - shoot({ x: 40, y: 10 }).x, r[1].y - shoot({ x: 40, y: 10 }).y) < 1e-6);
  assert.ok(lineImg(sol, [{ x: 0, y: 0 }, { x: 105, y: 0 }]).length >= 1);
  assert.ok(invertH([[1, 0, 0], [0, 1, 0], [0, 0, 1]]));
});

test("calibración: funciona aunque la escala de la homografía salga negativa (puntos de un clip de Veo)", () => {
  const P = [["pdb", 0.487, 0.5056], ["pdfb", 0.5375, 0.4787], ["pda", 0.1313, 0.4676], ["pdfa", 0.2031, 0.4481], ["gdb", 0.6714, 0.6389], ["gdfb", 0.7901, 0.5037]];
  const sol = solveCal({ field: "f11", pairs: P.map(([k, x, y]) => ({ k, x, y })) }, 16 / 9);
  assert.ok(sol, "se resuelve");
  assert.ok(sol.err < 1, `error ${sol.err}`);
  assert.ok(applyH(sol.H, { x: 99.5, y: 34 }).w > 0);
});
