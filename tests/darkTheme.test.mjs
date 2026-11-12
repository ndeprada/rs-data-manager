import test from "node:test";
import assert from "node:assert/strict";
import { darkCss, themeFor, readableOnDark, DARK } from "../src/lib/darkTheme.js";
import { cleanBrand, brandDiff, fullBrand, contrastRatio } from "../src/lib/brand.js";
import { configFile, readConfigFile, configSummary, CONFIG_FILE_APP } from "../src/lib/configFile.js";

test("modo de color: claro por defecto, oscuro para todos o a elegir", () => {
  assert.equal(themeFor({}), "light");
  assert.equal(themeFor({ theme: "light" }, "dark"), "light");
  assert.equal(themeFor({ theme: "dark" }), "dark");
  assert.equal(themeFor({ theme: "choice" }), "light");
  assert.equal(themeFor({ theme: "choice" }, "dark"), "dark");
  assert.deepEqual(cleanBrand({ theme: "light" }), {});
  assert.deepEqual(cleanBrand({ theme: "rosa" }), {});
  assert.deepEqual(brandDiff(fullBrand({ theme: "dark" })), { theme: "dark" });
  assert.equal(fullBrand({}).theme, "light");
});

test("modo oscuro: el color del club se aclara hasta leerse y nada toca lo que va en claro", () => {
  const ink = readableOnDark("#73000A");
  assert.ok(contrastRatio(ink, DARK.surface) >= 4.5);
  assert.equal(readableOnDark("#FFFFFF"), "#FFFFFF");
  const css = darkCss({ primary: "#73000A", accent: "#FF6E00", primarySoft: "#FDF2F4" });
  assert.ok(css.startsWith("@media screen"));
  assert.ok(css.includes(`--club-primary-ink: ${ink}`));
  assert.ok(css.includes('.bg-white:not(.rs-nodark, .rs-nodark *)'));
  assert.ok(css.includes('[style*="background: rgb(255, 255, 255)"]'));
  assert.ok(css.includes('[style^="color: rgb(115, 0, 10)"]'));
  assert.ok(css.includes(".hover\\:bg-gray-50:hover"));
  assert.ok(!/::[a-z-]+:not\(/.test(css), "un pseudo-elemento tiene que ir al final del selector");
  // Las reglas que cambian colores llevan todas la exclusión
  for (const line of css.split("\n").filter((l) => l.includes("!important") && !l.includes(":is(h1"))) assert.ok(line.includes(".rs-nodark") || line.includes("h3"), line);
});

test("archivo de configuración: exportar, importar y resumen", () => {
  const diff = { appName: "Club Demo", colors: { primary: "#003366" }, theme: "choice", hidden: ["video"] };
  const f = configFile(diff, { clubName: "Demo", now: new Date("2026-11-12T10:00:00Z") });
  assert.equal(f.app, CONFIG_FILE_APP);
  assert.equal(f.exported_at, "2026-11-12T10:00:00.000Z");
  assert.deepEqual(readConfigFile(JSON.parse(JSON.stringify(f))), cleanBrand(diff));
  assert.deepEqual(readConfigFile({ clubName: "Otro" }), { clubName: "Otro" });
  assert.throws(() => readConfigFile({ hola: 1 }), /not_config/);
  assert.throws(() => readConfigFile([1, 2]), /not_config/);
  assert.throws(() => readConfigFile({ app: CONFIG_FILE_APP }), /not_config/);
  assert.deepEqual(configSummary(diff), ["names", "colors", "structure", "theme"]);
  assert.deepEqual(configSummary({}), []);
});
