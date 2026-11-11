// Análisis de vídeo: tablas de etiquetas, velocidades y tiempo de los clips con congelados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RATES, stepRate, cleanTag, defaultSets, duplicateKeys, uniqueName, duplicateSet, exportSets, importSets, restoreSets } from "../src/lib/videoTags.js";
import { clipLen, mapL, freezeStartL, localOfVideo, ptsAt, kfOffset, samplesToLocal, spliceKeys, interpAt } from "../src/lib/videoTimeline.js";

test("velocidad: flechas arriba y abajo recorren la lista y se paran en los extremos", () => {
  assert.equal(stepRate(1, 1), 1.5);
  assert.equal(stepRate(1.5, 1), 2);
  assert.equal(stepRate(2, 1), 3);
  assert.equal(stepRate(8, 1), 8);
  assert.equal(stepRate(1, -1), 0.75);
  assert.equal(stepRate(0.25, -1), 0.25);
  assert.equal(stepRate(1.2, 1), 1.5);
  assert.ok(RATES.includes(1) && RATES.includes(3));
});

test("etiqueta: limpia nombre, color, tecla y segundos", () => {
  const t = cleanTag({ label: "  Pérdida ", color: "rojo", key: "Q", pre: -3, post: 500, mode: "x" });
  assert.equal(t.label, "Pérdida");
  assert.equal(t.color, "#3ec7ff");
  assert.equal(t.key, "q");
  assert.equal(t.pre, 0);
  assert.equal(t.post, 120);
  assert.equal(t.mode, "instant");
  assert.equal(cleanTag({ key: " " }).key, "", "la barra espaciadora es de reproducir");
  assert.equal(cleanTag({ key: "," }).key, "");
});

test("tablas: teclas repetidas, nombres sin repetir y duplicar", () => {
  const [set] = defaultSets();
  assert.equal(set.tags.length, 12);
  assert.deepEqual(duplicateKeys(set.tags), {});
  const tags = [{ id: "a", key: "1" }, { id: "b", key: "1" }, { id: "c", key: "2" }, { id: "d", key: "" }];
  assert.deepEqual(duplicateKeys(tags), { 1: ["a", "b"] });
  assert.equal(uniqueName("Rival", [{ name: "Rival" }, { name: "Rival (2)" }]), "Rival (3)");
  const copy = duplicateSet(set, [set]);
  assert.equal(copy.name, "Análisis de partido (copia)");
  assert.notEqual(copy.tags[0].id, set.tags[0].id);
  assert.equal(copy.tags[0].label, set.tags[0].label);
});

test("compartir: exportar e importar una tabla", () => {
  const sets = [{ id: "x", name: "Análisis del rival", tags: [cleanTag({ label: "Salida de balón", key: "1", pre: 5, post: 6 })] }];
  const file = JSON.stringify(exportSets(sets));
  const got = importSets(file, sets);
  assert.equal(got.length, 1);
  assert.equal(got[0].name, "Análisis del rival (2)", "no pisa la que ya existe");
  assert.equal(got[0].tags[0].label, "Salida de balón");
  assert.equal(got[0].tags[0].pre, 5);
  assert.notEqual(got[0].id, "x");
  assert.throws(() => importSets("{nada"), /no es una tabla/);
  assert.throws(() => importSets({ app: "otra" }), /no es una tabla/);
  assert.throws(() => importSets({ app: "rs-video-tags", sets: [] }), /ninguna tabla/);
  const fromProject = importSets({ app: "rs-video", tags: [{ label: "Gol", key: "g" }] });
  assert.equal(fromProject[0].tags[0].label, "Gol");
});

test("guardado: recupera tablas y la activa; acepta la lista antigua", () => {
  const legacy = restoreSets(null, [{ label: "Pérdida", key: "3" }]);
  assert.equal(legacy.sets.length, 1);
  assert.equal(legacy.sets[0].tags[0].label, "Pérdida");
  const empty = restoreSets(null, null);
  assert.equal(empty.sets[0].tags.length, 12);
  const two = restoreSets({ sets: [{ id: "a", name: "A", tags: [] }, { id: "b", name: "B", tags: [] }], active: "b" });
  assert.equal(two.active, "b");
  assert.equal(restoreSets({ sets: [{ id: "a", name: "A", tags: [] }], active: "zz" }).active, "a");
});

const clip = { tin: 100, tout: 110, freezes: [{ at: 4, dur: 3 }] };

test("clip con congelado: duración y paso de tiempo local a tiempo del vídeo", () => {
  assert.equal(clipLen(clip), 13);
  assert.deepEqual(mapL(clip, 2), { vt: 102, frozen: null });
  assert.equal(mapL(clip, 5).vt, 104);
  assert.ok(mapL(clip, 5).frozen);
  assert.equal(mapL(clip, 8).vt, 105);
  assert.equal(mapL(clip, 8).frozen, null);
  assert.equal(freezeStartL(clip, clip.freezes[0]), 4);
  assert.equal(localOfVideo(clip, 103), 3);
  assert.equal(localOfVideo(clip, 106), 9);
});

test("dibujos: keyframes de todo el dibujo y recorrido propio de cada punto", () => {
  const d = { pts: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }], kf: [{ t: 0, dx: 0, dy: 0 }, { t: 2, dx: 0.2, dy: 0 }] };
  assert.deepEqual(kfOffset(d, 1).map((v) => +v.toFixed(3)), [0.1, 0]);
  d.ptk = [null, [{ t: 0, x: 0.5, y: 0.5 }, { t: 2, x: 0.7, y: 0.9 }]];
  const p = ptsAt(d, 1);
  assert.equal(+p[0].x.toFixed(3), 0.2);
  assert.equal(+p[1].x.toFixed(3), 0.6);
  assert.equal(+p[1].y.toFixed(3), 0.7);
  assert.equal(interpAt([], 1, ["x"]), null);
});

test("seguimiento: las muestras pasan a tiempo local y se quedan quietas en el congelado", () => {
  const samples = [{ vt: 103, x: 0.1, y: 0.5 }, { vt: 104, x: 0.2, y: 0.5 }, { vt: 105, x: 0.3, y: 0.5 }];
  const k = samplesToLocal(clip, samples);
  const at = (t) => interpAt(k, t, ["x"]).x;
  assert.equal(+at(3).toFixed(3), 0.1);
  assert.equal(+at(4).toFixed(3), 0.2);
  assert.equal(+at(5.5).toFixed(3), 0.2, "durante el congelado no se mueve");
  assert.equal(+at(7).toFixed(3), 0.2);
  assert.equal(+at(8).toFixed(3), 0.3);
  const spliced = spliceKeys([{ t: 0, x: 0 }, { t: 5, x: 1 }], 3, [{ t: 3, x: 2 }]);
  assert.deepEqual(spliced.map((s) => s.t), [0, 3]);
});
