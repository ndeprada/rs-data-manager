import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPatterns, patternCss, pageInfo, pageSettings, PAGES, PATTERN_KEYS } from "../src/lib/pagePatterns.js";
import { cleanBrand, brandDiff, fullBrand } from "../src/lib/brand.js";

test("sin ajustes: ninguna regla (la app se ve como siempre)", () => {
  assert.equal(patternCss({}), "");
  assert.equal(patternCss(fullBrand({})), "");
  assert.deepEqual(brandDiff(fullBrand({})), {});
});

test("cada página tiene un patrón que existe", () => {
  for (const p of PAGES) assert.ok(PATTERN_KEYS.includes(p.pattern), p.path);
  assert.equal(pageInfo("/Players").pattern, "listados");
  assert.equal(pageInfo("/Configuracion").pattern, null);
});

test("limpieza: valores inválidos fuera, patrón igual al de siempre fuera", () => {
  const c = cleanPatterns({
    patterns: { listados: { radius: "round", bg: "#abcdef", density: "enorme" }, nada: { bg: "#000000" }, fichas: {} },
    pages: { "/Players": { pattern: "listados", titleColor: "accent" }, "/Teams": { pattern: "fichas" }, "/Hack": { bg: "#000000" } },
  });
  assert.deepEqual(c, { patterns: { listados: { bg: "#ABCDEF", radius: "round" } }, pages: { "/Players": { titleColor: "accent" }, "/Teams": { pattern: "fichas" } } });
  assert.deepEqual(cleanBrand({ patterns: c.patterns, pages: c.pages }), c);
});

test("ajustes de una página = los de su patrón + los propios; reglas de página después", () => {
  const cfg = { patterns: { fichas: { radius: "square", titleCase: "normal" } }, pages: { "/Teams": { pattern: "fichas", titleCase: "upper" } } };
  assert.equal(pageInfo("/Teams", cfg).pattern, "fichas");
  assert.deepEqual(pageSettings("/Teams", cfg), { radius: "square", titleCase: "upper" });
  const css = patternCss(cfg, { primary: "#123456" });
  assert.ok(css.indexOf('[data-pattern="fichas"]') < css.indexOf('[data-page="/Teams"]'));
  assert.match(css, /border-radius: 2px/);
  assert.match(css, /text-transform: uppercase/);
});
