// Análisis de vídeo: el seguimiento automático sigue a un «jugador» que se mueve por un césped con rayas,
// sin irse con otro jugador de distinto color que se cruza cerca.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTracker, bodyBox } from "../src/lib/videoTracker.js";

const W = 320, H = 180;
function frame(players, pan = 0) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const stripe = Math.floor((x + pan) / 20) % 2 ? 18 : 0; // franjas del césped que se mueven con la cámara
    const o = (y * W + x) * 4; data[o] = 40; data[o + 1] = 120 + stripe; data[o + 2] = 45; data[o + 3] = 255;
  }
  for (const p of players) {
    // cabeza clara, camiseta del color del equipo y pantalón oscuro; pies en (p.x, p.y)
    for (let y = Math.round(p.y - 24); y <= Math.round(p.y); y++) for (let x = Math.round(p.x - 4); x <= Math.round(p.x + 4); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const o = (y * W + x) * 4; const rel = p.y - y;
      const col = rel > 19 ? [230, 190, 160] : rel > 9 ? p.shirt : [30, 30, 40];
      data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2];
    }
  }
  return { data, width: W, height: H };
}

test("caja del cuerpo: pies abajo en el centro", () => {
  const b = bodyBox(100, 80, 40);
  assert.equal(b.y + b.h, 80);
  assert.equal(b.x + b.w / 2, 100);
});

test("sigue a un jugador en movimiento con la cámara moviéndose", () => {
  const red = [200, 30, 40], white = [240, 240, 240];
  const posAt = (i) => ({ x: 60 + i * 3, y: 120 - i * 0.8, shirt: red });
  const other = (i) => ({ x: 200 - i * 2.5, y: 110, shirt: white });
  const tr = createTracker(frame([posAt(0), other(0)]), 60, 120, 28);
  assert.ok(tr);
  let maxErr = 0;
  for (let i = 1; i <= 45; i++) {
    const r = tr.update(frame([posAt(i), other(i)], i * 2));
    assert.equal(r.lost, false, `perdido en el fotograma ${i}`);
    maxErr = Math.max(maxErr, Math.hypot(r.x - posAt(i).x, r.y - posAt(i).y));
  }
  assert.ok(maxErr < 4, `error máximo ${maxErr.toFixed(1)} px`);
});

test("si el jugador desaparece, lo da por perdido", () => {
  const p = { x: 100, y: 120, shirt: [200, 30, 40] };
  const tr = createTracker(frame([p]), 100, 120, 28);
  let lost = false;
  for (let i = 0; i < 8 && !lost; i++) lost = tr.update(frame([])).lost;
  assert.equal(lost, true);
});

test("no empieza si la caja se sale de la imagen por arriba", () => {
  assert.equal(createTracker(frame([]), 10, 5, 400), null);
});
