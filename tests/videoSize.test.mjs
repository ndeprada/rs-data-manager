import test from "node:test";
import assert from "node:assert/strict";
import { videoFrameSize } from "../src/lib/videoSize.js";

test("vídeo: 1080p horizontal y vertical como en las redes", () => {
  assert.deepEqual(videoFrameSize({ format: "landscape", quality: 1080, ratio: 0.7 }).width, 1920);
  const p = videoFrameSize({ format: "portrait", quality: 2160, ratio: 0.7 });
  assert.equal(p.width, 2160);
  assert.equal(p.height, 3840);
  assert.ok(p.inner.width <= p.width && p.inner.height <= p.height);
  assert.ok(Math.abs(p.inner.width / p.inner.height - 0.7) < 0.01, "el campo no se deforma");
});

test("vídeo ajustado al campo: lado corto = calidad, medidas pares, sin pasar de 16:9", () => {
  const v = videoFrameSize({ format: "fit", quality: 1080, ratio: 0.65 });
  assert.equal(v.width, 1080);
  assert.equal(v.height % 2, 0);
  const wide = videoFrameSize({ format: "fit", quality: 720, ratio: 3 });
  assert.ok(wide.width <= 1280 && wide.width % 2 === 0 && wide.height % 2 === 0);
  assert.equal(videoFrameSize({ quality: 999 }).width, 1080, "calidad desconocida = 1080p");
});
