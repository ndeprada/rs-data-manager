// Traducciones (es · en · fr · ca): que no falte ninguna y que las filas sean coherentes.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { LANGUAGES, DEFAULT_LANG, isLang, msg, interpolate, buildDictionaries, makeTranslate } from "../src/i18n/translate.js";
import { ALL_ROWS, DICTIONARIES, translate } from "../src/i18n/dictionaries.js";
import { POSITION_CATALOG, GROUP_LABELS } from "../src/lib/competencyCatalog.js";
import { F7_PRINCIPLE, F7_POSITIONS, F11_POSITION_OPTIONS } from "../src/lib/f7Positions.js";
import { AREAS, GK_TECH_ITEMS, GK_TACTICAL_ITEMS, areasFor } from "../src/lib/eval360.js";
import { APP_FUNCTIONS, TEAM_ROLES, FUNCTION_LABELS, teamRoleLabel } from "../src/lib/staffRoles.js";
import { STAFF_REQUIRED_LABELS } from "../src/lib/registration.js";
import { INJURY_TYPE_LABELS, BODY_PART_LABELS, SEVERITY_LABELS, DOCUMENT_TYPE_LABELS } from "../src/lib/injuryLabels.js";
import { CANCEL_REASONS, cancelWord } from "../src/lib/eventCancel.js";
import { LEVELS } from "../src/lib/playerPositions.js";
import { WEAK_FOOT_LEVELS } from "../src/lib/weakFoot.js";

const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const hasRow = (key) => Object.prototype.hasOwnProperty.call(DICTIONARIES.en, key) && key in DICTIONARIES.fr && key in DICTIONARIES.ca;

test("idiomas: español por defecto y cuatro disponibles", () => {
  assert.equal(DEFAULT_LANG, "es");
  assert.deepEqual(LANGUAGES.map((l) => l.code), ["es", "en", "fr", "ca"]);
  assert.ok(isLang("ca") && !isLang("de") && !isLang(undefined));
});

test("traducir: sustituye variables y cae al español si falta", () => {
  assert.equal(interpolate("Hola {nombre}", { nombre: "Ana" }), "Hola Ana");
  assert.equal(interpolate("Hola {nombre}", {}), "Hola {nombre}");
  const tr = makeTranslate(buildDictionaries([["Mi equipo", "My team", "Mon équipe", "El meu equip"], ["{n} jugadores", "{n} players", "{n} joueurs", "{n} jugadors"]]));
  assert.equal(tr("en", "Mi equipo"), "My team");
  assert.equal(tr("fr", "Mi equipo"), "Mon équipe");
  assert.equal(tr("ca", "{n} jugadores", { n: 3 }), "3 jugadors");
  assert.equal(tr("es", "Mi equipo"), "Mi equipo");
  assert.equal(tr("en", "Texto sin traducir"), "Texto sin traducir");
  assert.equal(tr("en", "Texto sin traducir {x}", { x: 1 }), "Texto sin traducir 1");
  assert.equal(tr("en", ""), "");
  assert.equal(tr("en", undefined), "");
  assert.equal(msg("Amistoso"), "Amistoso");
});

test("filas: cuatro columnas con texto", () => {
  const bad = ALL_ROWS.filter((r) => !Array.isArray(r) || r.length !== 4 || r.some((c) => typeof c !== "string" || !c.trim()));
  assert.deepEqual(bad.slice(0, 5), []);
});

test("filas: las variables {x} coinciden en los cuatro idiomas", () => {
  const bad = ALL_ROWS.filter(([es, en, fr, ca]) => placeholders(es) !== placeholders(en) || placeholders(es) !== placeholders(fr) || placeholders(es) !== placeholders(ca));
  assert.deepEqual(bad.slice(0, 5), []);
});

test("filas: el mismo texto en español no tiene traducciones distintas", () => {
  const seen = new Map();
  const conflicts = [];
  ALL_ROWS.forEach((row) => {
    const prev = seen.get(row[0]);
    if (!prev) { seen.set(row[0], row); return; }
    if (prev[1] !== row[1] || prev[2] !== row[2] || prev[3] !== row[3]) conflicts.push(row[0]);
  });
  assert.deepEqual(conflicts.slice(0, 10), []);
});

test("filas: sin espacios sobrantes ni saltos de línea en las traducciones", () => {
  // En francés va un espacio delante de : ; ! ? (puntuación francesa)
  const bad = ALL_ROWS.filter(([, ...tr]) => tr.some((s) => { const x = s.replace(/^ (?=[:;!?»])/, ""); return x !== x.trim() || /\n/.test(x); }));
  assert.deepEqual(bad.map((r) => r[0]).slice(0, 5), []);
});

// ---- Todo texto t("…") / msg("…") del código tiene su traducción ----
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
function usedKeys() {
  const out = new Map();
  const files = walk("src").filter((f) => /\.(jsx?|mjs)$/.test(f) && !f.split(path.sep).join("/").startsWith("src/i18n/rows"));
  const re = /(?<![\w.$])(?:t|msg)\(\s*(?:"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\$]|\\.|\$(?!\{))*)`)/g;
  files.forEach((f) => {
    const src = fs.readFileSync(f, "utf8");
    let m;
    while ((m = re.exec(src))) {
      const raw = m[1] ?? m[2] ?? m[3];
      let v;
      try { v = m[1] !== undefined ? JSON.parse(`"${raw}"`) : raw.replace(/\\(['"`\\])/g, "$1").replace(/\\n/g, "\n"); } catch { v = raw; }
      if (!out.has(v)) out.set(v, f);
    }
  });
  return out;
}

test("código: cada t(\"…\") y msg(\"…\") tiene fila de traducción", () => {
  const used = usedKeys();
  assert.ok(used.size > 300, `se esperaban muchas claves, hay ${used.size}`);
  const missing = [...used.entries()].filter(([k]) => !hasRow(k) && !isIdentical(k)).map(([k, f]) => `${k}  (${f})`);
  assert.deepEqual(missing.slice(0, 15), []);
});

// Textos que se escriben igual en todos los idiomas pueden no tener fila (siglas, nombres propios…)
function isIdentical(k) { return !/[a-záéíóúñç]{3,}/i.test(k.replace(/\{\w+\}/g, "")); }

// ---- Catálogos de datos (competencias, fútbol 7, Evaluación 360) ----
const SKIP = new Set(["id", "references", "value", "pendingReview"]);
function strings(node, out = []) {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => strings(n, out));
  else if (node && typeof node === "object") Object.entries(node).forEach(([k, v]) => { if (!SKIP.has(k)) strings(v, out); });
  return out;
}

test("catálogo de competencias por posición: todo traducido", () => {
  const all = strings(POSITION_CATALOG).concat(strings(GROUP_LABELS));
  assert.ok(all.length > 400);
  const missing = [...new Set(all)].filter((s) => !hasRow(s));
  assert.deepEqual(missing.slice(0, 10), []);
});

test("fútbol 7: principio, posiciones, cualidades y contenidos traducidos", () => {
  const all = [F7_PRINCIPLE, ...strings(F7_POSITIONS)];
  const missing = [...new Set(all)].filter((s) => !hasRow(s));
  assert.deepEqual(missing.slice(0, 10), []);
});

test("posiciones de fútbol 11: las que ve el jugador están traducidas", () => {
  const missing = Object.values(POSITION_CATALOG).map((p) => p.label).filter((s) => !hasRow(s));
  assert.deepEqual(missing, []);
  assert.ok(F11_POSITION_OPTIONS.length >= 7);
});

test("Evaluación 360: áreas, pistas y criterios traducidos (también los del portero)", () => {
  const all = [];
  [...AREAS, ...areasFor("portero")].forEach((a) => { all.push(a.label, a.hint); a.items.forEach((it) => all.push(it.label)); });
  [...GK_TECH_ITEMS, ...GK_TACTICAL_ITEMS].forEach((it) => all.push(it.label));
  assert.ok(all.length > 60);
  const missing = [...new Set(all)].filter((s) => !hasRow(s));
  assert.deepEqual(missing.slice(0, 10), []);
});

test("tablas de textos de las pantallas de jugador, familia y alta: todo traducido", () => {
  const all = [
    ...APP_FUNCTIONS.flatMap((f) => [f.label, f.hint].filter(Boolean)),
    ...TEAM_ROLES.map((r) => r.label), ...Object.values(FUNCTION_LABELS), teamRoleLabel(null),
    ...Object.values(STAFF_REQUIRED_LABELS),
    ...Object.values(INJURY_TYPE_LABELS), ...Object.values(BODY_PART_LABELS), ...Object.values(SEVERITY_LABELS), ...Object.values(DOCUMENT_TYPE_LABELS),
    ...CANCEL_REASONS.map((r) => r.label), cancelWord({ type: "partido_liga" }), cancelWord({ type: "entrenamiento" }),
    ...Object.values(LEVELS).map((l) => l.label),
    ...Object.values(WEAK_FOOT_LEVELS).flatMap((l) => [l.label, l.hint].filter(Boolean)),
  ];
  assert.ok(all.length > 60);
  const missing = [...new Set(all)].filter((x) => !hasRow(x));
  assert.deepEqual(missing, []);
});

test("traducción real: ejemplos en los cuatro idiomas", () => {
  assert.equal(translate("en", "Mediapunta"), "Complete forward");
  assert.equal(translate("fr", "Mediapunta"), "Attaquant complet");
  assert.equal(translate("ca", "Mediapunta"), "Davanter complet");
  assert.equal(translate("es", "Mediapunta"), "Mediapunta");
  assert.notEqual(translate("en", F7_POSITIONS.extremo.why), F7_POSITIONS.extremo.why);
  assert.notEqual(translate("ca", AREAS[0].label), "");
});
