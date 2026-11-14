import assert from 'node:assert/strict';
import { encode, decode } from 'fast-png';
import { toRgba, squareIcon, squarePng, isPng } from '../api/_lib/squareIcon.js';

// Escudo de mentira: 40 × 80, rojo opaco con un borde transparente de 5 px
const W = 40, H = 80;
const shield = new Uint8Array(W * H * 4);
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  const o = (y * W + x) * 4;
  const inside = x >= 5 && x < W - 5 && y >= 5 && y < H - 5;
  shield[o] = 200; shield[o + 1] = 10; shield[o + 2] = 20; shield[o + 3] = inside ? 255 : 0;
}
const png = encode({ width: W, height: H, data: shield, channels: 4, depth: 8 });

// Sale cuadrado y del tamaño pedido
const out = decode(squarePng(Buffer.from(png), 64));
assert.equal(out.width, 64);
assert.equal(out.height, 64);
assert.ok(isPng(squarePng(Buffer.from(png), 32)));

// No se deforma: el escudo ocupa todo el alto y la mitad del ancho, centrado
const px = (img, x, y) => img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4);
const a = toRgba(out);
assert.equal(px(a, 32, 32)[3], 255, 'el centro es escudo');
assert.equal(px(a, 2, 32)[3], 0, 'el lado izquierdo queda transparente');
assert.equal(px(a, 61, 32)[3], 0, 'el lado derecho queda transparente');
assert.equal(px(a, 32, 32)[0], 200, 'el color se conserva');
let left = 64, right = 0;
for (let x = 0; x < 64; x += 1) if (px(a, x, 32)[3] > 128) { left = Math.min(left, x); right = Math.max(right, x); }
const width = right - left + 1;
assert.ok(Math.abs(width - 24) <= 2, `ancho del escudo ${width}, esperado ~24 (30/80 de 64)`);
assert.ok(Math.abs((left + right) / 2 - 31.5) <= 1, 'centrado');

// Fondo blanco y margen: las esquinas son blancas y opacas, el escudo más pequeño
const w = toRgba(decode(squarePng(Buffer.from(png), 64, { pad: 0.2, bg: [255, 255, 255] })));
assert.deepEqual([...px(w, 0, 0)], [255, 255, 255, 255]);
assert.equal(px(w, 32, 4)[0], 255, 'margen arriba');
assert.equal(px(w, 32, 32)[0], 200);

// Un icono ya cuadrado y opaco no lleva margen ni fondo aunque se pidan
const sq = new Uint8Array(10 * 10 * 4).fill(255);
for (let i = 0; i < 100; i += 1) { sq[i * 4] = 115; sq[i * 4 + 1] = 0; sq[i * 4 + 2] = 10; }
const sqOut = toRgba(decode(squarePng(Buffer.from(encode({ width: 10, height: 10, data: sq, channels: 4, depth: 8 })), 20, { pad: 0.2, bg: [255, 255, 255] })));
assert.deepEqual([...px(sqOut, 0, 0)], [115, 0, 10, 255]);

// PNG en gris y con paleta también valen
const gray = encode({ width: 4, height: 2, data: new Uint8Array(8).fill(128), channels: 1, depth: 8 });
assert.equal(decode(squarePng(Buffer.from(gray), 16)).width, 16);
const pal = toRgba({ width: 2, height: 1, depth: 8, channels: 1, data: new Uint8Array([0, 1]), palette: [[1, 2, 3], [4, 5, 6, 0]] });
assert.deepEqual([...pal.data], [1, 2, 3, 255, 4, 5, 6, 0]);
const pal1 = toRgba({ width: 3, height: 1, depth: 1, channels: 1, data: new Uint8Array([0b10100000]), palette: [[0, 0, 0], [9, 9, 9]] });
assert.deepEqual([...pal1.data.filter((_, i) => i % 4 === 0)], [9, 0, 9]);

// Reducir mucho no deja el escudo deformado ni vacío
const tiny = toRgba(squareIcon(toRgba(decode(png)), 16));
assert.equal(tiny.width, 16);
assert.equal(px(tiny, 8, 8)[3], 255);
assert.equal(px(tiny, 0, 8)[3], 0);

console.log('squareIcon ok');
