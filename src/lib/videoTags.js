// Análisis de vídeo · tablas de etiquetas y velocidades de reproducción.
// Lógica pura (sin DOM): la usa src/components/video/rsVideo.js y se prueba en tests/videoTags.test.mjs.

export const RATES = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];

// Siguiente velocidad hacia arriba (dir = 1) o hacia abajo (dir = -1)
export function stepRate(current, dir) {
  const r = Number(current) || 1;
  if (dir > 0) return RATES.find((x) => x > r + 1e-9) ?? RATES[RATES.length - 1];
  return [...RATES].reverse().find((x) => x < r - 1e-9) ?? RATES[0];
}

// Teclas que ya usan los controles del vídeo: no se pueden asignar a una etiqueta
export const RESERVED_KEYS = [" ", ",", ".", "arrowup", "arrowdown", "arrowleft", "arrowright", "enter", "escape", "tab", "delete", "backspace"];

let n = 0;
export const newId = () => `${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const DEFAULT_MATCH = [
  ["Ataque posicional", "#3ec7ff", "1"], ["Contraataque", "#2fbf71", "2"], ["Pérdida", "#e5484d", "3"], ["Recuperación", "#2fbf71", "4"],
  ["Presión alta", "#FF6E00", "5"], ["Bloque defensivo", "#a970ff", "6"], ["ABP a favor", "#ffd400", "7"], ["ABP en contra", "#ffa94d", "8"],
  ["Ocasión a favor", "#4ade80", "9"], ["Ocasión en contra", "#f87171", "0"], ["Gol a favor", "#ffffff", "q"], ["Gol en contra", "#73000A", "w"],
];

export function newTag(over = {}) {
  return { id: newId(), label: "Nueva etiqueta", color: "#3ec7ff", key: "", pre: 8, post: 4, mode: "instant", ...over };
}

export function defaultSets() {
  return [{ id: newId(), name: "Análisis de partido", tags: DEFAULT_MATCH.map(([label, color, key]) => newTag({ label, color, key })) }];
}

const HEX = /^#[0-9a-f]{6}$/i;
const num = (v, d, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };

export function cleanTag(t) {
  const key = String(t?.key ?? "").toLowerCase().slice(0, 1);
  return {
    id: typeof t?.id === "string" && t.id ? t.id : newId(),
    label: String(t?.label ?? "").trim().slice(0, 40) || "Etiqueta",
    color: HEX.test(t?.color) ? t.color : "#3ec7ff",
    key: RESERVED_KEYS.includes(key) ? "" : key,
    pre: num(t?.pre, 8, 0, 120),
    post: num(t?.post, 4, 0, 120),
    mode: t?.mode === "toggle" ? "toggle" : "instant",
  };
}

export function cleanSet(s) {
  return { id: typeof s?.id === "string" && s.id ? s.id : newId(), name: String(s?.name ?? "").trim().slice(0, 60) || "Tabla sin nombre", tags: (Array.isArray(s?.tags) ? s.tags : []).map(cleanTag) };
}

// Teclas repetidas dentro de una tabla: { tecla: [ids] } solo con las que se repiten
export function duplicateKeys(tags) {
  const by = {};
  (tags || []).forEach((t) => { if (t.key) (by[t.key] ||= []).push(t.id); });
  return Object.fromEntries(Object.entries(by).filter(([, ids]) => ids.length > 1));
}

// Nombre libre dentro de la lista: «Rival», «Rival (2)», «Rival (3)»…
export function uniqueName(name, sets) {
  const names = new Set((sets || []).map((s) => s.name));
  if (!names.has(name)) return name;
  const base = name.replace(/\s\(\d+\)$/, "");
  for (let i = 2; ; i++) { const c = `${base} (${i})`; if (!names.has(c)) return c; }
}

export function duplicateSet(set, sets) {
  return { id: newId(), name: uniqueName(`${set.name} (copia)`, sets), tags: set.tags.map((t) => ({ ...t, id: newId() })) };
}

// Archivo para compartir una tabla (o varias)
export function exportSets(sets) {
  return { app: "rs-video-tags", v: 1, sets: sets.map((s) => ({ name: s.name, tags: s.tags.map(({ label, color, key, pre, post, mode }) => ({ label, color, key, pre, post, mode })) })) };
}

// Lee un archivo de tablas. Devuelve las tablas nuevas (ids nuevos, nombres sin repetir) o lanza un error con mensaje claro.
export function importSets(json, existing = []) {
  let o = json;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { throw new Error("El archivo no es una tabla de etiquetas"); } }
  if (!o || (o.app !== "rs-video-tags" && o.app !== "rs-video")) throw new Error("El archivo no es una tabla de etiquetas");
  let list = o.sets;
  if (!Array.isArray(list) && Array.isArray(o.tags)) list = [{ name: o.name || "Tabla importada", tags: o.tags }];
  if (!Array.isArray(list) || !list.length) throw new Error("El archivo no trae ninguna tabla");
  const all = [...existing];
  return list.map((s) => {
    const c = cleanSet({ ...s, id: undefined, tags: (s.tags || []).map((t) => ({ ...t, id: undefined })) });
    c.name = uniqueName(c.name, all);
    all.push(c);
    return c;
  });
}

// Lo guardado en el navegador: tablas + cuál está activa. Acepta el formato antiguo (una sola lista de etiquetas).
export function restoreSets(saved, legacyTags) {
  let sets = Array.isArray(saved?.sets) ? saved.sets.map(cleanSet).filter((s) => s.tags) : [];
  if (!sets.length && Array.isArray(legacyTags) && legacyTags.length) sets = [cleanSet({ name: "Análisis de partido", tags: legacyTags })];
  if (!sets.length) sets = defaultSets();
  const active = sets.some((s) => s.id === saved?.active) ? saved.active : sets[0].id;
  return { sets, active };
}
