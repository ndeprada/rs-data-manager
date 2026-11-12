import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BRAND, cleanBrand, brandDiff, fullBrand, deriveTones, contrastRatio, colorWarnings, setBrand, BRAND, C, F, brandCssVars } from "../src/lib/brand.js";

test("sin configuración: todo es Racing y no se guarda nada", () => {
  assert.deepEqual(brandDiff(fullBrand({})), {});
  assert.equal(fullBrand({}).colors.primary, "#73000A");
  assert.equal(fullBrand({}).fonts.numbersName, "Racing Sarria");
});

test("cleanBrand: quita lo que no es válido", () => {
  const c = cleanBrand({ appName: "  Club X  ", colors: { primary: "#12ab34", accent: "rojo", otro: "#000000" }, logo: "javascript:alert(1)", web: "http://x.com", icon: "/img/i.png", hack: 1,
    fonts: { titleName: "Oswald<script>", titleKind: "google", bodyName: "Mía", bodyKind: "file", bodyUrl: "" }, social: { instagram: "https://instagram.com/x", foo: "https://a" } });
  assert.equal(c.appName, "Club X");
  assert.deepEqual(c.colors, { primary: "#12AB34" });
  assert.equal(c.logo, undefined);
  assert.equal(c.web, undefined); // solo https
  assert.equal(c.icon, "/img/i.png");
  assert.equal(c.hack, undefined);
  assert.equal(c.fonts.titleName, "Oswaldscript");
  assert.equal(c.fonts.bodyName, undefined); // archivo sin dirección
  assert.deepEqual(c.social, { instagram: "https://instagram.com/x" });
});

test("brandDiff: solo lo que cambia; una tipografía se guarda entera", () => {
  const full = fullBrand({});
  full.appName = "Otra";
  full.colors = { ...full.colors, accent: "#00AA00" };
  full.fonts = { ...full.fonts, bodyName: "Inter", bodyKind: "google", bodyUrl: "" };
  assert.deepEqual(brandDiff(full), { appName: "Otra", colors: { accent: "#00AA00" }, fonts: { bodyName: "Inter", bodyKind: "google", bodyUrl: "" } });
  assert.deepEqual(brandDiff(fullBrand(brandDiff(full))), brandDiff(full));
});

test("setBrand cambia los objetos vivos y las variables CSS", () => {
  setBrand({ colors: { primary: "#003366" }, fonts: { titleName: "Oswald", titleKind: "google", titleUrl: "" }, appName: "Club" });
  assert.equal(C.primary, "#003366");
  assert.equal(F.title, "'Oswald', sans-serif");
  assert.equal(BRAND.appName, "Club");
  assert.equal(brandCssVars()["--club-primary-rgb"], "0 51 102");
  setBrand();
  assert.equal(C.primary, DEFAULT_BRAND.colors.primary);
  assert.equal(BRAND.appName, "RS Manager");
});

test("tonos derivados y avisos de contraste", () => {
  const t = deriveTones("#73000A", "#FF6E00");
  assert.ok(contrastRatio("#FFFFFF", t.primaryDark) > 10);
  assert.ok(contrastRatio(t.primarySoft, "#FFFFFF") < 1.2);
  assert.deepEqual(colorWarnings(DEFAULT_BRAND.colors), []);
  assert.ok(colorWarnings({ primary: "#FFEE99" }).some((w) => w.key === "primary"));
  assert.ok(Math.abs(contrastRatio("#000000", "#FFFFFF") - 21) < 0.01);
});
