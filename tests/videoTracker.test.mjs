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

test("suavizado del seguimiento: quita el balanceo de cada zancada sin retrasar la marca", async () => {
  const { smoothTrack } = await import("../src/lib/videoTimeline.js");
  // jugador que avanza en línea recta con un balanceo de 3 veces por segundo (±0,008) y un fotograma que salta
  const raw = []; for (let i = 0; i <= 90; i++) { const t = i / 30; raw.push({ vt: t, x: 0.2 + 0.1 * t, y: 0.5 + 0.008 * Math.sin(2 * Math.PI * 3 * t) }); }
  raw[45].x += 0.08;
  const s = smoothTrack(raw, 0.15);
  for (let i = 5; i < 86; i++) {
    assert.ok(Math.abs(s[i].y - 0.5) < 0.0015, `balanceo en ${i}: ${s[i].y}`);
    assert.ok(Math.abs(s[i].x - (0.2 + 0.1 * raw[i].vt)) < 0.004, `retraso o salto en ${i}: ${s[i].x}`);
  }
  // en los extremos la marca no se va hacia dentro (recta ajustada, no media)
  assert.ok(Math.abs(s[0].x - 0.2) < 0.003 && Math.abs(s[90].x - 0.5) < 0.003);
  assert.equal(smoothTrack(raw.slice(0, 2)).length, 2);
});

test("corregir un seguimiento: mueve ese momento del todo y lo de alrededor cada vez menos", async () => {
  const { nudgeTrack, interpAt } = await import("../src/lib/videoTimeline.js");
  const kf = []; for (let i = 0; i <= 100; i++) kf.push({ t: i / 25, dx: i / 1000, dy: 0 });
  const out = nudgeTrack(kf, 2, 0.1, -0.05, 0.6);
  const at = (t) => interpAt(out, t, ["dx", "dy"]);
  assert.ok(Math.abs(at(2).dx - (0.05 + 0.1)) < 1e-9 && Math.abs(at(2).dy + 0.05) < 1e-9);
  assert.ok(at(2.3).dx > 2.3 * 25 / 1000 && at(2.3).dx < 2.3 * 25 / 1000 + 0.1); // a medias
  assert.equal(at(1).dx, 25 / 1000); // fuera del alcance no cambia
  assert.equal(at(3).dx, 75 / 1000);
  assert.equal(kf[50].dx, 0.05); // la lista original no se toca
  // en un momento sin punto, se crea uno
  const sparse = nudgeTrack([{ t: 0, x: 0.1, y: 0.1 }, { t: 4, x: 0.5, y: 0.1 }], 1, 0, 0.2, 0.5, "x", "y");
  assert.equal(sparse.length, 3); assert.ok(Math.abs(sparse[1].x - 0.2) < 1e-9 && Math.abs(sparse[1].y - 0.3) < 1e-9);
});
