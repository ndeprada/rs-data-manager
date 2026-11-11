// Análisis de vídeo · tiempo de un clip con congelados y movimiento de los dibujos.
// Lógica pura (sin DOM), probada en tests/videoTimeline.test.mjs.
//
// Un clip va de `tin` a `tout` del vídeo. Los congelados (`freezes: [{at, dur}]`, `at` = segundos desde `tin`)
// paran la imagen `dur` segundos. El «tiempo local» del clip cuenta también los congelados; los dibujos guardan
// sus tiempos (`from`, `to`, keyframes) en tiempo local.

export const clipLen = (c) => (c.tout - c.tin) + (c.freezes || []).reduce((a, f) => a + f.dur, 0);

const sortedFreezes = (c) => [...(c.freezes || [])].sort((a, b) => a.at - b.at);

// Tiempo local → { vt: segundo del vídeo, frozen: congelado en curso o null }
export function mapL(c, L) {
  let v = 0, l = 0;
  for (const f of sortedFreezes(c)) {
    const seg = f.at - v;
    if (L < l + seg) return { vt: c.tin + v + (L - l), frozen: null };
    l += seg; v = f.at;
    if (L < l + f.dur) return { vt: c.tin + f.at, frozen: f };
    l += f.dur;
  }
  return { vt: Math.min(c.tout, c.tin + v + (L - l)), frozen: null };
}

// Momento local en que empieza un congelado
export function freezeStartL(c, f) {
  const before = sortedFreezes(c).filter((x) => x !== f && (x.at < f.at || (x.at === f.at && (c.freezes || []).indexOf(x) < (c.freezes || []).indexOf(f))));
  return f.at + before.reduce((a, x) => a + x.dur, 0);
}

// Segundo del vídeo → tiempo local (justo antes de un congelado que empieza en ese punto)
export function localOfVideo(c, vt) {
  const off = vt - c.tin;
  return off + sortedFreezes(c).filter((f) => f.at < off - 1e-6).reduce((a, f) => a + f.dur, 0);
}

// Interpola una lista ordenada [{t, …claves}] en el tiempo L
export function interpAt(list, L, keys) {
  if (!list || !list.length) return null;
  const pick = (o) => Object.fromEntries(keys.map((k) => [k, o[k]]));
  if (L <= list[0].t) return pick(list[0]);
  const z = list[list.length - 1]; if (L >= z.t) return pick(z);
  let lo = 0, hi = list.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (list[m].t <= L) lo = m; else hi = m; }
  const a = list[lo], b = list[hi], u = (L - a.t) / ((b.t - a.t) || 1);
  return Object.fromEntries(keys.map((k) => [k, a[k] + (b[k] - a[k]) * u]));
}

// Desplazamiento de todo el dibujo (keyframes `kf: [{t, dx, dy}]`)
export function kfOffset(d, L) {
  const o = interpAt(d.kf, L, ["dx", "dy"]);
  return o ? [o.dx, o.dy] : [0, 0];
}

// Puntos del dibujo en el tiempo L: keyframes de todo el dibujo y, si los hay, el recorrido propio de cada punto (`ptk`)
export function ptsAt(d, L) {
  const [dx, dy] = kfOffset(d, L);
  return d.pts.map((p, i) => {
    const own = d.ptk && d.ptk[i] && d.ptk[i].length ? interpAt(d.ptk[i], L, ["x", "y"]) : null;
    return own || { x: p.x + dx, y: p.y + dy };
  });
}

export const visibleAt = (d, L) => L >= d.from - 1e-6 && L <= d.to + 1e-6;

// Media móvil de una lista de posiciones (para quitar temblor del seguimiento)
export function smooth(samples, win = 2) {
  return samples.map((s, i) => {
    let sx = 0, sy = 0, n = 0;
    for (let j = Math.max(0, i - win); j <= Math.min(samples.length - 1, i + win); j++) { sx += samples[j].x; sy += samples[j].y; n++; }
    return { ...s, x: sx / n, y: sy / n };
  });
}

// Muestras del seguimiento [{vt, x, y}] (segundos del vídeo, coordenadas 0..1) → lista [{t, x, y}] en tiempo local,
// con la posición quieta durante cada congelado que caiga dentro.
export function samplesToLocal(c, samples) {
  if (!samples.length) return [];
  const out = samples.map((s) => ({ t: localOfVideo(c, s.vt), x: s.x, y: s.y }));
  const v0 = samples[0].vt - c.tin, v1 = samples[samples.length - 1].vt - c.tin;
  for (const f of sortedFreezes(c)) {
    if (f.at < v0 - 1e-6 || f.at > v1 + 1e-6) continue;
    const p = interpAt(samples.map((s) => ({ t: s.vt - c.tin, x: s.x, y: s.y })), f.at, ["x", "y"]);
    const s0 = freezeStartL(c, f);
    out.push({ t: s0, ...p }, { t: s0 + f.dur, ...p });
  }
  out.sort((a, b) => a.t - b.t);
  return out.filter((k, i) => i === 0 || k.t - out[i - 1].t > 1e-4);
}

// Sustituye la parte de una lista de keyframes desde `fromT` por la nueva
export function spliceKeys(old, fromT, fresh) {
  return [...(old || []).filter((k) => k.t < fromT - 1e-3), ...fresh].sort((a, b) => a.t - b.t);
}
