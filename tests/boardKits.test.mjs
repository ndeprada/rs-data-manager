import test from "node:test";
import assert from "node:assert/strict";
import { KIT_GROUPS, kitPatch, sameKit } from "../src/lib/boardKits.js";
import { CHIP_KINDS, CHIP_PATTERNS, chipStyle } from "../src/lib/board.js";

const HEX = /^#[0-9a-f]{6}$/i;
// Nombres de clubes que no deben aparecer nunca en la galería (sus colores sí, nombrados por los colores)
const CLUBS = /barcelona|madrid|athletic|atl[eé]tico|betis|sevilla|valencia|espanyol|celta|juventus|milan|inter|chelsea|arsenal|liverpool|united|city|bayern|dortmund|psg|ajax|benfica|porto|boca|river/i;

test("equipaciones: grupos con nombre, colores válidos y diseños que la pizarra sabe pintar", () => {
  assert.deepEqual(KIT_GROUPS.map((g) => g.id), ["basicos", "porteros", "rayas", "camisetas", "racing"]);
  const patterns = new Set(CHIP_PATTERNS.map((p) => p.id));
  const kinds = new Set(CHIP_KINDS.map((k) => k.id));
  for (const g of KIT_GROUPS) {
    assert.ok(g.kits.length >= 5, g.name);
    const names = new Set();
    for (const k of g.kits) {
      assert.ok(!names.has(k.name), `nombre repetido en ${g.name}: ${k.name}`);
      names.add(k.name);
      assert.ok(!CLUBS.test(k.name), `sin nombres de clubes: ${k.name}`);
      assert.match(k.color, HEX, k.name);
      if (k.color2) assert.match(k.color2, HEX, k.name);
      if (k.trim) assert.match(k.trim, HEX, k.name);
      assert.ok(patterns.has(k.pattern), `${k.name}: ${k.pattern}`);
      assert.ok(kinds.has(k.kit), `${k.name}: ${k.kit}`);
      if (k.pattern !== "solid") assert.ok(k.color2, `${k.name} necesita segundo color`);
    }
  }
});

test("equipaciones del club: 1.ª blanca con granate, 2.ª granate, 3.ª verde y porteros naranja y azul eléctrico", () => {
  const racing = KIT_GROUPS.find((g) => g.id === "racing").kits;
  const by = (n) => racing.find((k) => k.name === n);
  assert.equal(by("1.ª equipación").color, "#ffffff");
  assert.equal(by("1.ª equipación").trim, "#73000A");
  assert.equal(by("2.ª equipación").color, "#73000A");
  assert.equal(by("Portero naranja").color, "#FF6E00");
  assert.ok(by("3.ª equipación") && by("Portero azul eléctrico"));
});

test("elegir una equipación cambia el equipo entero y se reconoce como elegida", () => {
  const kit = KIT_GROUPS.find((g) => g.id === "camisetas").kits[0];
  const p = kitPatch(kit);
  assert.equal(p.kit, "camiseta");
  assert.equal(p.stroke, undefined, "el borde propio se quita: sale del color de la equipación");
  const team = { id: "a", name: "A", stroke: "#123456", ...p };
  assert.ok(sameKit(team, kit));
  assert.ok(!sameKit({ ...team, color: "#000000" }, kit));
  const st = chipStyle({ teams: [team] }, { team: "a" });
  assert.equal(st.kit, "camiseta");
  assert.equal(st.pattern, kit.pattern);
  assert.equal(st.trim, kit.trim);
  const basic = kitPatch(KIT_GROUPS[0].kits[0]);
  assert.equal(basic.kit, "boton");
  assert.equal(basic.trim, undefined);
});
